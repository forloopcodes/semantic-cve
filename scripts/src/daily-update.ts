import { execSync } from 'child_process';
import { join } from 'path';
import { fileURLToPath } from 'url';

const PROJECT_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const run = (cmd: string) => execSync(cmd, { stdio: 'inherit', cwd: PROJECT_ROOT });

const main = () => {
  console.log('Starting daily CVE update...');
  run('bun run --filter @semantic-cve/scripts sync');
  run('bun run --filter @semantic-cve/scripts embed');
  console.log('Daily update complete.');
};

main();
