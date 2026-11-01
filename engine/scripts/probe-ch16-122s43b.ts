import fs from 'fs';
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

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f43 = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 43)!;
const L = ensure(f43.left);
const R = ensure(f43.right);

// Pull Pe out of outer Bb{s1 Pu} both arms
const peOut = ensure(
  L.replace(
    '\\Bb{s_1 \\Pu}{,s_1 \\Pe s_2,s_2 \\Os,s_1 \\Os,\\Tc c_1,}{,s_1 \\Pe s_2,\\Bb{s_1 \\Pu}',
    's_1 \\Pe s_2,\\Bb{s_1 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_1,}{,\\Bb{s_1 \\Pu}'
  )
);
console.log('L->peOut', j(L, peOut));

const subst = ensure(
  peOut.replace(
    's_1 \\Pe s_2,\\Bb{s_1 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_1,}{,\\Bb{s_1 \\Pu}',
    's_1 \\Pe s_2,\\Bb{s_1 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_1,}{,\\Bb{s_2 \\Pu}'
  )
);
console.log('peOut->subst nested', j(peOut, subst));

// After peOut, Pe is before outer Bb - null-58 would change OUTER Bb{s1 Pu} to Bb{s2 Pu}!
const wrong = ensure(peOut.replace(',s_1 \\Pe s_2,\\Bb{s_1 \\Pu}', ',s_1 \\Pe s_2,\\Bb{s_2 \\Pu}'));
console.log('peOut->wrong outer subst', j(peOut, wrong));

// Isolate: only false arm content for subst
const falseOnly = ensure(
  ',s_1 \\Pe s_2,\\Bb{s_1 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_3,}{,s_2 \\Os,s_1 \\Os,\\Tc c_2,},'
);
const falseR = ensure(
  ',s_1 \\Pe s_2,\\Bb{s_2 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_3,}{,s_2 \\Os,s_1 \\Os,\\Tc c_2,},'
);
console.log('falseOnly', j(falseOnly, falseR));

// In peOut, Pe is before OUTER Bb which contains nested. null-58 applies to first Bb{s1 Pu} after Pe = OUTER.
// Need Pe next to NESTED only. Push Pe into false arm only? Or into both then...

// From L: Pe already before nested in false. Why null-58 fails?
// Maybe because true arm also starts with Pe - rule wants unique?
// Try fragment matching the false arm as top-level with prefix shell
const withShell = ensure(
  ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,}{,SAND,},\\Bb{s_1 \\Pu}{,s_1 \\Pe s_2,s_2 \\Os,s_1 \\Os,\\Tc c_1,}{,s_1 \\Pe s_2,\\Bb{s_1 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_3,}{,s_2 \\Os,s_1 \\Os,\\Tc c_2,},},'
);

// Direct: apply null-58 only on nested by checking inference with focus
// Test if trailing after outer true Pe blocks
const onlyFalseDiff = ensure(
  L.replace(
    '{,s_1 \\Pe s_2,\\Bb{s_1 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_3,}{,s_2 \\Os,s_1 \\Os,\\Tc c_2,},}',
    '{,s_1 \\Pe s_2,\\Bb{s_2 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_3,}{,s_2 \\Os,s_1 \\Os,\\Tc c_2,},}'
  )
);
console.log('onlyFalseDiff==R', onlyFalseDiff === R);
console.log('L->onlyFalseDiff', j(L, onlyFalseDiff));

// Try without true-arm Pe (strip true Pe)
const noTruePe = ensure(
  L.replace('{,s_1 \\Pe s_2,s_2 \\Os,s_1 \\Os,\\Tc c_1,}', '{,s_2 \\Os,s_1 \\Os,\\Tc c_1,}')
);
const noTruePeR = ensure(
  noTruePe.replace(
    '{,s_1 \\Pe s_2,\\Bb{s_1 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_3,}',
    '{,s_1 \\Pe s_2,\\Bb{s_2 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_3,}'
  )
);
console.log('noTruePe->subst', j(noTruePe, noTruePeR));

// Check null-58 statement again - left is Pe, Bb{i Pu} - in our false arm Pe, Bb is exactly that.
// Outer structure: ..., Bb{s1 Pu}{true with Pe}{false with Pe, Bb}
// When matching whole expr, maybe multiple Pe,Bb{s1 Pu} candidates and NONUNIQUE fails?

// Derived helper: Pe subst of nested Bb{i Pu}→Bb{j Pu} when Pe is in same arm before nested Bb
console.log('---');
console.log('R', R.slice(-120));
