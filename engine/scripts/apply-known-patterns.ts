/** Apply known solvable patterns from current recheck. */
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
const indexCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let ix = indexCache.get(pos);
  if (!ix) {
    ix = buildRuleIndex(
      allRules.filter((r) => r.pos < pos),
      new Map()
    );
    indexCache.set(pos, ix);
  }
  return ix;
}
function justify(a: string, b: string, pos: number) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function insertAt(L: string, mids: string[], R: string, label: string, thm: number) {
  const finalMids = mids.filter((m) => ensure(m) !== ensure(R));
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(L);
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
    const tm = lines[end]!.match(/(\\+)\s*$/);
    const trail = tm ? tm[1]! : '\\\\\\\\';
    const block = finalMids.map((mid) => `\\Rq${bookBody(mid)}${trail}`);
    lines.splice(end + 1, 0, ...block);
    fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
    console.log('OK', label, 'thm', thm, '+' + block.length);
    return true;
  }
  console.log('NO ANCHOR', label);
  return false;
}

function runChain(
  label: string,
  thm: number,
  L0: string,
  R0: string,
  steps: Array<(c: string) => string>
) {
  const pos = 13 * 100000 + thm;
  let cur = ensure(L0);
  const R = ensure(R0);
  const mids: string[] = [];
  for (let i = 0; i < steps.length; i++) {
    const next = ensure(steps[i]!(cur));
    const j = justify(cur, next, pos);
    console.log(label, i + 1, j ?? 'FAIL');
    if (!j) return false;
    if (next !== R) mids.push(next);
    cur = next;
  }
  if (!(cur === R || justify(cur, R, pos))) {
    console.log(label, 'incomplete');
    return false;
  }
  return insertAt(L0, mids, R0, label, thm);
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

// 124 drop flags (s90): reverse null-52/53
{
  const f = fails.find(
    (x) =>
      x.key.includes('::124::') &&
      /\\Bb\{i \\Pu\}\{,i \\Pu,/.test(ensure(x.left)) &&
      /\\Bb\{i \\Pu\}\{,i \\Ps/.test(ensure(x.right)) &&
      !/i \\nPu/.test(ensure(x.right))
  );
  if (f) {
    runChain('124-drop-flags', 124, f.left, f.right, [
      (c) =>
        c.replace(
          '\\Bb{i \\Pu}{,i \\Pu,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i \\nPu,i \\Ps i_1,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}',
          '\\Bb{i \\Pu}{,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i \\nPu,i \\Ps i_1,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}'
        ),
      (c) =>
        c.replace(
          '\\Bb{i \\Pu}{,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i \\nPu,i \\Ps i_1,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}',
          '\\Bb{i \\Pu}{,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}{,i \\Ps i_1,R(i_1),i \\On,i \\Oc i_2,R(i_2),R(j_1),i_2 \\Ps j_1,}'
        ),
    ]);
  } else console.log('skip 124-drop-flags');
}

// 124 drop empty Bb (s96)
{
  const f = fails.find(
    (x) =>
      x.key.includes('::124::') &&
      /\\Bb\{i \\Pu\}\{,\}\{,\}/.test(ensure(x.left)) &&
      !/\\Bb\{/.test(ensure(x.right))
  );
  if (f) {
    runChain('124-drop-empty-bb', 124, f.left, f.right, [
      (c) => c.replace(',\\Bb{i \\Pu}{,}{,},', ','),
    ]);
  } else console.log('skip 124-drop-empty-bb');
}

// 197 s22: pull Os from equal Blb arms
{
  const f = fails.find(
    (x) =>
      x.key.includes('::197::') &&
      /\\Blb\{i \\Ps j\}\{,i_1 \\Os,j_1 \\Os,\}\{,i_1 \\Os,j_1 \\Os,\}/.test(ensure(x.left)) &&
      /\\Blb\{i \\Ps j\}\{,\}\{,\}/.test(ensure(x.right))
  );
  if (f) {
    runChain('197-pull-os', 197, f.left, f.right, [
      (c) =>
        c.replace(
          '\\Blb{i \\Ps j}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}',
          'i_1 \\Os,\\Blb{i \\Ps j}{,j_1 \\Os,}{,j_1 \\Os,}'
        ),
      (c) => c.replace('\\Blb{i \\Ps j}{,j_1 \\Os,}{,j_1 \\Os,}', 'j_1 \\Os,\\Blb{i \\Ps j}{,}{,}'),
      (c) => c.replace('i \\Oc i_1,j \\Oc j_1,i_1 \\Os', 'i \\Oc i_1,i_1 \\Os,j \\Oc j_1'),
    ]);
  } else console.log('skip 197-pull-os');
}

// 202 s10: drop j Oc j2, R(j2), j2 Os at top
{
  const f = fails.find(
    (x) =>
      x.key.includes('::202::') &&
      /j \\Oc j_2,R\(j_2\),j_2 \\Os/.test(ensure(x.left)) &&
      !/j_2/.test(ensure(x.right))
  );
  if (f) {
    runChain('202-drop-j2', 202, f.left, f.right, [
      (c) => c.replace(',j \\Oc j_2,R(j_2),j_2 \\Os,', ',j \\Oc j_2,j_2 \\Os,'),
      (c) => c.replace(',j \\Oc j_2,j_2 \\Os,', ','),
    ]);
  } else console.log('skip 202-drop-j2');
}

// 195: drop j Ps i1 via identical-73 path (simplified attempts)
{
  const f = fails.find((x) => x.key.includes('::195::') && /j \\Ps i_1/.test(x.left));
  if (f) {
    const pos = 13 * 100000 + 195;
    const L = ensure(f.left);
    const R = ensure(f.right);
    // Try direct shrinks
    const cands = [
      L.replace(',j \\Ps i_1,', ',').replace(',i_1 \\Ps j_1,i_1 \\Ps j_1,', ',i_1 \\Ps j_1,'),
      L.replace(',j \\Ps i_1,i_1 \\Ps j_1,', ',i_1 \\Ps j_1,'),
      L.replace(',i \\Oc i_1,i \\Ps j,', ',i \\Ps j,i \\Oc i_1,'),
    ];
    for (const c of cands) {
      const j = justify(L, ensure(c), pos);
      console.log('195 cand', j ?? 'FAIL');
      if (j) {
        const mids = ensure(c) === R ? [] : [ensure(c)];
        if (ensure(c) === R || justify(ensure(c), R, pos)) {
          insertAt(L, mids, R, '195', 195);
          break;
        }
      }
    }
  }
}
