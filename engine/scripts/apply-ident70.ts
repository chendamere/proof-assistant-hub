/** Apply identical-70 / arm-one / pull patterns for remaining easy fails. */
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
console.log('warm…');
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < 13 * 100000 + 202),
  new Map()
);
const memo = new Map<string, string | null>();
function justify(a: string, b: string, maxPos: number) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const key = maxPos + '|' + A + '=>' + B;
  if (memo.has(key)) return memo.get(key)!;
  let hit: string | null = null;
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.pos >= maxPos) continue;
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

function insert(L: string, R: string, mids: string[], label: string) {
  const finalMids = mids.filter((m) => ensure(m) !== ensure(R));
  if (!finalMids.length) {
    console.log('direct-ok', label);
    return true;
  }
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(L);
  let hitEnd = -1;
  let trail = '\\\\\\\\';
  let hits = 0;
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
    hits++;
    let ns = end + 1;
    while (ns < lines.length && !/\\Rq/.test(lines[ns]!) && lines[ns]!.trim()) ns++;
    let nextOk = true;
    if (ns < lines.length && /\\Rq/.test(lines[ns]!)) {
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
      if (fingerprint(nextJoined) !== fingerprint(R)) nextOk = false;
    }
    if (!nextOk) continue;
    hitEnd = end;
    const tm = lines[end]!.match(/(\\+)\s*$/);
    if (tm) trail = tm[1]!;
  }
  if (hits !== 1 || hitEnd < 0) {
    console.log('NO/AMBIG', label, 'hits', hits);
    return false;
  }
  const block = finalMids.map((mid) => `\\Rq${bookBody(mid)}${trail}`);
  lines.splice(hitEnd + 1, 0, ...block);
  fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
  console.log('OK', label, '+' + block.length);
  return true;
}

function trySeq(L0: string, R0: string, pos: number, steps: string[], label: string) {
  let cur = ensure(L0);
  const R = ensure(R0);
  const mids: string[] = [];
  const rules: string[] = [];
  for (const s of steps) {
    const next = ensure(s);
    if (next === cur) continue;
    const j = justify(cur, next, pos);
    console.log(label, j ?? 'FAIL');
    if (!j) return false;
    rules.push(j);
    if (next !== R) mids.push(next);
    cur = next;
  }
  if (cur !== R) {
    const j = justify(cur, R, pos);
    console.log(label, '→R', j ?? 'FAIL');
    if (!j) return false;
  }
  return insert(L0, R0, mids, label);
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

// Refresh L/R from fails but skip already-cleared 13/16 if still present
for (const f of fails) {
  const thm = parseInt(f.key.split('::')[1]!, 10);
  const pos = 13 * 100000 + thm;
  const L = ensure(f.left);
  const R = ensure(f.right);
  const label = `${thm} s${f.step}`;

  // identical-70 add adjacent dup Ps
  if (
    (thm === 202 && (f.step === 5 || f.step === 9)) ||
    (thm === 100 && (f.step === 11 || f.step === 15 || f.step === 31 || f.step === 33)) ||
    (thm === 124 && (f.step === 38 || f.step === 47 || f.step === 70))
  ) {
    // Find Ps atom that differs in count
    const count = (e: string, atom: string) =>
      (e.match(new RegExp(atom.replace(/[\\]/g, '\\\\'), 'g')) || []).length;
    // try duplicating each Ps present in L
    const psAtoms = [...L.matchAll(/([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)/g)].map(
      (m) => m[0]!
    );
    let done = false;
    for (const atom of new Set(psAtoms)) {
      if (count(L, atom) < count(R, atom)) {
        // add: insert second copy after first
        const mid = ensure(L.replace(atom, `${atom},${atom}`));
        // only first occurrence
        const mid2 = ensure(L.replace(`,${atom},`, `,${atom},${atom},`));
        for (const m of [mid2, mid]) {
          if (m === L) continue;
          if (justify(L, m, pos) && (m === R || justify(m, R, pos))) {
            console.log(label, 'ident70-add via', justify(L, m, pos));
            insert(L, R, m === R ? [] : [m], label);
            done = true;
            break;
          }
        }
      } else if (count(L, atom) > count(R, atom)) {
        const mid = ensure(L.replace(`,${atom},${atom},`, `,${atom},`));
        if (mid !== L && justify(L, mid, pos) && (mid === R || justify(mid, R, pos))) {
          console.log(label, 'ident70-drop', justify(L, mid, pos));
          insert(L, R, mid === R ? [] : [mid], label);
          done = true;
        }
      }
      if (done) break;
    }
    if (done) continue;
  }

  // 108 s17 / s51 identical-72
  if (thm === 108 && (f.step === 17 || f.step === 51)) {
    const mid = ensure(
      f.step === 17 ? L.replace(',i_1 \\Ps j_1,', ',i_1 \\Ps j_2,') : L.replace(',i_1 \\Ps j_2,', ',i_1 \\Ps j_1,')
    );
    if (mid !== L) {
      console.log(label, justify(L, mid, pos) ?? 'FAIL');
      if (justify(L, mid, pos) && (mid === R || justify(mid, R, pos))) {
        insert(L, R, mid === R ? [] : [mid], label);
        continue;
      }
      // flip72 path
      const flipped = ensure(L.replace('j_1 \\Ps j_2', 'j_2 \\Ps j_1'));
      // actually identical-72 needs i Ps j, Bb{j Ps m} — here top-level
      // try identical-73 style: j1 Ps j2, i1 Ps j1 → i1 Ps j2?
      // identical-73: i Ps j, j Ps m → i Ps j, i Ps m
      // We have j1 Ps j2, i1 Ps j1 → want i1 Ps j2: that's i=j1? No.
      // We have j1 Ps j2 and i1 Ps j1. Want i1 Ps j2.
      // Flip first: j2 Ps j1, then? 
      // identical-72 is Bb form. For top: use 73 with flip:
      // i1 Ps j1, j1 Ps j2 → i1 Ps j1, i1 Ps j2 then drop? Or replace.
      const via73 = ensure(L.replace(',i_1 \\Ps j_1,', ',i_1 \\Ps j_1,i_1 \\Ps j_2,'));
      console.log(label, 'via73', justify(L, via73, pos) ?? 'FAIL');
    }
  }

  // 200 s14: rev copy-identical drop i Ps i1, then drop i1 Pu?
  if (thm === 200 && f.step === 14) {
    const mid = ensure(L.replace(',i \\Oc i_1,i \\Ps i_1,i_1 \\Pu,', ',i \\Oc i_1,i_1 \\Pu,'));
    const mid2 = ensure(mid.replace(',i \\Oc i_1,i_1 \\Pu,R(i_1),', ',i \\Oc i_1,R(i_1),'));
    trySeq(L, R, pos, [mid, mid2], label);
  }

  // 124 s99 drop empty Bb — allow null-comparison-4 (empty LHS)
  if (thm === 124 && f.step === 99) {
    const mid = ensure(L.replace(',\\Bb{i \\Pu}{,}{,},', ','));
    // try with empty-LHS rules enabled
    const A = L;
    const B = mid;
    let hit: string | null = null;
    for (const rule of getRulesForTransition(index, A, B)) {
      if (rule.pos >= pos) continue;
      if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
      if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
        hit = rule.id;
        break;
      }
    }
    console.log(label, 'dropBb', hit ?? 'FAIL', mid === R || justify(mid, R, pos));
    if (hit && (mid === R || justify(mid, R, pos))) {
      insert(L, R, mid === R ? [] : [mid], label);
    }
  }

  // 124 s96 pull equal i1 Os
  if (thm === 124 && f.step === 96) {
    const mid = ensure(
      L.replace(
        ',i \\Oc i_1,j \\Oc j_1,\\Bb{i \\Pu}{,i_1 \\Os,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i_1 \\Os,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,},',
        ',i \\Oc i_1,i_1 \\Os,j \\Oc j_1,\\Bb{i \\Pu}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,},'
      )
    );
    console.log(label, justify(L, mid, pos) ?? 'FAIL', mid === R);
    if (justify(L, mid, pos) && (mid === R || justify(mid, R, pos))) {
      insert(L, R, mid === R ? [] : [mid], label);
    }
  }
}

console.log('done');
