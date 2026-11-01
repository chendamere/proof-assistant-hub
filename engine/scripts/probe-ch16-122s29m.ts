import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
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
function j(a: string, b: string) {
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return rule.id;
  }
  // exact common
  for (const id of [
    'rules-of-node-connectivity-31-menbifi',
    'theorems-of-relationship-of-node-value-comparison-23-iejmb',
    'theorems-of-relationship-of-node-value-comparison-24-iejms',
  ]) {
    const rule = all.find((r) => r.id === id)!;
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return id;
  }
  return null;
}
const rule = all.find((r) => r.id === 'rules-of-node-connectivity-31-menbifi')!;
function chk(a: string, b: string, label: string) {
  console.log(
    label,
    checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
      dagCache: index.dagCache,
    }).match,
    'j',
    j(a, b)
  );
}

const trueArm = '{,s_1 \\Pe s_2,\\Tc x,}';
// Move t1 Os before Pe+Bb
const base =
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,},`;
const osBeforeBb =
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,t_1 \\Os,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},i \\Ob t_2,},`;
console.log('move Os before Pe+Bb', j(base, osBeforeBb));

const osBeforePe =
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,s_1 \\Pe s_2,t_1 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},i \\Ob t_2,},`;
console.log('Os between Pe and Bb', j(base, osBeforePe));

// Into when Os is NOT immediately after Bb (moved after Ob2)
const osAfterOb2 =
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},i \\Ob t_2,t_1 \\Os,},`;
const intoOsAfter =
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},i \\Ob t_2,t_1 \\Os,},`;
console.log('base->osAfterOb2', j(base, osAfterOb2));
chk(osAfterOb2, intoOsAfter, 'into with Os after Ob2');

// Into when nothing after Bb (detach tail)
const noTail = `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},},`;
const intoNoTail = `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},},`;
chk(noTail, intoNoTail, 'into no tail');

// Is t1 Os specifically the problem vs other Os?
chk(
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},s_2 \\Os,},`,
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},s_2 \\Os,},`,
  's2 Os after'
);
chk(
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_2 \\Os,},`,
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_2 \\Os,},`,
  't2 Os after'
);
chk(
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},\\Tc z,},`,
  `,\\Bb{i \\Pu}${trueArm}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},\\Tc z,},`,
  'Tc after'
);

// Derived: Pe past Bb+Os as unit — search value-comparison Pe past release
for (const r of all) {
  if (r.pos >= pos) continue;
  if (!/\\Pe/.test(r.leftSide) || !/\\Os/.test(r.rightSide + r.leftSide)) continue;
  if (r.leftSide.length > 80) continue;
  console.log('PeOs', r.id, r.leftSide, '=>', r.rightSide);
}
