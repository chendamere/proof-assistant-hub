/**
 * Deeper beam search for remaining Rules_of_Node_Connectivity gaps.
 * Usage:
 *   npx tsx engine/scripts/solve-ch14-rest.ts
 *   npx tsx engine/scripts/solve-ch14-rest.ts --apply
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { checkInferenceRules } from '../src/inferenceRules';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
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

const axiomIds = new Set(axioms.map((r) => r.id));
const definitionIds = new Set(definitions.map((r) => r.id));
const allRules = [...axioms, ...definitions, ...theorems];

function getPositionForRule(rule: { id: string }): number {
  const early = earlyRulePosition(rule.id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axiomIds.has(rule.id) || definitionIds.has(rule.id)) return -1;
  const m = rule.id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const baseName = m[1]!;
  const index = parseInt(m[2]!, 10) + 1;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === baseName);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + index;
}

function getPositionForKey(key: string): number {
  const filename = key.split('::')[0] ?? '';
  const index = parseInt(key.split('::')[1] ?? '0', 10) || 0;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + index;
}

function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 120) return 9999;
  const n = b.length;
  let prev = new Uint32Array(n + 1);
  let cur = new Uint32Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    const ca = a.charCodeAt(i - 1);
    for (let j = 1; j <= n; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + cost);
    }
    const swap = prev;
    prev = cur;
    cur = swap;
  }
  return prev[n]!;
}

type Rule = { id: string; leftSide: string; rightSide: string; pos: number };
type Fail = { key: string; step: number; left: string; right: string; rulesTried?: number };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes('--apply');
const fails: Fail[] = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l) as Fail)
  // skip placeholder pollution
  .filter((f) => !/<[0-9]+>/.test(f.left) && !/<[0-9]+>/.test(f.right));

const rulesByPos = allRules
  .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: getPositionForRule(r) }))
  .sort((a, b) => a.pos - b.pos);

function findChain(left: string, right: string, rules: Rule[]): { exprs: string[]; ruleIds: string[] } | null {
  const goal = normalizeSpacing(right);
  const start = normalizeSpacing(left);
  if (start === goal) return { exprs: [], ruleIds: [] };
  const startDist = lev(start, goal);
  if (startDist >= 9999) return null;
  const t0 = performance.now();
  type Node = { expr: string; exprs: string[]; ruleIds: string[]; dist: number };
  let beam: Node[] = [{ expr: start, exprs: [], ruleIds: [], dist: startDist }];
  const seen = new Set([start]);
  const DEPTH = 8;
  const BEAM = 40;
  const TIME = 8000;
  for (let depth = 0; depth < DEPTH && beam.length; depth++) {
    const next: Node[] = [];
    for (const state of beam) {
      if (performance.now() - t0 > TIME) break;
      const exprOps = new Set(state.expr.match(/\\[A-Za-z]+/g) ?? []);
      for (const rule of rules) {
        const ruleOps = (rule.leftSide + rule.rightSide).match(/\\[A-Za-z]+/g) ?? [];
        if (!ruleOps.some((op) => exprOps.has(op) || op === '\\Tc')) continue;
        // Prefer short non-Tc patterns for bubbling
        if (/\\Tc\b/.test(rule.leftSide) || /\\Tc\b/.test(rule.rightSide)) {
          if ((rule.leftSide + rule.rightSide).length > 120) continue;
        }
        let rewrites: string[];
        try {
          rewrites = oneStepRewrites(state.expr, rule.leftSide, rule.rightSide);
        } catch {
          continue;
        }
        for (const raw of rewrites) {
          const expr = normalizeSpacing(raw);
          if (seen.has(expr)) continue;
          seen.add(expr);
          const exprs = [...state.exprs, expr];
          const ruleIds = [...state.ruleIds, rule.id];
          if (expr === goal) return { exprs, ruleIds };
          const dist = lev(expr, goal);
          if (dist <= startDist + 80) next.push({ expr, exprs, ruleIds, dist });
        }
      }
    }
    next.sort((a, b) => a.dist - b.dist || a.exprs.length - b.exprs.length);
    beam = next.slice(0, BEAM);
  }
  return null;
}

function chainChecks(left: string, exprs: string[], ruleIds: string[], rules: Rule[]): boolean {
  let prev = normalizeSpacing(left);
  for (let i = 0; i < exprs.length; i++) {
    const rule = rules.find((r) => r.id === ruleIds[i]);
    if (!rule) return false;
    if (!checkInferenceRules(prev, exprs[i]!, rule.leftSide, rule.rightSide).match) return false;
    prev = exprs[i]!;
  }
  return true;
}

type Solved = Fail & { intermediates: string[]; ruleIds: string[] };
const solved: Solved[] = [];
const unsolved: Fail[] = [];

let n = 0;
for (const fail of fails) {
  n++;
  const pos = getPositionForKey(fail.key);
  const prior = rulesByPos.filter((r) => r.pos < pos);
  const chain = findChain(fail.left, fail.right, prior);
  const intermediates = chain ? chain.exprs.slice(0, -1) : [];
  const ok = chain != null && intermediates.length > 0 && chainChecks(fail.left, chain.exprs, chain.ruleIds, prior);
  if (ok && chain) {
    solved.push({ ...fail, intermediates, ruleIds: chain.ruleIds });
    console.log(
      `CHAIN ${n}/${fails.length} thm ${fail.key.split('::')[1]} step ${fail.step} +${intermediates.length} via ${chain.ruleIds.join(' | ')}`
    );
  } else {
    unsolved.push(fail);
    console.log(`OPEN ${n}/${fails.length} thm ${fail.key.split('::')[1]} step ${fail.step}`);
  }
}

fs.writeFileSync(path.join(__dirname, 'out/intermediate-chains.json'), JSON.stringify(solved, null, 2));
fs.writeFileSync(path.join(__dirname, 'out/unsolved-steps.json'), JSON.stringify(unsolved, null, 2));
console.log(`solved=${solved.length} unsolved=${unsolved.length}`);

if (!apply || solved.length === 0) process.exit(0);

// Reuse apply-ch14 logic by spawning the same insert path: write chains then call apply.
console.log('Run: npx tsx engine/scripts/apply-ch14.ts');
