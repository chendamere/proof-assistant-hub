import fs from 'fs';
import { matchesObBbOsUnzip, matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

for (const step of [14, 16, 17, 23]) {
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === step);
  if (!f) {
    console.log('s' + step, 'missing');
    continue;
  }
  console.log('\n=== s' + step);
  console.log('L', f.left);
  console.log('R', f.right);
  console.log('unzip', matchesObBbOsUnzip(f.left, f.right), 'derived', matchesDerivedBbTransition(f.left, f.right));
}
