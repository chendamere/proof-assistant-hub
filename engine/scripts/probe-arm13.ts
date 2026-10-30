import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

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
];
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
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).replace(/R_\(/g, 'R\\_(').trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = 13 * 100000 + 13;
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  new Map()
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const L =
  ',j \\Oc j_1,i \\Oc i_1,R(j_1),R(i_1),\\Blb{j_1 \\Ps i_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},';
const both = ensure(
  ',j \\Oc j_1,i \\Oc i_1,R(j_1),R(i_1),\\Blb{j_1 \\Ps i_1}{,j_1 \\Os,i_1 \\Os,}{,j_1 \\Os,i_1 \\Os,},'
);
const trueOnly = ensure(
  ',j \\Oc j_1,i \\Oc i_1,R(j_1),R(i_1),\\Blb{j_1 \\Ps i_1}{,j_1 \\Os,i_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
const falseOnly = ensure(
  ',j \\Oc j_1,i \\Oc i_1,R(j_1),R(i_1),\\Blb{j_1 \\Ps i_1}{,i_1 \\Os,j_1 \\Os,}{,j_1 \\Os,i_1 \\Os,},'
);
console.log('L', ensure(L));
console.log('both', justify(L, both));
console.log('true', justify(L, trueOnly));
console.log('false', justify(L, falseOnly));
console.log('true then false', justify(trueOnly, both));

// Look for swap-release rules
for (const r of allRules) {
  if (r.pos >= pos) continue;
  if (/swap.*release|release.*swap|swap-id-branch|swap-release-branch/i.test(r.id)) {
    if (/\\Os/.test(r.leftSide) && /\\Os/.test(r.rightSide)) {
      console.log(r.id, '|', r.leftSide, '⟺', r.rightSide);
    }
  }
}
