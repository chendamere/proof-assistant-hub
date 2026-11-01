import fs from 'fs';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';
import { matchesDerivedBbTransition, matchesObBbOsUnzip } from '../src/inferenceRules/caseFocus';

function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(stripDisplayIfConditions(s))).trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .filter(Boolean)
  .map((l) => JSON.parse(l));
for (const f of fails.filter((x: { key: string }) => x.key.includes('::122::'))) {
  const d = matchesDerivedBbTransition(ensure(f.left), ensure(f.right));
  const u = matchesObBbOsUnzip(ensure(f.left), ensure(f.right));
  console.log('s' + f.step, 'derived', d, 'unzip', u);
  if (!d) {
    console.log('  L', f.left.slice(0, 100));
    console.log('  R', f.right.slice(0, 100));
  }
}
