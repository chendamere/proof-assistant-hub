/**
 * Solve remaining ch14 fails with complete chains only (bubble + shrink + flip + rewrite).
 * Usage: npx tsx engine/scripts/solve-remaining-ch14.ts
 * Expects fresh engine/scripts/out/recheck-ch14.jsonl
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
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
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
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const texPath = path.join(root, 'src/data/theorems/Rules_of_Node_Connectivity.tex');

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
function ensure(s: string) {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function fingerprint(expr: string): string {
  return ensure(expr)
    .replace(/,\s+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}
function bookBody(expr: string): string {
  let body = toBook(expr).trim();
  if (!body.startsWith(',')) body = ',' + body;
  if (!body.endsWith(',')) body = body + ',';
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}
function topItems(expr: string): string[] {
  const e = ensure(expr);
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
  return ensure(',' + items.join(',') + ',');
}
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
    if (ord === 0 && ensure(a) !== ensure(b)) return charDist(a, b);
    return ord;
  }
  return d * 4 + Math.floor(charDist(a, b) / 8) + orderDist(A, B);
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const dag = new Map();
const indexCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let ix = indexCache.get(pos);
  if (ix) return ix;
  ix = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    dag
  );
  indexCache.set(pos, ix);
  return ix;
}
function justify(a: string, b: string, pos: number) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const FILL =
  /swap|identical|null-comparison|recursive-function|release|create|copy|thm-R|thm-Ps|operators|empty-branch|node-ring|node-connectivity|flag|equiv|error/i;

function candidates(cur: string, goal: string, pos: number): Array<{ e: string; id: string }> {
  const out: Array<{ e: string; id: string }> = [];
  const seen = new Set([ensure(cur)]);
  const add = (raw: string, id: string) => {
    const e = ensure(raw);
    if (seen.has(e)) return;
    seen.add(e);
    out.push({ e, id });
  };

  const arm = armFactorStep(cur, goal);
  if (arm) {
    const id = justify(cur, arm, pos);
    if (id) add(arm, id);
  }
  const site = oneSiteToward(cur, goal);
  if (site) {
    const id = justify(cur, site, pos);
    if (id) add(site, id);
  }

  // drop dup Ps
  {
    const next = cur.replace(
      /,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),\1 \\Ps \2,/,
      `,$1 \\Ps $2,`
    );
    if (next !== cur) {
      const id = justify(cur, next, pos);
      if (id) add(next, id);
    }
  }
  // r-27
  {
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),R\(\1\),R\(\2\),/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cur))) {
      const cand =
        cur.slice(0, m.index) +
        `,${m[1]} \\Ps ${m[2]},R(${m[1]}),R(${m[2]}),${m[1]} \\Ps ${m[2]},` +
        cur.slice(m.index + m[0].length);
      const id = justify(cur, cand, pos);
      if (id) add(cand, id);
    }
  }
  // condition flip
  {
    const re = /\\B(?:lb|b)\s*\{([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cur))) {
      const flipped =
        cur.slice(0, m.index) +
        m[0]!.replace(`${m[1]} \\Ps ${m[2]}`, `${m[2]} \\Ps ${m[1]}`) +
        cur.slice(m.index + m[0]!.length);
      const id = justify(cur, flipped, pos);
      if (id) add(flipped, id);
    }
  }
  // bubble
  {
    const a = topItems(cur);
    const b = topItems(goal);
    const start = orderDist(a, b);
    for (let i = 0; i < a.length - 1; i++) {
      const swapped = a.slice();
      const tmp = swapped[i]!;
      swapped[i] = swapped[i + 1]!;
      swapped[i + 1] = tmp;
      if (orderDist(swapped, b) >= start && topItems(cur).join('\n') === topItems(goal).join('\n'))
        continue;
      if (orderDist(swapped, b) > start) continue;
      const e = joinItems(swapped);
      const id = justify(cur, e, pos);
      if (id) add(e, id);
    }
  }
  // Prefer empty-branch → conditioned Bb when left has empty cond and goal does not.
  if (/\\Bb\{\}/.test(cur) && /\\Bb\{[^}]/.test(goal)) {
    for (const rule of allRules.filter((r) => r.pos < pos && /empty-branch/.test(r.id))) {
      let rewrites: string[];
      try {
        rewrites = oneStepRewrites(cur, rule.leftSide, rule.rightSide);
      } catch {
        continue;
      }
      for (const raw of rewrites) {
        const e = ensure(raw);
        if (
          checkInferenceRules(ensure(cur), e, rule.leftSide, rule.rightSide, {
            dagCache: indexBefore(pos).dagCache,
          }).match
        ) {
          add(e, rule.id);
        }
      }
    }
  }
  // limited rewrite
  const startD = tokenDist(cur, goal);
  const rules = allRules
    .filter((r) => r.pos < pos && FILL.test(r.id))
    .sort((a, b) => {
      const ea = /empty-branch|recursive-function-r-2[0-7]|identical-node-comparison-3[0-9]|identical-node-comparison-7[0-2]/.test(
        a.id
      )
        ? 1
        : 0;
      const eb = /empty-branch|recursive-function-r-2[0-7]|identical-node-comparison-3[0-9]|identical-node-comparison-7[0-2]/.test(
        b.id
      )
        ? 1
        : 0;
      return eb - ea;
    })
    .slice(0, 200);
  for (const rule of rules) {
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(cur, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const raw of rewrites) {
      const e = ensure(raw);
      if (seen.has(e)) continue;
      const d = tokenDist(e, goal);
      if (e !== goal && d > startD + 4) continue;
      if (!checkInferenceRules(ensure(cur), e, rule.leftSide, rule.rightSide, { dagCache: indexBefore(pos).dagCache }).match)
        continue;
      add(e, rule.id);
    }
  }
  return out;
}

function solve(L0: string, R0: string, pos: number, maxSteps = 20): string[] | null {
  const goal = ensure(R0);
  let cur = ensure(L0);
  if (cur === goal) return [];
  if (justify(cur, goal, pos)) return [goal];
  const path: string[] = [];
  const seen = new Set([cur]);
  for (let step = 0; step < maxSteps && cur !== goal; step++) {
    const nbs = candidates(cur, goal, pos);
    nbs.sort((a, b) => tokenDist(a.e, goal) - tokenDist(b.e, goal));
    const pick = nbs.find((nb) => !seen.has(nb.e) && (nb.e === goal || tokenDist(nb.e, goal) < tokenDist(cur, goal)));
    if (!pick) return null;
    path.push(pick.e);
    seen.add(pick.e);
    cur = pick.e;
  }
  return cur === goal ? path : null;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l) as { key: string; step: number; left: string; right: string });

type Job = { after: number; trail: string; mids: string[]; label: string };
const jobs: Job[] = [];

for (const f of fails) {
  const thm = parseInt(f.key.split('::')[1] ?? '0', 10);
  const pos = 13 * 100000 + thm;
  const t0 = Date.now();
  const path = solve(f.left, f.right, pos);
  const ms = Date.now() - t0;
  if (!path) {
    console.log('OPEN', thm, 's' + f.step, ms + 'ms');
    continue;
  }
  const mids = path[path.length - 1] === ensure(f.right) ? path.slice(0, -1) : path;
  if (mids.length === 0) {
    console.log('DIRECT', thm, 's' + f.step);
    continue;
  }
  console.log('CHAIN', thm, 's' + f.step, '+' + mids.length, ms + 'ms');
  const raw = fs.readFileSync(texPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(f.left);
  for (let i = 0; i < lines.length; i++) {
    if (!/\\Rq/.test(lines[i]!)) continue;
    let end = i;
    while (end + 1 < lines.length) {
      const nxt = lines[end + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      end++;
    }
    const joined = lines
      .slice(i, end + 1)
      .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
      .join(' ');
    if (fingerprint(joined) === want) {
      const tm = lines[end]!.match(/(\\+)\s*$/);
      jobs.push({
        after: end,
        trail: tm ? tm[1]! : '\\\\\\\\',
        mids,
        label: `thm ${thm} s${f.step}`,
      });
      break;
    }
  }
}

jobs.sort((a, b) => b.after - a.after);
const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const used = new Set<number>();
let inserted = 0;
for (const job of jobs) {
  if (used.has(job.after)) continue;
  used.add(job.after);
  const block = job.mids.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
  lines.splice(job.after + 1, 0, ...block);
  inserted += block.length;
  console.log('inserted', block.length, job.label, 'line', job.after + 1);
}
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('done inserted=' + inserted + ' chains=' + jobs.length);
