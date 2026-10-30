/** Fast probe for 13/16 arm bubbles + 202 targeted hops. */
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
import { normalizeSpacing } from '../src/inferenceRules/utils';

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

console.log('loading…');
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));

function makeJustify(pos: number) {
  const swapRules = allRules.filter(
    (r) =>
      r.pos < pos &&
      /swap-release|swap-temp|swap-theorems|identical-node-comparison-1[45678]|recursive-function-r-27|create-copy|thm-R-i-release|identical-node-comparison-47/.test(
        r.id
      )
  );
  const index = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    new Map()
  );
  const memo = new Map<string, string | null>();
  return (a: string, b: string) => {
    const A = ensure(a);
    const B = ensure(b);
    if (A === B) return 'spacing';
    const key = A + '=>' + B;
    if (memo.has(key)) return memo.get(key)!;
    for (const rule of swapRules) {
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
  };
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
  let t = parseArm(m[3]!);
  let f = parseArm(m[4]!);
  const sw = which === 't' ? t : f;
  [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
  const nt = t.join(',');
  const nf = f.join(',');
  return ensure(expr.replace(m[0]!, `\\B${m[1]}{${m[2]}}{,${nt},}{,${nf},}`));
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

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

// --- 13 ---
{
  const f = fails.find((x) => x.key.includes('::13::') && x.step === 4)!;
  const justify = makeJustify(13 * 100000 + 13);
  const L = ensure(f.left);
  const R = ensure(f.right);
  const mid = swapArm(L, 't', 0);
  console.log('\n13 s4');
  console.log('L→mid', justify(L, mid));
  console.log('mid→R', justify(mid, R));
  console.log('mid arms', mid.match(/\{,[^}]+\}/g));
}

// --- 16 ---
{
  const f = fails.find((x) => x.key.includes('::16::') && x.step === 8)!;
  const justify = makeJustify(13 * 100000 + 16);
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\n16 s8');
  let cur = L;
  const mids: string[] = [];
  const rules: string[] = [];
  for (const [w, i] of [
    ['t', 0],
    ['t', 1],
    ['f', 0],
    ['f', 1],
  ] as const) {
    const next = swapArm(cur, w, i);
    const j = justify(cur, next);
    console.log(w + '@' + i, j);
    console.log('  ', next.match(/\\Blb\{[^}]+\}(\{[^}]+\})(\{[^}]+\})/)?.[0]);
    if (!j) break;
    rules.push(j);
    if (next !== R) mids.push(next);
    cur = next;
  }
  console.log('eq', cur === R);
  if (cur !== R) {
    console.log('cur', cur);
    console.log('R  ', R);
    // diff chars
    for (let i = 0; i < Math.max(cur.length, R.length); i++) {
      if (cur[i] !== R[i]) {
        console.log('diff at', i, JSON.stringify(cur.slice(i, i + 40)), 'vs', JSON.stringify(R.slice(i, i + 40)));
        break;
      }
    }
    console.log('fin', justify(cur, R));
  }
}

// --- 202 ---
{
  const justify = makeJustify(13 * 100000 + 202);
  const fs202 = fails.filter((x) => x.key.includes('::202::'));

  for (const f of fs202) {
    console.log('\n202 s' + f.step);
    const L = ensure(f.left);
    const R = ensure(f.right);
    console.log('direct', justify(L, R));

    if (f.step === 3) {
      // bubble j1 Os right to Blb
      let cur = L;
      const mids: string[] = [];
      // items: i Oc i1 | j Oc j2 | j Oc j1 | R_(j1) | j1 Os | R(i1) | R(j2) | Blb
      // want j1 Os next to Blb: swap j1 Os with R(i1), then with R(j2)
      const seq = [
        (c: string) => {
          const items = topItems(c);
          // find j1 Os and swap with next
          const i = items.indexOf('j_1 \\Os');
          if (i < 0 || i >= items.length - 1) return c;
          const sw = items.slice();
          [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
          return joinItems(sw);
        },
        (c: string) => {
          const items = topItems(c);
          const i = items.indexOf('j_1 \\Os');
          if (i < 0 || i >= items.length - 1) return c;
          const sw = items.slice();
          [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
          return joinItems(sw);
        },
      ];
      for (let k = 0; k < seq.length; k++) {
        const next = seq[k]!(cur);
        const j = justify(cur, next);
        console.log(' bubble', k + 1, j, next.includes('j_1 \\Os,\\Blb') || next.includes('j_1 \\Os,\\Blb'));
        console.log('  near', next.slice(next.indexOf('R\\_'), next.indexOf('\\Blb') + 10));
        if (!j) break;
        mids.push(next);
        cur = next;
      }
      // push j1 Os into arms
      const pushed = ensure(
        cur.replace(
          ',j_1 \\Os,\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_2 \\Os,}',
          ',\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}'
        )
      );
      console.log(' push', justify(cur, pushed));
      if (justify(cur, pushed)) {
        mids.push(pushed);
        cur = pushed;
      }
      // also try insert at start of arms
      const pushed2 = ensure(
        cur.replace(
          ',j_1 \\Os,\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_2 \\Os,}',
          ',\\Blb{i_1 \\Ps j_2}{,j_1 \\Os,i_1 \\Os,j_2 \\Os,}{,j_1 \\Os,i_1 \\Os,j_2 \\Os,}'
        )
      );
      if (cur !== pushed) {
        // already pushed
      } else {
        console.log(' push2', justify(cur, pushed2));
      }
      // reorder toward R via adjacent swaps BFS
      const goal = R;
      if (cur !== goal && !justify(cur, goal)) {
        const seen = new Set([cur]);
        const parent = new Map<string, string>();
        let q = [cur];
        let found: string | null = null;
        for (let d = 0; d < 10 && !found; d++) {
          const nq: string[] = [];
          for (const c of q) {
            if (c === goal || justify(c, goal)) {
              found = c;
              break;
            }
            const items = topItems(c);
            for (let i = 0; i < items.length - 1; i++) {
              const sw = items.slice();
              [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
              const e = joinItems(sw);
              if (seen.has(e)) continue;
              if (!justify(c, e)) continue;
              seen.add(e);
              parent.set(e, c);
              nq.push(e);
            }
          }
          q = nq;
        }
        console.log(' reorder bfs', !!found, 'seen', seen.size);
        if (found) {
          const chain: string[] = [];
          let x = found;
          while (parent.has(x)) {
            chain.unshift(x);
            x = parent.get(x)!;
          }
          console.log(' chain mids from after push', chain.length, 'final', found === goal || justify(found, goal));
        }
      } else {
        console.log(' after push reaches', cur === goal || !!justify(cur, goal));
      }
    }

    if (f.step === 5) {
      const mid = ensure(
        L.replace(
          ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),\\Blb',
          ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,\\Blb'
        )
      );
      console.log('add dup', justify(L, mid), mid === R);
      // try with R(j1) instead of R_
      const midR = ensure(
        L.replace(',R\\_(j_1),\\Blb', ',R(j_1),\\Blb')
      );
      console.log('R_→R?', justify(L, midR));
      // search r-27 style rules that match
      const rule = allRules.find((r) => r.id.includes('recursive-function-r-27'));
      console.log('r-27', rule?.leftSide, '=>', rule?.rightSide);
      if (rule) {
        console.log(
          'r-27 check',
          checkInferenceRules(L, mid, rule.leftSide, rule.rightSide, { dagCache: new Map() }).match
        );
        // try without Blb context - just the prefix
        const a = ensure(',j_2 \\Ps j_1,R(j_2),R\\_(j_1),');
        const b = ensure(',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,');
        console.log(
          'prefix r-27',
          checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: new Map() }).match
        );
        const a2 = ensure(',j_2 \\Ps j_1,R(j_2),R(j_1),');
        const b2 = ensure(',j_2 \\Ps j_1,R(j_2),R(j_1),j_2 \\Ps j_1,');
        console.log(
          'prefix R R r-27',
          checkInferenceRules(a2, b2, rule.leftSide, rule.rightSide, { dagCache: new Map() }).match
        );
      }
    }

    if (f.step === 9) {
      const mid = ensure(
        L.replace(',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,', ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),')
      );
      console.log('drop dup', justify(L, mid), mid === R);
    }

    if (f.step === 11) {
      const pull = ensure(
        L.replace(
          '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}',
          'j_2 \\Os,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}'
        )
      );
      console.log('pull', justify(L, pull));
      if (justify(L, pull)) {
        let cur = pull;
        const goal = R;
        const seen = new Set([cur]);
        const parent = new Map<string, string>();
        let q = [cur];
        let found: string | null = null;
        for (let d = 0; d < 8 && !found; d++) {
          const nq: string[] = [];
          for (const c of q) {
            if (c === goal || justify(c, goal)) {
              found = c;
              break;
            }
            const items = topItems(c);
            for (let i = 0; i < items.length - 1; i++) {
              const sw = items.slice();
              [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
              const e = joinItems(sw);
              if (seen.has(e)) continue;
              if (!justify(c, e)) continue;
              seen.add(e);
              parent.set(e, c);
              nq.push(e);
            }
          }
          q = nq;
        }
        console.log('bfs', !!found, 'seen', seen.size, found === goal || (found ? justify(found, goal) : null));
      }
    }
  }
}
