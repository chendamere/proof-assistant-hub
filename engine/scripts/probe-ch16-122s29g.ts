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
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4']);
function j(a: string, b: string) {
  // Prefer exact known axioms first
  for (const id of [
    'create-id',
    'create-temp',
    'id-value-equal',
    'temp-value-equal',
    'theorems-of-node-null-comparison-17-menbifi',
    'rules-of-node-connectivity-31-menbifi',
    'theorems-of-relationship-of-node-value-comparison-22-iejmd',
    'theorems-of-relationship-of-node-value-comparison-23-iejmb',
    'rules-of-node-continuity-320-tiini',
    'swap-theorems-of-same-operand-26-iejidn',
  ]) {
    const rule = all.find((r) => r.id === id);
    if (!rule || rule.pos >= pos) continue;
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return id;
  }
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (BLOCK.has(rule.id)) continue;
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
const R = ensure(f.right);
const drop1 = L.replace('{,\\Ot s_1,s_1 \\Pn s_1,}', '{,\\Ot s_1,}');
const drop2 = drop1.replace('{,\\Ot s_2,s_2 \\Pn s_2,}', '{,\\Ot s_2,}');

const chain: string[] = [L, drop1, drop2];
function hop(next: string) {
  const a = chain[chain.length - 1]!;
  const id = j(a, next);
  console.log(`hop${chain.length - 1}`, id, 'ok', !!id);
  if (!id) {
    console.log('FAIL from', a.slice(0, 100));
    console.log('     to  ', next.slice(0, 100));
    process.exit(1);
  }
  chain.push(ensure(next));
}

// create-id s1, s2
hop(drop2.replace(',\\Bb{i \\Pu}', ',i \\Od s_1,s_1 \\Os,\\Bb{i \\Pu}'));
hop(chain[chain.length - 1]!.replace(',i \\Od s_1,s_1 \\Os,', ',i \\Od s_1,s_1 \\Os,i \\Od s_2,s_2 \\Os,'));

// reorder to Od Od Pe Os Os: first swap Os past Od s2? want Od s1, Od s2 adjacent
// current: i Od s1, s1 Os, i Od s2, s2 Os, Bb
hop(
  chain[chain.length - 1]!.replace(
    ',i \\Od s_1,s_1 \\Os,i \\Od s_2,s_2 \\Os,',
    ',i \\Od s_1,i \\Od s_2,s_1 \\Os,s_2 \\Os,'
  )
);
// id-value-equal
hop(
  chain[chain.length - 1]!.replace(
    ',i \\Od s_1,i \\Od s_2,',
    ',i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,'
  )
);
// reorder Pe after Od before Os already; move Pe after Os pair for create-id drop:
// i Od s1, i Od s2, s1 Pe s2, s1 Os, s2 Os → i Od s1, s1 Os, i Od s2, s2 Os, s1 Pe s2
hop(
  chain[chain.length - 1]!.replace(
    ',i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_1 \\Os,s_2 \\Os,',
    ',i \\Od s_1,s_1 \\Os,i \\Od s_2,s_2 \\Os,s_1 \\Pe s_2,'
  )
);
// reverse create-id twice
hop(
  chain[chain.length - 1]!.replace(',i \\Od s_2,s_2 \\Os,', ',')
);
hop(
  chain[chain.length - 1]!.replace(',i \\Od s_1,s_1 \\Os,', ',')
);
// now peOut
const peOut = chain[chain.length - 1]!;
console.log('is peOut', peOut.startsWith(',s_1 \\Pe s_2,\\Bb{i \\Pu}'));

// null-17
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
hop(nullR);

// reorder true arm Pe past Ods
hop(
  chain[chain.length - 1]!.replace(
    '{,s_1 \\Pe s_2,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
    '{,i \\Od s_1,s_1 \\Pe s_2,i \\Od s_2,s_2 \\Os,}'
  )
);
hop(
  chain[chain.length - 1]!.replace(
    '{,i \\Od s_1,s_1 \\Pe s_2,i \\Od s_2,s_2 \\Os,}',
    '{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}'
  )
);

// bubble false: past Ob, into Bb both, past (rev), past Os, past Ob2, into Bb2, past, past Os to before s2 Os
let cur = chain[chain.length - 1]!;
hop(
  cur.replace(
    '{,s_1 \\Pe s_2,i \\Ob t_1,\\Bb{t_1 \\Pc j}',
    '{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}'
  )
);
cur = chain[chain.length - 1]!;
hop(
  cur.replace(
    's_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},',
    '\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},'
  )
);
cur = chain[chain.length - 1]!;
hop(
  cur.replace(
    '\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_1 \\Os,',
    '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,s_1 \\Pe s_2,'
  )
);
cur = chain[chain.length - 1]!;
hop(
  cur.replace(
    't_1 \\Os,s_1 \\Pe s_2,i \\Ob t_2,',
    't_1 \\Os,i \\Ob t_2,s_1 \\Pe s_2,'
  )
);
cur = chain[chain.length - 1]!;
hop(
  cur.replace(
    's_1 \\Pe s_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},',
    '\\Bb{t_2 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_2,}{,s_1 \\Pe s_2,i \\Od s_2,},'
  )
);
cur = chain[chain.length - 1]!;
hop(
  cur.replace(
    '\\Bb{t_2 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_2,}{,s_1 \\Pe s_2,i \\Od s_2,},t_2 \\Os,',
    '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_1 \\Pe s_2,'
  )
);
cur = chain[chain.length - 1]!;
console.log('near R', cur === R, j(cur, R));
console.log('cur', cur.slice(0, 200));
console.log('R  ', R.slice(0, 200));
console.log('chain len', chain.length);
