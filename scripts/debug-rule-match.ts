/**
 * Debug why a rule fails for Target 1 but succeeds for Target 2.
 */

import { exprToDAG, countOperations } from '../src/lib/dag';
import { normalizeSpacing } from '../src/lib/inferenceRules/utils';
import { buildRuleIndex, getRulesForTransition } from '../src/lib/inferenceRules/ruleIndex';
import { checkInferenceRules } from '../src/lib/inferenceRules';
import { SingleRootDAGInjection } from '../src/lib/dag/vf2Expr';

const ruleLeft = ',j \\Od t_2, i \\Od t_1, \\Blb{if(t_2 \\Pe t_1)}{, t_2 \\Os,t_1 \\Os,}{, t_2 \\Os,t_1 \\Os,},';
const ruleRight = ',\\Blb{if(j \\Ps i)}{,}{,},';

const target1Left = ',j \\Od t_2, i \\Od t_1, \\Blb{if(t_2 \\Pe t_1)}{, t_2 \\Os,t_1 \\Os,}{, t_2 \\Os,t_1 \\Os,},';
const target1Right = ',\\Blb{if(j \\Ps i)}{,}{,},';

const target2Left = ',\\Ot m, \\Blb{if(i \\Ps j)}{,}{,},';
const target2Right = ',\\Ot m, i \\Od t_1, j \\Od t_2, \\Blb{if(t_1 \\Pe t_2)}{,t_1 \\Os, t_2 \\Os,}{,t_1 \\Os, t_2 \\Os,},';

const rule = { id: 'test', leftSide: ruleLeft, rightSide: ruleRight };
const index = buildRuleIndex([rule]);

const rL = exprToDAG(normalizeSpacing(ruleLeft));
const rR = exprToDAG(normalizeSpacing(ruleRight));
const t1L = exprToDAG(normalizeSpacing(target1Left));
const t1R = exprToDAG(normalizeSpacing(target1Right));
const t2L = exprToDAG(normalizeSpacing(target2Left));
const t2R = exprToDAG(normalizeSpacing(target2Right));

console.log('Rule left nodes:', rL.nodes.length);
console.log('Rule right nodes:', rR.nodes.length);
console.log('Rule delta:', countOperations(rR) - countOperations(rL));
console.log('Target1 left nodes:', t1L.nodes.length);
console.log('Target1 right nodes:', t1R.nodes.length);
console.log('Target1 delta:', countOperations(t1R) - countOperations(t1L));
console.log('Target2 left nodes:', t2L.nodes.length);
console.log('Target2 right nodes:', t2R.nodes.length);
console.log('Target2 delta:', countOperations(t2R) - countOperations(t2L));

const rulesT1 = getRulesForTransition(index, target1Left, target1Right);
const rulesT2 = getRulesForTransition(index, target2Left, target2Right);
console.log('\nRules for T1 (filtered):', rulesT1.length, '(need rule for dir 1: delta -6)');
console.log('Rules for T2 (filtered):', rulesT2.length, '(need rule for dir 2/3: delta -6 when transition +6)');

const r1 = checkInferenceRules(target1Left, target1Right, ruleLeft, ruleRight);
const r2 = checkInferenceRules(target2Left, target2Right, ruleLeft, ruleRight);
console.log('\nT1 match (checkInferenceRules):', r1.match);
console.log('T2 match (checkInferenceRules):', r2.match);

// Direct SingleRootDAGInjection: can we find ruleLeft in target1Left?
let matchCount = 0;
for (const m of SingleRootDAGInjection(rL, t1L)) {
  matchCount++;
  console.log('\nT1: SingleRootDAGInjection(ruleLeft, target1Left) match:', Object.fromEntries(m.mapping));
}
console.log('T1: SingleRootDAGInjection match count:', matchCount);
