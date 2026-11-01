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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 150;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const L = ',i \\Oc i_0,i \\Oc i_1,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,';
const midPs = ',i \\Oc i_0,i \\Ps i_0,i \\Oc i_1,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,';
const midPsOnly = ',i \\Oc i_0,i \\Ps i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,';
const R = ',i \\Oc i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,';
const midPs2 = ',i \\Oc i_0,i \\Oc i_1,i \\Ps i_0,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,';
const midPs2drop = ',i \\Oc i_0,i \\Oc i_1,i \\Ps i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,';

console.log('L -> midPs', j(L, midPs));
console.log('midPs -> midPsOnly (drop Pc)', j(midPs, midPsOnly));
console.log('midPsOnly -> R (drop Ps)', j(midPsOnly, R));
console.log('L -> midPs2', j(L, midPs2));
console.log('midPs2 -> midPs2drop', j(midPs2, midPs2drop));
console.log('midPs2drop -> R', j(midPs2drop, R));

// reverse of value from identical: what rules introduce Pc from Ps?
const intro = all.filter(
  (r) =>
    r.pos < pos &&
    /\\Ps/.test(r.leftSide) &&
    /\\Pc/.test(r.rightSide) &&
    !( /\\Pc/.test(r.leftSide)) &&
    r.leftSide.length < 100
);
console.log('\nPs->Pc intros', intro.length);
for (const r of intro.slice(0, 30)) {
  console.log(r.id, '\n L', r.leftSide, '\n R', r.rightSide);
}

// And Pc with Ps on both sides where Pc count drops
const drops = all.filter(
  (r) =>
    r.pos < pos &&
    /\\Ps/.test(r.leftSide) &&
    /\\Pc/.test(r.leftSide) &&
    !/\\Pc/.test(r.rightSide) &&
    r.leftSide.length < 120
);
console.log('\nPs+Pc -> no Pc', drops.length);
for (const r of drops.slice(0, 30)) {
  console.log(r.id, '\n L', r.leftSide, '\n R', r.rightSide);
}
