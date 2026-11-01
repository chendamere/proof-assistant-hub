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
const Bb1 = '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,}';
const Bb2 = '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,}';

// Zip fully (no Ps): Ob1 Bb1 Os1 Ob2 Bb2 Os2
const fullZip = join(['i \\Ob t_1', Bb1, 't_1 \\Os', 'i \\Ob t_2', Bb2, 't_2 \\Os']);
// Drop Ps from L then zip?
const noPs = join(['i \\Ob t_1', 'i \\Ob t_2', Bb1, Bb2, 't_1 \\Os', 't_2 \\Os']);
console.log('L->noPs', j(L, noPs));
console.log('noPs unzip?', matchesObBbOsUnzip(noPs, fullZip));
console.log('noPs->fullZip', j(noPs, fullZip));

// Add Ps into zipped between sandwiches
const zipMidPs = join(['i \\Ob t_1', Bb1, 't_1 \\Os', 't_1 \\Ps t_2', 'i \\Ob t_2', Bb2, 't_2 \\Os']);
console.log('fullZip->zipMidPs', j(fullZip, zipMidPs));

// From L: drop Ps by reverse copy? need Oc. Or identical drop needs pair.

// Partial: move Ps right by unzipping one sandwich around it
// L = Ob1 Ob2 Ps Bb1 Bb2 Os1 Os2
// -> Ob1 Bb1 Os1 Ob2 Ps Bb2 Os2  (zip first only) via derived?
const partial = join(['i \\Ob t_1', Bb1, 't_1 \\Os', 'i \\Ob t_2', 't_1 \\Ps t_2', Bb2, 't_2 \\Os']);
console.log('L->partial derived?', matchesObBbOsUnzip(L, partial));
console.log('L->partial', j(L, partial));

// Custom: allow zip of prefix sandwich when suffix is Ob,Ps,Bb,Os matching
function tryPartialZip(from: string, to: string) {
  return j(from, to);
}

// Goal R = Ob1 Ob2 Bb1 Ps Bb2 Os1 Os2
// From partial Ob1 Bb1 Os1 Ob2 Ps Bb2 Os2: unzip first sandwich only?
const towardR = join(['i \\Ob t_1', 'i \\Ob t_2', Bb1, 't_1 \\Ps t_2', Bb2, 't_1 \\Os', 't_2 \\Os']);
console.log('partial->towardR', j(partial, towardR));
console.log('towardR->R', j(towardR, R));
console.log('R tops', tops(R).map((t) => t.slice(0, 24)));
console.log('towardR tops', tops(towardR).map((t) => t.slice(0, 24)));
