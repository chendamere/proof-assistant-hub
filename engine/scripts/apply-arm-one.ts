/** One-arm-at-a-time Os/Ot reorder for 13 and 16. */
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
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < 13 * 100000 + 202),
  new Map()
);
function justify(a: string, b: string, maxPos: number) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.pos >= maxPos) continue;
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function insert(L: string, R: string, mids: string[], label: string) {
  const finalMids = mids.filter((m) => ensure(m) !== ensure(R));
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(L);
  let hits = 0;
  let hitEnd = -1;
  let trail = '\\\\\\\\';
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
      if (fingerprint(nextJoined) !== fingerprint(R)) continue;
    }
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

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

// 13 s4
{
  const f = fails.find((x) => x.key.includes('::13::') && x.step === 4);
  if (f) {
    const pos = 13 * 100000 + 13;
    const L = ensure(f.left);
    const mid = ensure(
      L.replace(
        '\\Blb{j_1 \\Ps i_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}',
        '\\Blb{j_1 \\Ps i_1}{,j_1 \\Os,i_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}'
      )
    );
    const R = ensure(f.right);
    console.log('13 true', justify(L, mid, pos));
    console.log('13 false', justify(mid, R, pos));
    if (justify(L, mid, pos) && justify(mid, R, pos)) {
      insert(L, R, [mid], '13 s4');
    }
  }
}

// 16 s8 — Ot past each Os, one arm at a time, then other arm
{
  const f = fails.find((x) => x.key.includes('::16::') && x.step === 8);
  if (f) {
    const pos = 13 * 100000 + 16;
    const L = ensure(f.left);
    const R = ensure(f.right);
    // Path: true Ot past i1 Os; true Ot past j1 Os; false Ot past i1; false Ot past j1
    const steps = [
      L.replace(
        '\\Blb{i_1 \\Ps j_1}{,\\Ot m,i_1 \\Os,j_1 \\Os,}{,\\Ot m,i_1 \\Os,j_1 \\Os,}',
        '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,\\Ot m,j_1 \\Os,}{,\\Ot m,i_1 \\Os,j_1 \\Os,}'
      ),
    ];
    steps.push(
      steps[0]!.replace(
        '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,\\Ot m,j_1 \\Os,}{,\\Ot m,i_1 \\Os,j_1 \\Os,}',
        '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Ot m,}{,\\Ot m,i_1 \\Os,j_1 \\Os,}'
      )
    );
    steps.push(
      steps[1]!.replace(
        '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Ot m,}{,\\Ot m,i_1 \\Os,j_1 \\Os,}',
        '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Ot m,}{,i_1 \\Os,\\Ot m,j_1 \\Os,}'
      )
    );
    steps.push(
      steps[2]!.replace(
        '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Ot m,}{,i_1 \\Os,\\Ot m,j_1 \\Os,}',
        '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Ot m,}{,i_1 \\Os,j_1 \\Os,\\Ot m,}'
      )
    );
    let cur = L;
    const mids: string[] = [];
    let ok = true;
    for (let i = 0; i < steps.length; i++) {
      const next = ensure(steps[i]!);
      const j = justify(cur, next, pos);
      console.log('16', i + 1, j ?? 'FAIL');
      if (!j) {
        ok = false;
        break;
      }
      if (next !== R) mids.push(next);
      cur = next;
    }
    if (ok && (cur === R || justify(cur, R, pos))) insert(L, R, mids, '16 s8');
  }
}

// 202 s5: try r-prev-32 needs both R_; try converting; try r-27 after making both R
{
  const f = fails.find((x) => x.key.includes('::202::') && x.step === 5);
  if (f) {
    const pos = 13 * 100000 + 202;
    const L = ensure(f.left);
    const R = ensure(f.right);
    console.log('202 s5 L', L);
    console.log('202 s5 R', R);
    // direct candidates
    const cands = [
      L.replace(
        ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),\\Blb',
        ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,\\Blb'
      ),
      L.replace(
        ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),',
        ',j_2 \\Ps j_1,R(j_2),R(j_1),'
      ),
      L.replace('R\\_(j_1)', 'R(j_1)'),
    ];
    for (const c of cands) {
      const e = ensure(c);
      if (e === L) continue;
      console.log('cand', justify(L, e, pos) ?? 'FAIL', e.slice(0, 100));
    }
  }
}

// 202 s9 drop
{
  const f = fails.find((x) => x.key.includes('::202::') && x.step === 9);
  if (f) {
    const pos = 13 * 100000 + 202;
    const L = ensure(f.left);
    const R = ensure(f.right);
    const mid = ensure(
      L.replace(
        ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,\\Blb',
        ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),\\Blb'
      )
    );
    console.log('202 s9', justify(L, mid, pos) ?? 'FAIL', mid === R);
  }
}

// 124 s99 drop empty Bb
{
  const f = fails.find((x) => x.key.includes('::124::') && x.step === 99);
  if (f) {
    const pos = 13 * 100000 + 124;
    const L = ensure(f.left);
    const R = ensure(f.right);
    const mid = ensure(L.replace(',\\Bb{i \\Pu}{,}{,},', ','));
    console.log('124 s99', justify(L, mid, pos) ?? 'FAIL');
    console.log('  mid→R', mid === R || justify(mid, R, pos));
    if (justify(L, mid, pos) && (mid === R || justify(mid, R, pos))) {
      insert(L, R, mid === R ? [] : [mid], '124 s99');
    }
  }
}
