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

const L = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
const b1 = ensure(',i \\Od s_2,s_2 \\Os,' + L.slice(1));
const intoOs = ensure(
  b1.replace(
    ',i \\Od s_2,s_2 \\Os,\\Bb{i \\Pu}{,i \\Od s_1,}{,i \\Ob t_1,',
    ',i \\Od s_2,\\Bb{i \\Pu}{,s_2 \\Os,i \\Od s_1,}{,s_2 \\Os,i \\Ob t_1,'
  )
);
const intoOd = ensure(
  intoOs.replace(
    ',i \\Od s_2,\\Bb{i \\Pu}{,s_2 \\Os,i \\Od s_1,}{,s_2 \\Os,i \\Ob t_1,',
    ',\\Bb{i \\Pu}{,i \\Od s_2,s_2 \\Os,i \\Od s_1,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  )
);
console.log('L->b1', j(L, b1));
console.log('b1->intoOs', j(b1, intoOs));
console.log('intoOs->intoOd', j(intoOs, intoOd));

// Same pattern with Ob instead of Od at front
const s2 = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
const front = ensure(',i \\Ob t_2,t_2 \\Os,' + s2.slice(1));
const intoOsOb = ensure(
  front.replace(
    ',i \\Ob t_2,t_2 \\Os,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
    ',i \\Ob t_2,\\Bb{i \\Pu}{,t_2 \\Os,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  )
);
console.log('front->intoOsOb', j(front, intoOsOb));
const intoOb = ensure(
  intoOsOb.replace(
    ',i \\Ob t_2,\\Bb{i \\Pu}{,t_2 \\Os,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
    ',\\Bb{i \\Pu}{,i \\Ob t_2,t_2 \\Os,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  )
);
console.log('intoOsOb->intoOb', j(intoOsOb, intoOb));

const R = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);

// From intoOb: Ob+Os in BOTH arms. Need: drop from true arm (create-subnode reverse), keep/reorder false arm, expand sandwich
const dropTrue = ensure(
  intoOb.replace(
    '{,i \\Ob t_2,t_2 \\Os,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
    '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}'
  )
);
console.log('intoOb->dropTrue', j(intoOb, dropTrue));

// false arm now: i Ob t2, t2 Os, i Od s2, s2 Os, i Ob t1, Bb..., t1 Os
// Need: i Od s2, s2 Os, i Ob t1, ..., t1 Os, i Ob t2, Bb{t2}{Ot s2}{i Od s2}, t2 Os, s2 Os
// Or directly to R false: i Ob t1,...,t1 Os, i Ob t2, Bb{t2}{Ot s2}{Od s2}, t2 Os, s2 Os
// with create-id cancel of leading Od+Os in full

const falseOnly = dropTrue; // Ob+Os only in false
console.log('falseOnly snippet', falseOnly.slice(0, 200));

// Expand empty Bb after Ob t2 in false
const exp1 = ensure(
  falseOnly.replace(
    '{,i \\Ob t_2,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
    '{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  )
);
console.log('dropTrue->exp1 empty Bb', j(falseOnly, exp1));

const exp2 = ensure(
  falseOnly.replace(
    '{,i \\Ob t_2,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
    '{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  ).replace(
    ',t_1 \\Os,}',
    ',t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,}'
  )
);
// wait that double-modifies wrongly. Rebuild carefully:
const midFalse = ensure(
  `,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,t_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},`
);
console.log('dropTrue->midFalse reorder Ob to end', j(falseOnly, midFalse));

const full = ensure(
  `,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},`
);
console.log('midFalse->full', j(midFalse, full));
console.log('dropTrue->full', j(falseOnly, full));
console.log('intoOb->full', j(intoOb, full));
console.log('front->full', j(front, full));
console.log('s2->full', j(s2, full));

const drop = ensure(full.replace('{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,', '{,i \\Ob t_1,'));
console.log('full->drop', j(full, drop), 'eqR', drop === R);
console.log('front->R', j(front, R));
console.log('intoOb->R', j(intoOb, R));
console.log('s2->R', j(s2, R));
