/** Classify ch14 fails from recheck or proof-step-failures. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function load() {
  for (const name of ['recheck-ch14.jsonl', 'proof-step-failures.jsonl']) {
    const p = path.join(__dirname, 'out', name);
    if (!fs.existsSync(p)) continue;
    const t = fs.readFileSync(p, 'utf8').trim();
    if (!t) continue;
    const rows = t.split(/\n/).map((l) => JSON.parse(l));
    if (rows.length) return { name, rows };
  }
  throw new Error('no fails');
}
function topItems(e: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < e.length; i++) {
    const c = e[i]!;
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === ',' && depth === 0) {
      const p = e.slice(start, i).trim();
      if (p) items.push(p);
      start = i + 1;
    }
  }
  const t = e.slice(start).trim();
  if (t) items.push(t);
  return items;
}
function multi(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const c = new Map<string, number>();
  for (const x of a) c.set(x, (c.get(x) ?? 0) + 1);
  for (const x of b) c.set(x, (c.get(x) ?? 0) - 1);
  for (const v of c.values()) if (v) return false;
  return true;
}

const { name, rows } = load();
console.log('source', name, 'count', rows.length);
const byThm = new Map<string, number>();
for (const f of rows) {
  const thm = f.key.split('::')[1]!;
  byThm.set(thm, (byThm.get(thm) ?? 0) + 1);
  const AL = topItems(f.left);
  const AR = topItems(f.right);
  const same = multi(AL, AR);
  const kinds: string[] = [];
  if (same) kinds.push('reorder');
  else if (AL.length > AR.length) kinds.push('shrink');
  else if (AL.length < AR.length) kinds.push('grow');
  else kinds.push('restruct');
  if (/\\Pu|\\nPu/.test(f.left + f.right) && /\\Bb|\\Blb/.test(f.left + f.right)) kinds.push('pu-arm');
  if (/<\d+>/.test(f.left + f.right)) kinds.push('placeholder');
  console.log(thm, 's' + f.step, kinds.join('+'), AL.length + '→' + AR.length);
}
console.log('byThm', Object.fromEntries([...byThm.entries()].sort()));
