import fs from 'fs';
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
console.log('dropPn', dropPn);
console.log('intoPs', intoPs);
const kind = '\\Bb';
const bbIdx = dropPn.indexOf(kind + '{m \\Pc t}');
console.log('bbIdx', bbIdx);
const before = dropPn.slice(0, bbIdx);
console.log('before tail', JSON.stringify(before.slice(-40)));
const m = before.match(
  /,([A-Za-z][A-Za-z0-9_]* \\(?:Ps|nPs|Pe|nPe|Pc|nPc|Pn|nPn|Pu|nPu|Pb|nPb) [A-Za-z][A-Za-z0-9_]*),\s*$/
);
console.log('match', m);

// Manual rebuild
const atom = 'i \\Ps j';
const cond = 'm \\Pc t';
const tArm = ',\\Ot n,';
const fArm = ',i \\Od n,';
const wrap = (arm: string) => {
  let body = arm.trim();
  if (body.startsWith(',')) body = body.slice(1);
  if (body.endsWith(',')) body = body.slice(0, -1);
  body = body.trim();
  return body ? `{,${atom},${body},}` : `{,${atom},}`;
};
const end = dropPn.indexOf('},m \\Os,}', bbIdx) + 1; // end after false arm } — fragile
console.log('slice around Bb', dropPn.slice(bbIdx, bbIdx + 80));
