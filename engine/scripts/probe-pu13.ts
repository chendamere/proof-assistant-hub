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

const from = toBook(
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,i \\Ps i_1,i_1 \\Ps i_2,R(i_2),i_1 \\Op,R\\_(i_1),R(j_1),i_1 \\Ps j_1,'
);
const goal = toBook(
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,i \\Ps i_1,i_1 \\Ps i_2,R(i_2),i_1 \\Op,R\\_(i_1),i_1 \\Ps i_2,R(j_1),i_1 \\Ps j_1,'
);

// Duplicate i_1 Ps i_2 then bubble
const dup = theorems.find((r) => r.id === 'theorems-of-identical-node-comparison-70-isjisj')!;
const dups = oneStepRewrites(from, dup.leftSide, dup.rightSide).map(toBook);
console.log('dup count', dups.length);
for (const d of dups) {
  if (d.includes('i_1 \\Ps i_2')) console.log('dup', d);
}

// Try R_(i_1) related insert of Ps
const rules = [...axioms, ...definitions, ...theorems].filter((r) =>
  /Ps|identical|R_|recursive|copy/i.test(r.id + r.leftSide)
);
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
    if (!expr.includes('i_1 \\Ps i_2,R(j_1)') && !expr.includes('R\\_(i_1),i_1 \\Ps i_2')) continue;
    const ok = checkInferenceRules(from, expr, rule.leftSide, rule.rightSide).match;
    console.log(rule.id, ok, expr.slice(0, 150));
    hits++;
  }
}
console.log('hits', hits);

// Manual: duplicate then swap Ps past R(j_1) backward — actually want Ps BETWEEN R_ and R(j_1)
const after = toBook(
  ',i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,i \\Ps i_1,i_1 \\Ps i_2,i_1 \\Ps i_2,R(i_2),i_1 \\Op,R\\_(i_1),R(j_1),i_1 \\Ps j_1,'
);
console.log('manual mid justify from', checkInferenceRules(from, after, dup.leftSide, dup.rightSide).match);
