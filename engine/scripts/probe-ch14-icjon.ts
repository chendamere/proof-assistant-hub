import fs from 'fs';
import path from 'path';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';

const CHAPTER = 'Rules_of_Node_Connectivity';
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

const table = JSON.parse(fs.readFileSync('proof-steps-table.json', 'utf8')) as Record<string, string[]>;
const key = Object.keys(table).find(
  (k) =>
    k.startsWith(CHAPTER + '::') &&
    k.includes('i \\Pc j, i \\On') &&
    k.includes('i \\On, i \\Pc j')
)!;
console.log('KEY', key);
const steps = table[key]!;
console.log('nSteps', steps.length);
steps.forEach((s, i) => console.log(i, ensure(s).slice(0, 120)));

// Theorem book number from key
const thmNum = parseInt(key.split('::')[1]!, 10);
const theoremPos = CO.indexOf(CHAPTER) * 100000 + thmNum;
const all = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const prior = all.filter((r) => r.pos < theoremPos);
const index = buildRuleIndex(prior, new Map());

function justify(a: string, b: string): string | null {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'identity';
  if (matchesDerivedBbTransition(A, B)) return 'derived';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

console.log('\n--- transitions ---');
for (let i = 0; i < steps.length - 1; i++) {
  const id = justify(steps[i]!, steps[i + 1]!);
  console.log(`step ${i}->${i + 1}`, id ?? 'FAIL');
  if (!id) {
    console.log('  L', ensure(steps[i]!));
    console.log('  R', ensure(steps[i + 1]!));
  }
}
