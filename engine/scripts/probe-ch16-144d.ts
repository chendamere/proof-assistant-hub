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
const SOFT = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4']);
function jStrict(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  const hits: string[] = [];
  for (const rule of getRulesForTransition(index, A, B)) {
    if (SOFT.has(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      hits.push(rule.id);
  }
  return hits;
}
function jAll(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  const hits: string[] = [];
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      hits.push(rule.id);
  }
  return hits;
}

const L = ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},n \\Os,');
const R = ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},');

// Reconstruct bfs neighbors without soft
console.log('L swaps strict:');
const a = tops(L);
for (let i = 0; i < a.length - 1; i++) {
  const s = a.slice();
  const tmp = s[i]!;
  s[i] = s[i + 1]!;
  s[i + 1] = tmp;
  const next = join(s);
  const rules = jStrict(L, next);
  const allr = jAll(L, next);
  if (rules.length || allr.length) console.log(i, 'strict', rules, 'all', allr, next);
}

// Try equiv-code-dist candidates: push n Os into both arms (keeping outer? or not)
const cands = [
  ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,n \\Os,},',
  ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},',
  ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,\\Or,n \\Os,},',
  ',i \\Pu,i \\Od n,n \\Os,\\Bb{n \\Pu}{,\\Or,}{,},',
  ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,},\\Or,n \\Os,',
  ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,}{,n \\Os,},n \\Os,',
];
console.log('\ncandidates from L:');
for (const c of cands) {
  console.log(c.slice(0, 70), 'strict', jStrict(L, c), 'all', jAll(L, c));
}

// Previous bfs allowed error-code. What did equiv-code-dist produce?
const ecd = all.find((r) => r.id === 'equiv-code-dist')!;
const ec = all.find((r) => r.id === 'error-code')!;
console.log('\nequiv-code-dist', ecd.leftSide, '=>', ecd.rightSide);
console.log('error-code', ec.leftSide, '=>', ec.rightSide);

// Manual: L with Os after -> distribute Os into arms via equiv-code-dist
// Pattern often: X, Bb{c}{T}{F} => Bb{c}{T,X}{F,X} or similar with ~
show: for (const mid of [
  ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,\\Or,n \\Os,}{,n \\Os,},',
  ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},',
]) {
  const h = jAll(L, mid);
  if (h.includes('equiv-code-dist')) {
    console.log('L->mid via ecd', mid);
    console.log('mid->R', jAll(mid, R));
  }
}

// Path that previous bfs found: swap then ecd then error-code?
// Enumerate depth-2 with ALL rules including error-code but NOT empty-branch-null
const BLOCK = new Set(['thm-empty-branch-null']);
function jOk(a: string, b: string) {
  return jAll(a, b).filter((id) => !BLOCK.has(id));
}
type N = { e: string; path: string[]; labs: string[] };
const seen = new Set([L]);
const q: N[] = [{ e: L, path: [], labs: [] }];
for (let d = 0; d < 4 && q.length; d++) {
  const batch = q.splice(0, q.length);
  console.log('bfs', d, batch.length);
  for (const { e, path, labs } of batch) {
    if (e === R) {
      console.log('FOUND');
      for (let i = 0; i < path.length; i++) console.log(i + 1, labs[i], path[i]);
      process.exit(0);
    }
    const items = tops(e);
    const nexts: { n: string; lab: string }[] = [];
    for (let i = 0; i < items.length - 1; i++) {
      const s = items.slice();
      const tmp = s[i]!;
      s[i] = s[i + 1]!;
      s[i + 1] = tmp;
      nexts.push({ n: join(s), lab: 'swap' + i });
    }
    for (const c of cands) nexts.push({ n: ensure(c), lab: 'cand' });
    nexts.push({ n: R, lab: 'goal' });
    for (const { n, lab } of nexts) {
      if (seen.has(n)) continue;
      const rules = jOk(e, n);
      if (!rules.length) continue;
      seen.add(n);
      q.push({ e: n, path: [...path, n], labs: [...labs, rules[0]! + '@' + lab] });
    }
  }
}
console.log('not found');
