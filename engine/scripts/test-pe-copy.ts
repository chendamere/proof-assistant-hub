import fs from 'fs';
import {
  matchesDerivedBbTransition,
  matchesPeCopyIntoPuFalseArm,
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
const f = fails.find(
  (x: { left: string; right: string }) =>
    x.left.includes('s_1 \\Pn s_1') &&
    x.left.includes('s_2 \\Pn s_2') &&
    x.right.includes('s_1 \\Pe s_2')
)!;
const L = ensure(f.left);
const R = ensure(f.right);
const drop1 = L.replace('{,\\Ot s_1,s_1 \\Pn s_1,}', '{,\\Ot s_1,}');
const drop2 = drop1.replace('{,\\Ot s_2,s_2 \\Pn s_2,}', '{,\\Ot s_2,}');
const peMid = drop2.replace(
  'i \\Od s_1,i \\Od s_2,',
  'i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,'
);
const peFalse = peMid.replace(
  't_2 \\Os,s_2 \\Os,}',
  't_2 \\Os,s_1 \\Pe s_2,s_2 \\Os,}'
);
console.log('peFalse==R', peFalse === R);
console.log('copy', matchesPeCopyIntoPuFalseArm(peMid, peFalse));
console.log('derived', matchesDerivedBbTransition(peMid, peFalse));
console.log('peMid', peMid.slice(0, 160));
console.log('peFalse', peFalse.slice(0, 160));
