/** Probe 108 s28/s51/s59/s60/s61 chains. */
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
const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
  let t = normalizeSpacing(fromOperatorFirst(s))
    .replace(/R_\(/g, 'R\\_(')
    .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
    .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
    .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
    .trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function topItems(e: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  const s = ensure(e);
  for (let i = 0; i < s.length; i++) {
    const c = s[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const p = s.slice(start, i).trim();
      if (p) items.push(p);
      start = i + 1;
    }
  }
  const t = s.slice(start).trim();
  if (t) items.push(t);
  return items;
}
function joinItems(items: string[]): string {
  return ensure(',' + items.join(',') + ',');
}
function parseArm(arm: string): string[] {
  return topItems(arm.startsWith(',') ? arm : ',' + arm);
}
function findOuterBb(expr: string) {
  const re = /\\B(lb|b)\{([^}]*)\}\{(\s*,[^}]*)\}\{(\s*,[^}]*)\}/;
  return ensure(expr).match(re);
}
function rebuildBb(kind: string, cond: string, tItems: string[], fItems: string[]) {
  return `\\B${kind}{${cond}}{,${tItems.join(',')},}{,${fItems.join(',')},}`;
}
function pushAtomIntoArms(expr: string, atom: string): string | null {
  const m = findOuterBb(expr);
  if (!m) return null;
  const items = topItems(expr);
  const idx = items.indexOf(atom);
  if (idx < 0) return null;
  const bb = items.find((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'))!;
  const tItems = parseArm(m[3]!);
  const fItems = parseArm(m[4]!);
  const newBb = rebuildBb(m[1]!, m[2]!, [atom, ...tItems], [atom, ...fItems]);
  return joinItems(items.filter((_, i) => i !== idx).map((x) => (x === bb ? newBb : x)));
}
function pullAtomFromArms(expr: string, atom: string): string | null {
  const m = findOuterBb(expr);
  if (!m) return null;
  const items = topItems(expr);
  const bbIdx = items.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  if (bbIdx < 0) return null;
  const tItems = parseArm(m[3]!);
  const fItems = parseArm(m[4]!);
  if (!tItems.includes(atom) || !fItems.includes(atom)) return null;
  const t2 = tItems.filter((x) => x !== atom);
  // only remove one occurrence each
  const ti = tItems.indexOf(atom);
  const fi = fItems.indexOf(atom);
  const t3 = tItems.slice();
  t3.splice(ti, 1);
  const f3 = fItems.slice();
  f3.splice(fi, 1);
  const newBb = rebuildBb(m[1]!, m[2]!, t3, f3);
  const out = items.slice();
  out[bbIdx] = newBb;
  out.splice(bbIdx, 0, atom); // place before Bb
  return joinItems(out);
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = 13 * 100000 + 108;
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  new Map()
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}
function tryAdjSwap(items: string[], i: number): string[] | null {
  if (i < 0 || i + 1 >= items.length) return null;
  const sw = items.slice();
  const t = sw[i]!;
  sw[i] = sw[i + 1]!;
  sw[i + 1] = t;
  return sw;
}
function greedyBubble(L0: string, R0: string, max = 80): string[] | null {
  let cur = topItems(L0);
  const goal = topItems(R0);
  if ([...cur].sort().join('|') !== [...goal].sort().join('|')) return null;
  const path: string[] = [];
  for (let g = 0; g < max && joinItems(cur) !== ensure(R0); g++) {
    if (justify(joinItems(cur), R0)) return path;
    let moved = false;
    for (let i = 0; i < cur.length; i++) {
      if (cur[i] === goal[i]) continue;
      const j = cur.indexOf(goal[i]!, i);
      if (j < 0) return null;
      for (let k = j; k > i; k--) {
        const sw = tryAdjSwap(cur, k - 1);
        if (!sw) return null;
        const prev = joinItems(cur);
        const e = joinItems(sw);
        if (!justify(prev, e)) return null;
        path.push(e);
        cur = sw;
        moved = true;
      }
      break;
    }
    if (!moved) break;
  }
  return joinItems(cur) === ensure(R0) || justify(joinItems(cur), R0) ? path : null;
}

/** Right-operand: a Ps b → a Ps c given b Ps c OR c Ps b. */
function rightSubst(L0: string, R0: string, a: string, b: string, c: string): string[] | null {
  const from = `${a} \\Ps ${b}`;
  const to = `${a} \\Ps ${c}`;
  const bridge = `${b} \\Ps ${c}`;
  const bridgeFlip = `${c} \\Ps ${b}`;
  let cur = topItems(L0);
  const goal = topItems(R0);
  const path: string[] = [];
  const repl = (atom: string, next: string, which: number) => {
    let seen = 0;
    const sw = cur.slice();
    for (let i = 0; i < sw.length; i++) {
      if (sw[i] === atom) {
        if (seen === which) {
          sw[i] = next;
          const prev = joinItems(cur);
          const e = joinItems(sw);
          const j = justify(prev, e);
          console.log(`  repl ${atom}→${next}#${which}`, j ?? 'FAIL');
          if (!j) return false;
          path.push(e);
          cur = sw;
          return true;
        }
        seen++;
      }
    }
    return false;
  };
  // Prefer using existing bridgeFlip (= c Ps b) for 73: c Ps b, b Ps a → c Ps b, c Ps a
  const haveFlip = cur.includes(bridgeFlip);
  const haveBridge = cur.includes(bridge);
  if (!haveFlip && haveBridge) {
    // flip one bridge near from
    const fi = cur.indexOf(from);
    let best = -1;
    for (let i = 0; i < cur.length; i++) if (cur[i] === bridge) best = i;
    // choose closest bridge to from
    let closest = -1;
    let bestDist = 1e9;
    for (let i = 0; i < cur.length; i++) {
      if (cur[i] !== bridge) continue;
      const d = Math.abs(i - fi);
      if (d < bestDist) {
        bestDist = d;
        closest = i;
      }
    }
    const which = cur.slice(0, closest + 1).filter((x) => x === bridge).length - 1;
    if (!repl(bridge, bridgeFlip, which)) return null;
  } else if (!haveFlip && !haveBridge) {
    console.log('no bridge');
    return null;
  }

  if (!repl(from, `${b} \\Ps ${a}`, 0)) return null;

  // Make bridgeFlip immediately before flippedFrom — use the occurrence closest to flippedFrom
  const flippedFrom = `${b} \\Ps ${a}`;
  const makeAdjacent = () => {
    const fi = cur.indexOf(flippedFrom);
    if (fi < 0) return false;
    // find bridgeFlip occurrence that can sit at fi-1
    const candidates: number[] = [];
    for (let i = 0; i < cur.length; i++) if (cur[i] === bridgeFlip) candidates.push(i);
    if (!candidates.length) return false;
    // pick closest to fi
    let bi = candidates.reduce((best, i) => (Math.abs(i - fi) < Math.abs(best - fi) ? i : best), candidates[0]!);
    while (bi < fi - 1) {
      const sw = tryAdjSwap(cur, bi);
      if (!sw || !justify(joinItems(cur), joinItems(sw))) return false;
      path.push(joinItems(sw));
      cur = sw;
      bi++;
    }
    while (bi > fi) {
      // move left past flippedFrom and beyond until bi == fi (then swap to order)
      const sw = tryAdjSwap(cur, bi - 1);
      if (!sw || !justify(joinItems(cur), joinItems(sw))) return false;
      path.push(joinItems(sw));
      cur = sw;
      bi--;
    }
    // now bi == fi means order is bridgeFlip? Wait if bi>fi we moved left: swapping bi-1 with bi moves bridge left.
    // After while bi>fi: bi==fi, items at fi is bridgeFlip and flippedFrom moved right to fi+1
    // So order: bridgeFlip, flippedFrom at (fi, fi+1). Good for 73!
    // If we started with bi < fi-1 and moved right: bi ends at fi-1, order bridgeFlip, flippedFrom. Good.
    // If bi == fi+1 initially: while bi>fi runs once → bi==fi, order bridgeFlip, flippedFrom.
    // If bi == fi-1: loops don't run; order already good.
    const fi2 = cur.indexOf(flippedFrom);
    const bi2 = (() => {
      // bridgeFlip immediately before flippedFrom
      if (fi2 > 0 && cur[fi2 - 1] === bridgeFlip) return fi2 - 1;
      return cur.indexOf(bridgeFlip);
    })();
    console.log('  adj', bi2, fi2, cur[bi2], cur[fi2]);
    if (bi2 !== fi2 - 1) {
      if (bi2 === fi2 + 1 || (fi2 >= 0 && cur[fi2 + 1] === bridgeFlip)) {
        const sw = tryAdjSwap(cur, fi2);
        if (!sw || !justify(joinItems(cur), joinItems(sw))) return false;
        path.push(joinItems(sw));
        cur = sw;
      }
    }
    const fi3 = cur.indexOf(flippedFrom);
    return fi3 > 0 && cur[fi3 - 1] === bridgeFlip;
  };
  if (!makeAdjacent()) {
    console.log('  adj failed', cur);
    return null;
  }
  // 73
  if (!repl(flippedFrom, `${c} \\Ps ${a}`, 0)) return null;
  if (!repl(`${c} \\Ps ${a}`, to, 0)) return null;
  // restore bridge orientation if needed
  if (goal.includes(bridge) && !goal.includes(bridgeFlip) && cur.includes(bridgeFlip)) {
    // flip the one that was used - prefer occurrence that goal expects as bridge
    if (!repl(bridgeFlip, bridge, cur.includes(bridge) ? 1 : 0) && !repl(bridgeFlip, bridge, 0)) return null;
  }
  if (goal.includes(bridgeFlip) && !goal.includes(bridge) && cur.includes(bridge) && !cur.includes(bridgeFlip)) {
    // shouldn't happen often
  }
  const curE = joinItems(cur);
  if (curE === ensure(R0) || justify(curE, R0)) return path.filter((p) => ensure(p) !== ensure(R0));
  const bub = greedyBubble(curE, R0);
  if (bub) return [...path, ...bub].filter((p) => ensure(p) !== ensure(R0));
  console.log('  cur', cur);
  console.log('  goal', goal);
  return null;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((x) => x.key.includes('::108::'));

for (const f of fails) {
  console.log('\n==== s' + f.step + ' ====');
  const L = ensure(f.left);
  const R = ensure(f.right);
  if (f.step === 51) {
    const p = rightSubst(L, R, 'i_1', 'j_2', 'j_1');
    console.log('chain', p?.length ?? null);
  }
  if (f.step === 28) {
    // push i2 Os into arms first
    const pushed = pushAtomIntoArms(L, 'i_2 \\Os');
    console.log('push', pushed ? justify(L, pushed) ?? 'FAIL' : null);
    if (pushed && justify(L, pushed)) {
      console.log('push→R', justify(pushed, R) ?? 'FAIL', ensure(pushed) === R);
      const bub = greedyBubble(pushed, R);
      console.log('bubble after push', bub?.length ?? null);
      // maybe need to reorder R before/after
      const items = topItems(pushed);
      console.log('pushed items around i', items.filter((x) => x.includes('i_') || x.startsWith('R(i')));
      console.log('goal items around i', topItems(R).filter((x) => x.includes('i_') || x.startsWith('R(i')));
    }
    // alternate: bubble R(i1) left past i2 Os first
    const mid = ensure(L.replace(',R(i_2),i_2 \\Os,R(i_1),', ',R(i_2),R(i_1),i_2 \\Os,'));
    console.log('swap Os/R(i1)', justify(L, mid) ?? 'FAIL');
    if (justify(L, mid)) {
      const mid2 = ensure(mid.replace(',R(i_2),R(i_1),i_2 \\Os,', ',R(i_1),R(i_2),i_2 \\Os,'));
      console.log('swap R', justify(mid, mid2) ?? 'FAIL');
      const p2 = pushAtomIntoArms(mid2, 'i_2 \\Os');
      console.log('then push', p2 ? justify(mid2, p2) ?? 'FAIL' : null, p2 && ensure(p2) === R);
    }
  }
  if (f.step === 59) {
    const Rfix = ensure(f.right.replace(',,', ','));
    console.log('L items', topItems(L));
    console.log('Rfix items', topItems(Rfix));
    const bub = greedyBubble(L, Rfix);
    console.log('bubble to Rfix', bub?.length ?? null, bub ? justify(joinItems(topItems(L)), Rfix) : '');
    // try drop empty via spacing after fix in tex - also check if L already equals Rfix multiset
    const sc = [...topItems(L)].sort().join('|');
    const sg = [...topItems(Rfix)].sort().join('|');
    console.log('multiset', sc === sg);
    if (sc !== sg) {
      const onlyL = topItems(L).filter((x) => !topItems(Rfix).includes(x));
      const onlyR = topItems(Rfix).filter((x) => !topItems(L).includes(x));
      console.log('onlyL', onlyL);
      console.log('onlyR', onlyR);
      // count diffs
      const count = (xs: string[]) => {
        const m = new Map<string, number>();
        for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
        return m;
      };
      const cL = count(topItems(L));
      const cR = count(topItems(Rfix));
      for (const k of new Set([...cL.keys(), ...cR.keys()])) {
        if ((cL.get(k) ?? 0) !== (cR.get(k) ?? 0)) console.log('count', k, cL.get(k) ?? 0, '→', cR.get(k) ?? 0);
      }
    }
  }
  if (f.step === 60) {
    const Lfix = ensure(L.replace(',,', ','));
    console.log('Lfix===L', Lfix === L);
    // pull j2 Os from arms
    const pulled = pullAtomFromArms(Lfix, 'j_2 \\Os');
    console.log('pull j2 Os', pulled ? justify(Lfix, pulled) ?? 'FAIL' : null);
    if (pulled && justify(Lfix, pulled)) {
      console.log('pulled items', topItems(pulled));
      console.log('R items', topItems(R));
      // fold Pc
      const fold = ensure(
        pulled.replace(
          ',i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),i_1 \\Ps j_1,i_1 \\Os,j_1 \\Os,',
          ',i \\Pc j,'
        )
      );
      console.log('fold', justify(pulled, fold) ?? 'FAIL', fold === R);
      const bub = greedyBubble(fold, R);
      console.log('bub after fold', bub?.length ?? null);
    }
    // fold first then pull
    const fold1 = ensure(
      Lfix.replace(
        ',i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),i_1 \\Ps j_1,i_1 \\Os,j_1 \\Os,',
        ',i \\Pc j,'
      )
    );
    console.log('fold first', justify(Lfix, fold1) ?? 'FAIL');
    if (justify(Lfix, fold1)) {
      const pulled2 = pullAtomFromArms(fold1, 'j_2 \\Os');
      console.log('then pull', pulled2 ? justify(fold1, pulled2) ?? 'FAIL' : null, pulled2 && ensure(pulled2) === R);
      if (pulled2 && justify(fold1, pulled2) && ensure(pulled2) !== R) {
        const bub = greedyBubble(pulled2, R);
        console.log('bub', bub?.length ?? null);
      }
    }
  }
  if (f.step === 61) {
    const midA = ensure(L.replace(',j \\Oc j_2,R(j_2),j_2 \\Os,', ',j \\Oc j_2,j_2 \\Os,'));
    const midB = ensure(midA.replace(',j \\Oc j_2,j_2 \\Os,', ','));
    console.log('path', justify(L, midA), justify(midA, midB), midB === R);
  }
}
