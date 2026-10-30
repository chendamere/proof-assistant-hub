/**
 * Solve arm-local fails (124, 108 Os reorder, 202 s63) by rewriting inside Bb/Blb arms.
 */
import fs from 'fs';
import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
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
function ensure(s: string) {
  let t = normalizeSpacing(
    fromOperatorFirst(s)
      .replace(/R_\(/g, 'R\\_(')
      .replace(/\\Os\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Os')
      .replace(/\\Pu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Pu')
      .replace(/\\nPu\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\nPu')
      .replace(/\\On\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\On')
      .replace(/\\Op\s+([A-Za-z][A-Za-z0-9_]*)/g, '$1 \\Op')
  ).trim();
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
    if (rule.id.includes('equiv-code')) continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function structural(cur: string, goal: string): string[] {
  const out: string[] = [];
  const push = (s: string) => {
    const e = ensure(s);
    if (e !== ensure(cur)) out.push(e);
  };
  // flip Ps anywhere (top or in cond)
  {
    const re = /([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cur))) {
      push(cur.slice(0, m.index) + `${m[2]} \\Ps ${m[1]}` + cur.slice(m.index + m[0].length));
    }
  }
  // drop Pu/nPu flags
  for (const flag of ['\\\\Pu', '\\\\nPu'] as const) {
    const re = new RegExp(`,([A-Za-z][A-Za-z0-9_]*) ${flag},`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(cur))) {
      push(cur.slice(0, m.index) + ',' + cur.slice(m.index + m[0].length));
    }
  }
  // drop dup Ps
  {
    const next = cur.replace(
      /,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),\1 \\Ps \2,/,
      `,$1 \\Ps $2,`
    );
    if (next !== cur) push(next);
  }
  // drop Oc-Ps pair shrink
  {
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*),\1 \\Ps \2,/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cur))) {
      push(cur.slice(0, m.index) + `,${m[1]} \\Oc ${m[2]},` + cur.slice(m.index + m[0].length));
    }
  }
  // replace i Ps i_1 with i_1 Os inside arms when goal has that
  if (goal.includes('\\Os') && cur.includes('\\Ps')) {
    const re = /,([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*),/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cur))) {
      // try m[2] Os
      push(
        cur.slice(0, m.index) + `,${m[2]} \\Os,` + cur.slice(m.index + m[0].length)
      );
    }
  }
  // identical arm collapse
  {
    const re = /\\B(?:lb|b)\{[^}]*\}\{([^}]*)\}\{\1\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cur))) {
      push(cur.slice(0, m.index) + m[1] + cur.slice(m.index + m[0].length));
    }
  }
  // drop empty Or bb
  {
    const next = cur.replace(/,\\Bb\{[^}]*\}\{,\}\{,\\Or,\},/g, ',');
    if (next !== cur) push(next);
  }
  // drop orphan Or bb piece
  {
    const next = cur.replace(/\\Bb\{[^}]*\}\{,\}\{,\\Or,\},?/g, '');
    if (next !== cur) push(next);
  }
  return out;
}

function beam(L0: string, R0: string, pos: number, depth = 16, width = 10): string[] | null {
  const goal = ensure(R0);
  const start = ensure(L0);
  if (justify(start, goal, pos)) return [];
  type N = { e: string; path: string[]; d: number };
  let beam: N[] = [{ e: start, path: [], d: charDist(start, goal) }];
  const seen = new Set([start]);
  const priority = allRules
    .filter((r) => r.pos < pos && /identical|null-comparison|flag|empty-branch|swap|operators|recursive-function-r-2|release|copy|thm-Ps|thm-R/.test(r.id))
    .slice(0, 120);

  for (let step = 0; step < depth; step++) {
    const next: N[] = [];
    for (const node of beam) {
      const cands = new Set(structural(node.e, goal));
      if (step % 2 === 0 || node.d < 40) {
        for (const rule of priority) {
          let rewrites: string[];
          try {
            rewrites = oneStepRewrites(node.e, rule.leftSide, rule.rightSide);
          } catch {
            continue;
          }
          for (const raw of rewrites.slice(0, 8)) {
            const e = ensure(raw);
            if (charDist(e, goal) <= node.d + 30) cands.add(e);
          }
        }
      }
      for (const raw of cands) {
        const e = ensure(raw);
        if (seen.has(e)) continue;
        const id = justify(node.e, e, pos);
        if (!id) continue;
        // accept rewrite-justified from oneStep too
        seen.add(e);
        const d = charDist(e, goal);
        const path = [...node.path, e];
        if (e === goal) return path.slice(0, -1);
        if (d <= node.d + 15) next.push({ e, path, d });
      }
    }
    if (!next.length) return null;
    next.sort((a, b) => a.d - b.d);
    beam = next.slice(0, width);
    console.log('  step', step, 'best', beam[0]!.d, 'seen', seen.size);
    if (beam[0]!.d === 0) return beam[0]!.path.slice(0, -1);
  }
  return null;
}

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const seen = new Set<string>();
const targets = [
  [124, 34],
  [124, 82],
  [124, 103],
  [124, 117],
  [124, 122],
  [124, 144],
  [124, 147],
  [124, 181],
  [202, 63],
  [100, 101],
  [195, 32],
  [197, 86],
];

for (const [thm, step] of targets) {
  const f = fails.find((x) => x.key.includes(`::${thm}::`) && x.step === step);
  if (!f) {
    console.log(thm, step, 'missing');
    continue;
  }
  const id = `${thm}:${step}`;
  if (seen.has(id)) continue;
  seen.add(id);
  console.log('TRY', thm, 's' + step);
  const t0 = Date.now();
  const path = beam(f.left, f.right, 13 * 100000 + thm);
  console.log(path ? `CHAIN +${path.length}` : 'OPEN', Date.now() - t0 + 'ms');
  if (path) {
    fs.appendFileSync(
      'engine/scripts/out/ch14-hard-chains.jsonl',
      JSON.stringify({ thm, step, mids: path[path.length - 1] === ensure(f.right) ? path.slice(0, -1) : path, left: f.left, right: f.right }) +
        '\n'
    );
  }
}
