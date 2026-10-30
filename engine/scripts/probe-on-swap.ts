import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
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
  let t = normalizeSpacing(
    fromOperatorFirst(s)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
  ).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

const bb =
  '\\Bb{i_2 \\Ps m_2}{,j_1 \\Os,j_2 \\Os,m_2 \\Os,i_2 \\Os,\\Tc c_1,}{,j_1 \\Os,j_2 \\Os,m_2 \\Os,i_2 \\Os,\\Tc c_2,},';
const prefix = ',i \\Oc i_1,R(i_1),j \\Oc j_1,R(j_1),j \\Oc j_2,';
const goal = ensure(`${prefix}R(j_2),i \\Oc i_2,R(i_2),i_1 \\Ps j_1,i_1 \\Os,m \\Oc m_2,R(m_2),${bb}`);
const mids = [
  ensure(`${prefix}i_1 \\Ps j_1,i \\Oc i_2,R(i_2),R(j_2),i_1 \\Os,m \\Oc m_2,R(m_2),${bb}`),
  ensure(`${prefix}i_1 \\Ps j_1,i \\Oc i_2,R(j_2),R(i_2),i_1 \\Os,m \\Oc m_2,R(m_2),${bb}`),
  ensure(`${prefix}i_1 \\Ps j_1,R(j_2),i \\Oc i_2,R(i_2),i_1 \\Os,m \\Oc m_2,R(m_2),${bb}`),
  ensure(`${prefix}R(j_2),i_1 \\Ps j_1,i \\Oc i_2,R(i_2),i_1 \\Os,m \\Oc m_2,R(m_2),${bb}`),
  ensure(`${prefix}R(j_2),i \\Oc i_2,i_1 \\Ps j_1,R(i_2),i_1 \\Os,m \\Oc m_2,R(m_2),${bb}`),
  ensure(`${prefix}R(j_2),i \\Oc i_2,R(i_2),i_1 \\Ps j_1,i_1 \\Os,m \\Oc m_2,R(m_2),${bb}`),
  goal,
];

const pos = 13 * 100000 + 108;
const rules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
  .filter((r) => r.pos < pos);
const index = buildRuleIndex(rules, new Map());
function justify(a: string, b: string) {
  for (const rule of getRulesForTransition(index, a, b)) {
    if (checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

let cur = mids[0]!;
for (let i = 1; i < mids.length; i++) {
  const next = mids[i]!;
  console.log(`hop ${i - 1}`, justify(cur, next));
  cur = next;
}
console.log('eq goal', cur === goal);
