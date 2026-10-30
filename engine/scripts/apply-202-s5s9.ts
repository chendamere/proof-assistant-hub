/** Insert justified s5/s9 mids for thm 202 by exact tex-line anchors. */
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
import { normalizeSpacing, stripDisplayIfConditions } from '../src/inferenceRules/utils';

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
const texPath = path.join(__dirname, '../../src/data/theorems/Rules_of_Node_Connectivity.tex');

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
function fingerprint(expr: string): string {
  return ensure(stripDisplayIfConditions(expr))
    .replace(/,\s+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}
function bookBody(expr: string) {
  let body = toBook(expr).trim();
  if (!body.startsWith(',')) body = ',' + body;
  if (!body.endsWith(',')) body = body + ',';
  return body.replace(/,(?!\s)/g, ', ').replace(/,\s+$/, ',');
}
function topItems(e: string): string[] {
  const s = ensure(e);
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    else if (s[i] === ',' && depth === 0) {
      const p = s.slice(start, i).trim();
      if (p) items.push(p);
      start = i + 1;
    }
  }
  const t = s.slice(start).trim();
  if (t) items.push(t);
  return items;
}
function joinItems(items: string[]) {
  return ensure(',' + items.join(',') + ',');
}
function swapAdj(e: string, i: number) {
  const items = topItems(e);
  const sw = items.slice();
  [sw[i], sw[i + 1]] = [sw[i + 1]!, sw[i]!];
  return joinItems(sw);
}

const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const pos = 13 * 100000 + 202;
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < pos),
  new Map()
);
function justify(a: string, b: string) {
  const A = ensure(a);
  const B = ensure(b);
  if (A === B) return 'spacing';
  for (const rule of getRulesForTransition(index, A, B)) {
    if (rule.id.includes('equiv-code') || rule.id.includes('error-code')) continue;
    if (rule.id.includes('identical-4') && rule.leftSide.replace(/\s/g, '') === ',') continue;
    if (checkInferenceRules(A, B, rule.leftSide, rule.rightSide, { dagCache: index.dagCache }).match)
      return rule.id;
  }
  return null;
}

function rqFingerprint(line: string): string {
  return fingerprint(line.replace(/^\s*\\Rq\s*/, '').replace(/\\+\s*$/, ''));
}

function insertAfterMatching(pred: (fp: string, line: string) => boolean, mids: string[], label: string, nextPred?: (fp: string) => boolean) {
  const raw = fs.readFileSync(texPath, 'utf8');
  const nl = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(/\r?\n/);
  const matches: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!/\\Rq/.test(lines[i]!)) continue;
    const fp = rqFingerprint(lines[i]!);
    if (!pred(fp, lines[i]!)) continue;
    if (nextPred) {
      let ns = i + 1;
      while (ns < lines.length && !/\\Rq/.test(lines[ns]!) && lines[ns]!.trim()) ns++;
      if (ns >= lines.length || !/\\Rq/.test(lines[ns]!)) continue;
      if (!nextPred(rqFingerprint(lines[ns]!))) continue;
    }
    matches.push(i);
  }
  console.log(label, 'matches', matches);
  if (matches.length !== 1) {
    console.log('FAIL unique anchor');
    return false;
  }
  const i = matches[0]!;
  const tm = lines[i]!.match(/(\\+)\s*$/);
  const trail = tm ? tm[1]! : '\\\\\\\\';
  const block = mids.map((mid) => `\\Rq${bookBody(mid)}${trail}`);
  lines.splice(i + 1, 0, ...block);
  fs.writeFileSync(texPath, lines.join(nl) + (raw.endsWith('\n') ? nl : ''));
  console.log('OK inserted', block.length, label);
  return true;
}

// --- s5 ---
{
  const L = ensure(
    ',i \\Oc i_1,R(i_1),j \\Oc j_2,j \\Oc j_1,j_2 \\Ps j_1,R(j_2),R\\_(j_1),\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,},'
  );
  const R = ensure(
    ',i \\Oc i_1,R(i_1),j \\Oc j_2,j \\Oc j_1,j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,\\Blb{i_1 \\Ps j_2}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,},'
  );
  let cur = L;
  const mids: string[] = [];
  const rules: string[] = [];
  const hop = (next: string, label: string) => {
    const e = ensure(next);
    const j = justify(cur, e);
    console.log('s5', label, j);
    if (!j) throw new Error(label);
    rules.push(j);
    if (e !== R) mids.push(e);
    cur = e;
  };
  hop(cur.replace(',j_2 \\Ps j_1,R(j_2),', ',j_2 \\Ps j_1,j_2 \\Ps j_1,R(j_2),'), 'dup');
  for (let k = 0; k < 2; k++) {
    const items = topItems(cur);
    let seen = 0;
    let idx = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i] === 'j_2 \\Ps j_1') {
        seen++;
        if (seen === 2) {
          idx = i;
          break;
        }
      }
    }
    hop(swapAdj(cur, idx), 'bubble' + (k + 1));
  }
  if (cur !== R && !justify(cur, R)) throw new Error('s5 incomplete');
  console.log('s5 rules', rules);
  insertAfterMatching(
    (fp) => fp === fingerprint(L),
    mids,
    's5',
    (fp) => fp === fingerprint(R)
  );
}

// --- s9 ---
{
  const L = ensure(
    ',i \\Oc i_1,R(i_1),j \\Oc j_2,j \\Oc j_1,j_2 \\Ps j_1,R(j_2),R\\_(j_1),j_2 \\Ps j_1,\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,},'
  );
  const R = ensure(
    ',i \\Oc i_1,R(i_1),j \\Oc j_2,j \\Oc j_1,j_2 \\Ps j_1,R(j_2),R\\_(j_1),\\Blb{i_1 \\Ps j_1}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,}{,i_1 \\Os,j_1 \\Os,j_2 \\Os,},'
  );
  let cur = L;
  const mids: string[] = [];
  const rules: string[] = [];
  const hop = (next: string, label: string) => {
    const e = ensure(next);
    const j = justify(cur, e);
    console.log('s9', label, j);
    if (!j) throw new Error(label);
    rules.push(j);
    if (e !== R) mids.push(e);
    cur = e;
  };
  for (let k = 0; k < 2; k++) {
    const items = topItems(cur);
    let seen = 0;
    let idx = -1;
    for (let i = 0; i < items.length; i++) {
      if (items[i] === 'j_2 \\Ps j_1') {
        seen++;
        if (seen === 2) {
          idx = i;
          break;
        }
      }
    }
    hop(swapAdj(cur, idx - 1), 'bubble left' + (k + 1));
  }
  hop(cur.replace(',j_2 \\Ps j_1,j_2 \\Ps j_1,', ',j_2 \\Ps j_1,'), 'drop');
  if (cur !== R && !justify(cur, R)) throw new Error('s9 incomplete');
  console.log('s9 rules', rules);
  insertAfterMatching(
    (fp) => fp === fingerprint(L),
    mids,
    's9',
    (fp) => fp === fingerprint(R)
  );
}

// dump nearby fps for diagnosis
{
  const raw = fs.readFileSync(texPath, 'utf8');
  const lines = raw.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!/\\Rq/.test(lines[i]!)) continue;
    if (!/j_2 \\Ps j_1/.test(lines[i]!)) continue;
    const fp = rqFingerprint(lines[i]!);
    const nPs = (fp.match(/j_2 \\Ps j_1/g) || []).length;
    const blb = fp.match(/\\Blb\{([^}]*)\}/)?.[1];
    console.log('line', i + 1, 'nPs', nPs, 'blb', blb, 'fp', fp.slice(0, 120));
  }
}
