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
// null-17 puts Pe at front of each arm
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
console.log('peOut->nullR', j(peOut, nullR), 'exact', jExact(peOut, nullR, 'theorems-of-node-null-comparison-17-menbifi'));
console.log('nullR', nullR.slice(0, 160));
console.log('R    ', R.slice(0, 160));

// reorder Pe within true arm to after Od
const reTrue = nullR.replace(
  '{,s_1 \\Pe s_2,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
  '{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}'
);
console.log('nullR->reTrue', j(nullR, reTrue));
const reFalse = reTrue.replace(
  '{,s_1 \\Pe s_2,i \\Ob t_1,',
  '{,i \\Ob t_1,'
).replace('t_2 \\Os,s_2 \\Os,}', 't_2 \\Os,s_1 \\Pe s_2,s_2 \\Os,}');
// better: move Pe from front of false to before s2 Os
const reFalse2 = reTrue.replace(
  '{,s_1 \\Pe s_2,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,}',
  '{,i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_1 \\Pe s_2,s_2 \\Os,}'
);
console.log('reTrue->reFalse2', j(reTrue, reFalse2));
console.log('reFalse2==R', reFalse2 === R, j(reFalse2, R));

// How to GET peOut? Need id-value-equal with Od outside Bb
// Try: reverse null-17 from a state that has Pe in both? chicken-egg

// Alternate: pe from id inside true, then somehow...
const peMid = drop2.replace(
  'i \\Od s_1,i \\Od s_2,',
  'i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,'
);

// Can we get Od s1, Od s2 OUTSIDE by reverse of pushing Od into Bb?
const odOut = ensure(
  drop2.replace(
    ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
    ',i \\Od s_1,i \\Od s_2,\\Bb{i \\Pu}{,s_2 \\Os,}'
  )
);
console.log('drop2->odOut (Od pulled)', j(drop2, odOut));

const odOutKeep = ensure(
  drop2.replace(
    ',\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
    ',i \\Od s_1,i \\Od s_2,\\Bb{i \\Pu}{,i \\Od s_1,i \\Od s_2,s_2 \\Os,}'
  )
);
console.log('drop2->odOutKeep', j(drop2, odOutKeep));

// Search rules that pull stuff out of Pu true arm
const pullRules = all.filter(
  (r) =>
    r.pos < pos &&
    /\\Pu/.test(r.leftSide + r.rightSide) &&
    /\\Od/.test(r.leftSide + r.rightSide) &&
    r.leftSide.length < 100
);
console.log('Od/Pu rules', pullRules.length);
for (const r of pullRules.slice(0, 15)) {
  console.log(r.id, '\n L', r.leftSide, '\n R', r.rightSide);
}

// Try create-id reverse to get Od outside then Pe then push
const cid = ensure(',i \\Od s_1,s_1 \\Os,' + drop2.slice(1));
console.log('empty->cid adjacent drop2?', 'skip');

// From peMid: use equiv unzip? soft blocked
console.log('peMid->R soft?', checkInferenceRules(peMid, R, ',\\Tc c_1,', ',\\Tc c_1,', { dagCache: index.dagCache }).match);
