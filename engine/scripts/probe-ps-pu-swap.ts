import fs from 'fs';
import { checkInferenceRules } from '../src/inferenceRules';
import { theorems } from '../../src/data/theorems';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

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

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x) => x.key.includes('::124::') && x.step === 34)!;
const L = ensure(f.left);
const R = ensure(f.right);
const flip = ensure(L.replace('i_1 \\Ps i,', 'i \\Ps i_1,'));
const reord = ensure(flip.replace('i \\Ps i_1,i_1 \\Pu,', 'i_1 \\Pu,i \\Ps i_1,'));
console.log('reord==R', reord === R);
console.log('flip arm', flip.match(/\\Bb\{i \\Pu\}\{[^}]+\}/)?.[0]);
console.log('reord arm', reord.match(/\\Bb\{i \\Pu\}\{[^}]+\}/)?.[0]);

const rule = theorems.find((t) => t.id.includes('identical-node-comparison-54'))!;
console.log('rule', rule.id, rule.leftSide, rule.rightSide);

const r1 = checkInferenceRules(flip, reord, rule.leftSide, rule.rightSide);
console.log('54 match', r1);

// try both directions
const r2 = checkInferenceRules(flip, reord, rule.rightSide, rule.leftSide);
console.log('54 rev', r2);

// minimal pair
const a = ',i \\Ps i_1, i_1 \\Pu,';
const b = ',i_1 \\Pu, i \\Ps i_1,';
console.log('minimal', checkInferenceRules(a, b, rule.leftSide, rule.rightSide));
console.log('minimal ensure', checkInferenceRules(ensure(a), ensure(b), rule.leftSide, rule.rightSide));

// Is the issue that i_1 appears in BOTH Ps and Pu so schematic collision?
// Rule: i Ps j, m Pu → m Pu, i Ps j
// Binding: i→i, j→i_1, m→i_1  — m and j both i_1, should be fine (same value)

// Try thm with j Pu specifically
const rule55ish = theorems.filter((t) => /i \\Ps j, j \\Pu/.test(t.leftSide) || /j \\Pu, i \\Ps j/.test(t.leftSide));
for (const t of rule55ish.slice(0, 10)) {
  console.log('cand', t.id, t.leftSide, '⟺', t.rightSide);
  console.log(
    '  ',
    checkInferenceRules(flip, reord, t.leftSide, t.rightSide).match,
    checkInferenceRules(flip, reord, t.rightSide, t.leftSide).match
  );
}
