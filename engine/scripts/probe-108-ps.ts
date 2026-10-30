/** Probe 108 s17/s51: i1 Ps j1 ↔ i1 Ps j2 via identical-73. */
import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
  let t = normalizeSpacing(fromOperatorFirst(s)).replace(/R_\(/g, 'R\\_(').trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = 13 * 100000 + 108;
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  new Map()
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((x) => x.key.includes('::108::') && (x.step === 17 || x.step === 51));

for (const f of fails) {
  console.log('\n==== s' + f.step + ' ====');
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('direct', justify(L, R) ?? 'FAIL');
  // identical-73: i1 Ps j1, j1 Ps j2 → i1 Ps j1, i1 Ps j2
  const m1 = ensure(L.replace(',i_1 \\Ps j_1,', ',i_1 \\Ps j_1,i_1 \\Ps j_2,'));
  const m1b = ensure(L.replace(',i_1 \\Ps j_1,', ',i_1 \\Ps j_2,'));
  console.log('73-add', justify(L, m1) ?? 'FAIL');
  console.log('73-repl', justify(L, m1b) ?? 'FAIL');
  if (justify(L, m1)) {
    const m2 = ensure(m1.replace(',i_1 \\Ps j_1,i_1 \\Ps j_2,', ',i_1 \\Ps j_2,'));
    console.log('drop old', justify(m1, m2) ?? 'FAIL', m2 === R);
    if (m2 !== R) console.log('then', justify(m2, R) ?? 'FAIL');
  }
  // reverse for s51
  const m3 = ensure(L.replace(',i_1 \\Ps j_2,', ',i_1 \\Ps j_2,i_1 \\Ps j_1,'));
  console.log('rev-add', justify(L, m3) ?? 'FAIL');
}
