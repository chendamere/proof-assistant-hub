/**
 * Diagnose why Branch arm swap4 is not matching
 */
import { exprToDAG, dagToExpr, vf2ExprSubgraphIsomorphismAll, substituteInDAG } from '../src/lib/dag';
import { normalizeSpacing } from '../src/lib/inferenceRules/utils';

const ex = {
  targetLeft: ', \\Bb{a \\Oe b}{, \\Bb{a \\Oe b}{,c \\Od e, e \\Oc f,}{,},}{,},',
  targetRight: ', \\Bb{a \\Oe b}{, \\Bb{a \\Oe b}{,c \\Od e, f \\Oc e,}{,},}{,},',
  ruleLeft: ', \\Brb{,c \\Od e, e \\Oc f,}{,},',
  ruleRight: ', \\Brb{,c \\Od e, f \\Oc e,}{,},',
};

const norm = (s: string) => normalizeSpacing(s);

const patternDAG = exprToDAG(norm(ex.ruleLeft));
const targetDAG = exprToDAG(norm(ex.targetLeft));
const replacementDAG = exprToDAG(norm(ex.ruleRight));

console.log('=== Pattern DAG (rule left) ===');
console.log('Nodes:', patternDAG.nodes.map((n) => ({ id: n.id, op: (n.data as any).op, operands: (n.data as any).operands })));
console.log('Edges:', patternDAG.edges);
console.log('Roots:', patternDAG.nodes.filter((n) => !patternDAG.edges.some((e) => e.to === n.id)).map((n) => n.id));

console.log('\n=== Target DAG ===');
console.log('Nodes:', targetDAG.nodes.map((n) => ({ id: n.id, op: (n.data as any).op, operands: (n.data as any).operands })));
console.log('Edges:', targetDAG.edges);

console.log('\n=== Replacement DAG (rule right) ===');
console.log('Nodes:', replacementDAG.nodes.map((n) => ({ id: n.id, op: (n.data as any).op, operands: (n.data as any).operands })));
console.log('Edges:', replacementDAG.edges);

console.log('\n=== VF2 All Matches ===');
let matchCount = 0;
for (const result of vf2ExprSubgraphIsomorphismAll(patternDAG, targetDAG)) {
  matchCount++;
  console.log(`\nMatch ${matchCount}:`);
  console.log('  mapping:', [...result.mapping.entries()]);
  console.log('  operandMapping:', [...result.operandMapping.entries()]);
  // Try substitution
  try {
    const merged = substituteInDAG(targetDAG, patternDAG, replacementDAG, result.mapping, result.operandMapping);
    console.log('  Merged nodes:', merged.nodes.map((n) => ({ id: n.id, op: (n.data as any).op, operands: (n.data as any).operands })));
    console.log('  Merged edges:', merged.edges);
    const out = dagToExpr(merged);
    console.log('  substituted:', JSON.stringify(out));
    console.log('  expected:  ', JSON.stringify(norm(ex.targetRight)));
    console.log('  match:', norm(out) === norm(ex.targetRight));
  } catch (err) {
    console.log('  substituteInDAG error:', err);
  }
}
console.log('\nTotal matches:', matchCount);
