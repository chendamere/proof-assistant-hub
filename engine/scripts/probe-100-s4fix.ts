import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

const CHAPTER_ORDER = [
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
];
const POS = 13 * 100000 + 100;
function posOf(id: string): number {
  const early = earlyRulePosition(id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axioms.some((r) => r.id === id) || definitions.some((r) => r.id === id)) return -1;
  const m = id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === m[1]);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + parseInt(m[2]!, 10) + 1;
}
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function topItems(e: string): string[] {
  const s = ensure(e);
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    else if (s[i] === ',' && depth === 0) {
      const p = s.slice(start, i).trim();
      if (p) items.push(p);
      start = i + 1;
    }
  }
  const t = s.slice(start).trim();
  if (t) items.push(t);
  return items;
}
function joinItems(items: string[]) {
  return ensure(',' + items.join(',') + ',');
}
function splitOuterBb(item: string) {
  const s = item.trim();
  if (!s.startsWith('\\Bb{') && !s.startsWith('\\Blb{')) return null;
  const kind = s.startsWith('\\Blb') ? 'lb' : 'b';
  let p = kind === 'lb' ? 5 : 4;
  const readGroup = (): string | null => {
    if (s[p] !== '{') return null;
    const start = p + 1;
    let depth = 1;
    p++;
    while (p < s.length && depth > 0) {
      if (s[p] === '{') depth++;
      else if (s[p] === '}') depth--;
      p++;
    }
    return s.slice(start, p - 1);
  };
  const cond = readGroup();
  const t = readGroup();
  const f = readGroup();
  if (cond == null || t == null || f == null) return null;
  return { kind, cond, t, f, rest: s.slice(p) };
}

const all = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const index = buildRuleIndex(
  all.filter((r) => r.pos < POS),
  new Map()
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const fails = fs
  .readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((x) => x.key.includes('::100::'));
console.log(
  'fails',
  fails.map((f) => f.step)
);
const f = fails.find((x) => x.step === 4)!;
let L = ensure(f.left.replace('\\Tc c_2a,', '\\Tc c_2,'));
const R = ensure(f.right);
console.log('items L');
for (const [i, it] of topItems(L).entries()) console.log(i, it.slice(0, 80));

// bubble Os to before Bb
const atom = 'i_2 \\Os';
let cur = topItems(L);
let oi = cur.indexOf(atom);
let bi = cur.findIndex((x) => x.startsWith('\\Bb'));
console.log('oi', oi, 'bi', bi);
while (oi !== bi - 1) {
  const j = oi < bi - 1 ? oi : oi - 1;
  const sw = cur.slice();
  [sw[j], sw[j + 1]] = [sw[j + 1]!, sw[j]!];
  const prev = joinItems(cur);
  const e = joinItems(sw);
  const jrule = justify(prev, e);
  console.log('swap', j, jrule);
  if (!jrule) break;
  cur = sw;
  oi = cur.indexOf(atom);
  bi = cur.findIndex((x) => x.startsWith('\\Bb'));
}
console.log('after bubble oi', oi, 'bi', bi);
const adj = joinItems(cur);
const bb = splitOuterBb(cur[bi]!);
console.log('split', bb ? { kind: bb.kind, cond: bb.cond, t: bb.t.slice(0, 60), f: bb.f.slice(0, 60) } : null);

const tItems = topItems(bb!.t.startsWith(',') ? bb!.t : ',' + bb!.t);
const fItems = topItems(bb!.f.startsWith(',') ? bb!.f : ',' + bb!.f);
console.log('tItems', tItems.map((x) => x.slice(0, 40)));
console.log('fItems', fItems);

const newT = [atom, ...tItems].join(',') + ',';
const newF = [atom, ...fItems].join(',') + ',';
const newBb = `\\Bb{${bb!.cond}}{,${[atom, ...tItems].join(',')},}{,${[atom, ...fItems].join(',')},}`;
console.log('newBb', newBb.slice(0, 120));
const out = cur.slice();
out.splice(oi, 1);
const bi2 = out.findIndex((x) => x.startsWith('\\Bb'));
out[bi2] = newBb;
const pushed = joinItems(out);
console.log('push rule', justify(adj, pushed));
console.log('pushed==R', pushed === R);
console.log('pushed→R', justify(pushed, R));
if (pushed !== R) {
  // maybe c_2 naming
  console.log('pushed', pushed);
  console.log('R     ', R);
}

// Also try direct from original L with string replace after bubble in one go
const bubbled = ensure(
  L.replace(
    ',R(i_2),i_2 \\Os,j \\Oc j_1,R(i_1),R(j_1),\\Bb',
    ',R(i_2),j \\Oc j_1,R(i_1),R(j_1),i_2 \\Os,\\Bb'
  )
);
console.log('\nmanual bubble', justify(L, bubbled));
if (justify(L, bubbled)) {
  // stepwise bubble
  let c = L;
  const steps = [
    c.replace(',i_2 \\Os,j \\Oc j_1,', ',j \\Oc j_1,i_2 \\Os,'),
    null as string | null,
  ];
  let c1 = ensure(L.replace(',i_2 \\Os,j \\Oc j_1,', ',j \\Oc j_1,i_2 \\Os,'));
  console.log('swap1', justify(L, c1));
  let c2 = ensure(c1.replace(',i_2 \\Os,R(i_1),', ',R(i_1),i_2 \\Os,'));
  console.log('swap2', justify(c1, c2));
  let c3 = ensure(c2.replace(',i_2 \\Os,R(j_1),', ',R(j_1),i_2 \\Os,'));
  console.log('swap3', justify(c2, c3));
  const p = ensure(
    c3.replace(
      ',i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_1 \\Os,j_1 \\Os,\\Tc c_2,},',
      ',\\Bb{i_1 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},'
    )
  );
  console.log('push', justify(c3, p), p === R, justify(p, R));
}
