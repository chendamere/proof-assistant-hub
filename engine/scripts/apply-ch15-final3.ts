/**
 * Clear the last 3 ch15 fails: 28 s3, 115 s12, 115 s14.
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
    if (!justify(steps[i]!, steps[i + 1]!, pos)) {
      console.log('FAIL', i, ensure(steps[i]!).slice(0, 100));
      console.log('  →', ensure(steps[i + 1]!).slice(0, 100));
      return false;
    }
  }
  return true;
}

function solve28s3(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  const p: string[] = [];
  const add = (prev: string, next: string) => {
    p.push(ensure(next));
    return ensure(next);
  };
  let cur = L;
  cur = add(
    cur,
    ',i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,m \\Oc m_1,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,i_1 \\Os,m \\Oc m_1,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  cur = add(
    cur,
    ',i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,m \\Oc m_1,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,m \\Oc m_1,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  cur = add(
    cur,
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,\\Bb{i_1 \\Ps j}{,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  cur = add(
    cur,
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,\\Bb{i_1 \\Ps j}{,m_1 \\On,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,i_1 \\Os,m_1 \\On,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  cur = add(
    cur,
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,\\Bb{i_1 \\Ps j}{,m_1 \\On,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,m_1 \\On,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  cur = add(
    cur,
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_1,}{,m_1 \\Os,\\Tc c_2,},}{,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  // push i1 Os into inner Bb, one outer arm at a time
  cur = add(
    cur,
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,i_1 \\Os,m_1 \\Os,\\Tc c_1,}{,i_1 \\Os,m_1 \\Os,\\Tc c_2,},}{,i_1 \\Os,\\Bb{m_1 \\Ps n}{,m_1 \\Os,\\Tc c_3,}{,m_1 \\Os,\\Tc c_4,},},'
  );
  cur = add(
    cur,
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,i_1 \\Os,m_1 \\Os,\\Tc c_1,}{,i_1 \\Os,m_1 \\Os,\\Tc c_2,},}{,\\Bb{m_1 \\Ps n}{,i_1 \\Os,m_1 \\Os,\\Tc c_3,}{,i_1 \\Os,m_1 \\Os,\\Tc c_4,},},'
  );
  // reorder i1 Os, m1 Os → m1 Os, i1 Os in each of 4 inner arms
  const armOrder = [
    // true/true
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,m_1 \\Os,\\Tc c_2,},}{,\\Bb{m_1 \\Ps n}{,i_1 \\Os,m_1 \\Os,\\Tc c_3,}{,i_1 \\Os,m_1 \\Os,\\Tc c_4,},},',
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},}{,\\Bb{m_1 \\Ps n}{,i_1 \\Os,m_1 \\Os,\\Tc c_3,}{,i_1 \\Os,m_1 \\Os,\\Tc c_4,},},',
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_3,}{,i_1 \\Os,m_1 \\Os,\\Tc c_4,},},',
    ',i \\Oc i_1,i_1 \\On,m \\Oc m_1,m_1 \\On,\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_3,}{,m_1 \\Os,i_1 \\Os,\\Tc c_4,},},',
  ];
  for (const s of armOrder) cur = add(cur, s);
  // outer adjacent: A B C D Bb → C D A B Bb (A=i Oc, B=i1 On, C=m Oc, D=m1 On)
  const bb =
    '\\Bb{i_1 \\Ps j}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_1,}{,m_1 \\Os,i_1 \\Os,\\Tc c_2,},}{,\\Bb{m_1 \\Ps n}{,m_1 \\Os,i_1 \\Os,\\Tc c_3,}{,m_1 \\Os,i_1 \\Os,\\Tc c_4,},}';
  cur = add(cur, `,i \\Oc i_1,m \\Oc m_1,i_1 \\On,m_1 \\On,${bb},`); // B↔C
  cur = add(cur, `,m \\Oc m_1,i \\Oc i_1,i_1 \\On,m_1 \\On,${bb},`); // A↔C
  cur = add(cur, `,m \\Oc m_1,i \\Oc i_1,m_1 \\On,i_1 \\On,${bb},`); // B↔D
  cur = add(cur, `,m \\Oc m_1,m_1 \\On,i \\Oc i_1,i_1 \\On,${bb},`); // A↔D = R
  void cur;
  if (fingerprint(p[p.length - 1]!) === fingerprint(R) && chainOk([L, ...p], pos)) return p;
  console.log('28 last', p[p.length - 1]);
  console.log('28 want', R);
  return null;
}

function solve115s14(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  const a = ensure(
    ',\\Bb{i \\Pn j}{,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\Os,\\Tc c_2,},'
  );
  const b = ensure(
    ',\\Bb{i \\Pn j}{,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,\\Tc c_2,},'
  );
  const c = ensure(',\\Bb{i \\Pn j}{,\\Bb{i \\Pn j}{,\\Tc c_1,}{,\\Tc c_3,},}{,\\Tc c_2,},');
  const path = [a, b, c];
  if (fingerprint(c) === fingerprint(R) && chainOk([L, ...path], pos)) return path;
  return null;
}

function solve115s12(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  // On-first: swap Ons → push On → bubble Oc past On → push Oc → Os to front in each arm
  const full = [
    ensure(
      ',i \\Oc i_1,i \\Oc i_2,i_2 \\On,i_1 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
    ),
    ensure(
      ',i \\Oc i_1,i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_1 \\On,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
    ),
    ensure(
      ',i \\Oc i_2,i \\Oc i_1,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_1 \\On,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
    ),
    ensure(
      ',i \\Oc i_2,i_2 \\On,i \\Oc i_1,\\Bb{i_2 \\Ps j}{,i_1 \\On,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
    ),
    ensure(
      ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
    ),
    ensure(
      ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i \\Oc i_1,i_2 \\Os,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
    ),
    ensure(
      ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_1 \\On,i_2 \\Os,i_1 \\Os,\\Tc c_2,},'
    ),
    ensure(
      ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i \\Oc i_1,i_2 \\Os,i_1 \\On,i_1 \\Os,\\Tc c_2,},'
    ),
    ensure(
      ',i \\Oc i_2,i_2 \\On,\\Bb{i_2 \\Ps j}{,i_2 \\Os,i \\Oc i_1,i_1 \\On,\\Bb{i_1 \\Ps j}{,i_1 \\Os,\\Tc c_1,}{,i_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i \\Oc i_1,i_1 \\On,i_1 \\Os,\\Tc c_2,},'
    ),
  ];
  if (chainOk([L, ...full], pos) && fingerprint(full[full.length - 1]!) === fingerprint(R)) return full;
  let prev = L;
  for (let i = 0; i < full.length; i++) {
    const ok = justify(prev, full[i]!, pos);
    console.log('115s12 hop', i, ok);
    if (!ok) {
      console.log(' from', prev.slice(0, 120));
      console.log(' to  ', full[i]!.slice(0, 120));
      return null;
    }
    prev = full[i]!;
  }
  console.log('115 end fp', fingerprint(full[full.length - 1]!), 'want', fingerprint(R));
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
  const jobs: Array<{ afterLine: number; trail: string; intermediates: string[]; label: string }> = [];
  for (const item of solved) {
    const want = fingerprint(item.left);
    const hits = steps.filter((s) => fingerprint(s.canon) === want);
    if (hits.length !== 1) {
      console.log('NO UNIQUE ANCHOR', item.label, hits.length);
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
    lines.splice(
      job.afterLine + 1,
      0,
      ...job.intermediates.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`)
    );
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
  .map((l) => JSON.parse(l) as { key: string; step: number; left: string; right: string });

const solved: Array<{ left: string; intermediates: string[]; label: string }> = [];
for (const f of fails) {
  const thm = f.key.split('::')[1]!;
  const pos = keyPos(f.key);
  console.log('solving', thm, 's' + f.step);
  let path: string[] | null = null;
  if (thm === '28' && f.step === 3) path = solve28s3(f.left, f.right, pos);
  if (thm === '115' && f.step === 14) path = solve115s14(f.left, f.right, pos);
  if (thm === '115' && f.step === 12) path = solve115s12(f.left, f.right, pos);
  if (!path) {
    console.log('OPEN', thm, 's' + f.step);
    continue;
  }
  const mids = path.slice(0, -1);
  console.log('CHAIN', thm, 's' + f.step, '+' + mids.length);
  if (mids.length)
    solved.push({ left: f.left, intermediates: mids.map(toBook), label: `thm ${thm} step ${f.step}` });
}
const inserted = applyChains(solved);
console.log('inserted', inserted);
if (inserted > 0) {
  execSync('node scripts/extract-proof-steps.js', {
    cwd: root,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });
}
