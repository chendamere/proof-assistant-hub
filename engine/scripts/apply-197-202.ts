/** Apply chains for 197 s86 and 202 s67. */
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

function insertAt(L: string, mids: string[], label: string) {
  if (!mids.length) return 0;
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
    if (fingerprint(joined) === want) {
      const tm = lines[end]!.match(/(\\+)\s*$/);
      const trail = tm ? tm[1]! : '\\\\\\\\';
      const block = mids.map((mid) => `\\Rq${bookBody(mid)}${trail}`);
      lines.splice(end + 1, 0, ...block);
      fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
      console.log('inserted', block.length, label);
      return block.length;
    }
  }
  console.log('NO ANCHOR', label);
  return 0;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

// --- 197: fold Oc + Blb{j Ps i}{Os}{Os} → Blb{i Ps j}{,}{,} ---
{
  const f = fails.find((x) => x.key.includes('::197::'));
  if (f) {
    const pos = 13 * 100000 + 197;
    const L = ensure(f.left);
    const R = ensure(f.right);
    let cur = L;
    const mids: string[] = [];
    const hop = (nextRaw: string, label: string) => {
      const next = ensure(nextRaw);
      const j = justify(cur, next, pos);
      console.log('197', label, j ?? 'FAIL');
      if (!j) throw new Error('197 ' + label);
      if (next !== R) mids.push(next);
      cur = next;
    };
    // flip condition
    hop(cur.replace('\\Blb{j \\Ps i}', '\\Blb{i \\Ps j}'), 'flip');
    // pull equal Os from arms: Blb{i Ps j}{,j_1 Os,i_1 Os,}{,i_1 Os,j_1 Os,} 
    // first bubble arms to equal order i_1 Os, j_1 Os
    {
      const m = cur.match(/\\Blb\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/)!;
      // true: j_1 Os, i_1 Os → i_1 Os, j_1 Os
      if (m[2] === 'j_1 \\Os,i_1 \\Os,') {
        hop(
          cur.replace(`\\Blb{${m[1]}}{,${m[2]}}{,${m[3]}}`, `\\Blb{${m[1]}}{,i_1 \\Os,j_1 \\Os,}{,${m[3]}}`),
          'true Os swap'
        );
      }
    }
    // pull i_1 Os, j_1 Os if equal
    {
      const pulled = ensure(
        cur.replace(
          /\\Blb\{([^}]*)\}\{,i_1 \\Os,j_1 \\Os,\}\{,i_1 \\Os,j_1 \\Os,\}/,
          'i_1 \\Os,j_1 \\Os,\\Blb{$1}{,}{,}'
        )
      );
      if (pulled !== cur) hop(pulled, 'pull Os');
    }
    // drop Oc via reverse of create-copy / connectivity? Try fold with reverse connectivity-0 style
    // Without R: maybe reverse of something simpler - drop i Oc i_1 with i_1 Os via release-copy?
    console.log('try drop Oc+Os', justify(cur, ensure(',i \\Pu,j \\Pu,\\Blb{i \\Ps j}{,}{,}'), pos));
    // reverse copy-identical doesn't drop Oc. Try: i Oc i_1, i_1 Os → ? 
    console.log(
      'release-copy?',
      justify(ensure(',i \\Oc i_1,i_1 \\Os,'), ensure(','), pos)
    );
    console.log('cur', cur);
    console.log('R  ', R);
    // If we can get to R, insert
    if (cur === R || justify(cur, R, pos)) {
      insertAt(L, mids.filter((m) => ensure(m) !== R), '197');
    }
  }
}

// --- 202: strip j Oc j_2 / R(j_2) / j_2 Os from both Blb arms ---
{
  const f = fails.find((x) => x.key.includes('::202::'));
  if (f) {
    const pos = 13 * 100000 + 202;
    const L = ensure(f.left);
    const R = ensure(f.right);
    let cur = L;
    const mids: string[] = [];
    const hop = (nextRaw: string, label: string) => {
      const next = ensure(nextRaw);
      const j = justify(cur, next, pos);
      console.log('202', label, j ?? 'FAIL');
      if (!j) throw new Error('202 ' + label);
      if (next !== R) mids.push(next);
      cur = next;
    };
    // Reorder true arm: move j Oc j_2, j_2 Os together then fold reverse Oc?
    // Simpler: bubble j Oc j_2 to front of both arms, pull if equal, then drop with reverse create
    // true: i_1 Os, j_1 Os, j Oc j_2, j_2 Os
    // false: j Oc j_2, R(j_2), j_1 Os, j_2 Os, i_1 Os
    // First make false arm match a foldable form: j Oc j_2, R(j_2), j_2 Os, ...
    // Try one-shot if justify accepts arm cleanup via multiple - unlikely.
    // Bubble true: j Oc j_2 left past Os
    for (let step = 0; step < 4; step++) {
      const m = cur.match(/\\Blb\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/)!;
      const arm = m[2]!;
      if (arm.startsWith('j \\Oc j_2,')) break;
      const toks = arm.replace(/,$/, '').split(',');
      const ji = toks.findIndex((t) => t === 'j \\Oc j_2');
      if (ji <= 0) break;
      const sw = toks.slice();
      [sw[ji - 1], sw[ji]] = [sw[ji]!, sw[ji - 1]!];
      const newArm = sw.join(',') + ',';
      hop(
        cur.replace(`\\Blb{${m[1]}}{,${arm}}{,${m[3]}}`, `\\Blb{${m[1]}}{,${newArm}}{,${m[3]}}`),
        `true bubble ${step}`
      );
    }
    console.log('202 cur', cur);
    console.log('202 R  ', R);
    if (cur === R || justify(cur, R, pos)) insertAt(L, mids.filter((m) => ensure(m) !== R), '202');
  }
}
