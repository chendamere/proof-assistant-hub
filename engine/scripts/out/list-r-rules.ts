import { theorems } from '../../../src/data/theorems';
for (const t of theorems) {
  if (/recursive-function-r-(22|24|27|10)-/.test(t.id) || /thm-R-/.test(t.id)) {
    console.log(t.id);
    console.log(' L', t.leftSide);
    console.log(' R', t.rightSide);
    console.log('---');
  }
}
