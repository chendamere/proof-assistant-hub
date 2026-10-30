import { theorems } from '../../src/data/theorems';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';

let n = 0;
for (const t of [...axioms, ...definitions, ...theorems]) {
  const s = t.leftSide + t.rightSide;
  if (!/\\Or/.test(s)) continue;
  if (!/\\B/.test(s)) continue;
  console.log(t.id);
  console.log(' L', t.leftSide);
  console.log(' R', t.rightSide);
  console.log();
  if (++n > 50) break;
}
console.log('count', n);
