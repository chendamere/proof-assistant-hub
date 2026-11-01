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

const odBoth = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);

// Pull Od out of true only (rev equiv-code-dist partial?)
const pullTrue = ensure(
  odBoth.replace('\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,}', '\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,},i \\Od s_2,')
);
console.log('odBoth->pullTrue', j(odBoth, pullTrue));

const pullBoth = ensure(
  odBoth.replace('\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,', 'i \\Od s_2,\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,s_2 \\Os,')
);
console.log('odBoth->pullBoth', j(odBoth, pullBoth));

// create-temp with DIFFERENT name u, then somehow rename — skip

// Use Ot s2 via create-temp OUTSIDE Bb then push Ot into true only
const otOut = ensure(
  odBoth.replace(
    '{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},',
    '{,i \\Ob t_2,\\Ot s_2,s_2 \\Os,\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},'
  )
);
console.log('odBoth->otOut', j(odBoth, otOut));

// Push Ot into true of Bb (and Os?)
const otIntoTrue = ensure(
  otOut.replace(
    '\\Ot s_2,s_2 \\Os,\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,}',
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,i \\Od s_2,}{,i \\Od s_2,},s_2 \\Os,'
  )
);
console.log('otOut->otIntoTrue', j(otOut, otIntoTrue));

const otIntoBoth = ensure(
  otOut.replace(
    '\\Ot s_2,s_2 \\Os,\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,}',
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,i \\Od s_2,}{,\\Ot s_2,i \\Od s_2,},s_2 \\Os,'
  )
);
console.log('otOut->otIntoBoth', j(otOut, otIntoBoth));

// From odBoth: cancel true Od using outer s2 Os via bringing Os into true?
// Bb{Od}{Od}, t2 Os, s2 Os → Bb{Od, Os}{Od}, t2 Os → create-id → Bb{}{Od}, t2 Os then create-temp
const osIntoTrue = ensure(
  odBoth.replace(
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,},t_2 \\Os,'
  )
);
console.log('odBoth->osIntoTrue', j(odBoth, osIntoTrue));

const osIntoBoth = ensure(
  odBoth.replace(
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,},t_2 \\Os,'
  )
);
console.log('odBoth->osIntoBoth', j(odBoth, osIntoBoth));

// After osIntoTrue: Bb{Od, Os}{Od}, t2 Os — create-id cancel true
const afterCid = ensure(
  osIntoTrue.replace('\\Bb{t_2 \\Pc j}{,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,}', '\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,}')
);
console.log('osIntoTrue->afterCid', j(osIntoTrue, afterCid));

// Then create-temp in true
const afterTemp = ensure(
  afterCid.replace('\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,}', '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,}')
);
console.log('afterCid->afterTemp', j(afterCid, afterTemp));

// Cancel the Os from create-temp — need another Os or pull Os out and... 
// afterTemp: Bb{Ot, Os}{Od}, t2 Os — pull Os out next to t2 Os then... can't cancel two Os
// Or create-temp reverse after moving Os out: Bb{Ot}{Od}, Os, t2 Os — then have extra Os which we WANT (s2 Os)!
const pullOs = ensure(
  afterTemp.replace('\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,},t_2 \\Os,', '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},s_2 \\Os,t_2 \\Os,')
);
console.log('afterTemp->pullOs', j(afterTemp, pullOs));

// Direct filled from afterTemp by create-temp reverse leaving Ot? That needs Os removed without Ot - create-temp is Ot+Os together only.

// Check if osIntoTrue->afterCid works despite false also having Od s2
console.log('---');
// Try create-id on osIntoTrue carefully
const afterCid2 = ensure(
  `,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,},t_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},`
);
console.log('osIntoTrue->afterCid2', j(osIntoTrue, afterCid2));
