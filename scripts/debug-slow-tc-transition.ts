/**
 * Debug why the Tc-heavy transition is slow or appears to hang.
 */

import { exprToDAG, countOperations } from '../src/lib/dag';
import { normalizeSpacing } from '../src/lib/inferenceRules/utils';
import { buildRuleIndex, getRulesForTransition } from '../src/lib/inferenceRules/ruleIndex';
import { checkInferenceRules } from '../src/lib/inferenceRules';
import { axioms } from '../src/data/axioms';
import { definitions } from '../src/data/definitions';
import { theorems } from '../src/data/theorems';

const targetLeft = `,i \\Od t_1, j \\Od t_2, m \\Od t_3, n \\Od t_4, \\Bb{if(t_1 \\Pe t_2)}{, \\Bb{if(t_3 \\Pe t_4)}{,t_1 \\Os, t_2 \\Os,t_3 \\Os, t_4 \\Os,\\Tc c_1,}{,t_1 \\Os, t_2 \\Os,t_3 \\Os, t_4 \\Os,\\Tc c_2,},}{, \\Bb{if(t_3 \\Pe t_4)}{,t_1 \\Os, t_2 \\Os,t_3 \\Os, t_4 \\Os,\\Tc c_3,}{,t_1 \\Os, t_2 \\Os,t_3 \\Os, t_4 \\Os,\\Tc c_4,},},`;
const targetRight = `,i \\Od t_1, j \\Od t_2, m \\Od t_3, n \\Od t_4, \\Bb{if(t_3 \\Pe t_4)}{, \\Bb{if(t_1 \\Pe t_2)}{,t_1 \\Os, t_2 \\Os,t_3 \\Os, t_4 \\Os,\\Tc c_1,}{,t_1 \\Os, t_2 \\Os,t_3 \\Os, t_4 \\Os,\\Tc c_3,},}{, \\Bb{if(t_1 \\Pe t_2)}{,t_1 \\Os, t_2 \\Os,t_3 \\Os, t_4 \\Os,\\Tc c_2,}{,t_1 \\Os, t_2 \\Os,t_3 \\Os, t_4 \\Os,\\Tc c_4,},},`;

const leftDAG = exprToDAG(normalizeSpacing(targetLeft));
const rightDAG = exprToDAG(normalizeSpacing(targetRight));

console.log('Left nodes:', leftDAG.nodes.length);
console.log('Right nodes:', rightDAG.nodes.length);
console.log('Delta:', countOperations(rightDAG) - countOperations(leftDAG));

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
}));
const index = buildRuleIndex(allRules);
const rulesToTry = getRulesForTransition(index, targetLeft, targetRight);

console.log('Rules to try:', rulesToTry.length);
console.log('Tc rules count:', index.tcRules.length);

// No cap; root-candidate filter + canExtend pruning (complete search)
const nodeCount = leftDAG.nodes.length;
const maxTrials = nodeCount > 24 ? 4 : nodeCount > 20 ? 8 : nodeCount > 12 ? 32 : 64;
console.log('\nOptimizations: root-candidate filter, canExtend pruning, no maxRootAttempts cap');
console.log('maxTrials per rule (directions):', maxTrials);

// Time first 20 rules only to see per-rule cost
const t0 = performance.now();
let tried = 0;
for (const rule of rulesToTry.slice(0, 20)) {
  tried++;
  const r = checkInferenceRules(targetLeft, targetRight, rule.leftSide, rule.rightSide, { dagCache: index.dagCache });
  if (r.match) {
    console.log('\nMatched at rule', tried);
    break;
  }
}
const ms = performance.now() - t0;
console.log('\nFirst 20 rules:', ms.toFixed(0), 'ms,', (ms / tried).toFixed(0), 'ms/rule');
console.log('Extrapolated full 710 rules:', ((ms / tried) * 710).toFixed(0), 'ms');
