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
console.log('L', L);
console.log('R', R);
console.log('direct', j(L, R));

// Pull Pe out
const peOut = ensure(
  L.replace(
    '\\Bb{s_1 \\Pu}{,s_1 \\Pe s_2,s_2 \\Os,s_1 \\Os,\\Tc c_1,}{,s_1 \\Pe s_2,\\Bb{s_2 \\Pu}',
    's_1 \\Pe s_2,\\Bb{s_1 \\Pu}{,s_2 \\Os,s_1 \\Os,\\Tc c_1,}{,\\Bb{s_2 \\Pu}'
  )
);
console.log('L->peOut', j(L, peOut));

// Drop Pe when next to something? Or Pe with dual Pu?
const drop = ensure(peOut.replace(',s_1 \\Pe s_2,', ','));
console.log('peOut->drop', j(peOut, drop));
console.log('drop==R', drop === R);

// Search rules that drop Pe
const dropPe = all.filter(
  (r) =>
    r.pos < pos &&
    r.leftSide.includes('\\Pe') &&
    !r.rightSide.includes('\\Pe') &&
    r.rightSide.length < r.leftSide.length + 20
);
console.log(
  'drop Pe rules',
  dropPe.slice(0, 20).map((r) => r.id + ' :: ' + r.leftSide.slice(0, 60) + ' => ' + r.rightSide.slice(0, 60))
);

// Pe with Ot cancel?
console.log('peOut has', peOut.includes('\\Ot'), peOut.includes('\\Od'));
