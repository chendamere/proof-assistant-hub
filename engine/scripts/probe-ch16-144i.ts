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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 144;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4']);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  const hits: string[] = [];
  for (const rule of getRulesForTransition(index, A, B)) {
    if (BLOCK.has(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      hits.push(rule.id);
  }
  return hits;
}
function show(lab: string, a: string, b: string) {
  const h = j(a, b);
  console.log(lab, h.length ? h[0] : 'FAIL');
  return h.length > 0;
}

const L = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,';
const midOd = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,\\Or,}{,i \\Od n,},n \\Os,';
const midOdRev = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,n \\Os,\\Or,}{,i \\Od n,},n \\Os,';
const R = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},';
const both = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},';

show('1 L->midOd', L, midOd);
show('2 midOd->rev', midOd, midOdRev);

const cands = [
  // ecd outer Os into arms
  ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,n \\Os,\\Or,n \\Os,}{,i \\Od n,n \\Os,},',
  // create-id true
  ',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,i \\Od n,},n \\Os,',
  // pull Od after rev (asymmetric?)
  ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,},n \\Os,',
  // ecd then...
  ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,n \\Os,\\Or,}{,i \\Od n,n \\Os,},',
  // swap-id-release in true: Od,Os -> Os,Od
  ',i \\Pu,\\Bb{n \\Pu}{,n \\Os,i \\Od n,\\Or,}{,i \\Od n,},n \\Os,',
  // both via pull Od from a state with Os in both
  both,
  R,
];
for (const c of cands) {
  show('from rev ' + c.slice(20, 55), midOdRev, c);
}

// After create-id true:
const afterCreateTrue = ',i \\Pu,\\Bb{n \\Pu}{,\\Or,}{,i \\Od n,},n \\Os,';
if (j(midOdRev, afterCreateTrue).length) {
  show('create true ok', midOdRev, afterCreateTrue);
  // push Os into false via ecd: true gets Os too
  const t1 = ',i \\Pu,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,i \\Od n,n \\Os,},';
  show('ecd', afterCreateTrue, t1);
  // create? or pull Od from false only - need Od in both for null-10 rev
  // rev error on true again?
  const t2 = ',i \\Pu,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,i \\Od n,},n \\Os,';
  show('rev err again', afterCreateTrue, t2);
  // null-10 push Od into true from... Od only in false. Push from outside: need outer Od
  const t3 = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,'; // back
  show('pull Od from false?', afterCreateTrue, t3);
}

// Chain: L -> midOd -> midOdRev -> ecdDup -> create-id cleanup -> both -> R
const ecdDup = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,n \\Os,\\Or,n \\Os,}{,i \\Od n,n \\Os,},';
show('rev->ecdDup', midOdRev, ecdDup);
// drop one Os next to Or via error-release: need Os,Or - we have n Os, Or, n Os
const ecdClean = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,\\Or,n \\Os,}{,i \\Od n,n \\Os,},'; // = midOdBoth
show('ecdDup->midOdBoth?', ecdDup, ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,n \\Os,\\Or,}{,i \\Od n,n \\Os,},');
show('ecdDup error-rel first Os', ecdDup, ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,\\Or,n \\Os,}{,i \\Od n,n \\Os,},');

// CRITICAL: midOdRev already has Os,Or in true. Outer Os. 
// If we can get outer Os into FALSE only (and not true):
const osFalse = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,n \\Os,\\Or,}{,i \\Od n,n \\Os,},';
show('rev->osFalse (ecd?)', midOdRev, osFalse);
show('osFalse->both (pull Od)', osFalse, both);
show('both->R', both, R);

// Verify full chain if osFalse works
console.log('\n=== FULL ===');
const ok =
  show('1', L, midOd) &&
  show('2', midOd, midOdRev) &&
  show('3', midOdRev, osFalse) &&
  show('4', osFalse, both) &&
  show('5', both, R);
console.log(ok ? 'SUCCESS' : 'need more');
