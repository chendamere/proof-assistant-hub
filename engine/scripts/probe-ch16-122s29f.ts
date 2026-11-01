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
function jExact(a: string, b: string, id: string) {
  const rule = all.find((r) => r.id === id)!;
  return checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
    dagCache: index.dagCache,
  }).match;
}

const L = ensure(f.left);
const R = ensure(f.right);
const drop1 = L.replace('{,\\Ot s_1,s_1 \\Pn s_1,}', '{,\\Ot s_1,}');
const drop2 = drop1.replace('{,\\Ot s_2,s_2 \\Pn s_2,}', '{,\\Ot s_2,}');
const peOut = ensure(drop2.replace(',\\Bb{i \\Pu}', ',s_1 \\Pe s_2,\\Bb{i \\Pu}'));
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
const t1 = nullR.replace(
  '{,s_1 \\Pe s_2,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
  '{,i \\Od s_1,s_1 \\Pe s_2,i \\Od s_2,s_2 \\Os,}'
);
const t2 = t1.replace(
  '{,i \\Od s_1,s_1 \\Pe s_2,i \\Od s_2,s_2 \\Os,}',
  '{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}'
);
// bubble Pe through false arm ops one by one
// false after t2: {,s1 Pe s2, i Ob t1, Bb{t1 Pc j}{Ot s1}{i Od s1}, t1 Os, i Ob t2, Bb{t2 Pc j}{Ot s2}{i Od s2}, t2 Os, s2 Os,}
const bubble: string[] = [t2];
function last() {
  return bubble[bubble.length - 1]!;
}
function hop(next: string, label: string) {
  const id = j(last(), next);
  console.log(label, id);
  if (!id) return false;
  bubble.push(ensure(next));
  return true;
}

// Pe past Ob t1
hop(
  last().replace(
    '{,s_1 \\Pe s_2,i \\Ob t_1,\\Bb{t_1 \\Pc j}',
    '{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}'
  ),
  'past Ob t1'
);
// Pe into/past Bb — may need into both arms then out, or past whole Bb
hop(
  last().replace(
    'i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},',
    'i \\Ob t_1,\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},'
  ),
  'Pe into Bb t1 both'
);
// Or past Bb as unit if rule exists
if (bubble.length === 2) {
  hop(
    t2.replace(
      '{,s_1 \\Pe s_2,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
      '{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,s_1 \\Pe s_2,'
    ),
    'Pe jump past Bb+Os t1'
  );
}

// create-id exact
console.log(
  'create-id exact',
  jExact(drop2, drop2.replace(',\\Bb{i \\Pu}', ',i \\Od s_1,s_1 \\Os,\\Bb{i \\Pu}'), 'create-id')
);
console.log(
  'create-id empty',
  jExact(',', ',i \\Od s_1,s_1 \\Os,', 'create-id')
);

// peOut from peMid: reverse of putting Pe only in true — try pull Pe using null-17 reverse wrongly

// KEY idea: id-value-equal in true gives peMid. Then reverse of null-17 requires Pe in both.
// What if we FIRST use swap-55 to push a FRESH Od into both arms from outside, id-value there?

// From drop2: reverse create-temp? 

// Check: can peMid go to nullR by adding Pe to false front and moving true Pe to front?
const toNullFromMid = ensure(
  peMidToNull()
);
function peMidToNull() {
  const peMid = drop2.replace(
    'i \\Od s_1,i \\Od s_2,',
    'i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,'
  );
  return peMid
    .replace(
      '{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}',
      '{,s_1 \\Pe s_2,i \\Od s_1,i \\Od s_2,s_2 \\Os,}'
    )
    .replace(
      '{,i \\Ob t_1,\\Bb{t_1 \\Pc j}',
      '{,s_1 \\Pe s_2,i \\Ob t_1,\\Bb{t_1 \\Pc j}'
    );
}
const peMid = drop2.replace(
  'i \\Od s_1,i \\Od s_2,',
  'i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,'
);
console.log('peMid->toNullFromMid', j(peMid, toNullFromMid));
console.log('toNull==nullR', toNullFromMid === nullR);

// Full bubble to R from nullR — try connectivity Pe into Pc Bb then out
const conn31 = 'rules-of-node-connectivity-31-menbifi';
console.log(
  'Pe into Pc Bb',
  jExact(
    ',s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},',
    ',\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},',
    conn31
  )
);

// Continue from f1 state if we got past Ob
let cur = t2.replace(
  '{,s_1 \\Pe s_2,i \\Ob t_1,\\Bb{t_1 \\Pc j}',
  '{,i \\Ob t_1,s_1 \\Pe s_2,\\Bb{t_1 \\Pc j}'
);
console.log('t2->cur', j(t2, cur));
const into = cur.replace(
  's_1 \\Pe s_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},',
  '\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},'
);
console.log('cur->into', j(cur, into), 'exact31', jExact(cur, into, conn31));

// Pull Pe out after Bb (both arms) — reverse conn31
const pastBb = into.replace(
  '\\Bb{t_1 \\Pc j}{,s_1 \\Pe s_2,\\Ot s_1,}{,s_1 \\Pe s_2,i \\Od s_1,},t_1 \\Os,',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,s_1 \\Pe s_2,'
);
console.log('into->pastBb', j(into, pastBb), 'exact31rev', jExact(into, pastBb, conn31));

// Show easy fails
const c = new Map<string, number>();
for (const x of fails) {
  const th = String(x.key).split('::')[1]!;
  c.set(th, (c.get(th) || 0) + 1);
}
console.log([...c.entries()].sort((a, b) => b[1] - a[1]));
for (const th of ['23', '129', '132', '144']) {
  for (const x of fails.filter((z: { key: string }) => z.key.includes(`::${th}::`))) {
    console.log(th, 's' + x.step, 'L', x.left.slice(0, 140));
    console.log('  R', x.right.slice(0, 140));
  }
}
