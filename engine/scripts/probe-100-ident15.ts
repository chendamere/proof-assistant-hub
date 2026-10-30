import { theorems } from '../../src/data/theorems';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const CHAPTER_ORDER = [
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
];
function posOf(id: string): number {
  const early = earlyRulePosition(id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axioms.some((r) => r.id === id) || definitions.some((r) => r.id === id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + parseInt(m[2]!, 10) + 1;
}
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

const all = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const index = buildRuleIndex(
  all.filter((r) => r.pos < 13 * 100000 + 100),
  new Map()
);
const rule15 = all.find((t) => t.id.includes('identical-node-comparison-15'))!;
const r17 = all.find((t) => t.id === 'recursive-function-r-17-ibifm')!;

const cases = [
  {
    name: 'Blb nonempty equal arms push Os',
    L: ',j_1 \\Os,\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_2 \\Os,},',
    R: ',\\Blb{i_1 \\Ps j_2}{,j_1 \\Os,i_1 \\Os,j_2 \\Os,}{,j_1 \\Os,i_1 \\Os,j_2 \\Os,},',
  },
  {
    name: 'Bb with Tc only push Os — no such rule, try r17 style abstract',
    L: ',i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,\\Tc c_1,}{,\\Tc c_2,},',
    R: ',\\Bb{i_1 \\Ps j_1}{,i_2 \\Os,\\Tc c_1,}{,i_2 \\Os,\\Tc c_2,},',
  },
  {
    name: 'r17 R push into Bb Tc',
    L: ',R(j_1),\\Bb{i_2 \\Ps j_2}{,\\Tc c_1,}{,\\Tc c_2,},',
    R: ',\\Bb{i_2 \\Ps j_2}{,R(j_1),\\Tc c_1,}{,R(j_1),\\Tc c_2,},',
  },
  {
    name: 'r17 R push into Bb with existing arm content via Tc slots?',
    L: ',R(j_1),\\Bb{i_2 \\Ps j_2}{,i_2 \\Os,j_2 \\Os,\\Tc c_1,}{,i_2 \\Os,j_2 \\Os,\\Tc c_2,},',
    R: ',\\Bb{i_2 \\Ps j_2}{,R(j_1),i_2 \\Os,j_2 \\Os,\\Tc c_1,}{,R(j_1),i_2 \\Os,j_2 \\Os,\\Tc c_2,},',
  },
  {
    name: 's38-like: R push before nested Bb in true, and before j1 Os in false',
    L: ',R(j_1),\\Bb{i_2 \\Ps j_2}{,i_2 \\Os,j_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},',
    R: ',\\Bb{i_2 \\Ps j_2}{,i_2 \\Os,j_2 \\Os,R(j_1),\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,j_2 \\Os,i_1 \\Os,R(j_1),j_1 \\Os,\\Tc c_2,},',
  },
];

for (const c of cases) {
  const A = ensure(c.L);
  const B = ensure(c.R);
  const m15 = checkInferenceRules(A, B, rule15.leftSide, rule15.rightSide, { dagCache: index.dagCache });
  const m17 = checkInferenceRules(A, B, r17.leftSide, r17.rightSide, { dagCache: index.dagCache });
  console.log(c.name);
  console.log('  ident15', m15.match, 'r17', m17.match);
}

// Exhaustive: which rule justifies s38 push?
const s38L = ensure(cases[4]!.L);
const s38R = ensure(cases[4]!.R);
console.log('\nExhaustive s38...');
let hits = 0;
for (const rule of all.filter((r) => r.pos < POS)) {
  if (rule.id.includes('error-code') || rule.id.includes('equiv-code')) continue;
  if (rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
  const m = checkInferenceRules(s38L, s38R, rule.leftSide, rule.rightSide, { dagCache: index.dagCache });
  if (m.match) {
    console.log('HIT', rule.id);
    hits++;
  }
}
console.log('hits', hits);

// What about factoring: first abstract arms to Tc, push, expand?
// empty-branch / create-copy patterns
const emptyRules = all.filter(
  (r) => r.pos < POS && /empty-branch|identical-4|create-copy|tc/.test(r.id)
);
console.log('\nempty-ish rules', emptyRules.length);
for (const r of emptyRules.slice(0, 20)) {
  console.log(r.id, r.leftSide.slice(0, 80), '=>', r.rightSide.slice(0, 80));
}
