import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';

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
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

function tryDirect(thm: number, step: number) {
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::' + thm + '::') && x.step === step);
  if (!f) {
    console.log(thm, 's' + step, 'MISSING');
    return;
  }
  const A = ensure(f.left);
  const B = ensure(f.right);
  if (matchesDerivedBbTransition(A, B)) {
    console.log(thm, 's' + step, 'DERIVED');
    return;
  }
  const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + thm;
  const index = buildRuleIndex(
    all.filter((r) => r.pos < pos),
    new Map()
  );
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
      console.log(thm, 's' + step, rule.id);
      return;
    }
  }
  console.log(thm, 's' + step, 'NO_DIRECT', 'L#', tops(A).length, 'R#', tops(B).length);
  console.log('  L tops:', tops(A).map((t) => t.slice(0, 40)).join(' | '));
  console.log('  R tops:', tops(B).map((t) => t.slice(0, 40)).join(' | '));
}

const targets: [number, number][] = [
  [150, 10],
  [132, 3],
  [144, 3],
  [144, 7],
  [143, 5],
  [143, 11],
  [129, 10],
  [129, 12],
  [23, 0],
  [23, 1],
  [23, 3],
  [23, 4],
];
for (const [t, s] of targets) tryDirect(t, s);

// Adjacent swaps for 150 and 129
for (const [thm, step] of [
  [150, 10],
  [129, 10],
  [129, 12],
  [132, 3],
] as [number, number][]) {
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::' + thm + '::') && x.step === step)!;
  const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + thm;
  const index = buildRuleIndex(
    all.filter((r) => r.pos < pos),
    new Map()
  );
  const j = (a: string, b: string) => {
    const A = ensure(a);
    const B = ensure(b);
    if (matchesDerivedBbTransition(A, B)) return 'derived';
    for (const rule of getRulesForTransition(index, A, B)) {
      if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
        return rule.id;
    }
    return null;
  };
  console.log('\n--- adjacent swaps', thm, 's' + step);
  const L = ensure(f.left);
  const a = tops(L);
  for (let i = 0; i < a.length - 1; i++) {
    const s = a.slice();
    const tmp = s[i]!;
    s[i] = s[i + 1]!;
    s[i + 1] = tmp;
    const rule = j(L, join(s));
    if (rule) console.log('  swap', i, rule, a[i]!.slice(0, 24), '<->', a[i + 1]!.slice(0, 24));
  }
  // Also try drop each atom
  for (let i = 0; i < a.length; i++) {
    const s = a.slice();
    s.splice(i, 1);
    const rule = j(L, join(s));
    if (rule) console.log('  drop', i, rule, a[i]!.slice(0, 40));
  }
}
