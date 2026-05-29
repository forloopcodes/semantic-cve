import { getDb, closeDb } from '@semantic-cve/db';
const main = () => {
  getDb(); const d = getDb();
  const bad = d.prepare("SELECT COUNT(*) as c FROM cves WHERE instr(cve_id, '\\') > 0 OR instr(cve_id, '/') > 0").get() as { c: number };
  if (!bad.c) { console.log('No rows to migrate'); return closeDb(); }
  console.log(`Migrating ${bad.c} rows...`);
  d.exec("UPDATE cves SET cve_id = substr(cve_id, instr(replace(cve_id, '\\', '/'), 'CVE-')) WHERE instr(cve_id, '\\') > 0 OR instr(cve_id, '/') > 0");
  d.exec("UPDATE hashes SET cve_id = substr(cve_id, instr(replace(cve_id, '\\', '/'), 'CVE-')) WHERE instr(cve_id, '\\') > 0 OR instr(cve_id, '/') > 0");
  const c = d.prepare('SELECT COUNT(*) as c FROM cves').get() as { c: number };
  const e = d.prepare('SELECT COUNT(*) as c FROM embeddings WHERE vector IS NOT NULL').get() as { c: number };
  const h = d.prepare('SELECT COUNT(*) as c FROM hashes').get() as { c: number };
  console.log(`Done: CVEs=${c} Embeddings=${e} Hashes=${h}`);
  closeDb();
};
main();
