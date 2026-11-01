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

// Rebuild chain to otInOdBoth
const dropTrue = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
const exp1 = ensure(
  dropTrue.replace(
    '{,i \\Ob t_2,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
    '{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  )
);
const swap1 = ensure(
  exp1.replace(
    '\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,i \\Od s_2,s_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,}{,},i \\Od s_2,t_2 \\Os,s_2 \\Os,'
  )
);
const odBoth = ensure(
  swap1.replace(
    'i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,},i \\Od s_2,',
    'i \\Ob t_2,\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},'
  )
);
const otIn = ensure(
  odBoth.replace('{,i \\Od s_2,}{,i \\Od s_2,}', '{,\\Ot s_2,s_2 \\Os,i \\Od s_2,}{,i \\Od s_2,}')
);
console.log('otIn', otIn.includes('{,\\Ot s_2,s_2 \\Os,i \\Od s_2,}{,i \\Od s_2,}'));
console.log('odBoth->otIn', j(odBoth, otIn));

// Reorder true: Ot, Os, Od → Ot, Od, Os (swap Os past Od? Os before Od currently)
const re1 = ensure(otIn.replace('{,\\Ot s_2,s_2 \\Os,i \\Od s_2,}', '{,\\Ot s_2,i \\Od s_2,s_2 \\Os,}'));
console.log('otIn->re1', j(otIn, re1));

// Od, Os, Ot
const re2 = ensure(otIn.replace('{,\\Ot s_2,s_2 \\Os,i \\Od s_2,}', '{,i \\Od s_2,s_2 \\Os,\\Ot s_2,}'));
console.log('otIn->re2', j(otIn, re2));

// create-id cancel Od+Os in true leaving Ot (from re1)
const filled = ensure(re1.replace('{,\\Ot s_2,i \\Od s_2,s_2 \\Os,}', '{,\\Ot s_2,}'));
console.log('re1->filled', j(re1, filled));

// From otIn directly create-id if Od,Os adjacent: Ot, Os, Od — Os and Od not create-id order (need Od, Os)
const re3 = ensure(otIn.replace('{,\\Ot s_2,s_2 \\Os,i \\Od s_2,}', '{,s_2 \\Os,i \\Od s_2,\\Ot s_2,}'));
console.log('otIn->re3', j(otIn, re3));

const filled2 = ensure(
  `,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},`
);
console.log('filled==target?', filled === filled2);
console.log('re1->filled2', j(re1, filled2));
console.log('otIn->filled2', j(otIn, filled2));

// After filled2: sandwich at front of false, then Ob t1 sandwich. Need move to end + create-id drop leading Od Os from a "full" state
// Actually R false: Ob t1..., Os, Ob t2, Bb{Ot}{Od}, Os, Os
// filled2 false: Ob t2, Bb{Ot}{Od}, Os, Os, Ob t1, Bb, Os
// So bubble t2 sandwich past t1 sandwich (unzip/zip!)

const unzipped = ensure(
  `,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,i \\Ob t_1,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_2 \\Os,s_2 \\Os,t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},`
);
console.log('filled2->unzip', j(filled2, unzipped));

// zip order t1 then t2
const ordered = ensure(
  `,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},`
);
console.log('filled2->ordered', j(filled2, ordered));
console.log('ordered==R', ordered === R);
console.log('filled2->R', j(filled2, R));

// Via full (leading Od Os) then create-id
const full = ensure(
  `,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},`
);
console.log('ordered->full', j(ordered, full));
console.log('full->R', j(full, R));
