/** 202: Blb{i1 Ps j2} → Blb{i1 Ps j1} via flip + identical-72 + flip, given j2 Ps j1. */
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
const pos = 13 * 100000 + 202;
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

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

function insert(L: string, R: string, mids: string[]) {
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
    const tm = lines[end]!.match(/(\\+)\s*$/);
    const trail = tm ? tm[1]! : '\\\\\\\\';
    const block = finalMids.map((mid) => `\\Rq${bookBody(mid)}${trail}`);
    lines.splice(end + 1, 0, ...block);
    fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
    console.log('inserted', block.length);
    return true;
  }
  console.log('NO ANCHOR');
  return false;
}

// s6 subst
{
  const f = fails.find(
    (x) =>
      x.key.includes('::202::') &&
      /\\Blb\{i_1 \\Ps j_2\}/.test(ensure(x.left)) &&
      /\\Blb\{i_1 \\Ps j_1\}/.test(ensure(x.right))
  );
  if (f) {
    const L = ensure(f.left);
    const R = ensure(f.right);
    let cur = L;
    const mids: string[] = [];
    const seq = [
      (c: string) => c.replace('\\Blb{i_1 \\Ps j_2}', '\\Blb{j_2 \\Ps i_1}'),
      (c: string) => c.replace('\\Blb{j_2 \\Ps i_1}', '\\Blb{j_1 \\Ps i_1}'),
      (c: string) => c.replace('\\Blb{j_1 \\Ps i_1}', '\\Blb{i_1 \\Ps j_1}'),
    ];
    let ok = true;
    for (let i = 0; i < seq.length; i++) {
      const next = ensure(seq[i]!(cur));
      const j = justify(cur, next);
      console.log('s6', i + 1, j ?? 'FAIL');
      if (!j) {
        ok = false;
        break;
      }
      if (next !== R) mids.push(next);
      cur = next;
    }
    if (ok) insert(L, R, mids);
  }
}

// s5 add dup j2 Ps j1 — try copy-identical style / r-27 reverse
{
  const f = fails.find(
    (x) =>
      x.key.includes('::202::') &&
      (ensure(x.left).match(/j_2 \\Ps j_1/g) ?? []).length === 1 &&
      (ensure(x.right).match(/j_2 \\Ps j_1/g) ?? []).length === 2
  );
  if (f) {
    const L = ensure(f.left);
    const R = ensure(f.right);
    const mid = L.replace(
      ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),\\Blb',
      ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,\\Blb'
    );
    console.log('s5 dup', justify(L, mid) ?? 'FAIL');
    if (justify(L, mid)) insert(L, R, mid === R ? [] : [mid]);
  }
}

// s7 drop dup
{
  const f = fails.find(
    (x) =>
      x.key.includes('::202::') &&
      (ensure(x.left).match(/j_2 \\Ps j_1/g) ?? []).length === 2 &&
      (ensure(x.right).match(/j_2 \\Ps j_1/g) ?? []).length === 1
  );
  if (f) {
    const L = ensure(f.left);
    const R = ensure(f.right);
    const mid = L.replace(',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,', ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),');
    console.log('s7 drop', justify(L, mid) ?? 'FAIL');
    if (justify(L, mid)) insert(L, R, mid === R ? [] : [mid]);
  }
}

// s9: pull j2 Os from equal arms then adjacent to j Oc j2,R(j2)
{
  const f = fails.find(
    (x) =>
      x.key.includes('::202::') &&
      /j_2 \\Os/.test(ensure(x.left)) &&
      /j \\Oc j_2,R\(j_2\),j_2 \\Os/.test(ensure(x.right))
  );
  if (f) {
    const L = ensure(f.left);
    const R = ensure(f.right);
    let cur = L;
    const mids: string[] = [];
    const seq = [
      (c: string) =>
        c.replace(
          '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}',
          'j_2 \\Os,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}'
        ),
      (c: string) =>
        c.replace(',j \\Oc j_2,j \\Oc j_1,R(j_2),R\\_(j_1),j_2 \\Os,', ',j \\Oc j_2,R(j_2),j_2 \\Os,j \\Oc j_1,R\\_(j_1),'),
    ];
    let ok = true;
    for (let i = 0; i < seq.length; i++) {
      const next = ensure(seq[i]!(cur));
      const j = justify(cur, next);
      console.log('s9', i + 1, j ?? 'FAIL');
      if (!j) {
        ok = false;
        break;
      }
      if (next !== R) mids.push(next);
      cur = next;
    }
    console.log('s9 ok', cur === R || !!justify(cur, R));
    if (ok && (cur === R || justify(cur, R))) insert(L, R, mids);
  }
}
