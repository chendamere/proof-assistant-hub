import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const p = path.join(path.dirname(fileURLToPath(import.meta.url)), 'out/recheck-ch15.jsonl');
const fails = fs
  .readFileSync(p, 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
for (const f of fails) {
  console.log(`THM ${f.key.split('::')[1]} s${f.step}`);
  console.log(`  L ${f.left}`);
  console.log(`  R ${f.right}`);
  console.log('');
}
