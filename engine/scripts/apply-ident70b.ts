/** Continue identical-70 / drop / 200 / 202 s9 with fixed next=R-only anchors. */
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
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < 13 * 100000 + 202),
  new Map()
);
function justify(a: string, b: string, maxPos: number, allowEmptyLhs = false) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.pos >= maxPos) continue;
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (!allowEmptyLhs && rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',')
      continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function insert(L: string, R: string, mids: string[], label: string) {
  const finalMids = mids.filter((m) => ensure(m) !== ensure(R));
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(L);
  const wantR = fingerprint(R);
  const anchors: { end: number; trail: string }[] = [];
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
    if (fingerprint(joined) !== want) continue;
    let ns = end + 1;
    while (ns < lines.length && !/\\Rq/.test(lines[ns]!) && lines[ns]!.trim()) ns++;
    if (ns >= lines.length || !/\\Rq/.test(lines[ns]!)) continue;
    let ne = ns;
    while (ne + 1 < lines.length) {
      const nxt = lines[ne + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      ne++;
    }
    const nextJoined = lines
      .slice(ns, ne + 1)
      .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
      .join(' ');
    if (fingerprint(nextJoined) !== wantR) continue;
    const tm = lines[end]!.match(/(\\+)\s*$/);
    anchors.push({ end, trail: tm ? tm[1]! : '\\\\\\\\' });
  }
  if (anchors.length !== 1) {
    console.log('NO/AMBIG', label, 'anchors', anchors.length);
    return false;
  }
  const a = anchors[0]!;
  const block = finalMids.map((mid) => `\\Rq${bookBody(mid)}${a.trail}`);
  if (!block.length) {
    console.log('EMPTY', label);
    return false;
  }
  lines.splice(a.end + 1, 0, ...block);
  fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
  console.log('OK', label, '+' + block.length);
  return true;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

const jobs: Array<{ L: string; R: string; mids: string[]; label: string }> = [];

function queueDup(f: any, atom: string, add: boolean) {
  const thm = parseInt(f.key.split('::')[1]!, 10);
  const pos = 13 * 100000 + thm;
  const L = ensure(f.left);
  const R = ensure(f.right);
  const label = `${thm} s${f.step}`;
  const mid = add
    ? ensure(L.replace(`,${atom},`, `,${atom},${atom},`))
    : ensure(L.replace(`,${atom},${atom},`, `,${atom},`));
  if (mid === L) {
    console.log(label, 'nochange');
    return;
  }
  const j = justify(L, mid, pos);
  console.log(label, add ? 'add' : 'drop', j ?? 'FAIL', mid === R ? '=R' : '');
  if (!j) return;
  if (mid !== R && !justify(mid, R, pos)) {
    console.log(label, 'incomplete');
    return;
  }
  jobs.push({ L, R, mids: mid === R ? [] : [mid], label });
}

for (const f of fails) {
  const thm = parseInt(f.key.split('::')[1]!, 10);
  const step = f.step;
  if (thm === 202 && step === 5) queueDup(f, 'j_2 \\Ps j_1', true);
  if (thm === 202 && step === 9) queueDup(f, 'j_2 \\Ps j_1', false);
  if (thm === 100 && step === 11) queueDup(f, 'i_1 \\Ps i_2', true);
  if (thm === 100 && step === 15) queueDup(f, 'i_1 \\Ps i_2', false);
  if (thm === 100 && step === 31) queueDup(f, 'j_1 \\Ps j_2', true);
  if (thm === 100 && step === 33) queueDup(f, 'j_1 \\Ps j_2', false);
  if (thm === 124 && step === 38) queueDup(f, 'i \\Ps i_1', true);
  if (thm === 124 && step === 47) queueDup(f, 'i_1 \\Ps i_2', true);
  if (thm === 124 && step === 70) queueDup(f, 'i \\Ps i_1', true);

  // 200: drop i Ps i1 via rev copy-identical, then drop i1 Pu via ? 
  if (thm === 200 && step === 14) {
    const pos = 13 * 100000 + 200;
    const L = ensure(f.left);
    const R = ensure(f.right);
    const mid = ensure(L.replace(',i \\Oc i_1,i \\Ps i_1,i_1 \\Pu,R(i_1),', ',i \\Oc i_1,i_1 \\Pu,R(i_1),'));
    console.log('200 mid1', justify(L, mid, pos) ?? 'FAIL');
    // drop i1 Pu — maybe null rule with Pe? Or just adjacent to something
    const cands = [
      mid.replace(',i_1 \\Pu,R(i_1),', ',R(i_1),'),
      mid.replace(',i \\Oc i_1,i_1 \\Pu,', ',i \\Oc i_1,'),
      ensure(R),
    ];
    for (const c of cands) {
      const e = ensure(c);
      if (e === mid) continue;
      const j = justify(mid, e, pos, true);
      console.log('200 mid2', j ?? 'FAIL');
      if (j && (e === R || justify(e, R, pos))) {
        jobs.push({ L, R, mids: [mid, ...(e === R ? [] : [e])], label: '200 s14' });
        break;
      }
    }
  }

  // 124 s99: drop empty Bb then reorder
  if (thm === 124 && step === 99) {
    const pos = 13 * 100000 + 124;
    const L = ensure(f.left);
    const R = ensure(f.right);
    const mid = ensure(L.replace(',\\Bb{i \\Pu}{,}{,},', ','));
    const j = justify(L, mid, pos, true);
    console.log('124 s99', j ?? 'FAIL');
    if (j) {
      if (mid === R || justify(mid, R, pos)) {
        jobs.push({ L, R, mids: mid === R ? [] : [mid], label: '124 s99' });
      } else {
        // reorder j Oc past i On etc
        console.log('124 s99 mid', mid);
        console.log('124 s99 R  ', R);
      }
    }
  }
}

// Apply from bottom of file
jobs.sort((a, b) => {
  // sort by tex position descending via fingerprint search later — just apply sequentially re-reading
  return 0;
});

for (const job of jobs) {
  insert(job.L, job.R, job.mids, job.label);
}
console.log('jobs', jobs.length);
