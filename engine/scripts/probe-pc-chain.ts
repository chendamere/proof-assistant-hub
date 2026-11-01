import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
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
const pos = CHAPTER_ORDER.indexOf('Rules_of_Node_Continuity') * 100000 + 304;
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

const L = ensure(',i \\Oc i_1,i_1 \\On,i_1 \\Ps j,i \\Pc i_1,i_1 \\Os,');
const R = ensure(',i \\Oc i_1,i_1 \\On,i_1 \\Ps j,i \\Pc j,i_1 \\Os,');
const a = ensure(',i \\Oc i_1,i_1 \\On,i_1 \\Ps j,i_1 \\Pc i,i_1 \\Os,');
const b = ensure(',i \\Oc i_1,i_1 \\On,i_1 \\Ps j,j \\Pc i,i_1 \\Os,');
const c = ensure(',i \\Oc i_1,i_1 \\On,i_1 \\Ps j,i \\Pc j,i_1 \\Os,');
console.log('flip', justify(L, a));
console.log('rev110', justify(a, b));
console.log('flip2', justify(b, c));
console.log('c==R', c === R);

// also test 316 bubble+73
const j316pos = CHAPTER_ORDER.indexOf('Rules_of_Node_Continuity') * 100000 + 316;
const index316 = buildRuleIndex(
  allRules.filter((r) => r.pos < j316pos),
  new Map()
);
function j316(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index316, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index316.dagCache }).match)
      return rule.id;
  }
  return null;
}
const L316 = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
const R316 = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
const s1 = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i_2 \\Ps i,i \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
const s2 = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i_2 \\Ps i,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
const s3 = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
console.log('316 swap', j316(L316, s1));
console.log('316 73', j316(s1, s2));
console.log('316 drop/reorder', j316(s2, s3));
console.log('s3==R', s3 === R316);
// drop via identical-70 the first i2 Ps i after 73, then swap back i Ps i1
const s2b = ensure(
  ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
);
console.log('316 from s2 drop+swap to R', j316(s2, s2b));
