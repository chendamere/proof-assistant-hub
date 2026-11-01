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
const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + 150;
const index = buildRuleIndex(
  all.filter((r) => r.pos < pos),
  new Map()
);
function j(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (matchesDerivedBbTransition(A, B)) return 'derived';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const L = ensure(',i \\Oc i_0,i \\Oc i_1,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,');
const R = ensure(',i \\Oc i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,');
console.log('direct', j(L, R));

// Try: reintroduce Ps then drop both; flip Pc; wrap; etc.
const candidates = [
  ',i \\Oc i_0,i \\Oc i_1,i_0 \\Pc i,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  ',i \\Oc i_0,i \\Oc i_1,i \\Ps i_0,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  ',i \\Oc i_0,i \\Ps i_0,i \\Oc i_1,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  ',i \\Oc i_0,i \\Oc i_1,i_1 \\Pb i,i \\Pc i_0,i_1 \\Os,i_0 \\Os,',
  ',i \\Oc i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i \\Pc i_0,i_0 \\Os,',
  ',i \\Oc i_0,i \\Oc i_1,i \\Pc i_0,i_1 \\Os,i_1 \\Pb i,i_0 \\Os,',
  ',i \\Oc i_0,i \\Pc i_0,i \\Oc i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  // with i_0 Ps i_1 or similar scaffolding
  ',i \\Oc i_0,i \\Oc i_1,i_0 \\Ps i_1,i \\Pc i_0,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
  ',i \\Oc i_0,i \\Oc i_1,i \\Pc i_0,i_0 \\Ps i_1,i_1 \\Pb i,i_1 \\Os,i_0 \\Os,',
];

for (const c of candidates) {
  const r1 = j(L, c);
  const r2 = j(c, R);
  if (r1 || r2) console.log('via', c.slice(0, 70), '\n  L->c', r1, 'c->R', r2);
}

// BFS depth 3 for drop path
type Node = { e: string; path: string[] };
const goal = R;
const start = L;
const seen = new Set([start]);
const q: Node[] = [{ e: start, path: [] }];
let found: string[] | null = null;
outer: for (let depth = 0; depth < 4 && q.length; depth++) {
  const batch = q.splice(0, q.length);
  console.log('bfs depth', depth, 'frontier', batch.length);
  for (const { e, path } of batch) {
    if (e === goal) {
      found = path;
      break outer;
    }
    const a = tops(e);
    // adjacent swaps
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
      q.push({ e: next, path: [...path, rule + '@swap' + i] });
    }
    // drop each
    for (let i = 0; i < a.length; i++) {
      const s = a.slice();
      s.splice(i, 1);
      const next = join(s);
      if (seen.has(next)) continue;
      const rule = j(e, next);
      if (!rule) continue;
      seen.add(next);
      q.push({ e: next, path: [...path, rule + '@drop' + i] });
    }
    // flip Pc i_0 <-> i_0 Pc i
    for (let i = 0; i < a.length; i++) {
      const m = a[i]!.match(/^([A-Za-z0-9_]+) \\Pc ([A-Za-z0-9_]+)$/);
      if (!m) continue;
      const s = a.slice();
      s[i] = `${m[2]} \\Pc ${m[1]}`;
      const next = join(s);
      if (seen.has(next)) continue;
      const rule = j(e, next);
      if (!rule) continue;
      seen.add(next);
      q.push({ e: next, path: [...path, rule + '@flipPc'] });
    }
    // insert Ps after Oc pairs: i Ps i_0, i Ps i_1
    for (const ps of ['i \\Ps i_0', 'i \\Ps i_1', 'i_0 \\Ps i_1', 'i_1 \\Ps i_0']) {
      for (let i = 0; i <= a.length; i++) {
        const s = a.slice();
        s.splice(i, 0, ps);
        const next = join(s);
        if (seen.has(next)) continue;
        const rule = j(e, next);
        if (!rule) continue;
        seen.add(next);
        q.push({ e: next, path: [...path, rule + '@insPs@' + i] });
      }
    }
  }
}
console.log('found', found, 'seen', seen.size);
if (!found) {
  // check if goal reachable from any seen via direct
  for (const e of seen) {
    if (e === goal) continue;
    const rule = j(e, goal);
    if (rule) console.log('to-goal from', e.slice(0, 80), rule);
  }
}
