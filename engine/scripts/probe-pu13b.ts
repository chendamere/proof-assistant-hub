import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { checkInferenceRules } from '../src/inferenceRules';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { normalizeSpacing } from '../src/inferenceRules/utils';

function toBook(expr: string): string {
  return normalizeSpacing(
    fromOperatorFirst(expr)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
  );
}
function dist(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

const start = toBook(
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,i \\Ps i_1,i_1 \\Ps i_2,R(i_2),i_1 \\Op,R\\_(i_1),R(j_1),i_1 \\Ps j_1,'
);
const goal = toBook(
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,i \\Ps i_1,i_1 \\Ps i_2,R(i_2),i_1 \\Op,R\\_(i_1),i_1 \\Ps i_2,R(j_1),i_1 \\Ps j_1,'
);
const dup = theorems.find((r) => r.id === 'theorems-of-identical-node-comparison-70-isjisj')!;
const afterDup = toBook(
  oneStepRewrites(start, dup.leftSide, dup.rightSide).find((r) =>
    toBook(r).includes('i_1 \\Ps i_2,i_1 \\Ps i_2,R(i_2)')
  )!
);
console.log('afterDup', afterDup);
console.log('d', dist(afterDup, goal), 'from', dist(start, goal));

const rules = [...axioms, ...definitions, ...theorems];
let cur = afterDup;
const seen = new Set([start, cur]);
for (let step = 0; step < 12 && cur !== goal; step++) {
  let best: { id: string; expr: string; d: number } | null = null;
  for (const rule of rules) {
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(cur, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const raw of rewrites) {
      const expr = toBook(raw);
      if (seen.has(expr)) continue;
      const d = dist(expr, goal);
      if (expr !== goal && d > dist(cur, goal) + 5) continue;
      if (!checkInferenceRules(cur, expr, rule.leftSide, rule.rightSide).match) continue;
      if (!best || d < best.d || expr === goal) best = { id: rule.id, expr, d };
      if (expr === goal) break;
    }
    if (best?.expr === goal) break;
  }
  if (!best) {
    console.log('stuck', step, cur);
    break;
  }
  console.log('hop', step, best.id, 'd', best.d);
  console.log(' ', best.expr);
  seen.add(best.expr);
  cur = best.expr;
}
console.log('done', cur === goal);

// Also try reverse create-next-prev from pu-18-like
const cnp = axioms.find((r) => r.id === 'create-next-prev')!;
const sample = toBook(
  ',i \\Ps i_1,i_1 \\Pu,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_1 \\On,i_1 \\Op,R\\_(i_1),i_2 \\Ps j_1,'
);
const rw = oneStepRewrites(sample, cnp.leftSide, cnp.rightSide).map(toBook);
const rwRev = oneStepRewrites(sample, cnp.rightSide, cnp.leftSide).map(toBook);
console.log('cnp forward neighbors', rw.length, rw.slice(0, 3));
console.log('cnp reverse neighbors', rwRev.length, rwRev.slice(0, 5));
