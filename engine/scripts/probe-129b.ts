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
function hop(label: string, a: string, b: string) {
  console.log(label, justify(a, b));
}

const L = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps i_1,i_1 \\On,j_1 \\On,i_1 \\Ps j_1,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
const R = ensure(
  ',i \\Ps j,i \\Oc i_1,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);

// Step A: bubble i1 Ps j1 next to j Ps i1
const a = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps i_1,i_1 \\Ps j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
hop('A bubble', L, a);

// Step B: reverse 73: j Ps i1, i1 Ps j1 ← wait forward 73 replaces i1 Ps j1 with j Ps j1
const b = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps i_1,j \\Ps j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
hop('B 73', a, b);

// Step C: bubble j Ps j1 next to j Oc j1
const c = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps j_1,j \\Ps i_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
hop('C bubble jPsj1', b, c);

// Step D: reverse copy-identical drop j Ps j1
const d = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps i_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
hop('D drop jPsj1', c, d);

// Step E: bubble j Ps i1 next to i Ps j
const e = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Ps i_1,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
hop('E bubble jPsi1', d, e);

// Step F: 73 → i Ps i1
const f = ensure(
  ',i \\Oc i_1,i \\Ps j,i \\Ps i_1,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
hop('F 73', e, f);

// Step G: bubble i Ps i1 next to i Oc i1
const g = ensure(
  ',i \\Oc i_1,i \\Ps i_1,i \\Ps j,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
hop('G bubble', f, g);

// Step H: drop i Ps i1
const h = ensure(
  ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
);
hop('H drop', g, h);

// Step I: reorder to R
hop('I reorder', h, R);
