import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex } from '../src/inferenceRules/ruleIndex';
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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);

const A = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
const B = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
const rule = all.find((r) => r.id === 'rules-of-node-connectivity-31-menbifi')!;
console.log('rule', rule.leftSide, '=>', rule.rightSide);
const r = checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache });
console.log('nested', r.match, r.matchPosition?.description?.slice(0, 120));

// with if()
const A2 = A.replace('\\Bb{t_1 \\Pc j}', '\\Bb{if(t_1 \\Pc j)}');
const B2 = B.replace('\\Bb{t_1 \\Pc j}', '\\Bb{if(t_1 \\Pc j)}');
console.log(
  'with if',
  checkInferenceRules(A2, B2, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match
);

// Minimal nested in outer Bb false arm
const A3 = ensure(
  ',\\Bb{i \\Pu}{,\\Tc x,}{,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},},'
);
const B3 = ensure(
  ',\\Bb{i \\Pu}{,\\Tc x,}{,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},},'
);
console.log(
  'outer Bb false',
  checkInferenceRules(A3, B3, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match
);

// After Ob
const A4 = ensure(',i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},');
const B4 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},'
);
console.log(
  'after Ob',
  checkInferenceRules(A4, B4, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match
);

// Jump Pe past entire Bb+Os without entering
const jump = ensure(
  A.replace(
    'i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
    'i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,s_1 \\Pe s_2,'
  )
);
console.log('A len', A.length, 'jump len', jump.length);
// brute force rules for A->jump
let found = 0;
for (const rule2 of all.filter((x) => x.pos < pos)) {
  if (
    checkInferenceRules(A, jump, rule2.leftSide, rule2.rightSide, { dagCache: index.dagCache })
      .match
  ) {
    console.log('jump via', rule2.id);
    found++;
    if (found > 5) break;
  }
}
console.log('jump found', found);

// Pe past Bb as: connectivity with empty? or swap theorems
for (const rule2 of all.filter(
  (x) => x.pos < pos && /\\Pe/.test(x.leftSide) && /\\Bb/.test(x.leftSide + x.rightSide) && x.leftSide.length < 90
)) {
  if (
    checkInferenceRules(A, jump, rule2.leftSide, rule2.rightSide, { dagCache: index.dagCache })
      .match
  ) {
    console.log('jump PeBb', rule2.id);
  }
  if (
    checkInferenceRules(A, B, rule2.leftSide, rule2.rightSide, { dagCache: index.dagCache }).match
  ) {
    console.log('into PeBb', rule2.id);
  }
}
