import { matchesPsPastUnzippedBb, matchesDerivedBbTransition } from '../src/inferenceRules/caseFocus';
import fs from 'fs';

const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

for (const step of [2, 4, 15]) {
  const f = fails.find((x: { key: string; step: number }) => x.key.includes('::122::') && x.step === step);
  if (!f) {
    console.log('s' + step, 'missing');
    continue;
  }
  console.log(
    's' + step,
    'psPast',
    matchesPsPastUnzippedBb(f.left, f.right),
    'derived',
    matchesDerivedBbTransition(f.left, f.right)
  );
}
