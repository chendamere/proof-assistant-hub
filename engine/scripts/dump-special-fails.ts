import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
for (const f of fails.filter(
  (x) =>
    x.key.includes('::197::') ||
    x.key.includes('::202::') ||
    x.key.includes('::195::') ||
    (x.key.includes('::124::') && (x.step <= 25 || x.step >= 89))
)) {
  console.log('---', f.key.split('::')[1], 's' + f.step);
  console.log('L', f.left);
  console.log('R', f.right);
}
