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

const start = toBook(
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,i_1 \\Op,R\\_(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),'
);
const goal = toBook(
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Ps i_1,i \\Oc i_2,i_1 \\Op,R\\_(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),'
);

const dup = theorems.find((r) => r.id === 'theorems-of-identical-node-comparison-70-isjisj')!;
let cur = start;
const afterDup = toBook(oneStepRewrites(cur, dup.leftSide, dup.rightSide)[0]!);
console.log('afterDup', afterDup);
console.log('dup ok', checkInferenceRules(cur, afterDup, dup.leftSide, dup.rightSide).match);

const rules = [...axioms, ...definitions, ...theorems];
cur = afterDup;
const seen = new Set([start, cur]);
for (let step = 0; step < 8 && cur !== goal; step++) {
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
      const d =
        [...expr].reduce((n, c, i) => n + (c !== goal[i] ? 1 : 0), Math.abs(expr.length - goal.length));
      const curD = [...cur].reduce((n, c, i) => n + (c !== goal[i] ? 1 : 0), Math.abs(cur.length - goal.length));
      if (expr !== goal && d > curD) continue;
      if (!checkInferenceRules(cur, expr, rule.leftSide, rule.rightSide).match) continue;
      if (!best || d < best.d) best = { id: rule.id, expr, d };
      if (expr === goal) {
        best = { id: rule.id, expr, d: 0 };
        break;
      }
    }
    if (best?.d === 0) break;
  }
  if (!best) {
    console.log('stuck at', step, cur);
    break;
  }
  console.log('hop', step, best.id, 'd', best.d);
  console.log(' ', best.expr.slice(0, 140));
  seen.add(best.expr);
  cur = best.expr;
}
console.log('done', cur === goal);
