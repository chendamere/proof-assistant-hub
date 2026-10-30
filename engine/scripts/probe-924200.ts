/**
 * Probe justified mid-chains for ch14 thm 9/24/200 fails.
 * npx tsx engine/scripts/probe-924200.ts [--step=N] [--thm=9|24|200]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { oneStepRewrites, armFactorStep, oneSiteToward } from '../src/inferenceRules/tcSubstitution';
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
function charDist(a: string, b: string) {
  const n = Math.min(a.length, b.length);
  let d = Math.abs(a.length - b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
  return d;
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
    if (/error-code|equiv-code|identical-4/.test(rule.id)) continue;
    if (!rule.leftSide.replace(/\s/g, '') || rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

const FOCUS =
  /node-connectivity-[0-8]|identical-node-comparison-1[0-9]|identical-node-comparison-[0-9]-|null-comparison|swap-release|copy-identical|recursive-function-r-|operators-and-relationships|empty-branch|thm-R|thm-Ps|node-ring|flag|create|release/i;

type Fail = { key: string; step: number; left: string; right: string };
const fails: Fail[] = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((l) => JSON.parse(l))
  .filter((f: Fail) => /::(9|24|200)::/.test(f.key));

const thmArg = process.argv.find((a) => a.startsWith('--thm='))?.slice(6);
const stepArg = process.argv.find((a) => a.startsWith('--step='))?.slice(7);
const target = fails.filter((f) => {
  if (thmArg && !f.key.includes(`::${thmArg}::`)) return false;
  if (stepArg && f.step !== Number(stepArg)) return false;
  return true;
});

function structuralHints(cur: string, goal: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const e = ensure(s);
    if (e !== ensure(cur)) out.push(e);
  };
  // fold Pc / nPc clusters (connectivity-4/5 reverse)
  add(
    cur.replace(
      /i \\Oc i_1,j \\Oc j_1,R\(i_1\),R\(j_1\),i_1 \\Ps j_1,i_1 \\Os,j_1 \\Os/g,
      'i \\Pc j'
    )
  );
  add(
    cur.replace(
      /i \\Oc i_1,j \\Oc j_1,R\(i_1\),R\(j_1\),i_1 \\nPs j_1,i_1 \\Os,j_1 \\Os/g,
      'i \\nPc j'
    )
  );
  // expand Pc inside arms
  add(
    cur.replace(
      /\\Bb\{m \\Pc n\}\{,([^}]*)\}\{,([^}]*)\}/g,
      '\\Bb{m \\Pc n}{,$1}{,$2}' // noop placeholder
    )
  );
  // bubble i Ps i1 next to i Oc i1
  if (/i \\Oc i_1/.test(cur) && /i \\Ps i_1/.test(cur)) {
    add(cur.replace(/,i \\Oc i_1,([^]*?),i \\Ps i_1,/, ',i \\Oc i_1,i \\Ps i_1,$1,').replace(/,,/g, ','));
    add(cur.replace(/,i \\Ps i_1,([^]*?),i \\Oc i_1,/, ',i \\Oc i_1,i \\Ps i_1,$1,').replace(/,,/g, ','));
  }
  // drop i Ps i1 when adjacent to Oc (copy-identical reverse)
  add(cur.replace(/,i \\Oc i_1,i \\Ps i_1,/, ',i \\Oc i_1,'));
  add(cur.replace(/,i \\Ps i_1,i \\Oc i_1,/, ',i \\Oc i_1,'));
  // drop i1 Pu
  add(cur.replace(/,i_1 \\Pu,/, ','));
  add(cur.replace(/,i \\Pu,/, ','));
  // push Os into nested Bb{m Pc n}
  add(
    cur.replace(
      /\\Bb\{i_1 \\Ps j_1\}\{,i_1 \\Os,j_1 \\Os,\\Bb\{m \\Pc n\}\{,([^}]*)\}\{,([^}]*)\},\}\{,i_1 \\Os,j_1 \\Os,\\Bb\{m \\Pc n\}\{,([^}]*)\}\{,([^}]*)\},\}/,
      '\\Bb{i_1 \\Ps j_1}{,\\Bb{m \\Pc n}{,i_1 \\Os,j_1 \\Os,$1}{,i_1 \\Os,j_1 \\Os,$2},}{,\\Bb{m \\Pc n}{,i_1 \\Os,j_1 \\Os,$3}{,i_1 \\Os,j_1 \\Os,$4},}'
    )
  );
  // expand one Bb{m Pc n} arm (connectivity-0 style with Os kept)
  {
    const m = cur.match(
      /\\Bb\{i_1 \\Ps j_1\}\{,\\Bb\{m \\Pc n\}\{,([^}]*)\}\{,([^}]*)\},\}/
    );
    if (m) {
      // only first arm expand
      add(
        cur.replace(
          /\\Bb\{i_1 \\Ps j_1\}\{,\\Bb\{m \\Pc n\}\{,([^}]*)\}\{,([^}]*)\},\}/,
          '\\Bb{i_1 \\Ps j_1}{,m \\Oc m_1,n \\Oc n_1,R(m_1),R(n_1),\\Bb{m_1 \\Ps n_1}{,m_1 \\Os,n_1 \\Os,$1}{,m_1 \\Os,n_1 \\Os,$2},}'
        )
      );
    }
  }
  // pull Oc out of equal arms
  add(
    cur.replace(
      /\\Bb\{i_1 \\Ps j_1\}\{,m \\Oc m_1,n \\Oc n_1,([^}]*)\}\{,m \\Oc m_1,n \\Oc n_1,([^}]*)\}/,
      'm \\Oc m_1,n \\Oc n_1,\\Bb{i_1 \\Ps j_1}{,$1}{,$2}'
    )
  );
  // pull R(m1),R(n1) out
  add(
    cur.replace(
      /\\Bb\{i_1 \\Ps j_1\}\{,R\(m_1\),R\(n_1\),([^}]*)\}\{,R\(m_1\),R\(n_1\),([^}]*)\}/,
      'R(m_1),R(n_1),\\Bb{i_1 \\Ps j_1}{,$1}{,$2}'
    )
  );
  // push R into arms
  add(
    cur.replace(
      /,R\(i_1\),R\(j_1\),\\Bb\{m_1 \\Ps n_1\}\{,([^}]*)\}\{,([^}]*)\}/,
      ',\\Bb{m_1 \\Ps n_1}{,R(i_1),R(j_1),$1}{,R(i_1),R(j_1),$2}'
    )
  );
  // push Oc into arms
  add(
    cur.replace(
      /,i \\Oc i_1,j \\Oc j_1,\\Bb\{m_1 \\Ps n_1\}\{,([^}]*)\}\{,([^}]*)\}/,
      ',\\Bb{m_1 \\Ps n_1}{,i \\Oc i_1,j \\Oc j_1,$1}{,i \\Oc i_1,j \\Oc j_1,$2}'
    )
  );
  // reorder Os: m1,n1,i1,j1 -> i1,j1,m1,n1 inside innermost
  add(
    cur.replace(
      /\\Bb\{i_1 \\Ps j_1\}\{,m_1 \\Os,n_1 \\Os,i_1 \\Os,j_1 \\Os,/g,
      '\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,m_1 \\Os,n_1 \\Os,'
    )
  );
  // fold i Oc..Bb{i1 Ps j1}{i1 Os,j1 Os,...} back to Bb{i Pc j}{...}
  add(
    cur.replace(
      /i \\Oc i_1,j \\Oc j_1,R\(i_1\),R\(j_1\),\\Bb\{i_1 \\Ps j_1\}\{,i_1 \\Os,j_1 \\Os,([^}]*)\}\{,i_1 \\Os,j_1 \\Os,([^}]*)\}/g,
      '\\Bb{i \\Pc j}{,$1}{,$2}'
    )
  );
  // pull Os out of Bb{i Pc j}
  add(
    cur.replace(
      /\\Bb\{i \\Pc j\}\{,m_1 \\Os,n_1 \\Os,([^}]*)\}\{,m_1 \\Os,n_1 \\Os,([^}]*)\}/g,
      'm_1 \\Os,n_1 \\Os,\\Bb{i \\Pc j}{,$1}{,$2}'
    )
  );
  // goal as hint
  if (goal) add(goal);
  return out;
}

function solveOne(fail: Fail, maxHops = 12): { exprs: string[]; ids: string[]; complete: boolean } {
  const pos = 13 * 100000 + parseInt(fail.key.split('::')[1]!, 10);
  const goal = ensure(stripDisplayIfConditions(fail.right));
  let cur = ensure(stripDisplayIfConditions(fail.left));
  const exprs: string[] = [];
  const ids: string[] = [];
  const prior = allRules.filter((r) => r.pos < pos && FOCUS.test(r.id));
  const index = indexBefore(pos);

  for (let hop = 0; hop < maxHops && cur !== goal; hop++) {
    const startD = charDist(cur, goal);
    let best: { expr: string; id: string; d: number } | null = null;

    const consider = (expr: string, idHint?: string | null) => {
      const e = ensure(expr);
      if (e === cur) return;
      const id = idHint ?? justify(cur, e, pos);
      if (!id) return;
      const d = charDist(e, goal);
      if (e === goal || d < startD) {
        if (!best || d < best.d || (d === best.d && e === goal)) best = { expr: e, id, d };
      }
    };

    const arm = armFactorStep(cur, goal);
    if (arm) consider(arm);
    const site = oneSiteToward(cur, goal);
    if (site) consider(site);
    for (const h of structuralHints(cur, goal)) consider(h);

    // try focused rewrites, keep closer ones
    for (const rule of prior) {
      let rewrites: string[];
      try {
        rewrites = oneStepRewrites(cur, rule.leftSide, rule.rightSide);
      } catch {
        continue;
      }
      for (const raw of rewrites) {
        const e = ensure(raw);
        if (e === cur) continue;
        const d = charDist(e, goal);
        if (e !== goal && d > startD + 30) continue;
        if (!checkInferenceRules(cur, e, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
          continue;
        if (!best || d < best.d || (d === best.d && e === goal)) best = { expr: e, id: rule.id, d };
        if (e === goal) break;
      }
      if (best?.expr === goal) break;
    }

    if (!best) {
      console.log('  stuck hop', hop, 'd', startD);
      console.log('  cur', cur.slice(0, 180));
      break;
    }
    console.log('  hop', hop, best.id, 'd', best.d, best.expr.slice(0, 100));
    exprs.push(best.expr);
    ids.push(best.id);
    cur = best.expr;
  }
  return { exprs, ids, complete: cur === goal };
}

for (const f of target) {
  console.log('\n===', f.key.split('::')[1], 'step', f.step, '===');
  console.log('L', ensure(f.left).slice(0, 120));
  console.log('R', ensure(f.right).slice(0, 120));
  // first check if already justified
  const direct = justify(f.left, f.right, 13 * 100000 + parseInt(f.key.split('::')[1]!, 10));
  if (direct) {
    console.log('DIRECT', direct);
    continue;
  }
  const sol = solveOne(f);
  console.log(sol.complete ? 'COMPLETE' : 'PARTIAL', 'hops', sol.exprs.length, sol.ids);
}
