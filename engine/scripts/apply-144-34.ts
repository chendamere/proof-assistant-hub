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

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const dag = new Map();
function indexBefore(pos: number) {
  return buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    dag
  );
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

function applyJobs(jobs: Array<{ left: string; mids: string[]; label: string }>) {
  const raw0 = fs.readFileSync(texPath, 'utf8');
  const nl = raw0.includes('\r\n') ? '\r\n' : '\n';
  let lines = raw0.split(/\r?\n/);
  const placed: Array<{ after: number; trail: string; mids: string[]; label: string }> = [];
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
        placed.push({ after: end, trail: tm ? tm[1]! : '\\\\\\\\', mids: job.mids, label: job.label });
        break;
      }
    }
  }
  placed.sort((a, b) => b.after - a.after);
  const used = new Set<number>();
  let inserted = 0;
  for (const job of placed) {
    if (used.has(job.after)) continue;
    used.add(job.after);
    const block = job.mids.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
    lines.splice(job.after + 1, 0, ...block);
    inserted += block.length;
    console.log('inserted', block.length, job.label);
  }
  fs.writeFileSync(texPath, lines.join(nl) + (raw0.endsWith('\n') ? nl : ''));
  console.log('done inserted=' + inserted);
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

const jobs: Array<{ left: string; mids: string[]; label: string }> = [];

// 124 s144
{
  const f = fails.find((x) => x.key.includes('::124::') && x.step === 144)!;
  const pos = 13 * 100000 + 124;
  const L = ensure(f.left);
  const R = ensure(f.right);
  const mid1 = ensure(L.replace(/,i \\Pu,/, ','));
  const mid2 = ensure(mid1.replace(/,i \\nPu,/, ','));
  console.log('144', justify(L, mid1, pos), justify(mid1, mid2, pos), mid2 === R);
  if (justify(L, mid1, pos) && justify(mid1, mid2, pos) && mid2 === R) {
    jobs.push({ left: f.left, mids: [mid1], label: 'thm 124 s144' });
  }
}

// 124 s34
{
  const f = fails.find((x) => x.key.includes('::124::') && x.step === 34)!;
  const pos = 13 * 100000 + 124;
  const L = ensure(f.left);
  const R = ensure(f.right);
  const flip = ensure(L.replace('i_1 \\Ps i,', 'i \\Ps i_1,'));
  console.log('34 flip', justify(L, flip, pos));
  const reord = ensure(flip.replace('i \\Ps i_1, i_1 \\Pu,', 'i_1 \\Pu, i \\Ps i_1,'));
  console.log('34 reord', justify(flip, reord, pos), reord === R);
  if (justify(L, flip, pos) && justify(flip, reord, pos) && reord === R) {
    jobs.push({ left: f.left, mids: [flip], label: 'thm 124 s34' });
  } else if (justify(L, flip, pos) && justify(flip, R, pos)) {
    jobs.push({ left: f.left, mids: [flip], label: 'thm 124 s34' });
  } else {
    console.log('34 L arm…', L.match(/\\Bb\{i \\Pu\}\{[^}]+\}/)?.[0]?.slice(0, 120));
    console.log('34 R arm…', R.match(/\\Bb\{i \\Pu\}\{[^}]+\}/)?.[0]?.slice(0, 120));
    console.log('34 flip arm', flip.match(/\\Bb\{i \\Pu\}\{[^}]+\}/)?.[0]?.slice(0, 120));
    console.log('34 reord arm', reord.match(/\\Bb\{i \\Pu\}\{[^}]+\}/)?.[0]?.slice(0, 120));
  }
}

// 124 s103 similar flip
{
  const f = fails.find((x) => x.key.includes('::124::') && x.step === 103)!;
  const pos = 13 * 100000 + 124;
  const L = ensure(f.left);
  const R = ensure(f.right);
  // L nPu arm: i_1 Ps i → R: i Ps i_1
  const flip = ensure(L.replace('i_1 \\Ps i,', 'i \\Ps i_1,'));
  console.log('103 flip', justify(L, flip, pos), flip === R, justify(flip, R, pos));
  if (justify(L, flip, pos) && (flip === R || justify(flip, R, pos))) {
    const mids = flip === R ? [] : [flip];
    if (mids.length) jobs.push({ left: f.left, mids, label: 'thm 124 s103' });
    else console.log('103 direct after flip == R');
  }
}

// 124 s122
{
  const f = fails.find((x) => x.key.includes('::124::') && x.step === 122)!;
  const pos = 13 * 100000 + 124;
  const L = ensure(f.left);
  const R = ensure(f.right);
  const flip = ensure(L.replace('i_1 \\Ps i,', 'i \\Ps i_1,'));
  console.log('122 flip', justify(L, flip, pos), flip === R);
  if (justify(L, flip, pos) && flip === R) {
    // direct - no mids; but then why fail? unless flip isn't enough
    console.log('122 should be direct via thm-Ps-symmetric? direct', justify(L, R, pos));
  } else if (justify(L, flip, pos)) {
    // may need reorder: L has i_1 Ps i first in nPu arm, R has i Ps i_1 after i_1 nPu
    // L: {,i_1 nPu, i_1 Ps i, ...} wait look at fail dump
    // L: {,i_1 nPu, i_1 Ps i, i_1 On, ...} no
    // L: {,i_1 nPu? actually: i_1 Ps i, i_1 nPu? 
    // From dump: L nPu arm starts i_1 Ps i, i_1 nPu? 
    // L: `{,i_1 \nPu,i \Ps i_1,...}` vs R - check dump again
    console.log('122 L', L);
    console.log('122 R', R);
  }
}

applyJobs(jobs);
