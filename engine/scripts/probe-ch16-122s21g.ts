/**
 * Finish s21: bubble Pe past Ot's then drop Pe; also probe 144 fold.
 */
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';

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
  let t = normalizeSpacing(fromOperatorFirst(stripDisplayIfConditions(s))).trim();
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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4', 'equiv-code-dist']);
function j(a: string, b: string): string | null {
  if (ensure(a) === ensure(b)) return 'identity';
  if (matchesDerivedBbTransition(ensure(a), ensure(b))) return 'derived';
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
function show(n: string, a: string, b: string) {
  console.log(n, j(a, b) ?? 'NULL');
}

const sandwich =
  'i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,';
const L = ensure(`,${sandwich}s_1 \\Pe s_2,`);
const R = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,');

const L1 = ensure(L.replace(/,$/, ',\\Ot s_2,s_2 \\Os,'));
const L2 = ensure(L1.replace(/,$/, ',\\Ot s_1,s_1 \\Os,'));
// best from prior BFS:
const b1 = ensure(L2.replace(',s_1 \\Pe s_2,\\Ot s_2,s_2 \\Os,\\Ot s_1,s_1 \\Os,', ',s_1 \\Pe s_2,\\Ot s_2,\\Ot s_1,s_2 \\Os,s_1 \\Os,'));
const b2 = ensure(b1.replace(',s_1 \\Pe s_2,\\Ot s_2,\\Ot s_1,s_2 \\Os,s_1 \\Os,', ',s_1 \\Pe s_2,\\Ot s_1,\\Ot s_2,s_2 \\Os,s_1 \\Os,'));
show('L->L1', L, L1);
show('L1->L2', L1, L2);
show('L2->b1', L2, b1);
show('b1->b2', b1, b2);
console.log('b2 end', b2.slice(-90));

const contig = ensure(`,${sandwich}\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,s_2 \\Os,s_1 \\Os,`);
// bubble Pe right past Ot s1
const p1 = ensure(b2.replace(',s_1 \\Pe s_2,\\Ot s_1,\\Ot s_2,s_2 \\Os,s_1 \\Os,', ',\\Ot s_1,s_1 \\Pe s_2,\\Ot s_2,s_2 \\Os,s_1 \\Os,'));
show('b2->p1 Pe past Ot s1', b2, p1);
const p2 = ensure(p1.replace(',\\Ot s_1,s_1 \\Pe s_2,\\Ot s_2,s_2 \\Os,s_1 \\Os,', ',\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,s_2 \\Os,s_1 \\Os,'));
show('p1->p2 Pe past Ot s2', p1, p2);
show('p2==contig', p2, contig);

const c1 = ensure(`,${sandwich}\\Ot s_1,\\Ot s_2,s_2 \\Os,s_1 \\Os,`);
show('contig->c1 drop Pe', contig, c1);

// reorder s1 Os next to Ot s1
const c2a = ensure(`,${sandwich}\\Ot s_1,s_1 \\Os,\\Ot s_2,s_2 \\Os,`);
const c2b = ensure(`,${sandwich}\\Ot s_1,\\Ot s_2,s_1 \\Os,s_2 \\Os,`);
show('c1->c2a', c1, c2a);
show('c1->c2b', c1, c2b);
// bubble s1 Os left past s2 Os
const c1b = ensure(`,${sandwich}\\Ot s_1,\\Ot s_2,s_1 \\Os,s_2 \\Os,`);
show('c1->c1b swap Os', c1, c1b);
const c1c = ensure(`,${sandwich}\\Ot s_1,s_1 \\Os,\\Ot s_2,s_2 \\Os,`);
show('c1b->c1c Os past Ot s2', c1b, c1c);
show('c1c->cancel', c1c, ensure(`,${sandwich}\\Ot s_2,s_2 \\Os,`));

// Search Pe/Ot swap rule ids
console.log('\nPe/Ot swap rules:');
for (const r of all) {
  if (r.pos >= pos) continue;
  const s = r.leftSide + r.rightSide;
  if (/\\Pe/.test(s) && /\\Ot/.test(s) && r.leftSide.length < 80) {
    console.log(r.id, r.leftSide, '↔', r.rightSide);
  }
}

// 144 fold
console.log('\n=== 144 ===');
const pos144 = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 144;
const index144 = buildRuleIndex(
  all.filter((r) => r.pos < pos144),
  new Map()
);
function j144(a: string, b: string): string | null {
  if (ensure(a) === ensure(b)) return 'identity';
  if (matchesDerivedBbTransition(ensure(a), ensure(b))) return 'derived';
  for (const rule of getRulesForTransition(index144, ensure(a), ensure(b))) {
    if (BLOCK.has(rule.id)) continue;
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index144.dagCache,
      }).match
    )
      return rule.id;
  }
  return null;
}
const L144 = ensure(
  ',i \\Pu,\\Bb{i \\Pu}{,i \\Od n,}{,i \\Od m,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,},\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},'
);
const R144 = ensure(',i \\Pu,i \\nPb t,');
console.log('direct', j144(L144, R144));

// take true arm: i Pu, Bb{i Pu}{T}{F} → i Pu, T
const t1 = ensure(',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},');
console.log('take true', j144(L144, t1));
// drop false arm content another way
const t1b = ensure(
  ',i \\Pu,\\Bb{i \\Pu}{,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},}{,i \\Od m,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},},'
);
console.log('factor nPu into outer', j144(L144, t1b));

// match definition of Pb / nPb
const def0 = all.find((r) => r.id.includes('relationship-of-subnode-0') || r.leftSide.includes('\\Blb{if(i \\Pb j)}'));
for (const r of all) {
  if (r.pos >= pos144) continue;
  if (r.pos < CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000) continue;
  if (/\\nPb/.test(r.leftSide + r.rightSide) && r.leftSide.length < 100) {
    console.log(r.id, '\n ', r.leftSide, '\n ', r.rightSide);
  }
}

// Try: L144 → something matching subnode def then fold
const defPb = ensure(
  ',\\Bb{i \\Pu}{,i \\Od n,}{,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,}{,i \\Od n,},t \\Os,},\\Blb{n \\Pu}{,n \\Os,}{,n \\Os,},'
);
console.log('L144 vs def shape related?');

// Collapse Bb{n Pu}{n Os Or}{n Os} → n Os Or via take? 
const u1 = ensure(',i \\Pu,\\Bb{i \\Pu}{,i \\Od n,}{,i \\Od m,\\Bb{m \\Pc t}{,\\Ot n,}{,i \\Od n,},m \\Os,},n \\Os,\\Or,');
console.log('collapse nPu true (has Or)', j144(L144, u1));

// i Pu + Or → ? 
const u2 = ensure(',i \\Pu,i \\nPb t,');
console.log('u1->R', j144(u1, R144));

// Check subnode-0 (Blb Pb definition) id
for (const r of all) {
  if (!r.id.startsWith('rules-of-relationship-of-subnode-')) continue;
  if (r.pos >= pos144) continue;
  const idx = parseInt(r.id.split('-').slice(-2)[0] || '99', 10);
  if (idx <= 12 || /nPb|\\\\sim/.test(r.leftSide + r.rightSide)) {
    console.log(r.id, r.leftSide.slice(0, 60), '↔', r.rightSide.slice(0, 80));
  }
}
