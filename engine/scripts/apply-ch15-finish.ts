/**
 * Apply remaining known chains for ch15 (129 scaffold, 123 already done).
 * Also attempt nested-Bb pulls for 28/115.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
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
  'Rules_of_Node_Continuity',
];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const texPath = path.join(root, 'src/data/theorems/Rules_of_Node_Continuity.tex');
const recheckPath = path.join(__dirname, 'out/recheck-ch15.jsonl');

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
function keyPos(key: string): number {
  return CHAPTER_ORDER.indexOf(key.split('::')[0]!) * 100000 + parseInt(key.split('::')[1]!, 10);
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
const dag = new Map();
const idxCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let i = idxCache.get(pos);
  if (i) return i;
  i = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    dag
  );
  idxCache.set(pos, i);
  return i;
}
function justify(from: string, to: string, pos: number): string | null {
  const a = ensure(from);
  const b = ensure(to);
  if (a === b) return 'spacing';
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, a, b)) {
    if (checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}
function chainOk(steps: string[], pos: number): boolean {
  for (let i = 0; i < steps.length - 1; i++) {
    if (!justify(steps[i]!, steps[i + 1]!, pos)) return false;
  }
  return true;
}

function solve129(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  const a = ensure(
    ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps i_1,i_1 \\Ps j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const b = ensure(
    ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps i_1,j \\Ps j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const c = ensure(
    ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps j_1,j \\Ps i_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const d = ensure(
    ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,j \\Ps i_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const e = ensure(
    ',i \\Oc i_1,i \\Ps j,j \\Ps i_1,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const f = ensure(
    ',i \\Oc i_1,i \\Ps j,i \\Ps i_1,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const g = ensure(
    ',i \\Oc i_1,i \\Ps i_1,i \\Ps j,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const h = ensure(
    ',i \\Oc i_1,i \\Ps j,j \\Oc j_1,i_1 \\On,j_1 \\On,\\Bb{i_1 \\Ps m}{,j_1 \\Os,i_1 \\Os,\\Tc c_1,}{,j_1 \\Os,i_1 \\Os,\\Tc c_2,},'
  );
  const path = [a, b, c, d, e, f, g, h, R];
  if (chainOk([L, ...path], pos) && fingerprint(path[path.length - 1]!) === fingerprint(R)) return path;
  return null;
}

/** Short beam for nested Bb using key rules only. */
function solveNested(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  const goal = fingerprint(R);
  if (justify(L, R, pos)) return [R];
  const ruleIds = [
    'theorems-of-identical-node-comparison-12-mcnlbif',
    'theorems-of-identical-node-comparison-15-mslbifi',
    'theorems-of-identical-node-comparison-16-mnlbifi',
    'theorems-of-identical-node-comparison-18-bifisj',
    'rules-of-node-continuity-0-lbifinj',
    'swap-copy-next',
    'swap-next-next',
    'swap-copy-copy',
    'create-copy',
    'release-next',
  ];
  const rules = allRules.filter((r) => r.pos < pos && ruleIds.some((id) => r.id === id || r.id.includes(id.split('-').slice(-1)[0]!)));
  // broader: all identical + continuity-0 + swaps matching FILL
  const fill = allRules.filter(
    (r) =>
      r.pos < pos &&
      /identical-node-comparison-(12|15|16|18)|continuity-0|swap-copy|swap-next|create-copy|release-next|empty-branch/i.test(
        r.id
      )
  );

  type Node = { expr: string; path: string[] };
  let beam: Node[] = [{ expr: L, path: [] }];
  const seen = new Set([fingerprint(L)]);
  const charDist = (a: string, b: string) => {
    const n = Math.min(a.length, b.length);
    let d = Math.abs(a.length - b.length);
    for (let i = 0; i < n; i++) if (a[i] !== b[i]) d++;
    return d;
  };

  for (let depth = 0; depth < 8; depth++) {
    const next: Node[] = [];
    for (const node of beam) {
      const startD = charDist(node.expr, R);
      for (const rule of fill) {
        for (const [a, b] of [
          [rule.leftSide, rule.rightSide],
          [rule.rightSide, rule.leftSide],
        ] as const) {
          let rws: string[];
          try {
            rws = oneStepRewrites(node.expr, a, b);
          } catch {
            continue;
          }
          for (const raw of rws.slice(0, 12)) {
            const e = ensure(raw);
            if (
              !checkInferenceRules(node.expr, e, a, b, {
                dagCache: indexBefore(pos).dagCache,
              }).match
            )
              continue;
            const fp = fingerprint(e);
            if (seen.has(fp)) continue;
            if (fp === goal) return [...node.path, e];
            const d = charDist(e, R);
            if (d > startD + 30) continue;
            seen.add(fp);
            next.push({ expr: e, path: [...node.path, e] });
          }
        }
      }
    }
    next.sort((a, b) => charDist(a.expr, R) - charDist(b.expr, R));
    beam = next.slice(0, 12);
    if (beam.length === 0) break;
  }
  void rules;
  return null;
}

function parseProofSteps(lines: string[]) {
  const steps: Array<{ start: number; end: number; canon: string; trail: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\\Rq/.test(lines[i]!)) continue;
    let end = i;
    const trailMatch = lines[i]!.match(/(\\+)\s*$/);
    let trail = trailMatch ? trailMatch[1]! : '\\\\';
    while (end + 1 < lines.length) {
      const nxt = lines[end + 1]!;
      if (/\\Rq/.test(nxt)) break;
      if (/^\\bigskip|^\\end\{math\}|^proof:/i.test(nxt.trim())) break;
      if (!nxt.trim()) break;
      end++;
      const tm = nxt.match(/(\\+)\s*$/);
      if (tm) trail = tm[1]!;
    }
    const buf = lines
      .slice(i, end + 1)
      .map((l) => l.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''))
      .join(' ');
    const canon = ensure(buf.trim());
    if (canon.length > 4) steps.push({ start: i, end, canon, trail });
    i = end;
  }
  return steps;
}

function applyChains(solved: Array<{ left: string; intermediates: string[]; label: string }>) {
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const steps = parseProofSteps(lines);
  const jobs: Array<{ afterLine: number; trail: string; intermediates: string[]; label: string }> = [];
  for (const item of solved) {
    const want = fingerprint(item.left);
    const hits = steps.filter((s) => fingerprint(s.canon) === want);
    if (hits.length !== 1) {
      console.log('NO UNIQUE ANCHOR', item.label, hits.length);
      continue;
    }
    jobs.push({
      afterLine: hits[0]!.end,
      trail: hits[0]!.trail,
      intermediates: item.intermediates,
      label: item.label,
    });
  }
  jobs.sort((a, b) => b.afterLine - a.afterLine);
  const used = new Set<number>();
  let inserted = 0;
  for (const job of jobs) {
    if (used.has(job.afterLine)) continue;
    used.add(job.afterLine);
    lines.splice(
      job.afterLine + 1,
      0,
      ...job.intermediates.map((mid) => `\\Rq${bookBody(mid)}${job.trail}`)
    );
    inserted += job.intermediates.length;
    console.log('inserted', job.intermediates.length, job.label);
  }
  fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
  return inserted;
}

// refresh fails first (verify exits 1 when fails remain)
try {
  execSync(
    `npx --yes tsx engine/scripts/verify-all-chapters.ts --chapter=Rules_of_Node_Continuity --out=${recheckPath}`,
    { cwd: root, stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 }
  );
} catch {
  /* expected while fails remain */
}

const fails = fs
  .readFileSync(recheckPath, 'utf8')
  .trim()
  .split(/\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l) as { key: string; step: number; left: string; right: string });

console.log('fails', fails.length);
const solved: Array<{ left: string; intermediates: string[]; label: string }> = [];
let open = 0;
for (const f of fails) {
  const thm = f.key.split('::')[1]!;
  const pos = keyPos(f.key);
  console.log('solving', thm, 's' + f.step);
  let path: string[] | null = null;
  if (thm === '129') path = solve129(f.left, f.right, pos);
  if (!path) path = solveNested(f.left, f.right, pos);
  if (!path || path.length === 0) {
    console.log('OPEN', thm, 's' + f.step);
    open++;
    continue;
  }
  const mids = path.slice(0, -1);
  if (!chainOk([ensure(f.left), ...path.map(ensure)], pos)) {
    console.log('BAD', thm, 's' + f.step);
    open++;
    continue;
  }
  console.log('CHAIN', thm, 's' + f.step, '+' + mids.length);
  if (mids.length)
    solved.push({ left: f.left, intermediates: mids.map(toBook), label: `thm ${thm} step ${f.step}` });
}
const inserted = applyChains(solved);
console.log(`solved=${solved.length} open=${open} inserted=${inserted}`);
if (inserted > 0) {
  execSync('node scripts/extract-proof-steps.js', {
    cwd: root,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });
}
