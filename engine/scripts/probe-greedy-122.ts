import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import fs from 'fs';

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
function od(A: string[], B: string[]): number {
  const target = new Map<string, number[]>();
  for (let i = 0; i < B.length; i++) {
    if (!target.has(B[i]!)) target.set(B[i]!, []);
    target.get(B[i]!)!.push(i);
  }
  const used = new Map<string, number>();
  let d = Math.abs(A.length - B.length) * 2;
  for (let i = 0; i < A.length; i++) {
    const item = A[i]!;
    const slots = target.get(item) ?? [];
    const k = used.get(item) ?? 0;
    const j = k < slots.length ? slots[k]! : B.length + k;
    used.set(item, k + 1);
    d += Math.abs(i - j);
  }
  return d;
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
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 0)!;
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 122;
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
let cur = ensure(f.left);
const goal = ensure(f.right);
const g = tops(goal);
for (let step = 0; step < 20; step++) {
  if (cur === goal) {
    console.log('REACHED', step);
    break;
  }
  const a = tops(cur);
  let best: string | null = null;
  let bestD = od(a, g);
  let bestRule: string | null = null;
  for (let i = 0; i < a.length - 1; i++) {
    if (a[i] === a[i + 1]) continue;
    const s = a.slice();
    const tmp = s[i]!;
    s[i] = s[i + 1]!;
    s[i + 1] = tmp;
    const cand = join(s);
    const d = od(s, g);
    const rule = j(cur, cand);
    if (rule && d < bestD) {
      bestD = d;
      best = cand;
      bestRule = rule;
    }
  }
  if (!best) {
    console.log(
      'stuck',
      tops(cur).map((t) => t.slice(0, 30)),
      'd',
      od(a, g)
    );
    // show all justified
    for (let i = 0; i < a.length - 1; i++) {
      const s = a.slice();
      const tmp = s[i]!;
      s[i] = s[i + 1]!;
      s[i + 1] = tmp;
      console.log(' ', i, j(cur, join(s)), od(s, g));
    }
    break;
  }
  console.log(step, bestRule, bestD, tops(best).map((t) => t.slice(0, 22)));
  cur = best;
}

// 6 s13 bubble then push
const f6 = fails.find((x: { key: string; step: number }) => x.key.includes('::6::') && x.step === 13)!;
const L6 = ensure(f6.left);
const R6 = ensure(f6.right);
const pos6 = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 6;
const index6 = buildRuleIndex(
  all.filter((r) => r.pos < pos6),
  new Map()
);
function j6(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index6, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index6.dagCache }).match)
      return rule.id;
  }
  return null;
}
console.log('\n=== 6 s13 ===');
const s1 = ensure(
  ',i \\nPu,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,}{,i \\Od n,},n \\Pu,t \\Os,n \\Os,'
);
console.log('bubble Pu past Os', j6(L6, s1));
const s2 = ensure(
  ',i \\nPu,i \\Ob t,\\Bb{t \\Pc j}{,n \\Pu,\\Ot n,}{,n \\Pu,i \\Od n,},t \\Os,n \\Os,'
);
console.log('push Pu', j6(s1, s2));
const s3 = ensure(
  ',i \\nPu,i \\Ob t,\\Bb{t \\Pc j}{,n \\Pu,\\Ot n,n \\Os,}{,n \\Pu,i \\Od n,n \\Os,},t \\Os,'
);
console.log('push Os', j6(s2, s3));
const s4 = ensure(
  ',i \\nPu,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,n \\Pu,n \\Os,}{,i \\Od n,n \\Pu,n \\Os,},t \\Os,'
);
console.log('reorder arms to R', j6(s3, s4), 's4==R', s4 === R6);
console.log('s2→R', j6(s2, R6));
console.log('s1→R', j6(s1, R6));
