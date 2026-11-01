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

// dropTrue false: Ob t2, Os t2, Od s2, Os s2, Ob t1, Bb t1, Os t1
const dropTrue = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);

const exp1 = ensure(
  dropTrue.replace(
    '{,i \\Ob t_2,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
    '{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  )
);
console.log('dropTrue->exp1', j(dropTrue, exp1));

// Fill Ot into true of empty Bb — create-temp? Or move from outer?
// Outer has Ot? No — have Od s2 outside. create-temp adds Ot+Os.
// Path: Ot into true via create-temp then cancel Os; or connectivity sandwich fill.

const expOt = ensure(exp1.replace('\\Bb{t_2 \\Pc j}{,}{,}', '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,}'));
console.log('exp1->expOt', j(exp1, expOt));

const expOd = ensure(expOt.replace('\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,}', '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}'));
console.log('expOt->expOd', j(expOt, expOd));

// After exp1: Ob, Bb{}{}, Os, Od, Os, Ob t1...
// Alternative: create-temp at Ot position using Od outside via create-id reverse into Bb false?
// Try fill both arms at once (connectivity style)
const expBoth = ensure(
  exp1.replace('\\Bb{t_2 \\Pc j}{,}{,}', '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}')
);
console.log('exp1->expBoth', j(exp1, expBoth));

// Move Od into Bb false from after Os: Ob, Bb{Ot?}{}, Os, Od → Ob, Bb{Ot}{Od}, Os
const afterOt = ensure(
  exp1.replace(
    '\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,i \\Od s_2,',
    '\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,},t_2 \\Os,'
  )
);
console.log('exp1->afterOt Od into false', j(exp1, afterOt));

const withOt = ensure(
  afterOt.replace('\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,}', '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}')
);
console.log('afterOt->withOt', j(afterOt, withOt));

// create-temp then push Ot into Bb true, cancel extra Os with something
const tempTop = ensure(
  exp1.replace(
    '{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,',
    '{,i \\Ob t_2,\\Ot s_2,s_2 \\Os,\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,'
  )
);
console.log('exp1->tempTop create-temp', j(exp1, tempTop));

const tempIn = ensure(
  exp1.replace(
    '\\Bb{t_2 \\Pc j}{,}{,}',
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,}'
  )
);
console.log('exp1->tempIn create-temp in true', j(exp1, tempIn));

// Looking at first sandwich pattern in book: Ob, Bb{Ot}{Od}, Os — Od comes from create-id pushed?
// Or: use matchesSandwich / connectivity rules for empty → filled

// Search connectivity empty Bb fill
const cand = all.filter(
  (r) =>
    r.pos < pos &&
    r.leftSide.includes('\\Bb{if') &&
    r.leftSide.includes('{,}{,}') &&
    (r.rightSide.includes('\\Ot') || r.rightSide.includes('\\Od'))
);
console.log(
  'empty Bb fill rules',
  cand.slice(0, 20).map((r) => r.id + ' | ' + r.leftSide.slice(0, 60) + ' => ' + r.rightSide.slice(0, 80))
);

// Try: after empty Bb, use create-temp OUTSIDE then null into true arm
const otOut = ensure(
  `,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,},\\Ot s_2,s_2 \\Os,t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},`
);
console.log('exp1->otOut', j(exp1, otOut));

// From dropTrue go to full via create-id reverse in false for second Od? 
// full false starts with Od s2, Os, Ob t1... + sandwich at end
// dropTrue false: Ob t2, Os, Od s2, Os, Ob t1...
// Maybe expand sandwich BETWEEN Ob and Os (connectivity-9 already), fill, then bubble past Od/Os/t1 sandwich

const filled = ensure(
  `,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},`
);
console.log('exp1->filled', j(exp1, filled));
console.log('dropTrue->filled', j(dropTrue, filled));

// After filled: need extra s2 Os at end and move sandwich past first Od Os Ob t1 block, then create-id
const full = ensure(
  `,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},`
);
console.log('filled->full', j(filled, full));

// Direct: dropTrue with sandwich already filled between Ob and Os, then swap block to end
const sandMid = ensure(
  `,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},`
);
console.log('dropTrue->sandMid', j(dropTrue, sandMid));
console.log('filled->sandMid extra Os', j(filled, sandMid));

const drop = ensure(full.replace('{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,', '{,i \\Ob t_1,'));
console.log('full->R', j(full, R), drop === R);
