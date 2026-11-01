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
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  const hits: string[] = [];
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      hits.push(rule.id);
  }
  return hits;
}
function show(lab: string, a: string, b: string) {
  console.log(lab, j(a, b));
}

const L = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,';
const R = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},';
const both = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},';
const bothOr = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,n \\Os,},';
const trueOs = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,},n \\Os,';
const trueOs2 = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,},n \\Os,';

show('rev error in true', L, trueOs);
show('rev error Or,Os', L, trueOs2);
show('trueOs -> both', trueOs, both);
show('trueOs2 -> bothOr', trueOs2, bothOr);
show('trueOs -> R+outer?', trueOs, ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},');
show('both -> R', both, R);
show('L -> both direct', L, both);

// Drop outer Os after putting in true? create absorption?
show('trueOs drop outer', trueOs, ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,},');

// Identical: n Os, n Os -> n Os outside+inside?
show('dup Os', trueOs, both);

// Via Blb conversion
const blbL = ',i \\Pu,i \\Od n,\\Blb{n \\Pu}{,\\Or,}{,},n \\Os,';
show('Bb->Blb', L, blbL);
show('Blb Os before via swap?', blbL, ',i \\Pu,i \\Od n,n \\Os,\\Blb{n \\Pu}{,\\Or,}{,},');

// Check rules converting Bb <-> Blb
const conv = all.filter(
  (r) =>
    r.pos < pos &&
    ((/\\Bb/.test(r.leftSide) && /\\Blb/.test(r.rightSide)) ||
      (/\\Blb/.test(r.leftSide) && /\\Bb/.test(r.rightSide))) &&
    r.leftSide.length < 80
);
console.log('\nBb/Blb conv', conv.length);
for (const r of conv.slice(0, 15)) console.log(r.id, r.leftSide, '=>', r.rightSide);

// Book next after R is both - so maybe we should jump L to both with multi-hop skipping R?
// Search justified path L to both without soft ebn
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
const SOFT = new Set(['thm-empty-branch-null']);
function jStrict(a: string, b: string) {
  return j(a, b).filter((id) => !SOFT.has(id));
}

type N = { e: string; path: string[] };
const goal = ensure(both);
const seen = new Set([ensure(L)]);
const q: N[] = [{ e: ensure(L), path: [] }];
const extras = [trueOs, trueOs2, both, bothOr, R, blbL];
for (let d = 0; d < 6 && q.length; d++) {
  const batch = q.splice(0, q.length);
  console.log('bfs', d, batch.length);
  for (const { e, path } of batch) {
    if (e === goal || e === ensure(R)) {
      console.log('FOUND', e === goal ? 'both' : 'R', path);
      process.exit(0);
    }
    const a = tops(e);
    for (let i = 0; i < a.length - 1; i++) {
      const s = a.slice();
      const tmp = s[i]!;
      s[i] = s[i + 1]!;
      s[i + 1] = tmp;
      const next = join(s);
      if (seen.has(next)) continue;
      const rules = jStrict(e, next);
      if (!rules.length) continue;
      seen.add(next);
      q.push({ e: next, path: [...path, rules[0]! + '@swap' + i] });
    }
    for (const cand of extras) {
      const next = ensure(cand);
      if (seen.has(next)) continue;
      const rules = jStrict(e, next);
      if (!rules.length) continue;
      seen.add(next);
      q.push({ e: next, path: [...path, rules[0]!] });
    }
  }
}
console.log('no path, seen', seen.size);
