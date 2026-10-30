/**
 * Apply verified mid chains for remaining thm24 s3/s4/s8 plus any dry-complete
 * chains from chains-924200.json / live solve for 9,24,200.
 *
 * npx tsx engine/scripts/apply-924200-hard.ts [--dry]
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
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

const DRY = process.argv.includes('--dry');
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
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');
const failPath = path.join(__dirname, 'out/recheck-ch14.jsonl');

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
  );
}
function ensure(s: string) {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function fingerprint(expr: string): string {
  return ensure(stripDisplayIfConditions(expr))
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
    if (!targetIdx.has(B[i]!)) targetIdx.set(B[i]!, []);
    targetIdx.get(B[i]!)!.push(i);
  }
  const used = new Map<string, number>();
  let d = Math.abs(A.length - B.length) * 2;
  for (let i = 0; i < A.length; i++) {
    const slots = targetIdx.get(A[i]!) ?? [];
    const k = used.get(A[i]!) ?? 0;
    const j = k < slots.length ? slots[k]! : B.length + k;
    used.set(A[i]!, k + 1);
    d += Math.abs(i - j);
  }
  return d;
}
function multisetEq(A: string[], B: string[]): boolean {
  if (A.length !== B.length) return false;
  const c = new Map<string, number>();
  for (const x of A) c.set(x, (c.get(x) ?? 0) + 1);
  for (const x of B) c.set(x, (c.get(x) ?? 0) - 1);
  for (const v of c.values()) if (v) return false;
  return true;
}
function matchBrace(s: string, openIdx: number): number {
  let d = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '{') d++;
    else if (s[i] === '}') {
      d--;
      if (d === 0) return i;
    }
  }
  return -1;
}
function splitArm(arm: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < arm.length; i++) {
    const c = arm[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const piece = arm.slice(start, i).trim();
      if (piece) items.push(piece);
      start = i + 1;
    }
  }
  const tail = arm.slice(start).trim();
  if (tail) items.push(tail);
  return items;
}
function charDist(a: string, b: string) {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const indexCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
const dag = new Map();
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
function justify(a: string, b: string, pos: number): string | null {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (/error-code|equiv-code/.test(rule.id)) continue;
    if (/identical-4/.test(rule.id) && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

/** Pull leading equal atom from first matching Bb. */
function pullLeading(cur: string, pred: (atom: string) => boolean): string | null {
  let search = 0;
  while (search < cur.length) {
    const bb = cur.indexOf('\\Bb{', search);
    if (bb < 0) return null;
    const condOpen = bb + 3;
    const condClose = matchBrace(cur, condOpen);
    if (condClose < 0 || cur[condClose + 1] !== '{') {
      search = bb + 4;
      continue;
    }
    const tOpen = condClose + 1;
    const tClose = matchBrace(cur, tOpen);
    if (tClose < 0 || cur[tClose + 1] !== '{') {
      search = bb + 4;
      continue;
    }
    const fOpen = tClose + 1;
    const fClose = matchBrace(cur, fOpen);
    if (fClose < 0) return null;
    const tArm = cur.slice(tOpen + 1, tClose);
    const fArm = cur.slice(fOpen + 1, fClose);
    if (!tArm.startsWith(',') || !fArm.startsWith(',')) {
      search = fClose + 1;
      continue;
    }
    const tToks = splitArm(tArm.slice(1));
    const fToks = splitArm(fArm.slice(1));
    if (!tToks.length || tToks[0] !== fToks[0] || !pred(tToks[0]!)) {
      search = fClose + 1;
      continue;
    }
    const atom = tToks[0]!;
    const tOut = tToks.length === 1 ? ',' : ',' + tToks.slice(1).join(',') + ',';
    const fOut = fToks.length === 1 ? ',' : ',' + fToks.slice(1).join(',') + ',';
    return ensure(
      cur.slice(0, bb) +
        atom +
        ',' +
        `\\Bb{${cur.slice(condOpen + 1, condClose)}}{${tOut}}{${fOut}}` +
        cur.slice(fClose + 1)
    );
  }
  return null;
}

function bubbleTo(cur: string, goal: string, pos: number, max = 24): string[] | null {
  const goalE = ensure(goal);
  let curE = ensure(cur);
  if (fingerprint(curE) === fingerprint(goalE)) return [];
  const AR = topItems(goalE);
  if (!multisetEq(topItems(curE), AR)) return null;
  const path: string[] = [];
  for (let step = 0; step < max && fingerprint(curE) !== fingerprint(goalE); step++) {
    const items = topItems(curE);
    const startOd = orderDist(items, AR);
    let best: string | null = null;
    let bestOd = startOd;
    for (let i = 0; i < items.length - 1; i++) {
      const sw = items.slice();
      [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
      const od = orderDist(sw, AR);
      if (od >= bestOd) continue;
      const e = joinItems(sw);
      if (!justify(curE, e, pos)) continue;
      best = e;
      bestOd = od;
      if (od === 0) break;
    }
    if (!best) return null;
    path.push(best);
    curE = best;
  }
  return fingerprint(curE) === fingerprint(goalE) ? path : null;
}

function solvePullThenBubble(
  left: string,
  right: string,
  pos: number,
  pred: (a: string) => boolean,
  pulls: number
): { mids: string[]; ids: string[] } | null {
  const goal = ensure(stripDisplayIfConditions(right));
  let cur = ensure(stripDisplayIfConditions(left));
  const mids: string[] = [];
  const ids: string[] = [];
  for (let i = 0; i < pulls; i++) {
    const next = pullLeading(cur, pred);
    if (!next) {
      console.log('pull failed at', i);
      return null;
    }
    const id = justify(cur, next, pos);
    if (!id) {
      console.log('pull unjustified', next.slice(0, 120));
      return null;
    }
    mids.push(next);
    ids.push(id);
    cur = next;
  }
  // If Bb bodies still differ, goal may not be multiset-eq yet — for s3/s4 after both pulls, Bb should match goal's Bb
  if (fingerprint(cur) === fingerprint(goal)) {
    return { mids: mids.slice(0, -1), ids }; // last is goal
  }
  const bub = bubbleTo(cur, goal, pos);
  if (!bub) {
    console.log('bubble failed. cur', cur.slice(0, 160));
    console.log('goal', goal.slice(0, 160));
    console.log('cur items', topItems(cur).map((x) => x.slice(0, 40)));
    console.log('goal items', topItems(goal).map((x) => x.slice(0, 40)));
    return null;
  }
  for (const b of bub) {
    const id = justify(cur, b, pos);
    if (!id) return null;
    mids.push(b);
    ids.push(id);
    cur = b;
  }
  // strip goal from mids
  let out = mids;
  if (out.length && fingerprint(out[out.length - 1]!) === fingerprint(goal)) out = out.slice(0, -1);
  return fingerprint(cur) === fingerprint(goal) ? { mids: out, ids } : null;
}

/** Os reorder inside innermost Bb{i1 Ps j1} arms via successive single-site swaps. */
function solveOsReorder(left: string, right: string, pos: number): { mids: string[]; ids: string[] } | null {
  const goal = ensure(stripDisplayIfConditions(right));
  let cur = ensure(stripDisplayIfConditions(left));
  const mids: string[] = [];
  const ids: string[] = [];
  const goalOs = 'i_1 \\Os,j_1 \\Os,m_1 \\Os,n_1 \\Os';

  const armOsScore = (expr: string) => {
    let score = 0;
    const target = goalOs.split(',');
    let idx = 0;
    while (true) {
      const p = expr.indexOf('\\Bb{i_1 \\Ps j_1}', idx);
      if (p < 0) break;
      const condOpen = expr.indexOf('{', p);
      const condClose = matchBrace(expr, condOpen);
      const tOpen = condClose + 1;
      const tClose = matchBrace(expr, tOpen);
      const fOpen = tClose + 1;
      const fClose = matchBrace(expr, fOpen);
      for (const [o, c] of [
        [tOpen, tClose],
        [fOpen, fClose],
      ] as const) {
        const arm = expr.slice(o + 1, c);
        const toks = splitArm(arm.startsWith(',') ? arm.slice(1) : arm).filter((t) => /\\Os/.test(t));
        for (let i = 0; i < Math.min(toks.length, target.length); i++) {
          if (toks[i] === target[i]) score++;
          else score -= Math.abs(i - target.indexOf(toks[i]!));
        }
      }
      idx = fClose + 1;
    }
    return score;
  };

  for (let hop = 0; hop < 64 && fingerprint(cur) !== fingerprint(goal); hop++) {
    const startScore = armOsScore(cur);
    const startD = charDist(cur, goal);
    const rule = allRules.find((r) => r.id === 'swap-release-release' && r.pos < pos)!;
    const rw = oneStepRewrites(cur, rule.leftSide, rule.rightSide);
    let best: { e: string; d: number; s: number } | null = null;
    for (const raw of rw) {
      const e = ensure(raw);
      if (e === cur) continue;
      if (!checkInferenceRules(cur, e, rule.leftSide, rule.rightSide).match) continue;
      const s = armOsScore(e);
      const d = charDist(e, goal);
      if (s < startScore && d > startD) continue;
      if (s > startScore || (s === startScore && d < startD) || e === goal) {
        if (!best || s > best.s || (s === best.s && d < best.d)) best = { e, d, s };
      }
    }
    // also try single first-occurrence pattern swaps
    const patterns: Array<[string, string]> = [
      ['m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os', 'm_1 \\Os,i_1 \\Os,n_1 \\Os,j_1 \\Os'],
      ['m_1 \\Os,i_1 \\Os,n_1 \\Os,j_1 \\Os', 'i_1 \\Os,m_1 \\Os,n_1 \\Os,j_1 \\Os'],
      ['i_1 \\Os,m_1 \\Os,n_1 \\Os,j_1 \\Os', 'i_1 \\Os,m_1 \\Os,j_1 \\Os,n_1 \\Os'],
      ['i_1 \\Os,m_1 \\Os,j_1 \\Os,n_1 \\Os', 'i_1 \\Os,j_1 \\Os,m_1 \\Os,n_1 \\Os'],
      ['m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os', 'n_1 \\Os,m_1 \\Os,i_1 \\Os,j_1 \\Os'],
    ];
    for (const [a, b] of patterns) {
      if (!cur.includes(a)) continue;
      const e = ensure(cur.replace(a, b)); // one site
      if (e === cur) continue;
      const id = justify(cur, e, pos);
      if (!id) continue;
      const s = armOsScore(e);
      const d = charDist(e, goal);
      if (s > startScore || (s === startScore && d < startD) || fingerprint(e) === fingerprint(goal)) {
        if (!best || s > best.s || (s === best.s && d < best.d)) best = { e, d, s };
      }
    }

    if (!best) {
      console.log('os stuck', hop, 'score', startScore, 'd', startD);
      return null;
    }
    const id = justify(cur, best.e, pos);
    if (!id) return null;
    console.log('  os hop', hop, id, 'score', best.s, 'd', best.d);
    mids.push(best.e);
    ids.push(id);
    cur = best.e;
  }
  let out = mids;
  if (out.length && fingerprint(out[out.length - 1]!) === fingerprint(goal)) out = out.slice(0, -1);
  return fingerprint(cur) === fingerprint(goal) ? { mids: out, ids } : null;
}

// --- Load fails ---
type Fail = { key: string; step: number; left: string; right: string };
const fails: Fail[] = fs
  .readFileSync(failPath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((f: Fail) => /::(9|24|200)::/.test(f.key));

type Job = { thm: number; step: number; left: string; right: string; mids: string[]; ids: string[] };
const jobs: Job[] = [];

// Reuse auto-solved from previous dry chains if present
const prevPath = path.join(__dirname, 'out/chains-924200.json');
if (fs.existsSync(prevPath)) {
  const prev = JSON.parse(fs.readFileSync(prevPath, 'utf8')) as Array<{
    key: string;
    step: number;
    left: string;
    right: string;
    mids: string[];
    ids: string[];
    complete: boolean;
  }>;
  for (const p of prev) {
    if (!p.complete || !p.mids.length) continue;
    if ([3, 4, 8].includes(p.step) && p.key.includes('::24::')) continue; // redo hard ones
    jobs.push({
      thm: parseInt(p.key.split('::')[1]!, 10),
      step: p.step,
      left: p.left,
      right: p.right,
      mids: p.mids,
      ids: p.ids,
    });
  }
}

// Hard solves
{
  const f3 = fails.find((f) => f.key.includes('::24::') && f.step === 3)!;
  console.log('\n=== hard s3 ===');
  const s3 = solvePullThenBubble(f3.left, f3.right, 13 * 100000 + 24, (a) => /\\Oc /.test(a), 2);
  console.log(s3 ? `COMPLETE mids ${s3.mids.length}` : 'FAIL', s3?.ids);
  if (s3) jobs.push({ thm: 24, step: 3, left: f3.left, right: f3.right, ...s3 });
}
{
  const f4 = fails.find((f) => f.key.includes('::24::') && f.step === 4)!;
  console.log('\n=== hard s4 ===');
  const s4 = solvePullThenBubble(f4.left, f4.right, 13 * 100000 + 24, (a) => /^R\(/.test(a), 2);
  console.log(s4 ? `COMPLETE mids ${s4.mids.length}` : 'FAIL', s4?.ids);
  if (s4) jobs.push({ thm: 24, step: 4, left: f4.left, right: f4.right, ...s4 });
}
{
  const f8 = fails.find((f) => f.key.includes('::24::') && f.step === 8)!;
  console.log('\n=== hard s8 ===');
  const s8 = solveOsReorder(f8.left, f8.right, 13 * 100000 + 24);
  console.log(s8 ? `COMPLETE mids ${s8.mids.length}` : 'FAIL', s8?.ids);
  if (s8) jobs.push({ thm: 24, step: 8, left: f8.left, right: f8.right, ...s8 });
}

console.log('\njobs', jobs.map((j) => `${j.thm}s${j.step}:${j.mids.length}`).join(', '));
if (DRY) {
  console.log('dry-run');
  process.exit(0);
}

// Re-verify every hop before apply
for (const job of jobs) {
  const pos = 13 * 100000 + job.thm;
  let cur = ensure(stripDisplayIfConditions(job.left));
  const goal = ensure(stripDisplayIfConditions(job.right));
  for (let i = 0; i < job.mids.length; i++) {
    const next = ensure(job.mids[i]!);
    const id = justify(cur, next, pos);
    if (!id) {
      console.error('UNJUSTIFIED', job.thm, 's' + job.step, 'mid', i);
      process.exit(1);
    }
    cur = next;
  }
  if (!justify(cur, goal, pos) && fingerprint(cur) !== fingerprint(goal)) {
    console.error('FINAL GAP', job.thm, 's' + job.step);
    process.exit(1);
  }
}
console.log('all hops verified');

// Apply with re-read + next=R guard, descending line order per insert
for (const job of jobs.sort((a, b) => b.thm - a.thm || b.step - a.step)) {
  // re-read each time
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(job.left);
  const wantNext = fingerprint(job.right);
  let hitEnd = -1;
  let trail = '\\\\\\\\';
  for (let i = 0; i < lines.length; i++) {
    if (!/\\Rq/.test(lines[i]!)) continue;
    let end = i;
    while (end + 1 < lines.length) {
      const nxt = lines[end + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      end++;
    }
    const joined = fingerprint(
      lines
        .slice(i, end + 1)
        .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
        .join(' ')
    );
    if (joined !== want) continue;
    let j = end + 1;
    while (j < lines.length && !/\\Rq/.test(lines[j]!) && lines[j]!.trim()) j++;
    if (j >= lines.length || !/\\Rq/.test(lines[j]!)) {
      hitEnd = -2;
      break;
    }
    let nextEnd = j;
    while (nextEnd + 1 < lines.length) {
      const nxt = lines[nextEnd + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      nextEnd++;
    }
    const nextFp = fingerprint(
      lines
        .slice(j, nextEnd + 1)
        .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
        .join(' ')
    );
    if (nextFp !== wantNext) {
      // already filled?
      if (job.mids.length && fingerprint(job.mids[0]!) === nextFp) {
        console.log('already filled', job.thm, 's' + job.step);
        hitEnd = -4;
        break;
      }
      console.log('NEXT≠R', job.thm, 's' + job.step);
      hitEnd = -3;
      break;
    }
    hitEnd = end;
    const tm = lines[end]!.match(/(\\+)\s*$/);
    if (tm) trail = tm[1]!;
    break;
  }
  if (hitEnd === -4) continue;
  if (hitEnd < 0) {
    console.log('NO ANCHOR', job.thm, 's' + job.step, hitEnd);
    continue;
  }
  const block = job.mids.map((m) => `\\Rq${bookBody(m)}${trail}`);
  lines.splice(hitEnd + 1, 0, ...block);
  fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
  console.log('inserted', block.length, 'thm', job.thm, 's' + job.step, job.ids.join(', '));
}
console.log('done');
