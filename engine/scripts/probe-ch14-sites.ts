/**
 * Diagnose one ch14 fail: try armFactor / oneSite / justify direct.
 * Usage: npx tsx engine/scripts/probe-ch14-sites.ts [failIndex]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { armFactorStep, oneSiteToward } from '../src/inferenceRules/tcSubstitution';
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
const axiomIds = new Set(axioms.map((r) => r.id));
const definitionIds = new Set(definitions.map((r) => r.id));
function posOf(rule: { id: string }): number {
  const early = earlyRulePosition(rule.id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axiomIds.has(rule.id) || definitionIds.has(rule.id)) return -1;
  const m = rule.id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + parseInt(m[2]!, 10) + 1;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const idx = parseInt(process.argv[2] ?? '0', 10);
const fail = fails[idx];
if (!fail) {
  console.log('no fail', idx, 'of', fails.length);
  process.exit(1);
}
console.log('thm', fail.key.split('::')[1], 'step', fail.step);
console.log('L', fail.left.slice(0, 160));
console.log('R', fail.right.slice(0, 160));

const fact = armFactorStep(fail.left, fail.right);
const site = oneSiteToward(fail.left, fail.right);
console.log('armFactor', fact ? fact.slice(0, 140) : null);
console.log('oneSite', site ? site.slice(0, 140) : null);

const thmPos =
  CHAPTER_ORDER.indexOf('Rules_of_Node_Connectivity') * 100000 +
  parseInt(fail.key.split('::')[1]!, 10);
const prior = [...axioms, ...definitions, ...theorems]
  .map((r) => ({ ...r, pos: posOf(r) }))
  .filter((r) => r.pos < thmPos);
const index = buildRuleIndex(prior, new Map());
const t0 = Date.now();
const candidates = getRulesForTransition(index, fail.left, fail.right);
console.log('candidates', candidates.length, 'in', Date.now() - t0, 'ms');
let hit: string | null = null;
const t1 = Date.now();
for (const rule of candidates) {
  if (checkInferenceRules(fail.left, fail.right, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
    hit = rule.id;
    break;
  }
}
console.log('direct', hit, 'scan', Date.now() - t1, 'ms');

if (fact) {
  let fHit: string | null = null;
  for (const rule of getRulesForTransition(index, fail.left, fact)) {
    if (checkInferenceRules(fail.left, fact, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
      fHit = rule.id;
      break;
    }
  }
  console.log('factor justified by', fHit);
}
