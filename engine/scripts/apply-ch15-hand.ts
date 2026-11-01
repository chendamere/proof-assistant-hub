/**
 * Hand-coded multi-hop fills for remaining ch15 fails (no BFS).
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
    const via = justify(steps[i]!, steps[i + 1]!, pos);
    if (!via) {
      console.log('  FAIL hop', i, '→', i + 1);
      console.log('   ', ensure(steps[i]!));
      console.log('   ', ensure(steps[i + 1]!));
      return false;
    }
  }
  return true;
}

/** Adjacent bubble toward goal order (same multiset). */
function greedyReorder(from: string, to: string, pos: number): string[] | null {
  let cur = ensure(from);
  const goal = ensure(to);
  const gItems = topItems(goal);
  const path: string[] = [];
  const orderDist = (A: string[], B: string[]) => {
    let d = 0;
    for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) d++;
    return d;
  };
  for (let step = 0; step < 40; step++) {
    if (fingerprint(cur) === fingerprint(goal)) return path;
    const a = topItems(cur);
    if (a.slice().sort().join('|') !== gItems.slice().sort().join('|')) return null;
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
    if (!best) return null;
    path.push(best);
    cur = best;
  }
  return fingerprint(cur) === fingerprint(goal) ? path : null;
}

type Fail = { key: string; step: number; left: string; right: string };

function solveOne(f: Fail): string[] | null {
  const pos = keyPos(f.key);
  const thm = f.key.split('::')[1]!;
  const L = ensure(f.left);
  const R = ensure(f.right);
  if (justify(L, R, pos)) return [R];

  // --- shell drop: Oc On Os ---
  {
    const re = /([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),\2 \\On,\2 \\Os,/;
    const m = re.exec(L);
    if (m) {
      const mid = ensure(L.replace(m[0]!, `${m[1]} \\Oc ${m[2]},${m[2]} \\Os,`));
      const end = ensure(mid.replace(`${m[1]} \\Oc ${m[2]},${m[2]} \\Os,`, ''));
      if (fingerprint(end) === fingerprint(R) && chainOk([L, mid, end], pos)) return [mid, end];
    }
  }

  // --- Pc right subst ---
  {
    const re = /([A-Za-z][A-Za-z0-9_]*) \\Pc ([A-Za-z][A-Za-z0-9_]*)/;
    const lm = re.exec(L);
    const rm = re.exec(R);
    if (lm && rm && lm[1] === rm[1] && lm[2] !== rm[2] && L.includes(`${lm[2]} \\Ps ${rm[2]}`)) {
      const x = lm[1]!;
      const y = lm[2]!;
      const z = rm[2]!;
      const a = ensure(L.replace(`${x} \\Pc ${y}`, `${y} \\Pc ${x}`));
      const b = ensure(a.replace(`${y} \\Pc ${x}`, `${z} \\Pc ${x}`));
      const c = ensure(b.replace(`${z} \\Pc ${x}`, `${x} \\Pc ${z}`));
      if (fingerprint(c) === fingerprint(R) && chainOk([L, a, b, c], pos)) return [a, b, c];
    }
  }

  // --- drop Pu ---
  if ((L.match(/\\Pu/g) || []).length > (R.match(/\\Pu/g) || []).length) {
    const items = topItems(L);
    const path: string[] = [];
    let cur = L;
    let curItems = items.slice();
    let ok = true;
    while ((cur.match(/\\Pu/g) || []).length > (R.match(/\\Pu/g) || []).length) {
      let progressed = false;
      for (let i = 0; i < curItems.length; i++) {
        if (!/\\Pu/.test(curItems[i]!)) continue;
        const nextItems = curItems.slice(0, i).concat(curItems.slice(i + 1));
        const next = joinItems(nextItems);
        if (justify(cur, next, pos)) {
          path.push(next);
          cur = next;
          curItems = nextItems;
          progressed = true;
          break;
        }
      }
      if (!progressed) {
        ok = false;
        break;
      }
    }
    if (ok && fingerprint(cur) === fingerprint(R)) return path;
    if (ok) {
      const rest = greedyReorder(cur, R, pos);
      if (rest && fingerprint(rest[rest.length - 1]!) === fingerprint(R)) return [...path, ...rest];
    }
  }

  // --- create-next-prev for 123 s12 style ---
  if (thm === '123' && f.step === 12) {
    const a = ensure(
      ',i \\Oc i_1,i \\On,i \\Op,i_1 \\On,m \\Oc m_1,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
    );
    const b = ensure(
      ',i \\Oc i_1,i \\On,i \\Op,i_1 \\On,m \\Oc m_1,m \\On,m \\Op,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
    );
    if (fingerprint(b) === fingerprint(R) && chainOk([L, a, b], pos)) return [a, b];
  }

  // --- 123 s13 push Ops ---
  if (thm === '123' && f.step === 13) {
    // bubble m Op to Bb, push; bubble i Op to Bb, push
    const steps = [
      ensure(
        ',i \\Oc i_1,i \\On,i \\Op,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,m \\Op,\\Bb{m_1 \\Ps i_1}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
      ),
      ensure(
        ',i \\Oc i_1,i \\On,i \\Op,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
      ),
      ensure(
        ',i \\Oc i_1,i \\On,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,i \\Op,\\Bb{m_1 \\Ps i_1}{,m \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
      ),
      ensure(
        ',i \\Oc i_1,i \\On,i_1 \\On,m \\Oc m_1,m \\On,m_1 \\On,i_1 \\Ps j,\\Bb{m_1 \\Ps i_1}{,m \\Op,i \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m \\Op,i \\Op,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
      ),
    ];
    // First hop may need several bubbles — use greedy from L to steps[0]
    const toFirst = greedyReorder(L, steps[0]!, pos);
    if (toFirst) {
      const path = [...toFirst];
      let cur = path.length ? path[path.length - 1]! : L;
      for (const s of steps) {
        if (fingerprint(cur) === fingerprint(s)) continue;
        // try direct or greedy
        if (justify(cur, s, pos)) {
          path.push(s);
          cur = s;
          continue;
        }
        const mid = greedyReorder(cur, s, pos);
        if (!mid) return null;
        path.push(...mid);
        cur = mid[mid.length - 1]!;
      }
      if (fingerprint(cur) === fingerprint(R) && chainOk([L, ...path], pos)) return path;
    }
  }

  // --- 123 s47 drop On Op pairs via reverse create-next-prev ---
  if (thm === '123' && f.step === 47) {
    // L has i On,i Op and m On,m Op; R drops them
    const a = ensure(
      ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m \\On,m \\Op,m_1 \\On,i_1 \\Ps j,\\Bb{m \\Ps i}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},'
    );
    // Better: bubble each On,Op adjacent then reverse create
    const items = topItems(L);
    // Remove i On, i Op, m On, m Op
    const want = topItems(R);
    const path = greedyReorder(L, joinItems([...want.slice(0, 2), 'i \\On', 'i \\Op', ...want.slice(2)]), pos);
    void path;
    // Direct reverse create: need On,Op adjacent
    let cur = L;
    const out: string[] = [];
    for (const name of ['i', 'm']) {
      // bubble name On next to name Op
      const its = topItems(cur);
      const iOn = its.indexOf(`${name} \\On`);
      const iOp = its.indexOf(`${name} \\Op`);
      if (iOn < 0 || iOp < 0) return null;
      let arr = its.slice();
      while (Math.abs(arr.indexOf(`${name} \\On`) - arr.indexOf(`${name} \\Op`)) > 1) {
        const a = arr.indexOf(`${name} \\On`);
        const b = arr.indexOf(`${name} \\Op`);
        const from = a < b ? a : b;
        const to = a < b ? a + 1 : a - 1;
        // move On toward Op
        const src = a;
        const dst = a < b ? a + 1 : a - 1;
        const tmp = arr[src]!;
        arr[src] = arr[dst]!;
        arr[dst] = tmp;
        const cand = joinItems(arr);
        if (!justify(cur, cand, pos)) return null;
        out.push(cand);
        cur = cand;
        void from;
        void to;
      }
      // ensure On before Op
      arr = topItems(cur);
      const ao = arr.indexOf(`${name} \\On`);
      const ap = arr.indexOf(`${name} \\Op`);
      if (ao !== ap - 1) {
        // swap if Op before On
        if (ap === ao - 1) {
          const swapped = arr.slice();
          swapped[ap] = arr[ao]!;
          swapped[ao] = arr[ap]!;
          const cand = joinItems(swapped);
          if (!justify(cur, cand, pos)) return null;
          out.push(cand);
          cur = cand;
          arr = swapped;
        } else return null;
      }
      // drop On,Op
      const idx = topItems(cur).indexOf(`${name} \\On`);
      const dropped = topItems(cur).slice();
      dropped.splice(idx, 2); // On and Op
      const cand = joinItems(dropped);
      if (!justify(cur, cand, pos)) return null;
      out.push(cand);
      cur = cand;
    }
    if (fingerprint(cur) === fingerprint(R)) return out;
    const rest = greedyReorder(cur, R, pos);
    if (rest && fingerprint(rest[rest.length - 1]!) === fingerprint(R)) return [...out, ...rest];
  }

  // --- 316 transitive replace ---
  if (thm === '316' && f.step === 25) {
    const s1 = ensure(
      ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i_2 \\Ps i,i \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
    );
    const s2 = ensure(
      ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i_2 \\Ps i,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
    );
    const t1 = ensure(
      ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
    );
    const t2 = ensure(
      ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i_1,i_2 \\Ps i,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
    );
    const t3 = ensure(
      ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
    );
    const t4 = ensure(
      ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,i \\Ps i_1,i_2 \\Ps i_1,i \\On,i_2 \\Ps i,i_1 \\On,i_1 \\Ps i,i_2 \\Os,i_1 \\Os,'
    );
    const path = [s1, s2, t1, t2, t3, t4];
    if (fingerprint(t4) === fingerprint(R) && chainOk([L, ...path], pos)) return path;
  }

  // --- 315 drop duplicate Ps ---
  if (thm === '315') {
    // L has two i2 Ps i; R has one
    const items = topItems(L);
    const dup = 'i_2 \\Ps i';
    const idxs = items.map((t, i) => (t === dup ? i : -1)).filter((i) => i >= 0);
    if (idxs.length === 2) {
      // bubble them together then drop
      let arr = items.slice();
      const out: string[] = [];
      let cur = L;
      while (Math.abs(arr.indexOf(dup) - arr.lastIndexOf(dup)) > 1) {
        const a = arr.indexOf(dup);
        const b = arr.lastIndexOf(dup);
        const src = a;
        const dst = a + 1;
        if (dst >= b) break;
        const tmp = arr[src]!;
        arr[src] = arr[dst]!;
        arr[dst] = tmp;
        const cand = joinItems(arr);
        if (!justify(cur, cand, pos)) break;
        out.push(cand);
        cur = cand;
      }
      if (Math.abs(arr.indexOf(dup) - arr.lastIndexOf(dup)) === 1) {
        const i = Math.min(arr.indexOf(dup), arr.lastIndexOf(dup));
        arr = arr.slice(0, i).concat(arr.slice(i + 1));
        const cand = joinItems(arr);
        if (justify(cur, cand, pos)) {
          out.push(cand);
          cur = cand;
          if (fingerprint(cur) === fingerprint(R)) return out;
          const rest = greedyReorder(cur, R, pos);
          if (rest) return [...out, ...rest];
        }
      }
    }
  }

  // --- greedy reorder only ---
  {
    const path = greedyReorder(L, R, pos);
    if (path && fingerprint(path[path.length - 1]!) === fingerprint(R)) return path;
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
  type Job = { afterLine: number; trail: string; intermediates: string[]; label: string };
  const jobs: Job[] = [];
  for (const item of solved) {
    const want = fingerprint(item.left);
    const hits = steps.filter((s) => fingerprint(s.canon) === want);
    if (hits.length !== 1) {
      console.log('NO UNIQUE ANCHOR', item.label, 'hits', hits.length);
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
    const block = job.intermediates.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
    lines.splice(job.afterLine + 1, 0, ...block);
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
  .map((l) => JSON.parse(l) as Fail);

const solved: Array<{ left: string; intermediates: string[]; label: string }> = [];
let open = 0;
for (const f of fails) {
  const thm = f.key.split('::')[1];
  console.log('solving', thm, 's' + f.step);
  const path = solveOne(f);
  if (!path || path.length === 0) {
    console.log('OPEN', thm, 's' + f.step);
    open++;
    continue;
  }
  const mids = path.slice(0, -1);
  if (mids.length === 0) {
    console.log('DIRECT', thm, 's' + f.step);
    continue;
  }
  console.log('CHAIN', thm, 's' + f.step, '+' + mids.length);
  solved.push({ left: f.left, intermediates: mids.map(toBook), label: `thm ${thm} step ${f.step}` });
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
