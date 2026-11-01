import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const CO = [
  'Rules_of_Operators',
  'Rules of Three Fundamental Relationships',
  'Theorems_of_Relationship_of_Node_Value_Comparison',
  'Theorems_of_Node_Null_Comparison',
  'Theorems_of_Identical_Node_Comparison',
  'Rules_of_Empty_Branch_Function',
  'Swap_Theorems_of_Same_Operand',
  'Theorems_of_Operators_and_Relationships',
  'Next_Order_Induction',
  'Recursive_Function_R',
  'Previous_Order_Induction',
  'Recursive_Function_R_Prev',
  'Rules_of_Node_Ring',
  'Rules_of_Node_Connectivity',
  'Rules_of_Node_Continuity',
  'Rules_of_Relationship_of_Subnode',
];
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function posOf(id: string): number {
  const e = earlyRulePosition(id, CO);
  if (e != null) return e;
  if (axioms.some((r) => r.id === id) || definitions.some((r) => r.id === id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const f = CO.find((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  return f ? CO.indexOf(f) * 100000 + parseInt(m[2]!, 10) + 1 : 999999999;
}
const all = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 143;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  const hits: string[] = [];
  for (const rule of getRulesForTransition(index, A, B)) {
    const r = checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache });
    if (r.match) hits.push(rule.id);
  }
  return hits;
}

const L =
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\Ob t,i \\nPu,\\Bb{i \\Pu}{,}{,i \\Ob t_0,t_0 \\nPc t,t_0 \\Os,},},';
const R =
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\Ob t,i \\nPu,i \\Ob t_0,t_0 \\nPc t,t_0 \\Os,},';

console.log('full', j(L, R));

const n55 = all.find((r) => r.id === 'theorems-of-node-null-comparison-55-inubifi')!;
console.log(
  'n55 explicit',
  checkInferenceRules(ensure(L), ensure(R), n55.leftSide, n55.rightSide, { dagCache: index.dagCache })
);

// reorder false arm so nPu adjacent before inner Bb
const mid =
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\Ob t,i \\nPu,\\Bb{i \\Pu}{,}{,i \\Ob t_0,t_0 \\nPc t,t_0 \\Os,},},';
// already is. Try if-form condition
const midIf =
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\Ob t,i \\nPu,\\Bb{if(i \\Pu)}{,}{,i \\Ob t_0,t_0 \\nPc t,t_0 \\Os,},},';
console.log('L->if', j(L, midIf));
console.log('if->R', j(midIf, R));

// empty true as {,} vs {}
const midEmpty =
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\Ob t,i \\nPu,\\Bb{i \\Pu}{}{,i \\Ob t_0,t_0 \\nPc t,t_0 \\Os,},},';
console.log('L->midEmpty', j(L, midEmpty));

// Try focus via caseFocus on whole? 
// Intermediate: lift inner to top via dissolving outer? too hard.

// Check null-4
const n4 = all.find((r) => r.id.includes('null-comparison-4-sifiu'))!;
console.log('n4', n4?.leftSide, '=>', n4?.rightSide);
console.log(
  'n4 on full',
  checkInferenceRules(ensure(L), ensure(R), n4.leftSide, n4.rightSide, { dagCache: index.dagCache })
);
