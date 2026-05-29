import { getDb, closeDb } from '@semantic-cve/db';
import { parseCveFile, syntheticDoc } from '@semantic-cve/cve-parser';
import { embedBatch } from '@semantic-cve/embeddings';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const REPO = join(fileURLToPath(import.meta.url), '..', '..', '..', 'cve-cache', 'cvelistV5');
const cvePath = (id: string) => {
  const p = id.split('-');
  return join(REPO, 'cves', p[1], Math.floor(parseInt(p[2], 10) / 1000) + 'xxx', id + '.json');
};

getDb();
const d = getDb();
const all = d.prepare('SELECT cve_id FROM cves LIMIT 3200').all() as { cve_id: string }[];

const configs = [
  { conc: 1, batchSize: 100, label: '1x100' },
  { conc: 1, batchSize: 200, label: '1x200' },
  { conc: 1, batchSize: 500, label: '1x500' },
  { conc: 4, batchSize: 100, label: '4x100' },
  { conc: 8, batchSize: 100, label: '8x100' },
  { conc: 4, batchSize: 200, label: '4x200' },
];

for (const cfg of configs) {
  const total = cfg.conc * cfg.batchSize;
  const sw = all.slice(0, total);
  const docs: string[][] = [];
  for (let i = 0; i < cfg.conc; i++) {
    const chunk = sw.slice(i * cfg.batchSize, (i + 1) * cfg.batchSize);
    const ds: string[] = [];
    for (const r of chunk) ds.push(syntheticDoc(parseCveFile(readFileSync(cvePath(r.cve_id), 'utf-8'))));
    docs.push(ds);
  }
  const t0 = Date.now();
  await Promise.all(docs.map(d => embedBatch(d)));
  const elapsed = (Date.now() - t0) / 1000;
  console.log(`${cfg.label}: ${total} docs in ${elapsed.toFixed(1)}s = ${(total/elapsed).toFixed(1)}/s`);
}

closeDb();
