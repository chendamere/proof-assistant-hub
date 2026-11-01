/**
 * Clear remaining ch16 fails: greedy reorder (incl. past Bb), push atoms into equal Bb arms,
 * Pc flip, Pb wrap+expand, create-copy collapse of Ot/Os / Od/Os.
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
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

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
const texPath = path.join(root, `src/data/theorems/${CHAPTER}.tex`);
const recheckPath = path.join(__dirname, 'out/recheck-ch16.jsonl');

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
function keyPos(key: string): number {
  return CHAPTER_ORDER.indexOf(key.split('::')[0]!) * 100000 + parseInt(key.split('::')[1]!, 10);
}
function toBook(expr: string) {
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

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const idxCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
const justMemo = new Map<string, string | null>();
function indexBefore(pos: number) {
  let i = idxCache.get(pos);
  if (i) return i;
  i = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    new Map()
  );
  idxCache.set(pos, i);
  return i;
}
function justify(from: string, to: string, pos: number): string | null {
  const a = ensure(from);
  const b = ensure(to);
  if (a === b) return 'spacing';
  const key = pos + '|' + a + '=>' + b;
  if (justMemo.has(key)) return justMemo.get(key)!;
  const index = indexBefore(pos);
  let hit: string | null = null;
  for (const rule of getRulesForTransition(index, a, b)) {
    if (checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
      hit = rule.id;
      break;
    }
  }
  justMemo.set(key, hit);
  return hit;
}
function chainOk(steps: string[], pos: number): boolean {
  for (let i = 0; i < steps.length - 1; i++) {
    if (!justify(steps[i]!, steps[i + 1]!, pos)) return false;
  }
  return true;
}
function topItems(e: string): string[] {
  const items: string[] = [];
  let d = 0,
    s = 0;
  const x = ensure(e);
  for (let i = 0; i < x.length; i++) {
    if (x[i] === '{') d++;
    else if (x[i] === '}') d--;
    else if (x[i] === ',' && d === 0) {
      const p = x.slice(s, i).trim();
      if (p) items.push(p);
      s = i + 1;
    }
  }
  const t = x.slice(s).trim();
  if (t) items.push(t);
  return items;
}
function joinItems(items: string[]) {
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

function greedyReorder(from: string, to: string, pos: number): string[] | null {
  let cur = ensure(from);
  const goal = ensure(to);
  const gItems = topItems(goal);
  const path: string[] = [];
  for (let step = 0; step < 50; step++) {
    if (fingerprint(cur) === fingerprint(goal)) return path;
    const a = topItems(cur);
    if (
      a
        .slice()
        .sort()
        .join('\n') !==
      gItems
        .slice()
        .sort()
        .join('\n')
    )
      return path.length && fingerprint(cur) === fingerprint(goal) ? path : path.length ? path : null;
    const startD = orderDist(a, gItems);
    let best: string | null = null;
    let bestD = startD;
    for (let i = 0; i < a.length - 1; i++) {
      if (a[i] === a[i + 1]) continue;
      const swapped = a.slice();
      const tmp = swapped[i]!;
      swapped[i] = swapped[i + 1]!;
      swapped[i + 1] = tmp;
      const cand = joinItems(swapped);
      const d = orderDist(swapped, gItems);
      if (d <= bestD && d < startD && justify(cur, cand, pos)) {
        bestD = d;
        best = cand;
      }
    }
    if (!best) return path.length ? path : null;
    path.push(best);
    cur = best;
  }
  return fingerprint(cur) === fingerprint(goal) ? path : null;
}

/** Push a sequence of top-level atoms into both Bb arms (identical-12/15/16 style). */
function tryPushIntoArms(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  const a = topItems(L);
  const b = topItems(R);
  // find Bb in both
  const iBbL = a.findIndex((t) => t.startsWith('\\Bb') || t.startsWith('\\Blb'));
  const iBbR = b.findIndex((t) => t.startsWith('\\Bb') || t.startsWith('\\Blb'));
  if (iBbL < 0 || iBbR < 0) return null;
  // atoms in L after Bb that disappear, appearing inside R's Bb arms
  const afterL = a.slice(iBbL + 1);
  if (!afterL.length) return null;
  // Try pushing each suffix atom into arms one at a time from the left of the suffix
  let cur = L;
  const path: string[] = [];
  for (let k = 0; k < afterL.length; k++) {
    if (fingerprint(cur) === fingerprint(R)) return path;
    const items = topItems(cur);
    const ib = items.findIndex((t) => t.startsWith('\\Bb') || t.startsWith('\\Blb'));
    if (ib < 0 || ib >= items.length - 1) break;
    const atom = items[ib + 1]!;
    // rebuild: remove atom after Bb, insert at front of both arms
    const bb = items[ib]!;
    const m = /^\\B(lb|b)\{([^}]*)\}\{,([\s\S]*)\}\{,([\s\S]*)\}$/.exec(bb);
    if (!m) break;
    const kind = m[1]!;
    const cond = m[2]!;
    const trueA = m[3]!;
    const falseA = m[4]!;
    if (trueA.includes(atom) && falseA.includes(atom)) {
      // already in; maybe reorder inside — skip
      break;
    }
    const newBb = `\\B${kind}{${cond}}{,${atom},${trueA}}{,${atom},${falseA}}`;
    const nextItems = items.slice(0, ib).concat([newBb], items.slice(ib + 2));
    const cand = joinItems(nextItems);
    if (!justify(cur, cand, pos)) {
      // try atom at end of arms instead
      const newBb2 = `\\B${kind}{${cond}}{,${trueA}${atom},}{,${falseA}${atom},}`;
      const cand2 = joinItems(items.slice(0, ib).concat([newBb2], items.slice(ib + 2)));
      if (!justify(cur, cand2, pos)) break;
      path.push(cand2);
      cur = cand2;
      continue;
    }
    path.push(cand);
    cur = cand;
  }
  if (fingerprint(cur) === fingerprint(R)) return path;
  const rest = greedyReorder(cur, R, pos);
  if (rest && fingerprint(rest[rest.length - 1] ?? cur) === fingerprint(R)) return [...path, ...rest];
  if (justify(cur, R, pos)) return [...path, R];
  return null;
}

function flipPc(expr: string): string | null {
  const re = /\\B(lb|b)\{([A-Za-z][A-Za-z0-9_]*) \\Pc ([A-Za-z][A-Za-z0-9_]*)\}/;
  const m = re.exec(expr);
  if (!m) return null;
  return expr.slice(0, m.index) + `\\B${m[1]}{${m[3]} \\Pc ${m[2]}}` + expr.slice(m.index + m[0].length);
}

function tryPcFlip(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  const f1r = flipPc(L);
  if (!f1r) return null;
  const f1 = ensure(f1r);
  if (!justify(L, f1, pos)) return null;
  if (fingerprint(f1) === fingerprint(R)) return [f1];
  if (justify(f1, R, pos)) return [f1, R];
  const rest = greedyReorder(f1, R, pos);
  if (rest && fingerprint(rest[rest.length - 1]!) === fingerprint(R)) return [f1, ...rest];
  const push = tryPushIntoArms(f1, R, pos);
  if (push && fingerprint(push[push.length - 1]!) === fingerprint(R)) return [f1, ...push];
  return null;
}

function tryPbExpand(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  const m = /^,i \\Pb ([A-Za-z][A-Za-z0-9_]*),$/.exec(L);
  if (!m) return null;
  const wrap = ensure(`,\\Bb{i \\Pb ${m[1]}}{,}{,\\Or,},`);
  if (!justify(L, wrap, pos)) return null;
  if (fingerprint(wrap) === fingerprint(R)) return [wrap];
  if (justify(wrap, R, pos)) return [wrap, R];
  return null;
}

/** Collapse Ot n + n Os (or Od n + n Os) from both arms via create-copy / release. */
function tryCollapseTempOs(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  // Heuristic: if R is shorter and L has Ot x, x Os in an arm
  if (L.length <= R.length) return null;
  // Try pulling Ot+Os or Od+Os from equal arms
  const reOt =
    /\\B(lb|b)\{([^}]*)\}\{,([^}]*\\Ot ([A-Za-z][A-Za-z0-9_]*),[^}]*\4 \\Os[^}]*)\}\{,([^}]*\\Ot \4,[^}]*\4 \\Os[^}]*)\}/;
  void reOt;
  // Simpler: if justify(L,R) after one known mid — try removing `\\Ot n,n \\Os` from both arms in one hop
  const stripped = L.replace(/\\Ot ([A-Za-z][A-Za-z0-9_]*),\1 \\Os,?/g, '').replace(
    /\\Od ([A-Za-z][A-Za-z0-9_]*),\1 \\Os,?/g,
    ''
  );
  if (stripped !== L && justify(L, ensure(stripped), pos)) {
    const mid = ensure(stripped);
    if (fingerprint(mid) === fingerprint(R)) return [mid];
    if (justify(mid, R, pos)) return [mid, R];
  }
  return null;
}

function solve(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  if (fingerprint(L) === fingerprint(R)) return [];
  if (justify(L, R, pos)) return [R];
  for (const p of [tryPbExpand, tryPcFlip, tryPushIntoArms, tryCollapseTempOs, greedyReorder]) {
    const path = p(L, R, pos);
    if (!path?.length) continue;
    const last = ensure(path[path.length - 1]!);
    if (fingerprint(last) === fingerprint(R) && chainOk([L, ...path], pos)) return path;
  }
  // combine: push then greedy
  const push = tryPushIntoArms(L, R, pos);
  if (push?.length) {
    const mid = ensure(push[push.length - 1]!);
    if (fingerprint(mid) !== fingerprint(R)) {
      const rest = greedyReorder(mid, R, pos);
      if (rest && fingerprint(rest[rest.length - 1]!) === fingerprint(R) && chainOk([L, ...push, ...rest], pos))
        return [...push, ...rest];
    }
  }
  return null;
}

function parseProofSteps(lines: string[]) {
  const steps: Array<{ start: number; end: number; canon: string; trail: string }> = [];
  let inMath = false;
  for (let i = 0; i < lines.length; i++) {
    if (/\\begin\{math\}/.test(lines[i]!)) {
      inMath = true;
      continue;
    }
    if (/\\end\{math\}/.test(lines[i]!)) {
      inMath = false;
      continue;
    }
    if (!inMath) continue;
    const isRq = /\\Rq/.test(lines[i]!);
    const isOpen = !isRq && /^\s*,/.test(lines[i]!) && /\\\\/.test(lines[i]!);
    if (!isRq && !isOpen) continue;
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
    const canon = ensure(buf.trim());
    if (canon.length > 2) steps.push({ start: i, end, canon, trail });
    i = end;
  }
  return steps;
}

function applyChains(solved: Array<{ left: string; intermediates: string[]; label: string }>) {
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const steps = parseProofSteps(lines);
  const jobs: Array<{ afterLine: number; trail: string; intermediates: string[]; label: string }> = [];
  for (const item of solved) {
    const want = fingerprint(item.left);
    const hits = steps.filter((s) => fingerprint(s.canon) === want);
    if (hits.length !== 1) {
      console.log('NO UNIQUE ANCHOR', item.label, hits.length);
      continue;
    }
    jobs.push({
      afterLine: hits[0]!.end,
      trail: hits[0]!.trail,
      intermediates: item.intermediates,
      label: item.label,
    });
  }
  jobs.sort((a, b) => b.afterLine - a.afterLine);
  const used = new Set<number>();
  let inserted = 0;
  for (const job of jobs) {
    if (used.has(job.afterLine)) continue;
    used.add(job.afterLine);
    lines.splice(
      job.afterLine + 1,
      0,
      ...job.intermediates.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`)
    );
    inserted += job.intermediates.length;
    console.log('inserted', job.intermediates.length, job.label);
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

const fails = fs
  .readFileSync(recheckPath, 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l) as { key: string; step: number; left: string; right: string });

const solved: Array<{ left: string; intermediates: string[]; label: string }> = [];
let open = 0;
for (const f of fails) {
  const thm = f.key.split('::')[1]!;
  const pos = keyPos(f.key);
  const path = solve(f.left, f.right, pos);
  if (!path) {
    console.log('OPEN', thm, 's' + f.step);
    open++;
    continue;
  }
  const mids = path.slice(0, -1);
  if (!mids.length) {
    console.log('DIRECT', thm, 's' + f.step);
    continue;
  }
  console.log('CHAIN', thm, 's' + f.step, '+' + mids.length);
  solved.push({ left: f.left, intermediates: mids.map(toBook), label: `thm ${thm} step ${f.step}` });
}
console.log('solved', solved.length, 'open', open);
const inserted = applyChains(solved);
console.log('inserted', inserted);
if (inserted > 0) {
  execSync('node scripts/extract-proof-steps.js', {
    cwd: root,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });
}
