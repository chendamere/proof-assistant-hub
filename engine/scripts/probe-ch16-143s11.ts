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
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4']);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  const hits: string[] = [];
  for (const rule of getRulesForTransition(index, A, B)) {
    if (BLOCK.has(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      hits.push(rule.id);
  }
  return hits;
}

// Standalone fragment in false arm
const fragL = ',i \\Ob t_0,t \\Ps t_0,\\Or,t_0 \\Os,';
const fragR = ',\\Or,';
const mids = [
  ',i \\Ob t_0,t_0 \\Os,t \\Ps t_0,\\Or,',
  ',i \\Ob t_0,t \\Ps t_0,t_0 \\Os,\\Or,',
  ',t \\Ps t_0,i \\Ob t_0,\\Or,t_0 \\Os,',
  ',i \\Ob t_0,\\Or,t \\Ps t_0,t_0 \\Os,',
  ',i \\Ob t_0,\\Or,t_0 \\Os,t \\Ps t_0,',
  ',\\Or,i \\Ob t_0,t \\Ps t_0,t_0 \\Os,',
];
console.log('direct frag', j(fragL, fragR));
for (const m of mids) {
  const a = j(fragL, m);
  const b = j(m, fragR);
  if (a.length || b.length) console.log('via', m.slice(0, 50), a[0] ?? '-', '->', b[0] ?? '-');
}

// Full expressions
const L =
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\nPu,i \\Ob t,i \\Ob t_0,t \\Ps t_0,\\Or,t_0 \\Os,},';
const R = ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\nPu,i \\Ob t,\\Or,},';
console.log('full direct', j(L, R));

const fullMids = [
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\nPu,i \\Ob t,i \\Ob t_0,t_0 \\Os,t \\Ps t_0,\\Or,},',
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\nPu,i \\Ob t,i \\Ob t_0,t \\Ps t_0,t_0 \\Os,\\Or,},',
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\nPu,i \\Ob t,\\Or,t \\Ps t_0,},',
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\nPu,i \\Ob t,t \\Ps t_0,\\Or,},',
];
for (const m of fullMids) {
  const a = j(L, m);
  const b = j(m, R);
  if (a.length || b.length) console.log('FULL via', m.slice(40, 90), a[0] ?? '-', '->', b[0] ?? '-');
}

// create-subnode + Ps absorb?
console.log('create-subnode', all.find((r) => r.id === 'create-subnode')?.leftSide, '=>', all.find((r) => r.id === 'create-subnode')?.rightSide);
console.log('Ob Os adjacent drop', j(',i \\Ob t_0,t_0 \\Os,', ','));
console.log('with Or', j(',i \\Ob t_0,t_0 \\Os,\\Or,', ',\\Or,'));
console.log('Ps Or', j(',t \\Ps t_0,\\Or,', ',\\Or,'));
