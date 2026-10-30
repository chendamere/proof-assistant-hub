/** Fill 108 s250-style: Bb arm Os reorder only (top-level Bb atom differs as a whole). */
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

console.log('imports ok', theorems.length);

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
const pos = 13 * 100000 + 108;
const before = allRules.filter((r) => r.pos < pos);
console.log('building index for', before.length, 'rules…');
const index = buildRuleIndex(before, dag);
console.log('index ready');
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function armDist(arm: string, goal: string): number {
  const A = arm.split(',');
  const B = goal.split(',');
  let d = Math.abs(A.length - B.length) * 5;
  for (let i = 0; i < A.length; i++) {
    const j = B.indexOf(A[i]!);
    d += j < 0 ? 8 : Math.abs(i - j);
  }
  return d;
}

function solve(L0: string, R0: string): string[] | null {
  const goal = ensure(R0);
  let cur = ensure(L0);
  if (cur === goal) return [];
  if (justify(cur, goal)) return [];
  const path: string[] = [];
  const seen = new Set([cur]);
  for (let step = 0; step < 40 && cur !== goal; step++) {
    if (justify(cur, goal)) return path;
    const mL = cur.match(/\\Bb\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/);
    const mR = goal.match(/\\Bb\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/);
    if (!mL || !mR || mL[1] !== mR[1]) return null;
    let best: { e: string; d: number } | null = null;
    for (const which of ['true', 'false'] as const) {
      const curArm = which === 'true' ? mL[2]! : mL[3]!;
      const goalArm = which === 'true' ? mR[2]! : mR[3]!;
      if (curArm === goalArm) continue;
      const toks = curArm.split(',');
      const startD = armDist(curArm, goalArm);
      for (let i = 0; i < toks.length - 1; i++) {
        const sw = toks.slice();
        [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
        const newArm = sw.join(',');
        const d = armDist(newArm, goalArm);
        if (d > startD) continue;
        let next: string;
        if (which === 'true') {
          next = ensure(
            cur.replace(
              `\\Bb{${mL[1]}}{,${curArm}}{,${mL[3]}}`,
              `\\Bb{${mL[1]}}{,${newArm}}{,${mL[3]}}`
            )
          );
        } else {
          next = ensure(
            cur.replace(
              `\\Bb{${mL[1]}}{,${mL[2]}}{,${curArm}}`,
              `\\Bb{${mL[1]}}{,${mL[2]}}{,${newArm}}`
            )
          );
        }
        if (seen.has(next) || next === cur) continue;
        if (!justify(cur, next)) continue;
        if (!best || d < best.d) best = { e: next, d };
      }
    }
    if (!best) return null;
    path.push(best.e);
    seen.add(best.e);
    cur = best.e;
  }
  return cur === goal ? (path[path.length - 1] === goal ? path.slice(0, -1) : path) : null;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

const jobs: Array<{ after: number; trail: string; mids: string[]; label: string }> = [];
for (const step of [250, 358]) {
  const f = fails.find((x) => x.key.includes('::108::') && x.step === step);
  if (!f) {
    console.log('missing', step);
    continue;
  }
  const t0 = Date.now();
  const chain = solve(f.left, f.right);
  console.log('s' + step, chain ? `CHAIN +${chain.length}` : 'OPEN', Date.now() - t0 + 'ms');
  if (!chain || !chain.length) continue;
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
      jobs.push({ after: end, trail: tm ? tm[1]! : '\\\\\\\\', mids: chain, label: 's' + step });
      break;
    }
  }
}
jobs.sort((a, b) => b.after - a.after);
const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
let inserted = 0;
for (const job of jobs) {
  const block = job.mids.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
  lines.splice(job.after + 1, 0, ...block);
  inserted += block.length;
  console.log('inserted', block.length, job.label);
}
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('done', inserted);
