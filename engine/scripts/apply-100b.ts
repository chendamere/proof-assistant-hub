/**
 * Clear remaining ::100:: fails.
 * Patterns: R-insert (c_2a fix), bubble Os adjacent + identical-15 push,
 * flip72, r-17 style R/Oc push + arm bubble.
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
function tryAdjSwap(items: string[], i: number): string[] | null {
  if (i < 0 || i + 1 >= items.length) return null;
  const sw = items.slice();
  const t = sw[i]!;
  sw[i] = sw[i + 1]!;
  sw[i + 1] = t;
  return sw;
}

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

/** Brace-aware outer Bb/Blb split. */
function splitOuterBb(item: string): { kind: string; cond: string; t: string; f: string } | null {
  const s = item.trim();
  if (!s.startsWith('\\Bb{') && !s.startsWith('\\Blb{')) return null;
  const kind = s.startsWith('\\Blb') ? 'lb' : 'b';
  let p = s.indexOf('{');
  if (p < 0) return null;
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
  return { kind, cond, t, f };
}
function rebuildBb(kind: string, cond: string, t: string, f: string) {
  const tn = t.startsWith(',') ? (t.endsWith(',') ? t : t + ',') : `,${t}${t.endsWith(',') ? '' : ','}`;
  const fn = f.startsWith(',') ? (f.endsWith(',') ? f : f + ',') : `,${f}${f.endsWith(',') ? '' : ','}`;
  return `\\B${kind}{${cond}}{${tn}}{${fn}}`;
}
function parseArmItems(arm: string): string[] {
  return topItems(arm.startsWith(',') ? arm : ',' + arm);
}

function bubbleAtomBeforeBb(expr: string, atom: string): string[] | null {
  const path: string[] = [];
  let cur = topItems(expr);
  let oi = cur.indexOf(atom);
  let bi = cur.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  if (oi < 0 || bi < 0) return null;
  while (oi !== bi - 1) {
    const j = oi < bi - 1 ? oi : oi - 1;
    const sw = tryAdjSwap(cur, j);
    if (!sw) return null;
    const prev = joinItems(cur);
    const e = joinItems(sw);
    if (!justify(prev, e)) return null;
    path.push(e);
    cur = sw;
    oi = cur.indexOf(atom);
    bi = cur.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  }
  return path;
}

function pushAtomIntoBbAdjacent(expr: string, atom: string): string | null {
  const items = topItems(expr);
  const oi = items.indexOf(atom);
  const bi = items.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  if (oi < 0 || bi < 0 || oi !== bi - 1) return null;
  const bb = splitOuterBb(items[bi]!);
  if (!bb) return null;
  const tItems = parseArmItems(bb.t);
  const fItems = parseArmItems(bb.f);
  const newBb = rebuildBb(bb.kind, bb.cond, [atom, ...tItems].join(',') + ',', [atom, ...fItems].join(',') + ',');
  const out = items.slice();
  out.splice(oi, 1);
  const bi2 = out.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  out[bi2!] = newBb;
  return joinItems(out);
}

function pushAtomFrontIntoBb(expr: string, atom: string): string | null {
  // atom immediately before Bb (any top position after bubble), prepend both arms
  return pushAtomIntoBbAdjacent(expr, atom);
}

function swapArm(expr: string, which: 't' | 'f', i: number): string | null {
  const items = topItems(expr);
  const bi = items.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  if (bi < 0) return null;
  const bb = splitOuterBb(items[bi]!);
  if (!bb) return null;
  const arm = which === 't' ? parseArmItems(bb.t) : parseArmItems(bb.f);
  if (i < 0 || i + 1 >= arm.length) return null;
  const sw = arm.slice();
  const t = sw[i]!;
  sw[i] = sw[i + 1]!;
  sw[i + 1] = t;
  const newBb =
    which === 't'
      ? rebuildBb(bb.kind, bb.cond, sw.join(',') + ',', bb.f)
      : rebuildBb(bb.kind, bb.cond, bb.t, sw.join(',') + ',');
  const out = items.slice();
  out[bi] = newBb;
  return joinItems(out);
}

function armBubbleToward(expr: string, goal: string, max = 24): string[] | null {
  const G = ensure(goal);
  let cur = ensure(expr);
  if (cur === G || justify(cur, G)) return [];
  const path: string[] = [];
  const dist = (e: string) => {
    let d = Math.abs(e.length - G.length);
    for (let i = 0; i < Math.min(e.length, G.length); i++) if (e[i] !== G[i]) d++;
    return d;
  };
  for (let step = 0; step < max && cur !== G; step++) {
    if (justify(cur, G)) return path;
    const startD = dist(cur);
    let best: { e: string; d: number } | null = null;
    for (const which of ['t', 'f'] as const) {
      for (let i = 0; i < 12; i++) {
        const n = swapArm(cur, which, i);
        if (!n || n === cur) continue;
        if (!justify(cur, n)) continue;
        const d = dist(n);
        if (d < startD && (!best || d < best.d)) best = { e: n, d };
      }
    }
    // also top swaps
    const items = topItems(cur);
    const gItems = topItems(G);
    if (items.length === gItems.length) {
      for (let i = 0; i < items.length - 1; i++) {
        const sw = tryAdjSwap(items, i);
        if (!sw) continue;
        const e = joinItems(sw);
        if (!justify(cur, e)) continue;
        const d = dist(e);
        if (d < startD && (!best || d < best.d)) best = { e, d };
      }
    }
    if (!best) return null;
    path.push(best.e);
    cur = best.e;
  }
  return cur === G || justify(cur, G) ? path.filter((p) => ensure(p) !== G) : null;
}

function flip72(L0: string, R0: string): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  if (justify(L, R)) return [];
  const re = /\\B(lb|b)\{([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)\}/;
  const mL = L.match(re);
  const mR = R.match(re);
  if (!mL || !mR || mL[2] !== mR[2] || mL[3] === mR[3]) return null;
  const a = mL[2]!;
  const b = mL[3]!;
  const c = mR[3]!;
  const kind = mL[1]!;
  const flip1 = L.replace(`\\B${kind}{${a} \\Ps ${b}}`, `\\B${kind}{${b} \\Ps ${a}}`);
  if (!justify(L, flip1)) return null;
  const via72 = flip1.replace(`\\B${kind}{${b} \\Ps ${a}}`, `\\B${kind}{${c} \\Ps ${a}}`);
  if (!justify(flip1, via72)) return null;
  const flip2 = via72.replace(`\\B${kind}{${c} \\Ps ${a}}`, `\\B${kind}{${a} \\Ps ${c}}`);
  if (!justify(via72, flip2) || ensure(flip2) !== R) return null;
  return [flip1, via72];
}

function insert(L: string, R: string, mids: string[], label: string): boolean {
  const finalMids = mids.filter((m) => fingerprint(m) !== fingerprint(L) && fingerprint(m) !== fingerprint(R));
  if (!finalMids.length) {
    console.log('EMPTY', label);
    return false;
  }
  let cur = ensure(L);
  const rules: string[] = [];
  for (const mid of finalMids) {
    const j = justify(cur, mid);
    if (!j) {
      console.log('BREAK', label, rules);
      return false;
    }
    rules.push(j);
    cur = ensure(mid);
  }
  const jLast = justify(cur, R);
  if (!jLast) {
    console.log('TAIL', label, rules);
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
  // retry write
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
      console.log('OK', label, '+' + block.length);
      console.log('  ', rules.join(' → '));
      return true;
    } catch (e) {
      console.log('write retry', attempt, String(e));
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 200);
    }
  }
  return false;
}

function solveOsPush(L0: string, R0: string, atom: string): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  const path: string[] = [];
  let cur = L;
  // optional: normalize c_2a → c_2 if goal has c_2
  if (cur.includes('\\Tc c_2a,') && R.includes('\\Tc c_2,') && !R.includes('\\Tc c_2a,')) {
    // can't rename freely; instead push keeping c_2a then hope goal match after push with c_2 via arm
  }
  const bub = bubbleAtomBeforeBb(cur, atom);
  if (bub) {
    path.push(...bub);
    cur = bub.length ? ensure(bub[bub.length - 1]!) : cur;
  }
  const pushed = pushAtomIntoBbAdjacent(cur, atom);
  if (!pushed || !justify(cur, pushed)) {
    console.log('  push fail', pushed ? justify(cur, pushed) : 'null construct', 'adj?', (() => {
      const it = topItems(cur);
      return it.indexOf(atom) === it.findIndex((x) => x.startsWith('\\B')) - 1;
    })());
    return null;
  }
  path.push(pushed);
  cur = pushed;
  if (cur === R || justify(cur, R)) return path.filter((p) => ensure(p) !== R);
  const arms = armBubbleToward(cur, R);
  if (arms) return [...path, ...arms];
  // try c_2a → c_2 after push by reconstructing goal-shaped mid
  if (cur.includes('c_2a')) {
    const rn = ensure(cur.replace(/\\Tc c_2a,/g, '\\Tc c_2,'));
    if (rn !== cur && justify(cur, rn)) {
      path.push(rn);
      cur = rn;
      if (cur === R || justify(cur, R)) return path.filter((p) => ensure(p) !== R);
      const arms2 = armBubbleToward(cur, R);
      if (arms2) return [...path, ...arms2];
    }
  }
  return null;
}

function solveRorOcPush(L0: string, R0: string, atom: string): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  const path: string[] = [];
  let cur = L;
  // bubble atom adjacent before Bb
  const bub = bubbleAtomBeforeBb(cur, atom);
  if (bub) {
    path.push(...bub);
    cur = bub.length ? ensure(bub[bub.length - 1]!) : cur;
  }
  // r-17 / connectivity style: prepend to both arms (works for R and Oc with Tc-matched arms)
  const pushed = pushAtomIntoBbAdjacent(cur, atom);
  if (!pushed || !justify(cur, pushed)) {
    console.log('  R/Oc push fail', atom, pushed ? justify(cur, pushed) : null);
    return null;
  }
  path.push(pushed);
  cur = pushed;
  if (cur === R || justify(cur, R)) return path.filter((p) => ensure(p) !== R);
  const arms = armBubbleToward(cur, R);
  if (!arms) {
    console.log('  arm bubble fail after push');
    console.log('  cur', cur);
    console.log('  R  ', R);
    return null;
  }
  return [...path, ...arms];
}

const fails = fs
  .readFileSync(failPath, 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((x) => String(x.key).includes('::100::'));

console.log(
  'fails',
  fails.map((f) => f.step)
);

const report: Array<{ step: number; rules: string[] }> = [];

function detectAtomPush(L: string, R: string): string | null {
  const li = topItems(L);
  const ri = topItems(R);
  const lBb = li.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  const rBb = ri.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  if (lBb < 0 || rBb < 0) return null;
  // atoms present in L outside Bb but missing outside in R (pushed in)
  const lOut = new Set(li.filter((_, i) => i !== lBb));
  const rOut = new Set(ri.filter((_, i) => i !== rBb));
  const candidates: string[] = [];
  for (const a of lOut) {
    if (!rOut.has(a) && ri[rBb]!.includes(a)) candidates.push(a);
  }
  if (candidates.length === 1) return candidates[0]!;
  // prefer Os / R / Oc order heuristics
  const prefer = candidates.find((a) => /\\Os$/.test(a))
    ?? candidates.find((a) => /^R\(/.test(a))
    ?? candidates.find((a) => /\\Oc /.test(a));
  return prefer ?? null;
}

for (const f of [...fails].sort((a, b) => b.step - a.step)) {
  const label = '100 s' + f.step;
  const L = ensure(f.left);
  const R = ensure(f.right);

  console.log('\n====', label, '====');
  if (justify(L, R)) {
    console.log('DIRECT', justify(L, R));
    continue;
  }

  let chain: string[] | null = null;
  chain = flip72(L, R);
  if (!chain) {
    const atom = detectAtomPush(L, R);
    if (atom) {
      console.log('  atom', atom);
      chain = /\\Os$/.test(atom) ? solveOsPush(L, R, atom) : solveRorOcPush(L, R, atom);
    }
  }
  if (!chain) {
    // try common atoms exhaustively
    for (const atom of ['i_2 \\Os', 'j_2 \\Os', 'R(j_1)', 'j \\Oc j_1', 'R(i_1)', 'i \\Oc i_1', 'R(i_2)']) {
      const c = /\\Os$/.test(atom) ? solveOsPush(L, R, atom) : solveRorOcPush(L, R, atom);
      if (c) {
        chain = c;
        console.log('  fallback atom', atom);
        break;
      }
    }
  }

  console.log(chain ? `CHAIN +${chain.length}` : 'OPEN');
  if (chain && chain.length) {
    let cur = L;
    const rules: string[] = [];
    for (const m of chain) {
      rules.push(justify(cur, m) ?? '?');
      cur = ensure(m);
    }
    rules.push(justify(cur, R) ?? '?');
    if (insert(L, R, chain, label)) report.push({ step: f.step, rules });
  } else if (chain && chain.length === 0) {
    console.log('no insert needed');
  }
}

console.log('\nREPORT');
for (const r of report) console.log('s' + r.step, r.rules.join(' → '));
console.log('done');
