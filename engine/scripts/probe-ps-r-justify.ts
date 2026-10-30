import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';

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

const pos = 13 * 100000 + 100;
const rules = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
  .filter((r) => r.pos < pos);
const index = buildRuleIndex(rules, new Map());

function just(a: string, b: string) {
  const hits: string[] = [];
  for (const rule of getRulesForTransition(index, a, b)) {
    if (checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      hits.push(rule.id);
  }
  return hits;
}

const pairs: Array<[string, string, string]> = [
  ['R then Ps swap?', ',R(i_1), i_1 \\Ps i_2,', ',i_1 \\Ps i_2, R(i_1),'],
  ['R2 then Ps', ',R(i_2), i_1 \\Ps i_2,', ',i_1 \\Ps i_2, R(i_2),'],
  ['full s38 direct', ',R(i_1), R(i_2), i_1 \\Ps i_2, R(j_1),', ',i_1 \\Ps i_2, R(i_2), R(i_1), R(j_1),'],
  [
    'dup then',
    ',R(i_1), R(i_2), i_1 \\Ps i_2, i_1 \\Ps i_2, R(j_1),',
    ',i_1 \\Ps i_2, R(i_1), R(i_2), i_1 \\Ps i_2, R(j_1),',
  ],
  [
    'r27 add from before',
    ',i_1 \\Ps i_2, R(i_1), R(i_2), R(j_1),',
    ',i_1 \\Ps i_2, R(i_1), R(i_2), i_1 \\Ps i_2, R(j_1),',
  ],
  [
    'drop leading keep trail',
    ',i_1 \\Ps i_2, R(i_1), R(i_2), i_1 \\Ps i_2, R(j_1),',
    ',R(i_1), R(i_2), i_1 \\Ps i_2, R(j_1),',
  ],
  [
    'drop trail keep lead',
    ',i_1 \\Ps i_2, R(i_1), R(i_2), i_1 \\Ps i_2, R(j_1),',
    ',i_1 \\Ps i_2, R(i_1), R(i_2), R(j_1),',
  ],
  ['r24', ',R(i_1), R(i_2),', ',R(i_2), R(i_1),'],
  [
    'identical70 drop',
    ',i_1 \\Ps i_2, i_1 \\Ps i_2, R(i_1),',
    ',i_1 \\Ps i_2, R(i_1),',
  ],
  [
    'identical70 add',
    ',i_1 \\Ps i_2, R(i_1),',
    ',i_1 \\Ps i_2, i_1 \\Ps i_2, R(i_1),',
  ],
  // 202 flip-72
  [
    'cond flip',
    ',j_2 \\Ps j_1, \\Blb{i_1 \\Ps j_2}{,i_1 \\Os,}{,i_1 \\Os,},',
    ',j_2 \\Ps j_1, \\Blb{j_2 \\Ps i_1}{,i_1 \\Os,}{,i_1 \\Os,},',
  ],
  [
    '72 after flip',
    ',j_2 \\Ps j_1, \\Blb{j_2 \\Ps i_1}{,i_1 \\Os,}{,i_1 \\Os,},',
    ',j_2 \\Ps j_1, \\Blb{j_1 \\Ps i_1}{,i_1 \\Os,}{,i_1 \\Os,},',
  ],
  [
    '72 direct right operand',
    ',j_2 \\Ps j_1, \\Blb{i_1 \\Ps j_2}{,i_1 \\Os,}{,i_1 \\Os,},',
    ',j_2 \\Ps j_1, \\Blb{i_1 \\Ps j_1}{,i_1 \\Os,}{,i_1 \\Os,},',
  ],
  // 124 s181
  [
    'identical arms factor',
    ',\\Bb{i \\Pu}{,j \\Oc j_1,}{,j \\Oc j_1,},',
    ',j \\Oc j_1,',
  ],
  [
    'empty branch pull',
    ',\\Bb{i \\Pu}{,j \\Oc j_1,}{,j \\Oc j_1,}, i \\On,',
    ',j \\Oc j_1, i \\On,',
  ],
];

for (const [label, a, b] of pairs) {
  console.log(label, '→', just(a, b).slice(0, 3).join(', ') || 'NONE');
}
