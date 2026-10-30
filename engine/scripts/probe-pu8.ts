import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { normalizeSpacing } from '../src/inferenceRules/utils';

function toBook(expr: string): string {
  return normalizeSpacing(
    fromOperatorFirst(expr)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
  );
}

const from = toBook(
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,i_1 \\Op,R\\_(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),'
);
const goal = toBook(
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Ps i_1,i \\Oc i_2,i_1 \\Op,R\\_(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),'
);

const rules = [...axioms, ...definitions, ...theorems].filter((r) =>
  /copy|identical|Ps|On|Oc|duplicate/i.test(r.id + r.leftSide)
);

console.log('from', from);
console.log('goal', goal);
let hits = 0;
for (const rule of rules) {
  let rewrites: string[];
  try {
    rewrites = oneStepRewrites(from, rule.leftSide, rule.rightSide);
  } catch {
    continue;
  }
  for (const raw of rewrites) {
    const expr = toBook(raw);
    if (expr === from) continue;
    // Prefer anything that introduces a second i Ps i_1 near Oc
    const addedPs = (expr.match(/i \\Ps i_1/g) || []).length > (from.match(/i \\Ps i_1/g) || []).length;
    if (addedPs || expr === goal || dist(expr, goal) < dist(from, goal)) {
      console.log(rule.id, 'd', dist(expr, goal), expr.slice(0, 140));
      hits++;
      if (hits > 25) break;
    }
  }
  if (hits > 25) break;
}
console.log('hits', hits);

function dist(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}
