import fs from 'fs';
import {
  matchesDerivedBbTransition,
  matchesPcRightSubstInBb,
} from '../src/inferenceRules/caseFocus';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x: { key: string }) => x.key.includes('::132::'))!;
console.log('pcRight', matchesPcRightSubstInBb(f.left, f.right));
console.log('derived', matchesDerivedBbTransition(ensure(f.left), ensure(f.right)));
