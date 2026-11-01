/**
 * 122 s4: slide Ps left past Bb (derived), then drop via operators-21.
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
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';

const CHAPTER = 'Rules_of_Relationship_of_Subnode';
const CO = [
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
  'Rules_of_Relationship_of_Subnode',
];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const texPath = path.join(root, `src/data/theorems/${CHAPTER}.tex`);

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
function bookBody(expr: string) {
  let body = toBook(expr).trim();
  if (!body.startsWith(',')) body = ',' + body;
  if (!body.endsWith(',')) body = body + ',';
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}
function tops(e: string): string[] {
  const items: string[] = [];
  let d = 0,
    s = 0;
  const x = ensure(e);
  for (let i = 0; i < x.length; i++) {
    if (x[i] === '{') d++;
    else if (x[i] === '}') d--;
    else if (x[i] === ',' && d === 0) {
      const p = x.slice(s, i).trim();
      if (p) items.push(p);
      s = i + 1;
    }
  }
  const t = x.slice(s).trim();
  if (t) items.push(t);
  return items;
}
function join(items: string[]) {
  return ensure(',' + items.join(',') + ',');
}
function posOf(id: string): number {
  const e = earlyRulePosition(id, CO);
  if (e != null) return e;
  if (axioms.some((r) => r.id === id) || definitions.some((r) => r.id === id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const f = CO.find((x) => x.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  return f ? CO.indexOf(f) * 100000 + parseInt(m[2]!, 10) + 1 : 999999999;
}

const all = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch16.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 4)!;
const L = ensure(f.left);
const R = ensure(f.right);
const a = tops(L);
const psIdx = a.findIndex((x) => /\\Ps /.test(x));
const bbIdx = a.findIndex((x) => x.startsWith('\\Bb'));
// move Ps to just after the two Obs (before first Bb)
const midItems = a.slice();
const [ps] = midItems.splice(psIdx, 1);
midItems.splice(bbIdx > psIdx ? bbIdx - 1 : bbIdx, 0, ps!);
// Actually: want Ob Ob Ps Bb Bb Os Os — find first Bb index in original
const firstBb = a.findIndex((x) => x.startsWith('\\Bb'));
const midItems2 = a.filter((x) => !/\\Ps /.test(x));
const insertAt = midItems2.findIndex((x) => x.startsWith('\\Bb'));
midItems2.splice(insertAt, 0, a[psIdx]!);
const mid = join(midItems2);

const pos = CO.indexOf(CHAPTER) * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a0: string, b0: string) {
  const A = ensure(a0);
  const B = ensure(b0);
  if (matchesDerivedBbTransition(A, B)) return 'derived';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}
console.log('L tops', tops(L).map((t) => t.slice(0, 22)));
console.log('mid tops', tops(mid).map((t) => t.slice(0, 22)));
console.log('R tops', tops(R).map((t) => t.slice(0, 22)));
console.log('L->mid', j(L, mid));
console.log('mid->R', j(mid, R));
if (!j(L, mid) || !j(mid, R)) {
  console.log('PATH FAIL');
  process.exit(1);
}

const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const want = fingerprint(L);
let anchor = -1;
let trail = '\\\\';
let inMath = false;
for (let i = 0; i < lines.length; i++) {
  if (/\\begin\{math\}/.test(lines[i]!)) {
    inMath = true;
    continue;
  }
  if (/\\end\{math\}/.test(lines[i]!)) {
    inMath = false;
    continue;
  }
  if (!inMath || !/\\Rq/.test(lines[i]!)) continue;
  let end = i;
  const tm0 = lines[i]!.match(/(\\+)\s*$/);
  if (tm0) trail = tm0[1]!;
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
  if (fingerprint(buf) === want) {
    if (anchor >= 0) {
      console.log('NONUNIQUE');
      process.exit(1);
    }
    anchor = end;
  }
  i = end;
}
if (anchor < 0) {
  console.log('NO ANCHOR');
  process.exit(1);
}
lines.splice(anchor + 1, 0, `\\Rq${bookBody(mid)}${trail}`);
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('inserted mid after', anchor + 1);
execSync('node scripts/extract-proof-steps.js', {
  cwd: root,
  stdio: 'pipe',
  maxBuffer: 64 * 1024 * 1024,
});
console.log('extracted');
