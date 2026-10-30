/**
 * Clear remaining 124 fails:
 *  s54/s86: bubble+ident70 + fwd73 + reverse copy-identical
 *  s62: bubble R_ + prev-1 + reverse create-next-prev + reorder
 *  s24/s95: shell-aware null-54/55 chain (add iPu, focus, drop shell) OR note
 *  s65: merge then null-55
 *  s98: push Ps/Os into arms
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
const POS = 13 * 100000 + 124;

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
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  const s = ensure(e);
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

const index = buildRuleIndex(
  [...axioms, ...definitions, ...theorems]
    .map((r) => ({ id: r.id, leftSide: r.leftSide, rightSide: r.rightSide, pos: posOf(r.id) }))
    .filter((r) => r.pos < POS),
  new Map()
);

function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    // Allow empty-LHS only when shrinking (reverse create-*)
    const emptyL = rule.leftSide.replace(/\s/g, '') === ',' || rule.leftSide.replace(/\s/g, '') === '';
    if (emptyL && topItems(B).length >= topItems(A).length) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function insert(L: string, R: string, mids: string[], label: string): boolean {
  const finalMids = mids.filter((m) => fingerprint(m) !== fingerprint(L) && fingerprint(m) !== fingerprint(R));
  if (!finalMids.length) {
    console.log('EMPTY', label);
    return false;
  }
  let cur = ensure(L);
  for (const mid of finalMids) {
    if (!justify(cur, mid)) {
      console.log('BREAK', label, justify(cur, mid), cur.slice(0, 80), '→', mid.slice(0, 80));
      return false;
    }
    cur = ensure(mid);
  }
  if (!justify(cur, R)) {
    console.log('TAIL', label, justify(cur, R));
    return false;
  }

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
  console.log('OK', label, '+' + block.length);
  return true;
}

function swapToward(items: string[], from: number, to: number, cur: string): { items: string[]; cur: string; path: string[] } | null {
  const path: string[] = [];
  let arr = items.slice();
  let c = cur;
  let i = from;
  while (i !== to) {
    const j = i < to ? i : i - 1;
    const sw = arr.slice();
    const t = sw[j]!;
    sw[j] = sw[j + 1]!;
    sw[j + 1] = t;
    const e = joinItems(sw);
    if (!justify(c, e)) return null;
    path.push(e);
    arr = sw;
    c = e;
    i += i < to ? 1 : -1;
  }
  return { items: arr, cur: c, path };
}

function solveS62(L0: string, R0: string): string[] | null {
  const R = ensure(R0);
  let items = topItems(L0);
  let cur = ensure(L0);
  const path: string[] = [];

  let ri = items.indexOf('R\\_(i_1)');
  const pui = () => items.indexOf('i_1 \\Pu');
  if (ri < 0 || pui() < 0) return null;
  while (ri > pui() + 1) {
    const moved = swapToward(items, ri, pui() + 1, cur);
    if (!moved) return null;
    path.push(...moved.path);
    items = moved.items;
    cur = moved.cur;
    ri = items.indexOf('R\\_(i_1)');
  }
  const noR = joinItems(items.filter((x) => x !== 'R\\_(i_1)'));
  if (!justify(cur, noR)) return null;
  path.push(noR);
  cur = noR;
  items = topItems(cur);

  let oni = items.indexOf('i_1 \\On');
  let opi = items.indexOf('i_1 \\Op');
  if (oni < 0 || opi < 0) return null;
  while (Math.abs(oni - opi) > 1) {
    const from = opi;
    const to = oni < opi ? oni + 1 : oni;
    const moved = swapToward(items, from, to, cur);
    if (!moved) return null;
    path.push(...moved.path);
    items = moved.items;
    cur = moved.cur;
    oni = items.indexOf('i_1 \\On');
    opi = items.indexOf('i_1 \\Op');
  }
  const lo = Math.min(oni, opi);
  const dropped = joinItems([...items.slice(0, lo), ...items.slice(lo + 2)]);
  if (!justify(cur, dropped)) return null;
  path.push(dropped);
  cur = dropped;
  items = topItems(cur);

  // reorder to R
  const goal = topItems(R);
  for (let step = 0; step < 24 && ensure(cur) !== R; step++) {
    if (justify(cur, R)) return path;
    let best: { e: string; d: number } | null = null;
    for (let i = 0; i < items.length - 1; i++) {
      const sw = items.slice();
      const t = sw[i]!;
      sw[i] = sw[i + 1]!;
      sw[i + 1] = t;
      const e = joinItems(sw);
      if (!justify(cur, e)) continue;
      let d = 0;
      const gi = new Map<string, number[]>();
      for (let k = 0; k < goal.length; k++) {
        if (!gi.has(goal[k]!)) gi.set(goal[k]!, []);
        gi.get(goal[k]!)!.push(k);
      }
      const used = new Map<string, number>();
      for (let k = 0; k < sw.length; k++) {
        const u = used.get(sw[k]!) ?? 0;
        used.set(sw[k]!, u + 1);
        const want = (gi.get(sw[k]!) ?? [])[u] ?? 99;
        d += Math.abs(k - want);
      }
      if (!best || d < best.d) best = { e, d };
    }
    if (!best) return null;
    path.push(best.e);
    cur = best.e;
    items = topItems(cur);
  }
  return ensure(cur) === R || justify(cur, R) ? path.filter((p) => ensure(p) !== R) : null;
}

function solveBridgeDrop(L0: string, R0: string): string[] | null {
  /** s54/s86: dedupe + fwd73 + reverse copy-identical */
  const R = ensure(R0);
  const rCount = new Map<string, number>();
  for (const x of topItems(R)) rCount.set(x, (rCount.get(x) ?? 0) + 1);

  let cur = ensure(L0);
  const path: string[] = [];
  const seen = new Set<string>([cur]);

  const score = (e: string) => {
    const items = topItems(e);
    const c = new Map<string, number>();
    for (const x of items) c.set(x, (c.get(x) ?? 0) + 1);
    let extra = 0;
    let missing = 0;
    for (const [k, v] of c) {
      const need = rCount.get(k) ?? 0;
      if (v > need) extra += v - need;
    }
    for (const [k, v] of rCount) {
      const have = c.get(k) ?? 0;
      if (have < v) missing += v - have;
    }
    return extra * 100 + missing * 1000 + Math.abs(items.length - topItems(R).length);
  };

  for (let step = 0; step < 50; step++) {
    if (cur === R || justify(cur, R)) return path.filter((p) => ensure(p) !== R);
    const items = topItems(cur);
    const cands: { e: string; s: number; why: string }[] = [];

    for (let i = 0; i < items.length - 1; i++) {
      const sw = items.slice();
      const t = sw[i]!;
      sw[i] = sw[i + 1]!;
      sw[i + 1] = t;
      const e = joinItems(sw);
      if (seen.has(e) || !justify(cur, e)) continue;
      cands.push({ e, s: score(e), why: 'swap' });
    }
    for (let i = 0; i < items.length - 1; i++) {
      if (items[i] !== items[i + 1]) continue;
      const e = joinItems([...items.slice(0, i), ...items.slice(i + 1)]);
      if (seen.has(e) || !justify(cur, e)) continue;
      cands.push({ e, s: score(e), why: 'dedupe' });
    }
    // try reverse copy-identical: drop X Ps Y next to X Oc Y
    for (let i = 0; i < items.length; i++) {
      const m = items[i]!.match(/^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/);
      if (!m) continue;
      const oc = `${m[1]} \\Oc ${m[2]}`;
      if (!items.includes(oc)) continue;
      const e = joinItems([...items.slice(0, i), ...items.slice(i + 1)]);
      if (seen.has(e) || !justify(cur, e)) continue;
      cands.push({ e, s: score(e), why: 'rev-copy-ident' });
    }
    // try fwd 73 style: i Ps j, i1 Ps i2 → if we have i Ps i1, i1 Ps i2 replace with i Ps i1, i Ps i2
    for (let i = 0; i < items.length; i++) {
      for (let j = 0; j < items.length; j++) {
        if (i === j) continue;
        const a = items[i]!.match(/^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/);
        const b = items[j]!.match(/^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/);
        if (!a || !b) continue;
        if (a[1] === b[1] && a[2] !== b[2]) {
          // i Ps j, i Ps m — reverse 73 would need j Ps m; forward keeps
        }
        if (a[2] === b[1]) {
          // a: x Ps y, b: y Ps z → forward 73: x Ps y, x Ps z
          const neu = `${a[1]} \\Ps ${b[2]}`;
          const sw = items.slice();
          sw[j] = neu;
          const e = joinItems(sw);
          if (seen.has(e) || !justify(cur, e)) continue;
          cands.push({ e, s: score(e), why: 'fwd73' });
        }
        if (a[1] === b[1] && a[2] !== b[2]) {
          // reverse 73: x Ps y, x Ps z → x Ps y, y Ps z
          const neu = `${a[2]} \\Ps ${b[2]}`;
          const sw = items.slice();
          sw[j] = neu;
          const e = joinItems(sw);
          if (seen.has(e) || !justify(cur, e)) continue;
          cands.push({ e, s: score(e), why: 'rev73' });
        }
      }
    }

    cands.sort((a, b) => a.s - b.s);
    if (!cands.length) {
      console.log('stuck bridge', cur);
      return null;
    }
    const best = cands[0]!;
    console.log('  ', best.why, best.s, justify(cur, best.e));
    path.push(best.e);
    seen.add(best.e);
    cur = best.e;
  }
  return null;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-one.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

for (const f of [...fails].sort((a, b) => b.step - a.step)) {
  const label = '124 s' + f.step;
  console.log('\n====', label, '====');
  let chain: string[] | null = null;
  if (f.step === 62) chain = solveS62(f.left, f.right);
  else if (f.step === 54 || f.step === 86) chain = solveBridgeDrop(f.left, f.right);
  else {
    console.log('SKIP (case-split/merge/push) — handle separately');
    continue;
  }
  console.log(chain ? `CHAIN +${chain.length}` : 'OPEN');
  if (chain?.length) insert(f.left, f.right, chain, label);
}
console.log('done');
