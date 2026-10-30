/**
 * Fast pattern apply for remaining ch14 fails that match known one/two-hop rules.
 * Warms one index; tries structured candidates only; unique+next=R guard.
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
console.log('warm index…');
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

type Chain = { mids: string[]; rules: string[] };

function tryChain(L0: string, R0: string, pos: number, steps: string[]): Chain | null {
  let cur = ensure(L0);
  const R = ensure(R0);
  const mids: string[] = [];
  const rules: string[] = [];
  for (const raw of steps) {
    const next = ensure(raw);
    if (next === cur) continue;
    const j = justify(cur, next, pos);
    if (!j) return null;
    rules.push(j);
    if (next !== R) mids.push(next);
    cur = next;
  }
  if (cur !== R) {
    const j = justify(cur, R, pos);
    if (!j) return null;
    rules.push(j);
  }
  return { mids, rules };
}

function solve(f: { key: string; step: number; left: string; right: string }): Chain | null {
  const thm = parseInt(f.key.split('::')[1]!, 10);
  const pos = 13 * 100000 + thm;
  const L = ensure(f.left);
  const R = ensure(f.right);
  if (justify(L, R, pos)) return { mids: [], rules: ['direct'] };

  const attempts: string[][] = [];

  // arm Os swap both arms (13)
  attempts.push([
    L.replace(
      /\\Blb\{([^}]*)\}\{,i_1 \\Os,j_1 \\Os,\}\{,i_1 \\Os,j_1 \\Os,\}/,
      '\\Blb{$1}{,j_1 \\Os,i_1 \\Os,}{,j_1 \\Os,i_1 \\Os,}'
    ),
  ]);
  // Ot bubble (16) — two hops
  attempts.push([
    L.replace(
      /\\Blb\{([^}]*)\}\{,\\Ot m,i_1 \\Os,j_1 \\Os,\}\{,\\Ot m,i_1 \\Os,j_1 \\Os,\}/,
      '\\Blb{$1}{,i_1 \\Os,\\Ot m,j_1 \\Os,}{,i_1 \\Os,\\Ot m,j_1 \\Os,}'
    ),
    L.replace(
      /\\Blb\{([^}]*)\}\{,\\Ot m,i_1 \\Os,j_1 \\Os,\}\{,\\Ot m,i_1 \\Os,j_1 \\Os,\}/,
      '\\Blb{$1}{,i_1 \\Os,j_1 \\Os,\\Ot m,}{,i_1 \\Os,j_1 \\Os,\\Ot m,}'
    ).replace(
      /\\Blb\{([^}]*)\}\{,i_1 \\Os,\\Ot m,j_1 \\Os,\}\{,i_1 \\Os,\\Ot m,j_1 \\Os,\}/,
      '\\Blb{$1}{,i_1 \\Os,j_1 \\Os,\\Ot m,}{,i_1 \\Os,j_1 \\Os,\\Ot m,}'
    ),
  ]);
  // single hop Ot to end
  attempts.push([
    L.replace(
      /\\Blb\{([^}]*)\}\{,\\Ot m,i_1 \\Os,j_1 \\Os,\}\{,\\Ot m,i_1 \\Os,j_1 \\Os,\}/,
      '\\Blb{$1}{,i_1 \\Os,j_1 \\Os,\\Ot m,}{,i_1 \\Os,j_1 \\Os,\\Ot m,}'
    ),
  ]);

  // r-27 add/drop dup Ps
  attempts.push([
    L.replace(
      /,j_2 \\Ps j_1,R\(j_2\),R\\_\(j_1\),\\Blb/,
      ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,\\Blb'
    ),
  ]);
  attempts.push([
    L.replace(
      /,j_2 \\Ps j_1,R\(j_2\),R\\_\(j_1\),j_2 \\Ps j_1,\\Blb/,
      ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),\\Blb'
    ),
  ]);
  attempts.push([
    L.replace(
      /,i_1 \\Ps i_2,R\(i_2\),R\(i_1\),R\(j_1\),/,
      ',i_1 \\Ps i_2,R(i_2),R(i_1),i_1 \\Ps i_2,R(j_1),'
    ),
  ]);
  attempts.push([
    L.replace(
      /,i_1 \\Ps i_2,R\(i_2\),R\(i_1\),i_1 \\Ps i_2,R\(j_1\),/,
      ',i_1 \\Ps i_2,R(i_2),R(i_1),R(j_1),'
    ),
  ]);
  attempts.push([
    L.replace(
      /,j_1 \\Ps j_2,R\(j_2\),R\(j_1\),\\Bb/,
      ',j_1 \\Ps j_2,R(j_2),R(j_1),j_1 \\Ps j_2,\\Bb'
    ),
  ]);
  attempts.push([
    L.replace(
      /,j_1 \\Ps j_2,R\(j_2\),R\(j_1\),j_1 \\Ps j_2,\\Bb/,
      ',j_1 \\Ps j_2,R(j_2),R(j_1),\\Bb'
    ),
  ]);

  // copy-identical add i Ps i1 next to context for 124
  attempts.push([
    L.replace(
      /(i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,)(i \\Oc i_2,)/,
      '$1i \\Ps i_1,$2'
    ),
  ]);
  attempts.push([
    L.replace(
      /(i_1 \\nPu,i \\Ps i_1,i \\On,i_1 \\On,)(R\(i_1\),i \\Oc i_2,)/,
      '$1i \\Ps i_1,$2'
    ),
  ]);
  attempts.push([
    L.replace(
      /(i_1 \\Pu,i \\Ps i_1,i \\On,i_1 \\On,i \\Oc i_2,i \\Ps i_1,i_1 \\Ps i_2,R\(i_2\),i_1 \\Op,R\\_\(i_1\),)(R\(j_1\),)/,
      '$1i_1 \\Ps i_2,$2'
    ),
  ]);

  // drop empty Bb
  attempts.push([L.replace(/,\\Bb\{i \\Pu\}\{,\}\{,\},/, ',')]);
  attempts.push([L.replace(/j \\Oc j_1,\\Bb\{i \\Pu\}\{,\}\{,\},i \\On/, 'j \\Oc j_1,i \\On')]);

  // 200 drop i Ps i1 then i1 Pu
  attempts.push([
    L.replace(/,i \\Oc i_1,i \\Ps i_1,i_1 \\Pu,/, ',i \\Oc i_1,'),
  ]);
  attempts.push([
    L.replace(/,i \\Ps i_1,i_1 \\Pu,R\(i_1\),/, ',R(i_1),'),
  ]);
  attempts.push([
    L.replace(/,i \\Oc i_1,i \\Ps i_1,/, ',i \\Oc i_1,'),
    ensure(R),
  ]);

  // thm-R insert
  attempts.push([L.replace(/,i \\Oc i_2,i_2 \\Os,/, ',i \\Oc i_2,R(i_2),i_2 \\Os,')]);
  attempts.push([L.replace(/,i_2 \\Os,j \\Oc/, ',R(i_2),i_2 \\Os,j \\Oc')]);

  // identical-72 direct on top Ps
  attempts.push([L.replace(/,i_1 \\Ps j_1,/, ',i_1 \\Ps j_2,')]);
  attempts.push([L.replace(/,i_1 \\Ps j_2,/, ',i_1 \\Ps j_1,')]);
  attempts.push([L.replace(/\\Bb\{i_2 \\Ps j_1\}/, '\\Bb{i_2 \\Ps j_2}')]);

  // pull j2 Os from Blb (202 s11 first hop)
  attempts.push([
    L.replace(
      /\\Blb\{([^}]*)\}\{,i_1 \\Os,j_1 \\Os,j_2 \\Os,\}\{,i_1 \\Os,j_1 \\Os,j_2 \\Os,\}/,
      'j_2 \\Os,\\Blb{$1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}'
    ),
  ]);
  // pull equal i1 Os from Bb (124 s96)
  attempts.push([
    L.replace(
      /,i \\Oc i_1,j \\Oc j_1,\\Bb\{i \\Pu\}\{,i_1 \\Os,([^}]*)\}\{,i_1 \\Os,\1\},/,
      ',i \\Oc i_1,i_1 \\Os,j \\Oc j_1,\\Bb{i \\Pu}{,$1}{,$1},'
    ),
  ]);

  // push j1 Os into Blb arms (202 s3)
  attempts.push([
    L.replace(
      /,R\\_\(j_1\),j_1 \\Os,R\(i_1\),R\(j_2\),\\Blb\{i_1 \\Ps j_2\}\{,i_1 \\Os,j_2 \\Os,\}\{,i_1 \\Os,j_2 \\Os,\}/,
      ',R\\_(j_1),R(i_1),R(j_2),\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}'
    ),
  ]);

  for (const steps of attempts) {
    // rewrite second step relative to first if needed — tryChain uses absolute strings from L
    const normalized = steps.map((s, i) => (i === 0 ? s : s));
    // For 2-step Ot: compute second from first result
    if (normalized.length === 2 && normalized[0]!.includes('\\Ot m') === false && steps[0]!.includes('\\Ot')) {
      // handled below
    }
    const chain = tryChain(L, R, pos, normalized);
    if (chain) return chain;
  }

  // special 2-step Ot from mid
  {
    const mid = ensure(
      L.replace(
        /\\Blb\{([^}]*)\}\{,\\Ot m,i_1 \\Os,j_1 \\Os,\}\{,\\Ot m,i_1 \\Os,j_1 \\Os,\}/,
        '\\Blb{$1}{,i_1 \\Os,\\Ot m,j_1 \\Os,}{,i_1 \\Os,\\Ot m,j_1 \\Os,}'
      )
    );
    if (mid !== L) {
      const mid2 = ensure(
        mid.replace(
          /\\Blb\{([^}]*)\}\{,i_1 \\Os,\\Ot m,j_1 \\Os,\}\{,i_1 \\Os,\\Ot m,j_1 \\Os,\}/,
          '\\Blb{$1}{,i_1 \\Os,j_1 \\Os,\\Ot m,}{,i_1 \\Os,j_1 \\Os,\\Ot m,}'
        )
      );
      const chain = tryChain(L, R, pos, [mid, mid2]);
      if (chain) return chain;
    }
  }

  // 202 s11: pull then create-copy
  {
    const mid = ensure(
      L.replace(
        /\\Blb\{([^}]*)\}\{,i_1 \\Os,j_1 \\Os,j_2 \\Os,\}\{,i_1 \\Os,j_1 \\Os,j_2 \\Os,\}/,
        'j_2 \\Os,\\Blb{$1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}'
      )
    );
    if (mid !== L) {
      const mid2 = ensure(mid.replace(/,j \\Oc j_2,R\(j_2\),j_2 \\Os,/, ',j \\Oc j_2,j_2 \\Os,'));
      const mid3 = ensure(mid2.replace(/,j \\Oc j_2,j_2 \\Os,/, ','));
      // also try reorder first
      const reordered = ensure(
        mid.replace(
          /,i \\Oc i_1,R\(i_1\),j \\Oc j_2,j \\Oc j_1,R\(j_2\),R\\_\(j_1\),j_2 \\Os,/,
          ',i \\Oc i_1,R(i_1),j \\Oc j_2,R(j_2),j_2 \\Os,j \\Oc j_1,R\\_(j_1),'
        )
      );
      for (const seq of [
        [mid, mid2, mid3],
        [mid, reordered],
        [mid, reordered, ensure(reordered.replace(/,j \\Oc j_2,R\(j_2\),j_2 \\Os,/, ',j \\Oc j_2,j_2 \\Os,'))],
        [
          mid,
          reordered,
          ensure(reordered.replace(/,j \\Oc j_2,R\(j_2\),j_2 \\Os,/, ',j \\Oc j_2,j_2 \\Os,')),
          ensure(
            reordered
              .replace(/,j \\Oc j_2,R\(j_2\),j_2 \\Os,/, ',j \\Oc j_2,j_2 \\Os,')
              .replace(/,j \\Oc j_2,j_2 \\Os,/, ',')
          ),
        ],
      ]) {
        const chain = tryChain(L, R, pos, seq);
        if (chain) return chain;
      }
    }
  }

  return null;
}

function insert(L: string, R: string, mids: string[], label: string) {
  const finalMids = mids.filter((m) => ensure(m) !== ensure(R));
  if (!finalMids.length) {
    console.log('EMPTY', label);
    return false;
  }
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(L);
  let occ = 0;
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
    occ++;
  }
  if (occ !== 1) {
    console.log('AMBIGUOUS', label, 'occ', occ);
    return false;
  }
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
      if (fingerprint(nextJoined) !== fingerprint(R)) {
        console.log('NEXT≠R', label);
        return false;
      }
    }
    const tm = lines[end]!.match(/(\\+)\s*$/);
    const trail = tm ? tm[1]! : '\\\\\\\\';
    const block = finalMids.map((mid) => `\\Rq${bookBody(mid)}${trail}`);
    lines.splice(end + 1, 0, ...block);
    fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
    console.log('OK', label, '+' + block.length);
    return true;
  }
  console.log('NO ANCHOR', label);
  return false;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

let cleared = 0;
for (const f of fails) {
  const thm = parseInt(f.key.split('::')[1]!, 10);
  const label = `${thm} s${f.step}`;
  const t0 = Date.now();
  const chain = solve(f);
  const ms = Date.now() - t0;
  if (!chain) {
    console.log('OPEN', label, ms + 'ms');
    continue;
  }
  console.log('CHAIN', label, chain.rules.join(' → '), '+' + chain.mids.length, ms + 'ms');
  if (chain.mids.length && insert(f.left, f.right, chain.mids, label)) cleared++;
}
console.log('cleared inserts', cleared);
