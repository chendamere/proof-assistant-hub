/**
 * Short BFS fill for remaining ch16 fails: adjacent swaps + code-dist push into Bb
 * + pull equal arm prefix + Pc flip.
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
  if (fingerprint(a) === fingerprint(b)) return 'spacing';
  const key = pos + '|' + fingerprint(a) + '=>' + fingerprint(b);
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

/** Split outermost Bb/Blb into kind, cond, true, false — brace-aware for nested. */
function splitBb(bb: string): { kind: string; cond: string; t: string; f: string } | null {
  const m = /^\\B(lb|b|rb|s)\{/.exec(bb);
  if (!m) return null;
  const kind = m[1]!;
  let i = m[0].length;
  const take = () => {
    let d = 0;
    const start = i;
    for (; i < bb.length; i++) {
      if (bb[i] === '{') d++;
      else if (bb[i] === '}') {
        if (d === 0) {
          const out = bb.slice(start, i);
          i++; // skip }
          return out;
        }
        d--;
      }
    }
    return null;
  };
  const cond = take();
  if (cond == null || bb[i] !== '{') return null;
  i++; // skip {
  const t = take();
  if (t == null || bb[i] !== '{') return null;
  i++;
  const f = take();
  if (f == null) return null;
  return { kind, cond, t: t.replace(/^,/, '').replace(/,$/, ''), f: f.replace(/^,/, '').replace(/,$/, '') };
}
function makeBb(kind: string, cond: string, t: string, f: string) {
  const tt = t && !t.startsWith(',') ? ',' + t + (t.endsWith(',') ? '' : ',') : t || ',';
  const ff = f && !f.startsWith(',') ? ',' + f + (f.endsWith(',') ? '' : ',') : f || ',';
  const tNorm = tt.startsWith(',') ? tt : ',' + tt;
  const fNorm = ff.startsWith(',') ? ff : ',' + ff;
  return `\\B${kind}{${cond}}{${tNorm.endsWith(',') ? tNorm : tNorm + ','}}{${fNorm.endsWith(',') ? fNorm : fNorm + ','}}`;
}

function tokenDist(a: string, b: string): number {
  const A = fingerprint(a);
  const B = fingerprint(b);
  const n = Math.min(A.length, B.length);
  let d = Math.abs(A.length - B.length);
  for (let i = 0; i < n; i++) if (A[i] !== B[i]) d++;
  return d;
}

function neighbors(cur: string, goal: string, pos: number): Array<{ expr: string; rule: string }> {
  const out: Array<{ expr: string; rule: string }> = [];
  const add = (expr: string) => {
    const e = ensure(expr);
    if (fingerprint(e) === fingerprint(cur)) return;
    const rule = justify(cur, e, pos);
    if (rule) out.push({ expr: e, rule });
  };
  const items = tops(cur);

  // adjacent swaps
  for (let i = 0; i < items.length - 1; i++) {
    if (items[i] === items[i + 1]) continue;
    const s = items.slice();
    const tmp = s[i]!;
    s[i] = s[i + 1]!;
    s[i + 1] = tmp;
    add(join(s));
  }

  // code-dist / factor: push atom immediately after a Bb into both arms (front or back)
  for (let i = 0; i < items.length - 1; i++) {
    const bb = splitBb(items[i]!);
    if (!bb) continue;
    const atom = items[i + 1]!;
    if (atom.startsWith('\\B')) continue;
    const front = makeBb(bb.kind, bb.cond, atom + (bb.t ? ',' + bb.t : ''), atom + (bb.f ? ',' + bb.f : ''));
    add(join(items.slice(0, i).concat([front], items.slice(i + 2))));
    const back = makeBb(
      bb.kind,
      bb.cond,
      (bb.t ? bb.t + ',' : '') + atom,
      (bb.f ? bb.f + ',' : '') + atom
    );
    add(join(items.slice(0, i).concat([back], items.slice(i + 2))));
  }

  // pull equal leading atom from both arms
  for (let i = 0; i < items.length; i++) {
    const bb = splitBb(items[i]!);
    if (!bb) continue;
    const tParts = bb.t.split(',').map((x) => x.trim()).filter(Boolean);
    const fParts = bb.f.split(',').map((x) => x.trim()).filter(Boolean);
    if (!tParts.length || tParts[0] !== fParts[0]) continue;
    const atom = tParts[0]!;
    const nt = tParts.slice(1).join(',');
    const nf = fParts.slice(1).join(',');
    const newBb = makeBb(bb.kind, bb.cond, nt, nf);
    add(join(items.slice(0, i).concat([atom, newBb], items.slice(i + 1))));
    add(join(items.slice(0, i).concat([newBb, atom], items.slice(i + 1))));
  }

  // Pc flip in any Bb cond
  {
    const flipped = cur.replace(
      /\\B(lb|b|rb|s)\{([A-Za-z][A-Za-z0-9_]*) \\Pc ([A-Za-z][A-Za-z0-9_]*)\}/,
      '\\B$1{$3 \\Pc $2}'
    );
    if (flipped !== cur) add(flipped);
  }

  // direct to goal if justified
  if (justify(cur, goal, pos)) out.push({ expr: ensure(goal), rule: justify(cur, goal, pos)! });

  // prefer closer to goal
  out.sort((a, b) => tokenDist(a.expr, goal) - tokenDist(b.expr, goal));
  return out;
}

function bfs(from: string, to: string, pos: number, maxDepth = 10): string[] | null {
  const start = ensure(from);
  const goal = ensure(to);
  if (fingerprint(start) === fingerprint(goal)) return [];
  if (justify(start, goal, pos)) return [goal];
  type Node = { expr: string; path: string[] };
  let layer: Node[] = [{ expr: start, path: [] }];
  const seen = new Set([fingerprint(start)]);
  const t0 = Date.now();
  for (let depth = 0; depth < maxDepth; depth++) {
    if (Date.now() - t0 > 25000) break;
    const next: Node[] = [];
    for (const node of layer) {
      for (const nb of neighbors(node.expr, goal, pos).slice(0, 24)) {
        const fp = fingerprint(nb.expr);
        if (seen.has(fp)) continue;
        seen.add(fp);
        const path = [...node.path, nb.expr];
        if (fp === fingerprint(goal)) return path;
        next.push({ expr: nb.expr, path });
      }
    }
    next.sort((a, b) => tokenDist(a.expr, goal) - tokenDist(b.expr, goal));
    layer = next.slice(0, 40);
    if (!layer.length) break;
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
  process.stdout.write(`try ${thm} s${f.step}... `);
  const path = bfs(f.left, f.right, pos, 10);
  if (!path) {
    console.log('OPEN');
    open++;
    continue;
  }
  const mids = path.slice(0, -1);
  console.log('CHAIN +' + mids.length);
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
