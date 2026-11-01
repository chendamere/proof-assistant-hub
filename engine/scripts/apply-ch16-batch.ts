/**
 * Batch apply known ch16 chains: code-dist + reverse Ot→Pu, create-temp/create-id collapses.
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
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

const CHAPTER = 'Rules_of_Relationship_of_Subnode';
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
  'Rules_of_Relationship_of_Subnode',
];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const texPath = path.join(root, `src/data/theorems/${CHAPTER}.tex`);
const recheckPath = path.join(__dirname, 'out/recheck-ch16.jsonl');

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
const idxCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let i = idxCache.get(pos);
  if (i) return i;
  i = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    new Map()
  );
  idxCache.set(pos, i);
  return i;
}
function justify(from: string, to: string, pos: number): string | null {
  const a = ensure(from);
  const b = ensure(to);
  if (fingerprint(a) === fingerprint(b)) return 'spacing';
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

function solve12s6(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  const s1 = ensure(
    ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,n \\Pu,}{,i \\Od n,},n \\Os,t \\Os,},'
  );
  const s2 = ensure(
    ',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,n \\Pu,n \\Os,}{,i \\Od n,n \\Os,},t \\Os,},'
  );
  const path = [s1, s2, R];
  return chainOk([L, ...path], pos) ? path : null;
}

function solve12s7(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  const a = ensure(',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Bb{t \\Pc j}{,}{,i \\Od n,n \\Os,},t \\Os,},');
  if (chainOk([L, a, R], pos)) return [a, R];
  const b = ensure(',\\Bb{i \\Pu}{,}{,i \\Ob t,\\Bb{t \\Pc j}{,\\Ot n,n \\Os,}{,},t \\Os,},');
  if (chainOk([L, b, R], pos)) return [b, R];
  return null;
}

/** Generic: try create-temp then create-id (or reverse) when R drops Ot/Os and Od/Os pairs from a Bb. */
function tryCreateCollapse(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  if (L.length <= R.length) return null;
  // Heuristic: remove first Ot x, x Os occurrence from L
  const ot = /\\Ot ([A-Za-z][A-Za-z0-9_]*),\1 \\Os,?/;
  const od = /\\Od ([A-Za-z][A-Za-z0-9_]*),\1 \\Os,?/;
  if (ot.test(L)) {
    const mid = ensure(L.replace(ot, ''));
    if (justify(L, mid, pos)) {
      if (fingerprint(mid) === fingerprint(R)) return [mid];
      if (justify(mid, R, pos)) return [mid, R];
      if (od.test(mid)) {
        const mid2 = ensure(mid.replace(od, ''));
        if (justify(mid, mid2, pos) && fingerprint(mid2) === fingerprint(R)) return [mid, mid2];
      }
    }
  }
  if (od.test(L)) {
    const mid = ensure(L.replace(od, ''));
    if (justify(L, mid, pos)) {
      if (fingerprint(mid) === fingerprint(R)) return [mid];
      if (justify(mid, R, pos)) return [mid, R];
    }
  }
  return null;
}

/** Bubble trailing Os left past one atom then code-dist into preceding Bb, then try goal. */
function tryOsCodeDist(L0: string, R0: string, pos: number): string[] | null {
  const L = ensure(L0);
  const R = ensure(R0);
  // Match pattern: Bb{...}{...}, X Os, Y Os,  or Bb, X, Y Os where Y Os should enter Bb
  const m = /^(.*,)(\\B(?:lb|b)\{[\s\S]*\})(,[^,]+),([A-Za-z][A-Za-z0-9_]* \\Os),$/;
  // Simpler hand for known shape: ...,t Os,n Os,} at end of an arm — too specific; use justify search on candidates
  void m;
  // Find `Z Os` at top level after a Bb and an atom; swap then push
  // Implemented only via justify of constructed mids when L contains `,t \\Os,n \\Os,`
  if (!/,([A-Za-z][A-Za-z0-9_]*) \\Os,([A-Za-z][A-Za-z0-9_]*) \\Os,/.test(L) && !L.includes('\\Os,')) {
    // still try: if L has Bb ... Os, Os at end inside outer false
  }
  // Candidate: swap last two top-level if second is Os
  // Fall through to null — specific solvers handle 12
  void R;
  void pos;
  return null;
}

function solve(from: string, to: string, pos: number, thm: string, step: number): string[] | null {
  const L = ensure(from);
  const R = ensure(to);
  if (justify(L, R, pos)) return [R];
  if (thm === '12' && step === 6) return solve12s6(from, to, pos);
  if (thm === '12' && step === 7) return solve12s7(from, to, pos);
  const c = tryCreateCollapse(from, to, pos);
  if (c) return c;
  void tryOsCodeDist;
  return null;
}

function parseProofSteps(lines: string[]) {
  const steps: Array<{ start: number; end: number; canon: string; trail: string }> = [];
  let inMath = false;
  for (let i = 0; i < lines.length; i++) {
    if (/\\begin\{math\}/.test(lines[i]!)) {
      inMath = true;
      continue;
    }
    if (/\\end\{math\}/.test(lines[i]!)) {
      inMath = false;
      continue;
    }
    if (!inMath) continue;
    const isRq = /\\Rq/.test(lines[i]!);
    const isOpen = !isRq && /^\s*,/.test(lines[i]!) && /\\\\/.test(lines[i]!);
    if (!isRq && !isOpen) continue;
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
    if (canon.length > 2) steps.push({ start: i, end, canon, trail });
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
  const payload = lines.join(nl) + (raw.endsWith('\n') ? nl : '');
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      fs.writeFileSync(texPath, payload);
      break;
    } catch (e) {
      if (attempt === 7) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250 * (attempt + 1));
    }
  }
  return inserted;
}

const fails = fs
  .readFileSync(recheckPath, 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l) as { key: string; step: number; left: string; right: string });

const solved: Array<{ left: string; intermediates: string[]; label: string }> = [];
let open = 0;
for (const f of fails) {
  const thm = f.key.split('::')[1]!;
  const pos = keyPos(f.key);
  const path = solve(f.left, f.right, pos, thm, f.step);
  if (!path) {
    open++;
    continue;
  }
  const mids = path.slice(0, -1);
  console.log('CHAIN', thm, 's' + f.step, '+' + mids.length);
  if (mids.length)
    solved.push({ left: f.left, intermediates: mids.map(toBook), label: `thm ${thm} step ${f.step}` });
}
console.log('solved', fails.length - open, 'open', open);
const inserted = applyChains(solved);
console.log('inserted', inserted);
if (inserted > 0) {
  execSync('node scripts/extract-proof-steps.js', {
    cwd: root,
    stdio: 'pipe',
    maxBuffer: 64 * 1024 * 1024,
  });
}
