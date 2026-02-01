/**
 * Quick test for DAG-based substitution
 */
import { exprToDAGPattern, exprToDAGTarget, vf2ExprSubgraphIsomorphism } from '../src/lib/dag/index.js';

const rule = ', i \\Oc m, m \\Os,';
const target = ', 1 \\Oc 2, 2 \\Os,';

console.log('Rule:', rule);
console.log('Target:', target);

const patternDAG = exprToDAGPattern(rule);
const targetDAG = exprToDAGTarget(target);

console.log('\nPattern DAG:', JSON.stringify(patternDAG, null, 2));
console.log('\nTarget DAG:', JSON.stringify(targetDAG, null, 2));

const result = vf2ExprSubgraphIsomorphism(patternDAG, targetDAG);
console.log('\nVF2 Result:', result);

if (result) {
  console.log('Match! Operand mapping:', Object.fromEntries(result.operandMapping));
} else {
  console.log('No match');
}
