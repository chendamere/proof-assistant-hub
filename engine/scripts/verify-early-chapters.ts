/**
 * Verify proof-step transitions in the first two book chapters.
 * Usage: npx tsx engine/scripts/verify-early-chapters.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { exprToDAG } from '../src/dag';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { earlyRulePosition } from '../../src/data/rulePosition';

/** Book chapters to verify: Ch1–Ch4. */
const CHAPTERS = [
  'Rules_of_Operators',
  'Rules of Three Fundamental Relationships',
  'Theorems_of_Relationship_of_Node_Value_Comparison',
  'Theorems_of_Node_Null_Comparison',
];

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
  'Rules_of_Node_Continuity',
  'Rules_of_Relationship_of_Subnode',
  'Tree_Order_Induction',
  'Recursive_Function_Rc',
  'Rules_of_Number_Equal_Relationship',
  'Rules_of_Number_More_Less_Than',
  'Rules_of_Assign_Operator_Temp_Space',
  'Axioms_of_Assign_Operator',
  'Theorems_of_Insert_Node_Function',
  'Theorems_of_Delete_Node_Function',
  'Theorems_of_Assign_Operator',
  'Function_Cpo',
  'Recursive_Function_Rcpo',
  'Addition',
  'Recursive_Function_Rcpm',
  'Multiplication',
  'Paradox',
];

const axiomIds = new Set(axioms.map((r) => r.id));
const definitionIds = new Set(definitions.map((r) => r.id));

function getPositionForRule(rule: { id: string }): number {
  const early = earlyRulePosition(rule.id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axiomIds.has(rule.id) || definitionIds.has(rule.id)) return -1;
  const m = rule.id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const baseName = m[1];
  const index = parseInt(m[2], 10) + 1; // 0-based id → 1-based site/JSON number
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === baseName);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + index;
}

function getPositionForKey(key: string): number {
  const filename = key.split('::')[0] ?? '';
  const index = parseInt(key.split('::')[1] ?? '0', 10) || 0;
  const chapterIdx = CHAPTER_ORDER.indexOf(filename);
  if (chapterIdx < 0) return 999999999;
  return chapterIdx * 100000 + index;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tablePath = path.join(__dirname, '../../proof-steps-table.json');
const table = JSON.parse(fs.readFileSync(tablePath, 'utf8')) as Record<string, string[]>;

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
}));

let passed = 0;
let failed = 0;
let skipped = 0;

for (const [key, steps] of Object.entries(table)) {
  const filename = key.split('::')[0] ?? '';
  if (!CHAPTERS.includes(filename)) continue;
  if (!steps || steps.length < 2) {
    skipped++;
    continue;
  }
  const theoremPos = getPositionForKey(key);
  const prior = allRules.filter((r) => getPositionForRule(r) < theoremPos);
  const index = buildRuleIndex(prior);
  console.log(`\n=== ${key} (${steps.length - 1} steps, ${prior.length} prior rules) ===`);
  for (let i = 0; i < steps.length - 1; i++) {
    const left = steps[i]!;
    const right = steps[i + 1]!;
    if (normalizeSpacing(left) === normalizeSpacing(right)) {
      passed++;
      console.log(`  [PASS] step ${i} 0ms via spacing (same expression)`);
      continue;
    }
    const t0 = performance.now();
    const toTry = getRulesForTransition(index, left, right);
    let matchedId: string | undefined;
    let inference: string | undefined;
    let patternLeft: string | undefined;
    let patternRight: string | undefined;
    for (const rule of toTry) {
      const result = checkInferenceRules(left, right, rule.leftSide, rule.rightSide, { dagCache: index.dagCache });
      if (result.match) {
        matchedId = rule.id;
        inference = result.inferenceRule;
        patternLeft = result.matchPosition?.instantiatedPatternLeft ?? rule.leftSide;
        patternRight = result.matchPosition?.instantiatedPatternRight ?? rule.rightSide;
        break;
      }
    }
    const ms = performance.now() - t0;
    const hasPattern = Boolean(patternLeft?.trim() && patternRight?.trim());
    const tag = matchedId && hasPattern ? 'PASS' : 'FAIL';
    if (matchedId && hasPattern) passed++;
    else failed++;
    const hasTc = /\\Tc\b/.test(left) || /\\Tc\b/.test(right);
    const hasBranch = /\\B[lr]?[bs]/.test(left) || /\\B[lr]?[bs]/.test(right);
    console.log(
      `  [${tag}] step ${i} ${ms.toFixed(0)}ms rules=${toTry.length}` +
        `${hasTc ? ' Tc' : ''}${hasBranch ? ' branch' : ''}` +
        (matchedId ? ` via ${matchedId} (${inference})` : '')
    );
    if (patternLeft && patternRight) {
      console.log(`    pattern ${normalizeSpacing(patternLeft)} ⟺ ${normalizeSpacing(patternRight)}`);
    }
    if (!matchedId || !hasPattern) {
      console.log(`    L ${normalizeSpacing(left)}`);
      console.log(`    R ${normalizeSpacing(right)}`);
    }
  }
}

let parseFailures = 0;
for (const [key, steps] of Object.entries(table)) {
  const filename = key.split('::')[0] ?? '';
  if (!CHAPTERS.includes(filename)) continue;
  const ruleStr = key.split('::').slice(2).join('::');
  const sides = ruleStr.split(/\s*⟺\s*/);
  const exprs = [...sides, ...(steps ?? [])];
  for (const expr of exprs) {
    if (!expr.trim()) continue;
    try {
      exprToDAG(expr);
    } catch (err) {
      parseFailures++;
      console.log(`PARSE FAIL ${key}: ${err instanceof Error ? err.message : err}`);
      console.log(`  ${expr}`);
    }
  }
}

console.log(`\npassed=${passed} failed=${failed} theoremsWithoutSteps=${skipped} parseFailures=${parseFailures}`);
process.exit(failed > 0 || parseFailures > 0 ? 1 : 0);
