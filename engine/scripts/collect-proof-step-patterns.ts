/**
 * Collect every pattern that verifies a proof-step transition, across all chapters.
 * Original \\Tc form is the pattern; instantiated form is recorded when holes are filled.
 *
 * Usage: npx tsx engine/scripts/collect-proof-step-patterns.ts
 * Writes proof-step-patterns.json at the repo root.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
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

type Use = {
  chapter: string;
  chapterIndex: number;
  theorem: number;
  step: number;
  inference?: string;
  instantiatedLeft?: string;
  instantiatedRight?: string;
  tcMapping?: Record<string, string[]>;
};

type PatternEntry = {
  id: string;
  left: string;
  right: string;
  pattern: string;
  hasTc: boolean;
  useCount: number;
  chapters: string[];
  uses: Use[];
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const tablePath = path.join(root, 'proof-steps-table.json');
const outPath = path.join(root, 'proof-step-patterns.json');

const table = JSON.parse(fs.readFileSync(tablePath, 'utf8')) as Record<string, string[]>;

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  position: getPositionForRule(r),
}));

const ruleById = new Map(allRules.map((r) => [r.id, r]));
console.log(`Indexing ${allRules.length} rules...`);
const index = buildRuleIndex(allRules);

const byPattern = new Map<string, PatternEntry>();
const unmatched: Array<{ chapter: string; theorem: number; step: number; left: string; right: string; error?: string }> = [];

let matched = 0;
let failed = 0;
let transitions = 0;

const keys = Object.keys(table).sort((a, b) => getPositionForKey(a) - getPositionForKey(b));
let lastChapter = '';

for (const key of keys) {
  const steps = table[key];
  if (!steps || steps.length < 2) continue;
  const chapter = key.split('::')[0] ?? '';
  const theorem = parseInt(key.split('::')[1] ?? '0', 10) || 0;
  const chapterIndex = CHAPTER_ORDER.indexOf(chapter) + 1;
  const theoremPos = getPositionForKey(key);
  if (chapter !== lastChapter) {
    console.log(`chapter ${chapterIndex || '?'} ${chapter}`);
    lastChapter = chapter;
  }

  for (let step = 0; step < steps.length - 1; step++) {
    const left = steps[step]!;
    const right = steps[step + 1]!;
    transitions++;
    let toTry: typeof allRules = [];
    try {
      toTry = getRulesForTransition(index, left, right)
        .map((r) => ruleById.get(r.id))
        .filter((r): r is (typeof allRules)[number] => r != null && r.position < theoremPos);
    } catch (err) {
      failed++;
      unmatched.push({
        chapter,
        theorem,
        step,
        left,
        right,
        error: err instanceof Error ? err.message : String(err),
      });
      continue;
    }

    let found = false;
    for (const rule of toTry) {
      let result: ReturnType<typeof checkInferenceRules>;
      try {
        result = checkInferenceRules(left, right, rule.leftSide, rule.rightSide, { dagCache: index.dagCache });
      } catch {
        continue;
      }
      if (!result.match) continue;
      const pos = result.matchPosition;
      const patternLeft = normalizeSpacing(rule.leftSide);
      const patternRight = normalizeSpacing(rule.rightSide);
      const patternKey = `${rule.id}\n${patternLeft}\n${patternRight}`;
      let entry = byPattern.get(patternKey);
      if (!entry) {
        entry = {
          id: rule.id,
          left: patternLeft,
          right: patternRight,
          pattern: `${patternLeft} ⟺ ${patternRight}`,
          hasTc: /\\Tc\b/.test(patternLeft) || /\\Tc\b/.test(patternRight),
          useCount: 0,
          chapters: [],
          uses: [],
        };
        byPattern.set(patternKey, entry);
      }
      entry.useCount++;
      if (!entry.chapters.includes(chapter)) entry.chapters.push(chapter);
      const instL = pos?.instantiatedPatternLeft ? normalizeSpacing(pos.instantiatedPatternLeft) : undefined;
      const instR = pos?.instantiatedPatternRight ? normalizeSpacing(pos.instantiatedPatternRight) : undefined;
      const use: Use = {
        chapter,
        chapterIndex: chapterIndex > 0 ? chapterIndex : 0,
        theorem,
        step,
        inference: result.inferenceRule,
      };
      if (instL && instR && (instL !== patternLeft || instR !== patternRight)) {
        use.instantiatedLeft = instL;
        use.instantiatedRight = instR;
      }
      if (pos?.tcMapping && Object.keys(pos.tcMapping).length > 0) use.tcMapping = pos.tcMapping;
      entry.uses.push(use);
      matched++;
      found = true;
      break;
    }
    if (!found) {
      failed++;
      unmatched.push({ chapter, theorem, step, left, right });
    }
  }
}

const patterns = [...byPattern.values()].sort((a, b) => b.useCount - a.useCount || a.id.localeCompare(b.id));

const doc = {
  description:
    'Patterns that verify proof-step transitions. `pattern` is the original rule, including \\Tc holes before substitution. `uses` lists each chapter/theorem/step. `instantiatedLeft/Right` appear only when \\Tc holes were filled.',
  summary: {
    chapters: CHAPTER_ORDER.length,
    transitions,
    matched,
    unmatched: failed,
    uniquePatterns: patterns.length,
    patternsWithTc: patterns.filter((p) => p.hasTc).length,
  },
  vocabulary: patterns.map((p, i) => ({
    token: `P${String(i + 1).padStart(4, '0')}`,
    id: p.id,
    hasTc: p.hasTc,
    useCount: p.useCount,
    pattern: p.pattern,
  })),
  patterns,
  unmatched,
};

fs.writeFileSync(outPath, JSON.stringify(doc, null, 2), 'utf8');
console.log(
  `wrote ${outPath}\nmatched=${matched} unmatched=${failed} unique=${patterns.length} transitions=${transitions}`
);
