import fs from 'fs';
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

const dag = new Map();
function makeIndex(pos: number) {
  return buildRuleIndex(
    [...axioms, ...definitions, ...theorems]
      .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
      .filter((r) => r.pos < pos),
    dag
  );
}
function just(a: string, b: string, index: ReturnType<typeof buildRuleIndex>) {
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (rule.id.includes('equiv-code')) continue;
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return rule.id;
  }
  return null;
}

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const texPath = 'src/data/theorems/Rules_of_Node_Connectivity.tex';
const jobs: Array<{ left: string; mids: string[] }> = [];

// 100 s38
{
  console.log('index 100…');
  const index = makeIndex(13 * 100000 + 100);
  const f = fails.find((x) => x.key.includes('::100::') && x.step === 38)!;
  const L = ensure(f.left);
  const R = ensure(f.right);
  const a = topItems(L);
  const iPs = a.findIndex((x) => x === 'i_1 \\Ps i_2');
  const s1 = a.slice();
  [s1[iPs - 1], s1[iPs]] = [s1[iPs]!, s1[iPs - 1]!];
  const s2 = s1.slice();
  const iPs2 = s2.findIndex((x) => x === 'i_1 \\Ps i_2');
  [s2[iPs2 - 1], s2[iPs2]] = [s2[iPs2]!, s2[iPs2 - 1]!];
  const e1 = joinItems(s1);
  const e2 = joinItems(s2);
  console.log('38', just(L, e1, index), just(e1, e2, index), just(e2, R, index));
  jobs.push({ left: f.left, mids: [e1, e2] });
}

// 124 s34
{
  console.log('index 124…');
  const index = makeIndex(13 * 100000 + 124);
  const f = fails.find((x) => x.key.includes('::124::') && x.step === 34)!;
  const L = ensure(f.left);
  const R = ensure(f.right);
  const flip = ensure(L.replace('i_1 \\Ps i,', 'i \\Ps i_1,'));
  console.log('34', just(L, flip, index), just(flip, R, index), flip !== R);
  jobs.push({ left: f.left, mids: [flip] });
}

// 124 s144
{
  const index = makeIndex(13 * 100000 + 124);
  const f = fails.find((x) => x.key.includes('::124::') && x.step === 144)!;
  const L = ensure(f.left);
  const R = ensure(f.right);
  const m1 = ensure(L.replace(/,i \\Pu,/, ','));
  console.log('144', just(L, m1, index), just(m1, R, index));
  jobs.push({ left: f.left, mids: [m1] });
}

const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const placed: Array<{ after: number; trail: string; mids: string[] }> = [];
for (const job of jobs) {
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
      placed.push({ after: end, trail: tm ? tm[1]! : '\\\\\\\\', mids: job.mids });
      break;
    }
  }
}
placed.sort((a, b) => b.after - a.after);
let inserted = 0;
for (const p of placed) {
  const block = p.mids.map((m) => `\\Rq${bookBody(m)}${p.trail}`);
  lines.splice(p.after + 1, 0, ...block);
  inserted += block.length;
  console.log('inserted', block.length, 'at', p.after);
}
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('done', inserted);
