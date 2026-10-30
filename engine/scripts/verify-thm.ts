/** Verify one theorem key; write fails to out/recheck-one.jsonl */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { checkInferenceRules } from '../src/inferenceRules';
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { earlyRulePosition } from '../../src/data/rulePosition';

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
const thmNum = process.argv.find((a) => a.startsWith('--thm='))?.slice(6) ?? '100';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const table = JSON.parse(fs.readFileSync(path.join(__dirname, '../../proof-steps-table.json'), 'utf8'));
const key = Object.keys(table).find(
  (k) => k.startsWith('Rules_of_Node_Connectivity::' + thmNum + '::')
);
if (!key) {
  console.error('no key', thmNum);
  process.exit(1);
}
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
const thmPos = CHAPTER_ORDER.indexOf('Rules_of_Node_Connectivity') * 100000 + parseInt(thmNum, 10);
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < thmPos),
  new Map()
);
const steps = table[key] as string[];
const fails: object[] = [];
let passed = 0;
for (let i = 0; i < steps.length - 1; i++) {
  const left = normalizeSpacing(steps[i]!);
  const right = normalizeSpacing(steps[i + 1]!);
  if (left === right) {
    passed++;
    continue;
  }
  let matched = false;
  let tried = 0;
  for (const rule of getRulesForTransition(index, left, right)) {
    tried++;
    if (checkInferenceRules(left, right, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
      matched = true;
      break;
    }
  }
  if (!matched && matchesDerivedBbTransition(left, right)) {
    matched = true;
    tried++;
  }
  if (matched) passed++;
  else {
    fails.push({ key, step: i, part: 'flat', rulesTried: tried, left, right });
    console.log('FAIL s' + i + ' rules=' + tried);
    console.log('  L', left);
    console.log('  R', right);
  }
}
const out = path.join(__dirname, 'out/recheck-one.jsonl');
fs.writeFileSync(out, fails.map((f) => JSON.stringify(f)).join('\n') + (fails.length ? '\n' : ''));
console.log('passed=' + passed + ' failed=' + fails.length + ' steps=' + steps.length + ' → ' + out);
