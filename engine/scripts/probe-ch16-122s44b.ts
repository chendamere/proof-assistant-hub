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
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 44)!;
const L = ensure(f.left);
const R = ensure(f.right);

const peOut = ensure(
  L.replace(
    '\\Bb{s_1 \\Pu}{,s_1 \\Pe s_2,s_2 \\Os,s_1 \\Os,\\Tc c_1,}{,s_1 \\Pe s_2,\\Bb{s_2 \\Pu}',
    's_1 \\Pe s_2,\\Bb{s_1 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_1,}{,\\Bb{s_2 \\Pu}'
  )
);

// Move Pe into first Bb true next to Ods
const intoTrue = ensure(
  peOut.replace(
    '\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,}{,',
    '\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,}{,'
  ).replace(',s_1 \\Pe s_2,\\Bb{s_1 \\Pu}', ',\\Bb{s_1 \\Pu}')
);
console.log('peOut->intoTrue', j(peOut, intoTrue));

// Pe into both arms of first Bb
const intoBoth = ensure(
  peOut.replace(
    '\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,}{,i \\Ob t_1,',
    '\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,}{,s_1 \\Pe s_2,i \\Ob t_1,'
  ).replace(',s_1 \\Pe s_2,\\Bb{s_1 \\Pu}', ',\\Bb{s_1 \\Pu}')
);
console.log('peOut->intoBoth', j(peOut, intoBoth));

const cancel = ensure(
  intoTrue.replace('{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,}', '{,i \\Od s_1,i \\Od s_2,}')
);
console.log('intoTrue->cancel id-value', j(intoTrue, cancel));
console.log('cancel==R', cancel === R);

// Micro id-value reverse
console.log(
  'micro',
  j(
    ensure(',i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,'),
    ensure(',i \\Od s_1,i \\Od s_2,')
  )
);

// From L directly: Pe in second Bb both arms — drop via derived when Od witnesses in sibling
console.log('L->R', j(L, R));

// Pe into first Bb from L without pulling out first — Pe already in second Bb
const peCopy = ensure(
  L.replace(
    '\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,}{,',
    '\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,}{,'
  )
);
console.log('L->peCopy into first true', j(L, peCopy));
