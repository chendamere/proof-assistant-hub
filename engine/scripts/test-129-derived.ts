import fs from 'fs';
import {
  matchesAtomIntoRelBbTrailing,
  matchesDerivedBbTransition,
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
const f10 = fails.find(
  (x: { key: string; step: number }) => x.key.includes('::129::') && x.step === 10
)!;
const L = ensure(f10.left);
const dropPn = L.replace('{,\\Ot n,n \\Pn n,}', '{,\\Ot n,}');
const intoPs = dropPn.replace(
  '{,j \\Ob m,i \\Ps j,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,}',
  '{,j \\Ob m,\\Bb{m \\Pc t}{,i \\Ps j,\\Ot n,}{,i \\Ps j,i \\Od n,},m \\Os,}'
);
console.log('atomInto', matchesAtomIntoRelBbTrailing(dropPn, intoPs));
console.log('derived', matchesDerivedBbTransition(dropPn, intoPs));
console.log('into==R', intoPs === ensure(f10.right));

// s12: pull Ps out of both arms of outer Bb
const f12 = fails.find(
  (x: { key: string; step: number }) => x.key.includes('::129::') && x.step === 12
)!;
console.log('s12 derived', matchesDerivedBbTransition(f12.left, f12.right));
console.log('s12 atom', matchesAtomIntoRelBbTrailing(f12.right, f12.left)); // reverse pull
