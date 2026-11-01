/**
 * Probe 122 flat:0 step 21 — drop first Ob/Bb/Os + Pe, add s2 Os.
 */
import fs from 'fs';
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
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l));
const f = fails.find(
  (x: { key: string; step: number; part?: string }) =>
    x.key.includes('::122::') && x.step === 21 && (!x.part || x.part === 'flat:0' || x.part === 'flat')
)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4', 'equiv-code-dist']);

function justified(a: string, b: string): string | null {
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

const L = ensure(f.left);
const R = ensure(f.right);
console.log('L', L);
console.log('R', R);
console.log('direct', justified(L, R));

// Manual candidate chain pieces
const candidates: Array<[string, string]> = [];

// 1) Move Pe into true arm of t2 Bb
const peIntoT2 = L.replace(
  '\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,s_1 \\Pe s_2,',
  '\\Bb{t_2 \\Pc j}{,\\Ot s_2,s_1 \\Pe s_2,}{,i \\Od s_2,s_1 \\Pe s_2,},t_2 \\Os,'
);
candidates.push(['peIntoT2', peIntoT2]);

// 2) Move Pe into true arm of t1 Bb
const peIntoT1 = L.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,}',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_1 \\Pe s_2,}{,i \\Od s_1,s_1 \\Pe s_2,}'
).replace(/,s_1 \\Pe s_2,$/, ',');
candidates.push(['peIntoT1', peIntoT1]);

// 3) Drop first sandwich entirely (target-like)
const dropFirst = L.replace(
  'i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
  ''
);
candidates.push(['dropFirst', dropFirst]);

// 4) dropFirst then Pe→s2 Os via somehow
const dropFirstPeToOs = dropFirst.replace(',s_1 \\Pe s_2,', ',s_2 \\Os,');
candidates.push(['dropFirstPeToOs', dropFirstPeToOs]);

// 5) Empty true arm of t1 (create-temp reverse Ot+need Os)
const emptyOt = L.replace('{,\\Ot s_1,}{,i \\Od s_1,}', '{,}{,i \\Od s_1,}');
candidates.push(['emptyOt', emptyOt]);

// 6) Scaffold Os into false then create-id collapse
const scaffoldOs = L.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,',
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_1 \\Os,}{,i \\Od s_1,s_1 \\Os,},t_1 \\Os,'
);
candidates.push(['scaffoldOs', scaffoldOs]);

// 7) After scaffold, empty Ot via create-temp
const afterScaffoldEmpty = scaffoldOs.replace(
  '\\Bb{t_1 \\Pc j}{,\\Ot s_1,s_1 \\Os,}{,i \\Od s_1,s_1 \\Os,}',
  '\\Bb{t_1 \\Pc j}{,}{,i \\Od s_1,s_1 \\Os,}'
);
candidates.push(['afterScaffoldEmpty', afterScaffoldEmpty]);

for (const [name, expr] of candidates) {
  console.log(`\n== ${name} ==`);
  console.log('L->cand', justified(L, expr));
  console.log('cand==R', ensure(expr) === R);
  console.log('cand->R', justified(expr, R));
  console.log('cand', ensure(expr).slice(0, 160));
}

// BFS toward R with preferred rules
const PREFER = new Set([
  'create-temp',
  'create-id',
  'create-subnode',
  'create-empty',
  'temp-value-equal',
  'id-value-equal',
  'swap-temp-release',
  'swap-id-release',
  'swap-subnode-release',
  'swap-release-release',
  'rules-of-node-continuity-320-tiini',
  'release-next',
  'thm-Pe-symmetric',
  'thm-Pe-reflexive',
]);

function score(e: string) {
  const a = ensure(e);
  const b = R;
  let d = Math.abs(a.length - b.length);
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  // bonus: missing first sandwich, has s2 Os, no Pe
  if (!a.includes('t_1 \\Os') && !a.includes('Ob t_1')) d -= 40;
  if (a.includes('s_2 \\Os')) d -= 20;
  if (!a.includes('Pe')) d -= 15;
  return d;
}

type Node = { expr: string; path: string[]; via: string[] };
const start: Node = { expr: L, path: [L], via: [] };
const seen = new Set([L]);
const queue: Node[] = [start];
let best: Node = start;
let bestScore = score(L);
const MAX = 800;
let explored = 0;

console.log('\nBFS start score', bestScore);

outer: while (queue.length && explored < MAX) {
  const cur = queue.shift()!;
  explored++;
  const rewrites = oneStepRewrites(cur.expr, index, {
    maxResults: 40,
    preferIds: [...PREFER],
  });
  // also try derived from matching getRules manually for create-*
  const neighbors: Array<{ expr: string; rule: string }> = [];
  for (const rw of rewrites) {
    neighbors.push({ expr: ensure(rw.expr), rule: rw.ruleId ?? 'rw' });
  }
  // force-check a few hand targets from current
  for (const [, cand] of candidates) {
    const j = justified(cur.expr, cand);
    if (j) neighbors.push({ expr: ensure(cand), rule: j });
  }
  // try create-temp / create-id / create-subnode against getRules
  for (const rule of getRulesForTransition(index, cur.expr, R).slice(0, 5)) {
    /* noop seed */
  }
  for (const nb of neighbors) {
    if (seen.has(nb.expr)) continue;
    seen.add(nb.expr);
    const node: Node = {
      expr: nb.expr,
      path: [...cur.path, nb.expr],
      via: [...cur.via, nb.rule],
    };
    const sc = score(nb.expr);
    if (sc < bestScore) {
      bestScore = sc;
      best = node;
      console.log('improv', bestScore, 'via', nb.rule, 'len', node.path.length, nb.expr.slice(0, 100));
    }
    if (nb.expr === R) {
      console.log('\nFOUND path len', node.path.length);
      console.log('via', node.via.join(' -> '));
      for (let i = 0; i < node.path.length; i++) {
        console.log(`  [${i}]`, node.path[i]!.slice(0, 140));
      }
      break outer;
    }
    if (node.path.length < 8 && sc < bestScore + 80) queue.push(node);
  }
}
console.log('\nBFS done explored', explored, 'seen', seen.size, 'bestScore', bestScore);
console.log('best via', best.via.join(' -> '));
console.log('best', best.expr.slice(0, 200));
console.log('best->R', justified(best.expr, R));
