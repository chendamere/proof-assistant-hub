import { theorems } from '../../src/data/theorems';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';

const all = [...axioms, ...definitions, ...theorems];
function countPs(s: string) {
  return (s.match(/\\Ps/g) || []).length;
}
const drops: string[] = [];
for (const r of all) {
  const lp = countPs(r.leftSide);
  const rp = countPs(r.rightSide);
  if (lp > rp && r.leftSide.includes('\\Ps') && r.leftSide.length < 100) {
    drops.push(`${r.id}\n  ${r.leftSide}\n  => ${r.rightSide}`);
  }
}
console.log(drops.join('\n\n'));
console.log('\ntotal', drops.length);
