import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { matchesDerivedBbTransition, matchesCaseFocusOrMerge } from '../src/inferenceRules/caseFocus';

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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 143;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4']);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (matchesDerivedBbTransition(A, B)) return ['derived'];
  const hits: string[] = [];
  for (const rule of getRulesForTransition(index, A, B)) {
    if (BLOCK.has(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      hits.push(rule.id);
  }
  return hits;
}

for (const step of [5, 11]) {
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::143::') && x.step === step)!;
  console.log('\n=== s' + step);
  console.log('L', f.left);
  console.log('R', f.right);
  console.log('direct', j(f.left, f.right));
  console.log('caseFocus', matchesCaseFocusOrMerge(f.left, f.right));
}

// s5: collapse empty-true Bb{i Pu}{,}{X} -> X
// Standalone:
const innerL = ',\\Bb{i \\Pu}{,}{,i \\Ob t_0,t_0 \\nPc t,t_0 \\Os,},';
const innerR = ',i \\Ob t_0,t_0 \\nPc t,t_0 \\Os,';
console.log('\nstandalone collapse', j(innerL, innerR));
console.log('caseFocus standalone', matchesCaseFocusOrMerge(innerL, innerR));

// via nPu flag then focus false
const withNpu = ',i \\nPu,\\Bb{i \\Pu}{,}{,i \\Ob t_0,t_0 \\nPc t,t_0 \\Os,},';
console.log('with nPu -> content', j(withNpu, ',i \\nPu,i \\Ob t_0,t_0 \\nPc t,t_0 \\Os,'));

// null-55 / similar
const n55 = all.filter((r) => /null-comparison-5[45]/.test(r.id) || /null-comparison-5[0-9]/.test(r.id));
for (const r of n55.slice(0, 15)) {
  console.log(r.id, r.leftSide.slice(0, 70), '=>', r.rightSide.slice(0, 70));
}
