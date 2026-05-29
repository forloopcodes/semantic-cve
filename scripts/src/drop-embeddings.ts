import { getDb, closeDb } from '@semantic-cve/db';
getDb();
const d = getDb();
d.exec('DELETE FROM embeddings');
console.log('Embeddings cleared');
d.prepare('VACUUM').run();
console.log('Vacuum done');
closeDb();
