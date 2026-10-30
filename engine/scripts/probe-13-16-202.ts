/** Probe justified mid chains for ch14 fails 13/16/202. */
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
const memo = new Map<string, string | null>();
function justify(a: string, b: string, pos: number) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const key = pos + '|' + A + '=>' + B;
  if (memo.has(key)) return memo.get(key)!;
  const index = indexBefore(pos);
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

function tryChain(label: string, L0: string, R0: string, pos: number, hops: string[]) {
  const L = ensure(L0);
  const R = ensure(R0);
  let cur = L;
  const rules: string[] = [];
  console.log('\n====', label, '====');
  for (let i = 0; i < hops.length; i++) {
    const next = ensure(hops[i]!);
    const j = justify(cur, next, pos);
    console.log(' hop', i + 1, j ?? 'FAIL');
    if (!j) {
      console.log('  from', cur);
      console.log('  to  ', next);
      return null;
    }
    rules.push(j);
    cur = next;
  }
  const last = justify(cur, R, pos);
  console.log(' final', cur === R ? 'REACHED' : last ?? 'FAIL');
  if (cur !== R && !last) {
    console.log('  cur', cur);
    console.log('  R  ', R);
    return null;
  }
  const mids = hops.map(ensure).filter((m) => m !== R);
  console.log(' mids', mids.length, 'rules', [...rules, ...(last && cur !== R ? [last] : [])]);
  return { mids, rules: [...rules, ...(last && cur !== R ? [last] : [])] };
}

function parseArmItems(arm: string): string[] {
  return arm
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .split(/\s*,\s*/)
    .filter(Boolean);
}
function swapArm(expr: string, which: 'true' | 'false' | 'both', i: number): string | null {
  const m = expr.match(/\\B(lb|b)\{([^}]*)\}\{,([^}]*)\}\{,([^}]*)\}/);
  if (!m) return null;
  const swap = (arm: string) => {
    const items = parseArmItems(arm);
    if (i < 0 || i >= items.length - 1) return null;
    const sw = items.slice();
    [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
    return sw.join(',');
  };
  let t = m[3]!;
  let f = m[4]!;
  if (which === 'true' || which === 'both') {
    const nt = swap(t);
    if (!nt) return null;
    t = nt;
  }
  if (which === 'false' || which === 'both') {
    const nf = swap(f);
    if (!nf) return null;
    f = nf;
  }
  return ensure(expr.replace(m[0]!, `\\B${m[1]}{${m[2]}}{,${t},}{,${f},}`));
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((x) => /::(13|16|202)::/.test(x.key));

for (const f of fails) {
  const thm = parseInt(f.key.split('::')[1]!, 10);
  const pos = 13 * 100000 + thm;
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('\n######## thm', thm, 's' + f.step, '########');
  console.log('L', L);
  console.log('R', R);
  console.log('direct', justify(L, R, pos) ?? 'FAIL');

  if (thm === 13 && f.step === 4) {
    // swap i1/j1 Os in true only, false only, both
    for (const which of ['true', 'false', 'both'] as const) {
      const mid = swapArm(L, which, 0);
      if (!mid) continue;
      const j = justify(L, mid, pos);
      console.log('swap', which, j ?? 'FAIL');
      if (j && (mid === R || justify(mid, R, pos))) {
        console.log('  reaches R via', mid === R ? 'exact' : justify(mid, R, pos));
      }
    }
    // two-step: true then false
    const m1 = swapArm(L, 'true', 0);
    if (m1 && justify(L, m1, pos)) {
      const m2 = swapArm(m1, 'false', and0(m1));
      function and0(_e: string) {
        return 0;
      }
      const m2b = swapArm(m1, 'false', 0);
      console.log('true→false', justify(m1, m2b!, pos) ?? 'FAIL', 'reaches', m2b === R || !!justify(m2b!, R, pos));
    }
  }

  if (thm === 16 && f.step === 8) {
    // bubble Ot: swap index 0 then 1 on both arms, stepwise
    const path: string[] = [];
    let cur = L;
    // Prefer: both arms swap Ot with i1, then both swap Ot with j1
    // Or one arm at a time
    const plans: Array<Array<{ which: 'true' | 'false' | 'both'; i: number }>> = [
      [
        { which: 'both', i: 0 },
        { which: 'both', i: 1 },
      ],
      [
        { which: 'true', i: 0 },
        { which: 'false', i: 0 },
        { which: 'true', i: 1 },
        { which: 'false', i: 1 },
      ],
      [
        { which: 'true', i: 0 },
        { which: 'true', i: 1 },
        { which: 'false', i: 0 },
        { which: 'false', i: 1 },
      ],
    ];
    for (const plan of plans) {
      cur = L;
      path.length = 0;
      let ok = true;
      const rules: string[] = [];
      for (const step of plan) {
        const next = swapArm(cur, step.which, step.i);
        if (!next) {
          ok = false;
          break;
        }
        const j = justify(cur, next, pos);
        if (!j) {
          ok = false;
          console.log('plan fail at', step, 'from', cur.slice(cur.indexOf('\\Blb')));
          break;
        }
        rules.push(j);
        if (next !== R) path.push(next);
        cur = next;
      }
      if (!ok) continue;
      const fin = cur === R || !!justify(cur, R, pos);
      console.log(
        'plan',
        plan.map((p) => p.which + '@' + p.i).join(','),
        fin ? 'OK' : 'incomplete',
        rules
      );
      if (fin) break;
    }
  }

  if (thm === 202 && f.step === 3) {
    // push j1 Os into equal arms (identical-15 reverse), then reorder top
    const push = ensure(
      L.replace(
        ',R\\_(j_1),j_1 \\Os,R(i_1),R(j_2),\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_2 \\Os,}',
        ',R\\_(j_1),R(i_1),R(j_2),\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}'
      )
    );
    console.log('push Os', justify(L, push, pos) ?? 'FAIL');
    if (justify(L, push, pos)) {
      console.log('  →R', push === R || justify(push, R, pos) || 'FAIL');
      // reorder after push
      const re1 = ensure(
        push.replace(
          ',i \\Oc i_1,j \\Oc j_2,j \\Oc j_1,R\\_(j_1),R(i_1),R(j_2),',
          ',i \\Oc i_1,R(i_1),j \\Oc j_2,j \\Oc j_1,R(j_2),R\\_(j_1),'
        )
      );
      console.log('  reorder', justify(push, re1, pos) ?? 'FAIL', re1 === R || !!justify(re1, R, pos));
    }
    // reorder first then push
    const re0 = ensure(
      L.replace(
        ',i \\Oc i_1,j \\Oc j_2,j \\Oc j_1,R\\_(j_1),j_1 \\Os,R(i_1),R(j_2),',
        ',i \\Oc i_1,R(i_1),j \\Oc j_2,j \\Oc j_1,R(j_2),R\\_(j_1),j_1 \\Os,'
      )
    );
    console.log('reorder first', justify(L, re0, pos) ?? 'FAIL');
    if (justify(L, re0, pos)) {
      const push2 = ensure(
        re0.replace(
          ',R\\_(j_1),j_1 \\Os,\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_2 \\Os,}',
          ',R\\_(j_1),\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}'
        )
      );
      console.log('  then push', justify(re0, push2, pos) ?? 'FAIL', push2 === R || !!justify(push2, R, pos));
      // maybe need bubble j1 Os next to Blb first
      const bubble = ensure(re0.replace(',R(j_2),R\\_(j_1),j_1 \\Os,\\Blb', ',R(j_2),R\\_(j_1),\\Blb')); // wrong
      void bubble;
      // try: move j1 Os adjacent before Blb then push — already is
      // try push with j1 Os at end: ,R(j2),R_(j1),j1 Os,Blb → push into arms
      const push3 = ensure(
        re0.replace(
          ',R(j_2),R\\_(j_1),j_1 \\Os,\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_2 \\Os,}',
          ',R(j_2),R\\_(j_1),\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}'
        )
      );
      console.log('  push3', justify(re0, push3, pos) ?? 'FAIL', push3 === R || !!justify(push3, R, pos));
      console.log('  push3==R', push3 === R);
      if (push3 !== R) console.log('  push3', push3, '\n  R    ', R);
    }
    // try: push j1 Os into arms first (at start position), with different arm insertion position
    for (const armForm of [
      '{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}',
      '{,j_1 \\Os,i_1 \\Os,j_2 \\Os,}{,j_1 \\Os,i_1 \\Os,j_2 \\Os,}',
      '{,i_1 \\Os,j_2 \\Os,j_1 \\Os,}{,i_1 \\Os,j_2 \\Os,j_1 \\Os,}',
    ]) {
      const p = ensure(
        L.replace(
          ',R\\_(j_1),j_1 \\Os,R(i_1),R(j_2),\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_2 \\Os,}',
          `,R\\_(j_1),R(i_1),R(j_2),\\Blb{i_1 \\Ps j_2}${armForm}`
        )
      );
      const j = justify(L, p, pos);
      if (j) console.log('push form', armForm.slice(0, 40), j, '→R', p === R || !!justify(p, R, pos));
    }
  }

  if (thm === 202 && f.step === 5) {
    const mid = ensure(
      L.replace(
        ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),\\Blb',
        ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,\\Blb'
      )
    );
    console.log('add dup', justify(L, mid, pos) ?? 'FAIL', mid === R || !!justify(mid, R, pos));
    // try after R(j1) position variants
    const mid2 = ensure(L.replace(',j_2 \\Ps j_1,', ',j_2 \\Ps j_1,j_2 \\Ps j_1,'));
    console.log('add adj', justify(L, mid2, pos) ?? 'FAIL', mid2 === R);
  }

  if (thm === 202 && f.step === 9) {
    const mid = ensure(
      L.replace(',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,', ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),')
    );
    console.log('drop dup', justify(L, mid, pos) ?? 'FAIL', mid === R || !!justify(mid, R, pos));
  }

  if (thm === 202 && f.step === 11) {
    const pull = ensure(
      L.replace(
        '\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}',
        'j_2 \\Os,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}'
      )
    );
    console.log('pull', justify(L, pull, pos) ?? 'FAIL');
    if (justify(L, pull, pos)) {
      // reorder: j Oc j2, j Oc j1, R(j2), R_(j1), j2 Os → j Oc j2, R(j2), j2 Os, j Oc j1, R_(j1)
      const re = ensure(
        pull.replace(
          ',j \\Oc j_2,j \\Oc j_1,R(j_2),R\\_(j_1),j_2 \\Os,',
          ',j \\Oc j_2,R(j_2),j_2 \\Os,j \\Oc j_1,R\\_(j_1),'
        )
      );
      console.log('  reorder', justify(pull, re, pos) ?? 'FAIL', re === R || !!justify(re, R, pos));
      // bubble j2 Os next to R(j2) stepwise
      let cur = pull;
      const swaps = [
        ',j \\Oc j_2,j \\Oc j_1,R(j_2),R\\_(j_1),j_2 \\Os,',
        ',j \\Oc j_2,j \\Oc j_1,R(j_2),j_2 \\Os,R\\_(j_1),',
        ',j \\Oc j_2,j \\Oc j_1,j_2 \\Os,R(j_2),R\\_(j_1),', // maybe not
        ',j \\Oc j_2,R(j_2),j \\Oc j_1,R\\_(j_1),j_2 \\Os,',
        ',j \\Oc j_2,R(j_2),j_2 \\Os,j \\Oc j_1,R\\_(j_1),',
      ];
      // try BFS of adjacent top swaps from pull toward R
      const goal = R;
      const topItems = (e: string) => {
        const items: string[] = [];
        let depth = 0;
        let start = 0;
        const s = ensure(e);
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
      };
      const join = (items: string[]) => ensure(',' + items.join(',') + ',');
      const q = [pull];
      const seen = new Set([pull]);
      const parent = new Map<string, { prev: string; rule: string }>();
      let found: string | null = null;
      for (let depth = 0; depth < 8 && !found; depth++) {
        const nextQ: string[] = [];
        for (const cur of q) {
          if (cur === goal || justify(cur, goal, pos)) {
            found = cur;
            break;
          }
          const items = topItems(cur);
          for (let i = 0; i < items.length - 1; i++) {
            const sw = items.slice();
            [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
            const e = join(sw);
            if (seen.has(e)) continue;
            const j = justify(cur, e, pos);
            if (!j) continue;
            seen.add(e);
            parent.set(e, { prev: cur, rule: j });
            nextQ.push(e);
            if (e === goal || justify(e, goal, pos)) {
              found = e;
              break;
            }
          }
          if (found) break;
        }
        q.length = 0;
        q.push(...nextQ);
      }
      console.log('  bfs found', !!found, 'seen', seen.size);
      if (found) {
        const chain: string[] = [];
        const rules: string[] = [];
        let x = found;
        while (parent.has(x)) {
          const p = parent.get(x)!;
          chain.unshift(x);
          rules.unshift(p.rule);
          x = p.prev;
        }
        const fin = found === goal ? null : justify(found, goal, pos);
        console.log('  chain rules', [justify(L, pull, pos), ...rules, ...(fin ? [fin] : [])]);
        console.log('  chain len mids', 1 + chain.filter((c) => c !== R).length);
      }
      void swaps;
      void cur;
    }
  }
}
