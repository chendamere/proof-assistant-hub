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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 144;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string) {
  if (ensure(a) === ensure(b)) return 'identity';
  if (matchesDerivedBbTransition(ensure(a), ensure(b))) return 'derived';
  for (const rule of getRulesForTransition(index, ensure(a), ensure(b))) {
    if (
      checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide, {
        dagCache: index.dagCache,
      }).match
    )
      return rule.id;
  }
  return null;
}

const a3 = ensure(',i \\Pu,i \\Od n,n \\nPu,');
const a4 = ensure(',i \\Pu,i \\Od n,');
const tPu = ensure(',i \\Pu,');
const R = ensure(',i \\Pu,i \\nPb t,');
console.log('a3->a4', j(a3, a4));
console.log('a4->tPu', j(a4, tPu));
console.log('a4->R', j(a4, R));
console.log('a3->R', j(a3, R));
console.log('a3->tPu', j(a3, tPu));

// create-temp add Os then create-id
const a4b = ensure(',i \\Pu,i \\Od n,\\Ot n,n \\Os,');
console.log('a4->a4b', j(a4, a4b));
const a4c = ensure(',i \\Pu,i \\Od n,n \\Os,');
console.log('a4b->a4c', j(a4b, a4c));
console.log('a4c->tPu', j(a4c, tPu));

// BFS from a3 to tPu
const RULES = ['create-temp', 'create-id', 'id-not-null', 'temp-value-equal', 'swap-id-release', 'swap-temp-release', 'def-null-neg', 'error-release'];
const seen = new Set([a3]);
const q = [{ e: a3, via: [] as string[] }];
let n = 0;
while (q.length && n < 800) {
  const cur = q.shift()!;
  n++;
  if (cur.e === tPu || cur.e === R) {
    console.log('FOUND', cur.via.join('>'), cur.e);
    break;
  }
  for (const id of RULES) {
    const rule = all.find((r) => r.id === id);
    if (!rule) continue;
    for (const o of oneStepRewrites(cur.e, rule.leftSide, rule.rightSide).slice(0, 8)) {
      const e = ensure(o);
      if (seen.has(e)) continue;
      seen.add(e);
      if (cur.via.length < 5) q.push({ e, via: [...cur.via, id] });
    }
  }
  // also try known targets
  for (const tgt of [a4, tPu, R, a4c, ensure(',i \\Pu,n \\nPu,')]) {
    const r = j(cur.e, tgt);
    if (r && !seen.has(tgt)) {
      seen.add(tgt);
      q.push({ e: tgt, via: [...cur.via, r] });
    }
  }
}
console.log('bfs n', n, 'seen', seen.size);

// List id-not-null
const inn = all.find((r) => r.id === 'id-not-null' || r.id.includes('id-not-null'));
console.log('id-not-null', inn);
for (const r of all) {
  if (r.pos >= pos) continue;
  if (/not-null|Od.*nPu|nPu.*Od/.test(r.id + r.leftSide + r.rightSide) && r.leftSide.length < 50) {
    console.log(r.id, r.leftSide, '↔', r.rightSide);
  }
}
