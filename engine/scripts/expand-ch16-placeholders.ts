/**
 * Expand informal <1>/<2> macros in Rules_of_Relationship_of_Subnode proofs
 * (thm 23 swap Bb×Bb, thm 122 transitivity false-nest).
 *
 *   npx tsx engine/scripts/expand-ch16-placeholders.ts
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Relationship_of_Subnode.tex');

function expandBlock(
  lines: string[],
  start: number,
  end: number,
  macros: Record<string, string>
): { lines: string[]; removed: number; replaced: number } {
  const out: string[] = [];
  let removed = 0;
  let replaced = 0;
  for (let i = start; i <= end; i++) {
    let line = lines[i]!;
    // Drop macro-definition lines: `<1> \Rq ...` or `<1>,<2>\\` notes / bare `<2>, s2 Os`
    if (/^\s*<\d+>\s*\\Rq/.test(line)) {
      removed++;
      continue;
    }
    if (/^\s*<\d+>(\s*,\s*<\d+>)?\s*\\+\s*$/.test(line.trim())) {
      removed++;
      continue;
    }
    if (/^\s*<\d+>\s*,/.test(line) && !/\\Rq/.test(line)) {
      // e.g. `<2>, s_2 \Os, \\` — expand and keep as non-Rq note? Better expand into Rq body if prior was Rq.
      // Turn into a continuation fragment by expanding macros only.
      for (const [k, v] of Object.entries(macros)) {
        if (line.includes(k)) {
          line = line.split(k).join(v);
          replaced++;
        }
      }
      // If still only trailing junk without \Rq, drop
      if (!/\\Rq/.test(line) && /^[\s,\\]*$/.test(line.replace(/[A-Za-z0-9_\\\{\}\s,]|\\[A-Za-z]+/g, ''))) {
        // keep expanded line as comment-like proof fragment with leading Rq if it has content
        const body = line.replace(/\\+\s*$/, '').trim();
        if (body && !/^,?\s*$/.test(body)) {
          out.push(`\\Rq, ${body.replace(/^,/, '')}${line.match(/(\\+)\s*$/)?.[1] ?? '\\\\'}`);
        } else {
          removed++;
        }
        continue;
      }
      out.push(line);
      continue;
    }
    for (const [k, v] of Object.entries(macros)) {
      if (line.includes(k)) {
        line = line.split(k).join(v);
        replaced++;
      }
    }
    out.push(line);
  }
  return { lines: out, removed, replaced };
}

function findMathBlock(lines: string[], afterLine: number): { start: number; end: number } | null {
  let start = -1;
  for (let i = afterLine; i < lines.length; i++) {
    if (/\\begin\{math\}/.test(lines[i]!)) {
      start = i;
      break;
    }
  }
  if (start < 0) return null;
  for (let i = start + 1; i < lines.length; i++) {
    if (/\\end\{math\}/.test(lines[i]!)) return { start, end: i };
  }
  return null;
}

const raw = fs.readFileSync(texPath, 'utf8');
const nl = raw.includes('\r\n') ? '\r\n' : '\n';
const lines = raw.split(/\r?\n/);

// --- Theorem 23: Bb×Bb swap ---
const thm23Stmt = lines.findIndex((l) =>
  /\\Bb\{if\(i \\Pb j\)\}\{,\\Bb\{if\(m \\Pb n\)\}/.test(l)
);
const block23 = findMathBlock(lines, thm23Stmt);
if (!block23) throw new Error('thm23 math block not found');
const m1_23 = '\\Bb{if(i \\Pu)}{, i \\Od s_1, }{, i \\Ob t_1, \\Bb{if(t_1 \\Pc j)}{, \\Ot s_1,}{, i \\Od s_1,}, t_1 \\Os,}';
const m2_23 = '\\Bb{if(m \\Pu)}{, m \\Od s_2, }{, m \\Ob t_2, \\Bb{if(t_2 \\Pc n)}{, \\Ot s_2,}{, m \\Od s_2,}, t_2 \\Os,}';

// --- Theorem 122: false-nest transitivity (statement ends with nested false) ---
const thm122Stmt = lines.findIndex((l) =>
  /\\Bb\{if\(i \\Pb j\)\}\{,\\Tc c_1,\}\{,\\Bb\{if\(i \\Pb j\)\}/.test(l)
);
const block122 = findMathBlock(lines, thm122Stmt);
if (!block122) throw new Error('thm122 math block not found');
const m1_122 = 'i \\Ob t_1, \\Bb{if(t_1 \\Pc j)}{, \\Ot s_1,}{, i \\Od s_1,}, t_1 \\Os';
const m2_122 = 'i \\Ob t_2, \\Bb{if(t_2 \\Pc j)}{, \\Ot s_2,}{, i \\Od s_2,}, t_2 \\Os';

// Apply from bottom so indices stay valid
const jobs = [
  { block: block122, macros: { '<1>': m1_122, '<2>': m2_122 }, label: '122' },
  { block: block23, macros: { '<1>': m1_23, '<2>': m2_23 }, label: '23' },
];

let totalRemoved = 0;
let totalReplaced = 0;
for (const job of jobs) {
  const { start, end } = job.block;
  const { lines: mid, removed, replaced } = expandBlock(lines, start + 1, end - 1, job.macros);
  lines.splice(start + 1, end - start - 1, ...mid);
  totalRemoved += removed;
  totalReplaced += replaced;
  console.log(`thm ${job.label}: removed ${removed} def/note lines, expanded ${replaced} placeholder sites`);
}

if (/<\d+>/.test(lines.join('\n'))) {
  const leftover = [...lines.join('\n').matchAll(/<\d+>/g)].map((m) => m[0]);
  console.log('WARNING leftover placeholders:', [...new Set(leftover)]);
} else {
  console.log('no leftover <n> placeholders');
}

fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
console.log('wrote', texPath, 'removedDefs=', totalRemoved, 'expansions=', totalReplaced);
