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

const orderedOs = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);

const pastOb = ensure(
  orderedOs.replace(',t_2 \\Os,s_2 \\Os,i \\Ob t_1,', ',t_2 \\Os,i \\Ob t_1,s_2 \\Os,')
);
console.log('orderedOs->pastOb', j(orderedOs, pastOb));

// Os past Bb — derived atom-into reverse or matchesPsPastUnzippedBb style
const pastBb = ensure(
  pastOb.replace(
    ',i \\Ob t_1,s_2 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
    ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},s_2 \\Os,t_1 \\Os,'
  )
);
console.log('pastOb->pastBb', j(pastOb, pastBb));

const pastBb2 = ensure(
  pastOb.replace(
    ',i \\Ob t_1,s_2 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
    ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,s_2 \\Os,'
  )
);
console.log('pastOb->pastBb2 end', j(pastOb, pastBb2));

// Push Os into Bb both arms then pull from other side?
const intoBb = ensure(
  pastOb.replace(
    ',i \\Ob t_1,s_2 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},',
    ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_2 \\Os,\\Ot s_1,}{,s_2 \\Os,i \\Od s_1,},'
  )
);
console.log('pastOb->intoBb', j(pastOb, intoBb));

// Unzip t2 sandwich with trailing s2 Os as part of release? 
// Or swap t2 and t1 sandwiches while Os is between Ob t1 and Bb:
// Ob t2, Bb2, Os2, Ob t1, Os_s, Bb1, Os1
const swap1 = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_1,s_2 \\Os,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_1 \\Os,t_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
console.log('pastOb->swap weird', j(pastOb, swap1));

// Clean unzip from pastBb2
const unzip = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,i \\Ob t_1,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_2 \\Os,t_1 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
console.log('pastBb2->unzip', j(pastBb2, unzip));

// Swap Ob order + Bb order + Os order in unzip
const reord = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_1 \\Os,t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
console.log('unzip->reord', j(unzip, reord));
console.log('reord->R', j(reord, R));

// Try matchesObBbOsUnzip on false-arm-only by checking top-level if we extract false arm...
// Maybe: drop outer Bb context — test unzip on flat sandwiches
const flatL = ensure(
  ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,s_2 \\Os,'
);
const flatU = ensure(
  ',i \\Ob t_2,i \\Ob t_1,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_2 \\Os,t_1 \\Os,s_2 \\Os,'
);
console.log('flat unzip', j(flatL, flatU));

const flatR = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,'
);
console.log('flatL->flatR', j(flatL, flatR));
console.log('flatU->flatR', j(flatU, flatR));
