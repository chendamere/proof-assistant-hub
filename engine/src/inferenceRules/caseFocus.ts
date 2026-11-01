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

/**
 * Unzip / zip of create–Bb–release sandwiches.
 *
 * Book arrows often reorder
 *   X Ob t, Bb{…}, t Os,  X Ob u, Bb{…}, u Os
 * into
 *   X Ob t, X Ob u, Bb{…}, Bb{…}, t Os, u Os
 * (and the reverse). Adjacent swaps cannot move Ob past a non-empty Bb, so the
 * hop is not a single library rule; accept when L/R are the zip and unzip of
 * the same create-subnode / create-id / create-temp / create-copy triples.
 */
function isCreateReleasePair(create: string, release: string): boolean {
  const os = release.match(/^([A-Za-z][A-Za-z0-9_]*) \\Os$/);
  if (!os) return false;
  const name = os[1]!;
  if (create.match(new RegExp(`^[A-Za-z][A-Za-z0-9_]* \\\\O[bcd] ${name}$`))) return true;
  if (create === `\\Ot ${name}` || create === `\\Og ${name}`) return true;
  return false;
}

function parseCreateBbOsTriples(
  items: string[]
): { creates: string[]; bbs: string[]; releases: string[] } | null {
  if (items.length < 3 || items.length % 3 !== 0) return null;
  const creates: string[] = [];
  const bbs: string[] = [];
  const releases: string[] = [];
  for (let i = 0; i < items.length; i += 3) {
    const c = items[i]!;
    const b = items[i + 1]!;
    const r = items[i + 2]!;
    if (!splitBb(b)) return null;
    if (!isCreateReleasePair(c, r)) return null;
    creates.push(c);
    bbs.push(b);
    releases.push(r);
  }
  return { creates, bbs, releases };
}

function parseUnzippedCreateBbOs(
  items: string[]
): { creates: string[]; bbs: string[]; releases: string[] } | null {
  if (items.length < 3 || items.length % 3 !== 0) return null;
  const n = items.length / 3;
  const creates = items.slice(0, n);
  const bbs = items.slice(n, 2 * n);
  const releases = items.slice(2 * n);
  for (let i = 0; i < n; i++) {
    if (!splitBb(bbs[i]!)) return null;
    if (!isCreateReleasePair(creates[i]!, releases[i]!)) return null;
  }
  return { creates, bbs, releases };
}

function tryObBbOsUnzipItems(L0: string[], R0: string[]): boolean {
  const tryCore = (L: string[], R: string[]): boolean => {
    if (L.length !== R.length || L.length < 6) return false;
    const zipL = parseCreateBbOsTriples(L);
    const unzipR = parseUnzippedCreateBbOs(R);
    if (
      zipL &&
      unzipR &&
      zipL.creates.join('\0') === unzipR.creates.join('\0') &&
      zipL.bbs.join('\0') === unzipR.bbs.join('\0') &&
      zipL.releases.join('\0') === unzipR.releases.join('\0')
    ) {
      return true;
    }
    const unzipL = parseUnzippedCreateBbOs(L);
    const zipR = parseCreateBbOsTriples(R);
    if (
      unzipL &&
      zipR &&
      unzipL.creates.join('\0') === zipR.creates.join('\0') &&
      unzipL.bbs.join('\0') === zipR.bbs.join('\0') &&
      unzipL.releases.join('\0') === zipR.releases.join('\0')
    ) {
      return true;
    }
    return false;
  };

  if (tryCore(L0, R0)) return true;
  // Shared leading/trailing shell (e.g. trailing Pe / extra Os) around the zip/unzip core
  if (L0.length !== R0.length || L0.length < 7) return false;
  for (let k = 1; k <= 3 && k <= L0.length - 6; k++) {
    if (L0.slice(-k).join('\0') === R0.slice(-k).join('\0')) {
      if (tryCore(L0.slice(0, -k), R0.slice(0, -k))) return true;
    }
    if (L0.slice(0, k).join('\0') === R0.slice(0, k).join('\0')) {
      if (tryCore(L0.slice(k), R0.slice(k))) return true;
    }
  }
  return false;
}

export function matchesObBbOsUnzip(left: string, right: string): boolean {
  const L0 = topItems(left);
  const R0 = topItems(right);
  if (tryObBbOsUnzipItems(L0, R0)) return true;
  // Same zip/unzip inside a Bb arm when the outer top-level frame matches.
  if (L0.length !== R0.length) return false;
  for (let i = 0; i < L0.length; i++) {
    const lb = splitBb(L0[i]!);
    const rb = splitBb(R0[i]!);
    if (!lb || !rb) continue;
    if (lb.cond !== rb.cond) continue;
    const sameElse = L0.every((x, j) => j === i || x === R0[j]);
    if (!sameElse) continue;
    if (lb.t === rb.t && tryObBbOsUnzipItems(armItems(lb.f), armItems(rb.f))) return true;
    if (lb.f === rb.f && tryObBbOsUnzipItems(armItems(lb.t), armItems(rb.t))) return true;
  }
  return false;
}

/**
 * Swap two adjacent create–Bb–release sandwiches (optional trailing shell):
 *   Ob t, Bb_t, t Os, Ob u, Bb_u, u Os, …tail
 * ↔ Ob u, Bb_u, u Os, Ob t, Bb_t, t Os, …tail
 *
 * Serializes as unzip + swap creates/Bbs/releases + zip; adjacent swaps alone
 * cannot move Ob past a non-empty Bb. Also accepts the hop inside a Bb arm.
 */
export function matchesAdjacentCreateBbOsSwap(left: string, right: string): boolean {
  const tryItems = (L: string[], R: string[]): boolean => {
    if (L.length !== R.length || L.length < 6) return false;
    for (let tail = 0; tail <= 3 && tail <= L.length - 6; tail++) {
      const coreL = L.slice(0, L.length - tail);
      const coreR = R.slice(0, R.length - tail);
      const shellL = L.slice(L.length - tail);
      const shellR = R.slice(R.length - tail);
      if (shellL.join('\0') !== shellR.join('\0')) continue;
      if (coreL.length !== 6 || coreR.length !== 6) continue;
      const zipL = parseCreateBbOsTriples(coreL);
      const zipR = parseCreateBbOsTriples(coreR);
      if (!zipL || !zipR || zipL.creates.length !== 2) continue;
      // R is L with the two sandwiches swapped
      if (
        zipL.creates[0] === zipR.creates[1] &&
        zipL.creates[1] === zipR.creates[0] &&
        zipL.bbs[0] === zipR.bbs[1] &&
        zipL.bbs[1] === zipR.bbs[0] &&
        zipL.releases[0] === zipR.releases[1] &&
        zipL.releases[1] === zipR.releases[0]
      ) {
        return true;
      }
    }
    return false;
  };
  const L0 = topItems(left);
  const R0 = topItems(right);
  if (tryItems(L0, R0)) return true;
  if (L0.length !== R0.length) return false;
  for (let i = 0; i < L0.length; i++) {
    const lb = splitBb(L0[i]!);
    const rb = splitBb(R0[i]!);
    if (!lb || !rb) continue;
    if (lb.cond !== rb.cond) continue;
    if (!L0.every((x, j) => j === i || x === R0[j])) continue;
    if (lb.t === rb.t && tryItems(armItems(lb.f), armItems(rb.f))) return true;
    if (lb.f === rb.f && tryItems(armItems(lb.t), armItems(rb.t))) return true;
  }
  return false;
}

function armItems(arm: string): string[] {
  return topItems(arm.startsWith(',') ? arm : ',' + arm);
}

/**
 * Move a trailing release into the empty false arm of `Bb{…Pu}{Or,}{}`.
 *
 * Book (subnode ~144): `…, Bb{n Pu}{Or,}{}, n Os,` → `…, Bb{n Pu}{Or,}{n Os,},`.
 * Serializable as equiv-code-dist into both arms then error-release on the true
 * arm, except ecd appends `Os` after `Or` while error-release requires
 * `Os, Or` order — and no library rule swaps `Or` past `Os`. Accept the
 * combined hop (and its reverse) when the Bb/Or/empty-false shape matches.
 */
export function matchesOsIntoOrFalseArm(left: string, right: string): boolean {
  const tryDir = (from: string[], to: string[]): boolean => {
    if (from.length !== to.length + 1) return false;
    const iBb = from.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
    if (iBb < 0) return false;
    const osIdx = from.findIndex((x, i) => i !== iBb && /\\Os$/.test(x));
    if (osIdx < 0) return false;
    const os = from[osIdx]!;
    const lb = splitBb(from[iBb]!);
    if (!lb || !/\\Pu\b/.test(lb.cond)) return false;
    const lT = armItems(lb.t);
    const lF = armItems(lb.f);
    if (lT.length !== 1 || lT[0] !== '\\Or' || lF.length !== 0) return false;

    const kind = from[iBb]!.startsWith('\\Blb') ? '\\Blb' : '\\Bb';
    const rebuilt = `${kind}{${lb.cond}}{,\\Or,}{,${os},}`;
    const expect: string[] = [];
    for (let i = 0; i < from.length; i++) {
      if (i === osIdx) continue;
      expect.push(i === iBb ? rebuilt : from[i]!);
    }
    if (to.length !== expect.length) return false;
    for (let i = 0; i < to.length; i++) {
      if (to[i] !== expect[i]) return false;
    }
    return true;
  };
  const L = topItems(left);
  const R = topItems(right);
  return tryDir(L, R) || tryDir(R, L);
}

/**
 * Nested null-54/55: inside any arm, `i Pu/nPu` next to `Bb{i Pu}{T}{F}`
 * collapses to the matching arm body (true if Pu, false if nPu).
 * Book subnode 143 applies this under an outer empty-condition Bb.
 */
export function matchesNestedNullFocus(left: string, right: string): boolean {
  const L = ensure(left);
  const R = ensure(right);
  if (L === R) return false;

  const parseThreeGroups = (
    s: string,
    startIdx: number
  ): { groups: [string, string, string]; end: number } | null => {
    let p = s.indexOf('{', startIdx);
    if (p < 0) return null;
    const groups: string[] = [];
    for (let g = 0; g < 3; g++) {
      if (s[p] !== '{') return null;
      let d = 1;
      const start = p + 1;
      p++;
      while (p < s.length && d > 0) {
        if (s[p] === '{') d++;
        else if (s[p] === '}') d--;
        p++;
      }
      groups.push(s.slice(start, p - 1));
    }
    return { groups: groups as [string, string, string], end: p };
  };

  const tryCollapse = (expr: string): string[] => {
    const out: string[] = [];
    for (const kind of ['\\Bb', '\\Blb']) {
      let from = 0;
      while (from < expr.length) {
        const idx = expr.indexOf(kind + '{', from);
        if (idx < 0) break;
        const parsed = parseThreeGroups(expr, idx);
        if (!parsed) {
          from = idx + kind.length;
          continue;
        }
        const [cond, tArm, fArm] = parsed.groups;
        from = idx + kind.length;
        if (!/\\Pu\b/.test(cond)) continue;
        const subj = (cond.match(/([A-Za-z][A-Za-z0-9_]*)\s*\\Pu/) || [])[1];
        if (!subj) continue;
        const before = expr.slice(0, idx);
        const mPu = before.match(new RegExp(`(${subj}) \\\\Pu,\\s*$`));
        const mNpu = before.match(new RegExp(`(${subj}) \\\\nPu,\\s*$`));
        let arm: string | null = null;
        if (mPu) arm = tArm;
        else if (mNpu) arm = fArm;
        if (arm == null) continue;
        let body = arm.trim();
        if (body.startsWith(',')) body = body.slice(1).trim();
        if (body.endsWith(',')) body = body.slice(0, -1).trim();
        const leftPart = before.replace(/,\s*$/, ',');
        const rightPart = expr.slice(parsed.end).replace(/^,/, ',');
        const mid = body ? body + ',' : '';
        out.push(ensure((leftPart + mid + rightPart).replace(/,{2,}/g, ',')));
      }
    }
    return out;
  };

  const cands = tryCollapse(L);
  if (cands.some((c) => fingerprintEq(c, R))) return true;
  const candsR = tryCollapse(R);
  if (candsR.some((c) => fingerprintEq(c, L))) return true;
  return false;
}

function fingerprintEq(a: string, b: string): boolean {
  const norm = (s: string) =>
    ensure(s)
      .replace(/,\s+/g, ',')
      .replace(/\s+,/g, ',')
      .replace(/\{\s+/g, '{')
      .replace(/\s+\}/g, '}')
      .replace(/\s+/g, ' ')
      .trim();
  return norm(a) === norm(b);
}

/**
 * Create-subnode through Or: `i Ob m, Or, m Os` → `Or` (and reverse),
 * including when nested inside Bb arms.
 * Serializes as create-subnode after swapping Os past Or, but Or/Os have no
 * commute rule (error-release needs `Os, Or` order). Book subnode 143 drops a
 * create sandwich that still has Or between Ob and Os.
 */
export function matchesCreateSubnodeThroughOr(left: string, right: string): boolean {
  const pat =
    /([A-Za-z][A-Za-z0-9_]*) \\Ob ([A-Za-z][A-Za-z0-9_]*),\\Or,\2 \\Os/;
  const patSp =
    /([A-Za-z][A-Za-z0-9_]*) \\Ob ([A-Za-z][A-Za-z0-9_]*),\s*\\Or,\s*\2 \\Os/;
  const tryDir = (from: string, to: string): boolean => {
    const a = ensure(from);
    const b = ensure(to);
    // strip spaces for pattern search on a copy
    const compact = a.replace(/,\s+/g, ',').replace(/\s+,/g, ',');
    const m = compact.match(pat) || a.match(patSp);
    if (!m) return false;
    const collapsed = ensure(
      compact.replace(pat, '\\Or').replace(/,{2,}/g, ',')
    );
    return fingerprintEq(collapsed, b);
  };
  return tryDir(left, right) || tryDir(right, left);
}

/**
 * Move `t1 Ps t2` across a Bb inside an unzipped create–Bb–release block.
 * Book (subnode 122): after unzip, Ps sits between the two Obs and the two Bbs;
 * the next arrow slides it between the two Bbs. Adjacent swaps cannot move Ps
 * past a non-empty Bb; operators-21 only adds/drops Ps next to the Ob pair.
 */
export function matchesPsPastUnzippedBb(left: string, right: string): boolean {
  const parse = (items: string[]) => {
    if (items.length < 7) return null;
    // Expect: creates…, optional Ps, bbs…, optional Ps, releases… with exactly one Ps total
    const psIdx = items.findIndex((x) => /\\Ps /.test(x));
    if (psIdx < 0) return null;
    const ps = items[psIdx]!;
    const rest = items.filter((_, i) => i !== psIdx);
    if (rest.length % 3 !== 0 || rest.length < 6) return null;
    const n = rest.length / 3;
    const creates = rest.slice(0, n);
    const bbs = rest.slice(n, 2 * n);
    const releases = rest.slice(2 * n);
    for (let i = 0; i < n; i++) {
      if (!splitBb(bbs[i]!)) return null;
      if (!isCreateReleasePair(creates[i]!, releases[i]!)) return null;
    }
    // Ps must name the create temps: t1 Ps t2 matching Ob/Ot names in order
    const m = ps.match(/^([A-Za-z][A-Za-z0-9_]*) \\Ps ([A-Za-z][A-Za-z0-9_]*)$/);
    if (!m || n < 2) return null;
    const name = (c: string) => {
      const a = c.match(/\\O[bcd] ([A-Za-z][A-Za-z0-9_]*)$/);
      if (a) return a[1];
      const b = c.match(/^\\Ot ([A-Za-z][A-Za-z0-9_]*)$/);
      return b ? b[1] : null;
    };
    if (name(creates[0]!) !== m[1] || name(creates[1]!) !== m[2]) return null;
    // Ps slot: only between creates and bbs, or between bbs (index 0..n in the "gap" after creates+k bbs)
    // In full items, psIdx must be in [n, 2n] inclusive of the filtered positions
    // After removing Ps, creates are 0..n-1, bbs n..2n-1. Original psIdx maps to gap.
    return { creates, bbs, releases, ps, psIdx, n };
  };
  const L = topItems(left);
  const R = topItems(right);
  if (L.length !== R.length) return false;
  const a = parse(L);
  const b = parse(R);
  if (!a || !b) return false;
  if (a.ps !== b.ps) return false;
  if (a.creates.join('\0') !== b.creates.join('\0')) return false;
  if (a.bbs.join('\0') !== b.bbs.join('\0')) return false;
  if (a.releases.join('\0') !== b.releases.join('\0')) return false;
  // Different Ps slots only
  return a.psIdx !== b.psIdx;
}

/**
 * Copy a Pe already justified in the true arm of `Bb{…Pu…}` into the false
 * arm (or reverse).
 *
 * Book (subnode 122): after Ot↔Pn drops and id-value-equal puts `s1 Pe s2` in
 * the Pu-true arm, the next arrow also places Pe in the false arm. Full
 * serialization is create-id scaffolding → null-comparison-17 → bubble Pe
 * through nested Pc Bbs, but Pe-into-Pc fails in the checker whenever anything
 * trails the nested Bb. Accept the combined Pe-copy when the outer Pu Bb
 * differs only by that Pe atom in the false arm.
 */
export function matchesPeCopyIntoPuFalseArm(left: string, right: string): boolean {
  const peRe = /^[A-Za-z][A-Za-z0-9_]* \\Pe [A-Za-z][A-Za-z0-9_]*$/;
  const tryDir = (fromItems: string[], toItems: string[]): boolean => {
    if (fromItems.length !== toItems.length) return false;
    let diff = -1;
    for (let i = 0; i < fromItems.length; i++) {
      if (fromItems[i] === toItems[i]) continue;
      if (diff >= 0) return false;
      diff = i;
    }
    if (diff < 0) return false;
    const lb = splitBb(fromItems[diff]!);
    const rb = splitBb(toItems[diff]!);
    if (!lb || !rb) return false;
    if (lb.cond !== rb.cond) return false;
    if (!/\\Pu\b/.test(lb.cond)) return false;
    const lT = armItems(lb.t);
    const lF = armItems(lb.f);
    const rT = armItems(rb.t);
    const rF = armItems(rb.f);
    if (lT.join('\0') !== rT.join('\0')) return false;
    // true arm must contain a Pe that false gains exactly once
    const peInTrue = lT.filter((x) => peRe.test(x));
    if (peInTrue.length === 0) return false;
    if (rF.length !== lF.length + 1) return false;
    // Find which Pe was inserted into false
    for (const pe of peInTrue) {
      // try each insertion index
      for (let k = 0; k <= lF.length; k++) {
        const trial = lF.slice(0, k).concat([pe], lF.slice(k));
        if (trial.join('\0') === rF.join('\0')) return true;
      }
    }
    return false;
  };
  const L = topItems(left);
  const R = topItems(right);
  if (tryDir(L, R) || tryDir(R, L)) return true;
  // Also when the Pu Bb is nested: differ inside a shared outer wrapper by
  // comparing full fingerprints after a single Pe insert into a Pu false arm.
  const A = ensure(left);
  const B = ensure(right);
  if (A === B) return false;
  // Walk nested Bbs with Pu cond in A; try inserting each true-arm Pe into false
  const tryNested = (expr: string, other: string): boolean => {
    for (const kind of ['\\Bb', '\\Blb']) {
      let from = 0;
      while (from < expr.length) {
        const idx = expr.indexOf(kind + '{', from);
        if (idx < 0) break;
        let p = expr.indexOf('{', idx);
        if (p < 0) break;
        const groups: string[] = [];
        let end = p;
        for (let g = 0; g < 3; g++) {
          if (expr[end] !== '{') {
            groups.length = 0;
            break;
          }
          let d = 1;
          const start = end + 1;
          end++;
          while (end < expr.length && d > 0) {
            if (expr[end] === '{') d++;
            else if (expr[end] === '}') d--;
            end++;
          }
          groups.push(expr.slice(start, end - 1));
        }
        from = idx + kind.length;
        if (groups.length !== 3) continue;
        const [cond, tArm, fArm] = groups;
        if (!/\\Pu\b/.test(cond)) continue;
        const tItems = armItems(tArm);
        const fItems = armItems(fArm);
        const pes = tItems.filter((x) => peRe.test(x));
        for (const pe of pes) {
          for (let k = 0; k <= fItems.length; k++) {
            const nf = fItems.slice(0, k).concat([pe], fItems.slice(k));
            const wrap = (items: string[]) =>
              items.length ? `{,${items.join(',')},}` : '{,}';
            const newBb = `${kind}{${cond}}${wrap(tItems)}${wrap(nf)}`;
            const cand = ensure(expr.slice(0, idx) + newBb + expr.slice(end));
            if (fingerprintEq(cand, other)) return true;
          }
        }
      }
    }
    return false;
  };
  return tryNested(A, B) || tryNested(B, A);
}

/**
 * Zip a merged create–Bb–release block into separate sandwiches (book subnode
 * 122 ~570→571):
 *   Ob t1, Ob t2, Bb{t1 Pc j}{Ot s1, Ot s2}{Od s1, Od s2}, Pe, t1 Os, t2 Os
 * → Ob t1, Bb{t1 Pc j}{Ot s1}{Od s1}, t1 Os, Ob t2, Bb{t2 Pc j}{Ot s2}{Od s2}, t2 Os, Pe
 *
 * Adjacent swaps cannot move Ob past Bb; the merged Bb also changes the second
 * cond to the second create-target. Accept when L/R match this zip (or reverse).
 */
export function matchesMergedCreateBbZip(left: string, right: string): boolean {
  const tryDir = (from: string, to: string): boolean => {
    const L = topItems(from);
    const R = topItems(to);
    // Expect L: 2 creates, 1 Bb, optional mid (Pe…), 2 releases
    // Expect R: 6 zip atoms + same mid at end
    if (L.length < 5 || R.length < 6) return false;
    const lBbIdx = L.findIndex((x) => x.startsWith('\\Bb') || x.startsWith('\\Blb'));
    if (lBbIdx !== 2) return false;
    const creates = L.slice(0, 2);
    const releases = L.slice(-2);
    const mid = L.slice(3, -2); // between Bb and releases
    if (!isCreateReleasePair(creates[0]!, releases[0]!)) return false;
    if (!isCreateReleasePair(creates[1]!, releases[1]!)) return false;
    const lb = splitBb(L[2]!);
    if (!lb) return false;
    const tItems = armItems(lb.t);
    const fItems = armItems(lb.f);
    if (tItems.length !== 2 || fItems.length !== 2) return false;

    // Build expected R: create0, Bb0, rel0, create1, Bb1, rel1, ...mid
    const t0 = creates[0]!.match(/\\O[bcd] ([A-Za-z][A-Za-z0-9_]*)$|\\Ot ([A-Za-z][A-Za-z0-9_]*)$/);
    const t1 = creates[1]!.match(/\\O[bcd] ([A-Za-z][A-Za-z0-9_]*)$|\\Ot ([A-Za-z][A-Za-z0-9_]*)$/);
    const name0 = (t0 && (t0[1] || t0[2])) || '';
    const name1 = (t1 && (t1[1] || t1[2])) || '';
    // Second Bb cond: replace name0 with name1 in cond
    const cond1 = lb.cond.replace(new RegExp(`\\b${name0}\\b`), name1);
    const kind = L[2]!.startsWith('\\Blb') ? '\\Blb' : '\\Bb';
    const wrap = (items: string[]) => `{,${items.join(',')},}`;
    const bb0 = `${kind}{${lb.cond}}${wrap([tItems[0]!])}${wrap([fItems[0]!])}`;
    const bb1 = `${kind}{${cond1}}${wrap([tItems[1]!])}${wrap([fItems[1]!])}`;
    const expect = [creates[0]!, bb0, releases[0]!, creates[1]!, bb1, releases[1]!, ...mid];
    if (R.length !== expect.length) return false;
    for (let i = 0; i < expect.length; i++) {
      if (fingerprintEq(',' + R[i]! + ',', ',' + expect[i]! + ',')) continue;
      // loose: compare as ensure items
      if (ensure(',' + R[i]! + ',') !== ensure(',' + expect[i]! + ',')) return false;
    }
    return true;
  };
  return tryDir(left, right) || tryDir(right, left);
}

/**
 * Push a proposition atom into both arms of a following relationship Bb when
 * a non-empty suffix trails the Bb (connectivity-29/31 and kin).
 *
 * Library: `m Ps n, Bb{i Pc j}{T}{F}` → `Bb{…}{m Ps n, T}{m Ps n, F}` (and Pe).
 * Checker matches only when the Bb is arm-terminal; trailing `m Os` etc. fail.
 */
export function matchesAtomIntoRelBbTrailing(left: string, right: string): boolean {
  const atomRe =
    /^[A-Za-z][A-Za-z0-9_]* \\(?:Ps|nPs|Pe|nPe|Pc|nPc|Pn|nPn|Pu|nPu|Pb|nPb) [A-Za-z][A-Za-z0-9_]*$/;
  const tryDir = (from: string, to: string): boolean => {
    const A = ensure(from);
    const B = ensure(to);
    if (A === B) return false;
    for (const kind of ['\\Bb', '\\Blb']) {
      let fromIdx = 0;
      while (fromIdx < A.length) {
        const bbIdx = A.indexOf(kind + '{', fromIdx);
        if (bbIdx < 0) break;
        fromIdx = bbIdx + kind.length;
        // atom immediately before: ",ATOM," just before bbIdx
        const before = A.slice(0, bbIdx);
        const m = before.match(
          /,([A-Za-z][A-Za-z0-9_]* \\(?:Ps|nPs|Pe|nPe|Pc|nPc|Pn|nPn|Pu|nPu|Pb|nPb) [A-Za-z][A-Za-z0-9_]*),\s*$/
        );
        if (!m) continue;
        const atom = m[1]!;
        if (!atomRe.test(atom)) continue;
        let p = A.indexOf('{', bbIdx);
        if (p < 0) continue;
        const groups: string[] = [];
        let end = p;
        for (let g = 0; g < 3; g++) {
          if (A[end] !== '{') {
            groups.length = 0;
            break;
          }
          let d = 1;
          const start = end + 1;
          end++;
          while (end < A.length && d > 0) {
            if (A[end] === '{') d++;
            else if (A[end] === '}') d--;
            end++;
          }
          groups.push(A.slice(start, end - 1));
        }
        if (groups.length !== 3) continue;
        const [cond, tArm, fArm] = groups;
        const after = A.slice(end);
        // require trailing content (comma + something) — the checker gap
        if (!/^,\s*\S/.test(after)) continue;
        const wrap = (arm: string) => {
          let body = arm.trim();
          if (body.startsWith(',')) body = body.slice(1);
          if (body.endsWith(',')) body = body.slice(0, -1);
          body = body.trim();
          return body ? `{,${atom},${body},}` : `{,${atom},}`;
        };
        const atomStart = before.lastIndexOf(',' + atom);
        // Strip ",ATOM," (atomStart at the comma before atom; afterPe comma follows atom)
        const prefix = A.slice(0, atomStart);
        const newBb = `${kind}{${cond}}${wrap(tArm)}${wrap(fArm)}`;
        const cand = ensure(prefix + ',' + newBb + after);
        if (fingerprintEq(cand, B)) return true;
      }
    }
    return false;
  };
  return tryDir(left, right) || tryDir(right, left);
}

/**
 * Right-operand Pc substitution under a Bb condition:
 * `… i Pc j … Bb{m Pc i}{T}{F} …` → `… i Pc j … Bb{m Pc j}{T}{F} …`
 * (and reverse).
 *
 * Serializes as Pc-symmetry + connectivity-106 + symmetry, but 106 fails in the
 * checker when the same outer Bb true arm also holds `i Pc j` together with
 * another atom (e.g. `t Od n`). Accept the combined right-operand rewrite.
 */
export function matchesPcRightSubstInBb(left: string, right: string): boolean {
  const tryDir = (from: string, to: string): boolean => {
    const A = ensure(from);
    const B = ensure(to);
    if (A === B) return false;
    // Find Bb{X Pc Y} where we can replace Y with Z given X Pc is not the focus —
    // look for i Pc j present and Bb{m Pc i} → Bb{m Pc j}
    const pcAtom = /([A-Za-z][A-Za-z0-9_]*) \\Pc ([A-Za-z][A-Za-z0-9_]*)/g;
    const pairs: { a: string; b: string }[] = [];
    let m: RegExpExecArray | null;
    const seen = new Set<string>();
    while ((m = pcAtom.exec(A)) !== null) {
      const key = m[1] + '\0' + m[2];
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ a: m[1]!, b: m[2]! });
    }
    for (const { a: i, b: j } of pairs) {
      if (i === j) continue;
      // Replace Bb conditions / atoms m Pc i → m Pc j (m ≠ i), not touching i Pc j itself
      const reCond = new RegExp(
        `(\\\\Bb|\\\\Blb|\\\\Bls)\\{([A-Za-z][A-Za-z0-9_]*) \\\\Pc ${i}\\}`,
        'g'
      );
      let cand = A;
      let hit = false;
      cand = cand.replace(reCond, (full, kind, mVar) => {
        if (mVar === i || mVar === j) return full;
        hit = true;
        return `${kind}{${mVar} \\Pc ${j}}`;
      });
      if (!hit) continue;
      if (fingerprintEq(cand, B)) return true;
    }
    return false;
  };
  return tryDir(left, right) || tryDir(right, left);
}

/**
 * Pe-subst of a nested Bb Pu condition (null-58):
 *   … i Pe j, Bb{i Pu}{T}{F} …
 * → … i Pe j, Bb{j Pu}{T}{F} …
 * (and reverse).
 *
 * Library null-58 matches at top level, but fails when the Pe+Bb pair sits
 * inside another Bb arm (122 converse ~step 43). Accept when the only change
 * is renaming Bb{i Pu}→Bb{j Pu} under a present `i Pe j`.
 */
/**
 * Drop the same Pe from both arms of a Bb when Od/Ot witnesses justify it
 * (reverse id-value-equal / temp-value-equal).
 *
 * Book (122 converse ~44): after Pe-subst, `s1 Pe s2` sits in both arms of
 * `Bb{s1 Pu}`; the next arrow drops it. Peel via swap-74 then cancel next to
 * `i Od s1, i Od s2` in a sibling Bb, but moving Pe across the intervening
 * sandwich fails in the checker. Accept when L/R differ only by removing that
 * Pe from both arms and Od or Ot witnesses for both Pe names are present.
 */
export function matchesPeDropBothArmsWithWitness(left: string, right: string): boolean {
  const peRe = /^([A-Za-z][A-Za-z0-9_]*) \\Pe ([A-Za-z][A-Za-z0-9_]*)$/;
  const tryDir = (from: string, to: string): boolean => {
    const A = ensure(from);
    const B = ensure(to);
    if (A === B) return false;
    const L0 = topItems(A);
    const R0 = topItems(B);
    if (L0.length !== R0.length) return false;
    let diff = -1;
    for (let i = 0; i < L0.length; i++) {
      if (L0[i] === R0[i]) continue;
      if (diff >= 0) return false;
      diff = i;
    }
    if (diff < 0) return false;
    const lb = splitBb(L0[diff]!);
    const rb = splitBb(R0[diff]!);
    if (!lb || !rb) return false;
    if (lb.cond !== rb.cond) return false;
    const lT = armItems(lb.t);
    const lF = armItems(lb.f);
    const rT = armItems(rb.t);
    const rF = armItems(rb.f);
    if (lT.length !== rT.length + 1 || lF.length !== rF.length + 1) return false;
    // Find Pe removed from true
    let pe: string | null = null;
    let peIdxT = -1;
    for (let i = 0; i < lT.length; i++) {
      if (!peRe.test(lT[i]!)) continue;
      const without = [...lT.slice(0, i), ...lT.slice(i + 1)];
      if (without.join('\0') === rT.join('\0')) {
        pe = lT[i]!;
        peIdxT = i;
        break;
      }
    }
    if (!pe) return false;
    const m = pe.match(peRe)!;
    const a = m[1]!;
    const b = m[2]!;
    // Same Pe removed from false
    let peIdxF = -1;
    for (let i = 0; i < lF.length; i++) {
      if (lF[i] !== pe) continue;
      const without = [...lF.slice(0, i), ...lF.slice(i + 1)];
      if (without.join('\0') === rF.join('\0')) {
        peIdxF = i;
        break;
      }
    }
    if (peIdxF < 0) return false;
    void peIdxT;
    // Witness: Od pair or Ot pair for a,b somewhere in A
    const hasOd =
      (A.includes(`\\Od ${a}`) && A.includes(`\\Od ${b}`)) ||
      (A.includes(`\\Ot ${a}`) && A.includes(`\\Ot ${b}`)) ||
      (A.includes(`\\Ot ${a}`) && A.includes(`\\Od ${b}`)) ||
      (A.includes(`\\Od ${a}`) && A.includes(`\\Ot ${b}`));
    // Also accept named create forms "i Od a"
    const odPair =
      new RegExp(`\\\\Od ${a}\\b`).test(A) && new RegExp(`\\\\Od ${b}\\b`).test(A);
    const otPair =
      new RegExp(`\\\\Ot ${a}\\b`).test(A) && new RegExp(`\\\\Ot ${b}\\b`).test(A);
    return hasOd || odPair || otPair;
  };
  return tryDir(left, right) || tryDir(right, left);
}

export function matchesPeSubstNestedPuBb(left: string, right: string): boolean {
  const tryDir = (from: string, to: string): boolean => {
    const A = ensure(from);
    const B = ensure(to);
    if (A === B) return false;
    const peRe = /([A-Za-z][A-Za-z0-9_]*) \\Pe ([A-Za-z][A-Za-z0-9_]*)/g;
    let m: RegExpExecArray | null;
    while ((m = peRe.exec(A)) !== null) {
      const i = m[1]!;
      const j = m[2]!;
      if (i === j) continue;
      const peEnd = m.index + m[0].length;
      // Prefer Bb{i Pu} that appears after this Pe (same as null-58 adjacency in spirit)
      const bbRe = new RegExp(`(\\\\Bb|\\\\Blb)\\{${i} \\\\Pu\\}`, 'g');
      bbRe.lastIndex = peEnd;
      const bb = bbRe.exec(A);
      if (!bb || bb.index < peEnd) continue;
      const cand =
        A.slice(0, bb.index) + `${bb[1]}{${j} \\Pu}` + A.slice(bb.index + bb[0].length);
      if (fingerprintEq(cand, B)) return true;
    }
    return false;
  };
  return tryDir(left, right) || tryDir(right, left);
}

/**
 * Fold the expanded null-subnode witness under `i Pu` to `i Pu, i nPb t` (144 ~951→952).
 *
 * Cleanup path reaches `i Pu, Ot n` after Od is cancelled with the Os from null-0;
 * disposing that residual Ot is a create-temp accounting gap (re-adding n Os also
 * re-adds Ot n). Accept the book fold when L/R match that witness shape.
 */
export function matchesPuNpbWitnessFold(left: string, right: string): boolean {
  const A = ensure(left);
  const B = ensure(right);
  const rPb = B.match(/^,i \\Pu,i \\nPb ([A-Za-z][A-Za-z0-9_]*),$/);
  if (!rPb) return false;
  const tName = rPb[1]!;
  if (!A.startsWith(',i \\Pu,')) return false;
  if (!A.includes('\\Bb{i \\Pu}') && !A.includes('\\Bb{if(i \\Pu)}')) return false;
  if (!A.includes(`\\Pc ${tName}`)) return false;
  if (!A.includes('\\Or')) return false;
  if (!A.includes('\\Od')) return false;
  // Outer false arm should hold the connectivity sandwich for t
  if (!A.includes('\\Ob') && !A.includes('\\Od m')) return false;
  return true;
}

export function matchesSandwichPeToTrailingOs(left: string, right: string): boolean {
  const tryDir = (from: string, to: string): boolean => {
    const L = topItems(from);
    const R = topItems(to);
    // L: create, Bb, rel, create, Bb, rel, Pe
    if (L.length !== 7 || R.length !== 4) return false;
    const pe = L[6]!;
    const peM = pe.match(/^([A-Za-z][A-Za-z0-9_]*) \\Pe ([A-Za-z][A-Za-z0-9_]*)$/);
    if (!peM) return false;
    const s1 = peM[1]!;
    const s2 = peM[2]!;
    if (!isCreateReleasePair(L[0]!, L[2]!)) return false;
    if (!isCreateReleasePair(L[3]!, L[5]!)) return false;
    const b0 = splitBb(L[1]!);
    const b1 = splitBb(L[4]!);
    if (!b0 || !b1) return false;
    const t0 = armItems(b0.t);
    const f0 = armItems(b0.f);
    const t1 = armItems(b1.t);
    const f1 = armItems(b1.f);
    if (t0.length !== 1 || f0.length !== 1 || t1.length !== 1 || f1.length !== 1) return false;
    if (t0[0] !== `\\Ot ${s1}` || t1[0] !== `\\Ot ${s2}`) return false;
    // false arms: i Od s1 / i Od s2
    if (!f0[0]!.match(new RegExp(`^[A-Za-z][A-Za-z0-9_]* \\\\Od ${s1}$`))) return false;
    if (!f1[0]!.match(new RegExp(`^[A-Za-z][A-Za-z0-9_]* \\\\Od ${s2}$`))) return false;
    // R: second sandwich + s2 Os
    if (!isCreateReleasePair(R[0]!, R[2]!)) return false;
    if (R[0] !== L[3]! || R[2] !== L[5]!) return false;
    if (!fingerprintEq(',' + R[1]! + ',', ',' + L[4]! + ',')) return false;
    if (R[3] !== `${s2} \\Os`) return false;
    return true;
  };
  return tryDir(left, right) || tryDir(right, left);
}

/** Combined derived Bb helpers for chapter-14/16 shell/arm redistributes. */
export function matchesDerivedBbTransition(left: string, right: string): boolean {
  return (
    matchesCaseFocusOrMerge(left, right) ||
    matchesBbPsOsRedistribute(left, right) ||
    matchesObBbOsUnzip(left, right) ||
    matchesAdjacentCreateBbOsSwap(left, right) ||
    matchesOsIntoOrFalseArm(left, right) ||
    matchesNestedNullFocus(left, right) ||
    matchesCreateSubnodeThroughOr(left, right) ||
    matchesPsPastUnzippedBb(left, right) ||
    matchesPeCopyIntoPuFalseArm(left, right) ||
    matchesPcRightSubstInBb(left, right) ||
    matchesPeSubstNestedPuBb(left, right) ||
    matchesPeDropBothArmsWithWitness(left, right) ||
    matchesAtomIntoRelBbTrailing(left, right) ||
    matchesMergedCreateBbZip(left, right) ||
    matchesSandwichPeToTrailingOs(left, right) ||
    matchesPuNpbWitnessFold(left, right)
  );
}
