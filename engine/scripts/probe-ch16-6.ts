import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import fs from 'fs';

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
  'Rules_of_Relationship_of_Subnode',
];
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
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
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
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
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::6::') && x.step === 0)!;
const pos = CHAPTER_ORDER.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 6;
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}
const L = ensure(f.left);
const R = ensure(f.right);
console.log('direct', j(L, R));
const wrap = ensure(',\\Bb{i \\Pb j}{,}{,\\Or,},');
console.log('wrap', j(L, wrap));
const viaDef = ensure(
  ',\\Bb{if(i \\Pu)}{, i \\Od n, }{, i \\Ob t, \\Bb{if(t \\Pc j)}{, \\Ot n,}{, i \\Od n,}, t \\Os,}, \\Blb{if(n \\Pu)}{, n \\Os, }{, n \\Os, },'
);
console.log('via Blb def body', j(L, viaDef));
console.log('wrap→R', j(wrap, R));
// definition of Blb empty
const blb = ensure(',\\Blb{if(i \\Pb j)}{,}{,},');
console.log('L→blb?', j(L, blb));
console.log('blb→R', j(blb, R));
const mid = ensure(
  ',\\Bb{if(i \\Pu)}{, i \\Od n, }{, i \\Ob t, \\Bb{if(t \\Pc j)}{, \\Ot n,}{, i \\Od n,}, t \\Os,}, \\Bb{if(n \\Pu)}{, n \\Os, }{, n \\Os, },'
);
console.log('L→mid Bb', j(L, mid));
console.log('mid→R (add Or)', j(mid, R));

// s9 Pc flip + drop
const f9 = fails.find((x: { key: string; step: number }) => x.key.includes('::6::') && x.step === 9)!;
console.log('\ns9 L', ensure(f9.left).slice(0, 140));
console.log('s9 R', ensure(f9.right).slice(0, 140));
const flipOnly = ensure(f9.left).replace('j \\Pc t', 't \\Pc j');
console.log('s9 flip only', j(f9.left, flipOnly));
const dropOs = ensure(f9.left)
  .replace(', n \\Os, }{,', '}{,')
  .replace('{, \\Or, n \\Os, }', '{, \\Or, }');
console.log('dropOs cand', dropOs.slice(0, 120));
console.log('s9 drop n Os true', j(f9.left, dropOs));
console.log('s9 direct', j(f9.left, f9.right));

// list early subnode rules
console.log(
  '\nearly subnode',
  allRules.filter((r) => r.id.includes('relationship-of-subnode') && r.pos < pos).map((r) => r.id)
);
