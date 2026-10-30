/**
 * Clear Rules_of_Node_Connectivity ::100:: fails by inserting justified \Rq mids.
 * Safety: fingerprint after stripDisplayIfConditions; unique left + next==right;
 * skip error-code / empty-LHS identical-4; earlier rules only; re-read tex before each insert.
 */
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
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');
const failPath = path.join(__dirname, 'out/recheck-ch14.jsonl');
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
function toBook(expr: string) {
  return normalizeSpacing(
    fromOperatorFirst(expr)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
  );
}
function ensure(s: string) {
  let t = toBook(s).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function fingerprint(expr: string): string {
  return ensure(stripDisplayIfConditions(expr))
    .replace(/,\s+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}
function bookBody(expr: string) {
  let body = toBook(expr).trim();
  if (!body.startsWith(',')) body = ',' + body;
  if (!body.endsWith(',')) body = body + ',';
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
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
function orderDist(A: string[], B: string[]) {
  const targetIdx = new Map<string, number[]>();
  for (let i = 0; i < B.length; i++) {
    if (!targetIdx.has(B[i]!)) targetIdx.set(B[i]!, []);
    targetIdx.get(B[i]!)!.push(i);
  }
  const used = new Map<string, number>();
  let d = Math.abs(A.length - B.length) * 2;
  for (let i = 0; i < A.length; i++) {
    const slots = targetIdx.get(A[i]!) ?? [];
    const k = used.get(A[i]!) ?? 0;
    const j = k < slots.length ? slots[k]! : B.length + k;
    used.set(A[i]!, k + 1);
    d += Math.abs(i - j);
  }
  return d;
}
function parseArm(arm: string): string[] {
  return arm
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .split(/\s*,\s*/)
    .filter(Boolean);
}

console.log('loading rules…');
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < POS),
  new Map()
);
const preferRe =
  /swap-release|swap-temp|identical-node-comparison-1[45678]|identical-node-comparison-70|identical-node-comparison-72|null-comparison-9|recursive-function-r-|create-copy|thm-R-i-release|empty-branch/;
const prefer = allRules.filter((r) => r.pos < POS && preferRe.test(r.id));
const memo = new Map<string, string | null>();
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const key = A + '=>' + B;
  if (memo.has(key)) return memo.get(key)!;
  for (const rule of prefer) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
      memo.set(key, rule.id);
      return rule.id;
    }
  }
  let hit: string | null = null;
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
      hit = rule.id;
      break;
    }
  }
  memo.set(key, hit);
  return hit;
}

function greedyBubble(L0: string, R0: string): string[] | null {
  const goal = ensure(R0);
  let cur = ensure(L0);
  if (cur === goal || justify(cur, goal)) return [];
  const AR = topItems(goal);
  const AL = topItems(cur);
  if (AL.length !== AR.length) return null;
  const path: string[] = [];
  const seen = new Set([cur]);
  for (let step = 0; step < 40 && cur !== goal; step++) {
    if (justify(cur, goal)) return path;
    const items = topItems(cur);
    const startOd = orderDist(items, AR);
    let best: string | null = null;
    let bestD = Infinity;
    for (let i = 0; i < items.length - 1; i++) {
      const sw = items.slice();
      const t = sw[i]!;
      sw[i] = sw[i + 1]!;
      sw[i + 1] = t;
      const d = orderDist(sw, AR);
      if (d > startOd) continue;
      const e = joinItems(sw);
      if (seen.has(e) || !justify(cur, e)) continue;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
      if (e === goal) {
        best = e;
        break;
      }
    }
    if (!best) return null;
    path.push(best);
    seen.add(best);
    cur = best;
  }
  return cur === goal || justify(cur, goal) ? path.filter((p) => ensure(p) !== goal) : null;
}

function findOuterBb(expr: string): RegExpMatchArray | null {
  // outermost Bb/Blb with nested content — match greedily from first Bb
  const s = ensure(expr);
  const start = s.search(/\\B(?:lb|b)\{/);
  if (start < 0) return null;
  const kind = s.slice(start).startsWith('\\Blb') ? 'lb' : 'b';
  const condStart = start + (kind === 'lb' ? 5 : 4);
  // condStart points at '{'
  let i = condStart + 1;
  let depth = 1;
  while (i < s.length && depth > 0) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    i++;
  }
  const cond = s.slice(condStart + 1, i - 1);
  if (s[i] !== '{') return null;
  const tStart = i;
  i++;
  depth = 1;
  while (i < s.length && depth > 0) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    i++;
  }
  const trueArm = s.slice(tStart + 1, i - 1);
  if (s[i] !== '{') return null;
  const fStart = i;
  i++;
  depth = 1;
  while (i < s.length && depth > 0) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    i++;
  }
  const falseArm = s.slice(fStart + 1, i - 1);
  const full = s.slice(start, i);
  return Object.assign([full, kind, cond, trueArm, falseArm], {
    index: start,
    input: s,
    groups: undefined,
  }) as RegExpMatchArray;
}

function rebuildBb(kind: string, cond: string, t: string, f: string) {
  const tBody = t.startsWith(',') ? t : ',' + t;
  const fBody = f.startsWith(',') ? f : ',' + f;
  const tNorm = tBody.endsWith(',') ? tBody : tBody + ',';
  const fNorm = fBody.endsWith(',') ? fBody : fBody + ',';
  return `\\B${kind}{${cond}}{${tNorm}}{${fNorm}}`;
}

function pushAtomIntoArms(expr: string, atom: string): string | null {
  const m = findOuterBb(expr);
  if (!m || m.index == null) return null;
  const items = topItems(expr);
  const idx = items.indexOf(atom);
  if (idx < 0) return null;
  const bbIdx = items.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  if (bbIdx < 0) return null;
  // remove atom from top
  const top = items.slice();
  top.splice(idx, 1);
  const tItems = parseArm(m[3]!);
  const fItems = parseArm(m[4]!);
  // prepend atom into both arms (identical-15 reverse / null-9 style)
  const t2 = [atom, ...tItems];
  const f2 = [atom, ...fItems];
  const newBb = rebuildBb(m[1]!, m[2]!, t2.join(',') + ',', f2.join(',') + ',');
  top[top.indexOf(items[bbIdx]!)] = newBb;
  // after removing atom, bb index may shift
  const outItems = items.filter((_, i) => i !== idx).map((x) => (x === items[bbIdx]! ? newBb : x));
  return joinItems(outItems);
}

function pushPrefixIntoArms(expr: string, prefixAtoms: string[]): string | null {
  // Move a contiguous top-level sequence that sits immediately before Bb into both arms (prepend).
  const m = findOuterBb(expr);
  if (!m || m.index == null) return null;
  const items = topItems(expr);
  const bbIdx = items.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  if (bbIdx < 0) return null;
  // find prefixAtoms as contiguous subsequence ending just before bb, or anywhere then bubble
  let start = -1;
  for (let i = 0; i + prefixAtoms.length <= items.length; i++) {
    if (prefixAtoms.every((a, k) => items[i + k] === a)) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  const out = items.slice();
  out.splice(start, prefixAtoms.length);
  const bbNow = out.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  if (bbNow < 0) return null;
  const tItems = parseArm(m[3]!);
  const fItems = parseArm(m[4]!);
  const t2 = [...prefixAtoms, ...tItems];
  const f2 = [...prefixAtoms, ...fItems];
  out[bbNow] = rebuildBb(m[1]!, m[2]!, t2.join(',') + ',', f2.join(',') + ',');
  return joinItems(out);
}

function flip72(L0: string, R0: string): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  if (justify(L, R)) return [];
  const re = /\\B(lb|b)\{([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)\}/;
  const mL = L.match(re);
  const mR = R.match(re);
  if (!mL || !mR) return null;
  if (mL[2] !== mR[2] || mL[3] === mR[3]) return null;
  const a = mL[2]!;
  const b = mL[3]!;
  const c = mR[3]!;
  const kind = mL[1]!;
  const flip1 = L.replace(`\\B${kind}{${a} \\Ps ${b}}`, `\\B${kind}{${b} \\Ps ${a}}`);
  if (!justify(L, flip1)) return null;
  const via72 = flip1.replace(`\\B${kind}{${b} \\Ps ${a}}`, `\\B${kind}{${c} \\Ps ${a}}`);
  if (!justify(flip1, via72)) return null;
  const flip2 = via72.replace(`\\B${kind}{${c} \\Ps ${a}}`, `\\B${kind}{${a} \\Ps ${c}}`);
  if (!justify(via72, flip2)) return null;
  if (ensure(flip2) !== R) return null;
  return [flip1, via72];
}

function solveDup(L0: string, R0: string, atom: string, add: boolean): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  if (justify(L, R)) return [];
  if (add) {
    const idx = topItems(L).indexOf(atom);
    if (idx < 0) return null;
    const withDup = topItems(L);
    withDup.splice(idx + 1, 0, atom);
    const mid = joinItems(withDup);
    if (!justify(L, mid)) return null;
    if (mid === R || justify(mid, R)) return mid === R ? [] : [mid];
    const bubble = greedyBubble(mid, R);
    if (!bubble) return null;
    return [mid, ...bubble];
  } else {
    // bubble second copy adjacent to first, then drop
    const AR = topItems(R);
    const idx = AR.indexOf(atom);
    if (idx < 0) return null;
    const adj = AR.slice();
    adj.splice(idx + 1, 0, atom);
    const midGoal = joinItems(adj);
    const toAdj = L === midGoal || justify(L, midGoal) ? [] : greedyBubble(L, midGoal);
    if (toAdj == null && L !== midGoal && !justify(L, midGoal)) return null;
    const path = toAdj ? [...toAdj] : [];
    let cur = toAdj && toAdj.length ? toAdj[toAdj.length - 1]! : L;
    if (cur !== midGoal) {
      if (!justify(cur, midGoal) && cur !== midGoal) return null;
      if (cur !== midGoal) path.push(midGoal);
      cur = midGoal;
    }
    const items = topItems(cur);
    const i = items.indexOf(atom);
    if (i < 0 || items[i + 1] !== atom) return null;
    const droppedItems = items.slice();
    droppedItems.splice(i + 1, 1);
    const dropped = joinItems(droppedItems);
    if (!justify(cur, dropped)) return null;
    if (dropped !== R) path.push(dropped);
    if (dropped === R || justify(dropped, R)) {
      const rest = dropped === R ? [] : greedyBubble(dropped, R);
      if (rest) return [...path, ...rest].filter((p) => ensure(p) !== R);
    }
    return null;
  }
}

function insert(L: string, R: string, mids: string[], label: string): boolean {
  const finalMids = mids.filter((m) => ensure(m) !== ensure(R) && fingerprint(m) !== fingerprint(L));
  if (!finalMids.length) {
    console.log('EMPTY', label);
    return false;
  }
  // verify chain
  let cur = ensure(L);
  const rules: string[] = [];
  for (const mid of finalMids) {
    const j = justify(cur, mid);
    if (!j) {
      console.log('CHAIN BREAK', label, 'at', fingerprint(mid).slice(0, 60));
      return false;
    }
    rules.push(j);
    cur = ensure(mid);
  }
  const jLast = justify(cur, R);
  if (!jLast) {
    console.log('CHAIN INCOMPLETE', label, 'last→R fail');
    return false;
  }
  rules.push(jLast);

  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(L);
  const wantR = fingerprint(R);
  const anchors: { end: number; trail: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\\Rq/.test(lines[i]!)) continue;
    let end = i;
    while (end + 1 < lines.length) {
      const nxt = lines[end + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      end++;
    }
    const joined = lines
      .slice(i, end + 1)
      .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
      .join(' ');
    if (fingerprint(joined) !== want) continue;
    let ns = end + 1;
    while (ns < lines.length && !/\\Rq/.test(lines[ns]!) && lines[ns]!.trim()) ns++;
    if (ns >= lines.length || !/\\Rq/.test(lines[ns]!)) continue;
    let ne = ns;
    while (ne + 1 < lines.length) {
      const nxt = lines[ne + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      ne++;
    }
    const nextJoined = lines
      .slice(ns, ne + 1)
      .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
      .join(' ');
    if (fingerprint(nextJoined) !== wantR) continue;
    const tm = lines[end]!.match(/(\\+)\s*$/);
    anchors.push({ end, trail: tm ? tm[1]! : '\\\\\\\\' });
  }
  if (anchors.length !== 1) {
    console.log('NO/AMBIG', label, anchors.length);
    return false;
  }
  const a = anchors[0]!;
  const block = finalMids.map((mid) => `\\Rq${bookBody(mid)}${a.trail}`);
  lines.splice(a.end + 1, 0, ...block);
  fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
  console.log('OK', label, '+' + block.length, rules.map((r) => r.replace(/^.*(?=identical|null|thm|swap|create|empty|recursive)/, '')).join(' → '));
  console.log('  rules', rules.join(' | '));
  return true;
}

function solveStep(f: { step: number; left: string; right: string }): string[] | null {
  const L = ensure(f.left);
  const R = ensure(f.right);
  if (justify(L, R)) return [];

  // s3: reverse thm-R-i-release insert R(i2) before i2 Os; keep c_2a on right side of mid
  if (f.step === 3) {
    const mid = ensure(L.replace(',i_2 \\Os,', ',R(i_2),i_2 \\Os,').replace('\\Tc c_2,', '\\Tc c_2a,'));
    // try without rename, with rename, and rename-only first
    const cands = [
      ensure(L.replace(',i_2 \\Os,', ',R(i_2),i_2 \\Os,')),
      mid,
      ensure(L.replace('\\Tc c_2,', '\\Tc c_2a,')),
      ensure(L.replace(',i_2 \\Os,', ',R(i_2),i_2 \\Os,').replace('\\Tc c_2,', '\\Tc c_2a,')),
    ];
    for (const c of cands) {
      if (c === L) continue;
      if (!justify(L, c)) continue;
      if (c === R || justify(c, R)) return c === R ? [] : [c];
      // maybe rename after insert
      const c2 = ensure(c.replace('\\Tc c_2,', '\\Tc c_2a,'));
      if (c2 !== c && justify(c, c2) && (c2 === R || justify(c2, R))) return c2 === R ? [c] : [c, c2];
    }
  }

  // s4: distribute i2 Os into Bb arms (+ maybe c_2a→c_2)
  if (f.step === 4) {
    // first rename c_2a→c_2 if needed, then push
    let cur = L;
    const path: string[] = [];
    if (cur.includes('\\Tc c_2a,') && R.includes('\\Tc c_2,')) {
      const renamed = ensure(cur.replace('\\Tc c_2a,', '\\Tc c_2,'));
      if (justify(cur, renamed)) {
        path.push(renamed);
        cur = renamed;
      }
    }
    const pushed = pushAtomIntoArms(cur, 'i_2 \\Os');
    if (pushed && justify(cur, pushed)) {
      path.push(pushed);
      cur = pushed;
      if (cur === R || justify(cur, R)) return path.filter((p) => ensure(p) !== R);
      const bub = greedyBubble(cur, R);
      if (bub) return [...path, ...bub];
    }
    // try push from L directly toward R shape
    const direct = pushAtomIntoArms(L, 'i_2 \\Os');
    if (direct && justify(L, direct)) {
      if (direct === R || justify(direct, R)) return direct === R ? [] : [direct];
      // maybe need arm reorder / top reorder / c rename
      let d = direct;
      const p2: string[] = [direct];
      if (d.includes('c_2a') && R.includes('\\Tc c_2,')) {
        const rn = ensure(d.replace(/\\Tc c_2a,/g, '\\Tc c_2,'));
        if (justify(d, rn)) {
          p2.push(rn);
          d = rn;
        }
      }
      if (d === R || justify(d, R)) return p2.filter((p) => ensure(p) !== R);
      const bub = greedyBubble(d, R);
      if (bub) return [...p2, ...bub];
    }
  }

  // s11/s31 add dup; s15/s33 drop dup
  if (f.step === 11) return solveDup(L, R, 'i_1 \\Ps i_2', true);
  if (f.step === 15) return solveDup(L, R, 'i_1 \\Ps i_2', false);
  if (f.step === 31) return solveDup(L, R, 'j_1 \\Ps j_2', true);
  if (f.step === 33) return solveDup(L, R, 'j_1 \\Ps j_2', false);

  // s32 flip→72→flip
  if (f.step === 32) return flip72(L, R);

  // s26: move j2 Os into Bb arms
  if (f.step === 26) {
    const pushed = pushAtomIntoArms(L, 'j_2 \\Os');
    if (pushed && justify(L, pushed)) {
      if (pushed === R || justify(pushed, R)) return pushed === R ? [] : [pushed];
      const bub = greedyBubble(pushed, R);
      if (bub) return [pushed, ...bub];
    }
  }

  // s38: push R(j1) into arms
  if (f.step === 38) {
    const pushed = pushAtomIntoArms(L, 'R(j_1)');
    if (pushed && justify(L, pushed)) {
      if (pushed === R || justify(pushed, R)) return pushed === R ? [] : [pushed];
      // may need arm-internal reorder of R(j1) position
      const bub = greedyBubble(pushed, R);
      if (bub) return [pushed, ...bub];
      // try arm swaps to match R
      const armPath = solveArmToward(pushed, R);
      if (armPath) return [pushed, ...armPath];
    }
  }

  // s39: push j Oc j1 into arms
  if (f.step === 39) {
    const pushed = pushAtomIntoArms(L, 'j \\Oc j_1');
    if (pushed && justify(L, pushed)) {
      if (pushed === R || justify(pushed, R)) return pushed === R ? [] : [pushed];
      const armPath = solveArmToward(pushed, R);
      if (armPath) return [pushed, ...armPath];
    }
  }

  // s42: push R(i1) into arms
  if (f.step === 42) {
    const pushed = pushAtomIntoArms(L, 'R(i_1)');
    if (pushed && justify(L, pushed)) {
      if (pushed === R || justify(pushed, R)) return pushed === R ? [] : [pushed];
      const armPath = solveArmToward(pushed, R);
      if (armPath) return [pushed, ...armPath];
    }
  }

  // s43: push i Oc i1 into arms
  if (f.step === 43) {
    const pushed = pushAtomIntoArms(L, 'i \\Oc i_1');
    if (pushed && justify(L, pushed)) {
      if (pushed === R || justify(pushed, R)) return pushed === R ? [] : [pushed];
      const armPath = solveArmToward(pushed, R);
      if (armPath) return [pushed, ...armPath];
    }
  }

  return null;
}

function solveArmToward(L0: string, R0: string): string[] | null {
  const goal = ensure(R0);
  let cur = ensure(L0);
  if (cur === goal || justify(cur, goal)) return [];
  const path: string[] = [];
  const seen = new Set([cur]);
  for (let step = 0; step < 48 && cur !== goal; step++) {
    if (justify(cur, goal)) return path;
    const mL = findOuterBb(cur);
    const mR = findOuterBb(goal);
    if (!mL || !mR) return null;
    // also try top swaps
    const items = topItems(cur);
    const gItems = topItems(goal);
    let best: string | null = null;
    let bestScore = Infinity;
    if (items.length === gItems.length) {
      const startOd = orderDist(items, gItems);
      for (let i = 0; i < items.length - 1; i++) {
        const sw = items.slice();
        const t = sw[i]!;
        sw[i] = sw[i + 1]!;
        sw[i + 1] = t;
        const d = orderDist(sw, gItems);
        if (d > startOd) continue;
        const e = joinItems(sw);
        if (seen.has(e) || !justify(cur, e)) continue;
        const score = d + (e === goal ? -100 : 0);
        if (score < bestScore) {
          bestScore = score;
          best = e;
        }
      }
    }
    // arm adjacent swaps in both arms
    for (const which of ['t', 'f'] as const) {
      const arm = which === 't' ? mL[3]! : mL[4]!;
      const goalArm = which === 't' ? mR[3]! : mR[4]!;
      const toks = parseArm(arm);
      const gToks = parseArm(goalArm);
      const startD = orderDist(toks, gToks);
      for (let i = 0; i < toks.length - 1; i++) {
        const sw = toks.slice();
        const t = sw[i]!;
        sw[i] = sw[i + 1]!;
        sw[i + 1] = t;
        const d = orderDist(sw, gToks);
        if (d > startD) continue;
        const newArm = sw.join(',') + ',';
        const newBb =
          which === 't'
            ? rebuildBb(mL[1]!, mL[2]!, newArm, mL[4]!)
            : rebuildBb(mL[1]!, mL[2]!, mL[3]!, newArm);
        const e = ensure(cur.slice(0, mL.index!) + newBb + cur.slice(mL.index! + mL[0]!.length));
        if (seen.has(e) || !justify(cur, e)) continue;
        const score = d + (e === goal ? -100 : 0);
        if (score < bestScore) {
          bestScore = score;
          best = e;
        }
      }
    }
    if (!best) return null;
    path.push(best);
    seen.add(best);
    cur = best;
  }
  return cur === goal || justify(cur, goal) ? path.filter((p) => ensure(p) !== goal) : null;
}

// --- main ---
const fails = fs
  .readFileSync(failPath, 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((x) => String(x.key).includes('::100::'));

console.log('fails', fails.map((f) => f.step).join(','));

const results: Array<{ step: number; chain: string[] | null; rules?: string[] }> = [];
for (const f of fails) {
  const t0 = Date.now();
  const chain = solveStep(f);
  console.log('s' + f.step, chain ? `CHAIN +${chain.length}` : 'OPEN', Date.now() - t0 + 'ms');
  if (chain) {
    // show rules
    let cur = ensure(f.left);
    const rules: string[] = [];
    for (const m of chain) {
      rules.push(justify(cur, m) ?? '?');
      cur = ensure(m);
    }
    rules.push(justify(cur, f.right) ?? '?');
    console.log('  ', rules.join(' → '));
    results.push({ step: f.step, chain, rules });
  } else {
    results.push({ step: f.step, chain: null });
  }
}

// Apply from highest step first so earlier anchors stay stable; re-read each time
const ok = results.filter((r) => r.chain && r.chain.length >= 0).sort((a, b) => b.step - a.step);
for (const r of ok) {
  if (!r.chain) continue;
  if (r.chain.length === 0) {
    console.log('DIRECT', 's' + r.step, '(already one-step?)');
    continue;
  }
  const f = fails.find((x) => x.step === r.step)!;
  insert(f.left, f.right, r.chain, '100 s' + r.step);
}

console.log('done');
