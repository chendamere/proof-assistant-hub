import { theorems } from '../../src/data/theorems';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
const all = [...axioms, ...definitions, ...theorems];
for (const r of all) {
  const s = r.leftSide + r.rightSide;
  if (!/\\Ob/.test(s)) continue;
  if (!/\\B(lb|b|rb)/.test(s) && !/swap/.test(r.id)) continue;
  if (/\\Ob/.test(r.leftSide) && /\\B(lb|b)/.test(s)) {
    console.log(r.id);
    console.log(' ', r.leftSide.slice(0, 70));
    console.log(' ', r.rightSide.slice(0, 70));
  }
}
