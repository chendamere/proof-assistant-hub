/**
 * Iterative chapter-16 fill loop (Rules_of_Relationship_of_Subnode):
 *   verify → solve → apply (exact anchors) → extract → record learnings → repeat
 *
 * Usage:
 *   npx tsx engine/scripts/iterate-ch16.ts
 *   npx tsx engine/scripts/iterate-ch16.ts --rounds=8
 *   npx tsx engine/scripts/iterate-ch16.ts --thm=9
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { armFactorStep, oneSiteToward, oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { normalizeSpacing } from '../src/inferenceRules/utils';

const CHAPTER = 'Rules_of_Relationship_of_Subnode';
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
];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const texPath = path.join(root, 'src/data/theorems/Rules_of_Relationship_of_Subnode.tex');
const outDir = path.join(__dirname, 'out');
const learningsPath = path.join(outDir, 'ch16-learnings.json');
const recheckPath = path.join(outDir, 'recheck-ch16.jsonl');

const roundsArg = process.argv.find((a) => a.startsWith('--rounds='));
const maxRounds = roundsArg ? parseInt(roundsArg.slice('--rounds='.length), 10) : 10;
const thmFilter = process.argv.find((a) => a.startsWith('--thm='))?.slice('--thm='.length);

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

function toBook(expr: string): string {
  return normalizeSpacing(
    fromOperatorFirst(expr)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
  );
}

function ensureComma(s: string): string {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

function dist(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

/** Position-aware order distance for duplicate-safe permutation progress. */
function orderDist(A: string[], B: string[]): number {
  const targetIdx = new Map<string, number[]>();
  for (let i = 0; i < B.length; i++) {
    const item = B[i]!;
    if (!targetIdx.has(item)) targetIdx.set(item, []);
    targetIdx.get(item)!.push(i);
  }
  const used = new Map<string, number>();
  let d = Math.abs(A.length - B.length) * 2;
  for (let i = 0; i < A.length; i++) {
    const item = A[i]!;
    const slots = targetIdx.get(item) ?? [];
    const k = used.get(item) ?? 0;
    const j = k < slots.length ? slots[k]! : B.length + k;
    used.set(item, k + 1);
    d += Math.abs(i - j);
  }
  return d;
}

function charDist(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

/** Token multiset + order distance — guides bubble/reorder toward goal. */
function tokenDist(a: string, b: string): number {
  const A = topItems(a);
  const B = topItems(b);
  const counts = new Map<string, number>();
  for (const t of A) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const t of B) counts.set(t, (counts.get(t) ?? 0) - 1);
  let d = 0;
  for (const v of counts.values()) d += Math.abs(v);
  if (d === 0) {
    const ord = orderDist(A, B);
    if (ord === 0 && ensureComma(a) !== ensureComma(b)) return charDist(a, b);
    return ord;
  }
  // Multiset differs: blend with charDist so drop/re-add paths stay visible.
  return d * 4 + Math.floor(charDist(a, b) / 8) + orderDist(A, B);
}

type Rule = { id: string; leftSide: string; rightSide: string; pos: number };
type Fail = { key: string; step: number; left: string; right: string };
type Learning = {
  rounds: Array<{
    round: number;
    passed: number;
    failed: number;
    inserted: number;
    complete: number;
    strategies: Record<string, number>;
  }>;
  successfulRules: Record<string, number>;
  gapKinds: Record<string, number>;
  notes: string[];
};

type Strategy = 'armFactor' | 'oneSite' | 'rewrite' | 'beam' | 'shrink' | 'direct';

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
  index = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    sharedDag
  );
  indexCache.set(pos, index);
  return index;
}

function justify(from: string, to: string, pos: number): Rule | null {
  const a = ensureComma(from);
  const b = ensureComma(to);
  if (a === b) return { id: 'spacing', leftSide: a, rightSide: b, pos: -1 };
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, a, b)) {
    if (
      checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match
    ) {
      return rule as Rule;
    }
  }
  return null;
}

const FILL_RE =
  /swap|identical|null-comparison|recursive-function|release|create-next|create-copy|copy-identical|thm-R|thm-Ps|operators-and-relationships|rules-of-operators|empty-branch|node-ring|node-connectivity|node-continuity|flag|equiv-code|error|create-id|thm-R_|bubble/i;

/** Prefer learned + early connectivity defs; FILL_RE otherwise. */
function fillRules(
  pos: number,
  learned?: Record<string, number>,
  preferInsideBranch = false
): Rule[] {
  const base = allRules.filter((r) => r.pos < pos && FILL_RE.test(r.id));
  return base.slice().sort((a, b) => {
    const la = learned?.[a.id] ?? 0;
    const lb = learned?.[b.id] ?? 0;
    if (lb !== la) return lb - la;
    if (preferInsideBranch) {
      const ia = /swap|identical|null-comparison|flag|Pu|nPu|same-operand/i.test(a.id) ? 1 : 0;
      const ib = /swap|identical|null-comparison|flag|Pu|nPu|same-operand/i.test(b.id) ? 1 : 0;
      if (ib !== ia) return ib - ia;
    }
    const ca = /node-connectivity-[0-5]-|node-continuity-[0-5]-/.test(a.id) ? 1 : 0;
    const cb = /node-connectivity-[0-5]-|node-continuity-[0-5]-/.test(b.id) ? 1 : 0;
    if (cb !== ca) return cb - ca;
    return a.pos - b.pos;
  });
}

/**
 * oneStepRewrites invents fresh copy names (t_1, t_2, …). The book often uses
 * m_1/n_1 for the same Oc slots. Rename cand's copy targets to match goal's
 * `src \Oc dst` pairs when src already appears in both, so connectivity expands
 * stay on the book's naming and remain checker-justified.
 */
function alignCopyNames(cand: string, goal: string, from: string): string {
  const re = /([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*)/g;
  const goalMap = new Map<string, string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(goal))) {
    if (!goalMap.has(m[1]!)) goalMap.set(m[1]!, m[2]!);
  }
  const fromNames = new Set(
    (from.match(/[A-Za-z][A-Za-z0-9_]*/g) ?? []).filter((n) => !/^(if|R)$/.test(n))
  );
  const replacements: Array<[string, string]> = [];
  const used = new Set<string>();
  re.lastIndex = 0;
  while ((m = re.exec(cand))) {
    const src = m[1]!;
    const temp = m[2]!;
    const want = goalMap.get(src);
    if (!want || want === temp || used.has(want)) continue;
    if (fromNames.has(temp)) continue; // not fresh
    // Only align invented copy temps (t_1) or underscored copies; never touch \Tc holes (c_*).
    if (/^c_/.test(temp) || /^c_/.test(want)) continue;
    if (!(/^t_\d+$/.test(temp) || /_\d+$/.test(temp))) continue;
    replacements.push([temp, want]);
    used.add(want);
  }
  let out = cand;
  for (const [temp, want] of replacements) {
    out = out.replace(new RegExp(`(?<![A-Za-z0-9_])${temp}(?![A-Za-z0-9_])`, 'g'), want);
  }
  return out;
}

/** Split top-level comma items, respecting brace depth. */
function topItems(expr: string): string[] {
  const e = ensureComma(expr);
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < e.length; i++) {
    const c = e[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const piece = e.slice(start, i).trim();
      if (piece) items.push(piece);
      start = i + 1;
    }
  }
  const tail = e.slice(start).trim();
  if (tail) items.push(tail);
  return items;
}

function joinItems(items: string[]): string {
  return ensureComma(',' + items.join(',') + ',');
}

/** Adjacent top-level swaps that move toward goal order (cheap bubble). */
function bubbleCandidates(expr: string, goal: string): string[] {
  const a = topItems(expr);
  const b = topItems(goal);
  if (a.length !== b.length || a.length < 2) return [];
  const target = b.join('\n');
  const sortedEq =
    a
      .slice()
      .sort()
      .join('\n') ===
    b
      .slice()
      .sort()
      .join('\n');
  if (!sortedEq) return [];
  const dist = (items: string[]) => {
    let d = 0;
    for (let i = 0; i < items.length; i++) if (items[i] !== b[i]) d++;
    return d;
  };
  const start = dist(a);
  const out: string[] = [];
  for (let i = 0; i < a.length - 1; i++) {
    if (a[i] === a[i + 1]) continue;
    const swapped = a.slice();
    const tmp = swapped[i]!;
    swapped[i] = swapped[i + 1]!;
    swapped[i + 1] = tmp;
    if (dist(swapped) < start) out.push(joinItems(swapped));
  }
  // Also try moving a goal-front item leftward by successive swaps if present.
  void target;
  return out;
}

function shrinkCandidates(expr: string): string[] {
  const out: string[] = [];
  const e = ensureComma(expr);
  const push = (s: string) => out.push(ensureComma(s));
  {
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\On,\1 \\Op(?=,)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(e))) push(e.slice(0, m.index) + ',' + e.slice(m.index + m[0].length));
  }
  {
    const n = e.replace(/R_\(/g, 'R\\_(');
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\Pu,R\\_\(\1\),/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(n))) push(n.slice(0, m.index) + `,${m[1]} \\Pu,` + n.slice(m.index + m[0].length));
  }
  {
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),\1 \\Ps \2,/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(e)))
      push(e.slice(0, m.index) + `,${m[1]} \\Oc ${m[2]},` + e.slice(m.index + m[0].length));
  }
  {
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),\1 \\Ps \2,/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(e)))
      push(e.slice(0, m.index) + `,${m[1]} \\Ps ${m[2]},` + e.slice(m.index + m[0].length));
  }
  // Identical-through-R: i Ps j, R(i), R(j), → …, i Ps j (duplicate after the R pair)
  {
    const re =
      /,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),R\(\1\),R\(\2\),/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(e))) {
      push(
        e.slice(0, m.index) +
          `,${m[1]} \\Ps ${m[2]},R(${m[1]}),R(${m[2]}),${m[1]} \\Ps ${m[2]},` +
          e.slice(m.index + m[0].length)
      );
    }
  }
  return out;
}

function neighbors(
  expr: string,
  goal: string,
  pos: number,
  mode: 'fast' | 'full' = 'fast',
  learned?: Record<string, number>
): Array<{ expr: string; via: string; strategy: Strategy }> {
  const out: Array<{ expr: string; via: string; strategy: Strategy }> = [];
  const seen = new Set<string>([ensureComma(expr)]);
  const add = (raw: string, via: string, strategy: Strategy) => {
    const e = ensureComma(raw);
    if (seen.has(e)) return;
    seen.add(e);
    out.push({ expr: e, via, strategy });
  };

  const fact = armFactorStep(expr, goal);
  if (fact) {
    const rule = justify(expr, fact, pos);
    if (rule) add(fact, rule.id, 'armFactor');
  }
  const site = oneSiteToward(expr, goal);
  if (site) {
    const rule = justify(expr, site, pos);
    if (rule) add(site, rule.id, 'oneSite');
  }
  for (const cand of shrinkCandidates(expr)) {
    const rule = justify(expr, cand, pos);
    if (rule) add(cand, rule.id, 'shrink');
  }
  // Prefer r-27 identical-through-R when goal has an extra trailing Ps after R(i),R(j).
  {
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),R\(\1\),R\(\2\),(?!\1 \\Ps)/g;
    let m: RegExpExecArray | null;
    const e0 = ensureComma(expr);
    while ((m = re.exec(e0))) {
      if (!goal.includes(`${m[1]} \\Ps ${m[2]},`) && !goal.includes(`R(${m[1]}),R(${m[2]}),${m[1]} \\Ps`))
        continue;
      const cand =
        e0.slice(0, m.index) +
        `,${m[1]} \\Ps ${m[2]},R(${m[1]}),R(${m[2]}),${m[1]} \\Ps ${m[2]},` +
        e0.slice(m.index + m[0].length);
      const rule = justify(expr, cand, pos);
      if (rule) add(cand, rule.id, 'shrink');
    }
  }
  for (const cand of bubbleCandidates(expr, goal)) {
    const rule = justify(expr, cand, pos);
    if (rule) add(cand, rule.id, 'oneSite');
  }
  // Flip Blb/Bb Ps condition (identical-7); helps right-operand identical subst via 72.
  {
    const re = /\\B(?:lb|b)\s*\{([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)\}/g;
    let m: RegExpExecArray | null;
    const e0 = ensureComma(expr);
    while ((m = re.exec(e0))) {
      const flipped =
        e0.slice(0, m.index) +
        m[0]!.replace(`${m[1]} \\Ps ${m[2]}`, `${m[2]} \\Ps ${m[1]}`) +
        e0.slice(m.index + m[0]!.length);
      const rule = justify(expr, flipped, pos);
      if (rule) add(flipped, rule.id, 'rewrite');
    }
  }
  // Fast path may still try a shortlist of rewrites when arm/site/shrink produced
  // nothing: expand/collapse, or same-multiset bubble/reorder (Oc/R swaps).
  const needRewrite =
    mode === 'full' ||
    (out.length === 0 &&
      ((expr.match(/\\Bb/g) || []).length !== (goal.match(/\\Bb/g) || []).length ||
        (expr.match(/\\Oc/g) || []).length !== (goal.match(/\\Oc/g) || []).length ||
        /\\Pc/.test(expr) !== /\\Pc/.test(goal) ||
        tokenDist(expr, goal) > 0));
  if (!needRewrite && mode === 'fast') return out;

  const startD = tokenDist(expr, goal);
  // Deeper rewrite budget when the gap is inside a branch (top-level tokens match).
  const insideBranch = topItems(expr).join('\n') === topItems(goal).join('\n') && expr !== goal;
  const rules = fillRules(pos, learned, insideBranch);
  const limit =
    mode === 'fast' ? Math.min(insideBranch ? 280 : 120, rules.length) : rules.length;
  for (let ri = 0; ri < limit; ri++) {
    const rule = rules[ri]!;
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(expr, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const raw of rewrites) {
      const variants = [ensureComma(raw)];
      const aligned = ensureComma(alignCopyNames(raw, goal, expr));
      if (aligned !== variants[0]) variants.push(aligned);
      for (const e of variants) {
        if (seen.has(e)) continue;
        const d = tokenDist(e, goal);
        if (e !== goal && d > startD + 8) continue;
        if (
          !checkInferenceRules(ensureComma(expr), e, rule.leftSide, rule.rightSide, {
            dagCache: indexBefore(pos).dagCache,
          }).match
        ) {
          continue;
        }
        add(e, rule.id, 'rewrite');
      }
    }
  }
  return out;
}

function solveOne(
  fail: Fail,
  opts: { fullBeam?: boolean; maxMs?: number; learned?: Record<string, number> } = {}
): { exprs: string[]; ruleIds: string[]; strategies: Strategy[]; complete: boolean } | null {
  const pos = getPositionForKey(fail.key);
  const goal = ensureComma(fail.right);
  const start = ensureComma(fail.left);
  const t0 = Date.now();
  const maxMs = opts.maxMs ?? 20_000;
  const timedOut = () => Date.now() - t0 > maxMs;
  const learned = opts.learned;

  if (start === goal) return { exprs: [], ruleIds: ['spacing'], strategies: ['direct'], complete: true };
  const direct = justify(start, goal, pos);
  if (direct) {
    return { exprs: [goal], ruleIds: [direct.id], strategies: ['direct'], complete: true };
  }

  let greedyPartial: {
    exprs: string[];
    ruleIds: string[];
    strategies: Strategy[];
    complete: boolean;
  } | null = null;

  // Greedy: armFactor / oneSite / shrink, plus expand rewrites when structure differs.
  {
    const exprs: string[] = [];
    const ruleIds: string[] = [];
    const strategies: Strategy[] = [];
    let cur = start;
    const seen = new Set([cur]);
    for (let n = 0; n < 28 && cur !== goal && !timedOut(); n++) {
      const nbs = neighbors(cur, goal, pos, 'fast', learned);
      nbs.sort((a, b) => tokenDist(a.expr, goal) - tokenDist(b.expr, goal));
      const curD = tokenDist(cur, goal);
      const curC = charDist(cur, goal);
      const pick = nbs.find((nb) => {
        if (seen.has(nb.expr)) return false;
        if (nb.expr === goal) return true;
        const d = tokenDist(nb.expr, goal);
        if (d < curD) return true;
        // Allow justified shrink when charDist falls even if multiset dist rises briefly
        // (drop a duplicate Ps that must be re-added after bubbling past R).
        if (nb.strategy === 'shrink' && charDist(nb.expr, goal) < curC) return true;
        return false;
      });
      if (!pick) break;
      exprs.push(pick.expr);
      ruleIds.push(pick.via);
      strategies.push(pick.strategy);
      seen.add(pick.expr);
      cur = pick.expr;
    }
    if (cur === goal) return { exprs, ruleIds, strategies, complete: true };
    if (exprs.length > 0 && tokenDist(cur, goal) < tokenDist(start, goal)) {
      greedyPartial = { exprs, ruleIds, strategies, complete: false };
      if (!opts.fullBeam) return greedyPartial;
    } else if (!opts.fullBeam) {
      return null;
    }
  }

  if (!opts.fullBeam || timedOut()) return greedyPartial;

  type Node = { expr: string; path: string[]; ids: string[]; strategies: Strategy[]; d: number };
  let beam: Node[] = [{ expr: start, path: [], ids: [], strategies: [], d: tokenDist(start, goal) }];
  const seen = new Set([start]);
  const maxDepth = 12;
  const beamWidth = 8;

  for (let depth = 0; depth < maxDepth && !timedOut(); depth++) {
    const next: Node[] = [];
    for (const node of beam) {
      const nbs = neighbors(node.expr, goal, pos, depth < 2 ? 'full' : 'fast', learned);
      nbs.sort((a, b) => tokenDist(a.expr, goal) - tokenDist(b.expr, goal));
      for (const nb of nbs.slice(0, 20)) {
        if (seen.has(nb.expr)) continue;
        const d = tokenDist(nb.expr, goal);
        if (nb.expr !== goal && d > node.d + 8) continue;
        seen.add(nb.expr);
        const path = [...node.path, nb.expr];
        const ids = [...node.ids, nb.via];
        const strategies = [...node.strategies, nb.strategy];
        if (nb.expr === goal) return { exprs: path, ruleIds: ids, strategies, complete: true };
        next.push({ expr: nb.expr, path, ids, strategies, d });
      }
    }
    if (next.length === 0) break;
    next.sort((a, b) => a.d - b.d || a.path.length - b.path.length);
    beam = next.slice(0, beamWidth);
  }

  const best = beam[0];
  if (best && best.path.length > 0 && best.d < tokenDist(start, goal)) {
    return { exprs: best.path, ruleIds: best.ids, strategies: best.strategies, complete: false };
  }
  return greedyPartial;
}

function classifyGap(fail: Fail): string {
  const L = fail.left;
  const R = fail.right;
  if (/\\Bb/.test(L) && /\\Bb/.test(R) && L.includes('\\Os') !== R.includes('\\Os')) return 'arm-os-factor';
  if (/\\Bb/.test(L) && tokenDist(L, R) < 20) return 'arm-local';
  if ((L.match(/\\Oc/g) || []).length !== (R.match(/\\Oc/g) || []).length) return 'oc-move';
  if ((L.match(/R\(/g) || []).length !== (R.match(/R\(/g) || []).length) return 'r-move';
  if (/\\Pu|\\nPu/.test(L) || /\\Pu|\\nPu/.test(R)) return 'null-flag';
  return 'reorder';
}

function bookBody(expr: string): string {
  let body = toBook(expr).trim();
  if (!body.startsWith(',')) body = ',' + body;
  if (!body.endsWith(',')) body = body + ',';
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}

function canonLine(s: string): string {
  return ensureComma(s.replace(/\\+\s*$/, '').replace(/^\s*(?:<\d+>\s*)*\\Rq\s*/, '').trim());
}

/** Join multi-line proof steps starting at \Rq into flat canon expressions. */
function parseProofSteps(lines: string[]): Array<{ start: number; end: number; canon: string; trail: string }> {
  const steps: Array<{ start: number; end: number; canon: string; trail: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\\Rq/.test(lines[i]!)) continue;
    let end = i;
    const trailMatch = lines[i]!.match(/(\\+)\s*$/);
    let trail = trailMatch ? trailMatch[1]! : '\\\\';
    while (end + 1 < lines.length) {
      const nxt = lines[end + 1]!;
      if (/\\Rq/.test(nxt)) break;
      if (/^\\bigskip|^\\end\{math\}|^proof:/i.test(nxt.trim())) break;
      if (!nxt.trim()) break;
      end++;
      const tm = nxt.match(/(\\+)\s*$/);
      if (tm) trail = tm[1]!;
    }
    const buf = lines
      .slice(i, end + 1)
      .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
      .join(' ');
    const canon = canonLine(buf);
    if (canon.length > 4) steps.push({ start: i, end, canon, trail });
    i = end;
  }
  return steps;
}

/** Canonical compare key: keep spaces that separate TeX commands from operands (\Tc c_1). */
function fingerprint(expr: string): string {
  return ensureComma(expr)
    .replace(/,\s+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyChains(
  solved: Array<Fail & { intermediates: string[]; complete: boolean }>
): number {
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const steps = parseProofSteps(lines);
  type Job = { afterLine: number; trail: string; intermediates: string[]; label: string };
  const jobs: Job[] = [];

  for (const item of solved) {
    if (!item.complete || item.intermediates.length === 0) continue;
    const want = fingerprint(item.left);
    let hit =
      steps.find((s) => fingerprint(s.canon) === want) ??
      steps.find(
        (s) =>
          s.canon.length > 30 &&
          (fingerprint(s.canon) === want ||
            want.startsWith(fingerprint(s.canon)) ||
            fingerprint(s.canon).startsWith(want.slice(0, Math.min(100, want.length))))
      );
    // Fallback: scan physical lines for a unique substring of the left.
    if (!hit) {
      const needle = want.slice(0, Math.min(60, want.length));
      for (let i = 0; i < lines.length; i++) {
        if (fingerprint(lines[i]!).includes(needle.slice(0, 40))) {
          // Extend to end of multi-line step
          let end = i;
          while (end + 1 < lines.length && !/\\Rq/.test(lines[end + 1]!) && lines[end + 1]!.trim()) {
            end++;
          }
          const trailMatch = lines[end]!.match(/(\\+)\s*$/);
          hit = {
            start: i,
            end,
            canon: want,
            trail: trailMatch ? trailMatch[1]! : '\\\\',
          };
          break;
        }
      }
    }
    if (!hit) {
      console.log('NO ANCHOR thm', item.key.split('::')[1], 'step', item.step);
      continue;
    }
    jobs.push({
      afterLine: hit.end,
      trail: hit.trail,
      intermediates: item.intermediates,
      label: `thm ${item.key.split('::')[1]} step ${item.step}`,
    });
  }

  jobs.sort((a, b) => b.afterLine - a.afterLine);
  const used = new Set<number>();
  let inserted = 0;
  for (const job of jobs) {
    if (used.has(job.afterLine)) continue;
    used.add(job.afterLine);
    const block = job.intermediates.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
    lines.splice(job.afterLine + 1, 0, ...block);
    inserted += job.intermediates.length;
    console.log('inserted', job.intermediates.length, 'after', job.label, 'line', job.afterLine + 1);
  }
  const payload = lines.join(nl) + (raw.endsWith('\n') ? nl : '');
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      fs.writeFileSync(texPath, payload);
      break;
    } catch (e) {
      if (attempt === 7) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250 * (attempt + 1));
    }
  }
  return inserted;
}

function verifySafe(): { passed: number; failed: number; fails: Fail[] } {
  let output = '';
  try {
    output = execSync(
      `npx --yes tsx engine/scripts/verify-all-chapters.ts --chapter=${CHAPTER} --out=${recheckPath}`,
      { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
    );
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string };
    output = (err.stdout || '') + (err.stderr || '');
  }
  const m = output.match(/passed=(\d+)\s+failed=(\d+)/);
  const passed = m ? parseInt(m[1]!, 10) : 0;
  const failed = m ? parseInt(m[2]!, 10) : -1;
  const rawFails: Fail[] = fs.existsSync(recheckPath)
    ? fs
        .readFileSync(recheckPath, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l))
    : [];
  // Deduplicate (stale appends / concurrent verifies can duplicate rows).
  const seen = new Set<string>();
  const fails: Fail[] = [];
  for (const f of rawFails) {
    const id = `${f.key}::${f.step}::${f.left}`;
    if (seen.has(id)) continue;
    seen.add(id);
    fails.push(f);
  }
  return { passed, failed: failed >= 0 ? failed : fails.length, fails };
}

function extract(): void {
  let lastErr: unknown;
  for (let i = 0; i < 5; i++) {
    try {
      execSync('node scripts/extract-proof-steps.js', {
        cwd: root,
        stdio: 'pipe',
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      });
      return;
    } catch (e) {
      lastErr = e;
      const waitUntil = Date.now() + 400 * (i + 1);
      while (Date.now() < waitUntil) {
        /* spin for Windows lock release */
      }
    }
  }
  throw lastErr;
}

function loadLearnings(): Learning {
  if (fs.existsSync(learningsPath)) {
    return JSON.parse(fs.readFileSync(learningsPath, 'utf8')) as Learning;
  }
  return { rounds: [], successfulRules: {}, gapKinds: {}, notes: [] };
}

function saveLearnings(L: Learning): void {
  fs.writeFileSync(learningsPath, JSON.stringify(L, null, 2));
}

// ---------- main loop ----------
fs.mkdirSync(outDir, { recursive: true });
const learnings = loadLearnings();
let prevFailed = Infinity;

for (let round = 1; round <= maxRounds; round++) {
  console.log(`\n======== ROUND ${round}/${maxRounds} ========`);
  const { passed, failed, fails: allFails } = verifySafe();
  let fails = allFails;
  if (thmFilter) fails = fails.filter((f) => f.key.includes(`::${thmFilter}::`));
  console.log(`verify passed=${passed} failed=${failed} targeting=${fails.length}`);

  if (failed === 0) {
    console.log('CHAPTER 15 CLEAR');
    learnings.notes.push(`Cleared at round ${round}`);
    saveLearnings(learnings);
    process.exit(0);
  }
  // Stall only when the previous round inserted nothing and fails did not fall.
  // Partials can temporarily raise fail count while shrinking individual gaps.
  const lastRound = learnings.rounds[learnings.rounds.length - 1];
  if (round > 1 && lastRound && lastRound.inserted === 0 && failed >= prevFailed) {
    console.log('No progress (flat/rising fails with zero inserts); stopping');
    learnings.notes.push(`Stalled at round ${round} with ${failed} fails`);
    saveLearnings(learnings);
    break;
  }
  if (failed > prevFailed) {
    console.log(`fail count rose ${prevFailed} → ${failed} (continuing; partials may split gaps)`);
  }
  prevFailed = Math.min(prevFailed, failed);

  const strategies: Record<string, number> = {};
  const solved: Array<Fail & { intermediates: string[]; complete: boolean; ruleIds: string[] }> = [];
  let open = 0;
  const stillOpen: Fail[] = [];
  // Process later steps first within a theorem so earlier inserts don't shift later anchors badly;
  // applyChains still inserts bottom-up by line number.
  const ordered = fails.slice().sort((a, b) => {
    const ta = parseInt(a.key.split('::')[1] ?? '0', 10);
    const tb = parseInt(b.key.split('::')[1] ?? '0', 10);
    if (ta !== tb) return ta - tb;
    return b.step - a.step;
  });
  for (let i = 0; i < ordered.length; i++) {
    const fail = ordered[i]!;
    const kind = classifyGap(fail);
    learnings.gapKinds[kind] = (learnings.gapKinds[kind] ?? 0) + 1;
    const chain = solveOne(fail, {
      fullBeam: false,
      maxMs: 12_000,
      learned: learnings.successfulRules,
    });
    if (!chain) {
      stillOpen.push(fail);
      continue;
    }
    for (const s of chain.strategies) strategies[s] = (strategies[s] ?? 0) + 1;
    for (const id of chain.ruleIds) {
      learnings.successfulRules[id] = (learnings.successfulRules[id] ?? 0) + 1;
    }
    const raw = chain.complete ? chain.exprs.slice(0, -1) : chain.exprs;
    // Cap partials so wandering shrink paths do not flood the TeX.
    const capped = chain.complete ? raw : raw.slice(0, 8);
    const intermediates = capped.map(toBook);
    solved.push({ ...fail, intermediates, complete: chain.complete, ruleIds: chain.ruleIds });
    console.log(
      `${chain.complete ? 'CHAIN' : 'PARTIAL'} ${i + 1}/${ordered.length} thm ${fail.key.split('::')[1]} step ${fail.step} +${intermediates.length}`
    );
  }
  // Second pass: limited full beam on remaining opens (budgeted).
  for (let i = 0; i < stillOpen.length; i++) {
    const fail = stillOpen[i]!;
    const chain = solveOne(fail, {
      fullBeam: true,
      maxMs: 30_000,
      learned: learnings.successfulRules,
    });
    if (!chain) {
      open++;
      console.log(`OPEN thm ${fail.key.split('::')[1]} step ${fail.step} (${classifyGap(fail)})`);
      continue;
    }
    for (const s of chain.strategies) strategies[s] = (strategies[s] ?? 0) + 1;
    for (const id of chain.ruleIds) {
      learnings.successfulRules[id] = (learnings.successfulRules[id] ?? 0) + 1;
    }
    const raw = chain.complete ? chain.exprs.slice(0, -1) : chain.exprs;
    const capped = chain.complete ? raw : raw.slice(0, 8);
    const intermediates = capped.map(toBook);
    solved.push({ ...fail, intermediates, complete: chain.complete, ruleIds: chain.ruleIds });
    console.log(
      `${chain.complete ? 'BEAM' : 'BEAM-PARTIAL'} thm ${fail.key.split('::')[1]} step ${fail.step} +${intermediates.length}`
    );
  }

  // Prefer complete chains. Partials only when they clearly shrink charDist (avoid
  // thm108-style oc-move wander that inserts forever and raises fail count).
  const applyable = solved.filter((s) => {
    if (s.intermediates.length === 0) return false;
    if (s.complete) return true;
    const last = ensureComma(s.intermediates[s.intermediates.length - 1]!);
    const start = charDist(ensureComma(s.left), ensureComma(s.right));
    const now = charDist(last, ensureComma(s.right));
    return now < start * 0.7 && s.intermediates.length <= 4;
  });
  fs.writeFileSync(path.join(outDir, 'ch16-chains.json'), JSON.stringify(solved, null, 2));
  const inserted = applyChains(applyable.map((s) => ({ ...s, complete: true })));
  const completeCount = solved.filter((s) => s.complete).length;
  console.log(
    `applied jobs=${applyable.length} complete=${completeCount} inserted=${inserted} open=${open}`
  );

  if (inserted === 0) {
    learnings.notes.push(
      `Round ${round}: no insertable chains (${open} open, ${solved.length} solved/partial)`
    );
    saveLearnings(learnings);
    if (applyable.length === 0) break;
  }

  extract();
  learnings.rounds.push({
    round,
    passed,
    failed,
    inserted,
    complete: completeCount,
    strategies,
  });
  saveLearnings(learnings);
}

const final = verifySafe();
console.log(`\nFINAL passed=${final.passed} failed=${final.failed}`);
process.exit(final.failed === 0 ? 0 : 1);
