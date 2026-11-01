/**
 * s21 path: L + create-temps → arrange Ot s1,Ot s2,Pe,s2 Os,s1 Os → drop Pe → cancel s1 → drop sandwich → cancel extra Ot s2 into arm?
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
  const r = j(a, b);
  console.log(n, r ?? 'NULL');
  return r;
}

const sandwich = 'i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,';
const L = ensure(`,${sandwich}s_1 \\Pe s_2,`);
const R = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,');

// Fragment chain
const f0 = ensure(',\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,s_2 \\Os,s_1 \\Os,');
const f1 = ensure(',\\Ot s_1,\\Ot s_2,s_2 \\Os,s_1 \\Os,');
const f2 = ensure(',\\Ot s_1,s_1 \\Os,\\Ot s_2,s_2 \\Os,');
const f3 = ensure(',\\Ot s_2,s_2 \\Os,');
show('f0->f1 drop Pe', f0, f1);
show('f1->f2 reorder', f1, f2);
show('f2->f3 cancel s1', f2, f3);

// Full: build L2 then bubble to contig form
const L1 = ensure(L.replace(/,$/, ',\\Ot s_2,s_2 \\Os,'));
const L2 = ensure(L1.replace(/,$/, ',\\Ot s_1,s_1 \\Os,'));
show('L->L1', L, L1);
show('L1->L2', L1, L2);

// L2 ends: ..., Pe, Ot s2, s2 Os, Ot s1, s1 Os
// Want: ..., Ot s1, Ot s2, Pe, s2 Os, s1 Os
const steps: string[] = [L2];
function add(label: string, next: string) {
  const prev = steps[steps.length - 1]!;
  const r = show(label, prev, next);
  if (r) steps.push(ensure(next));
  return !!r;
}

add(
  'bubble Ot s1 left past s2 Os',
  L2.replace(',\\Ot s_2,s_2 \\Os,\\Ot s_1,s_1 \\Os,', ',\\Ot s_2,\\Ot s_1,s_2 \\Os,s_1 \\Os,')
);
add(
  'alt: Ot s1 before Ot s2',
  L2.replace(',s_1 \\Pe s_2,\\Ot s_2,s_2 \\Os,\\Ot s_1,s_1 \\Os,', ',s_1 \\Pe s_2,\\Ot s_1,\\Ot s_2,s_2 \\Os,s_1 \\Os,')
);

// Try oneStepRewrites to find path L2 -> contig
const contig = ensure(`,${sandwich}\\Ot s_1,\\Ot s_2,s_1 \\Pe s_2,s_2 \\Os,s_1 \\Os,`);
console.log('\ncontig', contig);
console.log('L2==contig', L2 === contig);

const RULES = [
  'swap-temp-release',
  'swap-temp-temp',
  'swap-release-release',
  'theorems-of-relationship-of-node-value-comparison-19-iejtm',
  'theorems-of-relationship-of-node-value-comparison-24-iejms',
  'temp-value-equal',
  'create-temp',
];

function score(e: string, goal: string) {
  const a = ensure(e);
  const b = ensure(goal);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) d++;
  return d;
}

console.log('\nBFS L2 -> contig');
{
  const seen = new Set([L2]);
  const q: Array<{ e: string; via: string[] }> = [{ e: L2, via: [] }];
  let found = false;
  let best = { e: L2, via: [] as string[], sc: score(L2, contig) };
  let n = 0;
  while (q.length && n < 1500 && !found) {
    const cur = q.shift()!;
    n++;
    for (const id of RULES) {
      const rule = all.find((r) => r.id === id);
      if (!rule) continue;
      for (const o of oneStepRewrites(cur.e, rule.leftSide, rule.rightSide).slice(0, 15)) {
        const e = ensure(o);
        if (seen.has(e)) continue;
        seen.add(e);
        const via = [...cur.via, id];
        const sc = score(e, contig);
        if (sc < best.sc) {
          best = { e, via, sc };
          console.log('improv', sc, via.join('>'), e.slice(-80));
        }
        if (e === contig) {
          console.log('FOUND contig', via.join(' > '));
          found = true;
          break;
        }
        if (via.length < 6 && sc < best.sc + 40) q.push({ e, via });
      }
      if (found) break;
    }
  }
  console.log('bfs done n', n, 'best', best.sc, best.via.join('>'));
  console.log('best end', best.e.slice(-100));
}

// After contig: drop Pe, reorder, cancel s1
const c1 = ensure(`,${sandwich}\\Ot s_1,\\Ot s_2,s_2 \\Os,s_1 \\Os,`);
const c2 = ensure(`,${sandwich}\\Ot s_1,s_1 \\Os,\\Ot s_2,s_2 \\Os,`);
const c3 = ensure(`,${sandwich}\\Ot s_2,s_2 \\Os,`);
show('contig->c1', contig, c1);
show('c1->c2', c1, c2);
show('c2->c3', c2, c3);

// From c3: still have BOTH sandwiches + Ot s2,s2 Os. Need drop first sandwich AND the extra Ot s2
// (second Bb already has Ot s2). Cancel create-temp Ot s2,s2 Os would remove needed s2 Os.
// Instead: push Ot s2 into second true arm (duplicate), keep s2 Os
const c4 = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_2 \\Os,'
);
show('c3->c4 push Ot into t2 true', c3, c4);

// Or drop first sandwich from c3 while keeping Ot s2,s2 Os
const c3drop = ensure(',i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_2,s_2 \\Os,');
show('c3->c3drop', c3, c3drop);
show('c3drop->R cancel Ot s2', c3drop, R);

// Collapse first sandwich from c3 using create chain (need s1 Os in arms)
// We already used s1 Os to cancel top Ot s1. So collapse first sandwich BEFORE canceling s1.
console.log('\n--- collapse first sandwich before canceling top Ot s1 ---');
const mid = ensure(`,${sandwich}\\Ot s_1,\\Ot s_2,s_2 \\Os,s_1 \\Os,`); // = c1
// Push the trailing s1 Os into first Bb arms, leave Ot s1,Ot s2,s2 Os at end
const midPush = ensure(
  ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_1 \\Os,}{,i \\Od s_1,s_1 \\Os,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_1,\\Ot s_2,s_2 \\Os,'
);
show('c1->midPush', c1, midPush);

// Put s1 Os before first Bb then atom-into
const midBefore = ensure(
  ',i \\Ob t_1,s_1 \\Os,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,\\Ot s_1,\\Ot s_2,s_2 \\Os,'
);
show('c1->midBefore', c1, midBefore);

// From L2, push s1 Os into arms FIRST (before dropping Pe), using the create-temp s1 Os
const L2push = L2.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,}',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_1 \\Os,}{,i \\Od s_1,s_1 \\Os,}'
).replace(/,\\Ot s_1,s_1 \\Os,$/, ',\\Ot s_1,');
show('L2->L2push', L2, ensure(L2push));
console.log('L2push', ensure(L2push).slice(0, 220));
