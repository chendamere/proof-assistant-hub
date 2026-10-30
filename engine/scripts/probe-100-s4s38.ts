import { theorems } from '../../src/data/theorems';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

function parseArm(arm: string): string[] {
  // Proper brace-aware parse of arm contents between {,...}
  const s = arm.startsWith(',') ? arm : ',' + arm;
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

function swapArmItems(expr: string, which: 't' | 'f', i: number): string {
  // Find outer Bb and swap adjacent in arm
  const s = ensure(expr);
  const start = s.search(/\\Bb\{/);
  let depth = 0;
  let p = start + 4; // at {
  // skip cond
  depth = 1;
  p++;
  while (p < s.length && depth > 0) {
    if (s[p] === '{') depth++;
    else if (s[p] === '}') depth--;
    p++;
  }
  const condEnd = p;
  const tStart = p;
  depth = 1;
  p++;
  while (p < s.length && depth > 0) {
    if (s[p] === '{') depth++;
    else if (s[p] === '}') depth--;
    p++;
  }
  const tEnd = p;
  const fStart = p;
  depth = 1;
  p++;
  while (p < s.length && depth > 0) {
    if (s[p] === '{') depth++;
    else if (s[p] === '}') depth--;
    p++;
  }
  const fEnd = p;
  const trueRaw = s.slice(tStart + 1, tEnd - 1);
  const falseRaw = s.slice(fStart + 1, fEnd - 1);
  const items = parseArm(which === 't' ? trueRaw : falseRaw);
  if (i < 0 || i >= items.length - 1) return s;
  const sw = items.slice();
  const tmp = sw[i]!;
  sw[i] = sw[i + 1]!;
  sw[i + 1] = tmp;
  const newArm = ',' + sw.join(',') + ',';
  if (which === 't') {
    return ensure(s.slice(0, tStart) + '{' + newArm + '}' + s.slice(tEnd));
  }
  return ensure(s.slice(0, fStart) + '{' + newArm + '}' + s.slice(fEnd));
}

// ---- s4 ----
{
  const f = fails.find((x) => x.step === 4)!;
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('==== s4 ====');
  // push Os to front of both arms (keep c2a)
  const mid = ensure(
    L.replace(
      ',R(i_2),i_2 \\Os,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_1 \\Os,j_1 \\Os,\\Tc c_2a,},',
      ',R(i_2),j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2a,},'
    )
  );
  console.log('push', justify(L, mid));
  console.log('mid→R', justify(mid, R));
  // with c2 already
  const L2 = ensure(L.replace('\\Tc c_2a,', '\\Tc c_2,'));
  const mid2 = ensure(
    L2.replace(
      ',R(i_2),i_2 \\Os,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_1 \\Os,j_1 \\Os,\\Tc c_2,},',
      ',R(i_2),j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},'
    )
  );
  console.log('rename first?', justify(L, L2));
  console.log('push from L2', justify(L2, mid2), mid2 === R, justify(mid2, R));

  // Brute force check identical-15 and any rule on mid
  const rule15 = all.find((t) => t.id.includes('identical-node-comparison-15'))!;
  console.log(
    'raw ident15 L→mid',
    checkInferenceRules(L, mid, rule15.leftSide, rule15.rightSide, { dagCache: index.dagCache }).match
  );
  console.log(
    'raw ident15 L2→mid2',
    checkInferenceRules(L2, mid2, rule15.leftSide, rule15.rightSide, { dagCache: index.dagCache }).match
  );
  console.log(
    'raw ident15 L2→R',
    checkInferenceRules(L2, R, rule15.leftSide, rule15.rightSide, { dagCache: index.dagCache }).match
  );
}

// ---- s26 ----
{
  const f = fails.find((x) => x.step === 26)!;
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\n==== s26 ====');
  const mid = ensure(
    L.replace(
      ',R(j_2),j_2 \\Os,R(j_1),\\Bb{i_2 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},',
      ',R(j_2),R(j_1),\\Bb{i_2 \\Ps j_1}{,j_2 \\Os,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,j_2 \\Os,i_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},'
    )
  );
  console.log('push front', justify(L, mid));
  // then arm-swap to match R order (i2 Os, j2 Os, ...)
  if (justify(L, mid)) {
    let cur = mid;
    const path = [mid];
    for (let step = 0; step < 8 && cur !== R && !justify(cur, R); step++) {
      let moved = false;
      for (const which of ['t', 'f'] as const) {
        for (let i = 0; i < 5; i++) {
          const n = swapArmItems(cur, which, i);
          if (n === cur) continue;
          const j = justify(cur, n);
          if (!j) continue;
          // accept if closer to R (string distance)
          const d0 = Math.abs(cur.length - R.length) + [...cur].filter((c, k) => c !== R[k]).length;
          const d1 = Math.abs(n.length - R.length) + [...n].filter((c, k) => c !== R[k]).length;
          if (d1 < d0 || n === R || justify(n, R)) {
            console.log('  arm', which, i, j, 'd', d0, '→', d1);
            path.push(n);
            cur = n;
            moved = true;
            break;
          }
        }
        if (moved) break;
      }
      if (!moved) break;
    }
    console.log('final', cur === R || !!justify(cur, R), 'path', path.length);
  }
}

// ---- s38: r17 push then arm bubble ----
{
  const f = fails.find((x) => x.step === 38)!;
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\n==== s38 ====');
  const mid = ensure(
    L.replace(
      ',R(j_2),R(j_1),\\Bb{i_2 \\Ps j_2}{,i_2 \\Os,j_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},',
      ',R(j_2),\\Bb{i_2 \\Ps j_2}{,R(j_1),i_2 \\Os,j_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,R(j_1),i_2 \\Os,j_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2,},'
    )
  );
  console.log('r17-style front push', justify(L, mid));
  if (justify(L, mid)) {
    let cur = mid;
    for (let step = 0; step < 16 && cur !== R && !justify(cur, R); step++) {
      let best: { e: string; d: number; j: string } | null = null;
      for (const which of ['t', 'f'] as const) {
        for (let i = 0; i < 8; i++) {
          const n = swapArmItems(cur, which, i);
          if (n === cur) continue;
          const j = justify(cur, n);
          if (!j) continue;
          const d = [...n].reduce((a, c, k) => a + (c !== R[k] ? 1 : 0), Math.abs(n.length - R.length));
          if (!best || d < best.d) best = { e: n, d, j };
        }
      }
      if (!best) {
        console.log('stuck', cur.slice(0, 120));
        break;
      }
      console.log('  swap', best.j, 'd', best.d);
      cur = best.e;
    }
    console.log('reached', cur === R || !!justify(cur, R));
    if (cur !== R) {
      console.log('cur', cur);
      console.log('R  ', R);
    }
  }
}
