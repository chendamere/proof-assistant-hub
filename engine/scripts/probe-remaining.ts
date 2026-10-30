/** Classify each remaining fail and try known one-hop / short-chain candidates. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { checkInferenceRules } from '../src/inferenceRules';
import { axioms } from '../../src/data/axioms';
import { definitions } from '../../src/data/definitions';
import { theorems } from '../../src/data/theorems';
import { buildRuleIndex, getRulesForTransition } from '../src/inferenceRules/ruleIndex';
import { earlyRulePosition } from '../../src/data/rulePosition';
import { fromOperatorFirst } from '../src/inferenceRules/operatorFirst';
import { normalizeSpacing } from '../src/inferenceRules/utils';

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
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const indexCache = new Map<number, ReturnType<typeof buildRuleIndex>>();
function indexBefore(pos: number) {
  let ix = indexCache.get(pos);
  if (!ix) {
    ix = buildRuleIndex(
      allRules.filter((r) => r.pos < pos),
      new Map()
    );
    indexCache.set(pos, ix);
  }
  return ix;
}
const memo = new Map<string, string | null>();
function justify(a: string, b: string, pos: number) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  const key = pos + '|' + A + '=>' + B;
  if (memo.has(key)) return memo.get(key)!;
  const index = indexBefore(pos);
  let hit: string | null = null;
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match) {
      hit = rule.id;
      break;
    }
  }
  memo.set(key, hit);
  return hit;
}

function candidates(L: string, R: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const e = ensure(s);
    if (e !== L && e !== ensure(L)) out.push(e);
  };

  // arm Os reorder inside Blb/Bb (swap first two Os in both arms)
  add(
    L.replace(
      /\\(B[bl]b)\{([^}]*)\}\{,i_1 \\Os,j_1 \\Os,([^}]*)\}\{,i_1 \\Os,j_1 \\Os,([^}]*)\}/,
      '\\$1{$2}{,j_1 \\Os,i_1 \\Os,$3}{,j_1 \\Os,i_1 \\Os,$4}'
    )
  );
  add(
    L.replace(
      /\\Blb\{([^}]*)\}\{,i_1 \\Os,j_1 \\Os,\}\{,i_1 \\Os,j_1 \\Os,\}/,
      '\\Blb{$1}{,j_1 \\Os,i_1 \\Os,}{,j_1 \\Os,i_1 \\Os,}'
    )
  );
  // Ot m to end of both arms
  add(
    L.replace(
      /\\Blb\{([^}]*)\}\{,\\Ot m,i_1 \\Os,j_1 \\Os,\}\{,\\Ot m,i_1 \\Os,j_1 \\Os,\}/,
      '\\Blb{$1}{,i_1 \\Os,j_1 \\Os,\\Ot m,}{,i_1 \\Os,j_1 \\Os,\\Ot m,}'
    )
  );
  // swap Ot past one Os
  add(
    L.replace(
      /\\Blb\{([^}]*)\}\{,\\Ot m,i_1 \\Os,j_1 \\Os,\}\{,\\Ot m,i_1 \\Os,j_1 \\Os,\}/,
      '\\Blb{$1}{,i_1 \\Os,\\Ot m,j_1 \\Os,}{,i_1 \\Os,\\Ot m,j_1 \\Os,}'
    )
  );

  // add/drop duplicate Ps
  add(L.replace(/(j_2 \\Ps j_1),(R\(j_2\),R\\_\(j_1\),)/, '$1,$2$1,'));
  add(L.replace(/(j_2 \\Ps j_1),(R\(j_2\),R\\_\(j_1\),)\1,/, '$1,$2'));
  add(L.replace(/,j_2 \\Ps j_1,R\(j_2\),R\\_\(j_1\),j_2 \\Ps j_1,/, ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),'));
  add(L.replace(/,j_2 \\Ps j_1,R\(j_2\),R\\_\(j_1\),\\Blb/, ',j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,\\Blb'));
  add(L.replace(/,i_1 \\Ps i_2,R\(i_2\),R\(i_1\),R\(j_1\),/, ',i_1 \\Ps i_2,R(i_2),R(i_1),i_1 \\Ps i_2,R(j_1),'));
  add(L.replace(/,i_1 \\Ps i_2,R\(i_2\),R\(i_1\),i_1 \\Ps i_2,R\(j_1\),/, ',i_1 \\Ps i_2,R(i_2),R(i_1),R(j_1),'));
  add(L.replace(/,j_1 \\Ps j_2,R\(j_2\),R\(j_1\),\\Bb/, ',j_1 \\Ps j_2,R(j_2),R(j_1),j_1 \\Ps j_2,\\Bb'));
  add(L.replace(/,j_1 \\Ps j_2,R\(j_2\),R\(j_1\),j_1 \\Ps j_2,\\Bb/, ',j_1 \\Ps j_2,R(j_2),R(j_1),\\Bb'));

  // copy-identical add Ps next to Oc
  add(L.replace(/,i \\Oc i_2,/, ',i \\Oc i_2,i \\Ps i_1,'));
  add(L.replace(/,i \\Oc i_2,i_1 \\Op,/, ',i \\Oc i_2,i \\Ps i_1,i_1 \\Op,'));
  add(L.replace(/(i \\On,i_1 \\On,)(i \\Oc i_2,)/, '$1i \\Ps i_1,$2'));
  add(L.replace(/(i \\On,i_1 \\On,)(R\(i_1\),i \\Oc i_2,)/, '$1i \\Ps i_1,$2'));

  // identical-72 style: i1 Ps j1 → i1 Ps j2 given j1 Ps j2
  add(L.replace(/,i_1 \\Ps j_1,/, ',i_1 \\Ps j_2,'));
  add(L.replace(/,i_1 \\Ps j_2,/, ',i_1 \\Ps j_1,'));
  add(L.replace(/\\Bb\{i_2 \\Ps j_1\}/, '\\Bb{i_2 \\Ps j_2}'));
  add(L.replace(/\\Bb\{i_2 \\Ps j_2\}/, '\\Bb{i_2 \\Ps j_1}'));
  add(L.replace(/\\Blb\{i_1 \\Ps j_2\}/, '\\Blb{i_1 \\Ps j_1}'));
  add(L.replace(/\\Blb\{i_1 \\Ps j_1\}/, '\\Blb{i_1 \\Ps j_2}'));

  // thm-R-i-release insert/drop
  add(L.replace(/,i_2 \\Os,/, ',R(i_2),i_2 \\Os,'));
  add(L.replace(/,R\(i_2\),i_2 \\Os,/, ',i_2 \\Os,'));
  add(L.replace(/,j_2 \\Os,/, ',R(j_2),j_2 \\Os,'));
  add(L.replace(/,R\(j_2\),j_2 \\Os,/, ',j_2 \\Os,'));
  add(L.replace(/,i_2 \\Os,j \\Oc/, ',R(i_2),i_2 \\Os,j \\Oc'));

  // pull equal-arm Os out of Blb
  add(
    L.replace(
      /\\Blb\{([^}]*)\}\{,i_1 \\Os,j_1 \\Os,j_2 \\Os,\}\{,i_1 \\Os,j_1 \\Os,j_2 \\Os,\}/,
      'j_2 \\Os,\\Blb{$1}{,i_1 \\Os,j_1 \\Os,}{,i_1 \\Os,j_1 \\Os,}'
    )
  );
  add(
    L.replace(
      /\\Blb\{([^}]*)\}\{,i_1 \\Os,j_1 \\Os,\}\{,i_1 \\Os,j_1 \\Os,\}/,
      'i_1 \\Os,\\Blb{$1}{,j_1 \\Os,}{,j_1 \\Os,}'
    )
  );
  add(
    L.replace(
      /,i \\Oc i_1,j \\Oc j_1,\\Bb\{i \\Pu\}\{,i_1 \\Os,([^}]*)\}\{,i_1 \\Os,\1\},/,
      ',i \\Oc i_1,i_1 \\Os,j \\Oc j_1,\\Bb{i \\Pu}{,$1}{,$1},'
    )
  );

  // drop empty Bb
  add(L.replace(/,\\Bb\{i \\Pu\}\{,\}\{,\},/, ','));
  add(L.replace(/j \\Oc j_1,\\Bb\{i \\Pu\}\{,\}\{,\},/, 'j \\Oc j_1,'));

  // drop i Ps i1 + i1 Pu (200)
  add(L.replace(/,i \\Ps i_1,i_1 \\Pu,/, ','));
  add(L.replace(/,i \\Ps i_1,/, ','));
  add(L.replace(/,i_1 \\Pu,/, ','));

  // drop flags / create-copy
  add(L.replace(/,i_1 \\Pu,i_1 \\On,i_1 \\Op,R\\_\(i_1\),/, ','));
  add(L.replace(/,i \\Ps i_1,i_1 \\Ps i_2,/, ','));
  add(L.replace(/,i \\Ps i_1,i_1 \\Ps i_2,R\(i_2\),i_1 \\Op,R\\_\(i_1\),R\(j_1\),i_1 \\Ps i_2,/, ',R(i_2),i_1 \\Op,R\\_(i_1),R(j_1),'));

  // 202 s3: move j1 Os into arms + reorder
  add(
    L.replace(
      /,i \\Oc i_1,j \\Oc j_2,j \\Oc j_1,R\\_\(j_1\),j_1 \\Os,R\(i_1\),R\(j_2\),\\Blb\{i_1 \\Ps j_2\}\{,i_1 \\Os,j_2 \\Os,\}\{,i_1 \\Os,j_2 \\Os,\}/,
      ',i \\Oc i_1,R(i_1),j \\Oc j_2,j \\Oc j_1,R(j_2),R\\_(j_1),\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}'
    )
  );
  add(
    L.replace(
      /,R\\_\(j_1\),j_1 \\Os,R\(i_1\),R\(j_2\),\\Blb\{i_1 \\Ps j_2\}\{,i_1 \\Os,j_2 \\Os,\}\{,i_1 \\Os,j_2 \\Os,\}/,
      ',R\\_(j_1),R(i_1),R(j_2),\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}'
    )
  );

  // Os into arms via identical-15 reverse
  add(
    L.replace(
      /,j_1 \\Os,R\(i_1\),R\(j_2\),\\Blb\{i_1 \\Ps j_2\}\{,i_1 \\Os,j_2 \\Os,\}\{,i_1 \\Os,j_2 \\Os,\}/,
      ',R(i_1),R(j_2),\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}'
    )
  );

  void R;
  return [...new Set(out)];
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

const thmFilter = process.argv[2] ? parseInt(process.argv[2], 10) : null;
const results: any[] = [];

for (const f of fails) {
  const thm = parseInt(f.key.split('::')[1]!, 10);
  if (thmFilter != null && thm !== thmFilter) continue;
  const pos = 13 * 100000 + thm;
  const L = ensure(f.left);
  const R = ensure(f.right);
  const direct = justify(L, R, pos);
  const hits: { label: string; rule: string; reaches: boolean }[] = [];
  if (direct) hits.push({ label: 'direct', rule: direct, reaches: true });
  for (const c of candidates(L, R)) {
    const j = justify(L, c, pos);
    if (!j) continue;
    const reaches = c === R || !!justify(c, R, pos);
    hits.push({ label: c.slice(0, 120), rule: j, reaches });
    if (reaches) break;
  }
  // two-hop: first hit then candidates from there
  if (!hits.some((h) => h.reaches)) {
    for (const c of candidates(L, R)) {
      const j1 = justify(L, c, pos);
      if (!j1) continue;
      for (const c2 of candidates(c, R)) {
        const j2 = justify(c, c2, pos);
        if (!j2) continue;
        const reaches = c2 === R || !!justify(c2, R, pos);
        if (reaches) {
          hits.push({ label: `2hop:${j1}->${j2}`, rule: j2, reaches: true });
          break;
        }
      }
      if (hits.some((h) => h.reaches)) break;
    }
  }
  const ok = hits.find((h) => h.reaches);
  console.log(
    `${thm} s${f.step}: ${ok ? 'SOLVED ' + ok.rule : hits.length ? 'PARTIAL ' + hits[0]!.rule : 'OPEN'} (${hits.length} hits)`
  );
  results.push({ thm, step: f.step, ok: !!ok, hits: hits.slice(0, 5) });
}

fs.writeFileSync(path.join(__dirname, 'out/probe-remaining.json'), JSON.stringify(results, null, 2));
console.log('wrote probe-remaining.json');
