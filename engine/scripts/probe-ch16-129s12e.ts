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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 129;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const sid = all.find((r) => r.id === 'subst-identical-id')!;
const fund = all.find((r) => r.id === 'rules-of-three-fundamental-relationships-11-isjidt')!;
const id29 = all.find((r) => r.id === 'theorems-of-identical-node-comparison-29-msnbifi')!;
console.log('sid', sid.leftSide, '=>', sid.rightSide);
console.log('fund', fund.leftSide, '=>', fund.rightSide);

function chk(rule: { leftSide: string; rightSide: string }, a: string, b: string, label: string) {
  console.log(
    label,
    checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
      dagCache: index.dagCache,
    }).match
  );
}

chk(sid, ',i \\Ps j,i \\Od n,', ',i \\Ps j,j \\Od n,', 'bare sid');
chk(fund, ',i \\Ps j,i \\Od n,', ',i \\Ps j,j \\Od n,', 'bare fund');
chk(
  sid,
  ',\\Bb{m \\Pc t}{,i \\Ps j,\\Ot n,}{,i \\Ps j,i \\Od n,},',
  ',\\Bb{m \\Pc t}{,i \\Ps j,\\Ot n,}{,i \\Ps j,j \\Od n,},',
  'in Bb false sid'
);
chk(
  id29,
  ',i \\Ps j,\\Bb{j \\Pu}{,j \\Od n,}{,j \\Ob m,},',
  ',\\Bb{j \\Pu}{,i \\Ps j,j \\Od n,}{,i \\Ps j,j \\Ob m,},',
  'id29 push'
);
chk(
  id29,
  ',\\Bb{j \\Pu}{,i \\Ps j,j \\Od n,}{,i \\Ps j,j \\Ob m,},',
  ',i \\Ps j,\\Bb{j \\Pu}{,j \\Od n,}{,j \\Ob m,},',
  'id29 pull'
);
chk(
  id29,
  ',\\Bb{j \\Pu}{,i \\Ps j,j \\Od n,}{,i \\Ps j,j \\Ob m,},\\Bb{n \\Pu}{,n \\Os,\\Tc c_1,}{,n \\Os,\\Tc c_2,},',
  ',i \\Ps j,\\Bb{j \\Pu}{,j \\Od n,}{,j \\Ob m,},\\Bb{n \\Pu}{,n \\Os,\\Tc c_1,}{,n \\Os,\\Tc c_2,},',
  'id29 pull trailing'
);
