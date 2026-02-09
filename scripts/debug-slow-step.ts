/**
 * Debug why a proof step is slow.
 */

import { exprToDAG, countOperations } from '../src/lib/dag';
import { normalizeSpacing } from '../src/lib/inferenceRules/utils';
import { buildRuleIndex, getRulesForTransition } from '../src/lib/inferenceRules/ruleIndex';
import { checkInferenceRules } from '../src/lib/inferenceRules';
import { axioms } from '../src/data/axioms';
import { definitions } from '../src/data/definitions';
import { theorems } from '../src/data/theorems';

const targetLeft = ',j \\Od t_2, i \\Od t_1, \\Blb{if(t_1 \\Pe t_2)}{,t_1 \\Os, t_2 \\Os,}{,t_1 \\Os, t_2 \\Os,},';
const targetRight = ',j \\Od t_2, i \\Od t_1, \\Blb{if(t_2 \\Pe t_1)}{,t_1 \\Os, t_2 \\Os,}{,t_1 \\Os, t_2 \\Os,},';

const leftDAG = exprToDAG(normalizeSpacing(targetLeft));
const rightDAG = exprToDAG(normalizeSpacing(targetRight));
const opLeft = countOperations(leftDAG);
const opRight = countOperations(rightDAG);
const delta = opRight - opLeft;

console.log('Transition: swap t_1/t_2 in Blb condition (t_1 \\Pe t_2 <-> t_2 \\Pe t_1)');
console.log('Op count left:', opLeft);
console.log('Op count right:', opRight);
console.log('Transition delta:', delta);

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
}));
const index = buildRuleIndex(allRules);
const rulesToTry = getRulesForTransition(index, targetLeft, targetRight);
console.log('\nRules to try (filtered):', rulesToTry.length);
console.log('Total rules:', allRules.length);

const deltaZeroCount = (index.byDelta.get(0) ?? []).length;
console.log('Rules with delta=0:', deltaZeroCount);

console.log('\nAfter operator-signature filter + sort by size:');
console.log('Rules to try:', rulesToTry.length);

// Time the actual verification (with DAG cache)
const t0 = performance.now();
let tried = 0;
for (const rule of rulesToTry) {
  tried++;
  const r = checkInferenceRules(
    targetLeft,
    targetRight,
    rule.leftSide,
    rule.rightSide,
    { dagCache: index.dagCache }
  );
  if (r.match) {
    console.log('\nMatched at rule', tried);
    break;
  }
}
const ms = performance.now() - t0;
console.log('Rules tried:', tried);
console.log('Time (ms):', ms.toFixed(1));
console.log('Per rule (ms):', (ms / tried).toFixed(3));

// Extrapolate: if rule was at end
const perRule = tried > 0 ? ms / tried : 0;
console.log('\nExtrapolated if no match (all 1915 rules):', (perRule * 1915).toFixed(0), 'ms');
