/**
 * Fill chapter-14 gaps by chaining armFactor / oneSite / neighbor rewrites.
 * Usage:
 *   npx tsx engine/scripts/solve-ch14.ts
 *   npx tsx engine/scripts/solve-ch14.ts --apply
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
import { armFactorStep, oneSiteToward, oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
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

/** Book form: operator-first filler output must not land in TeX. */
function toBook(expr: string): string {
  return normalizeSpacing(
    expr
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
      .replace(/R_\(/g, 'R\\_(')
  );
}

function dist(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

type Rule = { id: string; leftSide: string; rightSide: string; pos: number };
type Fail = { key: string; step: number; left: string; right: string };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apply = process.argv.includes('--apply');
const fails: Fail[] = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const allRules: Rule[] = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: getPositionForRule(r),
}));

const sharedDag = new Map();
const indexCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let index = indexCache.get(pos);
  if (index) return index;
  const prior = allRules.filter((r) => r.pos < pos);
  index = buildRuleIndex(prior, sharedDag);
  indexCache.set(pos, index);
  return index;
}

function justify(
  from: string,
  to: string,
  pos: number
): { id: string; leftSide: string; rightSide: string } | null {
  if (normalizeSpacing(from) === normalizeSpacing(to)) return { id: 'spacing', leftSide: from, rightSide: to };
  const index = indexBefore(pos);
  const toTry = getRulesForTransition(index, from, to);
  for (const rule of toTry) {
    const result = checkInferenceRules(from, to, rule.leftSide, rule.rightSide, {
      dagCache: index.dagCache,
    });
    if (result.match) return rule;
  }
  return null;
}

const SWAPISH =
  /swap|release|identical|null-comparison|operators-and-relationships|recursive-function-r-|node-ring|Ps-symmetric|flag/i;

function rewriteCandidates(from: string, goal: string, pos: number, limit = 80): string[] {
  const index = indexBefore(pos);
  const prior = allRules.filter((r) => r.pos < pos && SWAPISH.test(r.id));
  const startDist = dist(from, goal);
  const out: Array<{ expr: string; d: number }> = [];
  const seen = new Set([from]);
  for (const rule of prior) {
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(from, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const expr of rewrites) {
      if (seen.has(expr)) continue;
      seen.add(expr);
      const d = dist(expr, goal);
      if (d < startDist || expr === goal) out.push({ expr, d });
    }
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, limit).map((x) => x.expr);
}

function solveOne(fail: Fail): { exprs: string[]; ruleIds: string[]; complete: boolean } | null {
  const pos = getPositionForKey(fail.key);
  const goal = normalizeSpacing(fail.right);
  let cur = normalizeSpacing(fail.left);
  const exprs: string[] = [];
  const ruleIds: string[] = [];
  const startDist = dist(cur, goal);
  const seen = new Set<string>([cur]);
  for (let n = 0; n < 24 && cur !== goal; n++) {
    const options: string[] = [];
    const fact = armFactorStep(cur, goal);
    const site = oneSiteToward(cur, goal);
    if (fact) options.push(normalizeSpacing(fact));
    if (site && !options.includes(normalizeSpacing(site))) options.push(normalizeSpacing(site));

    let chosen: { expr: string; id: string } | null = null;
    for (const mid of options) {
      if (mid === cur || seen.has(mid)) continue;
      const rule = justify(cur, mid, pos);
      if (!rule) continue;
      chosen = { expr: mid, id: rule.id };
      break;
    }

    if (!chosen) {
      for (const mid of rewriteCandidates(cur, goal, pos, 40)) {
        if (mid === cur || seen.has(mid)) continue;
        if (mid !== goal && dist(mid, goal) >= dist(cur, goal)) continue;
        const rule = justify(cur, mid, pos);
        if (!rule) continue;
        chosen = { expr: mid, id: rule.id };
        break;
      }
    }

    if (!chosen) {
      const goalRule = justify(cur, goal, pos);
      if (goalRule) {
        exprs.push(goal);
        ruleIds.push(goalRule.id);
        cur = goal;
        break;
      }
      break;
    }
    exprs.push(chosen.expr);
    ruleIds.push(chosen.id);
    seen.add(chosen.expr);
    cur = chosen.expr;
  }
  if (exprs.length === 0) return null;
  if (cur !== goal && dist(cur, goal) >= startDist) return null;
  // Drop runaway partials that barely move the needle.
  if (cur !== goal && exprs.length > 12) return null;
  return { exprs, ruleIds, complete: cur === goal };
}

type Solved = Fail & { intermediates: string[]; ruleIds: string[]; complete: boolean };
const solved: Solved[] = [];
const unsolved: Fail[] = [];

let n = 0;
for (const fail of fails) {
  n++;
  const chain = solveOne(fail);
  if (!chain) {
    unsolved.push(fail);
    console.log(`OPEN ${n}/${fails.length} thm ${fail.key.split('::')[1]} step ${fail.step}`);
    continue;
  }
  // If complete, drop the final expression (already the stored right side).
  // If partial, keep every justified hop as an insert before the remaining gap.
  const raw = chain.complete ? chain.exprs.slice(0, -1) : chain.exprs;
  const intermediates = raw.map(toBook);
  if (intermediates.length === 0) {
    solved.push({ ...fail, intermediates: [], ruleIds: chain.ruleIds, complete: true });
    console.log(`DIRECT ${n}/${fails.length} thm ${fail.key.split('::')[1]} step ${fail.step} via ${chain.ruleIds[0]}`);
    continue;
  }
  solved.push({ ...fail, intermediates, ruleIds: chain.ruleIds, complete: chain.complete });
  console.log(
    `${chain.complete ? 'CHAIN' : 'PARTIAL'} ${n}/${fails.length} thm ${fail.key.split('::')[1]} step ${fail.step} +${intermediates.length} via ${chain.ruleIds.join(' | ')}`
  );
}

fs.writeFileSync(path.join(__dirname, 'out/ch14-chains.json'), JSON.stringify(solved, null, 2));
fs.writeFileSync(path.join(__dirname, 'out/ch14-unsolved.json'), JSON.stringify(unsolved, null, 2));
console.log(`solved=${solved.length} unsolved=${unsolved.length} apply=${apply}`);

if (!apply) process.exit(unsolved.length > 0 ? 1 : 0);

const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');
const rawTex = fs.readFileSync(texPath, 'utf8');
const nl = rawTex.includes('\r\n') ? '\r\n' : '\n';
const lines = rawTex.split(/\r?\n/);

function canonLine(s: string): string {
  return normalizeSpacing(toBook(s.replace(/\\+\s*$/, '').replace(/^\s*\\Rq\s*/, '').trim()));
}

function bookBody(expr: string): string {
  let body = toBook(expr).trim();
  if (!body.startsWith(',')) body = ',' + body;
  if (!body.endsWith(',')) body = body + ',';
  // Proof lines use a space after commas for readability where the book does.
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}

type Job = { lineNo: number; trail: string; intermediates: string[]; label: string };
const jobs: Job[] = [];

for (const item of solved) {
  if (item.intermediates.length === 0) continue;
  const want = canonLine(item.left);
  let lineNo = -1;
  for (let i = 0; i < lines.length; i++) {
    const c = canonLine(lines[i]!);
    if (!c || c.length < 8) continue;
    if (c === want) {
      lineNo = i;
      break;
    }
  }
  if (lineNo < 0) {
    // Soft match: line canon is a prefix/suffix of want or vice versa (wrapped lines).
    for (let i = 0; i < lines.length; i++) {
      const c = canonLine(lines[i]!);
      if (c.length < 40) continue;
      if (want.includes(c) || c.includes(want.slice(0, Math.min(80, want.length)))) {
        lineNo = i;
        break;
      }
    }
  }
  if (lineNo < 0) {
    console.log('NO ANCHOR thm', item.key.split('::')[1], 'step', item.step);
    continue;
  }
  const trailMatch = lines[lineNo]!.match(/(\\+)\s*$/);
  const trail = trailMatch ? trailMatch[1]! : '\\\\';
  jobs.push({
    lineNo,
    trail,
    intermediates: item.intermediates,
    label: `thm ${item.key.split('::')[1]} step ${item.step}`,
  });
}

jobs.sort((a, b) => b.lineNo - a.lineNo);
let inserted = 0;
for (const job of jobs) {
  const block = job.intermediates.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
  lines.splice(job.lineNo + 1, 0, ...block);
  inserted += job.intermediates.length;
  console.log('inserted', job.intermediates.length, 'at', job.label, 'line', job.lineNo + 1);
}

fs.writeFileSync(texPath, lines.join(nl) + (rawTex.endsWith('\n') ? nl : ''));
console.log(`wrote tex insertions=${inserted}`);
