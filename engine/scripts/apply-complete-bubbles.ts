/**
 * Fast complete-only fill for ch14 fails:
 * - same-multiset adjacent bubble (greedy, must reach goal string)
 * - Pc-fold (108 s345 style)
 * - drop/add empty Bb{i Pu} wrappers
 * - Ps→R sibling via r-22/r-24 style adjacent hops already covered by bubble+dup
 *
 * Only inserts when the full L ⇝ mids ⇝ R chain justifies and exact fingerprint anchor hits.
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
const failPath = fs.existsSync(path.join(__dirname, 'out/recheck-ch14.jsonl'))
  ? path.join(__dirname, 'out/recheck-ch14.jsonl')
  : path.join(__dirname, 'out/proof-step-failures.jsonl');

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
function toBook(expr: string): string {
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
function bookBody(expr: string): string {
  let body = toBook(expr).trim();
  if (!body.startsWith(',')) body = ',' + body;
  if (!body.endsWith(',')) body = body + ',';
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}
function topItems(expr: string): string[] {
  const e = ensure(expr);
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < e.length; i++) {
    const c = e[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const piece = e.slice(start, i).trim();
      if (piece) items.push(piece);
      start = i + 1;
    }
  }
  const tail = e.slice(start).trim();
  if (tail) items.push(tail);
  return items;
}
function joinItems(items: string[]): string {
  return ensure(',' + items.join(',') + ',');
}
function orderDist(A: string[], B: string[]): number {
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
function multisetEq(A: string[], B: string[]): boolean {
  if (A.length !== B.length) return false;
  const c = new Map<string, number>();
  for (const x of A) c.set(x, (c.get(x) ?? 0) + 1);
  for (const x of B) c.set(x, (c.get(x) ?? 0) - 1);
  for (const v of c.values()) if (v) return false;
  return true;
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const dag = new Map();
const indexCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let ix = indexCache.get(pos);
  if (ix) return ix;
  ix = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    dag
  );
  indexCache.set(pos, ix);
  return ix;
}
const justifyMemo = new Map<string, string | null>();
function justify(a: string, b: string, pos: number): string | null {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const key = pos + '|' + A + '=>' + B;
  if (justifyMemo.has(key)) return justifyMemo.get(key)!;
  const index = indexBefore(pos);
  let hit: string | null = null;
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
      hit = rule.id;
      break;
    }
  }
  justifyMemo.set(key, hit);
  return hit;
}

/** Prefer swaps whose left item should move right / right item left per goal. */
function swapPriority(items: string[], goalItems: string[], i: number): number {
  const a = items[i]!;
  const b = items[i + 1]!;
  const ga = goalItems.indexOf(a);
  const gb = goalItems.indexOf(b);
  // Want a after b in goal ⇒ swap helps
  if (ga >= 0 && gb >= 0 && ga > gb) return 0;
  return 1;
}

function flipPs(atom: string): string | null {
  const m = atom.match(/^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/);
  if (!m) return null;
  return `${m[2]} \\Ps ${m[1]}`;
}

function solveBubble(L0: string, R0: string, pos: number, maxSteps = 24, deadlineMs = Infinity): string[] | null {
  const goal = ensure(R0);
  let cur = ensure(L0);
  if (cur === goal) return [];
  if (justify(cur, goal, pos)) return [];
  const AL = topItems(cur);
  const AR = topItems(goal);
  if (!multisetEq(AL, AR)) return null;
  const path: string[] = [];
  const seen = new Set([cur]);
  for (let step = 0; step < maxSteps && cur !== goal; step++) {
    if (Date.now() > deadlineMs) return null;
    const items = topItems(cur);
    const startOd = orderDist(items, AR);
    const scored: Array<{ e: string; d: number; pri: number; via?: string[] }> = [];
    for (let i = 0; i < items.length - 1; i++) {
      const sw = items.slice();
      const t = sw[i]!;
      sw[i] = sw[i + 1]!;
      sw[i + 1] = t;
      const d = orderDist(sw, AR);
      if (d > startOd) continue;
      const e = joinItems(sw);
      if (seen.has(e)) continue;
      scored.push({ e, d, pri: swapPriority(items, AR, i) });
      // flip72: flip Ps, swap, flip back
      for (const idx of [i, i + 1]) {
        const fl = flipPs(items[idx]!);
        if (!fl) continue;
        const flipped = items.slice();
        flipped[idx] = fl;
        const mid1 = joinItems(flipped);
        const sw2 = flipped.slice();
        const tmp = sw2[i]!;
        sw2[i] = sw2[i + 1]!;
        sw2[i + 1] = tmp;
        const mid2 = joinItems(sw2);
        const back = sw2.slice();
        const bi = back.findIndex((x) => x === fl);
        if (bi >= 0) back[bi] = items[idx]!;
        const e3 = joinItems(back);
        const d3 = orderDist(back, AR);
        if (d3 > startOd || seen.has(e3)) continue;
        scored.push({ e: e3, d: d3, pri: 2, via: [mid1, mid2] });
      }
    }
    scored.sort((a, b) => a.d - b.d || a.pri - b.pri);
    let best: { e: string; via?: string[] } | null = null;
    for (const s of scored.slice(0, 48)) {
      if (Date.now() > deadlineMs) return null;
      if (s.via) {
        let ok = true;
        let prev = cur;
        for (const mid of s.via) {
          if (!justify(prev, mid, pos)) {
            ok = false;
            break;
          }
          prev = mid;
        }
        if (!ok || !justify(prev, s.e, pos)) continue;
        best = s;
        break;
      }
      if (!justify(cur, s.e, pos)) continue;
      best = s;
      break;
    }
    if (!best) return null;
    if (best.via) {
      for (const mid of best.via) {
        path.push(mid);
        seen.add(mid);
      }
    }
    path.push(best.e);
    seen.add(best.e);
    cur = best.e;
  }
  return cur === goal ? path : null;
}

/** Try folding Oc/R/Ps/Os cluster into i Pc j (or reverse expand). */
function solvePcFold(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  if (justify(L, R, pos)) return [];
  // If R has fewer top items and contains i Pc j, try bubbling then fold
  const AL = topItems(L);
  const AR = topItems(R);
  const pc = AR.find((x) => / \\Pc /.test(x) || /\\Pc /.test(x));
  if (!pc) return null;
  // Pattern: peel Os pair + Ps + R + Oc into Pc via definition
  // Greedy: drop matching pairs that appear only on L by justifying rewrite to shorter
  let cur = L;
  const path: string[] = [];
  const seen = new Set([cur]);
  for (let step = 0; step < 20 && cur !== R; step++) {
    if (justify(cur, R, pos)) {
      return path;
    }
    const items = topItems(cur);
    const cands: string[] = [];
    // adjacent swaps toward packing Oc/R/Ps/Os next to each other near start
    for (let i = 0; i < items.length - 1; i++) {
      const sw = items.slice();
      const t = sw[i]!;
      sw[i] = sw[i + 1]!;
      sw[i + 1] = t;
      cands.push(joinItems(sw));
    }
    // try removing a contiguous Pc-definition block if R is shorter
    // i Oc a, j Oc b, R(a), R(b), a Ps b, a Os, b Os  → i Pc j
    const packed =
      /,([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),R\(\2\),R\(\4\),\2 \\Ps \4,\2 \\Os,\4 \\Os,/;
    if (packed.test(cur)) {
      cands.push(ensure(cur.replace(packed, ',$1 \\Pc $3,')));
    }
    const packed2 =
      /,([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),R\(\2\),R\(\4\),\2 \\Ps \4,\2 \\Os,\4 \\Os/;
    // already covered
    void packed2;
    let best: { e: string; d: number } | null = null;
    for (const raw of cands) {
      const e = ensure(raw);
      if (seen.has(e) || e === cur) continue;
      if (!justify(cur, e, pos)) continue;
      const d = Math.abs(topItems(e).length - AR.length) * 10 + orderDist(topItems(e), AR);
      if (!best || e === R || d < best.d) best = { e, d };
      if (e === R) break;
    }
    if (!best) return null;
    path.push(best.e);
    seen.add(best.e);
    cur = best.e;
  }
  return cur === R ? (path[path.length - 1] === R ? path.slice(0, -1) : path) : null;
}

/** Empty equal-arm Bb{i Pu}{, X,}{, X,} ↔ X  (null-comparison style). */
function solveEmptyBb(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  if (justify(L, R, pos)) return [];
  const path: string[] = [];
  let cur = L;
  // Collapse: \Bb{i Pu}{, X,}{, X,} → X when arms equal
  {
    const re = /\\Bb\{([A-Za-z][A-Za-z0-9_]*) \\Pu\}\{,([^}]*)\}\{,\2\},/;
    const m = cur.match(re);
    if (m) {
      const next = ensure(cur.replace(re, ',$2,'));
      if (justify(cur, next, pos)) {
        path.push(next);
        cur = next;
      }
    }
  }
  // Also Blb form with empty arms differing only by flags
  if (cur !== R && justify(cur, R, pos)) return path;
  if (cur === R) return path[path.length - 1] === R ? path.slice(0, -1) : path;
  // Expand reverse: inject empty Bb
  if (topItems(L).length < topItems(R).length) {
    // try R→L reverse solve then reverse path — skip for now
  }
  return null;
}

function parseArmItems(arm: string): string[] {
  return arm
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .split(/\s*,\s*/)
    .filter(Boolean);
}
function swapArmAdjacent(expr: string, blockStart: number, block: string, armRaw: string, i: number): string | null {
  const items = parseArmItems(armRaw);
  if (i < 0 || i >= items.length - 1) return null;
  const sw = items.slice();
  const t = sw[i]!;
  sw[i] = sw[i + 1]!;
  sw[i + 1] = t;
  const newArm = ',' + sw.join(',') + ',';
  // Replace first exact occurrence of {armRaw} inside block with {newArm}
  const idx = block.indexOf(`{${armRaw}}`);
  if (idx < 0) return null;
  const rebuilt = block.slice(0, idx) + `{${newArm}}` + block.slice(idx + armRaw.length + 2);
  return ensure(expr.slice(0, blockStart) + rebuilt + expr.slice(blockStart + block.length));
}
function solveArmOsBubble(L0: string, R0: string, pos: number, maxSteps = 40, deadlineMs = Infinity): string[] | null {
  /** Bubble items inside Bb/Blb arms when top-level multiset already matches. */
  const goal = ensure(R0);
  let cur = ensure(L0);
  if (cur === goal) return [];
  if (justify(cur, goal, pos)) return [];
  if (!multisetEq(topItems(cur), topItems(goal))) return null;
  if (cur === goal) return [];
  const path: string[] = [];
  const seen = new Set([cur]);
  for (let step = 0; step < maxSteps && cur !== goal; step++) {
    if (Date.now() > deadlineMs) return null;
    const cands: Array<{ e: string; d: number }> = [];
    const re = /\\B(?:lb|b)\{[^}]*\}\{([^}]*)\}\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cur))) {
      const block = m[0]!;
      for (const armRaw of [m[1]!, m[2]!]) {
        const items = parseArmItems(armRaw);
        for (let i = 0; i < items.length - 1; i++) {
          const e = swapArmAdjacent(cur, m.index, block, armRaw, i);
          if (!e || seen.has(e) || e === cur) continue;
          cands.push({ e, d: e === goal ? -1 : charish(e, goal) });
        }
      }
    }
    cands.sort((a, b) => a.d - b.d);
    let best: string | null = null;
    for (const c of cands.slice(0, 32)) {
      if (Date.now() > deadlineMs) return null;
      if (!justify(cur, c.e, pos)) continue;
      best = c.e;
      break;
    }
    if (!best) return null;
    path.push(best);
    seen.add(best);
    cur = best;
  }
  return cur === goal ? (path[path.length - 1] === goal ? path.slice(0, -1) : path) : null;
}
function charish(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
}

/**
 * Length-reducing / structure patterns learned from 197/202:
 * - create-copy drop of adjacent `x Oc y, y Os` (inside arms or top)
 * - thm-R-i-release drop of `R(y), y Os`
 * - flip `Blb{j Ps i}` → `Blb{i Ps j}`
 * - identical-15 pull of equal-arm atoms out of Blb
 * Greedy: each hop must justify and strictly decrease charish-to-goal (or length toward goal).
 */
function solveShrinkPatterns(L0: string, R0: string, pos: number, maxSteps = 16, deadlineMs = Infinity): string[] | null {
  const goal = ensure(R0);
  let cur = ensure(L0);
  if (cur === goal) return [];
  if (justify(cur, goal, pos)) return [];
  const path: string[] = [];
  const seen = new Set([cur]);
  for (let step = 0; step < maxSteps && cur !== goal; step++) {
    if (Date.now() > deadlineMs) return null;
    if (justify(cur, goal, pos)) return path;
    const cands: string[] = [];
    // create-copy style: drop `X Oc Y, Y Os` contiguous
    {
      const re = /([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),\2 \\Os,/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cur))) {
        cands.push(ensure(cur.slice(0, m.index) + cur.slice(m.index + m[0].length)));
      }
    }
    // thm-R-i-release: drop `R(Y), Y Os`
    {
      const re = /R\(([A-Za-z][A-Za-z0-9_]*)\),\1 \\Os,/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cur))) {
        cands.push(ensure(cur.slice(0, m.index) + m[1] + ' \\Os,' + cur.slice(m.index + m[0].length)));
      }
    }
    // reverse thm-R-i-release: insert R before Os when goal has it
    if (goal.includes('R(')) {
      const re = /([A-Za-z][A-Za-z0-9_]*) \\Os,/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cur))) {
        const y = m[1]!;
        if (cur.includes(`R(${y})`)) continue;
        if (!goal.includes(`R(${y})`)) continue;
        cands.push(
          ensure(cur.slice(0, m.index) + `R(${y}),` + y + ' \\Os,' + cur.slice(m.index + m[0].length))
        );
      }
    }
    // flip Blb{j Ps i} → Blb{i Ps j} when goal has flipped form
    {
      const re = /\\Blb\{([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cur))) {
        const flipped = `\\Blb{${m[2]} \\Ps ${m[1]}}`;
        if (goal.includes(flipped) || goal.includes(`\\Blb{${m[2]} \\Ps ${m[1]}}`)) {
          cands.push(ensure(cur.slice(0, m.index) + flipped + cur.slice(m.index + m[0].length)));
        }
      }
    }
    // identical-15: pull atom present in both equal arms out of Blb
    {
      const re = /\\Blb\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cur))) {
        const tItems = parseArmItems(m[2]!);
        const fItems = parseArmItems(m[3]!);
        for (const atom of tItems) {
          if (!fItems.includes(atom)) continue;
          const t2 = tItems.filter((x) => x !== atom);
          const f2 = fItems.filter((x) => x !== atom);
          // only pull one occurrence each
          const ti = tItems.indexOf(atom);
          const fi = fItems.indexOf(atom);
          const t3 = tItems.slice();
          t3.splice(ti, 1);
          const f3 = fItems.slice();
          f3.splice(fi, 1);
          void t2;
          void f2;
          const newBlb =
            `\\Blb{${m[1]}}{,${t3.join(',')}${t3.length ? ',' : ''}}{,${f3.join(',')}${f3.length ? ',' : ''}}`;
          const pulled = ensure(
            cur.slice(0, m.index) + atom + ',' + newBlb + cur.slice(m.index + m[0].length)
          );
          cands.push(pulled);
        }
      }
    }
    // adjacent top swaps that reduce charish (cheap, capped)
    {
      const items = topItems(cur);
      const gItems = topItems(goal);
      if (multisetEq(items, gItems)) {
        const startD = orderDist(items, gItems);
        for (let i = 0; i < items.length - 1; i++) {
          const sw = items.slice();
          const t = sw[i]!;
          sw[i] = sw[i + 1]!;
          sw[i + 1] = t;
          if (orderDist(sw, gItems) <= startD) cands.push(joinItems(sw));
        }
      }
    }
    // arm-adjacent swaps reducing charish
    if (multisetEq(topItems(cur), topItems(goal))) {
      const re = /\\B(?:lb|b)\{[^}]*\}\{([^}]*)\}\{([^}]*)\}/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(cur))) {
        const block = m[0]!;
        for (const armRaw of [m[1]!, m[2]!]) {
          const items = parseArmItems(armRaw);
          for (let i = 0; i < items.length - 1; i++) {
            const e = swapArmAdjacent(cur, m.index, block, armRaw, i);
            if (e) cands.push(e);
          }
        }
      }
    }

    // null-52/53: add i Pu / i nPu into Bb arms when goal has them
    {
      const re = /\\Bb\{([A-Za-z][A-Za-z0-9_]*) \\Pu\}\{,([^}]*)\}\{,([^}]*)\}/;
      const m = cur.match(re);
      if (m && !m[2]!.includes(`${m[1]} \\Pu`) && goal.includes(`${m[1]} \\Pu`)) {
        cands.push(
          ensure(
            cur.replace(
              re,
              `\\Bb{${m[1]} \\Pu}{,${m[1]} \\Pu,${m[2]}}{,${m[3]}}`
            )
          )
        );
      }
      if (m && !m[3]!.includes(`${m[1]} \\nPu`) && goal.includes(`${m[1]} \\nPu`)) {
        cands.push(
          ensure(
            cur.replace(
              re,
              `\\Bb{${m[1]} \\Pu}{,${m[2]}}{,${m[1]} \\nPu,${m[3]}}`
            )
          )
        );
      }
    }

    const startD = charish(cur, goal);
    const scored: Array<{ e: string; d: number }> = [];
    for (const raw of cands) {
      const e = ensure(raw);
      if (seen.has(e) || e === cur) continue;
      const d = e === goal ? -1 : charish(e, goal);
      if (d > startD && e !== goal) continue;
      scored.push({ e, d });
    }
    scored.sort((a, b) => a.d - b.d);
    let best: string | null = null;
    for (const s of scored.slice(0, 24)) {
      if (Date.now() > deadlineMs) return null;
      if (!justify(cur, s.e, pos)) continue;
      best = s.e;
      break;
    }
    if (!best) return null;
    path.push(best);
    seen.add(best);
    cur = best;
  }
  return cur === goal || justify(cur, goal, pos)
    ? path[path.length - 1] === goal
      ? path.slice(0, -1)
      : path
    : null;
}

function solve(L0: string, R0: string, pos: number, deadlineMs: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  if (L === R || justify(L, R, pos)) return [];
  if (Date.now() > deadlineMs) return null;
  const bubble = solveBubble(L, R, pos, 24, deadlineMs);
  if (bubble) return bubble;
  if (Date.now() > deadlineMs) return null;
  const topSame = multisetEq(topItems(L), topItems(R));
  // Arm/empty solvers are expensive; only when top multiset already matches
  if (topSame) {
    const arm = solveArmOsBubble(L, R, pos, 40, deadlineMs);
    if (arm) return arm;
  }
  if (Date.now() > deadlineMs) return null;
  const bb = solveEmptyBb(L, R, pos);
  if (bb) return bb;
  if (Date.now() > deadlineMs) return null;
  // Shrink patterns: skip when Bb/Blb top atoms clearly differ in structure (case-split)
  const bbL = (L.match(/\\B(?:lb|b)\{[^}]*\}/g) ?? []).join('|');
  const bbR = (R.match(/\\B(?:lb|b)\{[^}]*\}/g) ?? []).join('|');
  const caseSplitHint =
    (/\\Bb\{[^}]*\\Pu\}/.test(L) && !/\\Bb\{/.test(R)) ||
    (!/\\Bb\{/.test(L) && /\\Bb\{[^}]*\\Pu\}/.test(R)) ||
    (bbL.length > 0 && bbR.length > 0 && bbL !== bbR && !topSame);
  if (!caseSplitHint) {
    const shrink = solveShrinkPatterns(L, R, pos, 12, deadlineMs);
    if (shrink) return shrink;
  }
  if (Date.now() > deadlineMs) return null;
  // Pc-fold only for 108-style when R shorter or has Pc
  if (/\\Pc/.test(R) || topItems(L).length > topItems(R).length) {
    const pc = solvePcFold(L, R, pos);
    if (pc) return pc;
  }
  return null;
}

/** nth occurrence of fingerprint (0-based), so duplicate L lines get distinct anchors. */
function findAnchor(
  lines: string[],
  wantFp: string,
  occurrence = 0
): { end: number; trail: string } | null {
  let seen = 0;
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
    if (fingerprint(joined) === wantFp) {
      if (seen === occurrence) {
        const tm = lines[end]!.match(/(\\+)\s*$/);
        return { end, trail: tm ? tm[1]! : '\\\\\\\\' };
      }
      seen++;
    }
  }
  return null;
}

const fails = fs
  .readFileSync(failPath, 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l) as { key: string; step: number; left: string; right: string });

console.log('warming index…');
indexBefore(13 * 100000 + 202);
console.log('fails', fails.length);

type Job = { after: number; trail: string; mids: string[]; label: string };
const jobs: Job[] = [];
const seen = new Set<string>();
const fpOccurrence = new Map<string, number>();

for (const f of fails) {
  const id = `${f.key}::${f.step}`;
  if (seen.has(id)) continue;
  seen.add(id);
  const thm = parseInt(f.key.split('::')[1] ?? '0', 10);
  const pos = 13 * 100000 + thm;
  const t0 = Date.now();
  // Skip fails whose expressions still contain informal placeholders
  if (/<\d+>/.test(f.left + f.right)) {
    console.log('SKIP placeholder', thm, 's' + f.step);
    continue;
  }
  const chain = solve(f.left, f.right, pos, t0 + 5000);
  const ms = Date.now() - t0;
  if (!chain) {
    console.log('OPEN', thm, 's' + f.step, ms + 'ms');
    continue;
  }
  console.log('CHAIN', thm, 's' + f.step, '+' + chain.length, ms + 'ms');
  if (!chain.length) continue; // direct justify — nothing to insert; verify may still fail if false positive
  const raw = fs.readFileSync(texPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const fp = fingerprint(f.left);
  // Count occurrences; only auto-insert when unique (duplicate fps risk wrong-anchor corruption)
  let occCount = 0;
  {
    let tmp = 0;
    while (findAnchor(lines, fp, tmp)) {
      occCount++;
      tmp++;
      if (tmp > 20) break;
    }
  }
  if (occCount !== 1) {
    console.log('  SKIP ambiguous anchor', thm, 's' + f.step, 'occCount', occCount);
    continue;
  }
  const anc = findAnchor(lines, fp, 0);
  if (!anc) {
    console.log('  NO ANCHOR', thm, 's' + f.step);
    continue;
  }
  // Guard: next Rq after anchor should fingerprint to fail.right (or we'll be splicing mid-chain wrongly)
  let nextStart = anc.end + 1;
  while (nextStart < lines.length && !/\\Rq/.test(lines[nextStart]!) && lines[nextStart]!.trim()) nextStart++;
  if (nextStart < lines.length && /\\Rq/.test(lines[nextStart]!)) {
    let nextEnd = nextStart;
    while (nextEnd + 1 < lines.length) {
      const nxt = lines[nextEnd + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      nextEnd++;
    }
    const nextJoined = lines
      .slice(nextStart, nextEnd + 1)
      .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
      .join(' ');
    if (fingerprint(nextJoined) !== fingerprint(f.right)) {
      console.log('  SKIP next≠right', thm, 's' + f.step);
      continue;
    }
  }
  void fpOccurrence;
  jobs.push({ after: anc.end, trail: anc.trail, mids: chain, label: `thm ${thm} s${f.step}` });
}

jobs.sort((a, b) => b.after - a.after);
const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
const used = new Set<number>();
let inserted = 0;
for (const job of jobs) {
  if (used.has(job.after)) continue;
  used.add(job.after);
  const block = job.mids.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
  lines.splice(job.after + 1, 0, ...block);
  inserted += block.length;
  console.log('inserted', block.length, job.label);
}
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('done inserted=' + inserted + ' jobs=' + jobs.length);
