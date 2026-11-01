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

const midOdBoth = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,\\Or,n \\Os,}{,i \\Od n,n \\Os,},';
// try all permutations of true arm ending with false fixed
const falseArm = 'i \\Od n,n \\Os';
const atoms = ['i \\Od n', '\\Or', 'n \\Os'];
function perms<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of perms(rest)) out.push([arr[i]!, ...p]);
  }
  return out;
}
console.log('permute true arm from midOdBoth:');
for (const p of perms(atoms)) {
  const e = ensure(`,i \\Pu,\\Bb{n \\Pu}{,${p.join(',')},}{,${falseArm},},`);
  const hits = j(midOdBoth, e);
  if (hits.length) console.log('OK', hits[0], p.join(' | '));
}

// stepwise adjacent swaps in true arm context
const steps = [
  ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,\\Or,n \\Os,}{,i \\Od n,n \\Os,},',
  ',i \\Pu,\\Bb{n \\Pu}{,\\Or,i \\Od n,n \\Os,}{,i \\Od n,n \\Os,},',
  ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,n \\Os,\\Or,}{,i \\Od n,n \\Os,},',
  ',i \\Pu,\\Bb{n \\Pu}{,n \\Os,i \\Od n,\\Or,}{,i \\Od n,n \\Os,},',
  ',i \\Pu,\\Bb{n \\Pu}{,\\Or,n \\Os,i \\Od n,}{,i \\Od n,n \\Os,},',
  ',i \\Pu,\\Bb{n \\Pu}{,n \\Os,\\Or,i \\Od n,}{,i \\Od n,n \\Os,},',
];
console.log('\npairwise from midOdBoth:');
for (const s of steps) {
  const hits = j(midOdBoth, s);
  if (hits.length) console.log(hits[0], s.slice(30, 80));
}

// Adjacent within: Od,Or <-> Or,Od
console.log('\nOd/Or swap', j(',i \\Od n,\\Or,', ',\\Or,i \\Od n,'));
console.log('Or/Os swap', j(',\\Or,n \\Os,', ',n \\Os,\\Or,'));
console.log('Od/Os swap', j(',i \\Od n,n \\Os,', ',n \\Os,i \\Od n,'));

// Full path attempt:
const L = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,';
const midOd = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,\\Or,}{,i \\Od n,},n \\Os,';
const both = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},';
const R = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},';
const targetTrue = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,n \\Os,\\Or,}{,i \\Od n,n \\Os,},';

console.log('\npath pieces');
console.log('L->midOd', j(L, midOd));
console.log('midOd->midOdBoth', j(midOd, midOdBoth));
console.log('midOdBoth->targetTrue', j(midOdBoth, targetTrue));
console.log('targetTrue->both', j(targetTrue, both));
console.log('both->R', j(both, R));

// Can create-id fire when Od, Or, Os with Or in middle if we use a different absorb?
// Or: from midOdBoth, error-release doesn't apply (Or, Os order).
// What about distributing differently so Os lands before Or?
// Start from midOd where true is {i Od n, Or} - if we could move Or to end of empty... 
// Apply reverse error-release first on midOd: {i Od n, Or} -> {i Od n, n Os, Or} while outer Os remains?
const midOdRev = ',i \\Pu,\\Bb{n \\Pu}{,i \\Od n,n \\Os,\\Or,}{,i \\Od n,},n \\Os,';
console.log('midOd->midOdRev (rev err)', j(midOd, midOdRev));
console.log('midOdRev->target?', j(midOdRev, targetTrue));
