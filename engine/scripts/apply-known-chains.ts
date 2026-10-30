/**
 * Apply hand-verified chains for remaining hard fails.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';

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
    if (rule.id.includes('equiv-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

type Chain = { thm: number; step: number; mids: string[] };

function flip72Chain(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  const re = /\\B(lb|b)\{([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)\}/;
  const mL = L.match(re);
  const mR = R.match(re);
  if (!mL || !mR) return null;
  if (mL[2] !== mR[2] || mL[3] === mR[3]) return null;
  const a = mL[2]!;
  const b = mL[3]!;
  const c = mR[3]!;
  const kind = mL[1]!;
  const flip1 = L.replace(`\\B${kind}{${a} \\Ps ${b}}`, `\\B${kind}{${b} \\Ps ${a}}`);
  if (!justify(L, flip1, pos)) return null;
  const via72 = flip1.replace(`\\B${kind}{${b} \\Ps ${a}}`, `\\B${kind}{${c} \\Ps ${a}}`);
  if (!justify(flip1, via72, pos)) return null;
  const flip2 = via72.replace(`\\B${kind}{${c} \\Ps ${a}}`, `\\B${kind}{${a} \\Ps ${c}}`);
  if (!justify(via72, flip2, pos)) return null;
  if (ensure(flip2) !== R) return null;
  return [flip1, via72];
}

/** Ps after R-pair → Ps before R-pair via: bubble R(j) left, ... actually use book path:
 *  swap Ps with non-colliding R, then... 
 *  Concrete for 100 s38: use dup + rearrange through r-27 form by first bubbling R(j_1) left of Ps,
 *  then we still can't. Fall back: search short beam of justified item ops.
 */
function psRReorderChain(L0: string, R0: string, pos: number): string[] | null {
  const goal = ensure(R0);
  let cur = ensure(L0);
  if (justify(cur, goal, pos)) return [];
  const path: string[] = [];
  const seen = new Set([cur]);

  const neighbors = (e: string): string[] => {
    const items = topItems(e);
    const out: string[] = [];
    // dup / drop Ps
    for (let i = 0; i < items.length; i++) {
      if (!/ \\Ps /.test(items[i]!)) continue;
      const dup = items.slice();
      dup.splice(i + 1, 0, items[i]!);
      out.push(joinItems(dup));
      if (i + 1 < items.length && items[i + 1] === items[i]) {
        const drop = items.slice();
        drop.splice(i + 1, 1);
        out.push(joinItems(drop));
      }
    }
    // r-27 add/drop trailing
    for (let i = 0; i + 2 < items.length; i++) {
      const a = items[i]!;
      const r1 = items[i + 1]!;
      const r2 = items[i + 2]!;
      const pm = a.match(/^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/);
      if (!pm) continue;
      if (r1 !== `R(${pm[1]})` || r2 !== `R(${pm[2]})`) continue;
      if (i + 3 < items.length && items[i + 3] === a) {
        const drop = items.slice();
        drop.splice(i + 3, 1);
        out.push(joinItems(drop));
      } else {
        const add = items.slice();
        add.splice(i + 3, 0, a);
        out.push(joinItems(add));
      }
    }
    // adjacent swaps
    for (let i = 0; i < items.length - 1; i++) {
      const sw = items.slice();
      const t = sw[i]!;
      sw[i] = sw[i + 1]!;
      sw[i + 1] = t;
      out.push(joinItems(sw));
    }
    // flip Ps
    for (let i = 0; i < items.length; i++) {
      const pm = items[i]!.match(/^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/);
      if (!pm) continue;
      const fl = items.slice();
      fl[i] = `${pm[2]} \\Ps ${pm[1]}`;
      out.push(joinItems(fl));
    }
    return out;
  };

  // BFS limited
  type Node = { e: string; path: string[] };
  const q: Node[] = [{ e: cur, path: [] }];
  let steps = 0;
  while (q.length && steps < 8000) {
    const n = q.shift()!;
    steps++;
    for (const raw of neighbors(n.e)) {
      const e = ensure(raw);
      if (seen.has(e)) continue;
      if (!justify(n.e, e, pos)) continue;
      seen.add(e);
      const p = [...n.path, e];
      if (e === goal) return p.slice(0, -1).concat(e === goal ? [] : []).length >= 0
        ? p[p.length - 1] === goal
          ? p.slice(0, -1)
          : p
        : null;
      if (e === goal) return p.slice(0, -1);
      if (p.length < 12) q.push({ e, path: p });
    }
  }
  // fix return
  for (const n of [{ e: cur, path }]) void n;
  // re-do clean BFS return
  return null;
}

function psRReorderChainBfs(L0: string, R0: string, pos: number): string[] | null {
  const goal = ensure(R0);
  const start = ensure(L0);
  if (justify(start, goal, pos)) return [];
  type Node = { e: string; path: string[] };
  const seen = new Set([start]);
  const q: Node[] = [{ e: start, path: [] }];
  let expanded = 0;
  while (q.length && expanded < 12000) {
    const n = q.shift()!;
    expanded++;
    const items = topItems(n.e);
    const cands: string[] = [];
    for (let i = 0; i < items.length; i++) {
      if (!/ \\Ps /.test(items[i]!)) continue;
      const dup = items.slice();
      dup.splice(i + 1, 0, items[i]!);
      cands.push(joinItems(dup));
      if (i + 1 < items.length && items[i + 1] === items[i]) {
        const drop = items.slice();
        drop.splice(i, 1);
        cands.push(joinItems(drop));
      }
    }
    for (let i = 0; i + 2 < items.length; i++) {
      const a = items[i]!;
      const pm = a.match(/^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/);
      if (!pm) continue;
      if (items[i + 1] !== `R(${pm[1]})` || items[i + 2] !== `R(${pm[2]})`) continue;
      if (i + 3 < items.length && items[i + 3] === a) {
        const drop = items.slice();
        drop.splice(i + 3, 1);
        cands.push(joinItems(drop));
      } else {
        const add = items.slice();
        add.splice(i + 3, 0, a);
        cands.push(joinItems(add));
      }
    }
    for (let i = 0; i < items.length - 1; i++) {
      const sw = items.slice();
      const t = sw[i]!;
      sw[i] = sw[i + 1]!;
      sw[i + 1] = t;
      cands.push(joinItems(sw));
    }
    for (const raw of cands) {
      const e = ensure(raw);
      if (seen.has(e)) continue;
      if (!justify(n.e, e, pos)) continue;
      seen.add(e);
      const p = [...n.path, e];
      if (e === goal) return p.slice(0, -1);
      if (p.length < 14) q.push({ e, path: p });
    }
  }
  console.log('  bfs exhausted', expanded, 'seen', seen.size);
  return null;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const seenFail = new Set<string>();
const chains: Chain[] = [];

for (const f of fails) {
  const id = `${f.key}::${f.step}`;
  if (seenFail.has(id)) continue;
  seenFail.add(id);
  const thm = parseInt(f.key.split('::')[1] ?? '0', 10);
  const pos = 13 * 100000 + thm;
  let mids: string[] | null = null;

  mids = flip72Chain(f.left, f.right, pos);
  if (mids) {
    console.log('flip72', thm, 's' + f.step, '+' + mids.length);
    chains.push({ thm, step: f.step, mids });
    continue;
  }

  // Ps/R reorder heuristic only when top-level multiset almost equal
  const A = topItems(f.left);
  const B = topItems(f.right);
  if (A.length === B.length || Math.abs(A.length - B.length) <= 2) {
    const sameBb =
      (A.find((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb')) || '') ===
      (B.find((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb')) || '');
    if (sameBb && /R\([a-z].*\\Ps|\\Ps.*R\([a-z]/.test(ensure(f.left) + ensure(f.right))) {
      console.log('bfs Ps/R', thm, 's' + f.step);
      mids = psRReorderChainBfs(f.left, f.right, pos);
      if (mids) {
        console.log('  found +' + mids.length);
        chains.push({ thm, step: f.step, mids });
        continue;
      }
    }
  }

  // 124 s181 / identical-arm factor via empty-branch + pull
  if (/\\B(?:lb|b)\{[^}]+\}\{([^}]*)\}\{\1\}/.test(ensure(f.left))) {
    console.log('try arm-factor rewrites', thm, 's' + f.step);
    const L = ensure(f.left);
    const R = ensure(f.right);
    const priority = allRules.filter(
      (r) =>
        r.pos < pos &&
        /empty-branch|equiv-code|identical-node-comparison-1|flag|release|operators-9|swap/.test(r.id)
    );
    const path: string[] = [];
    let cur = L;
    const localSeen = new Set([cur]);
    for (let step = 0; step < 10 && cur !== R; step++) {
      let best: { e: string; d: number } | null = null;
      for (const rule of priority) {
        let rewrites: string[];
        try {
          rewrites = oneStepRewrites(cur, rule.leftSide, rule.rightSide);
        } catch {
          continue;
        }
        for (const raw of rewrites) {
          const e = ensure(raw);
          if (localSeen.has(e)) continue;
          if (
            !checkInferenceRules(cur, e, rule.leftSide, rule.rightSide, {
              dagCache: indexBefore(pos).dagCache,
            }).match
          )
            continue;
          const d = Math.abs(e.length - R.length) + (e.includes('\\Bb') === R.includes('\\Bb') ? 0 : 50);
          if (e === R || !best || d < best.d) best = { e, d };
        }
      }
      // also try syntactic identical-arm collapse candidates and justify
      {
        const collapsed = cur.replace(/\\B(?:lb|b)\{[^}]*\}\{([^}]*)\}\{\1\}/, '$1');
        if (collapsed !== cur && justify(cur, ensure(collapsed + (cur.endsWith(',') ? '' : '')), pos)) {
          const e = ensure(collapsed);
          if (!best || e === R) best = { e, d: e === R ? -1 : Math.abs(e.length - R.length) };
        }
      }
      if (!best) break;
      localSeen.add(best.e);
      path.push(best.e);
      cur = best.e;
      if (cur === R) break;
    }
    if (cur === R && path.length) {
      console.log('  arm-factor chain +' + (path.length - (path[path.length - 1] === R ? 1 : 0)));
      chains.push({
        thm,
        step: f.step,
        mids: path[path.length - 1] === R ? path.slice(0, -1) : path,
      });
    }
  }
}

// Apply
const jobs: Array<{ after: number; trail: string; mids: string[]; label: string; left: string }> = [];
for (const ch of chains) {
  const f = fails.find((x) => x.key.includes(`::${ch.thm}::`) && x.step === ch.step)!;
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
        mids: ch.mids,
        label: `thm ${ch.thm} s${ch.step}`,
        left: f.left,
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
  if (job.mids.length === 0) continue;
  const block = job.mids.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
  lines.splice(job.after + 1, 0, ...block);
  inserted += block.length;
  console.log('inserted', block.length, job.label);
}
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('done inserted=' + inserted + ' chains=' + chains.length);
void psRReorderChain;
