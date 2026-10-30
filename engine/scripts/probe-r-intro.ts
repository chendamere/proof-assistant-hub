import { theorems } from '../../src/data/theorems';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';

const all = [...axioms, ...definitions, ...theorems];
let n = 0;
for (const t of all) {
  const lc = (t.leftSide.match(/R\(/g) || []).length;
  const rc = (t.rightSide.match(/R\(/g) || []).length;
  if (lc === rc) continue;
  console.log(t.id, 'Rcount', lc, '→', rc);
  console.log(' L', t.leftSide.slice(0, 140));
  console.log(' R', t.rightSide.slice(0, 140));
  console.log();
  if (++n > 40) break;
}
console.log('shown', n);
