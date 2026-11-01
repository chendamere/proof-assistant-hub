/**
 * Apply known multi-hop fill patterns to remaining Rules_of_Node_Continuity fails.
 * Patterns: flip72, reverse operators-9 Op-into-arm, pull Oc/Os + reverse create-copy,
 * bubble+reverse copy-identical, greedy adjacent reorder.
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

const CHAPTER = 'Rules_of_Node_Continuity';
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

const axiomIds = new Set(axioms.map((r) => r.id));
const definitionIds = new Set(definitions.map((r) => r.id));

function posOf(id: string): number {
  const early = earlyRulePosition(id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axiomIds.has(id) || definitionIds.has(id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + parseInt(m[2]!, 10) + 1;
}
function keyPos(key: string): number {
  const filename = key.split('::')[0] ?? '';
  const index = parseInt(key.split('::')[1] ?? '0', 10) || 0;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + index;
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
    if (!justify(steps[i]!, steps[i + 1]!, pos)) return false;
  }
  return true;
}

function topItems(e: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  const s = ensure(e);
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const piece = s.slice(start, i).trim();
      if (piece) items.push(piece);
      start = i + 1;
    }
  }
  const tail = s.slice(start).trim();
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

/** Greedy adjacent top-level bubble toward goal. */
function greedyReorder(from: string, to: string, pos: number): string[] | null {
  let cur = ensure(from);
  const goal = ensure(to);
  const gItems = topItems(goal);
  const path: string[] = [];
  for (let step = 0; step < 40; step++) {
    if (cur === goal) return path;
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
  return cur === goal ? path : path.length ? path : null;
}

function flipPsCond(expr: string, which = 0): string | null {
  const re = /\\B(lb|b)\s*\{([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)\}/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = re.exec(expr))) {
    if (idx === which) {
      return (
        expr.slice(0, m.index) +
        `\\B${m[1]}{${m[3]} \\Ps ${m[2]}}` +
        expr.slice(m.index + m[0].length)
      );
    }
    idx++;
  }
  return null;
}

/**
 * flip → (rev) identical-72 → flip for Blb/Bb right-operand Ps subst.
 * After flip, cond is Y Ps X with bridge Y Ps Z outside → rev-72 → Z Ps X → flip → X Ps Z.
 */
function tryFlip72(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  const f1raw = flipPsCond(L);
  if (!f1raw || !justify(L, f1raw, pos)) return null;
  const f1 = ensure(f1raw);
  const re = /\\B(lb|b)\{([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)\}/;
  const m = re.exec(f1);
  if (!m) return null;
  const left = m[2]!;
  const right = m[3]!;
  // Reverse 72: i Ps j, Bb{i Ps m} → Bb{j Ps m}. Bridge first equals cond first.
  const bridgeRe = /([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)/g;
  let bm: RegExpExecArray | null;
  const candidates: string[] = [];
  while ((bm = bridgeRe.exec(f1))) {
    if (bm.index! >= m.index! && bm.index! < m.index! + m[0]!.length) continue; // skip cond itself
    if (bm[1] === left && bm[2] !== right) {
      const f2 = f1.replace(
        `\\B${m[1]}{${left} \\Ps ${right}}`,
        `\\B${m[1]}{${bm[2]} \\Ps ${right}}`
      );
      candidates.push(ensure(f2));
    }
  }
  for (const f2 of candidates) {
    if (!justify(f1, f2, pos)) continue;
    const f3raw = flipPsCond(f2);
    if (!f3raw || !justify(f2, f3raw, pos)) continue;
    const f3 = ensure(f3raw);
    if (f3 === R) return [f1, f2, f3];
  }
  return null;
}

/**
 * Add Op next to Os inside Blb/Bb arms via reverse rules-of-operators-9, one arm at a time.
 */
function tryOpIntoArms(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  const armOp = /\\B(lb|b)\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/;
  const lm = armOp.exec(L);
  const rm = armOp.exec(R);
  if (!lm || !rm) return null;
  const needOps: string[] = [];
  for (const raw of rm[3]!.match(/([A-Za-z][A-Za-z0-9_]*) \\Op/g) ?? []) {
    const n = raw.replace(/ \\Op/, '');
    if (!lm[3]!.includes(`${n} \\Op`) && !needOps.includes(n)) needOps.push(n);
  }
  if (needOps.length === 0) return null;

  let cur = L;
  const path: string[] = [];
  for (const name of needOps) {
    for (const arm of [0, 1] as const) {
      const m = armOp.exec(cur);
      if (!m) return null;
      const kind = m[1]!;
      const cond = m[2]!;
      const arms = [m[3]!, m[4]!];
      if (arms[arm]!.includes(`${name} \\Op`)) continue;
      if (!arms[arm]!.includes(`${name} \\Os`)) return null;
      arms[arm] = arms[arm]!.replace(`${name} \\Os`, `${name} \\Op,${name} \\Os`);
      const rebuilt = ensure(
        cur.slice(0, m.index) +
          `\\B${kind}{${cond}}{,${arms[0]}}{,${arms[1]}}` +
          cur.slice(m.index + m[0]!.length)
      );
      if (!justify(cur, rebuilt, pos)) return null;
      path.push(rebuilt);
      cur = rebuilt;
    }
  }
  if (cur === R) return path;
  const rest = greedyReorder(cur, R, pos);
  if (rest && ensure(rest[rest.length - 1]!) === R) return [...path, ...rest];
  return null;
}

/** Pull equal-arm Oc then Os then reverse create-copy. */
function tryCollapseCopyFromArms(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  // Pattern: Blb{cond}{X Oc Y, Y Os, rest}{X Oc Y, Y Os, rest} → Blb{cond}{rest}{rest}
  const re =
    /\\B(lb|b)\{([^}]*)\}\{,([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),\4 \\Os,([^}]*)\}\{,\3 \\Oc \4,\4 \\Os,\5\}/;
  const m = re.exec(L);
  if (!m) return null;
  const kind = m[1]!;
  const cond = m[2]!;
  const x = m[3]!;
  const y = m[4]!;
  const rest = m[5]!;
  const midA = ensure(
    L.slice(0, m.index) +
      `${x} \\Oc ${y},\\B${kind}{${cond}}{,${y} \\Os,${rest}}{,${y} \\Os,${rest}}` +
      L.slice(m.index + m[0]!.length)
  );
  const midB = ensure(
    midA.replace(
      `\\B${kind}{${cond}}{,${y} \\Os,${rest}}{,${y} \\Os,${rest}}`,
      `${y} \\Os,\\B${kind}{${cond}}{,${rest}}{,${rest}}`
    )
  );
  const midC = ensure(midB.replace(`${x} \\Oc ${y},${y} \\Os,`, ''));
  const path = [midA, midB, midC];
  if (!chainOk([L, ...path], pos)) return null;
  if (fingerprint(midC) === fingerprint(R)) return path;
  const restPath = greedyReorder(midC, R, pos);
  if (restPath && fingerprint(restPath[restPath.length - 1]!) === fingerprint(R))
    return [...path, ...restPath];
  return null;
}

/** Bubble Ps next to Oc then reverse copy-identical. */
function tryDropPsBesideOc(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  const Litems = topItems(L);
  const Ritems = topItems(R);
  if (Litems.length !== Ritems.length + 1) return null;
  // find Ps in L not in R (multiset)
  const counts = new Map<string, number>();
  for (const t of Litems) counts.set(t, (counts.get(t) ?? 0) + 1);
  for (const t of Ritems) counts.set(t, (counts.get(t) ?? 0) - 1);
  const extras = [...counts.entries()].filter(([, c]) => c > 0).map(([t]) => t);
  if (extras.length !== 1) return null;
  const extra = extras[0]!;
  const ps = /^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/.exec(extra);
  if (!ps) return null;
  const x = ps[1]!;
  const y = ps[2]!;
  const oc = `${x} \\Oc ${y}`;
  if (!Litems.includes(oc)) return null;

  // bubble extra next to oc
  let curItems = Litems.slice();
  const path: string[] = [];
  let guard = 0;
  while (guard++ < 40) {
    const iPs = curItems.indexOf(extra);
    const iOc = curItems.indexOf(oc);
    if (iPs < 0 || iOc < 0) return null;
    if (Math.abs(iPs - iOc) === 1) break;
    const j = iPs < iOc ? iPs + 1 : iPs - 1;
    const swapped = curItems.slice();
    const tmp = swapped[iPs]!;
    swapped[iPs] = swapped[j]!;
    swapped[j] = tmp;
    const cand = joinItems(swapped);
    if (!justify(joinItems(curItems), cand, pos)) return null;
    path.push(cand);
    curItems = swapped;
  }
  // drop Ps via reverse copy-identical
  const dropped = curItems.filter((t) => t !== extra);
  // keep one occurrence of extra removed
  const iPs = curItems.indexOf(extra);
  const afterDrop = curItems.slice(0, iPs).concat(curItems.slice(iPs + 1));
  const dropExpr = joinItems(afterDrop);
  if (!justify(joinItems(curItems), dropExpr, pos)) return null;
  path.push(dropExpr);
  if (ensure(dropExpr) === R) return path;
  const rest = greedyReorder(dropExpr, R, pos);
  if (rest && ensure(rest[rest.length - 1]!) === R) return [...path, ...rest];
  void dropped;
  return null;
}

function solve(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  if (L === R) return [];
  if (justify(L, R, pos)) return [R];

  const patterns = [tryFlip72, tryOpIntoArms, tryCollapseCopyFromArms, tryDropPsBesideOc, greedyReorder];
  for (const p of patterns) {
    const path = p(L, R, pos);
    if (!path || path.length === 0) continue;
    const last = ensure(path[path.length - 1]!);
    if (fingerprint(last) === fingerprint(R) && chainOk([L, ...path], pos)) return path;
  }
  return null;
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
    const canon = ensure(buf.replace(/^\s*(?:<\d+>\s*)*\\Rq\s*/, '').trim());
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
  type Job = { afterLine: number; trail: string; intermediates: string[]; label: string };
  const jobs: Job[] = [];
  for (const item of solved) {
    const want = fingerprint(item.left);
    const hits = steps.filter((s) => fingerprint(s.canon) === want);
    const hit = hits.length === 1 ? hits[0] : hits[0];
    if (!hit || hits.length !== 1) {
      console.log('NO UNIQUE ANCHOR', item.label, 'hits', hits.length);
      continue;
    }
    jobs.push({
      afterLine: hit.end,
      trail: hit.trail,
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
    const block = job.intermediates.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
    lines.splice(job.afterLine + 1, 0, ...block);
    inserted += job.intermediates.length;
    console.log('inserted', job.intermediates.length, job.label, 'line', job.afterLine + 1);
  }
  fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
  return inserted;
}

// --- main ---
const fails = fs
  .readFileSync(recheckPath, 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l) as { key: string; step: number; left: string; right: string });

const solved: Array<{ left: string; intermediates: string[]; label: string }> = [];
let open = 0;
for (const f of fails) {
  const thm = f.key.split('::')[1];
  const pos = keyPos(f.key);
  const path = solve(f.left, f.right, pos);
  if (!path || path.length === 0) {
    console.log('OPEN', thm, 's' + f.step);
    open++;
    continue;
  }
  // intermediates exclude final goal (next Rq already has it)
  const mids = path.slice(0, -1);
  if (mids.length === 0) {
    console.log('DIRECT', thm, 's' + f.step, '(no insert)');
    continue;
  }
  console.log('CHAIN', thm, 's' + f.step, '+' + mids.length);
  solved.push({ left: f.left, intermediates: mids.map(toBook), label: `thm ${thm} step ${f.step}` });
}

const inserted = applyChains(solved);
console.log(`solved=${solved.length} open=${open} inserted=${inserted}`);
if (inserted > 0) {
  execSync('node scripts/extract-proof-steps.js', { cwd: root, stdio: 'inherit' });
}
