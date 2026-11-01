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
    'swap-id-1',
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

const L = ensure(f.left);
const drop1 = L.replace('{,\\Ot s_1,s_1 \\Pn s_1,}', '{,\\Ot s_1,}');
const drop2 = drop1.replace('{,\\Ot s_2,s_2 \\Pn s_2,}', '{,\\Ot s_2,}');
let cur = drop2;
const log: string[] = [];
function hop(next: string, label?: string) {
  const id = j(cur, next);
  console.log(label || 'hop', id);
  if (!id) {
    console.log('FAIL', cur.slice(0, 120));
    console.log('  ->', next.slice(0, 120));
    process.exit(1);
  }
  log.push(id);
  cur = ensure(next);
}

hop(cur.replace(',\\Bb{i \\Pu}', ',i \\Od s_1,s_1 \\Os,\\Bb{i \\Pu}'), 'cid1');
hop(cur.replace(',i \\Od s_1,s_1 \\Os,', ',i \\Od s_1,s_1 \\Os,i \\Od s_2,s_2 \\Os,'), 'cid2');
hop(
  cur.replace(',i \\Od s_1,s_1 \\Os,i \\Od s_2,s_2 \\Os,', ',i \\Od s_1,i \\Od s_2,s_1 \\Os,s_2 \\Os,'),
  'swap Od/Os'
);
hop(cur.replace(',i \\Od s_1,i \\Od s_2,', ',i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,'), 'id-val');

// Pe past s1 Os
hop(
  cur.replace(',s_1 \\Pe s_2,s_1 \\Os,', ',s_1 \\Os,s_1 \\Pe s_2,'),
  'Pe past s1 Os'
);
hop(
  cur.replace(',s_1 \\Pe s_2,s_2 \\Os,', ',s_2 \\Os,s_1 \\Pe s_2,'),
  'Pe past s2 Os'
);
// now: Od Od, s1 Os, s2 Os, Pe, Bb — need Od s1, s1 Os adjacent
hop(
  cur.replace(',i \\Od s_1,i \\Od s_2,s_1 \\Os,', ',i \\Od s_1,s_1 \\Os,i \\Od s_2,'),
  'Od s2 past s1 Os'
);
// now: Od s1, s1 Os, Od s2, s2 Os, Pe, Bb
hop(cur.replace(',i \\Od s_2,s_2 \\Os,', ','), 'rev cid2');
hop(cur.replace(',i \\Od s_1,s_1 \\Os,', ','), 'rev cid1');
console.log('peOut?', cur.startsWith(',s_1 \\Pe s_2,\\Bb'));

const R = ensure(f.right);
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
    '{,i \\Od s_1,s_1 \\Pe s_2,i \\Od s_2,s_2 \\Os,}'
  ),
  'Pe/Od1'
);
hop(
  cur.replace(
    '{,i \\Od s_1,s_1 \\Pe s_2,i \\Od s_2,s_2 \\Os,}',
    '{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}'
  ),
  'Pe/Od2'
);
hop(
  cur.replace(
    '{,s_1 \\Pe s_2,i \\Ob t_1,\\Bb{t_1 \\Pc j}',
    '{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}'
  ),
  'Pe/Ob1'
);
hop(
  cur.replace(
    's_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},',
    '\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},'
  ),
  'Pe into Bb1'
);
hop(
  cur.replace(
    '\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_1 \\Os,',
    '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,s_1 \\Pe s_2,'
  ),
  'Pe out Bb1'
);
hop(
  cur.replace('t_1 \\Os,s_1 \\Pe s_2,i \\Ob t_2,', 't_1 \\Os,i \\Ob t_2,s_1 \\Pe s_2,'),
  'Pe/Ob2'
);
hop(
  cur.replace(
    's_1 \\Pe s_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},',
    '\\Bb{t_2 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_2,}{,s_1 \\Pe s_2,i \\Od s_2,},'
  ),
  'Pe into Bb2'
);
hop(
  cur.replace(
    '\\Bb{t_2 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_2,}{,s_1 \\Pe s_2,i \\Od s_2,},t_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_1 \\Pe s_2,'
  ),
  'Pe out Bb2'
);
console.log('eq R', cur === R, j(cur, R));
console.log('rules', log.join(', '));
console.log('cur', cur);
console.log('R  ', R);

// Pe/Os rules
for (const r of all) {
  if (r.pos >= pos) continue;
  if (!/\\Pe/.test(r.leftSide + r.rightSide) || !/\\Os/.test(r.leftSide + r.rightSide)) continue;
  if (r.leftSide.length > 70) continue;
  console.log('PeOs', r.id, r.leftSide, '=>', r.rightSide);
}
