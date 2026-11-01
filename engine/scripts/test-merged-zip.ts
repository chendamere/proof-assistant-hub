import fs from 'fs';
import {
  matchesMergedCreateBbZip,
  matchesDerivedBbTransition,
} from '../src/inferenceRules/caseFocus';
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
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 20)!;
console.log('L', ensure(f.left));
console.log('R', ensure(f.right));
console.log('merged', matchesMergedCreateBbZip(ensure(f.left), ensure(f.right)));
console.log('derived', matchesDerivedBbTransition(ensure(f.left), ensure(f.right)));
