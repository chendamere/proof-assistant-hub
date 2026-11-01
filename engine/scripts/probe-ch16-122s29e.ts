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

// Pe/Od commute
console.log('--- Pe Od commute rules ---');
for (const r of all) {
  if (r.pos >= pos) continue;
  if (!/\\Pe/.test(r.leftSide + r.rightSide) || !/\\Od/.test(r.leftSide + r.rightSide)) continue;
  if (r.leftSide.length > 80) continue;
  console.log(r.id, '\n L', r.leftSide, '\n R', r.rightSide);
}

// Stepwise reorder inside true: Pe past Od s1, then Od s2
const t1 = nullR.replace(
  '{,s_1 \\Pe s_2,i \\Od s_1,i \\Od s_2,s_2 \\Os,}',
  '{,i \\Od s_1,s_1 \\Pe s_2,i \\Od s_2,s_2 \\Os,}'
);
console.log('nullR->t1', j(nullR, t1));
const t2 = t1.replace(
  '{,i \\Od s_1,s_1 \\Pe s_2,i \\Od s_2,s_2 \\Os,}',
  '{,i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_2 \\Os,}'
);
console.log('t1->t2', j(t1, t2));

// false arm: Pe past Ob chain to before s2 Os — many swaps
const f1 = t2.replace(
  '{,s_1 \\Pe s_2,i \\Ob t_1,',
  '{,i \\Ob t_1,s_1 \\Pe s_2,'
);
console.log('t2->f1 Pe past Ob', j(t2, f1));

// Get peOut: Od outside + id-value
// Use swap-55 reverse: need Od in BOTH arms first.
// Add Od to false top via... create-id? or push from outside first.

// Start from drop2, introduce Od s1 outside via reverse swap-55? needs both arms.
// Forward: from Od outside push to both — so begin with Od outside only.

const od1out = ensure(drop2.replace(',\\Bb{i \\Pu}', ',i \\Od s_1,\\Bb{i \\Pu}'));
console.log('drop2->od1out', j(drop2, od1out)); // create-id needs Os too

const od1outOs = ensure(drop2.replace(',\\Bb{i \\Pu}', ',i \\Od s_1,s_1 \\Os,\\Bb{i \\Pu}'));
console.log('drop2->od1outOs create-id?', j(drop2, od1outOs));

// Reverse operators? From true arm Od, can we duplicate outside?
// peMid then reverse null-17? needs Pe both arms.

// CRITICAL: peOut from Od outside:
const bothOdOut = ensure(
  drop2.replace(',\\Bb{i \\Pu}', ',i \\Od s_1,i \\Od s_2,\\Bb{i \\Pu}')
);
const bothOdOutPe = ensure(
  drop2.replace(',\\Bb{i \\Pu}', ',i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,\\Bb{i \\Pu}')
);
console.log('bothOdOut->bothOdOutPe', j(bothOdOut, bothOdOutPe));
console.log('bothOdOutPe->peOut (drop Od out)', j(bothOdOutPe, peOut));

// Can drop2 get to bothOdOut?
console.log('drop2->bothOdOut', j(drop2, bothOdOut));

// Try: pull Od from true using a one-arm rule? 
// Maybe identical / copy?

// Look at peMid: add Pe to false by first adding Od to false top via swap-55 from outside Od that we create paired with Os then release?

// Simpler book-faithful: maybe Pe comes from id-value IN true, and false Pe comes from unzip of a later step that's already Pe-outside (line 588).
// So for 584->585, maybe the book jumped and we need peOut path.

// create-id twice + releases + id-value + null-17, cleaning Os:
let cur = drop2;
const steps: string[] = [];
function tryHop(label: string, next: string) {
  const id = j(cur, next);
  console.log(label, id);
  if (id) {
    cur = ensure(next);
    steps.push(label + ':' + id);
  }
  return !!id;
}

// create-id s1
tryHop(
  'cid1',
  drop2.replace(',\\Bb{i \\Pu}', ',i \\Od s_1,s_1 \\Os,\\Bb{i \\Pu}')
);
if (steps.length) {
  tryHop(
    'cid2',
    cur.replace(',i \\Od s_1,s_1 \\Os,', ',i \\Od s_1,s_1 \\Os,i \\Od s_2,s_2 \\Os,')
  );
  tryHop(
    'tve/id',
    cur.replace(
      ',i \\Od s_1,s_1 \\Os,i \\Od s_2,s_2 \\Os,',
      ',i \\Od s_1,i \\Od s_2,s_1 \\Pe s_2,s_1 \\Os,s_2 \\Os,'
    )
  );
}

// Alternate: from peMid use swap Pe with neighboring ops until at Bb boundary then... 
console.log('steps', steps);

// Check if nullR with Pe front is acceptable as book insert even if order differs from R —
console.log('nullR->R', j(nullR, R));

// Reorder using known swap-id / Pe commute inside Bb focus
const peOdRules = all.filter(
  (r) =>
    r.pos < pos &&
    /i \\Od m, m \\Pe n|m \\Pe n, i \\Od|i \\Od m, i \\Pe|i \\Pe j, i \\Od/.test(
      r.leftSide + ' ' + r.rightSide
    )
);
console.log('pe-od pattern rules', peOdRules.length);
for (const r of peOdRules.slice(0, 20)) console.log(r.id, r.leftSide, '=>', r.rightSide);
