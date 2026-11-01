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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 132;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const r106 = all.find((r) => r.id === 'rules-of-node-connectivity-106-icjbifj')!;
function chk(a: string, b: string, label: string) {
  console.log(
    label,
    checkInferenceRules(ensure(a), ensure(b), r106.leftSide, r106.rightSide, {
      dagCache: index.dagCache,
    }).match
  );
}

const F = '{,t \\Ob m,j \\Pc i,\\Bb{i \\Pc m}{,\\Ot n,}{,t \\Od n,},m \\Os,}';
const F2 = '{,t \\Ob m,j \\Pc i,\\Bb{j \\Pc m}{,\\Ot n,}{,t \\Od n,},m \\Os,}';

chk(
  `,\\Bb{t \\Pu}{,\\Tc x,}${F},`,
  `,\\Bb{t \\Pu}{,\\Tc x,}${F2},`,
  'Tc true'
);
chk(
  `,\\Bb{t \\Pu}{,i \\Pc j,t \\Od n,}${F},`,
  `,\\Bb{t \\Pu}{,i \\Pc j,t \\Od n,}${F2},`,
  'full true'
);
chk(
  `,\\Bb{t \\Pu}{,i \\Pc j,t \\Od n,}${F},\\Bb{n \\Pu}{,n \\Os,\\Tc c_1,}{,n \\Os,\\Tc c_2,},`,
  `,\\Bb{t \\Pu}{,i \\Pc j,t \\Od n,}${F2},\\Bb{n \\Pu}{,n \\Os,\\Tc c_1,}{,n \\Os,\\Tc c_2,},`,
  'with trailing'
);
chk(
  `,\\Bb{t \\Pu}{,\\Tc x,}${F},\\Bb{n \\Pu}{,n \\Os,\\Tc c_1,}{,n \\Os,\\Tc c_2,},`,
  `,\\Bb{t \\Pu}{,\\Tc x,}${F2},\\Bb{n \\Pu}{,n \\Os,\\Tc c_1,}{,n \\Os,\\Tc c_2,},`,
  'Tc + trailing'
);
chk(
  `,\\Bb{t \\Pu}{,t \\Od n,}${F},`,
  `,\\Bb{t \\Pu}{,t \\Od n,}${F2},`,
  'Od in true only'
);
chk(
  `,\\Bb{t \\Pu}{,i \\Pc j,}${F},`,
  `,\\Bb{t \\Pu}{,i \\Pc j,}${F2},`,
  'Pc in true only'
);

// Derived: direct i Pc j, Bb{m Pc i} → i Pc j, Bb{m Pc j}
chk(
  `,i \\Pc j,\\Bb{m \\Pc i}{,\\Ot n,}{,t \\Od n,},`,
  `,i \\Pc j,\\Bb{m \\Pc j}{,\\Ot n,}{,t \\Od n,},`,
  'direct right-subst bare'
);
