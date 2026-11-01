/**
 * Targeted fills for remaining Rules_of_Node_Continuity fails.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
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
  'Rules_of_Node_Continuity',
];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const texPath = path.join(root, 'src/data/theorems/Rules_of_Node_Continuity.tex');
const recheckPath = path.join(__dirname, 'out/recheck-ch15.jsonl');

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
function keyPos(key: string): number {
  return CHAPTER_ORDER.indexOf(key.split('::')[0]!) * 100000 + parseInt(key.split('::')[1]!, 10);
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
function bookBody(expr: string): string {
  let body = toBook(expr).trim();
  if (!body.startsWith(',')) body = ',' + body;
  if (!body.endsWith(',')) body = body + ',';
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const dag = new Map();
const idxCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let i = idxCache.get(pos);
  if (i) return i;
  i = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    dag
  );
  idxCache.set(pos, i);
  return i;
}
function justify(from: string, to: string, pos: number): string | null {
  const a = ensure(from);
  const b = ensure(to);
  if (a === b) return 'spacing';
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, a, b)) {
    if (checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}
function chainOk(steps: string[], pos: number): boolean {
  for (let i = 0; i < steps.length - 1; i++) if (!justify(steps[i]!, steps[i + 1]!, pos)) return false;
  return true;
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
      const piece = s.slice(start, i).trim();
      if (piece) items.push(piece);
      start = i + 1;
    }
  }
  const tail = s.slice(start).trim();
  if (tail) items.push(tail);
  return items;
}
function joinItems(items: string[]): string {
  return ensure(',' + items.join(',') + ',');
}
function orderDist(A: string[], B: string[]): number {
  const targetIdx = new Map<string, number[]>();
  for (let i = 0; i < B.length; i++) {
    const item = B[i]!;
    if (!targetIdx.has(item)) targetIdx.set(item, []);
    targetIdx.get(item)!.push(i);
  }
  const used = new Map<string, number>();
  let d = Math.abs(A.length - B.length) * 2;
  for (let i = 0; i < A.length; i++) {
    const item = A[i]!;
    const slots = targetIdx.get(item) ?? [];
    const k = used.get(item) ?? 0;
    const j = k < slots.length ? slots[k]! : B.length + k;
    used.set(item, k + 1);
    d += Math.abs(i - j);
  }
  return d;
}

function greedyReorder(from: string, to: string, pos: number): string[] | null {
  let cur = ensure(from);
  const goal = ensure(to);
  const gItems = topItems(goal);
  const path: string[] = [];
  for (let step = 0; step < 50; step++) {
    if (fingerprint(cur) === fingerprint(goal)) return path;
    const a = topItems(cur);
    if (
      a
        .slice()
        .sort()
        .join('\n') !==
      gItems
        .slice()
        .sort()
        .join('\n')
    )
      return path.length ? path : null;
    const startD = orderDist(a, gItems);
    let best: string | null = null;
    let bestD = startD;
    for (let i = 0; i < a.length - 1; i++) {
      if (a[i] === a[i + 1]) continue;
      const swapped = a.slice();
      const tmp = swapped[i]!;
      swapped[i] = swapped[i + 1]!;
      swapped[i + 1] = tmp;
      const cand = joinItems(swapped);
      const d = orderDist(swapped, gItems);
      if (d < bestD && justify(cur, cand, pos)) {
        bestD = d;
        best = cand;
      }
    }
    if (!best) return path.length ? path : null;
    path.push(best);
    cur = best;
  }
  return fingerprint(cur) === fingerprint(goal) ? path : path.length ? path : null;
}

/** Drop X Oc Y, Y On, Y Os (or without On) via release-next + reverse create-copy. */
function tryShellDrop(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  const re = /([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),\2 \\On,\2 \\Os,/;
  const m = re.exec(L);
  if (m) {
    const mid = ensure(L.replace(m[0]!, `${m[1]} \\Oc ${m[2]},${m[2]} \\Os,`));
    if (justify(L, mid, pos) && justify(mid, R, pos) && fingerprint(R) === fingerprint(ensure(mid.replace(`${m[1]} \\Oc ${m[2]},${m[2]} \\Os,`, '')))) {
      const end = ensure(mid.replace(`${m[1]} \\Oc ${m[2]},${m[2]} \\Os,`, ''));
      if (fingerprint(end) === fingerprint(R)) return [mid, end];
    }
    if (justify(L, mid, pos)) {
      const end = ensure(mid.replace(`${m[1]} \\Oc ${m[2]},${m[2]} \\Os,`, ''));
      if (justify(mid, end, pos) && fingerprint(end) === fingerprint(R)) return [mid, end];
      const rest = greedyReorder(end, R, pos);
      if (rest && fingerprint(rest[rest.length - 1]!) === fingerprint(R) && justify(mid, end, pos))
        return [mid, end, ...rest];
    }
  }
  // without On already: X Oc Y, Y Os
  const re2 = /([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),\2 \\Os,/;
  const m2 = re2.exec(L);
  if (m2) {
    const end = ensure(L.replace(m2[0]!, ''));
    if (justify(L, end, pos) && fingerprint(end) === fingerprint(R)) return [end];
  }
  return null;
}

/** Insert missing i On,i Op pairs via create-next-prev. */
function tryCreateNextPrev(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  const Litems = topItems(L);
  const Ritems = topItems(R);
  // Find On+Op pairs in R not in L
  const missing: string[] = [];
  for (let i = 0; i < Ritems.length - 1; i++) {
    const a = Ritems[i]!;
    const b = Ritems[i + 1]!;
    const ma = /^([A-Za-z][A-Za-z0-9_]*) \\On$/.exec(a);
    const mb = /^([A-Za-z][A-Za-z0-9_]*) \\Op$/.exec(b);
    if (ma && mb && ma[1] === mb[1]) {
      const name = ma[1]!;
      if (!Litems.includes(`${name} \\Op`)) missing.push(name);
    }
  }
  if (missing.length === 0) return null;
  let cur = L;
  const path: string[] = [];
  for (const name of missing) {
    // insert after first Oc name or at a justified position matching R
    const next = ensure(cur.replace(
      new RegExp(`(${name.replace(/_/g, '\\_')}?)`),
      // better: find `X Oc name` or existing `name On` and insert pair nearby
      '$1'
    ));
    void next;
    // Prefer: after `X Oc name` if present, else after existing `name On`
    const ocRe = new RegExp(`([A-Za-z][A-Za-z0-9_]*) \\\\Oc ${name},`);
    const onRe = new RegExp(`${name} \\\\On,`);
    let cand: string | null = null;
    if (ocRe.test(cur)) {
      cand = ensure(cur.replace(ocRe, `$1 \\Oc ${name},${name} \\On,${name} \\Op,`));
    } else if (onRe.test(cur)) {
      cand = ensure(cur.replace(onRe, `${name} \\On,${name} \\On,${name} \\Op,`));
    } else {
      cand = ensure(cur.replace(/,$/, `,${name} \\On,${name} \\Op,`));
    }
    if (!cand || !justify(cur, cand, pos)) {
      // try insert before Bb
      const bb = cur.indexOf('\\Bb');
      if (bb > 0) {
        cand = ensure(cur.slice(0, bb) + `${name} \\On,${name} \\Op,` + cur.slice(bb));
      }
    }
    if (!cand || !justify(cur, cand, pos)) return null;
    path.push(cand);
    cur = cand;
  }
  if (fingerprint(cur) === fingerprint(R)) return path;
  const rest = greedyReorder(cur, R, pos);
  if (rest && fingerprint(rest[rest.length - 1]!) === fingerprint(R)) return [...path, ...rest];
  return null;
}

/** Pc right-operand subst: flip Pc → rev connectivity-110 → flip Pc. */
function tryPcRightSubst(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  const re = /([A-Za-z][A-Za-z0-9_]*) \\Pc ([A-Za-z][A-Za-z0-9_]*)/;
  const lm = re.exec(L);
  const rm = re.exec(R);
  if (!lm || !rm || lm[1] !== rm[1] || lm[2] === rm[2]) return null;
  const x = lm[1]!;
  const y = lm[2]!; // old right
  const z = rm[2]!; // new right
  // need bridge y Ps z
  if (!L.includes(`${y} \\Ps ${z}`)) return null;
  const a = ensure(L.replace(`${x} \\Pc ${y}`, `${y} \\Pc ${x}`));
  const b = ensure(a.replace(`${y} \\Pc ${x}`, `${z} \\Pc ${x}`));
  const c = ensure(b.replace(`${z} \\Pc ${x}`, `${x} \\Pc ${z}`));
  if (chainOk([L, a, b, c], pos) && fingerprint(c) === fingerprint(R)) return [a, b, c];
  return null;
}

/** Drop Pu next to Ot / temp-null. */
function tryDropPu(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  if ((L.match(/\\Pu/g) || []).length <= (R.match(/\\Pu/g) || []).length) return null;
  // Try removing each Pu occurrence one at a time
  const items = topItems(L);
  const path: string[] = [];
  let cur = L;
  let curItems = items.slice();
  while ((cur.match(/\\Pu/g) || []).length > (R.match(/\\Pu/g) || []).length) {
    let progressed = false;
    for (let i = 0; i < curItems.length; i++) {
      if (!curItems[i]!.includes('\\Pu')) continue;
      const nextItems = curItems.slice(0, i).concat(curItems.slice(i + 1));
      const next = joinItems(nextItems);
      if (justify(cur, next, pos)) {
        path.push(next);
        cur = next;
        curItems = nextItems;
        progressed = true;
        break;
      }
    }
    if (!progressed) return null;
  }
  if (fingerprint(cur) === fingerprint(R)) return path;
  const rest = greedyReorder(cur, R, pos);
  if (rest && fingerprint(rest[rest.length - 1]!) === fingerprint(R)) return [...path, ...rest];
  return null;
}

/** 316-style: swap to i2 Ps i, i Ps i1 → transitive → drop/reorder to i2 Ps i1. */
function tryPsRightViaTransitive(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  const Litems = topItems(L);
  const Ritems = topItems(R);
  if (Litems.length !== Ritems.length) return null;
  // Find Ps that changed right operand
  let changed: { left: string; fromR: string; toR: string; idx: number } | null = null;
  for (let i = 0; i < Litems.length; i++) {
    const a = /^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/.exec(Litems[i]!);
    const b = /^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/.exec(Ritems[i]!);
    if (a && b && a[1] === b[1] && a[2] !== b[2]) {
      changed = { left: a[1]!, fromR: a[2]!, toR: b[2]!, idx: i };
      break;
    }
  }
  // Also allow different positions - compare multisets
  if (!changed) {
    for (const li of Litems) {
      const a = /^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/.exec(li);
      if (!a) continue;
      for (const ri of Ritems) {
        const b = /^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/.exec(ri);
        if (b && a[1] === b[1] && a[2] !== b[2] && !Litems.includes(ri) && !Ritems.includes(li)) {
          changed = { left: a[1]!, fromR: a[2]!, toR: b[2]!, idx: Litems.indexOf(li) };
          break;
        }
      }
      if (changed) break;
    }
  }
  if (!changed) return null;
  const { left, fromR, toR } = changed;
  // Need bridge fromR Ps toR OR toR appears as fromR's... bridge should be fromR? Actually transitive: left Ps fromR, fromR Ps toR → left Ps toR
  // Wait: i2 Ps i, i Ps i1 → i2 Ps i1. So left=i2, fromR=i, toR=i1, bridge i Ps i1.
  if (!L.includes(`${fromR} \\Ps ${toR}`)) return null;

  // BFS short path using greedy adjacent + transitive
  type Node = { expr: string; path: string[] };
  const start = L;
  const goal = fingerprint(R);
  const queue = [ { expr: start, path: [] as string[] } ];
  const seen = new Set([fingerprint(start)]);
  for (let depth = 0; depth < 12 && q.length; depth++) {
    const nextQ: Node[] = [];
    for (const node of q) {
      const items = topItems(node.expr);
      // adjacent swaps that reduce orderDist to R
      const gItems = topItems(R);
      const startD = orderDist(items, gItems);
      for (let i = 0; i < items.length - 1; i++) {
        if (items[i] === items[i + 1]) continue;
        const swapped = items.slice();
        const tmp = swapped[i]!;
        swapped[i] = swapped[i + 1]!;
        swapped[i + 1] = tmp;
        if (orderDist(swapped, gItems) >= startD) continue;
        const cand = joinItems(swapped);
        if (!justify(node.expr, cand, pos)) continue;
        const fp = fingerprint(cand);
        if (seen.has(fp)) continue;
        if (fp === goal) return [...node.path, cand];
        seen.add(fp);
        nextQ.push({ expr: cand, path: [...node.path, cand] });
      }
      // try transitive / 73 / 70 on adjacent pairs
      for (let i = 0; i < items.length - 1; i++) {
        const a = /^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/.exec(items[i]!);
        const b = /^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/.exec(items[i + 1]!);
        if (!a || !b) continue;
        // transitive: a Ps x, x Ps y → add a Ps y after
        if (a[2] === b[1]) {
          const inserted = items.slice();
          inserted.splice(i + 2, 0, `${a[1]} \\Ps ${b[2]}`);
          const cand = joinItems(inserted);
          if (justify(node.expr, cand, pos)) {
            const fp = fingerprint(cand);
            if (!seen.has(fp)) {
              if (fp === goal) return [...node.path, cand];
              seen.add(fp);
              nextQ.push({ expr: cand, path: [...node.path, cand] });
            }
          }
        }
        // identical-70 drop adjacent duplicate
        if (items[i] === items[i + 1]) {
          const dropped = items.slice(0, i).concat(items.slice(i + 1));
          const cand = joinItems(dropped);
          if (justify(node.expr, cand, pos)) {
            const fp = fingerprint(cand);
            if (!seen.has(fp)) {
              if (fp === goal) return [...node.path, cand];
              seen.add(fp);
              nextQ.push({ expr: cand, path: [...node.path, cand] });
            }
          }
        }
      }
    }
    q = nextQ.slice(0, 40);
  }
  void left;
  return null;
}

/** Push outer Op into both arms via identical-17 after bubbling adjacent. */
function tryPushOp17(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  if (!/\\Op/.test(L) || !/\\B(?:lb|b)/.test(L)) return null;
  // Use BFS: adjacent swap + identical-17 push
  const goal = fingerprint(R);
  type Node = { expr: string; path: string[] };
  let q: Node[] = [{ expr: L, path: [] }];
  const seen = new Set([fingerprint(L)]);
  for (let depth = 0; depth < 14 && q.length; depth++) {
    const nextQ: Node[] = [];
    for (const node of q) {
      const items = topItems(node.expr);
      const gItems = topItems(R);
      const startD = orderDist(items, gItems);
      for (let i = 0; i < items.length - 1; i++) {
        if (items[i] === items[i + 1]) continue;
        const swapped = items.slice();
        const tmp = swapped[i]!;
        swapped[i] = swapped[i + 1]!;
        swapped[i + 1] = tmp;
        const cand = joinItems(swapped);
        if (!justify(node.expr, cand, pos)) continue;
        const d = orderDist(swapped, gItems);
        const fp = fingerprint(cand);
        if (seen.has(fp)) continue;
        if (fp === goal) return [...node.path, cand];
        // allow swaps that don't increase too much
        if (d <= startD + 2) {
          seen.add(fp);
          nextQ.push({ expr: cand, path: [...node.path, cand] });
        }
      }
      // Try pushing each outer Op into Blb via reconstructing
      const expr = node.expr;
      const opRe = /([A-Za-z][A-Za-z0-9_]*) \\Op,/g;
      let om: RegExpExecArray | null;
      while ((om = opRe.exec(expr))) {
        // only if Op is outside branches
        const before = expr.slice(0, om.index);
        if ((before.match(/\{/g) || []).length !== (before.match(/\}/g) || []).length) continue;
        const name = om[1]!;
        const without = ensure(expr.slice(0, om.index) + expr.slice(om.index + om[0].length));
        const armRe = /\\B(lb|b)\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/;
        const am = armRe.exec(without);
        if (!am) continue;
        if (am[3]!.includes(`${name} \\Op`)) continue;
        const pushed = ensure(
          without.slice(0, am.index) +
            `\\B${am[1]}{${am[2]}}{,${name} \\Op,${am[3]}}{,${name} \\Op,${am[4]}}` +
            without.slice(am.index + am[0].length)
        );
        if (!justify(expr, pushed, pos)) continue;
        const fp = fingerprint(pushed);
        if (seen.has(fp)) continue;
        if (fp === goal) return [...node.path, pushed];
        seen.add(fp);
        nextQ.push({ expr: pushed, path: [...node.path, pushed] });
      }
    }
    q = nextQ.slice(0, 50);
  }
  return null;
}

function solve(from: string, to: string, pos: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  if (fingerprint(L) === fingerprint(R)) return [];
  if (justify(L, R, pos)) return [R];
  const patterns = [
    tryShellDrop,
    tryPcRightSubst,
    tryDropPu,
    tryCreateNextPrev,
    tryPushOp17,
    tryPsRightViaTransitive,
    greedyReorder,
  ];
  for (const p of patterns) {
    const path = p(L, R, pos);
    if (!path || path.length === 0) continue;
    if (fingerprint(path[path.length - 1]!) === fingerprint(R) && chainOk([L, ...path], pos)) return path;
  }
  return null;
}

function parseProofSteps(lines: string[]) {
  const steps: Array<{ start: number; end: number; canon: string; trail: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\\Rq/.test(lines[i]!)) continue;
    let end = i;
    const trailMatch = lines[i]!.match(/(\\+)\s*$/);
    let trail = trailMatch ? trailMatch[1]! : '\\\\';
    while (end + 1 < lines.length) {
      const nxt = lines[end + 1]!;
      if (/\\Rq/.test(nxt)) break;
      if (/^\\bigskip|^\\end\{math\}|^proof:/i.test(nxt.trim())) break;
      if (!nxt.trim()) break;
      end++;
      const tm = nxt.match(/(\\+)\s*$/);
      if (tm) trail = tm[1]!;
    }
    const buf = lines
      .slice(i, end + 1)
      .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
      .join(' ');
    const canon = ensure(buf.trim());
    if (canon.length > 4) steps.push({ start: i, end, canon, trail });
    i = end;
  }
  return steps;
}

function applyChains(solved: Array<{ left: string; intermediates: string[]; label: string }>) {
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const steps = parseProofSteps(lines);
  type Job = { afterLine: number; trail: string; intermediates: string[]; label: string };
  const jobs: Job[] = [];
  for (const item of solved) {
    const want = fingerprint(item.left);
    const hits = steps.filter((s) => fingerprint(s.canon) === want);
    if (hits.length !== 1) {
      console.log('NO UNIQUE ANCHOR', item.label, 'hits', hits.length);
      continue;
    }
    const hit = hits[0]!;
    jobs.push({ afterLine: hit.end, trail: hit.trail, intermediates: item.intermediates, label: item.label });
  }
  jobs.sort((a, b) => b.afterLine - a.afterLine);
  const used = new Set<number>();
  let inserted = 0;
  for (const job of jobs) {
    if (used.has(job.afterLine)) continue;
    used.add(job.afterLine);
    const block = job.intermediates.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
    lines.splice(job.afterLine + 1, 0, ...block);
    inserted += job.intermediates.length;
    console.log('inserted', job.intermediates.length, job.label);
  }
  fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
  return inserted;
}

const fails = fs
  .readFileSync(recheckPath, 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l) as { key: string; step: number; left: string; right: string });

const solved: Array<{ left: string; intermediates: string[]; label: string }> = [];
let open = 0;
for (const f of fails) {
  const thm = f.key.split('::')[1];
  const pos = keyPos(f.key);
  const path = solve(f.left, f.right, pos);
  if (!path || path.length === 0) {
    console.log('OPEN', thm, 's' + f.step);
    open++;
    continue;
  }
  const mids = path.slice(0, -1);
  if (mids.length === 0) {
    console.log('DIRECT', thm, 's' + f.step);
    continue;
  }
  console.log('CHAIN', thm, 's' + f.step, '+' + mids.length);
  solved.push({ left: f.left, intermediates: mids.map(toBook), label: `thm ${thm} step ${f.step}` });
}
const inserted = applyChains(solved);
console.log(`solved=${solved.length} open=${open} inserted=${inserted}`);
if (inserted > 0) {
  execSync('node scripts/extract-proof-steps.js', {
    cwd: root,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });
}
