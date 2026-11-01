import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
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
const pos = CHAPTER_ORDER.indexOf('Rules_of_Node_Continuity') * 100000 + 129;
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
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps i_1,i_1 \\On,j_1 \\On,i_1 \\Ps j_1,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
const R = ensure(
  ',i \\Ps j,i \\Oc i_1,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);

// Path from ch14 bridge cleanup:
// j Ps i1, i1 Ps j1 → via 73: j Ps i1, j Ps j1? or i1 Ps j1 kept
// Actually want to drop both. 
// reverse copy-identical on j Oc j1, j Ps j1 - need j Ps j1 first
// 73: j Ps i1, i1 Ps j1 → j Ps i1, j Ps j1 (i=j, j=i1, m=j1)
const a = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps i_1,j \\Ps j_1,i_1 \\On,j_1 \\On,i_1 \\Ps j_1,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
console.log('73 add j Ps j1', justify(
  ensure(',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps i_1,i_1 \\On,j_1 \\On,i_1 \\Ps j_1,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},').replace(
    'j \\Ps i_1,i_1 \\On,j_1 \\On,i_1 \\Ps j_1',
    'j \\Ps i_1,i_1 \\Ps j_1,i_1 \\On,j_1 \\On,i_1 \\Ps j_1'
  ) === 'x' ? L : L,
  a
));

// adjacent 73: need j Ps i1 next to i1 Ps j1
const L2 = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps i_1,i_1 \\Ps j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
console.log('bubble i1 Ps j1 left', justify(L, L2));

const L3 = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps i_1,j \\Ps j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
// From L2 apply 73: j Ps i1, i1 Ps j1 → j Ps i1, j Ps j1 (drops i1 Ps j1? No 73 keeps first and replaces second with i Ps m)
// 73: i Ps j, j Ps m → i Ps j, i Ps m  so j Ps i1, i1 Ps j1 → j Ps i1, j Ps j1 (replaces i1 Ps j1 with j Ps j1)
console.log('73', justify(L2, L3));

// drop j Ps j1 via reverse copy next to j Oc j1
const L4 = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps j_1,j \\Ps i_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
console.log('bubble j Ps j1 to Oc', justify(L3, L4));
const L5 = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps i_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
console.log('drop j Ps j1', justify(L4, L5));

// still have j Ps i1. Flip to i1 Ps j, then?
const L6 = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,i_1 \\Ps j,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
console.log('flip j Ps i1', justify(L5, L6));

// Drop i1 Ps j via identical-70 if i Ps j present? They're different.
// reverse copy on i Oc i1, i Ps i1 - wrong names.

// Maybe: 73 reverse with i Ps j: i Ps j, j Ps i1 → wait
// Have i Ps j and j Ps i1. 73: i Ps j, j Ps i1 → i Ps j, i Ps i1
const L7 = ensure(
  ',i \\Oc i_1,i \\Ps j,i \\Ps i_1,j \\Oc j_1,j \\Ps i_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
console.log('from L5: need adjacent i Ps j, j Ps i1');
const L5b = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Ps i_1,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
console.log('L5→L5b', justify(L5, L5b));
const L5c = ensure(
  ',i \\Oc i_1,i \\Ps j,i \\Ps i_1,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
console.log('73→i Ps i1', justify(L5b, L5c));
// drop i Ps i1 via reverse copy next to i Oc i1
const L5d = ensure(
  ',i \\Oc i_1,i \\Ps i_1,i \\Ps j,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
console.log('bubble i Ps i1', justify(L5c, L5d));
const L5e = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
console.log('drop i Ps i1', justify(L5d, L5e));
console.log('L5e→R', justify(L5e, R));

// Full chain from L: first get to L5 style (drop i1 Ps j1 via 73 path), then drop j Ps i1 via 73 with i Ps j
console.log('\n--- full ---');
console.log('L→L2', justify(L, L2));
console.log('L2→L3', justify(L2, L3));
console.log('L3→L4', justify(L3, L4));
console.log('L4→L5', justify(L4, L5));
