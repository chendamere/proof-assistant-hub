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
  let body = ensure(expr);
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}

const pos = 13 * 100000 + 124;
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  new Map()
);
function just(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

function arm(s: string) {
  return s.match(/\\Bb\{i \\Pu\}\{[^}]+\}/)?.[0] ?? '';
}

const jobs: Array<{ step: number; left: string; mids: string[] }> = [];

for (const step of [34, 103, 122, 144]) {
  const f = fails.find((x) => x.key.includes('::124::') && x.step === step)!;
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\n=== s' + step + ' ===');
  console.log('L arm', arm(L));
  console.log('R arm', arm(R));

  if (step === 144) {
    const m1 = ensure(L.replace(/,i \\Pu,/, ','));
    const m2 = ensure(m1.replace(/,i \\nPu,/, ','));
    console.log(just(L, m1), just(m1, m2), m2 === R);
    if (just(L, m1) && m2 === R) jobs.push({ step, left: f.left, mids: [m1] });
    continue;
  }

  // try flip i_1 Ps i → i Ps i_1
  let cur = L;
  const path: string[] = [];
  if (cur.includes('i_1 \\Ps i,')) {
    const flip = ensure(cur.replace('i_1 \\Ps i,', 'i \\Ps i_1,'));
    console.log('flip', just(cur, flip));
    if (just(cur, flip)) {
      path.push(flip);
      cur = flip;
    }
  }
  // swap Ps with Pu: i Ps i_1, i_1 Pu → i_1 Pu, i Ps i_1
  if (cur.includes('i \\Ps i_1,i_1 \\Pu,')) {
    const reord = ensure(cur.replace('i \\Ps i_1,i_1 \\Pu,', 'i_1 \\Pu,i \\Ps i_1,'));
    console.log('reord Pu', just(cur, reord), reord === R);
    if (just(cur, reord)) {
      path.push(reord);
      cur = reord;
    }
  }
  // swap Ps with nPu
  if (cur.includes('i_1 \\Ps i,i_1 \\nPu,') || cur.includes('i \\Ps i_1,i_1 \\nPu,')) {
    const a = cur.includes('i_1 \\Ps i,i_1 \\nPu,')
      ? ensure(cur.replace('i_1 \\Ps i,i_1 \\nPu,', 'i_1 \\nPu,i_1 \\Ps i,'))
      : ensure(cur.replace('i \\Ps i_1,i_1 \\nPu,', 'i_1 \\nPu,i \\Ps i_1,'));
    console.log('reord nPu', just(cur, a));
    if (just(cur, a)) {
      path.push(a);
      cur = a;
    }
  }
  // for s122: L has i_1 Ps i at start of nPu arm before i_1 nPu?
  console.log('cur==R', cur === R, 'direct leftover', just(cur, R));
  console.log('cur arm', arm(cur));
  if (cur === R || just(cur, R)) {
    const mids = cur === R ? path : path;
    if (cur !== R) {
      /* R is next hop; path mids are enough */
    }
    if (mids.length) jobs.push({ step, left: f.left, mids: cur === R ? mids : mids });
    else console.log('no mids needed?');
  }
}

// apply
const texPath = 'src/data/theorems/Rules_of_Node_Connectivity.tex';
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
      console.log('anchor s' + job.step, 'line', end);
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
}
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('inserted', inserted, 'jobs', jobs.map((j) => j.step));
