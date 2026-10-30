/**
 * Apply known special chains for 197 (Oc/Os fold) and 202 (strip Oc/R/Os)
 * by matching fail L patterns rather than step numbers.
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

function insertMids(L: string, mids: string[], R: string, label: string) {
  const finalMids = mids.filter((m) => ensure(m) !== ensure(R));
  if (!finalMids.length && justify(L, R, 13 * 100000 + 202)) {
    console.log(label, 'direct ok');
    return;
  }
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(L);
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
    // next must match R
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
    if (fingerprint(nextJoined) !== fingerprint(R)) {
      console.log(label, 'anchor hit but next≠R, try next occ');
      continue;
    }
    const tm = lines[end]!.match(/(\\+)\s*$/);
    const trail = tm ? tm[1]! : '\\\\\\\\';
    const block = finalMids.map((mid) => `\\Rq${bookBody(mid)}${trail}`);
    lines.splice(end + 1, 0, ...block);
    fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
    console.log(label, 'inserted', block.length);
    return;
  }
  console.log(label, 'NO ANCHOR hits', hits);
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

// --- 197: Blb{j Ps i}{Os}{Os} fold ---
{
  const f = fails.find(
    (x) =>
      x.key.includes('::197::') &&
      /\\Blb\{j \\Ps i\}/.test(x.left) &&
      /\\Blb\{i \\Ps j\}\{,\}\{,\}/.test(ensure(x.right))
  );
  if (!f) console.log('197 fold pattern not in fails');
  else {
    const pos = 13 * 100000 + 197;
    const L = ensure(f.left);
    const R = ensure(f.right);
    let cur = L;
    const mids: string[] = [];
    const hops: [string, string][] = [
      [cur.replace('\\Blb{j \\Ps i}', '\\Blb{i \\Ps j}'), 'flip'],
      [
        cur
          .replace('\\Blb{j \\Ps i}', '\\Blb{i \\Ps j}')
          .replace(
            '\\Blb{i \\Ps j}{,j_1 \\Os,i_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}',
            '\\Blb{i \\Ps j}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}'
          ),
        'equalize',
      ],
    ];
    // rebuild sequentially
    const seq = [
      (c: string) => c.replace('\\Blb{j \\Ps i}', '\\Blb{i \\Ps j}'),
      (c: string) =>
        c.replace(
          '\\Blb{i \\Ps j}{,j_1 \\Os,i_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}',
          '\\Blb{i \\Ps j}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}'
        ),
      (c: string) =>
        c.replace(
          '\\Blb{i \\Ps j}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}',
          'i_1 \\Os,\\Blb{i \\Ps j}{,j_1 \\Os,}{,j_1 \\Os,}'
        ),
      (c: string) => c.replace('\\Blb{i \\Ps j}{,j_1 \\Os,}{,j_1 \\Os,}', 'j_1 \\Os,\\Blb{i \\Ps j}{,}{,}'),
      (c: string) => c.replace('i \\Oc i_1,j \\Oc j_1,i_1 \\Os', 'i \\Oc i_1,i_1 \\Os,j \\Oc j_1'),
      (c: string) => c.replace('i \\Oc i_1,i_1 \\Os,', ''),
      (c: string) => c.replace('j \\Oc j_1,j_1 \\Os,', ''),
    ];
    void hops;
    let ok = true;
    for (let i = 0; i < seq.length; i++) {
      const next = ensure(seq[i]!(cur));
      const j = justify(cur, next, pos);
      console.log('197', i + 1, j ?? 'FAIL');
      if (!j) {
        ok = false;
        break;
      }
      if (next !== R) mids.push(next);
      cur = next;
    }
    if (ok && (cur === R || justify(cur, R, pos))) insertMids(L, mids, R, '197');
    else console.log('197 incomplete', cur.slice(0, 80));
  }
}

// --- 202: strip j Oc j2 / R / Os from arms ---
{
  const f = fails.find(
    (x) =>
      x.key.includes('::202::') &&
      /j \\Oc j_2/.test(x.left) &&
      /\\Blb\{i_1 \\Ps j_1\}\{,i_1 \\Os,j_1 \\Os,\}\{,i_1 \\Os,j_1 \\Os,\}/.test(ensure(x.right))
  );
  if (!f) console.log('202 strip pattern not in fails');
  else {
    const pos = 13 * 100000 + 202;
    const L = ensure(f.left);
    const R = ensure(f.right);
    let cur = L;
    const mids: string[] = [];
    const seq = [
      (c: string) => c.replace('{,i_1 \\Os,j_1 \\Os,j \\Oc j_2,j_2 \\Os,}', '{,i_1 \\Os,j_1 \\Os,}'),
      (c: string) =>
        c.replace(
          '{,j \\Oc j_2,R(j_2),j_1 \\Os,j_2 \\Os,i_1 \\Os,}',
          '{,j \\Oc j_2,R(j_2),j_2 \\Os,j_1 \\Os,i_1 \\Os,}'
        ),
      (c: string) => c.replace('{,j \\Oc j_2,R(j_2),j_2 \\Os,', '{,j \\Oc j_2,j_2 \\Os,'),
      (c: string) => c.replace('{,j \\Oc j_2,j_2 \\Os,j_1 \\Os,i_1 \\Os,}', '{,j_1 \\Os,i_1 \\Os,}'),
      (c: string) => c.replace('{,j_1 \\Os,i_1 \\Os,}', '{,i_1 \\Os,j_1 \\Os,}'),
    ];
    let ok = true;
    for (let i = 0; i < seq.length; i++) {
      const next = ensure(seq[i]!(cur));
      const j = justify(cur, next, pos);
      console.log('202', i + 1, j ?? 'FAIL');
      if (!j) {
        ok = false;
        break;
      }
      if (next !== R) mids.push(next);
      cur = next;
    }
    if (ok && (cur === R || justify(cur, R, pos))) insertMids(L, mids, R, '202');
    else console.log('202 incomplete');
  }
}

// --- 124 s22-style: add Pu/nPu flags ---
{
  const f = fails.find(
    (x) =>
      x.key.includes('::124::') &&
      /\\Bb\{i \\Pu\}\{,i \\Ps i_1/.test(ensure(x.left)) &&
      /\\Bb\{i \\Pu\}\{,i \\Pu,i \\Ps i_1/.test(ensure(x.right))
  );
  if (!f) console.log('124 flags pattern not in fails');
  else {
    const pos = 13 * 100000 + 124;
    const L = ensure(f.left);
    const R = ensure(f.right);
    let cur = L;
    const mids: string[] = [];
    const mid1 = ensure(cur.replace('\\Bb{i \\Pu}{,i \\Ps i_1,', '\\Bb{i \\Pu}{,i \\Pu,i \\Ps i_1,'));
    console.log('124 flags1', justify(cur, mid1, pos) ?? 'FAIL');
    if (justify(cur, mid1, pos)) {
      mids.push(mid1);
      cur = mid1;
    }
    const mid2 = ensure(
      cur.replace(
        '}{,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),}',
        '}{,i \\nPu,i \\Ps i_1,i \\On,i \\Oc i_2,R(i_1),R(j_1),i_1 \\Ps j_1,R(i_2),}'
      )
    );
    console.log('124 flags2', justify(cur, mid2, pos) ?? 'FAIL');
    if (justify(cur, mid2, pos)) {
      if (mid2 !== R) mids.push(mid2);
      cur = mid2;
    }
    if (cur === R || justify(cur, R, pos)) insertMids(L, mids, R, '124flags');
  }
}
