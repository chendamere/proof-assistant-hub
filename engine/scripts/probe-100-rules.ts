import { theorems } from '../../src/data/theorems';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { checkInferenceRules } from '../src/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
const POS = 13 * 100000 + 100;

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

const all = [...axioms, ...definitions, ...theorems];
console.log('--- Os distribute-like rules ---');
for (const t of all) {
  const L = t.leftSide || '';
  const R = t.rightSide || '';
  if (!/\\Os/.test(L + R)) continue;
  if (!/\\B(?:lb|b)/.test(L + R)) continue;
  const topOsLeft = /\\Os,\s*\\B/.test(L) || /\\Os,\\B/.test(L.replace(/\s/g, ''));
  const armOsRight = /\\B[^{]*\{[^}]*\\Os/.test(R);
  if (topOsLeft && armOsRight) {
    console.log(t.id);
    console.log(' L', L);
    console.log(' R', R);
  }
}

console.log('\n--- R / Oc distribute-like ---');
for (const t of all) {
  const L = t.leftSide || '';
  const R = t.rightSide || '';
  if (!/\\B(?:lb|b)/.test(L + R)) continue;
  if (
    (/R\([^)]+\),\s*\\B/.test(L) || /\\Oc [^,]+,\s*\\B/.test(L)) &&
    (/\{[^}]*R\(/.test(R) || /\{[^}]*\\Oc/.test(R))
  ) {
    console.log(t.id);
    console.log(' L', L);
    console.log(' R', R);
  }
}

// Test whether identical-15 applies to Bb non-empty
const rule15 = all.find((t) => t.id.includes('identical-node-comparison-15'))!;
const L =
  ',i \\Oc i_1,i \\Oc i_2,R(i_2),i_2 \\Os,j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_1 \\Os,j_1 \\Os,\\Tc c_2a,},';
const Rpush =
  ',i \\Oc i_1,i \\Oc i_2,R(i_2),j \\Oc j_1,R(i_1),R(j_1),\\Bb{i_1 \\Ps j_1}{,i_2 \\Os,\\Bb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,\\Tc c_1,}{,i_1 \\Os,j_1 \\Os,\\Tc c_3,},}{,i_2 \\Os,i_1 \\Os,j_1 \\Os,\\Tc c_2a,},';
console.log('\nidentical-15 on Bb nonempty?', checkInferenceRules(ensure(L), ensure(Rpush), rule15.leftSide, rule15.rightSide).match);

// Try Blb instead of Bb
const Lblb = ensure(L.replace(/\\Bb\{/g, '\\Blb{'));
const Rblb = ensure(Rpush.replace(/\\Bb\{/g, '\\Blb{'));
console.log('identical-15 on Blb nonempty?', checkInferenceRules(Lblb, Rblb, rule15.leftSide, rule15.rightSide).match);

// Try with empty arms Blb
const L0 = ensure(',i_2 \\Os,\\Blb{i_1 \\Ps j_1}{,}{,},');
const R0 = ensure(',\\Blb{i_1 \\Ps j_1}{,i_2 \\Os,}{,i_2 \\Os,},');
console.log('identical-15 empty Blb?', checkInferenceRules(L0, R0, rule15.leftSide, rule15.rightSide).match);

// Scan ALL early rules for L→Rpush
const indexed = all.map((r) => ({ ...r, pos: posOf(r.id) })).filter((r) => r.pos < POS);
const index = buildRuleIndex(indexed, new Map());
console.log('\nAny rule L→Rpush?');
for (const rule of getRulesForTransition(index, ensure(L), ensure(Rpush))) {
  if (rule.id.includes('error-code') || rule.id.includes('equiv-code')) continue;
  if (checkInferenceRules(ensure(L), ensure(Rpush), rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
    console.log(' HIT', rule.id);
  }
}

// Also try goal R of s4
const fails = fs
  .readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f4 = fails.find((x) => x.key.includes('::100::') && x.step === 4)!;
console.log('\ns4 any direct rule?');
for (const rule of getRulesForTransition(index, ensure(f4.left), ensure(f4.right))) {
  if (rule.id.includes('error-code') || rule.id.includes('equiv-code')) continue;
  if (
    checkInferenceRules(ensure(f4.left), ensure(f4.right), rule.leftSide, rule.rightSide, {
      dagCache: index.dagCache,
    }).match
  )
    console.log(' HIT', rule.id);
}

// Mid: push with c_2a kept, then rename?
const mid = ensure(Rpush);
console.log('L→mid', checkInferenceRules(ensure(L), mid, rule15.leftSide, rule15.rightSide).match);
console.log('mid→R via any?');
for (const rule of getRulesForTransition(index, mid, ensure(f4.right))) {
  if (
    checkInferenceRules(mid, ensure(f4.right), rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match
  )
    console.log(' HIT', rule.id);
}
