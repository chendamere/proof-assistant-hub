/**
 * Export every pattern available to proof-step verification, grouped by chapter.
 * Canonical form strips display-only if(...) branch conditions.
 * \\Pu / \\nPu are recorded as unary (the operand points to null).
 *
 * Usage: npx tsx engine/scripts/export-proof-patterns.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { normalizeOperands } from '../src/operandNormalizer';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

function chapterOfId(id: string): { filename: string; index: number } | null {
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return null;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  if (!filename) return null;
  return { filename, index: parseInt(m[2], 10) + 1 };
}

function canonical(expr: string): string {
  return normalizeSpacing(expr);
}

function tokenForm(expr: string): string {
  try {
    return normalizeOperands(canonical(expr)).integerExpression;
  } catch {
    return canonical(expr);
  }
}

function operatorsIn(expr: string): string[] {
  const found = new Set<string>();
  for (const m of expr.matchAll(/\\[A-Za-z]+|\\times|\+/g)) found.add(m[0] === '+' ? '\\+' : m[0]);
  return [...found];
}

type PatternRecord = {
  id: string;
  name: string;
  type: string;
  chapter: string;
  chapterIndex: number;
  theoremIndex: number | null;
  section?: string;
  subsection?: string;
  left: string;
  right: string;
  leftTokens: string;
  rightTokens: string;
  operators: string[];
  proofSteps: string[];
};

const table = JSON.parse(fs.readFileSync(path.join(root, 'proof-steps-table.json'), 'utf8')) as Record<string, string[]>;

const stepsByChapterIndex = new Map<string, string[]>();
for (const [key, steps] of Object.entries(table)) {
  const filename = key.split('::')[0] ?? '';
  const index = key.split('::')[1] ?? '';
  stepsByChapterIndex.set(`${filename}::${index}`, (steps ?? []).map(canonical));
}

const records: PatternRecord[] = [];

function pushRule(rule: {
  id: string;
  name: string;
  type: string;
  leftSide: string;
  rightSide: string;
  section?: string;
  subsection?: string;
}, fallbackChapter: string, fallbackIndex: number) {
  const located = chapterOfId(rule.id);
  const chapter = located?.filename ?? fallbackChapter;
  const chapterIndex = located ? CHAPTER_ORDER.indexOf(located.filename) + 1 : fallbackIndex;
  const theoremIndex = located?.index ?? null;
  const left = canonical(rule.leftSide);
  const right = canonical(rule.rightSide);
  const proofSteps =
    located != null ? stepsByChapterIndex.get(`${located.filename}::${located.index}`) ?? [] : [];
  records.push({
    id: rule.id,
    name: rule.name,
    type: rule.type,
    chapter,
    chapterIndex,
    theoremIndex,
    section: rule.section,
    subsection: rule.subsection,
    left,
    right,
    leftTokens: tokenForm(left),
    rightTokens: tokenForm(right),
    operators: operatorsIn(`${left} ${right}`),
    proofSteps,
  });
}

for (const rule of axioms) pushRule(rule, 'Axioms', 0);
for (const rule of definitions) pushRule(rule, 'Definitions', 0);
for (const rule of theorems) pushRule(rule, 'Unfiled', 999);

records.sort((a, b) => a.chapterIndex - b.chapterIndex || (a.theoremIndex ?? 0) - (b.theoremIndex ?? 0) || a.id.localeCompare(b.id));

const byChapter: Record<string, PatternRecord[]> = {};
for (const rec of records) {
  const key = rec.chapterIndex > 0 && rec.chapterIndex < 999 ? `${rec.chapterIndex}. ${rec.chapter}` : rec.chapter;
  (byChapter[key] ??= []).push(rec);
}

const doc = {
  description:
    'Patterns available to proof-step verification, one entry per axiom, definition, and theorem. left/right are the original pattern (\\Tc holes kept). leftTokens/rightTokens number operands by first appearance for matching and future tokenization. proofSteps are the extracted book steps for that theorem, when any exist.',
  evaluationNotes: {
    '\\Pu': 'Unary, same family as \\Pe. The single operand points to null. \\nPu is its negation.',
    'if(...)':
      'Display-only wrapper on a branch condition (\\Bb, \\Bs, \\Blb, \\Bls). Removed before evaluation, so \\Bb{if(i \\Pe j)} is the same pattern as \\Bb{i \\Pe j}.',
    '\\Bs': 'Same as \\Bb.',
    '\\Bls': 'Same as \\Blb.',
    '\\Pe': 'Same relation as \\Oe. \\Oe may be rewritten to \\Pe by a rule; matching treats them as interchangeable.',
  },
  patternCount: records.length,
  chapters: byChapter,
};

const outPath = path.join(root, 'proof-step-patterns.json');
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2), 'utf8');
console.log(`Wrote ${records.length} patterns to ${outPath}`);
