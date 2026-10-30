/** Probe solvable hops for remaining 124 fails. */
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
function ensure(s: string) {
  let t = normalizeSpacing(fromOperatorFirst(s)).replace(/R_\(/g, 'R\\_(').trim();
  if (!t.startsWith(',')) t = ',' + t;
  if (!t.endsWith(',')) t = t + ',';
  return t;
}
function topItems(e: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  const s = ensure(e);
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

const POS = 13 * 100000 + 124;
const allRules = [...axioms, ...definitions, ...theorems].map((r) => ({
  id: r.id,
  leftSide: r.leftSide,
  rightSide: r.rightSide,
  pos: posOf(r.id),
}));
const index = buildRuleIndex(
  allRules.filter((r) => r.pos < POS),
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

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-one.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l));

function tryDropOne(L: string, R: string) {
  const li = topItems(L);
  const ri = topItems(R);
  const results: string[] = [];
  for (let i = 0; i < li.length; i++) {
    const next = joinItems([...li.slice(0, i), ...li.slice(i + 1)]);
    const j = justify(L, next);
    if (j) results.push(`drop[${i}] ${li[i]} → ${j}`);
  }
  // adjacent swap
  for (let i = 0; i < li.length - 1; i++) {
    const sw = li.slice();
    const t = sw[i]!;
    sw[i] = sw[i + 1]!;
    sw[i + 1] = t;
    const next = joinItems(sw);
    const j = justify(L, next);
    if (j) results.push(`swap[${i}] ${li[i]}↔${li[i + 1]} → ${j}`);
  }
  // drop two at once aspirational
  if (li.length === ri.length + 2 || li.length === ri.length + 3) {
    // find multiset diff
    const rc = new Map<string, number>();
    for (const x of ri) rc.set(x, (rc.get(x) ?? 0) + 1);
    const extra: string[] = [];
    for (const x of li) {
      const n = rc.get(x) ?? 0;
      if (n > 0) rc.set(x, n - 1);
      else extra.push(x);
    }
    results.push('extra atoms: ' + extra.join(' | '));
  }
  return results;
}

for (const f of fails) {
  console.log('\n======== s' + f.step + ' ========');
  const L = ensure(f.left);
  const R = ensure(f.right);
  console.log('direct', justify(L, R) ?? 'FAIL');
  console.log('L items', topItems(L).join(' ;; '));
  console.log('R items', topItems(R).join(' ;; '));
  const hops = tryDropOne(L, R);
  for (const h of hops.slice(0, 30)) console.log(' ', h);

  // s24 special: null-54 path
  if (f.step === 24) {
    const withPu = ensure(
      L.replace(/^,i \\Oc i_1,/, ',i \\Pu,i \\Oc i_1,')
    );
    console.log('add iPu front', justify(L, withPu));
    // bubble Pu next to Bb
    let items = topItems(withPu);
    let cur = withPu;
    const path: string[] = [];
    let pi = items.indexOf('i \\Pu');
    let bi = items.findIndex((x) => x.startsWith('\\Bb'));
    while (pi >= 0 && bi >= 0 && pi !== bi - 1 && pi < bi) {
      const sw = items.slice();
      const t = sw[pi]!;
      sw[pi] = sw[pi + 1]!;
      sw[pi + 1] = t;
      const e = joinItems(sw);
      const j = justify(cur, e);
      console.log('bubble Pu', j, items[pi], '↔', items[pi + 1]);
      if (!j) break;
      path.push(e);
      items = sw;
      cur = e;
      pi++;
      bi = items.findIndex((x) => x.startsWith('\\Bb'));
    }
    // apply null-54: replace i Pu, Bb{...}{c1}{c2} with i Pu, c1
    const bb = items.find((x) => x.startsWith('\\Bb'));
    if (bb && items[items.indexOf(bb)! - 1] === 'i \\Pu') {
      // extract true arm roughly
      const m = bb.match(/^\\Bb\{[^}]+\}(\{.*\})$/);
      console.log('bb head', bb.slice(0, 80));
      // use known true arm from R without needing parse: replace Pu+Bb with R content that is true arm
      const focused = joinItems([
        ...items.slice(0, items.indexOf('i \\Pu')),
        ...topItems(R),
        ...items.slice(items.indexOf(bb) + 1),
      ]);
      console.log('focus construct =R?', ensure(focused) === R);
      console.log('focus justify', justify(cur, focused));
      console.log('focus', focused.slice(0, 120));
    }
  }

  // s54: try successive drops
  if (f.step === 54 || f.step === 86) {
    let cur = L;
    const seen = new Set<string>([cur]);
    for (let step = 0; step < 8 && cur !== R; step++) {
      const items = topItems(cur);
      let advanced = false;
      for (let i = 0; i < items.length; i++) {
        const next = joinItems([...items.slice(0, i), ...items.slice(i + 1)]);
        if (seen.has(next)) continue;
        if (!justify(cur, next)) continue;
        // prefer if closer to R (multiset)
        const ri = topItems(R);
        const better =
          topItems(next).length < items.length &&
          topItems(next).every((x) => ri.includes(x) || items.includes(x));
        if (better || topItems(next).length === ri.length) {
          console.log('drop', items[i], '→', justify(cur, next));
          seen.add(next);
          cur = next;
          advanced = true;
          if (cur === R || justify(cur, R)) {
            console.log('REACHED', justify(cur, R));
            break;
          }
          break;
        }
      }
      if (!advanced) {
        // any drop that justifies
        for (let i = 0; i < items.length; i++) {
          const next = joinItems([...items.slice(0, i), ...items.slice(i + 1)]);
          if (seen.has(next)) continue;
          const j = justify(cur, next);
          if (!j) continue;
          console.log('anydrop', items[i], '→', j);
          seen.add(next);
          cur = next;
          advanced = true;
          break;
        }
      }
      if (!advanced) break;
    }
    console.log('final=R', ensure(cur) === R, justify(cur, R));
  }
}
