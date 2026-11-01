import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';

const all = [...axioms, ...definitions, ...theorems];
function nPc(s: string) {
  return (s.match(/\\Pc/g) || []).length;
}
const hits: { id: string; L: string; R: string }[] = [];
for (const r of all) {
  if (nPc(r.leftSide) > nPc(r.rightSide) && r.leftSide.length < 160) {
    hits.push({ id: r.id, L: r.leftSide, R: r.rightSide });
  }
}
console.log('count', hits.length);
for (const h of hits) {
  console.log(h.id);
  console.log(' L', h.L);
  console.log(' R', h.R);
}
