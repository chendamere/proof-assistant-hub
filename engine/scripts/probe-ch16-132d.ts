import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex } from '../src/inferenceRules/ruleIndex';
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
const f = fails.find((x: { key: string }) => x.key.includes('::132::'))!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 132;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const r106 = all.find((r) => r.id === 'rules-of-node-connectivity-106-icjbifj')!;
const r13 = all.find((r) => r.id === 'rules-of-node-connectivity-13-icjjci')!;
const r12 = all.find((r) => r.id === 'rules-of-node-connectivity-12-lsificj')!;
console.log('12', r12.leftSide, '=>', r12.rightSide);
console.log('13', r13.leftSide, '=>', r13.rightSide);
console.log('106', r106.leftSide, '=>', r106.rightSide);

const L = ensure(f.left);
const afterFlipCond = L.replace('\\Bb{m \\Pc i}', '\\Bb{i \\Pc m}');
const afterFlipPc = afterFlipCond.replace(
  '{,t \\Ob m,i \\Pc j,\\Bb{i \\Pc m}',
  '{,t \\Ob m,j \\Pc i,\\Bb{i \\Pc m}'
);
const after106 = afterFlipPc.replace('\\Bb{i \\Pc m}', '\\Bb{j \\Pc m}');

console.log(
  'isolated 106',
  checkInferenceRules(
    ensure(',j \\Pc i,\\Bb{i \\Pc m}{,\\Ot n,}{,t \\Od n,},'),
    ensure(',j \\Pc i,\\Bb{j \\Pc m}{,\\Ot n,}{,t \\Od n,},'),
    r106.leftSide,
    r106.rightSide,
    { dagCache: index.dagCache }
  ).match
);

console.log(
  'nested 106',
  checkInferenceRules(afterFlipPc, after106, r106.leftSide, r106.rightSide, {
    dagCache: index.dagCache,
  }).match
);

console.log('afterFlipPc', afterFlipPc.slice(0, 200));
console.log('after106   ', after106.slice(0, 200));

// Also: true arm still has i Pc j — does that block?
const noTrue = afterFlipPc.replace('{,i \\Pc j,t \\Od n,}', '{,t \\Od n,}');
const noTrue106 = after106.replace('{,i \\Pc j,t \\Od n,}', '{,t \\Od n,}');
console.log(
  'no true Pc',
  checkInferenceRules(noTrue, noTrue106, r106.leftSide, r106.rightSide, {
    dagCache: index.dagCache,
  }).match
);

// Bare false arm only
const bare = ensure(
  ',\\Bb{t \\Pu}{,\\Tc x,}{,t \\Ob m,j \\Pc i,\\Bb{i \\Pc m}{,\\Ot n,}{,t \\Od n,},m \\Os,},'
);
const bare106 = ensure(
  ',\\Bb{t \\Pu}{,\\Tc x,}{,t \\Ob m,j \\Pc i,\\Bb{j \\Pc m}{,\\Ot n,}{,t \\Od n,},m \\Os,},'
);
console.log(
  'bare outer',
  checkInferenceRules(bare, bare106, r106.leftSide, r106.rightSide, {
    dagCache: index.dagCache,
  }).match
);
