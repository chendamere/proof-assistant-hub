import fs from 'fs';
const fails = fs
  .readFileSync('engine/scripts/out/recheck-ch16.jsonl', 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));
console.log('count', fails.length);
const byThm: Record<string, number> = {};
for (const f of fails) {
  const t = f.key.split('::')[1]!;
  byThm[t] = (byThm[t] ?? 0) + 1;
}
console.log(
  Object.entries(byThm)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => k + ':' + v)
    .join(' ')
);
for (const f of fails.slice(0, 10)) {
  console.log('---', f.key.split('::')[1], 's' + f.step);
  console.log('L', f.left.slice(0, 110));
  console.log('R', f.right.slice(0, 110));
}
