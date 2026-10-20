/**
 * \\Tc verification with Brs open-right (suffix) matching.
 *
 * A \\Tc hole stands for a code fragment. After holes are filled, the concrete rule
 * must rewrite one side of the proof step into the other by substitution.
 *
 * Branch kinds:
 * - \\Brs / \\Brb: open right branch. Pattern arms match as *suffixes* of target arms;
 *   arm prefixes stay in context. A Brs pattern may also overlay a closed \\Bb / \\Bs
 *   (condition and arm prefixes stay; Brs fills the arm suffixes / tail).
 * - \\Bb / \\Bs: closed branch (condition + both arms). Matched exactly when the pattern
 *   itself is Bb/Bs.
 * - \\Blb / \\Bls: open left / prefix branch. Brs cannot match Blb.
 */

import { MatchPosition } from './types';
import { ensureCommaWrapped, normalizeSpacing } from './utils';
import { tcBindings, type TcBindingEntry } from './tcBindings';

const NULLARY = new Set(['\\Or', '\\Ri', '\\Rq']);
const OPERAND_FIRST = new Set(['\\Os', '\\Oc', '\\Od', '\\Ob', '\\Og', '\\Oa']);

/** Stop automatic enumeration past this many hole/fragment combinations. */
const MAX_COMBINATIONS = 20000;

type BranchKind = 'Bb' | 'Blb' | 'Brb';

type Atom = { type: 'atom'; op: string; operands: string[]; ground: boolean };
type Branch = { type: 'branch'; kind: BranchKind; cond: Atom | null; top: Seq; bottom: Seq };
type Hole = { type: 'hole'; name: string };
type Item = Atom | Branch | Hole;
type Seq = Item[];

type BrsOverlay = {
  /** Index within the matched pattern window. */
  indexInSlice: number;
  topPrefix: Seq;
  bottomPrefix: Seq;
  hostKind: BranchKind;
  cond: Atom | null;
};

type SliceMatch = {
  start: number;
  length: number;
  bind: Map<string, string>;
  overlay?: BrsOverlay;
};

function normalizeKind(kind: string): BranchKind | null {
  if (kind === 'Bs' || kind === 'Bb') return 'Bb';
  if (kind === 'Bls' || kind === 'Blb') return 'Blb';
  if (kind === 'Brs' || kind === 'Brb') return 'Brb';
  return null;
}

function splitCommas(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(expr.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(expr.slice(start));
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function parseBrace(expr: string, pos: number): { content: string; end: number } | null {
  if (expr[pos] !== '{') return null;
  let depth = 0;
  const contentStart = pos + 1;
  for (let i = pos; i < expr.length; i++) {
    if (expr[i] === '{') depth++;
    else if (expr[i] === '}') {
      depth--;
      if (depth === 0) return { content: expr.slice(contentStart, i), end: i + 1 };
    }
  }
  return null;
}

function stripCond(cond: string): string {
  let t = cond.trim().replace(/^[\s,]+|[\s,]+$/g, '').trim();
  if (t.startsWith('if(')) {
    let depth = 1;
    for (let i = 3; i < t.length; i++) {
      if (t[i] === '(') depth++;
      else if (t[i] === ')') {
        depth--;
        if (depth === 0) return t.slice(3, i).trim().replace(/^[\s,]+|[\s,]+$/g, '').trim();
      }
    }
  }
  return t;
}

function isIdent(s: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*$/.test(s) || /^\d+$/.test(s);
}

function parseAtom(item: string, tcAsHole: boolean): Item | null {
  const s = item.trim();
  if (!s) return null;
  const plus = s.match(/^([A-Za-z0-9_]+)\+([A-Za-z0-9_]+):([A-Za-z0-9_]+)$/);
  if (plus) return { type: 'atom', op: '\\+', operands: [plus[1]!, plus[2]!, plus[3]!], ground: false };
  const times = s.match(/^([A-Za-z0-9_]+)\s*(?:\\times|×)\s*([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_]+)$/);
  if (times) return { type: 'atom', op: '\\times', operands: [times[1]!, times[2]!, times[3]!], ground: false };
  const fn = s.match(/^([A-Z][A-Za-z0-9]*)\(([^)]*)\)$/);
  if (fn) {
    const args = fn[2]!.split(';').map((x) => x.trim()).filter(Boolean);
    return { type: 'atom', op: fn[1]!, operands: args, ground: false };
  }
  const opMatch = s.match(/\\(n?[A-Z][a-zA-Z]*)/);
  if (!opMatch || opMatch.index == null) return null;
  if (s.indexOf('\\', opMatch.index + 1) !== -1) return null;
  const op = '\\' + opMatch[1];
  const before = s.slice(0, opMatch.index).trim();
  const after = s.slice(opMatch.index + opMatch[0].length).trim();
  if (NULLARY.has(op)) {
    if (before || after) return null;
    return { type: 'atom', op, operands: [], ground: false };
  }
  const operands: string[] = [];
  if (before) {
    if (!isIdent(before)) return null;
    operands.push(before);
  }
  if (after) {
    if (!isIdent(after)) return null;
    operands.push(after);
  }
  if (tcAsHole && op === '\\Tc' && operands.length === 1) return { type: 'hole', name: operands[0]! };
  return { type: 'atom', op, operands, ground: false };
}

function parseSequence(expr: string, tcAsHole: boolean): Seq | null {
  const items: Item[] = [];
  for (const part of splitCommas(expr)) {
    const parsed = parseChunk(part, tcAsHole);
    if (!parsed) return null;
    items.push(parsed);
  }
  return items;
}

function parseChunk(part: string, tcAsHole: boolean): Item | null {
  const s = part.trim();
  const branch = parseBranch(s, tcAsHole);
  if (branch) {
    if (branch.end !== s.length) return null;
    return branch.item;
  }
  return parseAtom(s, tcAsHole);
}

function parseBranch(expr: string, tcAsHole: boolean): { item: Branch; end: number } | null {
  const m = expr.match(/^\\(Bb|Bs|Blb|Bls|Brb|Brs)\s*/);
  if (!m || m.index == null) return null;
  const kind = normalizeKind(m[1]!);
  if (!kind) return null;
  let pos = m[0].length;
  if (expr[pos] !== '{') return null;
  const hasCond = kind === 'Bb' || kind === 'Blb';
  let cond: Atom | null = null;
  if (hasCond) {
    const c = parseBrace(expr, pos);
    if (!c) return null;
    pos = c.end;
    const condSeq = parseSequence(stripCond(c.content), tcAsHole);
    if (!condSeq || condSeq.length !== 1 || condSeq[0]!.type !== 'atom') return null;
    cond = condSeq[0] as Atom;
  }
  const topBrace = parseBrace(expr, pos);
  if (!topBrace) return null;
  pos = topBrace.end;
  const botBrace = parseBrace(expr, pos);
  if (!botBrace) return null;
  pos = botBrace.end;
  const top = parseSequence(topBrace.content, tcAsHole);
  const bottom = parseSequence(botBrace.content, tcAsHole);
  if (!top || !bottom) return null;
  return { item: { type: 'branch', kind, cond, top, bottom }, end: pos };
}

function parseExpr(expr: string, tcAsHole: boolean): Seq | null {
  try {
    return parseSequence(normalizeSpacing(expr), tcAsHole);
  } catch {
    return null;
  }
}

function collectHoles(seq: Seq, into: Set<string>): void {
  for (const item of seq) {
    if (item.type === 'hole') into.add(item.name);
    else if (item.type === 'branch') {
      collectHoles(item.top, into);
      collectHoles(item.bottom, into);
    }
  }
}

function collectSequences(seq: Seq, out: Seq[]): void {
  out.push(seq);
  for (const item of seq) {
    if (item.type === 'branch') {
      collectSequences(item.top, out);
      collectSequences(item.bottom, out);
    }
  }
}

function seqKey(seq: Seq): string {
  return JSON.stringify(seq);
}

function slicesOf(seq: Seq): Seq[] {
  const out: Seq[] = [[]];
  for (let i = 0; i < seq.length; i++) {
    for (let j = i + 1; j <= seq.length; j++) out.push(seq.slice(i, j));
  }
  return out;
}

function candidateFragments(stepL: Seq, stepR: Seq): Seq[] {
  const sequences: Seq[] = [];
  collectSequences(stepL, sequences);
  collectSequences(stepR, sequences);
  const seen = new Set<string>();
  const out: Seq[] = [];
  for (const seq of sequences) {
    for (const slice of slicesOf(seq)) {
      const key = seqKey(slice);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(slice);
    }
  }
  out.sort((a, b) => a.length - b.length);
  return out;
}

function cloneGround(seq: Seq): Seq {
  return seq.map((item) => {
    if (item.type === 'atom') return { type: 'atom', op: item.op, operands: [...item.operands], ground: true };
    if (item.type === 'hole') return { type: 'hole', name: item.name };
    return {
      type: 'branch',
      kind: item.kind,
      cond: item.cond ? { type: 'atom', op: item.cond.op, operands: [...item.cond.operands], ground: true } : null,
      top: cloneGround(item.top),
      bottom: cloneGround(item.bottom),
    };
  });
}

function instantiate(seq: Seq, holes: Map<string, Seq>): Seq | null {
  const out: Item[] = [];
  for (const item of seq) {
    if (item.type === 'hole') {
      const frag = holes.get(item.name);
      if (!frag) return null;
      out.push(...cloneGround(frag));
      continue;
    }
    if (item.type === 'branch') {
      const top = instantiate(item.top, holes);
      const bottom = instantiate(item.bottom, holes);
      if (!top || !bottom) return null;
      out.push({
        type: 'branch',
        kind: item.kind,
        cond: item.cond ? { ...item.cond, operands: [...item.cond.operands] } : null,
        top,
        bottom,
      });
      continue;
    }
    out.push({ type: 'atom', op: item.op, operands: [...item.operands], ground: item.ground });
  }
  return out;
}

/** \\Pe and \\Oe are interchangeable (same relation; baking skips an extra proof step). */
function opsEquivalent(patternOp: string, targetOp: string): boolean {
  if (patternOp === targetOp) return true;
  const strip = (op: string) => op.replace(/^\\/, '');
  const p = strip(patternOp);
  const t = strip(targetOp);
  if ((p === 'Pe' || p === 'Oe') && (t === 'Pe' || t === 'Oe')) return true;
  if ((p === 'nPe' || p === 'nOe') && (t === 'nPe' || t === 'nOe')) return true;
  // Cond ops are stored as :cond:\\Pe etc.
  const pInner = patternOp.includes(':cond:') ? patternOp.replace(/^.*:cond:/, '') : patternOp;
  const tInner = targetOp.includes(':cond:') ? targetOp.replace(/^.*:cond:/, '') : targetOp;
  if (pInner !== patternOp || tInner !== targetOp) return opsEquivalent(pInner.startsWith('\\') ? pInner : '\\' + pInner, tInner.startsWith('\\') ? tInner : '\\' + tInner);
  return false;
}

function matchAtom(pattern: Atom, target: Atom, bind: Map<string, string>, used: Map<string, string>): boolean {
  if (!opsEquivalent(pattern.op, target.op)) return false;
  if (pattern.operands.length !== target.operands.length) return false;
  if (pattern.ground) {
    for (let i = 0; i < pattern.operands.length; i++) {
      if (pattern.operands[i] !== target.operands[i]) return false;
    }
    return true;
  }
  for (let i = 0; i < pattern.operands.length; i++) {
    const pv = pattern.operands[i]!;
    const tv = target.operands[i]!;
    if (bind.has(pv)) {
      if (bind.get(pv) !== tv) return false;
      continue;
    }
    if (used.has(tv) && used.get(tv) !== pv) return false;
    bind.set(pv, tv);
    used.set(tv, pv);
  }
  return true;
}

/** Pattern arm is a suffix of target arm; return the unmatched prefix. */
function matchArmSuffix(
  patternArm: Seq,
  targetArm: Seq,
  bind: Map<string, string>,
  used: Map<string, string>
): Seq | null {
  if (patternArm.length > targetArm.length) return null;
  const prefixLen = targetArm.length - patternArm.length;
  const prefix = targetArm.slice(0, prefixLen);
  const suffix = targetArm.slice(prefixLen);
  if (!matchItemsExact(patternArm, suffix, bind, used)) return null;
  return prefix;
}

/** Exact item/sequence match (no Brs overlay). Used for arm suffixes and non-Brs patterns. */
function matchItemExact(pattern: Item, target: Item, bind: Map<string, string>, used: Map<string, string>): boolean {
  if (pattern.type === 'hole' || target.type === 'hole') return false;
  if (pattern.type === 'atom' || target.type === 'atom') {
    if (pattern.type !== 'atom' || target.type !== 'atom') return false;
    return matchAtom(pattern, target, bind, used);
  }
  if (pattern.kind !== target.kind) return false;
  if ((pattern.cond == null) !== (target.cond == null)) return false;
  if (pattern.cond && target.cond && !matchAtom(pattern.cond, target.cond, bind, used)) return false;
  return matchItemsExact(pattern.top, target.top, bind, used) && matchItemsExact(pattern.bottom, target.bottom, bind, used);
}

function matchItemsExact(pattern: Seq, target: Seq, bind: Map<string, string>, used: Map<string, string>): boolean {
  if (pattern.length !== target.length) return false;
  for (let i = 0; i < pattern.length; i++) {
    if (!matchItemExact(pattern[i]!, target[i]!, bind, used)) return false;
  }
  return true;
}

/**
 * Match a Brs pattern branch against a target branch.
 * Brs may overlay Brs/Brb or Bb/Bs (arm suffixes). Brs never overlays Blb.
 */
function matchBrsOverlay(
  pattern: Branch,
  target: Branch,
  bind: Map<string, string>,
  used: Map<string, string>
): Omit<BrsOverlay, 'indexInSlice'> | null {
  if (pattern.kind !== 'Brb') return null;
  if (target.kind === 'Blb') return null;
  if (target.kind !== 'Brb' && target.kind !== 'Bb') return null;
  const topPrefix = matchArmSuffix(pattern.top, target.top, bind, used);
  if (!topPrefix) return null;
  const bottomPrefix = matchArmSuffix(pattern.bottom, target.bottom, bind, used);
  if (!bottomPrefix) return null;
  return {
    topPrefix,
    bottomPrefix,
    hostKind: target.kind,
    cond: target.cond ? { type: 'atom', op: target.cond.op, operands: [...target.cond.operands], ground: true } : null,
  };
}

function tryMatchWindow(pattern: Seq, window: Seq): SliceMatch | null {
  if (pattern.length !== window.length) return null;
  const bind = new Map<string, string>();
  const used = new Map<string, string>();
  let overlay: BrsOverlay | undefined;

  for (let i = 0; i < pattern.length; i++) {
    const p = pattern[i]!;
    const t = window[i]!;
    if (p.type === 'branch' && p.kind === 'Brb' && t.type === 'branch') {
      const o = matchBrsOverlay(p, t, bind, used);
      if (!o) return null;
      if (overlay) return null;
      overlay = { ...o, indexInSlice: i };
      continue;
    }
    if (!matchItemExact(p, t, bind, used)) return null;
  }
  return { start: 0, length: pattern.length, bind, overlay };
}

function applyItem(item: Item, bind: Map<string, string>): Item | null {
  if (item.type === 'hole') return null;
  if (item.type === 'atom') {
    if (item.ground) return { type: 'atom', op: item.op, operands: [...item.operands], ground: true };
    const operands: string[] = [];
    for (const pv of item.operands) {
      const tv = bind.get(pv);
      if (tv == null) return null;
      operands.push(tv);
    }
    return { type: 'atom', op: item.op, operands, ground: true };
  }
  const top = applySeq(item.top, bind);
  const bottom = applySeq(item.bottom, bind);
  if (!top || !bottom) return null;
  let cond: Atom | null = null;
  if (item.cond) {
    const applied = applyItem(item.cond, bind);
    if (!applied || applied.type !== 'atom') return null;
    cond = applied;
  }
  return { type: 'branch', kind: item.kind, cond, top, bottom };
}

function applySeq(seq: Seq, bind: Map<string, string>): Seq | null {
  const out: Item[] = [];
  for (const item of seq) {
    const next = applyItem(item, bind);
    if (!next) return null;
    out.push(next);
  }
  return out;
}

function equalAtom(a: Atom, b: Atom): boolean {
  if (!opsEquivalent(a.op, b.op) || a.operands.length !== b.operands.length) return false;
  for (let i = 0; i < a.operands.length; i++) if (a.operands[i] !== b.operands[i]) return false;
  return true;
}

function equalItem(a: Item, b: Item): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'hole' || b.type === 'hole') return a.type === 'hole' && b.type === 'hole' && a.name === b.name;
  if (a.type === 'atom' && b.type === 'atom') return equalAtom(a, b);
  if (a.type !== 'branch' || b.type !== 'branch') return false;
  if (a.kind !== b.kind) return false;
  if ((a.cond == null) !== (b.cond == null)) return false;
  if (a.cond && b.cond && !equalAtom(a.cond, b.cond)) return false;
  return equalSeq(a.top, b.top) && equalSeq(a.bottom, b.bottom);
}

function equalSeq(a: Seq, b: Seq): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (!equalItem(a[i]!, b[i]!)) return false;
  return true;
}

function cloneBranch(b: Branch): Branch {
  return {
    type: 'branch',
    kind: b.kind,
    cond: b.cond ? { type: 'atom', op: b.cond.op, operands: [...b.cond.operands], ground: true } : null,
    top: cloneGround(b.top),
    bottom: cloneGround(b.bottom),
  };
}

/**
 * Apply replacement at a matched window. When a Brs pattern overlaid a host branch,
 * keep the host kind/condition and arm prefixes; splice replacement Brs arms onto those prefixes.
 */
function applyAtMatch(seq: Seq, start: number, match: SliceMatch, pattern: Seq, replacement: Seq): Seq | null {
  const repl = applySeq(replacement, match.bind);
  if (!repl) return null;

  if (!match.overlay) {
    return [...seq.slice(0, start), ...repl, ...seq.slice(start + match.length)];
  }

  const o = match.overlay;
  const patBrs = pattern[o.indexInSlice];
  if (!patBrs || patBrs.type !== 'branch' || patBrs.kind !== 'Brb') return null;

  // Replacement must have a Brs at the same relative index when pattern/replacement align,
  // or a single leading Brs when lengths differ (code distribution).
  let replBrs: Branch | null = null;
  let replBefore: Seq = [];
  let replAfter: Seq = [];
  if (replacement.length === pattern.length) {
    const r = repl[o.indexInSlice];
    if (!r || r.type !== 'branch' || r.kind !== 'Brb') return null;
    replBrs = r;
    replBefore = repl.slice(0, o.indexInSlice);
    replAfter = repl.slice(o.indexInSlice + 1);
  } else {
    const brsAt = repl.findIndex((it) => it.type === 'branch' && it.kind === 'Brb');
    if (brsAt < 0) return null;
    replBrs = repl[brsAt] as Branch;
    replBefore = repl.slice(0, brsAt);
    replAfter = repl.slice(brsAt + 1);
  }

  const newBranch: Branch = {
    type: 'branch',
    kind: o.hostKind,
    cond: o.cond ? { type: 'atom', op: o.cond.op, operands: [...o.cond.operands], ground: true } : null,
    top: [...cloneGround(o.topPrefix), ...cloneGround(replBrs.top)],
    bottom: [...cloneGround(o.bottomPrefix), ...cloneGround(replBrs.bottom)],
  };

  return [
    ...seq.slice(0, start),
    ...replBefore,
    newBranch,
    ...replAfter,
    ...seq.slice(start + match.length),
  ];
}

/** Every expression obtained by replacing one occurrence of `pattern` with `replacement`. */
function replacements(seq: Seq, pattern: Seq, replacement: Seq): Seq[] {
  const out: Seq[] = [];
  const n = pattern.length;
  if (n === 0) return out;

  for (let i = 0; i <= seq.length - n; i++) {
    const window = seq.slice(i, i + n);
    const m = tryMatchWindow(pattern, window);
    if (!m) continue;
    m.start = i;
    const next = applyAtMatch(seq, i, m, pattern, replacement);
    if (next) out.push(next);
  }

  // Also allow Brs pattern of length 1 to match a longer window when trailing pattern atoms
  // are absorbed: handled by n-window above. Recurse into branch arms for nested sites.
  for (let i = 0; i < seq.length; i++) {
    const item = seq[i]!;
    if (item.type !== 'branch') continue;
    for (const top of replacements(item.top, pattern, replacement)) {
      const copy = seq.slice();
      copy[i] = { ...cloneBranch(item), top };
      out.push(copy);
    }
    for (const bottom of replacements(item.bottom, pattern, replacement)) {
      const copy = seq.slice();
      copy[i] = { ...cloneBranch(item), bottom };
      out.push(copy);
    }
  }
  return out;
}

function substitutionHolds(from: Seq, to: Seq, pattern: Seq, replacement: Seq): boolean {
  for (const next of replacements(from, pattern, replacement)) {
    if (equalSeq(next, to)) return true;
  }
  return false;
}

function showAtom(atom: Atom): string {
  const ops = atom.operands;
  if (atom.op === '\\+' && ops.length === 3) return `${ops[0]}+${ops[1]}:${ops[2]}`;
  if (atom.op === '\\times' && ops.length === 3) return `${ops[0]} \\times ${ops[1]} : ${ops[2]}`;
  if (ops.length === 0) return atom.op;
  if (ops.length === 1 && OPERAND_FIRST.has(atom.op)) return `${ops[0]} ${atom.op}`;
  if (ops.length === 1) return `${atom.op} ${ops[0]}`;
  if (ops.length === 2) return `${ops[0]} ${atom.op} ${ops[1]}`;
  return `${atom.op} ${ops.join(' ')}`;
}

function showItem(item: Item): string {
  if (item.type === 'hole') return `\\Tc ${item.name}`;
  if (item.type === 'atom') return showAtom(item);
  const cond = item.cond ? showAtom(item.cond) : '';
  const top = showSeq(item.top);
  const bottom = showSeq(item.bottom);
  if (item.kind === 'Brb') return `\\Brs{${top}}{${bottom}}`;
  return `\\${item.kind}{${cond}}{${top}}{${bottom}}`;
}

function showSeq(seq: Seq): string {
  if (seq.length === 0) return ',';
  return `,${seq.map(showItem).join(',')},`;
}

function tcRecord(holes: Map<string, Seq>): Record<string, string[]> {
  const record: Record<string, string[]> = {};
  for (const [name, frag] of holes) record[name] = [showSeq(frag)];
  return record;
}

function matchedInstance(
  stepL: Seq,
  stepR: Seq,
  ruleL: Seq,
  ruleR: Seq,
  holes: Map<string, Seq>
): { patternLeft: string; patternRight: string; direction: string } | null {
  const instL = instantiate(ruleL, holes);
  const instR = instantiate(ruleR, holes);
  if (!instL || !instR) return null;
  const shownL = ensureCommaWrapped(showSeq(instL));
  const shownR = ensureCommaWrapped(showSeq(instR));
  if (substitutionHolds(stepL, stepR, instL, instR)) {
    return { patternLeft: shownL, patternRight: shownR, direction: 'instantiated rule left → right' };
  }
  if (substitutionHolds(stepL, stepR, instR, instL)) {
    return { patternLeft: shownR, patternRight: shownL, direction: 'instantiated rule right → left' };
  }
  return null;
}

function samePair(a: string, b: string, c: string, d: string): boolean {
  const na = normalizeSpacing(a);
  const nb = normalizeSpacing(b);
  const nc = normalizeSpacing(c);
  const nd = normalizeSpacing(d);
  return (na === nc && nb === nd) || (na === nd && nb === nc);
}

function manualHoleMap(ruleL: string, ruleR: string, stepL: string, stepR: string): Map<string, Seq> | null {
  const entry = tcBindings.find(
    (e: TcBindingEntry) =>
      samePair(e.ruleLeft, e.ruleRight, ruleL, ruleR) && samePair(e.stepLeft, e.stepRight, stepL, stepR)
  );
  if (!entry) return null;
  const map = new Map<string, Seq>();
  for (const [name, frag] of Object.entries(entry.bindings)) {
    const parsed = parseExpr(frag.trim() ? frag : ',', false);
    if (!parsed) return null;
    map.set(name, parsed);
  }
  return map;
}

function resultFor(
  holes: Map<string, Seq>,
  targetRight: string,
  hit: { patternLeft: string; patternRight: string; direction: string }
): { match: true; position: MatchPosition; reconstructedExpr: string; matchDirections: string[] } {
  return {
    match: true,
    position: {
      side: 'both',
      description: 'Instantiated \\Tc with a subexpression; Brs matches arm suffixes; substitution produces the other side',
      wasPatternMatch: true,
      tcMapping: tcRecord(holes),
      instantiatedPatternLeft: hit.patternLeft,
      instantiatedPatternRight: hit.patternRight,
    },
    reconstructedExpr: ensureCommaWrapped(targetRight),
    matchDirections: [hit.direction],
  };
}

/**
 * Bind each \\Tc hole to a subexpression of the step, then accept only if substitution
 * of the instantiated rule turns one side into the other (with Brs suffix matching).
 */
export function tryTcSubexpressionSubstitution(
  targetLeft: string,
  targetRight: string,
  ruleLeft: string,
  ruleRight: string
): { match: boolean; position?: MatchPosition; reconstructedExpr?: string; matchDirections?: string[] } | null {
  if (!/\\Tc\b/.test(ruleLeft) && !/\\Tc\b/.test(ruleRight)) return null;
  const stepL = parseExpr(targetLeft, false);
  const stepR = parseExpr(targetRight, false);
  const ruleL = parseExpr(ruleLeft, true);
  const ruleR = parseExpr(ruleRight, true);
  if (!stepL || !stepR || !ruleL || !ruleR) return null;

  const holeNames = new Set<string>();
  collectHoles(ruleL, holeNames);
  collectHoles(ruleR, holeNames);
  if (holeNames.size === 0) return null;
  const names = [...holeNames].sort();

  const manual = manualHoleMap(ruleLeft, ruleRight, targetLeft, targetRight);
  if (manual && names.every((n) => manual.has(n))) {
    const hit = matchedInstance(stepL, stepR, ruleL, ruleR, manual);
    if (hit) return resultFor(manual, targetRight, { ...hit, direction: `manual \\Tc binding; ${hit.direction}` });
  }

  const candidates = candidateFragments(stepL, stepR);
  let product = 1;
  for (let i = 0; i < names.length; i++) {
    product *= candidates.length;
    if (product > MAX_COMBINATIONS) return null;
  }

  const chosen = new Map<string, Seq>();
  const search = (
    index: number
  ): { holes: Map<string, Seq>; patternLeft: string; patternRight: string; direction: string } | null => {
    if (index === names.length) {
      const hit = matchedInstance(stepL, stepR, ruleL, ruleR, chosen);
      return hit ? { holes: new Map(chosen), ...hit } : null;
    }
    const name = names[index]!;
    for (const frag of candidates) {
      chosen.set(name, frag);
      const found = search(index + 1);
      if (found) return found;
    }
    chosen.delete(name);
    return null;
  };

  const found = search(0);
  if (!found) return null;
  return resultFor(found.holes, targetRight, found);
}
