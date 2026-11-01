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

function greedy(f: { key: string; step: number; left: string; right: string }) {
  const thm = parseInt(f.key.split('::')[1]!, 10);
  const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + thm;
  const index = buildRuleIndex(
    all.filter((r) => r.pos < pos),
    new Map()
  );
  const j = (a: string, b: string) => {
    const A = ensure(a);
    const B = ensure(b);
    for (const rule of getRulesForTransition(index, A, B)) {
      if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
        return rule.id;
    }
    return null;
  };
  let cur = ensure(f.left);
  const goal = ensure(f.right);
  const g = tops(goal);
  const path: string[] = [];
  for (let step = 0; step < 30; step++) {
    if (cur === goal) return path;
    const a = tops(cur);
    if (
      a
        .slice()
        .sort()
        .join('\n') !==
      g
        .slice()
        .sort()
        .join('\n')
    )
      return null;
    let best: string | null = null;
    let bestD = od(a, g);
    for (let i = 0; i < a.length - 1; i++) {
      if (a[i] === a[i + 1]) continue;
      const s = a.slice();
      const tmp = s[i]!;
      s[i] = s[i + 1]!;
      s[i + 1] = tmp;
      const cand = join(s);
      const d = od(s, g);
      if (d < bestD && j(cur, cand)) {
        bestD = d;
        best = cand;
      }
    }
    if (!best) return null;
    path.push(best);
    cur = best;
  }
  return cur === goal ? path : null;
}

let n = 0;
for (const f of fails) {
  const path = greedy(f);
  if (path) {
    console.log('GREEDY', f.key.split('::')[1], 's' + f.step, '+' + path.length);
    n++;
  }
}
console.log('greedy solves', n, 'of', fails.length);

// Also try create-temp/id one-hop shrinks
let c = 0;
for (const f of fails) {
  const thm = parseInt(f.key.split('::')[1]!, 10);
  const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + thm;
  const index = buildRuleIndex(
    all.filter((r) => r.pos < pos),
    new Map()
  );
  const j = (a: string, b: string) => {
    const A = ensure(a);
    const B = ensure(b);
    for (const rule of getRulesForTransition(index, A, B)) {
      if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
        return rule.id;
    }
    return null;
  };
  const L = ensure(f.left);
  const R = ensure(f.right);
  if (j(L, R)) {
    console.log('DIRECT', f.key.split('::')[1], 's' + f.step, j(L, R));
    c++;
  }
}
console.log('direct', c);
