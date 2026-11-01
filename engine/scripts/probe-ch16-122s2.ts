import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { matchesDerivedBbTransition, matchesObBbOsUnzip } from '../src/inferenceRules/caseFocus';

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
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
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
const all = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 2)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4']);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (matchesDerivedBbTransition(A, B)) return 'derived';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (BLOCK.has(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const L = ensure(f.left);
const R = ensure(f.right);
console.log('L', tops(L).map((t) => t.slice(0, 28)));
console.log('R', tops(R).map((t) => t.slice(0, 28)));
console.log('direct', j(L, R));

// Path: zip first sandwich, move Ps, unzip
// L unzipped-ish: Ob1, Ob2, Ps, Bb1, Bb2, Os1, Os2
// zip first: Ob1, Bb1, Os1, Ob2, Ps, Bb2, Os2
const zip1 = join([
  'i \\Ob t_1',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,}',
  't_1 \\Os',
  'i \\Ob t_2',
  't_1 \\Ps t_2',
  '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}',
  't_2 \\Os',
]);
console.log('L->zip1', j(L, zip1), 'unzip?', matchesObBbOsUnzip(L, zip1));

// from zip1, swap Ps left past Ob2? or right past Bb2
const a = tops(zip1);
for (let i = 0; i < a.length - 1; i++) {
  const s = a.slice();
  const tmp = s[i]!;
  s[i] = s[i + 1]!;
  s[i + 1] = tmp;
  const rule = j(zip1, join(s));
  if (rule) console.log('zip1 swap', i, rule, a[i]!.slice(0, 20), '<->', a[i + 1]!.slice(0, 20));
}

// Fully zipped with Ps between sandwiches:
const zipPs = join([
  'i \\Ob t_1',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,}',
  't_1 \\Os',
  't_1 \\Ps t_2',
  'i \\Ob t_2',
  '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}',
  't_2 \\Os',
]);
console.log('L->zipPs', j(L, zipPs));
console.log('zip1->zipPs', j(zip1, zipPs));

// Goal R unzipped: Ob1, Ob2, Bb1, Ps, Bb2, Os1, Os2
// Partial zip of R: Ob1, Bb1, Os1, Ob2, Ps, Bb2, Os2 — same as moving Ps in zip1
const zipR = join([
  'i \\Ob t_1',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,}',
  't_1 \\Os',
  'i \\Ob t_2',
  't_1 \\Ps t_2',
  '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}',
  't_2 \\Os',
]);
// Actually want Ps between Bb1 and Bb2 in unzipped R.
// From zipPs: Ob1,Bb1,Os1, Ps, Ob2,Bb2,Os2 — swap Ps with Ob2?
const zipPs2 = join([
  'i \\Ob t_1',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,}',
  't_1 \\Os',
  'i \\Ob t_2',
  't_1 \\Ps t_2',
  '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}',
  't_2 \\Os',
]);
console.log('zipPs->zipPs2', j(zipPs, zipPs2));

// BFS depth 4 from L toward R with swaps + unzip/zip derived
type N = { e: string; path: string[] };
const seen = new Set([L]);
const q: N[] = [{ e: L, path: [] }];
const goal = R;
for (let d = 0; d < 5 && q.length; d++) {
  const batch = q.splice(0, q.length);
  console.log('bfs', d, batch.length);
  for (const { e, path } of batch) {
    if (e === goal) {
      console.log('FOUND', path);
      process.exit(0);
    }
    const items = tops(e);
    const nexts: string[] = [];
    for (let i = 0; i < items.length - 1; i++) {
      const s = items.slice();
      const tmp = s[i]!;
      s[i] = s[i + 1]!;
      s[i + 1] = tmp;
      nexts.push(join(s));
    }
    // also try known zips
    nexts.push(zip1, zipPs, zipPs2, R);
    for (const n of nexts) {
      if (seen.has(n)) continue;
      const rule = j(e, n);
      if (!rule) continue;
      seen.add(n);
      q.push({ e: n, path: [...path, rule] });
    }
  }
}
console.log('not found seen', seen.size);
