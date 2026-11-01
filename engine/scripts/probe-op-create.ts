import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
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
const axiomIds = new Set(axioms.map((r) => r.id));
const definitionIds = new Set(definitions.map((r) => r.id));
function posOf(id: string): number {
  const early = earlyRulePosition(id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axiomIds.has(id) || definitionIds.has(id)) return -1;
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
const pos = CHAPTER_ORDER.indexOf('Rules_of_Node_Continuity') * 100000 + 9;
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
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);

// Insert j1 On,j1 Op (no prior j1 On)
const a = ensure(
  ',i \\Oc i_1,i_1 \\On,j \\Oc j_1,j_1 \\On,j_1 \\Op,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
console.log('L→a create j1', justify(L, a));

// Insert i1 On,i1 Op as well
const b = ensure(
  ',i \\Oc i_1,i_1 \\On,i_1 \\On,i_1 \\Op,j \\Oc j_1,j_1 \\On,j_1 \\Op,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
console.log('a→b create i1', justify(a, b));

// Push both Ops via op-14: need i1 Op, j1 Op adjacent before Blb
const c = ensure(
  ',i \\Oc i_1,i_1 \\On,i_1 \\On,j \\Oc j_1,j_1 \\On,i_1 \\Op,j_1 \\Op,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,},'
);
console.log('b→c bubble Ops', justify(b, c));

const d = ensure(
  ',i \\Oc i_1,i_1 \\On,i_1 \\On,j \\Oc j_1,j_1 \\On,\\Blb{i_1 \\Ps j_1}{,i_1 \\Op,j_1 \\Op,i_1 \\Os,j_1 \\Os,}{,i_1 \\Op,j_1 \\Op,i_1 \\Os,j_1 \\Os,},'
);
console.log('c→d dual push', justify(c, d));
console.log(
  'direct c→d check',
  checkInferenceRules(
    c,
    d,
    ',i \\Op , j \\Op, \\Blb{if(i \\Ps j)}{,}{,},',
    ',\\Blb{if(i \\Ps j)}{,i \\Op , j \\Op,}{,i \\Op , j \\Op,},'
  ).match
);

// Search rules that drop duplicate On or On+Op leaving Op
const cands = allRules.filter(
  (r) =>
    r.pos < pos &&
    /\\On/.test(r.leftSide) &&
    /\\On/.test(r.rightSide) &&
    r.leftSide.split('\\On').length !== r.rightSide.split('\\On').length
);
console.log(
  'On-count-change rules',
  cands.slice(0, 20).map((r) => [r.id, r.leftSide, r.rightSide])
);

// Try oneStep create-next-prev from L and see all results
const cnp = allRules.find((r) => r.id === 'create-next-prev')!;
const rws = oneStepRewrites(L, cnp.leftSide, cnp.rightSide);
console.log('create-next-prev rewrites count', rws.length);
for (const e of rws.slice(0, 20)) {
  const E = ensure(e);
  if (checkInferenceRules(L, E, cnp.leftSide, cnp.rightSide, { dagCache: index.dagCache }).match) {
    console.log(' ', E);
  }
}
