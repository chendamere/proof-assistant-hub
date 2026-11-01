import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

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
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 14)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4']);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (BLOCK.has(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

console.log('L', f.left);
console.log('R', f.right);
console.log('direct', j(f.left, f.right));

// Book: double Pn -> Pe via create-temp/next. Standalone:
console.log('Pn Pn -> Pe', j(',s_2 \\Pn s_2,s_2 \\Pn s_2,', ',s_1 \\Pe s_2,'));
console.log('Ot Ot Pn Pn', j(',\\Ot s_1,\\Ot s_2,s_2 \\Pn s_2,s_2 \\Pn s_2,', ',\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,'));

// Known: axioms create-temp Pe: Ot i, Ot j, i Pe j
const ax = all.find((r) => /\\Ot i, \\Ot j, i \\Pe j/.test(r.rightSide) || r.rightSide.includes('\\Ot i, \\Ot j'));
console.log('ax', ax?.id, ax?.leftSide, '=>', ax?.rightSide);

// Path inside Bb: reorder Od, then apply Pe formation
const midOd = f.left.replace(
  '{,i \\Od s_2,i \\Od s_1,}',
  '{,i \\Od s_1,i \\Od s_2,}'
);
console.log('L->midOd', j(f.left, midOd));
console.log('midOd->R', j(midOd, f.right));

// With Pe only in true first
const midPeTrue = f.left
  .replace('s_2 \\Pn s_2,s_2 \\Pn s_2,', 's_1 \\Pe s_2,')
  .replace('{,i \\Od s_2,i \\Od s_1,}', '{,i \\Od s_1,i \\Od s_2,}');
console.log('L->midPeTrue', j(f.left, midPeTrue));
console.log('midPeTrue->R', j(midPeTrue, f.right));

// reverse operators-3 style: Ot s2, s2 Pn s2
const rules = all.filter(
  (r) =>
    r.pos < pos &&
    /\\Pn/.test(r.leftSide + r.rightSide) &&
    /\\Pe/.test(r.leftSide + r.rightSide) &&
    r.leftSide.length < 80
);
console.log('Pn/Pe rules', rules.length);
for (const r of rules.slice(0, 20)) {
  console.log(r.id, '\n L', r.leftSide, '\n R', r.rightSide);
}
