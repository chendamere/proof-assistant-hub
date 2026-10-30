/**
 * Shell-aware Bb case focus / merge derived from null-54/55 + create-copy.
 *
 * Focus: L = Oc-shell… + Bb{i Pu}{T}{F} + Os-shell…  →  R = T  (or F)
 * Merge: reverse.
 *
 * The book discharges matching create-copy Oc/Os pairs in the same arrow as
 * null-54/55. That combined jump is not a single library rule; this helper
 * accepts it when the leftover atoms pair as create-copy and R equals one arm.
 */
import { normalizeSpacing } from './utils';
import { fromOperatorFirst } from './operatorFirst';

function ensure(s: string): string {
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

function splitBb(item: string): { cond: string; t: string; f: string } | null {
  const s = item.trim();
  if (!s.startsWith('\\Bb{') && !s.startsWith('\\Blb{')) return null;
  let p = s.indexOf('{');
  if (p < 0) return null;
  const readGroup = (): string | null => {
    if (s[p] !== '{') return null;
    const start = p + 1;
    let depth = 1;
    p++;
    while (p < s.length && depth > 0) {
      if (s[p] === '{') depth++;
      else if (s[p] === '}') depth--;
      p++;
    }
    return s.slice(start, p - 1);
  };
  const cond = readGroup();
  const t = readGroup();
  const f = readGroup();
  if (cond == null || t == null || f == null) return null;
  return { cond, t, f };
}

function normItems(arm: string): string {
  return topItems(arm.startsWith(',') ? arm : ',' + arm)
    .join(',')
    .replace(/\s+/g, '');
}

function isCreateCopyPair(a: string, b: string): boolean {
  const oc = a.match(/^([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*)$/);
  const os = b.match(/^([A-Za-z][A-Za-z0-9_]*) \\Os$/);
  if (oc && os && oc[2] === os[1]) return true;
  const oc2 = b.match(/^([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*)$/);
  const os2 = a.match(/^([A-Za-z][A-Za-z0-9_]*) \\Os$/);
  return !!(oc2 && os2 && oc2[2] === os2[1]);
}

function leftoversAreShell(extra: string[], armItems: string[]): boolean {
  if (extra.length === 0) return true;
  const used = new Array(extra.length).fill(false);
  for (let i = 0; i < extra.length; i++) {
    if (used[i]) continue;
    for (let j = i + 1; j < extra.length; j++) {
      if (used[j]) continue;
      if (isCreateCopyPair(extra[i]!, extra[j]!)) {
        used[i] = used[j] = true;
        break;
      }
    }
  }
  // Unpaired Os may match Oc inside the arm (copy released across Bb); unpaired Oc may match Os in arm.
  for (let i = 0; i < extra.length; i++) {
    if (used[i]) continue;
    const os = extra[i]!.match(/^([A-Za-z][A-Za-z0-9_]*) \\Os$/);
    const oc = extra[i]!.match(/^([A-Za-z][A-Za-z0-9_]*) \\Oc ([A-Za-z][A-Za-z0-9_]*)$/);
    if (os && armItems.some((a) => /\\Oc /.test(a) && a.endsWith(os[1]!))) {
      used[i] = true;
      continue;
    }
    if (oc && armItems.includes(`${oc[2]} \\Os`)) {
      used[i] = true;
      continue;
    }
    return false;
  }
  return true;
}

function armEquals(arm: string, expr: string): boolean {
  return normItems(arm) === normItems(expr);
}

/** True if L→R is shell-aware case focus (R = one Bb arm) or merge (L = one arm). */
export function matchesCaseFocusOrMerge(left: string, right: string): boolean {
  const L = ensure(left);
  const R = ensure(right);
  if (L === R) return false;

  const lItems = topItems(L);
  const rItems = topItems(R);
  const lBb = lItems.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  const rBb = rItems.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));

  // Focus: Bb on left, arm on right
  if (lBb >= 0 && rBb < 0) {
    const bb = splitBb(lItems[lBb]!);
    if (!bb) return false;
    // condition should be Pu-family for null-54/55
    if (!/\\Pu\b/.test(bb.cond) && !/Pu/.test(bb.cond)) return false;
    const matchT = armEquals(bb.t, R);
    const matchF = armEquals(bb.f, R);
    if (!matchT && !matchF) return false;
    const arm = matchT ? bb.t : bb.f;
    const extra = lItems.filter((_, i) => i !== lBb);
    return leftoversAreShell(extra, topItems(arm.startsWith(',') ? arm : ',' + arm));
  }

  // Merge: arm on left, Bb on right
  if (lBb < 0 && rBb >= 0) {
    const bb = splitBb(rItems[rBb]!);
    if (!bb) return false;
    if (!/\\Pu\b/.test(bb.cond) && !/Pu/.test(bb.cond)) return false;
    const matchT = armEquals(bb.t, L);
    const matchF = armEquals(bb.f, L);
    if (!matchT && !matchF) return false;
    const arm = matchT ? bb.t : bb.f;
    const extra = rItems.filter((_, i) => i !== rBb);
    return leftoversAreShell(extra, topItems(arm.startsWith(',') ? arm : ',' + arm));
  }

  return false;
}

/**
 * Compound redistribute used in connectivity 124: pull `i Ps i1` out of both
 * `Bb{i Pu}` arms (reverse identical-29 / swap-65) and push `i1 Os` into both
 * arms (null-12) in one book arrow, with only Oc/Os/Ps shell reordering around it.
 * Individual swaps cannot move Os past Bb, so the two site-rules are checked as a unit.
 */
export function matchesBbPsOsRedistribute(left: string, right: string): boolean {
  const L = ensure(left);
  const R = ensure(right);
  const lItems = topItems(L);
  const rItems = topItems(R);
  const lBb = lItems.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  const rBb = rItems.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
  if (lBb < 0 || rBb < 0) return false;
  const lb = splitBb(lItems[lBb]!);
  const rb = splitBb(rItems[rBb]!);
  if (!lb || !rb) return false;
  if (!/\\Pu\b/.test(lb.cond) || !/\\Pu\b/.test(rb.cond)) return false;

  const lArmT = topItems(lb.t.startsWith(',') ? lb.t : ',' + lb.t);
  const lArmF = topItems(lb.f.startsWith(',') ? lb.f : ',' + lb.f);
  const rArmT = topItems(rb.t.startsWith(',') ? rb.t : ',' + rb.t);
  const rArmF = topItems(rb.f.startsWith(',') ? rb.f : ',' + rb.f);

  // Detect Ps pulled out: both L arms start with same Ps atom that appears outside in R
  const psCand = lArmT[0];
  const psPull =
    !!psCand &&
    /\\Ps /.test(psCand) &&
    lArmF[0] === psCand &&
    rItems.includes(psCand) &&
    !rArmT.includes(psCand) &&
    !rArmF.includes(psCand);

  // Detect Os pushed in: outside L has Os that both R arms contain, and outer R has one fewer
  const lOut = lItems.filter((_, i) => i !== lBb);
  const rOut = rItems.filter((_, i) => i !== rBb);
  const osCand = lOut.find((x) => /\\Os$/.test(x) && rArmT.includes(x) && rArmF.includes(x));
  const osPush =
    !!osCand && (lOut.filter((x) => x === osCand).length === rOut.filter((x) => x === osCand).length + 1);

  if (!psPull && !osPush) return false;
  // Require at least the Ps pull (book s135 does both); Os push alone is plain null-12
  if (!psPull) return false;

  // Remaining outer atoms should match as multisets up to the moved Ps/Os
  const lBag = new Map<string, number>();
  const rBag = new Map<string, number>();
  for (const x of lOut) lBag.set(x, (lBag.get(x) ?? 0) + 1);
  for (const x of rOut) rBag.set(x, (rBag.get(x) ?? 0) + 1);
  if (psPull) rBag.set(psCand!, (rBag.get(psCand!) ?? 0) - 1);
  if (osPush && osCand) lBag.set(osCand, (lBag.get(osCand) ?? 0) - 1);
  // clear zeros
  for (const m of [lBag, rBag]) {
    for (const [k, v] of [...m.entries()]) if (v <= 0) m.delete(k);
  }
  if (lBag.size !== rBag.size) return false;
  for (const [k, v] of lBag) if (rBag.get(k) !== v) return false;

  // Arm bodies equal after removing pulled Ps / pushed Os
  const strip = (arm: string[], ps?: string, os?: string) => {
    const a = arm.slice();
    if (ps && a[0] === ps) a.shift();
    if (os) {
      const i = a.indexOf(os);
      if (i >= 0) a.splice(i, 1);
    }
    return a.join('\0');
  };
  const lt = strip(lArmT, psPull ? psCand : undefined, undefined);
  const lf = strip(lArmF, psPull ? psCand : undefined, undefined);
  const rt = strip(rArmT, undefined, osPush ? osCand : undefined);
  const rf = strip(rArmF, undefined, osPush ? osCand : undefined);
  return lt === rt && lf === rf;
}

/** Combined derived Bb helpers for chapter-14 shell/arm redistributes. */
export function matchesDerivedBbTransition(left: string, right: string): boolean {
  return matchesCaseFocusOrMerge(left, right) || matchesBbPsOsRedistribute(left, right);
}
