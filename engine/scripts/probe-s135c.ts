import fs from 'fs';
import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';

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
];
function posOf(id: string) {
  const e = earlyRulePosition(id, CO);
  if (e != null) return e;
  if (axioms.some((r) => r.id === id) || definitions.some((r) => r.id === id)) return -1;
  const m = id.match(/^(.+)-(\d+)-/);
  if (!m) return 9e8;
  const f = CO.find((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  return f == null ? 9e8 : CO.indexOf(f) * 1e5 + parseInt(m[2]!, 10) + 1;
}
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).replace(/R_\(/g, 'R\\_(').trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
const index = buildRuleIndex(
  [...axioms, ...definitions, ...theorems]
    .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
    .filter((r) => r.pos < 13 * 1e5 + 124),
  new Map()
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv') || rule.id.includes('error')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const f = JSON.parse(
  fs
    .readFileSync('engine/scripts/out/recheck-one.jsonl', 'utf8')
    .trim()
    .split(/\n/)
    .find((l) => JSON.parse(l).step === 135)!
);
const L = ensure(f.left);
const R = ensure(f.right);

const R2 = ensure(R.replace('{,R(i_1),i_1 \\Os,i \\On,', '{,i_1 \\Os,R(i_1),i \\On,'));
console.log('R→R2', justify(R, R2));

const pulled = ensure(
  R2.replace(
    '\\Bb{i \\Pu}{,i_1 \\Os,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i_1 \\Os,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}',
    'i_1 \\Os,\\Bb{i \\Pu}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}'
  )
);
console.log('pulled→R2', justify(pulled, R2));

const mid1 = ensure(
  L.replace(
    '\\Bb{i \\Pu}{,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i \\Ps i_1,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}',
    'i \\Ps i_1,\\Bb{i \\Pu}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}'
  )
);
const mid2 = ensure(mid1.replace(',i \\Oc i_1,j \\Oc j_1,i \\Ps i_1,', ',i \\Oc i_1,i \\Ps i_1,j \\Oc j_1,'));
console.log('L chain', justify(L, mid1), justify(mid1, mid2));
console.log('mid2→pulled', justify(mid2, pulled));
console.log('pulled', pulled.slice(0, 150));
console.log('mid2  ', mid2.slice(0, 150));

// Difference: mid2 has ...,Bb,i2 Os,i1 Os,j1 Os  vs pulled ...,i1 Os,Bb,i2 Os,j1 Os
// Try bubble i1 Os by first swapping to i1 Os,i2 Os then... still after Bb
const mid3 = ensure(mid2.replace(',i_2 \\Os,i_1 \\Os,j_1 \\Os,', ',i_1 \\Os,i_2 \\Os,j_1 \\Os,'));
console.log('mid2→mid3', justify(mid2, mid3));

// From mid2: bubble Ps right next to Bb then push Ps back? undo?
// From mid2 push Ps into arms leaving Os: that would be L-like with Os outside and Ps inside - that's L after reordering Ocs
const back = ensure(
  mid2.replace(
    ',i \\Ps i_1,j \\Oc j_1,\\Bb{i \\Pu}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}',
    ',j \\Oc j_1,\\Bb{i \\Pu}{,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i \\Ps i_1,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}'
  )
);
console.log('mid2→back', justify(mid2, back));
console.log('back→L?', justify(back, L), ensure(back) === L);
