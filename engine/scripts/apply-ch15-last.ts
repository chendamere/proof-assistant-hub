/**
 * Finish last ch15 fails: 123 Op-push, 129 scaffold drop, probe nested Bb.
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
];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const texPath = path.join(root, 'src/data/theorems/Rules_of_Node_Continuity.tex');
const recheckPath = path.join(__dirname, 'out/recheck-ch15.jsonl');

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

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const dag = new Map();
const idxCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let i = idxCache.get(pos);
  if (i) return i;
  i = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    dag
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
      console.log('FAIL hop', i, ensure(steps[i]!).slice(0, 80), '→', ensure(steps[i + 1]!).slice(0, 80));
      return false;
    }
  }
  return true;
}

function pushOpsIntoBb(L: string, R: string, pos: number): string[] | null {
  let cur = ensure(L);
  const path: string[] = [];
  for (const name of ['m', 'i']) {
    for (let guard = 0; guard < 15; guard++) {
      const items = tops(cur);
      const iOp = items.indexOf(`${name} \\Op`);
      const iBb = items.findIndex((t) => t.startsWith('\\Bb') || t.startsWith('\\Blb'));
      if (iOp < 0 || iBb < 0) return null;
      if (iOp === iBb - 1) break;
      if (iOp > iBb) return null;
      const swapped = items.slice();
      const tmp = swapped[iOp]!;
      swapped[iOp] = swapped[iOp + 1]!;
      swapped[iOp + 1] = tmp;
      const cand = join(swapped);
      if (!justify(cur, cand, pos)) return null;
      path.push(cand);
      cur = cand;
    }
    const items = tops(cur);
    const iOp = items.indexOf(`${name} \\Op`);
    const iBb = items.findIndex((t) => t.startsWith('\\Bb'));
    if (iOp !== iBb - 1) return null;
    const without = join(items.filter((_, i) => i !== iOp));
    const am = /\\Bb\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/.exec(without);
    if (!am) return null;
    const pushed = ensure(
      without.replace(am[0]!, `\\Bb{${am[1]}}{,${name} \\Op,${am[2]}}{,${name} \\Op,${am[3]}}`)
    );
    if (!justify(cur, pushed, pos)) return null;
    path.push(pushed);
    cur = pushed;
  }
  // reorder arm Ops if needed (one arm at a time)
  if (fingerprint(cur) !== fingerprint(R)) {
    for (const arm of [0, 1] as const) {
      const am = /\\Bb\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/.exec(cur);
      if (!am) break;
      const arms = [am[2]!, am[3]!];
      if (arms[arm]!.startsWith('i \\Op,m \\Op')) {
        arms[arm] = arms[arm]!.replace('i \\Op,m \\Op', 'm \\Op,i \\Op');
        const next = ensure(
          cur.replace(am[0]!, `\\Bb{${am[1]}}{,${arms[0]}}{,${arms[1]}}`)
        );
        if (!justify(cur, next, pos)) return null;
        path.push(next);
        cur = next;
      }
    }
  }
  if (fingerprint(cur) === fingerprint(R)) return path;
  return null;
}

/** Drop scaffolding Ps via bubble+73+reverse copy / identical-70. */
function dropScaffoldPs(L: string, R: string, pos: number): string[] | null {
  // 129: drop j Ps i1 and i1 Ps j1
  let cur = ensure(L);
  const path: string[] = [];
  const goalItems = new Set(tops(R));
  const extras = tops(cur).filter((t) => /\\Ps/.test(t) && !goalItems.has(t));
  // Also extras that appear fewer times in R
  const count = (items: string[], t: string) => items.filter((x) => x === t).length;
  const Litems = tops(cur);
  const Ritems = tops(R);
  const toDrop: string[] = [];
  for (const t of new Set(Litems)) {
    if (!/\\Ps/.test(t)) continue;
    const diff = count(Litems, t) - count(Ritems, t);
    for (let k = 0; k < diff; k++) toDrop.push(t);
  }
  if (toDrop.length === 0) return null;

  for (const extra of toDrop) {
    const ps = /^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/.exec(extra);
    if (!ps) return null;
    const x = ps[1]!;
    const y = ps[2]!;
    // Try reverse copy-identical if Oc x y exists
    const oc = `${x} \\Oc ${y}`;
    let items = tops(cur);
    if (items.includes(oc) && items.includes(extra)) {
      // bubble next to oc
      for (let guard = 0; guard < 20; guard++) {
        items = tops(cur);
        const iPs = items.indexOf(extra);
        const iOc = items.indexOf(oc);
        if (iPs < 0 || iOc < 0) break;
        if (Math.abs(iPs - iOc) === 1) break;
        const j = iPs < iOc ? iPs + 1 : iPs - 1;
        const swapped = items.slice();
        const tmp = swapped[iPs]!;
        swapped[iPs] = swapped[j]!;
        swapped[j] = tmp;
        const cand = join(swapped);
        if (!justify(cur, cand, pos)) break;
        path.push(cand);
        cur = cand;
      }
      items = tops(cur);
      const iPs = items.indexOf(extra);
      if (iPs >= 0 && Math.abs(iPs - items.indexOf(oc)) === 1) {
        const dropped = items.slice(0, iPs).concat(items.slice(iPs + 1));
        const cand = join(dropped);
        if (justify(cur, cand, pos)) {
          path.push(cand);
          cur = cand;
          continue;
        }
      }
    }
    // Try identical-70: bubble next to another copy of same Ps
    items = tops(cur);
    const idxs = items.map((t, i) => (t === extra ? i : -1)).filter((i) => i >= 0);
    if (idxs.length >= 2) {
      while (Math.abs(items.indexOf(extra) - items.lastIndexOf(extra)) > 1) {
        const a = items.indexOf(extra);
        const b = items.lastIndexOf(extra);
        const src = a;
        const dst = a + 1 < b ? a + 1 : a - 1;
        const swapped = items.slice();
        const tmp = swapped[src]!;
        swapped[src] = swapped[dst]!;
        swapped[dst] = tmp;
        const cand = join(swapped);
        if (!justify(cur, cand, pos)) break;
        path.push(cand);
        cur = cand;
        items = tops(cur);
      }
      if (Math.abs(items.indexOf(extra) - items.lastIndexOf(extra)) === 1) {
        const i = Math.min(items.indexOf(extra), items.lastIndexOf(extra));
        const dropped = items.slice(0, i).concat(items.slice(i + 1));
        const cand = join(dropped);
        if (justify(cur, cand, pos)) {
          path.push(cand);
          cur = cand;
          continue;
        }
      }
    }
    // Try 73 then drop: e.g. j Ps i1, i1 Ps j1 → j Ps i1, j Ps j1 then drop j Ps j1 via copy
    void extras;
  }

  if (fingerprint(cur) === fingerprint(R)) return path;
  // greedy reorder rest
  const gItems = tops(R);
  for (let step = 0; step < 30; step++) {
    if (fingerprint(cur) === fingerprint(R)) return path;
    const a = tops(cur);
    if (a.slice().sort().join('|') !== gItems.slice().sort().join('|')) break;
    let best: string | null = null;
    let bestD = a.reduce((d, t, i) => d + (t !== gItems[i]! ? 1 : 0), 0);
    for (let i = 0; i < a.length - 1; i++) {
      if (a[i] === a[i + 1]) continue;
      const swapped = a.slice();
      const tmp = swapped[i]!;
      swapped[i] = swapped[i + 1]!;
      swapped[i + 1] = tmp;
      const d = swapped.reduce((dd, t, ii) => dd + (t !== gItems[ii]! ? 1 : 0), 0);
      const cand = join(swapped);
      if (d < bestD && justify(cur, cand, pos)) {
        bestD = d;
        best = cand;
      }
    }
    if (!best) break;
    path.push(best);
    cur = best;
  }
  return fingerprint(cur) === fingerprint(R) ? path : null;
}

function parseProofSteps(lines: string[]) {
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
    const canon = ensure(buf.trim());
    if (canon.length > 4) steps.push({ start: i, end, canon, trail });
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
  fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
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
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('solving', thm, 's' + f.step);
  let path: string[] | null = null;
  if (thm === '123') path = pushOpsIntoBb(L, R, pos);
  if (!path && (thm === '129' || /\\Ps/.test(L))) path = dropScaffoldPs(L, R, pos);
  if (!path || path.length === 0) {
    console.log('OPEN', thm, 's' + f.step);
    open++;
    continue;
  }
  if (!chainOk([L, ...path], pos) || fingerprint(path[path.length - 1]!) !== fingerprint(R)) {
    console.log('BAD CHAIN', thm, 's' + f.step);
    open++;
    continue;
  }
  const mids = path.slice(0, -1);
  console.log('CHAIN', thm, 's' + f.step, '+' + mids.length);
  if (mids.length) solved.push({ left: f.left, intermediates: mids.map(toBook), label: `thm ${thm} step ${f.step}` });
}
const inserted = applyChains(solved);
console.log(`solved=${solved.length} open=${open} inserted=${inserted}`);
if (inserted > 0) {
  execSync('node scripts/extract-proof-steps.js', {
    cwd: root,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });
}
