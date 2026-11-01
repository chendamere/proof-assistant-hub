import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';

const all = [...axioms, ...definitions, ...theorems];
let n = 0;
for (const r of all) {
  const L = r.leftSide;
  const R = r.rightSide;
  if (!/\\Pe/.test(L + R) || !/\\Bb/.test(L + R)) continue;
  if (L.length > 160 || R.length > 200) continue;
  const peL = (L.match(/\\Pe/g) || []).length;
  const peR = (R.match(/\\Pe/g) || []).length;
  // Pe moves into/out of Bb arms
  if (peL === 1 && peR >= 2) {
    console.log(r.id);
    console.log(' L', L);
    console.log(' R', R);
    if (++n >= 40) break;
  }
}
console.log('shown', n);

// Also: m Pe n, Bb -> Bb with Pe both
n = 0;
console.log('--- Pe then Bb ---');
for (const r of all) {
  if (!/,.*\\Pe.*,\s*\\Bb/.test(r.leftSide) && !/\\Bb.*,.*\\Pe/.test(r.leftSide)) continue;
  if (!/\\Pe/.test(r.rightSide)) continue;
  if (r.leftSide.length > 140) continue;
  console.log(r.id);
  console.log(' L', r.leftSide);
  console.log(' R', r.rightSide);
  if (++n >= 25) break;
}
console.log('shown2', n);
