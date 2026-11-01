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
function tops(e: string): string[] {
  const items: string[] = [];
  let d = 0,
    s = 0;
  const x = ensure(e);
  for (let i = 0; i < x.length; i++) {
    if (x[i] === '{') d++;
    else if (x[i] === '}') d--;
    else if (x[i] === ',' && d === 0) {
      const p = x.slice(s, i).trim();
      if (p) items.push(p);
      s = i + 1;
    }
  }
  const t = x.slice(s).trim();
  if (t) items.push(t);
  return items;
}
function join(items: string[]) {
  return ensure(',' + items.join(',') + ',');
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
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}
function chk(a: string, b: string, lab: string) {
  console.log(lab, j(a, b) ?? 'FAIL');
}

const L = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,';
const R = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},';

// empty-branch-null rule text
const ebn = all.find((r) => r.id.includes('empty-branch-null'))!;
console.log('ebn', ebn?.id, ebn?.leftSide, '=>', ebn?.rightSide);

chk(L, R, 'direct');

// Path A: Os into both arms (null-12) then clean true
const both = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},';
chk(L, both, 'L->both');
chk(both, R, 'both->R');

// Path B: swap Os left next to Bb then push
const s1 = ',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},';
chk(L, s1, 'L->Os before Bb');
chk(s1, R, 's1->R');

// Path C: via true-only then move
const trueOnly = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,},';
chk(L, trueOnly, 'L->trueOnly');
chk(trueOnly, both, 'true->both');
chk(trueOnly, R, 'true->R');

// Path D: Or with Os
const orOs = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,},';
chk(L, orOs, 'L->orOs');
chk(orOs, R, 'orOs->R');

// Look at null-12
const n12 = all.find((r) => r.id.includes('null-comparison-12') || r.id.includes('12-mslbifi'))!;
console.log(
  'null12 candidates',
  all.filter((r) => /null-comparison-12/.test(r.id) || r.id === 'theorems-of-node-null-comparison-12-mslbifi').map((r) => [r.id, r.leftSide, r.rightSide])
);

// BFS shallow: swaps + null-12 style push
type N = { e: string; path: string[] };
const seen = new Set([ensure(L)]);
const q: N[] = [{ e: ensure(L), path: [] }];
const goal = ensure(R);
for (let d = 0; d < 5 && q.length; d++) {
  const batch = q.splice(0, q.length);
  console.log('bfs', d, batch.length);
  for (const { e, path } of batch) {
    if (e === goal) {
      console.log('FOUND', path);
      process.exit(0);
    }
    const a = tops(e);
    // swaps
    for (let i = 0; i < a.length - 1; i++) {
      const s = a.slice();
      const tmp = s[i]!;
      s[i] = s[i + 1]!;
      s[i + 1] = tmp;
      const next = join(s);
      if (seen.has(next)) continue;
      const rule = j(e, next);
      if (!rule) continue;
      seen.add(next);
      q.push({ e: next, path: [...path, rule] });
    }
    // try known mids
    for (const cand of [both, trueOnly, s1, R, orOs]) {
      const next = ensure(cand);
      if (seen.has(next)) continue;
      const rule = j(e, next);
      if (!rule) continue;
      seen.add(next);
      q.push({ e: next, path: [...path, rule + '=>' + next.slice(0, 40)] });
    }
  }
}
console.log('not found, seen', seen.size);
