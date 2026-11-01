import fs from 'fs';
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
for (const f of fails.filter((x: { key: string }) => x.key.includes('::122::'))) {
  console.log('s' + f.step);
  console.log(' L', f.left.slice(0, 120));
  console.log(' R', f.right.slice(0, 120));
}
