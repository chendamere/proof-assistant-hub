/**
 * Apply chains for theorem 108 fails: s17/s51 right-Ps subst, s28 Os→Bb,
 * s59 reorder (+ tex comma fix), s60 fold Pc + pull Os, s61 release+copy.
 * Safety: unique L fingerprint + next=R; stripDisplayIfConditions; no axioms/regen/commit.
 */
import fs from 'fs';
import { dirname, join } from 'path';
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
const __dirname = dirname(fileURLToPath(import.meta.url));
const texPath = join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');

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

function insert(L: string, R: string, mids: string[], label: string): boolean {
  const finalMids = mids.filter((m) => ensure(m) !== ensure(R) && ensure(m) !== ensure(L));
  if (!finalMids.length && ensure(L) !== ensure(R) && !justify(L, R)) {
    console.log('NO MIDS', label);
    return false;
  }
  // If direct justify and no mids needed, still OK to skip insert
  if (!finalMids.length) {
    console.log('DIRECT OK (no insert)', label);
    return true;
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
  // verify each hop
  let cur = ensure(L);
  for (const mid of finalMids) {
    if (!justify(cur, mid)) {
      console.log('BAD HOP', label, justify(cur, mid), 'at', finalMids.indexOf(mid));
      return false;
    }
    cur = ensure(mid);
  }
  if (!(ensure(cur) === ensure(R) || justify(cur, R))) {
    console.log('BAD TAIL', label);
    return false;
  }
  const a = anchors[0]!;
  const block = finalMids.map((mid) => `\\Rq${bookBody(mid)}${a.trail}`);
  lines.splice(a.end + 1, 0, ...block);
  fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
  console.log('OK', label, '+' + block.length);
  return true;
}

function greedyBubble(L0: string, R0: string, max = 120): string[] | null {
  let cur = topItems(L0);
  const goal = topItems(R0);
  if ([...cur].sort().join('|') !== [...goal].sort().join('|')) return null;
  const path: string[] = [];
  for (let g = 0; g < max && joinItems(cur) !== ensure(R0); g++) {
    if (justify(joinItems(cur), R0)) return path;
    let moved = false;
    for (let i = 0; i < cur.length; i++) {
      if (cur[i] === goal[i]) continue;
      // find goal[i] among remaining; prefer exact unused match
      let j = -1;
      const used = new Set<number>();
      for (let k = 0; k < i; k++) {
        // mark first occurrences already placed
      }
      j = cur.indexOf(goal[i]!, i);
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

/** a Ps b → a Ps c given b Ps c or c Ps b at top level. */
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
          if (!justify(prev, e)) return false;
          path.push(e);
          cur = sw;
          return true;
        }
        seen++;
      }
    }
    return false;
  };
  if (!cur.includes(bridgeFlip)) {
    if (!cur.includes(bridge)) return null;
    const fi = cur.indexOf(from);
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
  }
  if (!repl(from, `${b} \\Ps ${a}`, 0)) return null;
  const flippedFrom = `${b} \\Ps ${a}`;
  // adjacent: bridgeFlip immediately before flippedFrom
  {
    let fi = cur.indexOf(flippedFrom);
    const candidates: number[] = [];
    for (let i = 0; i < cur.length; i++) if (cur[i] === bridgeFlip) candidates.push(i);
    if (!candidates.length) return null;
    let bi = candidates.reduce((best, i) => (Math.abs(i - fi) < Math.abs(best - fi) ? i : best), candidates[0]!);
    while (bi < fi - 1) {
      const sw = tryAdjSwap(cur, bi);
      if (!sw || !justify(joinItems(cur), joinItems(sw))) return null;
      path.push(joinItems(sw));
      cur = sw;
      bi++;
      fi = cur.indexOf(flippedFrom);
    }
    while (bi > fi) {
      const sw = tryAdjSwap(cur, bi - 1);
      if (!sw || !justify(joinItems(cur), joinItems(sw))) return null;
      path.push(joinItems(sw));
      cur = sw;
      bi--;
      fi = cur.indexOf(flippedFrom);
    }
    fi = cur.indexOf(flippedFrom);
    if (!(fi > 0 && cur[fi - 1] === bridgeFlip)) {
      if (fi >= 0 && cur[fi + 1] === bridgeFlip) {
        const sw = tryAdjSwap(cur, fi);
        if (!sw || !justify(joinItems(cur), joinItems(sw))) return null;
        path.push(joinItems(sw));
        cur = sw;
      }
    }
    fi = cur.indexOf(flippedFrom);
    if (!(fi > 0 && cur[fi - 1] === bridgeFlip)) return null;
  }
  if (!repl(flippedFrom, `${c} \\Ps ${a}`, 0)) return null;
  if (!repl(`${c} \\Ps ${a}`, to, 0)) return null;
  if (goal.includes(bridge) && !goal.includes(bridgeFlip) && cur.includes(bridgeFlip)) {
    const which = cur.includes(bridge) ? 1 : 0;
    if (!repl(bridgeFlip, bridge, which) && !repl(bridgeFlip, bridge, 0)) return null;
  }
  const curE = joinItems(cur);
  if (curE === ensure(R0) || justify(curE, R0)) return path.filter((p) => ensure(p) !== ensure(R0));
  const bub = greedyBubble(curE, R0);
  if (bub) return [...path, ...bub].filter((p) => ensure(p) !== ensure(R0));
  return null;
}

function pushOsIntoBb(L0: string, atom: string): string | null {
  const items = topItems(L0);
  const oi = items.indexOf(atom);
  const bi = items.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  if (oi < 0 || bi < 0) return null;
  const m = items[bi]!.match(/\\B(lb|b)\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/);
  if (!m) return null;
  const newBb = `\\B${m[1]}{${m[2]}}{,${atom},${m[3]}}{,${atom},${m[4]}}`;
  return joinItems(items.filter((_, i) => i !== oi).map((x, i) => (items[i + (i >= oi ? 1 : 0)] === items[bi] || x === items[bi] ? (x.startsWith('\\B') ? newBb : x) : x)).map((x) => (x === items[bi] ? newBb : x)));
}

function pushOsIntoBbSimple(expr: string, atom: string): string | null {
  const items = topItems(expr);
  const oi = items.indexOf(atom);
  const bi = items.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  if (oi < 0 || bi < 0 || oi !== bi - 1) return null;
  const m = items[bi]!.match(/\\B(lb|b)\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/);
  if (!m) return null;
  const newBb = `\\B${m[1]}{${m[2]}}{,${atom},${m[3]}}{,${atom},${m[4]}}`;
  const out = items.slice();
  out.splice(oi, 1);
  const bi2 = out.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  out[bi2] = newBb;
  return joinItems(out);
}

function pullOsFromBb(expr: string, atom: string): string | null {
  const items = topItems(expr);
  const bi = items.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  if (bi < 0) return null;
  const m = items[bi]!.match(/\\B(lb|b)\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/);
  if (!m) return null;
  const tItems = topItems(',' + m[3]! + ',');
  const fItems = topItems(',' + m[4]! + ',');
  // require atom at front of both arms
  if (tItems[0] !== atom || fItems[0] !== atom) return null;
  const t2 = tItems.slice(1);
  const f2 = fItems.slice(1);
  const newBb = `\\B${m[1]}{${m[2]}}{,${t2.join(',')},}{,${f2.join(',')},}`;
  const out = items.slice();
  out[bi] = newBb;
  out.splice(bi, 0, atom);
  return joinItems(out);
}

function swapArmAtoms(expr: string, which: 'true' | 'false', i: number): string | null {
  const items = topItems(expr);
  const bi = items.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  if (bi < 0) return null;
  const m = items[bi]!.match(/\\B(lb|b)\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/);
  if (!m) return null;
  const arm = which === 'true' ? m[3]! : m[4]!;
  const toks = topItems(',' + arm + ',');
  if (i < 0 || i + 1 >= toks.length) return null;
  const sw = toks.slice();
  const t = sw[i]!;
  sw[i] = sw[i + 1]!;
  sw[i + 1] = t;
  const newArm = sw.join(',') + ',';
  const newBb =
    which === 'true'
      ? `\\B${m[1]}{${m[2]}}{,${newArm}}{,${m[4]}}`
      : `\\B${m[1]}{${m[2]}}{,${m[3]}}{,${newArm}}`;
  const out = items.slice();
  out[bi] = newBb;
  return joinItems(out);
}

function bubbleAtomTo(expr: string, atom: string, targetIdx: number): string[] | null {
  const path: string[] = [];
  let cur = topItems(expr);
  let idx = cur.indexOf(atom);
  if (idx < 0) return null;
  while (idx !== targetIdx) {
    const j = idx < targetIdx ? idx : idx - 1;
    const sw = tryAdjSwap(cur, j);
    if (!sw) return null;
    const prev = joinItems(cur);
    const e = joinItems(sw);
    if (!justify(prev, e)) return null;
    path.push(e);
    cur = sw;
    idx = cur.indexOf(atom);
  }
  return path;
}

const fails = fs
  .readFileSync(join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((x) => x.key.includes('::108::'));

/** Strip accidental empty atoms from double-comma tex artifacts. */
function clean(s: string) {
  return ensure(s.replace(/,,+/g, ','));
}

for (const f of fails) {
  const label = 's' + f.step;
  const L = ensure(f.left);
  const R = clean(f.right);
  console.log('\n====', label, '====');

  if (f.step === 17) {
    const chain = rightSubst(L, R, 'i_1', 'j_1', 'j_2');
    console.log('chain', chain?.length ?? null);
    if (chain) insert(L, ensure(f.right), chain, label);
  }

  if (f.step === 51) {
    const chain = rightSubst(L, R, 'i_1', 'j_2', 'j_1');
    console.log('chain', chain?.length ?? null);
    if (chain) insert(L, ensure(f.right), chain, label);
  }

  if (f.step === 28) {
    const path: string[] = [];
    let cur = L;
    const m1 = ensure(cur.replace(',R(i_2),i_2 \\Os,R(i_1),', ',R(i_2),R(i_1),i_2 \\Os,'));
    if (!justify(cur, m1)) {
      console.log('fail m1');
      continue;
    }
    path.push(m1);
    cur = m1;
    const m2 = ensure(cur.replace(',R(i_2),R(i_1),i_2 \\Os,', ',R(i_1),R(i_2),i_2 \\Os,'));
    if (!justify(cur, m2)) {
      console.log('fail m2');
      continue;
    }
    path.push(m2);
    cur = m2;
    const bi = topItems(cur).findIndex((x) => x.startsWith('\\Bb'));
    const bub = bubbleAtomTo(cur, 'i_2 \\Os', bi - 1);
    if (!bub) {
      console.log('fail bubble');
      continue;
    }
    path.push(...bub);
    cur = bub.length ? ensure(bub[bub.length - 1]!) : cur;
    const pushed = pushOsIntoBbSimple(cur, 'i_2 \\Os');
    if (!pushed || !justify(cur, pushed)) {
      console.log('fail push', pushed ? justify(cur, pushed) : null);
      continue;
    }
    path.push(pushed);
    console.log('chain', path.length, '→R', ensure(pushed) === ensure(f.right) || justify(pushed, f.right));
    insert(L, ensure(f.right), path, label);
  }

  if (f.step === 59) {
    // After comma fix, R in tex may change; use cleaned R from fail or re-fingerprint
    const R0 = clean(f.right);
    const bub = greedyBubble(L, R0);
    console.log('bubble', bub?.length ?? null, 'multiset', [...topItems(L)].sort().join('|') === [...topItems(R0)].sort().join('|'));
    if (bub) {
      // Insert against cleaned R - but tex next line may still have ,,; fix tex target first
      insert(L, R0, bub, label);
    }
  }

  if (f.step === 60) {
    const L0 = clean(f.left);
    const R0 = ensure(f.right);
    const path: string[] = [];
    let cur = L0;
    // If L still has ,, relative to fail left, treat as spacing
    if (L0 !== L && justify(L, L0)) {
      // tex fix handles display; verification uses strip — may not need mid
    }
    // fold Pc first
    const fold = ensure(
      cur.replace(
        ',i \\Oc i_1,j \\Oc j_1,R(i_1),R(j_1),i_1 \\Ps j_1,i_1 \\Os,j_1 \\Os,',
        ',i \\Pc j,'
      )
    );
    if (!justify(cur, fold)) {
      console.log('fold fail', justify(cur, fold));
      continue;
    }
    path.push(fold);
    cur = fold;
    // bubble j2 Os to front of both arms
    for (let guard = 0; guard < 8; guard++) {
      const m = topItems(cur)
        .find((x) => x.startsWith('\\Bb'))!
        .match(/\\B(lb|b)\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/)!;
      const tItems = topItems(',' + m[3]! + ',');
      const fItems = topItems(',' + m[4]! + ',');
      if (tItems[0] === 'j_2 \\Os' && fItems[0] === 'j_2 \\Os') break;
      let progressed = false;
      for (const which of ['true', 'false'] as const) {
        const arm = which === 'true' ? tItems : fItems;
        const ji = arm.indexOf('j_2 \\Os');
        if (ji <= 0) continue;
        const nxt = swapArmAtoms(cur, which, ji - 1);
        if (nxt && justify(cur, nxt)) {
          path.push(nxt);
          cur = nxt;
          progressed = true;
          break;
        }
      }
      if (!progressed) {
        console.log('arm bubble stuck', tItems, fItems);
        break;
      }
    }
    const pulled = pullOsFromBb(cur, 'j_2 \\Os');
    if (!pulled || !justify(cur, pulled)) {
      console.log('pull fail', pulled ? justify(cur, pulled) : null, topItems(cur).find((x) => x.startsWith('\\Bb')));
      continue;
    }
    path.push(pulled);
    cur = pulled;
    if (ensure(cur) !== R0) {
      const bub = greedyBubble(cur, R0);
      if (!bub) {
        console.log('s60 bubble fail', topItems(cur), topItems(R0));
        continue;
      }
      path.push(...bub);
    }
    console.log('s60 chain', path.length);
    insert(L0, R0, path, label);
  }

  if (f.step === 61) {
    const midA = ensure(L.replace(',j \\Oc j_2,R(j_2),j_2 \\Os,', ',j \\Oc j_2,j_2 \\Os,'));
    const midB = ensure(midA.replace(',j \\Oc j_2,j_2 \\Os,', ','));
    console.log('61', justify(L, midA), justify(midA, midB), midB === ensure(f.right));
    insert(L, ensure(f.right), [midA], label);
  }
}

console.log('\ndone');
