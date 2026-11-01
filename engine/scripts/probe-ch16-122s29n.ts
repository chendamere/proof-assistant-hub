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
const f = fails.find(
  (x: { left: string; right: string }) =>
    x.left.includes('s_1 \\Pn s_1') && x.left.includes('s_2 \\Pn s_2') && x.right.includes('s_1 \\Pe s_2')
)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string) {
  for (const id of [
    'create-id',
    'id-value-equal',
    'theorems-of-node-null-comparison-17-menbifi',
    'rules-of-node-connectivity-31-menbifi',
    'theorems-of-relationship-of-node-value-comparison-22-iejmd',
    'theorems-of-relationship-of-node-value-comparison-23-iejmb',
    'theorems-of-relationship-of-node-value-comparison-24-iejms',
    'rules-of-node-continuity-320-tiini',
    'swap-id-release',
    'swap-subnode-release',
  ]) {
    const rule = all.find((r) => r.id === id);
    if (!rule) continue;
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return id;
  }
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return rule.id;
  }
  return null;
}

// Rebuild to Pe/Ob1 state quickly
const L = ensure(f.left);
const R = ensure(f.right);
const drop1 = L.replace('{,\\Ot s_1,s_1 \\Pn s_1,}', '{,\\Ot s_1,}');
const drop2 = drop1.replace('{,\\Ot s_2,s_2 \\Pn s_2,}', '{,\\Ot s_2,}');
let cur = drop2;
function hop(next: string, label: string) {
  const id = j(cur, next);
  console.log(label, id);
  if (!id) {
    console.log('FAIL', cur.slice(0, 140));
    console.log(' ->', ensure(next).slice(0, 140));
    process.exit(1);
  }
  cur = ensure(next);
}

hop(cur.replace(',\\Bb{i \\Pu}', ',i \\Od s_1,s_1 \\Os,\\Bb{i \\Pu}'), 'cid1');
hop(cur.replace(',i \\Od s_1,s_1 \\Os,', ',i \\Od s_1,s_1 \\Os,i \\Od s_2,s_2 \\Os,'), 'cid2');
hop(
  cur.replace(',i \\Od s_1,s_1 \\Os,i \\Od s_2,s_2 \\Os,', ',i \\Od s_1,i \\Od s_2,s_1 \\Os,s_2 \\Os,'),
  'adj'
);
hop(cur.replace(',i \\Od s_1,i \\Od s_2,', ',i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,'), 'idv');
hop(cur.replace(',s_1 \\Pe s_2,s_1 \\Os,', ',s_1 \\Os,s_1 \\Pe s_2,'), 'PeOs1');
hop(cur.replace(',s_1 \\Pe s_2,s_2 \\Os,', ',s_2 \\Os,s_1 \\Pe s_2,'), 'PeOs2');
hop(
  cur.replace(',i \\Od s_1,i \\Od s_2,s_1 \\Os,', ',i \\Od s_1,s_1 \\Os,i \\Od s_2,'),
  'OdOs'
);
hop(cur.replace(',i \\Od s_2,s_2 \\Os,', ','), 'rcid2');
hop(cur.replace(',i \\Od s_1,s_1 \\Os,', ','), 'rcid1');
const nullR = ensure(
  drop2
    .replace(
      '{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
      '{,s_1 \\Pe s_2,i \\Od s_1,i \\Od s_2,s_2 \\Os,}'
    )
    .replace(
      '{,i \\Ob t_1,\\Bb{t_1 \\Pc j}',
      '{,s_1 \\Pe s_2,i \\Ob t_1,\\Bb{t_1 \\Pc j}'
    )
);
hop(nullR, 'null17');
hop(
  cur.replace(
    '{,s_1 \\Pe s_2,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
    '{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}'
  ),
  'true Pe back'
);
// skip stepwise true — do both Od at once via two hops was needed; try double
// actually one replace both might not match; already did combined? used one replace for both Ods - check
// I used single replace moving Pe past both Ods at once - might have failed silently... it said ok if j matched. Good if swap allows multi? 
// Wait I replaced Pe,Od,Od -> Od,Od,Pe in one hop - value-comp-22 only swaps one pair. Did it match?
// It printed 'true Pe back' with an id — if it matched, fine.

hop(
  cur.replace(
    '{,s_1 \\Pe s_2,i \\Ob t_1,\\Bb{t_1 \\Pc j}',
    '{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}'
  ),
  'Pe Ob1'
);

// Move TAIL before Ob1 so Bb1 at end of false arm
const tailMove = cur.replace(
  '{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,}',
  '{,t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},}'
);
console.log('big tail move', j(cur, tailMove));

// Stepwise: bubble Bb1 toward end — swap Bb with t1 Os
const s1 = cur.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
  't_1 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},'
);
console.log('Bb past Os?', j(cur, s1));
// Pe past Os then Bb at... 
const s2 = cur.replace(
  's_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
  's_1 \\Pe s_2,t_1 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},'
);
console.log('Os between Pe and Bb', j(cur, s2));

// Move entire suffix after Bb to before Pe using repeated swaps
let x = cur;
const suffixSteps = [
  // Pe, Bb, Os -> Pe, Os, Bb
  [
    's_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
    's_1 \\Pe s_2,t_1 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},',
  ],
];
for (const [a, b] of suffixSteps) {
  const n = x.replace(a, b);
  console.log('step', j(x, n));
}

// ADD derived-style: check if peMid->R could use a new caseFocus helper
console.log('--- consider derived Pe past trailing ---');
const peMid = drop2.replace(
  'i \\Od s_1,i \\Od s_2,',
  'i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,'
);
const peFalse = peMid.replace('t_2 \\Os,s_2 \\Os,}', 't_2 \\Os,s_1 \\Pe s_2,s_2 \\Os,}');
console.log('peMid->peFalse still', j(peMid, peFalse));
console.log('peFalse==R', peFalse === R);
