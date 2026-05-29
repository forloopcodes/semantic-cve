import { execSync } from 'child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { CVE_LIST_REPO, CVE_CACHE_DIR } from '@semantic-cve/shared';
import { getDb, closeDb } from '@semantic-cve/db';
import { parseCveFile } from '@semantic-cve/cve-parser';

const PROJECT_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const CACHE_DIR = join(PROJECT_ROOT, CVE_CACHE_DIR);
const REPO_DIR = join(CACHE_DIR, 'cvelistV5');
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const ensure = () => { if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true }); };

const cloneOrPull = () => {
  if (existsSync(REPO_DIR)) { execSync('git pull', { cwd: REPO_DIR, stdio: 'inherit' }); }
  else { execSync(`git clone --depth 1 ${CVE_LIST_REPO} ${REPO_DIR}`, { stdio: 'inherit' }); }
  console.log('Repo ready.');
};

const walkDir = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = join(dir, e.name);
  return e.isDirectory() ? walkDir(p) : e.name.endsWith('.json') && !e.name.startsWith('delta') ? [p] : [];
});

const main = () => {
  ensure();
  cloneOrPull();
  const db = getDb();
  console.log('Loading existing hashes...');
  const knownHashes = new Map<string, string>();
  for (const r of db.prepare('SELECT cve_id, hash FROM hashes').all() as { cve_id: string; hash: string }[]) {
    knownHashes.set(r.cve_id, r.hash);
  }
  console.log(`Known: ${knownHashes.size}`);

  const upsertCveStmt = db.prepare(`INSERT INTO cves (cve_id, description, cwe_id, vendor, product, affected_versions, cvss_score, cvss_severity, published_date, updated_date)
    VALUES (@cveId, @description, @cweId, @vendor, @product, @affectedVersions, @cvssScore, @cvssSeverity, @publishedDate, @updatedDate)
    ON CONFLICT(cve_id) DO UPDATE SET description=excluded.description, cwe_id=excluded.cwe_id, vendor=excluded.vendor, product=excluded.product,
      affected_versions=excluded.affected_versions, cvss_score=excluded.cvss_score, cvss_severity=excluded.cvss_severity,
      published_date=excluded.published_date, updated_date=excluded.updated_date, updated_at=datetime('now')`);
  const upsertHashStmt = db.prepare(`INSERT INTO hashes (cve_id, hash) VALUES (?, ?) ON CONFLICT(cve_id) DO UPDATE SET hash=excluded.hash, updated_at=datetime('now')`);

  const files = walkDir(join(REPO_DIR, 'cves'));
  let imported = 0; let skipped = 0; let errors = 0;
  for (const file of files) {
    const rel = relative(join(REPO_DIR, 'cves'), file);
    const content = readFileSync(file, 'utf-8');
    const hash = sha256(content);
    if (knownHashes.get(rel) === hash) { skipped++; continue; }
    try {
      const parsed = parseCveFile(content);
      const id = parsed.cveId;
      upsertCveStmt.run({
        cveId: id, description: parsed.description, cweId: parsed.cweId ?? null,
        vendor: parsed.vendor ?? null, product: parsed.product ?? null,
        affectedVersions: parsed.affectedVersions ?? null,
        cvssScore: parsed.cvssScore ?? null, cvssSeverity: parsed.cvssSeverity ?? null,
        publishedDate: parsed.publishedDate ?? null, updatedDate: parsed.updatedDate ?? null,
      });
      upsertHashStmt.run(id, hash);
      imported++;
    } catch (e) { errors++; }
    if (imported % 1000 === 0 && imported > 0) process.stderr.write(`\rImported ${imported}, skipped ${skipped}, errors ${errors}   `);
  }
  console.log(`\nDone: ${imported} imported, ${skipped} skipped, ${errors} errors`);
  closeDb();
};

main();
