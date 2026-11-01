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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 143;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
const BLOCK = new Set(['thm-empty-branch-null', 'error-code', 'equiv-code', 'identical-4']);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (BLOCK.has(rule.id)) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const path = [
  ',i \\Ob t_0,t \\Ps t_0,\\Or,t_0 \\Os,',
  ',i \\Ob t_0,t \\Ps t_0,t_0 \\Os,\\Or,',
  ',i \\Ob t_0,t_0 \\Os,t \\Ps t_0,\\Or,',
  ',t \\Ps t_0,\\Or,',
  ',\\Or,',
];
for (let i = 0; i < path.length - 1; i++) {
  console.log(i, '->', i + 1, j(path[i]!, path[i + 1]!));
}

// isolated swaps
console.log('Or/Os', j(',\\Or,t_0 \\Os,', ',t_0 \\Os,\\Or,'));
console.log('Ps/Os', j(',t \\Ps t_0,t_0 \\Os,', ',t_0 \\Os,t \\Ps t_0,'));
console.log('Ob/Ps', j(',i \\Ob t_0,t \\Ps t_0,', ',t \\Ps t_0,i \\Ob t_0,'));

// Full chain on outer Bb
const L =
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\nPu,i \\Ob t,i \\Ob t_0,t \\Ps t_0,\\Or,t_0 \\Os,},';
const steps = [
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\nPu,i \\Ob t,i \\Ob t_0,t \\Ps t_0,t_0 \\Os,\\Or,},',
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\nPu,i \\Ob t,i \\Ob t_0,t_0 \\Os,t \\Ps t_0,\\Or,},',
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\nPu,i \\Ob t,t \\Ps t_0,\\Or,},',
  ',\\Bb{}{,i \\nPu,i \\Ob t,i \\Pb t,}{,i \\nPu,i \\Ob t,\\Or,},',
];
let cur = L;
for (let i = 0; i < steps.length; i++) {
  const rule = j(cur, steps[i]!);
  console.log('full', i, rule);
  if (!rule) {
    // try bfs swaps inside false arm only from cur to steps[i]
    break;
  }
  cur = steps[i]!;
}

// BFS on fragment
type N = { e: string; path: string[] };
const goal = ensure(',\\Or,');
const start = ensure(path[0]!);
const seen = new Set([start]);
const q: N[] = [{ e: start, path: [] }];
for (let d = 0; d < 6 && q.length; d++) {
  const batch = q.splice(0, q.length);
  for (const { e, path: pth } of batch) {
    if (e === goal) {
      console.log('FOUND frag', pth);
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
      const rule = j(e, next);
      if (!rule) continue;
      seen.add(next);
      q.push({ e: next, path: [...pth, rule + '@' + i] });
    }
    // create-subnode drop if Ob+Os adjacent
    for (let i = 0; i < a.length - 1; i++) {
      if (!/\\Ob /.test(a[i]!) || !/\\Os$/.test(a[i + 1]!)) continue;
      const s = a.slice();
      s.splice(i, 2);
      const next = join(s);
      if (seen.has(next)) continue;
      const rule = j(e, next);
      if (!rule) continue;
      seen.add(next);
      q.push({ e: next, path: [...pth, rule + '@drop'] });
    }
    // drop Ps before Or
    for (let i = 0; i < a.length - 1; i++) {
      if (!/\\Ps /.test(a[i]!) || a[i + 1] !== '\\Or') continue;
      const s = a.slice();
      s.splice(i, 1);
      const next = join(s);
      if (seen.has(next)) continue;
      const rule = j(e, next);
      if (!rule) continue;
      seen.add(next);
      q.push({ e: next, path: [...pth, rule + '@dropPs'] });
    }
  }
}
console.log('frag bfs fail seen', seen.size);
