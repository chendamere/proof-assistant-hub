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
const f = fails.find(
  (x: { left: string; right: string }) =>
    x.left.includes('s_1 \\Pn s_1') && x.left.includes('s_2 \\Pn s_2') && x.right.includes('s_1 \\Pe s_2')
)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function jExact(a: string, b: string, id: string) {
  const rule = all.find((r) => r.id === id)!;
  const r = checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
    dagCache: index.dagCache,
  });
  return r;
}

const L = ensure(f.left);
const R = ensure(f.right);
const drop1 = L.replace('{,\\Ot s_1,s_1 \\Pn s_1,}', '{,\\Ot s_1,}');
const drop2 = drop1.replace('{,\\Ot s_2,s_2 \\Pn s_2,}', '{,\\Ot s_2,}');
const peMid = drop2.replace(
  'i \\Od s_1,i \\Od s_2,',
  'i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,'
);
const peFalse = peMid.replace('t_2 \\Os,s_2 \\Os,}', 't_2 \\Os,s_1 \\Pe s_2,s_2 \\Os,}');

const peOut = ensure(
  drop2.replace(',\\Bb{i \\Pu}', ',s_1 \\Pe s_2,\\Bb{i \\Pu}')
);
const afterNull = ensure(
  peOut
    .replace(
      '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
      '{,s_1 \\Pe s_2,i \\Od s_1,i \\Od s_2,s_2 \\Os,}'
    )
    .replace(
      '{,i \\Ob t_1,',
      '{,s_1 \\Pe s_2,i \\Ob t_1,'
    )
);

console.log('null17 rule', all.find((r) => r.id.includes('null-comparison-17'))?.id);
const n17 = 'theorems-of-node-null-comparison-17-menbifi';
console.log('peOut->afterNull', jExact(peOut, afterNull, n17));
console.log('afterNull', afterNull.slice(0, 120));
console.log('R       ', R.slice(0, 120));
console.log('swap74', jExact(peOut, afterNull, 'swap-theorems-of-same-operand-74-iejbifi'));

// Minimal isolated test
const a = ensure(',s_1 \\Pe s_2,\\Bb{i \\Pu}{,\\Tc c_1,}{,\\Tc c_2,},');
const b = ensure(',\\Bb{i \\Pu}{,s_1 \\Pe s_2,\\Tc c_1,}{,s_1 \\Pe s_2,\\Tc c_2,},');
console.log('isolated null17', jExact(a, b, n17));
console.log('isolated swap74', jExact(a, b, 'swap-theorems-of-same-operand-74-iejbifi'));

// peMid -> peFalse: is there ANY rule? brute candidates with Pe and Bb
let found = 0;
for (const rule of all.filter((r) => r.pos < pos)) {
  if (!/\\Pe|\\Bb|\\Pu/.test(rule.leftSide + rule.rightSide)) continue;
  const r = checkInferenceRules(peMid, peFalse, rule.leftSide, rule.rightSide, {
    dagCache: index.dagCache,
  });
  if (r.match) {
    console.log('FOUND peMid->peFalse', rule.id);
    found++;
    if (found > 5) break;
  }
}
console.log('found', found);

// How to get peOut from drop2 via id-value if Od outside?
// Create: duplicate Od outside true by reverse of drop?
const odOutPe = ensure(
  ',i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,' +
    drop2.replace(/^,/, '')
);
console.log('odOutPe prefix try length', odOutPe.length);

// From peMid: move Pe to front of expression (outside Bb)
const moveOut = ensure(
  peMid
    .replace('i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,', 'i \\Od s_1,i \\Od s_2,')
    .replace(/^,/, ',s_1 \\Pe s_2,')
);
console.log('peMid->moveOut', jExact(peMid, moveOut, n17));
for (const rule of all.filter((r) => r.pos < pos && /\\Pe/.test(r.leftSide + r.rightSide) && r.leftSide.length < 100)) {
  const r = checkInferenceRules(peMid, moveOut, rule.leftSide, rule.rightSide, {
    dagCache: index.dagCache,
  });
  if (r.match) {
    console.log('moveOut via', rule.id);
    break;
  }
}

// Classify fails
const c = new Map<string, number>();
for (const x of fails) {
  const th = String(x.key).split('::')[1]!;
  c.set(th, (c.get(th) || 0) + 1);
}
console.log(
  'classify',
  [...c.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => k + ':' + v)
    .join(' ')
);
