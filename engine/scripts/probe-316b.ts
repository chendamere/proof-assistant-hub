import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';

const CHAPTER_ORDER = [
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
];
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function posOf(id: string): number {
  const early = earlyRulePosition(id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axioms.some((r) => r.id === id) || definitions.some((r) => r.id === id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + parseInt(m[2]!, 10) + 1;
}
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = CHAPTER_ORDER.indexOf('Rules_of_Node_Continuity') * 100000 + 316;
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  new Map()
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const L = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
const R = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
const s1 = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i_2 \\Ps i,i \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
const s2 = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i_2 \\Ps i,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
// Drop first i2 Ps i by bubbling to second then identical-70
const t1 = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
const t2 = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i_1,i_2 \\Ps i,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
const t3 = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
const t4 = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
console.log('s2→t1', justify(s2, t1));
console.log('t1→t2', justify(t1, t2));
console.log('t2→t3 bubble', justify(t2, t3));
console.log('t3→t4 drop70', justify(t3, t4));
console.log('t4==R', t4 === R);

// From s2: swap i2 Ps i past i Ps i1 and i2 Ps i1 to meet later copy
console.log('L→R direct', justify(L, R));
console.log('s1→R', justify(s1, R));

const trans = allRules.find((r) => r.id === 'thm-Ps-transitive');
console.log('transitive', trans?.leftSide, trans?.rightSide);
const id73 = allRules.find((r) => r.id.includes('identical-node-comparison-73'));
console.log('id73', id73?.leftSide, id73?.rightSide);
