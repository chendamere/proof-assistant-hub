import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import {
  matchesDerivedBbTransition,
  matchesBbPsOsRedistribute,
  matchesObBbOsUnzip,
} from '../src/inferenceRules/caseFocus';

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
function splitBb(item: string) {
  const m = item.match(/^\\(Bb|Blb)\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}$/);
  // simpler recursive split
  if (!item.startsWith('\\Bb') && !item.startsWith('\\Blb')) return null;
  const kind = item.startsWith('\\Blb') ? 'Blb' : 'Bb';
  let i = item.indexOf('{');
  if (i < 0) return null;
  const parts: string[] = [];
  while (parts.length < 3 && i < item.length) {
    if (item[i] !== '{') return null;
    let d = 0,
      j = i;
    for (; j < item.length; j++) {
      if (item[j] === '{') d++;
      else if (item[j] === '}') {
        d--;
        if (d === 0) break;
      }
    }
    parts.push(item.slice(i + 1, j));
    i = j + 1;
  }
  if (parts.length !== 3) return null;
  return { kind, cond: parts[0]!, t: parts[1]!, f: parts[2]! };
}
function makeBb(kind: string, cond: string, t: string, f: string) {
  const tt = t.startsWith(',') ? t : ',' + t;
  const ff = f.startsWith(',') ? f : ',' + f;
  const T = tt.endsWith(',') ? tt : tt + ',';
  const F = ff.endsWith(',') ? ff : ff + ',';
  return `\\${kind}{${cond}}{${T}}{${F}}`;
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

function indexAt(thm: number) {
  const pos = CO.indexOf('Rules_of_Relationship_of_Subnode') * 100000 + thm;
  return {
    pos,
    index: buildRuleIndex(
      all.filter((r) => r.pos < pos),
      new Map()
    ),
  };
}
function j(index: ReturnType<typeof buildRuleIndex>, a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (matchesDerivedBbTransition(A, B)) return 'derived';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

// --- 129 s12: Ps pull ---
{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::129::') && x.step === 12)!;
  console.log('\n=== 129 s12');
  console.log('redistribute', matchesBbPsOsRedistribute(f.left, f.right));
  console.log('derived', matchesDerivedBbTransition(f.left, f.right));
  console.log('L', f.left);
  console.log('R', f.right);
  const { index } = indexAt(129);
  // try pull Ps from arms with intermediates: first make both arm prefixes match
  const L = ensure(f.left);
  const a = tops(L);
  console.log(
    'tops',
    a.map((t) => t.slice(0, 50))
  );
}

// --- 144 s3: Os into false arm ---
{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::144::') && x.step === 3)!;
  console.log('\n=== 144 s3');
  console.log('L', f.left);
  console.log('R', f.right);
  const { index } = indexAt(144);
  const L = ensure(f.left);
  const R = ensure(f.right);
  // candidate: push Os into both arms (null-12), then drop from true
  const midBoth = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,n \\Os,},';
  const midTrue = ',i \\Pu,i \\Od n,\\Bb{n \\Pu}{,n \\Os,\\Or,}{,},';
  console.log('L->both', j(index, L, midBoth));
  console.log('L->trueOnly', j(index, L, midTrue));
  console.log('both->R', j(index, midBoth, R));
  // reverse create into empty false? 
  // try: n Os past Bb via release rules
  const a = tops(L);
  for (let i = 0; i < a.length - 1; i++) {
    const s = a.slice();
    const tmp = s[i]!;
    s[i] = s[i + 1]!;
    s[i + 1] = tmp;
    const rule = j(index, L, join(s));
    if (rule) console.log('swap', i, rule);
  }
}

// --- 143 s5: collapse empty Bb{i Pu} ---
{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::143::') && x.step === 5)!;
  console.log('\n=== 143 s5');
  console.log('L', f.left);
  console.log('R', f.right);
  const { index } = indexAt(143);
  const lb = splitBb(tops(f.left)[0]!);
  const rb = splitBb(tops(f.right)[0]!);
  console.log('L arms', lb);
  console.log('R arms', rb);
  // L false has nested Bb{i Pu}{,}{i Ob t_0,...}; R false has contents without that Bb
  // empty-true Bb{i Pu} collapse?
  if (lb && rb) {
    const lf = tops(',' + lb.f + ',');
    const rf = tops(',' + rb.f + ',');
    console.log('Lf', lf.map((x) => x.slice(0, 40)));
    console.log('Rf', rf.map((x) => x.slice(0, 40)));
  }
}

// --- 132 s3: Pc subst inside arm ---
{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::132::') && x.step === 3)!;
  console.log('\n=== 132 s3');
  console.log('L', f.left);
  console.log('R', f.right);
  const { index } = indexAt(132);
  // i Pc j outside context in true arm; false has m Pc i -> m Pc j
  // Maybe need to pull i Pc j, apply subst, push back
  const L = ensure(f.left);
  const a = tops(L);
  const bb = splitBb(a[0]!);
  if (bb) {
    console.log('cond', bb.cond);
    console.log('T', bb.t);
    console.log('F', bb.f);
  }
}

// --- 122 s2 Ps past Bb ---
{
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === 2)!;
  console.log('\n=== 122 s2');
  const { index } = indexAt(122);
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('L tops', tops(L).map((t) => t.slice(0, 28)));
  console.log('R tops', tops(R).map((t) => t.slice(0, 28)));
  // try unzip first then move Ps then zip
  const unzipped =
    ',i \\Ob t_1,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},t_1 \\Os,i \\Ob t_2,t_1 \\Ps t_2,\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_2 \\Os,';
  // from L: Ob t1, Ob t2, Ps, Bb1, Bb2, Os, Os? 
  console.log('derived unzip L->?', matchesObBbOsUnzip(L, ensure(',i \\Ob t_1,i \\Ob t_2,\\Bb{t_1 \\Pc j}{,\\Ot s_1,}{,i \\Od s_1,},\\Bb{t_2 \\Pc j}{,\\Ot s_2,}{,i \\Od s_2,},t_1 \\Os,t_2 \\Os,')));
}
