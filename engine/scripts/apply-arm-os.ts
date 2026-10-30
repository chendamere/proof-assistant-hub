/**
 * Fill Bb/Blb arm-internal Os (etc.) reorder fails by target-aware adjacent swaps.
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

function solveArmReorder(L0: string, R0: string, pos: number): string[] | null {
  const goal = ensure(R0);
  let cur = ensure(L0);
  if (cur === goal || justify(cur, goal, pos)) return [];
  const path: string[] = [];
  const seen = new Set([cur]);

  for (let step = 0; step < 48 && cur !== goal; step++) {
    if (justify(cur, goal, pos)) return path;

    const mL = cur.match(/\\B(lb|b)\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/);
    const mR = goal.match(/\\B(lb|b)\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/);
    if (!mL || !mR || mL[1] !== mR[1] || mL[2] !== mR[2]) return null;

    const arms: Array<{ which: 'true' | 'false'; curArm: string; goalArm: string }> = [
      { which: 'true', curArm: mL[3]!, goalArm: mR[3]! },
      { which: 'false', curArm: mL[4]!, goalArm: mR[4]! },
    ];

    let best: { e: string; d: number } | null = null;
    for (const { which, curArm, goalArm } of arms) {
      if (curArm === goalArm) continue;
      const toks = curArm.split(',');
      const startD = armDist(curArm, goalArm);
      for (let i = 0; i < toks.length - 1; i++) {
        // Prefer swapping Os/flags; allow Tc stay put
        const sw = toks.slice();
        [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
        const newArm = sw.join(',');
        const d = armDist(newArm, goalArm);
        if (d > startD) continue;
        let next: string;
        if (which === 'true') {
          next = ensure(
            cur.replace(
              `\\B${mL[1]}{${mL[2]}}{,${curArm}}{,${mL[4]}}`,
              `\\B${mL[1]}{${mL[2]}}{,${newArm}}{,${mL[4]}}`
            )
          );
        } else {
          next = ensure(
            cur.replace(
              `\\B${mL[1]}{${mL[2]}}{,${mL[3]}}{,${curArm}}`,
              `\\B${mL[1]}{${mL[2]}}{,${mL[3]}}{,${newArm}}`
            )
          );
        }
        if (seen.has(next) || next === cur) continue;
        if (!justify(cur, next, pos)) continue;
        const score = d + (next === goal ? -100 : 0);
        if (!best || score < best.d) best = { e: next, d: score };
      }
    }
    if (!best) return null;
    path.push(best.e);
    seen.add(best.e);
    cur = best.e;
  }
  return cur === goal ? (path[path.length - 1] === goal ? path.slice(0, -1) : path) : null;
}

const targets = [
  { thm: 108, step: 250 },
  { thm: 108, step: 358 },
  { thm: 108, step: 236 },
  { thm: 108, step: 344 },
];
const failFile = fs.existsSync(path.join(__dirname, 'out/recheck-ch14.jsonl'))
  ? path.join(__dirname, 'out/recheck-ch14.jsonl')
  : path.join(__dirname, 'out/proof-step-failures.jsonl');
const fails = fs
  .readFileSync(failFile, 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
console.log('using', failFile);

type Job = { after: number; trail: string; mids: string[]; label: string };
const jobs: Job[] = [];

for (const t of targets) {
  const f = fails.find((x) => x.key.includes(`::${t.thm}::`) && x.step === t.step);
  if (!f) {
    console.log('missing fail', t);
    continue;
  }
  const pos = 13 * 100000 + t.thm;
  const t0 = Date.now();
  const chain = solveArmReorder(f.left, f.right, pos);
  console.log(t.thm, 's' + t.step, chain ? `CHAIN +${chain.length}` : 'OPEN', Date.now() - t0 + 'ms');
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
      jobs.push({
        after: end,
        trail: tm ? tm[1]! : '\\\\\\\\',
        mids: chain,
        label: `thm ${t.thm} s${t.step}`,
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
  const block = job.mids.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
  lines.splice(job.after + 1, 0, ...block);
  inserted += block.length;
  console.log('inserted', block.length, job.label);
}
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('done inserted=' + inserted);
