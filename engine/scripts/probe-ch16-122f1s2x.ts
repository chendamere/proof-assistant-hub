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

const intoBb = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_2 \\Os,\\Ot s_1,}{,s_2 \\Os,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);

// true arm only first
const trueOnly = ensure(
  intoBb.replace('{,s_2 \\Os,\\Ot s_1,}{,s_2 \\Os,i \\Od s_1,}', '{,\\Ot s_1,s_2 \\Os,}{,s_2 \\Os,i \\Od s_1,}')
);
console.log('intoBb->trueOnly', j(intoBb, trueOnly));

const falseOnly = ensure(
  intoBb.replace('{,s_2 \\Os,\\Ot s_1,}{,s_2 \\Os,i \\Od s_1,}', '{,s_2 \\Os,\\Ot s_1,}{,i \\Od s_1,s_2 \\Os,}')
);
console.log('intoBb->falseOnly', j(intoBb, falseOnly));

const both = ensure(
  intoBb.replace('{,s_2 \\Os,\\Ot s_1,}{,s_2 \\Os,i \\Od s_1,}', '{,\\Ot s_1,s_2 \\Os,}{,i \\Od s_1,s_2 \\Os,}')
);
console.log('intoBb->both', j(intoBb, both));
console.log('trueOnly->both', j(trueOnly, both));

// Micro fragments
console.log('frag Os Ot', j(
  ensure(',s_2 \\Os,\\Ot s_1,'),
  ensure(',\\Ot s_1,s_2 \\Os,')
));
console.log('frag Os Od', j(
  ensure(',s_2 \\Os,i \\Od s_1,'),
  ensure(',i \\Od s_1,s_2 \\Os,')
));

// Pull Os out WITHOUT reordering — from intoBb with Os first
const pullFront = ensure(
  intoBb.replace(
    '\\Bb{t_1 \\Pc j}{,s_2 \\Os,\\Ot s_1,}{,s_2 \\Os,i \\Od s_1,},t_1 \\Os,',
    's_2 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,'
  )
);
console.log('intoBb->pullFront', j(intoBb, pullFront));

// That returns to pastOb essentially. 

// Different approach: unzip WITHOUT moving s2 Os to end — attach s2 Os as trailing shell after BOTH releases
// orderedOs: Ob2,Bb2,Os2, Os_s, Ob1,Bb1,Os1
const orderedOs = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);

// Can we unzip treating middle Os_s as problem?
// Use matchesPsPastUnzippedBb style derived: move Os past unzipped structure

// NEW APPROACH: add derived helper matchesSandwichReorderInBbFalseArm
// For now try: from orderedOs, unzip ignoring middle Os by first merging Os2 with Os_s?

// Or swap entire t2 sandwich with t1 using create-subnode through — 

// Check if nested false-arm unzip works when we strip outer Bb for derived:
// Actually extend matchesObBbOsUnzip to look inside Bb false arms!

// Quick test: does derived already look inside?
const innerL = orderedOs; // has sandwiches inside false
const innerR = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
console.log('orderedOs->R direct', j(orderedOs, innerR));

// What if we unzip at top by taking false arm items - implement local check
import { matchesObBbOsUnzip } from '../src/inferenceRules/caseFocus';
const falseL = ensure(
  ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,'
);
const falseR = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,'
);
console.log('false arm swap unzip?', matchesObBbOsUnzip(falseL, falseR));
console.log('false arm j', j(falseL, falseR));

// Via unzip flat with Os in middle — move Os to end first on flat
const flatMid = ensure(
  ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,'
);
const flatEnd = ensure(
  ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,s_2 \\Os,'
);
console.log('flatMid->flatEnd', j(flatMid, flatEnd));

const pastOb = ensure(
  ',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,i \\Ob t_1,s_2 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,'
);
console.log('flatMid->pastOb', j(flatMid, pastOb));
const into = ensure(
  pastOb.replace(
    ',i \\Ob t_1,s_2 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},',
    ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_2 \\Os,\\Ot s_1,}{,s_2 \\Os,i \\Od s_1,},'
  )
);
console.log('pastOb->into', j(pastOb, into));
const reT = ensure(into.replace('{,s_2 \\Os,\\Ot s_1,}', '{,\\Ot s_1,s_2 \\Os,}'));
console.log('into->reT', j(into, reT));
const reF = ensure(reT.replace('{,s_2 \\Os,i \\Od s_1,}', '{,i \\Od s_1,s_2 \\Os,}'));
console.log('reT->reF', j(reT, reF));
const out = ensure(
  reF.replace(
    '\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_2 \\Os,}{,i \\Od s_1,s_2 \\Os,},t_1 \\Os,',
    '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,s_2 \\Os,'
  )
);
console.log('reF->out', j(reF, out));
const unzip = ensure(
  ',i \\Ob t_2,i \\Ob t_1,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_2 \\Os,t_1 \\Os,s_2 \\Os,'
);
console.log('out->unzip', j(out, unzip));
