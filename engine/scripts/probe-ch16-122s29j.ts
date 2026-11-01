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
  const r = checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
    dagCache: index.dagCache,
  });
  console.log(label, r.match);
}

// Pe already in true arm of outer
chk(
  ',\\Bb{i \\Pu}{,s_1 \\Pe s_2,\\Tc x,}{,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},},',
  ',\\Bb{i \\Pu}{,s_1 \\Pe s_2,\\Tc x,}{,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},},',
  'Pe in true+false'
);

// with Ob
chk(
  ',\\Bb{i \\Pu}{,s_1 \\Pe s_2,\\Tc x,}{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},},',
  ',\\Bb{i \\Pu}{,s_1 \\Pe s_2,\\Tc x,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},},',
  'Pe+Ob in false'
);

// Full false arm rest
chk(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},',
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},',
  'full no trailing Bb'
);

// Trailing Bb s1 Pu
chk(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},',
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},',
  'full with trailing'
);

// Alternative path: do null-17 BEFORE reordering true arm Pe (Pe at front of BOTH arms), then bubble only in false while true Pe stays at front, then reorder true at end
const drop2base =
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},';
const nullFront = ensure(
  drop2base
    .replace(
      '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
      '{,s_1 \\Pe s_2,i \\Od s_1,i \\Od s_2,s_2 \\Os,}'
    )
    .replace(
      '{,i \\Ob t_1,\\Bb{t_1 \\Pc j}',
      '{,s_1 \\Pe s_2,i \\Ob t_1,\\Bb{t_1 \\Pc j}'
    )
);
// From nullFront: bubble false Pe only (true Pe stays at front)
const afterOb = nullFront.replace(
  '{,s_1 \\Pe s_2,i \\Ob t_1,\\Bb{t_1 \\Pc j}',
  '{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}'
);
chk(
  nullFront.replace(
    // only check into from afterOb-like without true reorder
    '{,s_1 \\Pe s_2,i \\Od s_1,',
    '{,s_1 \\Pe s_2,i \\Od s_1,'
  ),
  afterOb,
  'nullFront->afterOb via?'
);
console.log(
  'nullFront->afterOb',
  checkInferenceRules(
    nullFront,
    ensure(afterOb),
    all.find((r) => r.id === 'theorems-of-relationship-of-node-value-comparison-23-iejmb')!
      .leftSide,
    all.find((r) => r.id === 'theorems-of-relationship-of-node-value-comparison-23-iejmb')!
      .rightSide,
    { dagCache: index.dagCache }
  ).match
);

const into = ensure(afterOb).replace(
  's_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},',
  '\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},'
);
chk(afterOb, into, 'afterOb->into with Pe still front in true');
