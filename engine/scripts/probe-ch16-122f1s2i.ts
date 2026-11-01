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

const intoOd = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_2,s_2 \\Os,i \\Od s_1,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
const s1 = ensure(intoOd.replace('{,i \\Od s_2,s_2 \\Os,i \\Od s_1,}', '{,i \\Od s_2,i \\Od s_1,s_2 \\Os,}'));
const s2 = ensure(s1.replace('{,i \\Od s_2,i \\Od s_1,s_2 \\Os,}', '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}'));
const R = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},'
);
const top = ensure(s2 + 'i \\Ob t_2,t_2 \\Os,'.replace(/^,/,'') );
// fix: s2 already ends with comma
const top2 = ensure(s2.replace(/,$/, ',i \\Ob t_2,t_2 \\Os,'));

// Prepend Ob before first Bb (bubble from end - hard). Start create-subnode at front instead:
const front = ensure(',i \\Ob t_2,t_2 \\Os,' + s2.slice(1));
console.log('s2->front', j(s2, front));

// swap-57: Ob before Bb{i Pu}
const intoArms = ensure(
  front.replace(
    ',i \\Ob t_2,t_2 \\Os,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,',
    ',t_2 \\Os,\\Bb{i \\Pu}{,i \\Ob t_2,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,i \\Od s_2,s_2 \\Os,i \\Ob t_1,'
  )
);
console.log('front->intoArms Ob only', j(front, ensure(intoArms)));

// Push Ob+Os together - first push Os with Ob adjacent
const frontOs = ensure(front.replace(',i \\Ob t_2,t_2 \\Os,\\Bb{i \\Pu}', ',i \\Ob t_2,\\Bb{i \\Pu}').replace(
  // put Os into arms via null-12 after Ob pushed
  'PLACEHOLDER',
  ''
));

// Use swap-57 with Os still outside: Ob, Bb → Bb with Ob in arms, Os outside
const obInto = ensure(
  `,i \\Ob t_2,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},t_2 \\Os,`
);
console.log('front->obInto leave Os end', j(front, obInto));
const obInto2 = ensure(
  `,\\Bb{i \\Pu}{,i \\Ob t_2,i \\Od s_1,i \\Od s_2,s_2 \\Os,}{,i \\Ob t_2,i \\Od s_2,s_2 \\Os,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,},\\Bb{s_1 \\Pu}{,s_1 \\Os,\\Tc c_1,}{,s_1 \\Os,\\Tc c_2,},t_2 \\Os,`
);
console.log('obInto->obInto2 swap57', j(obInto, obInto2));

// Check swap-57 directly on fragment
const fragL = ensure(',i \\Ob t_2,\\Bb{i \\Pu}{,\\Tc c_1,}{,\\Tc c_2,},');
const fragR = ensure(',\\Bb{i \\Pu}{,i \\Ob t_2,\\Tc c_1,}{,i \\Ob t_2,\\Tc c_2,},');
console.log('frag swap57', j(fragL, fragR));
console.log('front->obInto2', j(front, obInto2));
