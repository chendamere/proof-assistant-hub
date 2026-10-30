/**
 * Clear ch14 fails for theorems 13, 16, 202 by inserting justified \Rq mids.
 * Safety: fingerprint after stripDisplayIfConditions; unique left + next==right;
 * skip error-code / empty-LHS identical-4; earlier rules only.
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
const failPath = path.join(__dirname, 'out/recheck-ch14.jsonl');

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

console.log('loading rules…');
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
const preferRe =
  /swap-release|swap-temp|identical-node-comparison-1[45678]|identical-node-comparison-70|recursive-function-r-|create-copy|thm-R-i-release/;
const preferCache = new Map<number, typeof allRules>();
function preferBefore(pos: number) {
  let p = preferCache.get(pos);
  if (!p) {
    p = allRules.filter((r) => r.pos < pos && preferRe.test(r.id));
    preferCache.set(pos, p);
  }
  return p;
}
const memo = new Map<string, string | null>();
function justify(a: string, b: string, pos: number) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const key = pos + '|' + A + '=>' + B;
  if (memo.has(key)) return memo.get(key)!;
  const index = indexBefore(pos);
  for (const rule of preferBefore(pos)) {
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
      memo.set(key, rule.id);
      return rule.id;
    }
  }
  let hit: string | null = null;
  for (const rule of getRulesForTransition(index, A, B)) {
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

function parseArm(arm: string): string[] {
  return arm
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .split(/\s*,\s*/)
    .filter(Boolean);
}
function swapArm(expr: string, which: 't' | 'f', i: number): string {
  const m = expr.match(/\\B(lb|b)\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/)!;
  const t = parseArm(m[3]!);
  const f = parseArm(m[4]!);
  const sw = which === 't' ? t : f;
  [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
  return ensure(expr.replace(m[0]!, `\\B${m[1]}{${m[2]}}{,${t.join(',')},}{,${f.join(',')},}`));
}
function topItems(e: string): string[] {
  const s = ensure(e);
  const items: string[] = [];
  let depth = 0;
  let start = 0;
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
function swapAdj(e: string, i: number) {
  const items = topItems(e);
  const sw = items.slice();
  [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
  return joinItems(sw);
}
function orderDist(A: string[], B: string[]) {
  let d = Math.abs(A.length - B.length) * 3;
  const used = new Map<string, number>();
  for (let i = 0; i < A.length; i++) {
    const slots: number[] = [];
    for (let j = 0; j < B.length; j++) if (B[j] === A[i]) slots.push(j);
    const k = used.get(A[i]!) ?? 0;
    const j = k < slots.length ? slots[k]! : B.length + k;
    used.set(A[i]!, k + 1);
    d += Math.abs(i - j);
  }
  return d;
}

function hop(
  cur: string,
  nextRaw: string,
  pos: number,
  mids: string[],
  rules: string[],
  R: string,
  label: string
): string {
  const next = ensure(nextRaw);
  const j = justify(cur, next, pos);
  if (!j) throw new Error(`${label} FAIL\n from ${cur}\n to   ${next}`);
  rules.push(j);
  console.log(' ', label, j);
  if (next !== R) mids.push(next);
  return next;
}

function greedyTopReorder(cur0: string, R: string, pos: number, mids: string[], rules: string[], max = 24) {
  let cur = cur0;
  const goal = topItems(R);
  for (let step = 0; step < max && cur !== R; step++) {
    if (justify(cur, R, pos)) return cur;
    const items = topItems(cur);
    const startD = orderDist(items, goal);
    let best: { e: string; d: number; rule: string } | null = null;
    for (let i = 0; i < items.length - 1; i++) {
      const e = swapAdj(cur, i);
      const d = orderDist(topItems(e), goal);
      if (d > startD) continue;
      const rule = justify(cur, e, pos);
      if (!rule) continue;
      if (!best || d < best.d) best = { e, d, rule };
    }
    if (!best) break;
    rules.push(best.rule);
    console.log('  reorder', best.rule, 'd', best.d);
    if (best.e !== R) mids.push(best.e);
    cur = best.e;
  }
  return cur;
}

type Job = { after: number; trail: string; mids: string[]; label: string; rules: string[] };

function findAnchor(L: string, R: string): { after: number; trail: string } | null {
  const raw = fs.readFileSync(texPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  const want = fingerprint(L);
  const wantR = fingerprint(R);
  const hits: number[] = [];
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
    hits.push(i);
    // require next \Rq fingerprints to R
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
    return { after: end, trail: tm ? tm[1]! : '\\\\\\\\' };
  }
  if (hits.length !== 1) {
    console.log('ANCHOR ambiguity hits=', hits.length, 'want unique+nextR');
  }
  return null;
}

const fails = fs
  .readFileSync(failPath, 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((x) => /::(13|16|202)::/.test(x.key));

const jobs: Job[] = [];
const report: Array<{ label: string; rules: string[]; ok: boolean; err?: string }> = [];

for (const f of fails) {
  const thm = parseInt(f.key.split('::')[1]!, 10);
  const pos = 13 * 100000 + thm;
  const L = ensure(f.left);
  const R = ensure(f.right);
  const label = `${thm} s${f.step}`;
  console.log('\n====', label, '====');
  const mids: string[] = [];
  const rules: string[] = [];
  try {
    let cur = L;

    if (thm === 13 && f.step === 4) {
      // one arm swap; other arm justified as final hop to R
      cur = hop(cur, swapArm(cur, 't', 0), pos, mids, rules, R, 'true-arm Os swap');
    }

    if (thm === 16 && f.step === 8) {
      for (const [w, i] of [
        ['t', 0],
        ['t', 1],
        ['f', 0],
        ['f', 1],
      ] as const) {
        cur = hop(cur, swapArm(cur, w, i), pos, mids, rules, R, `${w}@${i}`);
      }
    }

    if (thm === 202 && f.step === 3) {
      // reorder top so j1 Os sits before Blb in final order, then identical-15 push (prepend), then arm swaps
      const targetTop = [
        'i \\Oc i_1',
        'R(i_1)',
        'j \\Oc j_2',
        'j \\Oc j_1',
        'R(j_2)',
        'R\\_(j_1)',
        'j_1 \\Os',
        '\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_2 \\Os,}',
      ];
      for (let step = 0; step < 24; step++) {
        if (topItems(cur).join('|') === targetTop.join('|')) break;
        const items = topItems(cur);
        const startD = orderDist(items, targetTop);
        let best: { e: string; d: number; rule: string } | null = null;
        for (let i = 0; i < items.length - 1; i++) {
          const e = swapAdj(cur, i);
          const d = orderDist(topItems(e), targetTop);
          if (d > startD) continue;
          const rule = justify(cur, e, pos);
          if (!rule) continue;
          if (!best || d < best.d) best = { e, d, rule };
        }
        if (!best) throw new Error('s3 reorder stuck ' + topItems(cur).join('|'));
        rules.push(best.rule);
        console.log('  pre', best.rule, 'd', best.d);
        if (best.e !== R) mids.push(best.e);
        cur = best.e;
      }
      cur = hop(
        cur,
        cur.replace(
          ',j_1 \\Os,\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_2 \\Os,}',
          ',\\Blb{i_1 \\Ps j_2}{,j_1 \\Os,i_1 \\Os,j_2 \\Os,}{,j_1 \\Os,i_1 \\Os,j_2 \\Os,}'
        ),
        pos,
        mids,
        rules,
        R,
        'identical-15 push'
      );
      cur = hop(cur, swapArm(cur, 't', 0), pos, mids, rules, R, 'arm true j1/i1');
      cur = hop(cur, swapArm(cur, 'f', 0), pos, mids, rules, R, 'arm false j1/i1');
    }

    if (thm === 202 && f.step === 5) {
      // identical-70: dup Ps adjacent, then bubble second copy past R(j2), R_(j1)
      cur = hop(
        cur,
        cur.replace(',j_2 \\Ps j_1,R(j_2),', ',j_2 \\Ps j_1,j_2 \\Ps j_1,R(j_2),'),
        pos,
        mids,
        rules,
        R,
        'identical-70 dup'
      );
      // bubble second j2 Ps j1 rightward: currently ...Ps, Ps, R(j2), R_(j1), Blb
      // want ...Ps, R(j2), R_(j1), Ps, Blb
      for (let k = 0; k < 2; k++) {
        const items = topItems(cur);
        // find second occurrence of j2 Ps j1
        let seen = 0;
        let idx = -1;
        for (let i = 0; i < items.length; i++) {
          if (items[i] === 'j_2 \\Ps j_1') {
            seen++;
            if (seen === 2) {
              idx = i;
              break;
            }
          }
        }
        if (idx < 0 || idx >= items.length - 1) throw new Error('no second Ps to bubble');
        cur = hop(cur, swapAdj(cur, idx), pos, mids, rules, R, 'bubble dup Ps ' + (k + 1));
      }
    }

    if (thm === 202 && f.step === 9) {
      // reverse of s5: bubble trailing dup left next to first, then drop via identical-70 reverse
      // L: ...Ps, R(j2), R_(j1), Ps, Blb  →  ...Ps, Ps, R(j2), R_(j1), Blb  → drop
      for (let k = 0; k < 2; k++) {
        const items = topItems(cur);
        let seen = 0;
        let idx = -1;
        for (let i = 0; i < items.length; i++) {
          if (items[i] === 'j_2 \\Ps j_1') {
            seen++;
            if (seen === 2) {
              idx = i;
              break;
            }
          }
        }
        if (idx <= 0) throw new Error('no second Ps');
        cur = hop(cur, swapAdj(cur, idx - 1), pos, mids, rules, R, 'bubble dup left ' + (k + 1));
      }
      cur = hop(
        cur,
        cur.replace(',j_2 \\Ps j_1,j_2 \\Ps j_1,', ',j_2 \\Ps j_1,'),
        pos,
        mids,
        rules,
        R,
        'identical-70 drop'
      );
    }

    if (thm === 202 && f.step === 11) {
      // bubble j2 Os to front of both arms (identical-15 pulls leading arm atom)
      // arms: i1 Os, j1 Os, j2 Os → j2 Os, i1 Os, j1 Os via two adjacent swaps per arm
      for (const which of ['t', 'f'] as const) {
        // swap index 1 (j1 with j2): i1,j1,j2 → i1,j2,j1
        cur = hop(cur, swapArm(cur, which, 1), pos, mids, rules, R, `arm ${which} j1/j2`);
        // swap index 0 (i1 with j2): i1,j2,j1 → j2,i1,j1
        cur = hop(cur, swapArm(cur, which, 0), pos, mids, rules, R, `arm ${which} i1/j2`);
      }
      cur = hop(
        cur,
        cur.replace(
          '\\Blb{i_1 \\Ps j_1}{,j_2 \\Os,i_1 \\Os,j_1 \\Os,}{,j_2 \\Os,i_1 \\Os,j_1 \\Os,}',
          'j_2 \\Os,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}'
        ),
        pos,
        mids,
        rules,
        R,
        'identical-15 pull'
      );
      cur = greedyTopReorder(cur, R, pos, mids, rules);
    }

    const fin = cur === R || !!justify(cur, R, pos);
    if (!fin) throw new Error('incomplete\n cur ' + cur + '\n R   ' + R);
    if (cur !== R) {
      const j = justify(cur, R, pos)!;
      rules.push(j);
      console.log('  final', j);
    }
    console.log('OK', label, 'mids', mids.length, 'rules', rules);

    const anchor = findAnchor(L, R);
    if (!anchor) throw new Error('NO ANCHOR');
    // uniqueness of left fingerprint
    {
      const raw = fs.readFileSync(texPath, 'utf8');
      const lines = raw.split(/\r?\n/);
      const want = fingerprint(L);
      let count = 0;
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
        if (fingerprint(joined) === want) count++;
      }
      if (count !== 1) throw new Error('left fingerprint not unique: ' + count);
    }
    jobs.push({ after: anchor.after, trail: anchor.trail, mids, label, rules });
    report.push({ label, rules, ok: true });
  } catch (e: any) {
    console.log('FAIL', label, e.message?.slice?.(0, 300) ?? e);
    report.push({ label, rules, ok: false, err: String(e.message ?? e).slice(0, 200) });
  }
}

jobs.sort((a, b) => b.after - a.after);
const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);
let inserted = 0;
const used = new Set<number>();
for (const job of jobs) {
  if (used.has(job.after)) {
    console.log('skip duplicate anchor', job.label);
    continue;
  }
  used.add(job.after);
  const block = job.mids.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`);
  lines.splice(job.after + 1, 0, ...block);
  inserted += block.length;
  console.log('inserted', block.length, job.label, job.rules.join(' → '));
}
fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('\nDONE inserted=' + inserted);
console.log(JSON.stringify(report, null, 2));
