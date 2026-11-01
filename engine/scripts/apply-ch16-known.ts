/**
 * Apply known justified chains for ch16 remaining fails.
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
    if (checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}
function chainOk(steps: string[], pos: number): boolean {
  for (let i = 0; i < steps.length - 1; i++) {
    if (!justify(steps[i]!, steps[i + 1]!, pos)) {
      console.log('fail hop', i, justify(steps[i]!, steps[i + 1]!, pos));
      return false;
    }
  }
  return true;
}

function tops(e: string): string[] {
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
function join(items: string[]) {
  return ensure(',' + items.join(',') + ',');
}

/** Bubble atoms left to sit just after Bb, then code-dist into arms if justified. */
function tryCodeDistPush(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  const a = tops(L);
  const b = tops(R);
  const iBb = a.findIndex((t) => t.startsWith('\\Bb') || t.startsWith('\\Blb'));
  if (iBb < 0) return null;
  // suffix after Bb that is missing as top-level in R
  const suffix = a.slice(iBb + 1);
  const rSet = new Map<string, number>();
  for (const t of b) rSet.set(t, (rSet.get(t) ?? 0) + 1);
  for (const t of a.slice(0, iBb + 1)) rSet.set(t, (rSet.get(t) ?? 0) - 1);
  const toPush = suffix.filter((t) => {
    const c = rSet.get(t) ?? 0;
    if (c > 0) {
      rSet.set(t, c - 1);
      return false;
    }
    return true;
  });
  if (!toPush.length) return null;

  let cur = L;
  const path: string[] = [];
  // bubble each toPush atom left until adjacent to Bb
  for (const atom of toPush) {
    for (let guard = 0; guard < 20; guard++) {
      const items = tops(cur);
      const ib = items.findIndex((t) => t.startsWith('\\Bb') || t.startsWith('\\Blb'));
      const ia = items.indexOf(atom);
      if (ib < 0 || ia < 0) return null;
      if (ia === ib + 1) break;
      if (ia < ib) break;
      // swap left
      const s = items.slice();
      const tmp = s[ia]!;
      s[ia] = s[ia - 1]!;
      s[ia - 1] = tmp;
      const cand = join(s);
      if (!justify(cur, cand, pos)) return null;
      path.push(cand);
      cur = cand;
    }
  }
  // now try direct to R (code-dist)
  if (justify(cur, R, pos)) {
    path.push(R);
    return path;
  }
  return null;
}

function solve6s13(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  const s1 = ensure(
    ',i \\nPu,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,}{,i \\Od n,},n \\Pu,t \\Os,n \\Os,'
  );
  const s2 = ensure(
    ',i \\nPu,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,}{,i \\Od n,},n \\Pu,n \\Os,t \\Os,'
  );
  const path = [s1, s2, R];
  if (chainOk([L, ...path], pos) && fingerprint(R) === fingerprint(ensure(R0))) return path;
  return tryCodeDistPush(L0, R0, pos);
}

function solve(from: string, to: string, pos: number, thm: string, step: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  if (justify(L, R, pos)) return [R];
  if (thm === '6' && step === 13) return solve6s13(from, to, pos);
  return tryCodeDistPush(from, to, pos);
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
  const path = solve(f.left, f.right, pos, thm, f.step);
  if (!path) {
    open++;
    continue;
  }
  const mids = path.slice(0, -1);
  console.log('CHAIN', thm, 's' + f.step, '+' + mids.length, path.map((p, i) => (i ? justify(ensure(path[i - 1]!), p, pos) : 'start')));
  if (mids.length)
    solved.push({ left: f.left, intermediates: mids.map(toBook), label: `thm ${thm} step ${f.step}` });
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
