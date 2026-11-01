import fs from 'fs';
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(stripDisplayIfConditions(s))).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

let cleared = 0;
for (const f of fails) {
  const d = matchesDerivedBbTransition(ensure(f.left), ensure(f.right));
  const th = String(f.key).split('::')[1];
  if (d) {
    cleared++;
    console.log('CLEARED', th, 'step', f.step, f.part);
  }
}
console.log('cleared', cleared, 'of', fails.length);
