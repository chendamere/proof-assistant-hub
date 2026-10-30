/** Probe 108 fails: right-operand Ps subst + s28/s59/s60/s61. */
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

function replaceNth(items: string[], atom: string, next: string, n: number): string[] | null {
  const out = items.slice();
  let seen = 0;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === atom) {
      if (seen === n) {
        out[i] = next;
        return out;
      }
      seen++;
    }
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

function bubbleAtom(items: string[], atom: string, which: number, targetIdx: number): { items: string[]; path: string[] } | null {
  const path: string[] = [];
  let cur = items.slice();
  const find = () => {
    let seen = 0;
    for (let i = 0; i < cur.length; i++) {
      if (cur[i] === atom) {
        if (seen === which) return i;
        seen++;
      }
    }
    return -1;
  };
  let idx = find();
  if (idx < 0) return null;
  while (idx !== targetIdx) {
    const j = idx < targetIdx ? idx : idx - 1;
    const sw = tryAdjSwap(cur, j);
    if (!sw) return null;
    const prev = joinItems(cur);
    const next = joinItems(sw);
    if (!justify(prev, next)) {
      console.log('bubble fail', cur[j], '<->', cur[j + 1], justify(prev, next));
      return null;
    }
    path.push(next);
    cur = sw;
    idx = find();
  }
  return { items: cur, path };
}

/** Right-operand subst: a Ps b → a Ps c given bridge b Ps c (or c Ps b). */
function rightSubst(
  L0: string,
  R0: string,
  a: string,
  b: string,
  c: string
): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  const from = `${a} \\Ps ${b}`;
  const to = `${a} \\Ps ${c}`;
  const bridge = `${b} \\Ps ${c}`;
  const bridgeFlip = `${c} \\Ps ${b}`;
  let cur = topItems(L);
  const goal = topItems(R);
  const path: string[] = [];
  console.log('items', cur);
  console.log('goal', goal);
  console.log('from/to/bridge counts', {
    from: cur.filter((x) => x === from).length,
    to: cur.filter((x) => x === to).length,
    bridge: cur.filter((x) => x === bridge).length,
    bridgeFlip: cur.filter((x) => x === bridgeFlip).length,
  });

  // Path A: flip bridge → flip from → 73 → flip result → flip bridge back
  // bridge b Ps c → c Ps b
  // from a Ps b → b Ps a
  // 73: c Ps b, b Ps a → c Ps b, c Ps a
  // flip c Ps a → a Ps c
  // flip c Ps b → b Ps c

  const applyReplace = (atom: string, next: string, which = 0) => {
    const sw = replaceNth(cur, atom, next, which);
    if (!sw) return false;
    const prev = joinItems(cur);
    const e = joinItems(sw);
    const j = justify(prev, e);
    console.log(`repl ${atom}→${next}#${which}`, j ?? 'FAIL');
    if (!j) return false;
    path.push(e);
    cur = sw;
    return true;
  };

  // Ensure we have bridgeFlip by flipping one bridge if needed
  if (!cur.includes(bridgeFlip)) {
    if (!cur.includes(bridge)) {
      console.log('no bridge');
      return null;
    }
    // flip last bridge occurrence (the one near from)
    const bi = (() => {
      let last = -1;
      for (let i = 0; i < cur.length; i++) if (cur[i] === bridge) last = i;
      return last;
    })();
    if (!applyReplace(bridge, bridgeFlip, cur.slice(0, bi + 1).filter((x) => x === bridge).length - 1))
      return null;
  }

  // Flip from: a Ps b → b Ps a
  if (!applyReplace(from, `${b} \\Ps ${a}`, 0)) return null;

  // Bubble bridgeFlip next to flipped-from for 73
  const flippedFrom = `${b} \\Ps ${a}`;
  let fi = cur.indexOf(flippedFrom);
  let bi = cur.indexOf(bridgeFlip);
  if (fi < 0 || bi < 0) return null;
  // want them adjacent: bridgeFlip then flippedFrom (c Ps b, b Ps a)
  const targetForBridge = fi < bi ? fi : fi; // place bridgeFlip at fi (before flippedFrom), or fi-? 
  // After moves indices change. Bring bridgeFlip to sit immediately before flippedFrom.
  {
    fi = cur.indexOf(flippedFrom);
    bi = cur.indexOf(bridgeFlip);
    const wantBi = fi; // if bi < fi, move right to fi; then flippedFrom shifts to fi+1? 
    // If bi < fi: move bridge right until bi == fi (swap with flippedFrom → bridge after). Better:
    // target: indices (k, k+1) = (bridgeFlip, flippedFrom)
    if (bi < fi) {
      // move bridge right until adjacent before from: want bi = fi-1, but as we move right past others...
      while (bi < fi - 1) {
        const sw = tryAdjSwap(cur, bi);
        if (!sw) return null;
        const prev = joinItems(cur);
        const e = joinItems(sw);
        if (!justify(prev, e)) {
          console.log('adj fail', cur[bi], cur[bi + 1]);
          return null;
        }
        path.push(e);
        cur = sw;
        bi++;
        fi = cur.indexOf(flippedFrom);
      }
      // now bi == fi-1 or bi==fi
      if (bi === fi) {
        // swap to put bridge before? currently same? shouldn't happen
      }
    } else if (bi > fi + 1) {
      while (bi > fi + 1) {
        const sw = tryAdjSwap(cur, bi - 1);
        if (!sw) return null;
        const prev = joinItems(cur);
        const e = joinItems(sw);
        if (!justify(prev, e)) {
          console.log('adj fail L', cur[bi - 1], cur[bi]);
          return null;
        }
        path.push(e);
        cur = sw;
        bi--;
        fi = cur.indexOf(flippedFrom);
      }
      // now bi == fi+1: order is flippedFrom, bridgeFlip — need swap once
      if (bi === fi + 1) {
        const sw = tryAdjSwap(cur, fi);
        if (!sw) return null;
        const prev = joinItems(cur);
        const e = joinItems(sw);
        const j = justify(prev, e);
        console.log('order swap', j ?? 'FAIL');
        if (!j) return null;
        path.push(e);
        cur = sw;
      }
    } else if (bi === fi + 1) {
      const sw = tryAdjSwap(cur, fi);
      if (!sw) return null;
      const prev = joinItems(cur);
      const e = joinItems(sw);
      const j = justify(prev, e);
      console.log('order swap', j ?? 'FAIL');
      if (!j) return null;
      path.push(e);
      cur = sw;
    }
  }

  fi = cur.indexOf(flippedFrom);
  bi = cur.indexOf(bridgeFlip);
  console.log('adjacent?', bi, fi, cur[bi], cur[fi]);
  if (bi !== fi - 1) {
    console.log('not in 73 order', cur);
    return null;
  }

  // 73: c Ps b, b Ps a → c Ps b, c Ps a  (replace flippedFrom with c Ps a)
  const after73 = `${c} \\Ps ${a}`;
  if (!applyReplace(flippedFrom, after73, 0)) return null;

  // flip result: c Ps a → a Ps c
  if (!applyReplace(after73, to, 0)) return null;

  // flip bridge back if goal has bridge not bridgeFlip
  if (goal.includes(bridge) && cur.includes(bridgeFlip) && !goal.includes(bridgeFlip)) {
    if (!applyReplace(bridgeFlip, bridge, 0)) return null;
  }

  console.log('cur', cur);
  console.log('goal', goal);
  const curE = joinItems(cur);
  if (curE === R || justify(curE, R)) {
    if (curE !== R) path.push(R);
    return path.filter((p) => ensure(p) !== R);
  }
  // bubble to match goal order
  // multiset equal?
  const sc = [...cur].sort().join('|');
  const sg = [...goal].sort().join('|');
  console.log('multiset equal', sc === sg);
  if (sc === sg) {
    // greedy bubble toward goal
    for (let guard = 0; guard < 200 && joinItems(cur) !== R; guard++) {
      let moved = false;
      for (let i = 0; i < cur.length; i++) {
        if (cur[i] === goal[i]) continue;
        // find goal[i] later and bubble left
        const j = cur.indexOf(goal[i]!, i);
        if (j < 0) break;
        for (let k = j; k > i; k--) {
          const sw = tryAdjSwap(cur, k - 1);
          if (!sw) break;
          const prev = joinItems(cur);
          const e = joinItems(sw);
          if (!justify(prev, e)) break;
          path.push(e);
          cur = sw;
          moved = true;
        }
        break;
      }
      if (!moved) break;
      if (justify(joinItems(cur), R)) {
        return path.filter((p) => ensure(p) !== R);
      }
    }
    if (joinItems(cur) === R || justify(joinItems(cur), R))
      return path.filter((p) => ensure(p) !== R);
  }
  return path;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((x) => x.key.includes('::108::'));

for (const f of fails) {
  console.log('\n======== s' + f.step + ' ========');
  console.log('direct', justify(f.left, f.right) ?? 'FAIL');
  if (f.step === 17) {
    const p = rightSubst(f.left, f.right, 'i_1', 'j_1', 'j_2');
    console.log('chain len', p?.length ?? null);
  }
  if (f.step === 51) {
    // reverse: i1 Ps j2 → i1 Ps j1 given j1 Ps j2
    const p = rightSubst(f.left, f.right, 'i_1', 'j_2', 'j_1');
    console.log('chain len', p?.length ?? null);
  }
  if (f.step === 28) {
    // try move i2 Os into Bb
    const L = ensure(f.left);
    const R = ensure(f.right);
    const mid1 = ensure(
      L.replace(
        ',R(i_2),i_2 \\Os,R(i_1),',
        ',R(i_1),R(i_2),i_2 \\Os,'
      )
    );
    console.log('reorder R', justify(L, mid1) ?? 'FAIL', mid1 === R);
    const mid2 = ensure(
      mid1.replace(
        ',R(i_1),R(i_2),i_2 \\Os,i_1 \\Ps j_2,i_1 \\Os,j_1 \\Os,m \\Oc m_2,R(m_2),\\Bb{j_2 \\Ps m_2}{,j_2 \\Os,m_2 \\Os,\\Tc c_1,}{,j_2 \\Os,m_2 \\Os,\\Tc c_2,},',
        ',R(i_1),R(i_2),i_1 \\Ps j_2,i_1 \\Os,j_1 \\Os,m \\Oc m_2,R(m_2),\\Bb{j_2 \\Ps m_2}{,i_2 \\Os,j_2 \\Os,m_2 \\Os,\\Tc c_1,}{,i_2 \\Os,j_2 \\Os,m_2 \\Os,\\Tc c_2,},'
      )
    );
    console.log('push Os into Bb', justify(mid1, mid2) ?? 'FAIL', mid2 === R);
    console.log('mid1→R', justify(mid1, R) ?? 'FAIL');
    console.log('L→R via mid2', mid2 === R, justify(mid2, R) ?? '');
  }
  if (f.step === 59) {
    const Rfix = ensure(f.right.replace(',,', ','));
    console.log('R double-comma fix → L?', justify(f.left, Rfix) ?? 'FAIL');
    console.log('Rfix===R raw?', ensure(f.right) === Rfix);
    console.log('Rfix fingerprint vs R', ensure(stripDisplayIfConditions(f.right)) === ensure(stripDisplayIfConditions(Rfix)));
  }
  if (f.step === 60) {
    // fold into Pc
    console.log('L items', topItems(f.left).slice(0, 12));
    console.log('R items', topItems(f.right).slice(0, 12));
  }
  if (f.step === 61) {
    const L = ensure(f.left);
    const R = ensure(f.right);
    // drop j Oc j2, R(j2), j2 Os
    const mid = ensure(
      L.replace(',j \\Oc j_2,R(j_2),j_2 \\Os,', ',')
    );
    console.log('drop all three', justify(L, mid) ?? 'FAIL', mid === R);
    const midA = ensure(L.replace(',j \\Oc j_2,R(j_2),j_2 \\Os,', ',j \\Oc j_2,j_2 \\Os,'));
    console.log('R-release', justify(L, midA) ?? 'FAIL');
    const midB = ensure(midA.replace(',j \\Oc j_2,j_2 \\Os,', ','));
    console.log('create-copy', justify(midA, midB) ?? 'FAIL', midB === R);
    // other order: create-copy needs Oc,Os adjacent - currently j Oc j2, R(j2), j2 Os
    const midC = ensure(L.replace(',j \\Oc j_2,R(j_2),j_2 \\Os,', ',R(j_2),j \\Oc j_2,j_2 \\Os,'));
    console.log('swap R past Oc', justify(L, midC) ?? 'FAIL');
  }
}
