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
console.log('exp1->swap1', j(exp1, swap1));

// Push Od into Bb both arms (null-10 / swap-55)
const odBoth = ensure(
  swap1.replace(
    'i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,},i \\Od s_2,',
    'i \\Ob t_2,\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},'
  )
);
console.log('swap1->odBoth', j(swap1, odBoth));

// Push Od into false only
const odFalse = ensure(
  swap1.replace(
    '\\Bb{t_2 \\Pc j}{,}{,},i \\Od s_2,',
    '\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,},'
  )
);
console.log('swap1->odFalse', j(swap1, odFalse));

// Push Od into both via atom pattern from front of Bb
const odBoth2 = ensure(
  `,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,i \\Od s_2,\\Bb{t_2 \\Pc j}{,}{,},t_2 \\Os,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},`
);
console.log('swap1->odBoth2 Od before Bb', j(swap1, odBoth2));

// After odBoth: Ob, Bb{Od}{Od}, t2 Os, s2 Os, Ob t1...
// Drop Od from true via create-id? Need Os. Or use create-temp for Ot in true, keep Od in false
const withOt = ensure(
  odBoth.replace('\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,}', '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}')
);
console.log('odBoth->withOt', j(odBoth, withOt));

// create-temp in true of odFalse/odBoth
const otInOdBoth = ensure(
  odBoth.replace('{,i \\Od s_2,}{,i \\Od s_2,}', '{,\\Ot s_2,s_2 \\Os,i \\Od s_2,}{,i \\Od s_2,}')
);
console.log('odBoth->otInOdBoth', j(odBoth, otInOdBoth));

// From swap1: create-temp then arrange
const tempThen = ensure(
  swap1.replace('\\Bb{t_2 \\Pc j}{,}{,}', '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,}')
);
console.log('swap1->tempThen', j(swap1, tempThen));

// Od into false of tempThen
const tempOd = ensure(
  tempThen.replace(
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,},i \\Od s_2,',
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,},'
  )
);
console.log('tempThen->tempOd', j(tempThen, tempOd));

// After tempThen: Ob, Bb{Ot, Os}{}, Od, t2 Os, s2 Os
// Swap Od into position, push into false, pull Os from true
const tempSwap = ensure(
  tempThen.replace(
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,},i \\Od s_2,t_2 \\Os,s_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,},t_2 \\Os,i \\Od s_2,s_2 \\Os,'
  )
);
console.log('tempThen->tempSwap back', j(tempThen, tempSwap));

// Push Od into both arms of Bb{Ot Os}{} 
const tempOdBoth = ensure(
  tempThen.replace(
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,}{,},i \\Od s_2,',
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,\\Ot s_2,s_2 \\Os,}{,i \\Od s_2,},'
  )
);
console.log('tempThen->tempOdBoth', j(tempThen, tempOdBoth));

// Look at first sandwich construction in tex around 122 converse
// Alternative theory: Pe link Ot to Od — temp-value-equal
// Ot s2, i Od s2 ↔ ? 

// Check: from swap1 push Od into Bb false using matchesAtomIntoRelBbTrailing
const atom = ensure(
  swap1.replace('\\Bb{t_2 \\Pc j}{,}{,},i \\Od s_2,', '\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,},')
);
console.log('swap1->atom false only', j(swap1, atom));

// Both arms with empty true getting Od
const atom2 = ensure(
  swap1.replace('\\Bb{t_2 \\Pc j}{,}{,},i \\Od s_2,', '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},')
);
console.log('swap1->atom2 both', j(swap1, atom2));

// Once we have Ob, Bb{Ot}{Od}, Os — that's filled. From atom2: Ob, Bb{Od}{Od}, t2 Os, s2 Os
// Replace true Od with Ot via... create-temp cancel Od? Doesn't make sense.
// Use: create-temp outside, Pe equal, drop Od?

// Check id-value / temp-value between Ot and Od
const pe = all.filter(
  (r) =>
    r.pos < pos &&
    ((r.leftSide.includes('\\Ot') && r.leftSide.includes('\\Od')) ||
      r.id.includes('temp-value') ||
      r.id.includes('id-value'))
);
console.log(
  'Ot/Od rules',
  pe.slice(0, 25).map((r) => r.id + ' :: ' + r.leftSide.slice(0, 50) + ' => ' + r.rightSide.slice(0, 50))
);
