/** What names does connectivity-0 produce for thm24 s2? */
import fs from 'fs';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { checkInferenceRules } from '../src/inferenceRules';
import { oneStepRewrites } from '../src/inferenceRules/tcSubstitution';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch14.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
const f = fails.find((x: { key: string; step: number }) => x.key.includes('::24::') && x.step === 2);
const L = ensure(stripDisplayIfConditions(f.left));
const R = ensure(stripDisplayIfConditions(f.right));
const rule = [...axioms, ...definitions, ...theorems].find((r) =>
  r.id.includes('rules-of-node-connectivity-0')
)!;
const rw = oneStepRewrites(L, rule.leftSide, rule.rightSide);
console.log('rewrites', rw.length);
for (const raw of rw) {
  const e = ensure(raw);
  const ok = checkInferenceRules(L, e, rule.leftSide, rule.rightSide).match;
  console.log('ok', ok);
  console.log(e.slice(0, 280));
  console.log('---');
}
console.log('GOAL', R.slice(0, 280));

// hand mid: expand first arm only with m1/n1
const mid1 = ensure(
  L.replace(
    /\\Bb\{i_1 \\Ps j_1\}\{,\\Bb\{m \\Pc n\}\{,([^}]*)\}\{,([^}]*)\},\}/,
    '\\Bb{i_1 \\Ps j_1}{,m \\Oc m_1,n \\Oc n_1,R(m_1),R(n_1),\\Bb{m_1 \\Ps n_1}{,m_1 \\Os,n_1 \\Os,$1}{,m_1 \\Os,n_1 \\Os,$2},}'
  )
);
console.log('\nhand mid1 justify', checkInferenceRules(L, mid1, rule.leftSide, rule.rightSide).match);
console.log('mid1', mid1.slice(0, 280));

const midBoth = R; // full goal
console.log('L→R via conn0', checkInferenceRules(L, midBoth, rule.leftSide, rule.rightSide).match);
