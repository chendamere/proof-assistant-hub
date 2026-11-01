/**
 * Hand patterns for remaining Rules_of_Relationship_of_Subnode fails.
 * - thm6 s0: wrap Pb → Bb{Pb}{}{Or} then subnode-0 expand
 * - Pc flip (connectivity-12) then drop-after-Or / other
 * - greedy reorder, flip72, push into arms via justify search
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
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, a, b)) {
    // allow error-release / error-code when hop shrinks after Or
    if (checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
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
  for (let step = 0; step < 40; step++) {
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
      return path.length ? path : null;
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
      if (d < bestD && justify(cur, cand, pos)) {
        bestD = d;
        best = cand;
      }
    }
    if (!best) return path.length ? path : null;
    path.push(best);
    cur = best;
  }
  return fingerprint(cur) === fingerprint(goal) ? path : path.length ? path : null;
}

/** Flip Pc in Bb/Blb conditions via connectivity-12. */
function flipPcCond(expr: string): string | null {
  const re = /\\B(lb|b)\s*\{([A-Za-z][A-Za-z0-9_]*) \\Pc ([A-Za-z][A-Za-z0-9_]*)\}/;
  const m = re.exec(expr);
  if (!m) return null;
  return (
    expr.slice(0, m.index) + `\\B${m[1]}{${m[3]} \\Pc ${m[2]}}` + expr.slice(m.index + m[0].length)
  );
}

function tryPcFlipThenRest(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  const f1raw = flipPcCond(L);
  if (!f1raw) return null;
  const f1 = ensure(f1raw);
  if (!justify(L, f1, pos)) return null;
  if (fingerprint(f1) === fingerprint(R)) return [f1];
  // drop atom after Or in a true-arm: `{,\Or, X,}` → `{,\Or,}`
  const dropOr = f1.replace(/\{,\\Or,([^}]*)\}/g, (full, rest: string) => {
    const wantRest = (() => {
      const rm = /\{,\\Or,([^}]*)\}/.exec(R);
      return rm ? rm[1] : '';
    })();
    if (rest.trim() && wantRest !== undefined && rest !== wantRest) {
      return `{,\\Or,${wantRest}}`;
    }
    return full;
  });
  if (dropOr !== f1 && justify(f1, dropOr, pos)) {
    if (fingerprint(dropOr) === fingerprint(R)) return [f1, ensure(dropOr)];
    const rest = greedyReorder(dropOr, R, pos);
    if (rest && fingerprint(rest[rest.length - 1]!) === fingerprint(R))
      return [f1, ensure(dropOr), ...rest];
  }
  // flip again toward R
  const f2raw = flipPcCond(f1);
  if (f2raw) {
    const f2 = ensure(f2raw);
    if (justify(f1, f2, pos) && fingerprint(f2) === fingerprint(R)) return [f1, f2];
  }
  const rest = greedyReorder(f1, R, pos);
  if (rest && fingerprint(rest[rest.length - 1]!) === fingerprint(R)) return [f1, ...rest];
  // direct justify any single edit of dropping after Or on f1 toward R
  if (justify(f1, R, pos)) return [f1, R];
  return null;
}

/** Wrap i Pb j → Bb then apply subnode-0 definition expand. */
function tryPbExpand(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  if (!/^,?i \\Pb [A-Za-z]/.test(L) && !/^,?i \\nPb /.test(L)) return null;
  const wrap = ensure(L.replace(/^,i \\Pb ([A-Za-z][A-Za-z0-9_]*),$/, ',\\Bb{i \\Pb $1}{,}{,\\Or,},'));
  if (wrap === L) return null;
  if (!justify(L, wrap, pos)) return null;
  if (fingerprint(wrap) === fingerprint(R)) return [wrap];
  if (justify(wrap, R, pos)) return [wrap, R];
  return null;
}

function solve(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  if (L === R) return [];
  if (justify(L, R, pos)) return [R];
  for (const p of [tryPbExpand, tryPcFlipThenRest, greedyReorder]) {
    const path = p(L, R, pos);
    if (!path || !path.length) continue;
    const last = ensure(path[path.length - 1]!);
    if (fingerprint(last) === fingerprint(R) && chainOk([L, ...path], pos)) return path;
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
    const isOpen =
      !isRq &&
      /^\s*,/.test(lines[i]!) &&
      /\\\\/.test(lines[i]!) &&
      !/\\bigskip/.test(lines[i]!);
    if (!isRq && !isOpen) continue;
    let end = i;
    const trailMatch = lines[i]!.match(/(\\+)\s*$/);
    let trail = trailMatch ? trailMatch[1]! : '\\\\';
    while (end + 1 < lines.length) {
      const nxt = lines[end + 1]!;
      if (/\\Rq/.test(nxt)) break;
      if (/^\\bigskip|^\\end\{math\}|^proof:/i.test(nxt.trim())) break;
      if (!nxt.trim()) break;
      // stop open-expr continuation at next open-looking line? keep joining until blank/Rq
      if (!isRq && /\\\\/.test(nxt) && /^\s*,/.test(nxt) && end > i) break;
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
    open++;
    continue;
  }
  const mids = path.slice(0, -1);
  console.log('CHAIN', thm, 's' + f.step, '+' + mids.length, path.map((_, i) => i).length);
  if (mids.length)
    solved.push({ left: f.left, intermediates: mids.map(toBook), label: `thm ${thm} step ${f.step}` });
  else console.log('  (direct, no insert)');
}
console.log('solved', fails.length - open, 'open', open);
const inserted = applyChains(solved);
console.log('inserted', inserted);
if (inserted > 0) {
  execSync('node scripts/extract-proof-steps.js', {
    cwd: root,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });
}
