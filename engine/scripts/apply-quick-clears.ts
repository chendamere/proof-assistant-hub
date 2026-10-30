/**
 * Fast apply of known short chains unlocked by non-injective operand binding.
 */
import fs from 'fs';
import pathMod from 'path';
import { fileURLToPath } from 'url';
import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
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
];
const __dirname = pathMod.dirname(fileURLToPath(import.meta.url));
const texPath = pathMod.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');

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
function ensure(s: string) {
  let t = normalizeSpacing(
    fromOperatorFirst(s)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
  ).trim();
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
  return ensure(expr).replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
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
function just(a: string, b: string, pos: number) {
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

type Job = { left: string; mids: string[]; label: string };
const jobs: Job[] = [];
const fails = fs
  .readFileSync(pathMod.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

function addJob(thm: number, step: number, build: (L: string, R: string) => string[] | null) {
  const f = fails.find((x) => x.key.includes(`::${thm}::`) && x.step === step);
  if (!f) return;
  const pos = 13 * 100000 + thm;
  const L = ensure(f.left);
  const R = ensure(f.right);
  if (just(L, R, pos)) {
    console.log(thm, 's' + step, 'already direct');
    return;
  }
  const mids = build(L, R);
  if (!mids) {
    console.log(thm, 's' + step, 'OPEN');
    return;
  }
  // verify chain
  let cur = L;
  for (const mid of mids) {
    if (!just(cur, mid, pos)) {
      console.log(thm, 's' + step, 'broken mid', mid.slice(0, 60));
      return;
    }
    cur = mid;
  }
  if (cur !== R && !just(cur, R, pos)) {
    console.log(thm, 's' + step, 'does not reach R');
    return;
  }
  const final = cur === R ? mids : mids;
  console.log(thm, 's' + step, 'CHAIN +' + final.length);
  jobs.push({ left: f.left, mids: final, label: `thm ${thm} s${step}` });
}

// 100 s38: bubble Ps left past R(i_2), R(i_1), swap R pair
addJob(100, 38, (L, R) => {
  const a = topItems(L);
  const iPs = a.findIndex((x) => x === 'i_1 \\Ps i_2');
  const s1 = a.slice();
  [s1[iPs - 1], s1[iPs]] = [s1[iPs]!, s1[iPs - 1]!];
  const s2 = s1.slice();
  const iPs2 = s2.findIndex((x) => x === 'i_1 \\Ps i_2');
  [s2[iPs2 - 1], s2[iPs2]] = [s2[iPs2]!, s2[iPs2 - 1]!];
  const s3 = s2.slice();
  const iR1 = s3.findIndex((x) => x === 'R(i_1)');
  const iR2 = s3.findIndex((x) => x === 'R(i_2)');
  if (iR1 + 1 === iR2) [s3[iR1], s3[iR2]] = [s3[iR2]!, s3[iR1]!];
  const e3 = joinItems(s3);
  if (e3 !== R && e3 !== ensure(R)) return null;
  return [joinItems(s1), joinItems(s2)].filter((e) => e !== R);
});

// 124 s34
addJob(124, 34, (L, R) => {
  const flip = ensure(L.replace('i_1 \\Ps i,', 'i \\Ps i_1,'));
  const reord = ensure(flip.replace('i \\Ps i_1,i_1 \\Pu,', 'i_1 \\Pu,i \\Ps i_1,'));
  if (reord !== R) return null;
  return [flip];
});

// 124 s144
addJob(124, 144, (L, R) => {
  const m1 = ensure(L.replace(/,i \\Pu,/, ','));
  const m2 = ensure(m1.replace(/,i \\nPu,/, ','));
  if (m2 !== R) return null;
  return [m1];
});

// Apply
const raw0 = fs.readFileSync(texPath, 'utf8');
const nl = raw0.includes('\r\n') ? '\r\n' : '\n';
let lines = raw0.split(/\r?\n/);
const placed: Array<{ after: number; trail: string; mids: string[]; label: string }> = [];
for (const job of jobs) {
  if (!job.mids.length) continue;
  const want = fingerprint(job.left);
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
      placed.push({ after: end, trail: tm ? tm[1]! : '\\\\\\\\', mids: job.mids, label: job.label });
      break;
    }
  }
}
placed.sort((a, b) => b.after - a.after);
const used = new Set<number>();
let inserted = 0;
for (const p of placed) {
  if (used.has(p.after)) continue;
  used.add(p.after);
  const block = p.mids.map((m) => `\\Rq${bookBody(m)}${p.trail}`);
  lines.splice(p.after + 1, 0, ...block);
  inserted += block.length;
  console.log('inserted', block.length, p.label);
}
fs.writeFileSync(texPath, lines.join(nl) + (raw0.endsWith('\n') ? nl : ''));
console.log('done inserted=' + inserted);
