/**
 * Clear ch14 fails for theorems 9, 24, 200 by inserting justified \Rq mids.
 * Usage: npx tsx engine/scripts/apply-924200.ts [--dry]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

const DRY = process.argv.includes('--dry');
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
function charDist(a: string, b: string) {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
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
function matchBrace(s: string, openIdx: number): number {
  if (s[openIdx] !== '{') return -1;
  let d = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === '{') d++;
    else if (s[i] === '}') {
      d--;
      if (d === 0) return i;
    }
  }
  return -1;
}
function splitArm(arm: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < arm.length; i++) {
    const c = arm[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const piece = arm.slice(start, i).trim();
      if (piece) items.push(piece);
      start = i + 1;
    }
  }
  const tail = arm.slice(start).trim();
  if (tail) items.push(tail);
  return items;
}
function tokenOrderDist(a: string, b: string): number {
  return orderDist(topItems(a), topItems(b)) * 20 + Math.floor(charDist(a, b) / 4);
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
function justify(a: string, b: string, pos: number): string | null {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (/error-code|equiv-code/.test(rule.id)) continue;
    if (/identical-4/.test(rule.id) && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

type Cand = { expr: string; id: string; d: number };

function structuralCands(cur: string, goal: string, pos: number): Cand[] {
  const out: Cand[] = [];
  const add = (raw: string) => {
    const e = ensure(raw);
    if (e === cur) return;
    const id = justify(cur, e, pos);
    if (!id) return;
    out.push({ expr: e, id, d: tokenOrderDist(e, goal) });
  };

  // connectivity-0 expand Bb{m Pc n}{...}{...} with book names m_1/n_1 (one site)
  {
    let idx = cur.indexOf('\\Bb{m \\Pc n}');
    while (idx >= 0) {
      // \Bb{m \Pc n}{arm1}{arm2} — idx points at '\', condition already closed after 'n}'
      const arm1Open = idx + '\\Bb{m \\Pc n}'.length;
      if (cur[arm1Open] !== '{') {
        idx = cur.indexOf('\\Bb{m \\Pc n}', idx + 1);
        continue;
      }
      const arm1Close = matchBrace(cur, arm1Open);
      if (arm1Close < 0 || cur[arm1Close + 1] !== '{') {
        idx = cur.indexOf('\\Bb{m \\Pc n}', idx + 1);
        continue;
      }
      const arm2Open = arm1Close + 1;
      const arm2Close = matchBrace(cur, arm2Open);
      if (arm2Close < 0) break;
      const body1 = cur.slice(arm1Open + 1, arm1Close);
      const body2 = cur.slice(arm2Open + 1, arm2Close);
      const b1 = body1.startsWith(',') ? body1 : ',' + body1;
      const b2 = body2.startsWith(',') ? body2 : ',' + body2;
      const expanded =
        cur.slice(0, idx) +
        `m \\Oc m_1,n \\Oc n_1,R(m_1),R(n_1),\\Bb{m_1 \\Ps n_1}{,m_1 \\Os,n_1 \\Os${b1}}{,m_1 \\Os,n_1 \\Os${b2}}` +
        cur.slice(arm2Close + 1);
      add(expanded);
      idx = cur.indexOf('\\Bb{m \\Pc n}', idx + 1);
    }
  }

  // Pull leading equal-arm atom out of Bb{cond}{,ATOM,...}{,ATOM,...}
  {
    let search = 0;
    while (search < cur.length) {
      const bb = cur.indexOf('\\Bb{', search);
      if (bb < 0) break;
      const condOpen = bb + 3; // '{'
      const condClose = matchBrace(cur, condOpen);
      if (condClose < 0 || cur[condClose + 1] !== '{') {
        search = bb + 4;
        continue;
      }
      const tOpen = condClose + 1;
      const tClose = matchBrace(cur, tOpen);
      if (tClose < 0 || cur[tClose + 1] !== '{') {
        search = bb + 4;
        continue;
      }
      const fOpen = tClose + 1;
      const fClose = matchBrace(cur, fOpen);
      if (fClose < 0) break;
      const tArm = cur.slice(tOpen + 1, tClose);
      const fArm = cur.slice(fOpen + 1, fClose);
      if (!tArm.startsWith(',') || !fArm.startsWith(',')) {
        search = fClose + 1;
        continue;
      }
      const tToks = splitArm(tArm.slice(1));
      const fToks = splitArm(fArm.slice(1));
      if (!tToks.length || tToks[0] !== fToks[0]) {
        search = fClose + 1;
        continue;
      }
      const atom = tToks[0]!;
      // only pull Oc / R atoms
      if (!/\\Oc |^R\(/.test(atom)) {
        search = fClose + 1;
        continue;
      }
      const tOut = tToks.length === 1 ? ',' : ',' + tToks.slice(1).join(',') + ',';
      const fOut = fToks.length === 1 ? ',' : ',' + fToks.slice(1).join(',') + ',';
      const pulled =
        cur.slice(0, bb) +
        atom +
        ',' +
        `\\Bb{${cur.slice(condOpen + 1, condClose)}}{${tOut}}{${fOut}}` +
        cur.slice(fClose + 1);
      add(pulled);
      search = fClose + 1;
    }
  }

  // Push R(i_1)/R(j_1)/Oc into Bb equal arms (forward)
  {
    const pushAtoms = ['R(i_1)', 'R(j_1)', 'i \\Oc i_1', 'j \\Oc j_1'];
    for (const atom of pushAtoms) {
      const needle = `,${atom},\\Bb{`;
      const idx = cur.indexOf(needle);
      if (idx < 0) continue;
      const bb = idx + `,${atom},`.length;
      const condOpen = bb + 3;
      const condClose = matchBrace(cur, condOpen);
      if (condClose < 0 || cur[condClose + 1] !== '{') continue;
      const tOpen = condClose + 1;
      const tClose = matchBrace(cur, tOpen);
      if (tClose < 0 || cur[tClose + 1] !== '{') continue;
      const fOpen = tClose + 1;
      const fClose = matchBrace(cur, fOpen);
      if (fClose < 0) continue;
      const tArm = cur.slice(tOpen + 1, tClose);
      const fArm = cur.slice(fOpen + 1, fClose);
      const tOut = tArm.startsWith(',') ? `,${atom}${tArm}` : `,${atom},${tArm}`;
      const fOut = fArm.startsWith(',') ? `,${atom}${fArm}` : `,${atom},${fArm}`;
      const pushed =
        cur.slice(0, idx) +
        ',' +
        `\\Bb{${cur.slice(condOpen + 1, condClose)}}{${tOut}}{${fOut}}` +
        cur.slice(fClose + 1);
      add(pushed);
    }
  }

  // connectivity fold of Oc/R/Bb{Ps}{Os...} cluster → Bb{i Pc j}{...} (one nest)
  {
    const marker = 'i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}';
    let idx = cur.indexOf(marker);
    while (idx >= 0) {
      const after = idx + marker.length;
      if (cur[after] !== '{') {
        idx = cur.indexOf(marker, idx + 1);
        continue;
      }
      const tOpen = after;
      const tClose = matchBrace(cur, tOpen);
      if (tClose < 0 || cur[tClose + 1] !== '{') break;
      const fOpen = tClose + 1;
      const fClose = matchBrace(cur, fOpen);
      if (fClose < 0) break;
      const tArm = cur.slice(tOpen + 1, tClose);
      const fArm = cur.slice(fOpen + 1, fClose);
      // require arms start with i1 Os, j1 Os
      if (!tArm.startsWith(',i_1 \\Os,j_1 \\Os') || !fArm.startsWith(',i_1 \\Os,j_1 \\Os')) {
        idx = cur.indexOf(marker, idx + 1);
        continue;
      }
      const tRest = tArm.slice(',i_1 \\Os,j_1 \\Os'.length);
      const fRest = fArm.slice(',i_1 \\Os,j_1 \\Os'.length);
      const folded =
        cur.slice(0, idx) + `\\Bb{i \\Pc j}{${tRest.startsWith(',') ? tRest : ',' + tRest}}{${fRest.startsWith(',') ? fRest : ',' + fRest}}` + cur.slice(fClose + 1);
      add(folded);
      idx = cur.indexOf(marker, idx + 1);
    }
  }

  // fold arms of empty Blb via connectivity-4/5
  add(
    cur.replace(
      /\\Blb\{\}\{,i \\Oc i_1,j \\Oc j_1,R\(i_1\),R\(j_1\),i_1 \\Ps j_1,i_1 \\Os,j_1 \\Os,\}/,
      '\\Blb{}{,i \\Pc j,}'
    )
  );
  add(
    cur.replace(
      /\\Blb\{\}\{,i \\Pc j,\}\{,i \\Oc i_1,j \\Oc j_1,R\(i_1\),R\(j_1\),i_1 \\nPs j_1,i_1 \\Os,j_1 \\Os,\}/,
      '\\Blb{}{,i \\Pc j,}{,i \\nPc j,}'
    )
  );

  // pull equal-arm leading Oc via identical-12 reverse (one Oc atom)
  {
    const re = /\\Bb\{([^}]*)\}\{,([A-Za-z0-9_]+ \\Oc [A-Za-z0-9_]+),/;
    // handled via key rewrites instead
  }

  // 200: drop Ps via copy-identical; swap Pu past R; drop Pu via thm-R-i-result
  add(cur.replace(/,i \\Oc i_1,i \\Ps i_1,/, ',i \\Oc i_1,'));
  add(cur.replace(/,i \\Oc i_1,i_1 \\Pu,R\(i_1\),/, ',i \\Oc i_1,R(i_1),i_1 \\Pu,'));
  add(cur.replace(/,R\(i_1\),i_1 \\Pu,/, ',R(i_1),'));

  // Os push into nested Bb{m Pc n} (connectivity-20 reverse) — key rewrites handle

  // Reorder Os inside ALL innermost Bb{i1 Ps j1} arms identically
  {
    const from = '\\Bb{i_1 \\Ps j_1}{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,';
    const midA = '\\Bb{i_1 \\Ps j_1}{,m_1 \\Os,i_1 \\Os,n_1 \\Os,j_1 \\Os,';
    const midB = '\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,m_1 \\Os,n_1 \\Os,j_1 \\Os,';
    const midC = '\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,m_1 \\Os,j_1 \\Os,n_1 \\Os,';
    const to = '\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,m_1 \\Os,n_1 \\Os,';
    if (cur.includes(from)) {
      add(cur.split(from).join(midA));
      add(cur.split(from).join(midB));
      add(cur.split(from).join(to));
    }
    if (cur.includes(midA)) {
      add(cur.split(midA).join(midB));
      add(cur.split(midA).join(from));
    }
    if (cur.includes(midB)) {
      add(cur.split(midB).join(midC));
      add(cur.split(midB).join(to));
      add(cur.split(midB).join(midA));
    }
    if (cur.includes(midC)) {
      add(cur.split(midC).join(to));
      add(cur.split(midC).join(midB));
    }
  }

  return out;
}

const KEY_RULE_IDS = [
  'rules-of-node-connectivity-0-lbificj',
  'rules-of-node-connectivity-4-icjici',
  'rules-of-node-connectivity-5-incjici',
  'rules-of-node-connectivity-20-mslbifi',
  'theorems-of-identical-node-comparison-12-mcnlbif',
  'theorems-of-identical-node-comparison-15-mslbifi',
  'recursive-function-r-17-ibifm',
  'recursive-function-r-20-muii',
  'recursive-function-r-10-ijcnj',
  'recursive-function-r-24-ijj',
  'copy-identical',
  'thm-R-i-result',
  'swap-release-release',
  'swap-copy-copy',
];

function tryKeyRewrites(cur: string, goal: string, pos: number): Cand[] {
  const out: Cand[] = [];
  const startD = tokenOrderDist(cur, goal);
  const index = indexBefore(pos);
  for (const id of KEY_RULE_IDS) {
    const rule = allRules.find((r) => r.id === id && r.pos < pos);
    if (!rule) continue;
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(cur, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const raw of rewrites) {
      const e = ensure(raw);
      if (e === cur) continue;
      // skip fresh-name expands from connectivity-0 (prefer structural book names)
      if (id.includes('connectivity-0') && /\\Oc t_/.test(e)) continue;
      const d = tokenOrderDist(e, goal);
      if (e !== goal && d > startD + 5) continue;
      if (!checkInferenceRules(cur, e, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
        continue;
      out.push({ expr: e, id: rule.id, d });
    }
  }
  return out;
}

function tryBubble(cur: string, goal: string, pos: number): Cand[] {
  const AL = topItems(cur);
  const AR = topItems(goal);
  // Allow bubble when outer items match ignoring Bb body differences? Only when Bb items equal.
  if (!multisetEq(AL, AR)) {
    // try bubbling among matching prefix atoms only when Bb is last item on both
    if (AL.length !== AR.length) return [];
  }
  if (!multisetEq(AL, AR)) return [];
  const startOd = orderDist(AL, AR);
  const out: Cand[] = [];
  for (let i = 0; i < AL.length - 1; i++) {
    const sw = AL.slice();
    [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
    const od = orderDist(sw, AR);
    if (od >= startOd) continue;
    const e = joinItems(sw);
    if (e === cur) continue;
    const id = justify(cur, e, pos);
    if (!id) continue;
    out.push({ expr: e, id, d: tokenOrderDist(e, goal) });
  }
  return out;
}

function tryArmOsSwaps(cur: string, goal: string, pos: number): Cand[] {
  const out: Cand[] = [];
  const startD = tokenOrderDist(cur, goal);
  // Find innermost Bb{i1 Ps j1} occurrences and swap adjacent Os in one arm
  let searchFrom = 0;
  while (true) {
    const idx = cur.indexOf('\\Bb{i_1 \\Ps j_1}', searchFrom);
    if (idx < 0) break;
    const condEnd = idx + '\\Bb{i_1 \\Ps j_1}'.length;
    if (cur[condEnd] !== '{') {
      searchFrom = idx + 1;
      continue;
    }
    // Actually form is \Bb{i_1 \Ps j_1}{arm}{arm} — the first { after Bb{cond} 
    // Wait: \Bb{i_1 \Ps j_1} — the brace after Bb opens the CONDITION, not arms!
    // So structure is \Bb { i_1 \Ps j_1 } { arm1 } { arm2 }
    const condOpen = cur.indexOf('{', idx);
    const condClose = matchBrace(cur, condOpen);
    if (condClose < 0 || cur[condClose + 1] !== '{') {
      searchFrom = idx + 1;
      continue;
    }
    const tOpen = condClose + 1;
    const tClose = matchBrace(cur, tOpen);
    if (tClose < 0 || cur[tClose + 1] !== '{') {
      searchFrom = idx + 1;
      continue;
    }
    const fOpen = tClose + 1;
    const fClose = matchBrace(cur, fOpen);
    if (fClose < 0) {
      searchFrom = idx + 1;
      continue;
    }
    for (const [open, close] of [
      [tOpen, tClose],
      [fOpen, fClose],
    ] as const) {
      const arm = cur.slice(open + 1, close);
      const leading = arm.startsWith(',') ? ',' : '';
      const body = arm.startsWith(',') ? arm.slice(1) : arm;
      const toks = splitArm(body);
      for (let i = 0; i < toks.length - 1; i++) {
        if (!/\\Os/.test(toks[i]!) || !/\\Os/.test(toks[i + 1]!)) continue;
        const sw = toks.slice();
        [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
        const newArm = leading + sw.join(',');
        const e = ensure(cur.slice(0, open + 1) + newArm + cur.slice(close));
        if (e === cur) continue;
        const d = tokenOrderDist(e, goal);
        if (e !== goal && d > startD) continue;
        const id = justify(cur, e, pos);
        if (!id) continue;
        out.push({ expr: e, id, d });
      }
    }
    searchFrom = fClose + 1;
  }
  return out;
}

function solveFail(left: string, right: string, pos: number, maxHops = 40) {
  const goal = ensure(stripDisplayIfConditions(right));
  let cur = ensure(stripDisplayIfConditions(left));
  const mids: string[] = [];
  const ids: string[] = [];
  const seen = new Set([fingerprint(cur)]);

  const direct = justify(cur, goal, pos);
  if (direct) return { mids: [], ids: [direct], complete: true };

  for (let hop = 0; hop < maxHops && fingerprint(cur) !== fingerprint(goal); hop++) {
    const startD = tokenOrderDist(cur, goal);
    const cands = [
      ...structuralCands(cur, goal, pos),
      ...tryKeyRewrites(cur, goal, pos),
      ...tryBubble(cur, goal, pos),
      ...tryArmOsSwaps(cur, goal, pos),
    ].filter((c) => !seen.has(fingerprint(c.expr)));

    cands.sort((a, b) => {
      const ag = fingerprint(a.expr) === fingerprint(goal) ? 0 : 1;
      const bg = fingerprint(b.expr) === fingerprint(goal) ? 0 : 1;
      if (ag !== bg) return ag - bg;
      if (a.d !== b.d) return a.d - b.d;
      // prefer non-swap-release noise
      const ap = /swap-release-release/.test(a.id) ? 1 : 0;
      const bp = /swap-release-release/.test(b.id) ? 1 : 0;
      return ap - bp;
    });

    let best: Cand | null = null;
    for (const c of cands) {
      if (fingerprint(c.expr) === fingerprint(goal) || c.d < startD) {
        best = c;
        break;
      }
    }
    if (!best) {
      console.log('  stuck hop', hop, 'd', startD, 'cands', cands.length);
      if (cands[0]) console.log('  nearest', cands[0].id, 'd', cands[0].d, cands[0].expr.slice(0, 100));
      break;
    }
    console.log('  hop', hop, best.id, 'd', best.d);
    mids.push(best.expr);
    ids.push(best.id);
    seen.add(fingerprint(best.expr));
    cur = best.expr;
  }

  let insert = mids;
  if (insert.length && fingerprint(insert[insert.length - 1]!) === fingerprint(goal)) {
    insert = insert.slice(0, -1);
  }
  return { mids: insert, ids, complete: fingerprint(cur) === fingerprint(goal) };
}

type Fail = { key: string; step: number; left: string; right: string };
const fails: Fail[] = fs
  .readFileSync(failPath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((f: Fail) => /::(9|24|200)::/.test(f.key));

const solved = [];
for (const f of fails) {
  const thm = parseInt(f.key.split('::')[1]!, 10);
  const pos = 13 * 100000 + thm;
  console.log(`\n=== thm ${thm} step ${f.step} ===`);
  const sol = solveFail(f.left, f.right, pos);
  console.log(sol.complete ? 'COMPLETE' : 'PARTIAL', 'mids', sol.mids.length, sol.ids);
  solved.push({ ...f, ...sol });
}

fs.writeFileSync(path.join(__dirname, 'out/chains-924200.json'), JSON.stringify(solved, null, 2));
const toApply = solved.filter((s) => s.complete && s.mids.length > 0);
console.log(`\napply candidates: ${toApply.length}/${solved.length}`);
if (DRY) {
  console.log('dry-run');
  process.exit(0);
}

for (const item of toApply) {
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(item.left);
  const wantNext = fingerprint(item.right);
  let hitEnd = -1;
  let trail = '\\\\\\\\';
  let nextFp = '';
  for (let i = 0; i < lines.length; i++) {
    if (!/\\Rq/.test(lines[i]!)) continue;
    let end = i;
    while (end + 1 < lines.length) {
      const nxt = lines[end + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      end++;
    }
    const joined = fingerprint(
      lines
        .slice(i, end + 1)
        .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
        .join(' ')
    );
    if (joined !== want) continue;
    let j = end + 1;
    while (j < lines.length && !/\\Rq/.test(lines[j]!) && lines[j]!.trim()) j++;
    if (j >= lines.length || !/\\Rq/.test(lines[j]!)) {
      hitEnd = -2;
      break;
    }
    let nextEnd = j;
    while (nextEnd + 1 < lines.length) {
      const nxt = lines[nextEnd + 1]!;
      if (/\\Rq/.test(nxt) || /^\\bigskip|^\\end\{math\}/i.test(nxt.trim()) || !nxt.trim()) break;
      nextEnd++;
    }
    nextFp = fingerprint(
      lines
        .slice(j, nextEnd + 1)
        .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
        .join(' ')
    );
    if (nextFp !== wantNext) {
      console.log('NEXT≠R skip', item.key.split('::')[1], 's' + item.step);
      hitEnd = -3;
      break;
    }
    hitEnd = end;
    const tm = lines[end]!.match(/(\\+)\s*$/);
    if (tm) trail = tm[1]!;
    break;
  }
  if (hitEnd < 0) {
    console.log('NO ANCHOR', item.key.split('::')[1], 's' + item.step, hitEnd);
    continue;
  }
  if (item.mids.length && fingerprint(item.mids[0]!) === nextFp) {
    console.log('already', item.key.split('::')[1], 's' + item.step);
    continue;
  }
  const block = item.mids.map((m: string) => `\\Rq${bookBody(m)}${trail}`);
  lines.splice(hitEnd + 1, 0, ...block);
  fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
  console.log('inserted', block.length, 'thm', item.key.split('::')[1], 's' + item.step);
}
console.log('done');
