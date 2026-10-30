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
  let t = normalizeSpacing(
    fromOperatorFirst(s)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
  ).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

const L = ensure(
  ',i \\Pu,j \\Pu,i \\Oc i_1,j \\Oc j_1,j \\Ps j_1,\\Blb{i \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
const m1 = ensure(
  ',i \\Pu,j \\Pu,i \\Oc i_1,j \\Oc j_1,j \\Ps j_1,\\Blb{j_1 \\Ps i}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
const m2 = ensure(
  ',i \\Pu,j \\Pu,i \\Oc i_1,j \\Oc j_1,j \\Ps j_1,\\Blb{j \\Ps i}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
const R = ensure(
  ',i \\Pu,j \\Pu,i \\Oc i_1,j \\Oc j_1,j \\Ps j_1,\\Blb{i \\Ps j}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);

const pos = 13 * 100000 + 197;
const rules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
  .filter((r) => r.pos < pos);
const index = buildRuleIndex(rules, new Map());
function justify(a: string, b: string) {
  for (const rule of getRulesForTransition(index, a, b)) {
    if (checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  // also try identical-72 directly
  const t72 = theorems.find((t) => t.id.includes('identical-node-comparison-72'))!;
  if (checkInferenceRules(a, b, t72.leftSide, t72.rightSide, { dagCache: index.dagCache }).match)
    return t72.id + '(direct)';
  return null;
}

console.log('L→m1 flip', justify(L, m1));
console.log('m1→m2 subst', justify(m1, m2));
console.log('m2→R flip', justify(m2, R));
console.log('L→R', justify(L, R));
