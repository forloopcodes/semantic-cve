import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { getDb, closeDb, upsertEmbedding } from '@semantic-cve/db';
import { parseCveFile, syntheticDoc } from '@semantic-cve/cve-parser';
import { embedBatch } from '@semantic-cve/embeddings';
import { arrToVec } from '@semantic-cve/vector-store';

const PROJECT_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const REPO = join(PROJECT_ROOT, 'cve-cache', 'cvelistV5');
const BATCH = 500;
const MAX_RUNTIME = 550_000;

const cvePath = (id: string) => {
  const p = id.split('-');
  return join(REPO, 'cves', p[1], Math.floor(parseInt(p[2], 10) / 1000) + 'xxx', id + '.json');
};

const main = async () => {
  console.log('Warming up model...');
  await embedBatch(['warmup']);
  console.log('Warmup done.');

  const totalStart = Date.now();

  while (true) {
    const t0 = Date.now();
    getDb();
    const d = getDb();
    const rows = d.prepare('SELECT cve_id FROM cves WHERE cve_id NOT IN (SELECT cve_id FROM embeddings WHERE vector IS NOT NULL)').all() as { cve_id: string }[];
    const total = rows.length;
    if (!total) { console.log(`All done (${Date.now() - totalStart}ms)`); closeDb(); return; }
    console.log(`Embedding ${total} CVEs (batch=${BATCH})...`);

    let done = 0;

    for (let i = 0; i < total; i += BATCH) {
      if (Date.now() - t0 > MAX_RUNTIME) { console.log('Runtime limit, resuming next run...'); closeDb(); break; }
      const batch = rows.slice(i, i + BATCH);
      try {
        const docs: string[] = [];
        const ids: string[] = [];
        for (const r of batch) {
          const raw = readFileSync(cvePath(r.cve_id), 'utf-8');
          const parsed = parseCveFile(raw);
          ids.push(parsed.cveId);
          docs.push(syntheticDoc(parsed));
        }
        const vecs = await embedBatch(docs);
        getDb().transaction(() => {
          for (let j = 0; j < vecs.length; j++)
            upsertEmbedding(ids[j], arrToVec(vecs[j]));
        })();
        done += vecs.length;
        console.log(`Embedded ${done}/${total} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
      } catch (e) {
        console.error(`Batch fail at ${i}: ${e}`);
        for (const r of batch) {
          try {
            const raw = readFileSync(cvePath(r.cve_id), 'utf-8');
            const parsed = parseCveFile(raw);
            const vecs = await embedBatch([syntheticDoc(parsed)]);
            getDb().transaction(() => upsertEmbedding(parsed.cveId, arrToVec(vecs[0])))();
            done += 1;
            console.log(`Embedded ${done}/${total} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
          } catch (e2) { console.error(`Fail ${r.cve_id}: ${e2}`); }
        }
      }
    }
  }
};

main().catch(console.error);
