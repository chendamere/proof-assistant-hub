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

// Minimal create-id in Bb true with Ot present and Od in false
const A = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,},t_2 \\Os,');
const B = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,');
console.log('min re1->filled', j(A, B));

const A2 = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,},t_2 \\Os,');
const B2 = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,},t_2 \\Os,');
console.log('min no Ot', j(A2, B2));

const A3 = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_2 \\Os,i \\Od s_2,}{,i \\Od s_2,},t_2 \\Os,');
const B3 = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,');
console.log('Ot Os Od order', j(A3, B3));

const A4 = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,');
const B4 = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,');
console.log('with trailing s2 Os', j(A4, B4));

// Full context re1
const re1 = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
const filled = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
console.log('full re1->filled', j(re1, filled));
console.log('re1 has true Od Os?', /\\\\Ot s_2,i \\\\Od s_2,s_2 \\\\Os/.test(re1) || re1.includes('\\Ot s_2,i \\Od s_2,s_2 \\Os'));

// Maybe outer true arm also has i Od s2, s2 Os — create-id prefers canceling those?
const outerCancel = ensure(
  re1.replace('{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}', '{,i \\Od s_1,}')
);
console.log('re1->outerCancel', j(re1, outerCancel));

// Justify osIntoTrue from odBoth — use equiv-code-dist for Os?
const odBoth = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
// Swap t2 Os and s2 Os so s2 Os adjacent to Bb for push?
const swapOs = ensure(
  odBoth.replace(
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},s_2 \\Os,t_2 \\Os,'
  )
);
console.log('odBoth->swapOs', j(odBoth, swapOs));
const osBoth = ensure(
  swapOs.replace(
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,}{,i \\Od s_2,},s_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,},'
  )
);
console.log('swapOs->osBoth', j(swapOs, osBoth));

// After osBoth: Bb{Od, Os}{Od, Os}, t2 Os — create-id on true
const cidTrue = ensure(
  osBoth.replace('\\Bb{t_2 \\Pc j}{,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,}', '\\Bb{t_2 \\Pc j}{,}{,i \\Od s_2,s_2 \\Os,}')
);
console.log('osBoth->cidTrue', j(osBoth, cidTrue));

// create-id both arms?
const cidBoth = ensure(
  osBoth.replace('\\Bb{t_2 \\Pc j}{,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,}', '\\Bb{t_2 \\Pc j}{,}{,}')
);
console.log('osBoth->cidBoth', j(osBoth, cidBoth));
