/**
 * For fails that look like duplicate-Ps / R-reorder, search the drop→r-27→swap path.
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

function trySolve(L0: string, R0: string, pos: number): string[] | null {
  const goal = ensure(R0);
  let cur = ensure(L0);
  const path: string[] = [];
  const seen = new Set([cur]);
  for (let step = 0; step < 16 && cur !== goal; step++) {
    const candidates: string[] = [];
    // drop adjacent duplicate Ps
    candidates.push(
      ...cur.replace(
        /,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),\1 \\Ps \2,/g,
        `,\$1 \\Ps \$2,`
      ) === cur
        ? []
        : [cur.replace(/,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),\1 \\Ps \2,/, `,$1 \\Ps $2,`)]
    );
    // r-27 style
    {
      const re = /,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),R\(\1\),R\(\2\),/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cur))) {
        candidates.push(
          cur.slice(0, m.index) +
            `,${m[1]} \\Ps ${m[2]},R(${m[1]}),R(${m[2]}),${m[1]} \\Ps ${m[2]},` +
            cur.slice(m.index + m[0].length)
        );
      }
    }
    // adjacent swaps
    const items = topItems(cur);
    for (let i = 0; i < items.length - 1; i++) {
      const swapped = items.slice();
      const tmp = swapped[i]!;
      swapped[i] = swapped[i + 1]!;
      swapped[i + 1] = tmp;
      candidates.push(joinItems(swapped));
    }

    let best: { e: string; d: number } | null = null;
    const startD = [...cur].reduce((n, c, i) => n + (c !== goal[i] ? 1 : 0), Math.abs(cur.length - goal.length));
    for (const raw of candidates) {
      const e = ensure(raw);
      if (seen.has(e) || e === cur) continue;
      if (!justify(cur, e, pos)) continue;
      const d = [...e].reduce((n, c, i) => n + (c !== goal[i] ? 1 : 0), Math.abs(e.length - goal.length));
      if (e === goal || d < startD) {
        if (!best || d < best.d || e === goal) best = { e, d };
      }
    }
    if (!best) return path.length ? path : null;
    path.push(best.e);
    seen.add(best.e);
    cur = best.e;
  }
  return cur === goal ? path : path.length ? path : null;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const seen = new Set<string>();
const uniq = fails.filter((f) => {
  const id = `${f.key}::${f.step}::${f.left}`;
  if (seen.has(id)) return false;
  seen.add(id);
  return true;
});

const jobs: Array<{ left: string; mids: string[]; trail: string; after: number }> = [];
for (const f of uniq) {
  const thm = parseInt(f.key.split('::')[1] ?? '0', 10);
  const pos = 13 * 100000 + thm;
  const path = trySolve(f.left, f.right, pos);
  if (!path || path.length === 0) {
    console.log('OPEN', thm, 's', f.step);
    continue;
  }
  const complete = ensure(path[path.length - 1]!) === ensure(f.right);
  const mids = complete ? path.slice(0, -1) : path.slice(0, Math.min(6, path.length));
  if (mids.length === 0) {
    console.log('DIRECT', thm, 's', f.step);
    continue;
  }
  console.log(complete ? 'CHAIN' : 'PARTIAL', thm, 's', f.step, '+', mids.length);
  // find anchor
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
      jobs.push({ left: f.left, mids, trail: tm ? tm[1]! : '\\\\\\\\', after: end });
      break;
    }
  }
}

jobs.sort((a, b) => b.after - a.after);
const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
let inserted = 0;
const used = new Set<number>();
for (const job of jobs) {
  if (used.has(job.after)) continue;
  used.add(job.after);
  const block = job.mids.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
  lines.splice(job.after + 1, 0, ...block);
  inserted += block.length;
}
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('inserted', inserted, 'jobs', jobs.length);
