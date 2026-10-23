/**
 * Verify every proof-step transition in book order.
 * Prints failures only. Writes engine/scripts/out/proof-step-failures.jsonl
 *
 * Usage: npx tsx engine/scripts/verify-all-chapters.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { exprToDAG } from '../src/dag';
import type { DAGStructure } from '../src/dag';
import type { ExprNodeData } from '../src/dag/types';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
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
  if (axiomIds.has(rule.id) || definitionIds.has(rule.id)) return -1;
  const m = rule.id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const baseName = m[1];
  const index = parseInt(m[2], 10) + 1;
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
const outArg = process.argv.find((a) => a.startsWith('--out='));
const chapterArg = process.argv.find((a) => a.startsWith('--chapter='));
const onlyChapter = chapterArg ? chapterArg.slice('--chapter='.length) : '';
const outDir = path.join(__dirname, 'out');
fs.mkdirSync(outDir, { recursive: true });
const failPath = outArg
  ? path.resolve(outArg.slice('--out='.length))
  : path.join(outDir, 'proof-step-failures.jsonl');
fs.writeFileSync(failPath, '');

const table = JSON.parse(fs.readFileSync(tablePath, 'utf8')) as Record<string, string[]>;
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
}));
const dagCache = new Map<string, DAGStructure<ExprNodeData>>();

const keys = Object.keys(table)
  .filter((k) => CHAPTER_ORDER.includes(k.split('::')[0] ?? ''))
  .filter((k) => !onlyChapter || (k.split('::')[0] ?? '') === onlyChapter)
  .sort((a, b) => getPositionForKey(a) - getPositionForKey(b));

let passed = 0;
let failed = 0;
let skipped = 0;
let currentChapter = '';
let chapterPassed = 0;
let chapterFailed = 0;
const tStart = performance.now();

for (const key of keys) {
  const filename = key.split('::')[0] ?? '';
  const steps = table[key] ?? [];
  if (filename !== currentChapter) {
    if (currentChapter) {
      console.log(
        `CHAPTER ${currentChapter} passed=${chapterPassed} failed=${chapterFailed} elapsed=${((performance.now() - tStart) / 1000).toFixed(0)}s`
      );
    }
    currentChapter = filename;
    chapterPassed = 0;
    chapterFailed = 0;
    console.log(`\n-- ${filename} --`);
  }
  if (steps.length < 2) {
    skipped++;
    continue;
  }
  const theoremPos = getPositionForKey(key);
  const prior = allRules.filter((r) => getPositionForRule(r) < theoremPos);
  const index = buildRuleIndex(prior, dagCache);
  for (let i = 0; i < steps.length - 1; i++) {
    const left = steps[i]!;
    const right = steps[i + 1]!;
    if (normalizeSpacing(left) === normalizeSpacing(right)) {
      passed++;
      chapterPassed++;
      continue;
    }
    const toTry = getRulesForTransition(index, left, right);
    let matched = false;
    for (const rule of toTry) {
      const result = checkInferenceRules(left, right, rule.leftSide, rule.rightSide, { dagCache: index.dagCache });
      if (result.match && (result.matchPosition?.instantiatedPatternLeft ?? rule.leftSide).trim()) {
        matched = true;
        break;
      }
    }
    if (matched) {
      passed++;
      chapterPassed++;
    } else {
      failed++;
      chapterFailed++;
      const rec = {
        key,
        step: i,
        rulesTried: toTry.length,
        left: normalizeSpacing(left),
        right: normalizeSpacing(right),
      };
      fs.appendFileSync(failPath, JSON.stringify(rec) + '\n');
      console.log(`FAIL ${key} step ${i} rules=${toTry.length}`);
      console.log(`  L ${rec.left}`);
      console.log(`  R ${rec.right}`);
    }
  }
}
if (currentChapter) {
  console.log(
    `CHAPTER ${currentChapter} passed=${chapterPassed} failed=${chapterFailed} elapsed=${((performance.now() - tStart) / 1000).toFixed(0)}s`
  );
}

let parseFailures = 0;
for (const key of keys) {
  const steps = table[key] ?? [];
  const ruleStr = key.split('::').slice(2).join('::');
  const exprs = [...ruleStr.split(/\s*⟺\s*/), ...steps];
  for (const expr of exprs) {
    if (!expr.trim()) continue;
    try {
      exprToDAG(expr);
    } catch (err) {
      parseFailures++;
      console.log(`PARSE FAIL ${key}: ${err instanceof Error ? err.message : err}`);
    }
  }
}

console.log(
  `\npassed=${passed} failed=${failed} theoremsWithoutSteps=${skipped} parseFailures=${parseFailures} elapsed=${((performance.now() - tStart) / 1000).toFixed(0)}s`
);
process.exit(failed > 0 || parseFailures > 0 ? 1 : 0);
