import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { matchesCaseFocusOrMerge } from '../src/inferenceRules/caseFocus';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-one.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
for (const f of fails) {
  console.log('s' + f.step, matchesCaseFocusOrMerge(f.left, f.right));
}
