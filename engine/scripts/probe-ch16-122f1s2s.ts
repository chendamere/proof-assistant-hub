import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';

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
  let t = normalizeSpacing(fromOperatorFirst(stripDisplayIfConditions(s))).trim();
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
  if (ensure(a) === ensure(b)) return 'identity';
  if (matchesDerivedBbTransition(ensure(a), ensure(b))) return 'derived';
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return rule.id;
  }
  return null;
}

const R = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);

// Book micro: 574 → 573
const book574 = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,},t_2 \\Os,');
const book573 = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},s_2 \\Os,t_2 \\Os,');
console.log('book574->573', j(book574, book573));

const book575 = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,s_2 \\Os,},t_2 \\Os,');
const book576 = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,');
console.log('book575->576', j(book575, book576));
console.log('book576->575', j(book576, book575));
console.log('book573->572', j(book573, ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,')));

// Our temp1 → pull Os both arms (book 574→573)
const temp1 = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,},t_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
const pulled = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},s_2 \\Os,t_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
console.log('temp1->pulled', j(temp1, pulled));

const orderedOs = ensure(
  pulled.replace(',s_2 \\Os,t_2 \\Os,i \\Ob t_1,', ',t_2 \\Os,s_2 \\Os,i \\Ob t_1,')
);
console.log('pulled->orderedOs', j(pulled, orderedOs));

// Move sandwich past t1 sandwich → R
console.log('orderedOs->R', j(orderedOs, R));
console.log('pulled->R', j(pulled, R));

// unzip then reorder
const unzip = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,i \\Ob t_1,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},s_2 \\Os,t_2 \\Os,t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
console.log('pulled->unzip', j(pulled, unzip));

const unzip2 = ensure(
  orderedOs.replace(
    '{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,}',
    '{,i \\Ob t_2,i \\Ob t_1,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_2 \\Os,s_2 \\Os,t_1 \\Os,}'
  )
);
console.log('orderedOs->unzip2', j(orderedOs, unzip2));

// Swap creates in unzip: Ob t2, Ob t1 → Ob t1, Ob t2 and matching Bbs and releases
const reord = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_1 \\Os,t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
console.log('unzip2->reord', j(unzip2, reord));
console.log('reord->R', j(reord, R));
console.log('unzip2->R', j(unzip2, R));
