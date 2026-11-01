import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { checkInferenceRules } from '../src/inferenceRules';
import { matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { normalizeSpacing } from '../src/inferenceRules/utils';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';

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
const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch15.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

const axiomIds = new Set(axioms.map((r) => r.id));
const definitionIds = new Set(definitions.map((r) => r.id));

function getPositionForRule(rule: { id: string }): number {
  const early = earlyRulePosition(rule.id, CHAPTER_ORDER);
  if (early != null) return early;
  if (axiomIds.has(rule.id) || definitionIds.has(rule.id)) return -1;
  const m = rule.id.match(/^(.+)-(\d+)-[a-z0-9]+$/);
  if (!m) return 999999999;
  const baseName = m[1]!;
  const index = parseInt(m[2]!, 10) + 1;
  const filename = CHAPTER_ORDER.find((f) => f.toLowerCase().replace(/[^a-z0-9]+/g, '-') === baseName);
  if (!filename) return 999999999;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + index;
}
function getPositionForKey(key: string): number {
  const filename = key.split('::')[0] ?? '';
  const index = parseInt(key.split('::')[1] ?? '0', 10) || 0;
  return CHAPTER_ORDER.indexOf(filename) * 100000 + index;
}

function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: getPositionForRule(r),
}));

const dagCache = new Map();
const indexCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let index = indexCache.get(pos);
  if (index) return index;
  index = buildRuleIndex(
    allRules.filter((r) => r.pos < pos),
    dagCache
  );
  indexCache.set(pos, index);
  return index;
}

function justify(from: string, to: string, pos: number): string | null {
  const a = ensure(from);
  const b = ensure(to);
  if (a === b) return 'spacing';
  if (matchesDerivedBbTransition(a, b)) return 'derived-bb';
  const index = indexBefore(pos);
  for (const rule of getRulesForTransition(index, a, b)) {
    if (
      checkInferenceRules(a, b, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match
    ) {
      return rule.id;
    }
  }
  return null;
}

const INTERESTING =
  /identical-7|identical-15|identical-17|identical-72|identical-70|identical-73|create-next|create-copy|copy-identical|null-comparison|release-next|thm-R|node-continuity-[0-8]-|swap-release|mplbifi|isjmpm|empty-branch/i;

const thmFilter = process.argv.find((a) => a.startsWith('--thm='))?.slice('--thm='.length);

for (const f of fails) {
  const thm = f.key.split('::')[1];
  if (thmFilter && thm !== thmFilter) continue;
  const pos = getPositionForKey(f.key);
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log(`\n=== thm ${thm} step ${f.step} ===`);
  console.log('L', L);
  console.log('R', R);
  const direct = justify(L, R, pos);
  console.log('direct', direct);

  // Try flip72 one-hop intermediates for Blb/Bb Ps right-operand
  const flipRe = /\\B(?:lb|b)\s*\{([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)\}/g;
  let m: RegExpExecArray | null;
  const flips: string[] = [];
  while ((m = flipRe.exec(L))) {
    const flipped =
      L.slice(0, m.index) +
      m[0]!.replace(`${m[1]} \\Ps ${m[2]}`, `${m[2]} \\Ps ${m[1]}`) +
      L.slice(m.index + m[0]!.length);
    flips.push(ensure(flipped));
  }
  for (const fl of flips) {
    const via = justify(L, fl, pos);
    if (via) console.log('  flip via', via, '→', fl.slice(0, 100));
  }

  // Try interesting one-step rewrites toward R
  const rules = allRules.filter((r) => r.pos < pos && INTERESTING.test(r.id));
  let hits = 0;
  for (const rule of rules) {
    let rewrites: string[];
    try {
      rewrites = oneStepRewrites(L, rule.leftSide, rule.rightSide);
    } catch {
      continue;
    }
    for (const raw of rewrites) {
      const e = ensure(raw);
      if (
        !checkInferenceRules(L, e, rule.leftSide, rule.rightSide, {
          dagCache: indexBefore(pos).dagCache,
        }).match
      )
        continue;
      // score by shared prefix length with R
      let common = 0;
      const n = Math.min(e.length, R.length);
      while (common < n && e[common] === R[common]) common++;
      const closer = Math.abs(e.length - R.length) < Math.abs(L.length - R.length);
      if (e === R || closer || common > 40) {
        console.log(`  rewrite ${rule.id} common=${common} → ${e.slice(0, 120)}`);
        hits++;
        if (hits >= 8) break;
      }
    }
    if (hits >= 8) break;
  }
  if (hits === 0) console.log('  (no interesting rewrite hit)');
}
