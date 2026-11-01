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
const rule = all.find((r) => r.id === 'rules-of-node-connectivity-31-menbifi')!;
function chk(a: string, b: string, label: string) {
  console.log(
    label,
    checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
      dagCache: index.dagCache,
    }).match
  );
}

const trueArm = '{,s_1 \\Pe s_2,\\Tc x,}';
const cases: [string, string, string][] = [
  [
    'bare',
    '{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},}',
    '{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},}',
  ],
  [
    '+t1Os',
    '{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,}',
    '{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_1 \\Os,}',
  ],
  [
    '+Ob2',
    '{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,}',
    '{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,}',
  ],
  [
    '+Bb2',
    '{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},}',
    '{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},}',
  ],
  [
    '+all',
    '{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,}',
    '{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,}',
  ],
];
for (const [label, fL, fR] of cases) {
  chk(`,\\Bb{i \\Pu}${trueArm}${fL},`, `,\\Bb{i \\Pu}${trueArm}${fR},`, label);
}

// Second Bb has Ot s2 / Od s2 — conflict with Pe s1 Pe s2 vars?
chk(
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},},`,
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_1 \\Os,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},},`,
  'Bb2 no Ob2'
);

// Bb2 empty
chk(
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,\\Bb{t_2 \\Pc j}{,}{,},},`,
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_1 \\Os,\\Bb{t_2 \\Pc j}{,}{,},},`,
  'Bb2 empty'
);

// Only second Pc Bb without Pe target - maybe matcher picks wrong Bb?
chk(
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Tc y,}{,\\Tc z,},},`,
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Tc y,}{,\\Tc z,},},`,
  'Bb2 Tc only'
);
