/**
 * Probe ::100:: fail hops: try candidate rewrites and report justifying rules.
 */
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
const POS = 13 * 100000 + 100;

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

function parseArm(arm: string): string[] {
  return arm
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .split(/\s*,\s*/)
    .filter(Boolean);
}

function findOuterBb(expr: string) {
  const s = ensure(expr);
  const start = s.search(/\\B(?:lb|b)\{/);
  if (start < 0) return null;
  const kind = s.slice(start).startsWith('\\Blb') ? 'lb' : 'b';
  const condStart = start + (kind === 'lb' ? 5 : 4);
  let i = condStart + 1;
  let depth = 1;
  while (i < s.length && depth > 0) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    i++;
  }
  const cond = s.slice(condStart + 1, i - 1);
  const tStart = i;
  i++;
  depth = 1;
  while (i < s.length && depth > 0) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    i++;
  }
  const trueArm = s.slice(tStart + 1, i - 1);
  const fStart = i;
  i++;
  depth = 1;
  while (i < s.length && depth > 0) {
    if (s[i] === '{') depth++;
    else if (s[i] === '}') depth--;
    i++;
  }
  const falseArm = s.slice(fStart + 1, i - 1);
  return { start, end: i, kind, cond, trueArm, falseArm, full: s.slice(start, i), s };
}

function rebuild(kind: string, cond: string, tItems: string[], fItems: string[]) {
  return `\\B${kind}{${cond}}{,${tItems.join(',')},}{,${fItems.join(',')},}`;
}

const fails = fs
  .readFileSync(path.join(__dirname, 'out/recheck-ch14.jsonl'), 'utf8')
  .trim()
  .split(/\n/)
  .map((l) => JSON.parse(l))
  .filter((x) => String(x.key).includes('::100::'));

const step = Number(process.argv[2] || '3');
const f = fails.find((x) => x.step === step);
if (!f) {
  console.log('no fail', step);
  process.exit(1);
}
const L = ensure(f.left);
const R = ensure(f.right);
console.log('step', step);
console.log('direct', justify(L, R));
console.log('L fp', fingerprint(L).slice(0, 120));
console.log('R fp', fingerprint(R).slice(0, 120));

const bbL = findOuterBb(L);
const bbR = findOuterBb(R);
if (bbL && bbR) {
  console.log('L arms', parseArm(bbL.trueArm), '||', parseArm(bbL.falseArm));
  console.log('R arms', parseArm(bbR.trueArm), '||', parseArm(bbR.falseArm));
  console.log('L top before bb', L.slice(0, bbL.start));
  console.log('R top before bb', R.slice(0, bbR.start));
}

const cands: Array<{ name: string; e: string }> = [];

// R insert
cands.push({ name: 'insert R(i2)', e: ensure(L.replace(',i_2 \\Os,', ',R(i_2),i_2 \\Os,')) });
cands.push({
  name: 'insert R(i2)+c2a',
  e: ensure(L.replace(',i_2 \\Os,', ',R(i_2),i_2 \\Os,').replace('\\Tc c_2,', '\\Tc c_2a,')),
});
cands.push({ name: 'rename c2a', e: ensure(L.replace('\\Tc c_2,', '\\Tc c_2a,')) });
cands.push({ name: 'rename c2', e: ensure(L.replace('\\Tc c_2a,', '\\Tc c_2,')) });

// push various atoms
if (bbL) {
  for (const atom of ['i_2 \\Os', 'j_2 \\Os', 'R(j_1)', 'j \\Oc j_1', 'R(i_1)', 'i \\Oc i_1']) {
    if (!L.includes(atom.replace(/\\\\/g, '\\'))) continue;
    // remove from top prefix and prepend both arms
    const top = L.slice(0, bbL.start);
    if (!top.includes(atom)) {
      // try anyway via string replace once
    }
    const top2 = ensure(top.replace(`,${atom},`, ',').replace(`,${atom}`, ','));
    // careful
    let topClean = top;
    const re = new RegExp(`,${atom.replace(/\\/g, '\\\\')},`);
    if (re.test(',' + top.replace(/^,/, ''))) {
      topClean = ensure(top.replace(`,${atom},`, ','));
    } else if (top.endsWith(atom + ',') || top.includes(',' + atom + ',')) {
      topClean = ensure(top.split(',' + atom + ',').join(','));
    }
    const tItems = [atom, ...parseArm(bbL.trueArm)];
    const fItems = [atom, ...parseArm(bbL.falseArm)];
    // also try insert at positions matching R
    const tGoal = parseArm(bbR!.trueArm);
    const fGoal = parseArm(bbR!.falseArm);
    const variants: string[][] = [[atom, ...parseArm(bbL.trueArm)]];
    // if goal has atom not at front, try goal order for true and false separately
    if (tGoal.includes(atom.split(' ')[0]!) || tGoal.some((x) => x === atom)) {
      variants.push(tGoal);
    }
    const newBb = rebuild(bbL.kind, bbL.cond, tItems, fItems);
    // rebuild top without atom
    const itemsTop = top
      .replace(/^\s*,\s*/, '')
      .replace(/\s*,\s*$/, '')
      .split(/\s*,\s*/)
      .filter(Boolean)
      .filter((x) => x !== atom);
    const e = ensure(',' + itemsTop.join(',') + ',' + newBb + ',');
    cands.push({ name: 'push ' + atom, e });

    // push into arms at R positions
    if (tGoal.includes(atom) && fGoal.includes(atom)) {
      const tBase = parseArm(bbL.trueArm).filter((x) => x !== atom);
      const fBase = parseArm(bbL.falseArm).filter((x) => x !== atom);
      const ti = tGoal.indexOf(atom);
      const fi = fGoal.indexOf(atom);
      const t2 = tBase.slice();
      t2.splice(ti, 0, atom);
      const f2 = fBase.slice();
      f2.splice(fi, 0, atom);
      const newBb2 = rebuild(bbL.kind, bbL.cond, t2, f2);
      const e2 = ensure(',' + itemsTop.join(',') + ',' + newBb2 + ',');
      cands.push({ name: 'push@Rpos ' + atom, e: e2 });
    }
  }
}

// null-9: distribute Os when equal arms after adding
if (bbL) {
  // try false-arm only rename c_2a inside
  const fArm = bbL.falseArm.replace('\\Tc c_2,', '\\Tc c_2a,');
  const e = ensure(bbL.s.slice(0, bbL.start) + rebuild(bbL.kind, bbL.cond, parseArm(bbL.trueArm), parseArm(fArm)) + bbL.s.slice(bbL.end));
  cands.push({ name: 'false c2→c2a', e });
}

let hits = 0;
for (const c of cands) {
  if (c.e === L) continue;
  const j = justify(L, c.e);
  if (!j) continue;
  hits++;
  const toR = c.e === R ? 'spacing' : justify(c.e, R);
  console.log('HIT', c.name, '→', j, toR ? `| then→R ${toR}` : '| not yet R');
  if (!toR) {
    console.log('   mid', fingerprint(c.e).slice(0, 140));
    console.log('   R  ', fingerprint(R).slice(0, 140));
  }
}
console.log('hits', hits, 'of', cands.length);

// Prefer-rule scan: any one-hop neighbors via prefer rules that reduce distance
const prefer = allRules.filter(
  (r) =>
    r.pos < POS &&
    /identical-node-comparison-1[45678]|null-comparison-9|thm-R-i-release|identical-node-comparison-70|create-copy|empty-branch/.test(
      r.id
    )
);
console.log('prefer rules', prefer.length);
// For s3 specifically dump thm-R-i-release sides
for (const r of prefer.filter((x) => x.id.includes('thm-R-i-release') || x.id.includes('null-comparison-9') || x.id.includes('identical-node-comparison-15'))) {
  console.log('RULE', r.id);
  console.log('  L', r.leftSide.slice(0, 100));
  console.log('  R', r.rightSide.slice(0, 100));
}
