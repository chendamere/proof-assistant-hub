/**
 * Subexpression generation for expressions with branches
 *
 * \Bb{cond}{top}{bottom} creates two variant groups:
 * - \Blb: prefix combinations (take first k items from top, first j from bottom)
 * - \Brb: suffix combinations (take last k items from top, last j from bottom)
 * Handles nested branches recursively.
 */

/** Split branch content into comma-delimited items, respecting nested braces. Trailing empty from "...," is excluded. */
function splitBranchItems(content: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '{') {
      depth++;
      current += char;
    } else if (char === '}') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      items.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  items.push(current);
  // Exclude trailing empty from "...," pattern
  if (items.length > 1 && items[items.length - 1] === '') {
    items.pop();
  }
  return items;
}

/** Build branch content from items (prefix or suffix slice). Empty => "," for {,} structure. */
function buildBranchContent(items: string[]): string {
  if (items.length === 0) return ',';
  return items.join(',') + ',';
}

/** Get prefix of branch: first k items */
function branchPrefix(items: string[], k: number): string {
  return buildBranchContent(items.slice(0, k));
}

/** Get suffix of branch: last k items. Uses leading ", " for comma structure (e.g. {,  c  \Op,}). */
function branchSuffix(items: string[], k: number): string {
  if (k === 0) return ', ';  // Empty => {, }
  const suffixItems = items.slice(-k);
  return ', ' + suffixItems.join(',') + ',';
}

/** Parse \Bb{cond}{top}{bottom} or \Bs{cond}{top}{bottom} - returns null if not found. \Bs is treated as \Bb. */
function parseBb(expr: string): { cond: string; top: string; bottom: string; full: string; start: number; end: number } | null {
  const match = expr.match(/\\B[bs]\s*\{/);
  if (!match) return null;

  const start = match.index!;
  let pos = start + match[0].length - 1; // position of first {

  const parseOne = (): string | null => {
    if (expr[pos] !== '{') return null;
    let depth = 0;
    const contentStart = pos + 1;
    for (let i = pos; i < expr.length; i++) {
      if (expr[i] === '{') depth++;
      else if (expr[i] === '}') {
        depth--;
        if (depth === 0) {
          const content = expr.substring(contentStart, i);
          pos = i + 1;
          return content;
        }
      }
    }
    return null;
  };

  const cond = parseOne();
  if (cond === null) return null;
  const top = parseOne();
  if (top === null) return null;
  const bottom = parseOne();
  if (bottom === null) return null;

  const end = pos;
  const full = expr.substring(start, end);
  return { cond, top, bottom, full, start, end };
}

/**
 * Get all prefix variants of a comma-separated prefix string.
 * E.g. ", i \Op,  " -> ["", ",  ", ", i \Op,  "]
 * Recursively splits at the last top-level comma.
 */
function getPrefixVariants(prefix: string): string[] {
  const variants = new Set<string>();
  variants.add('');

  function add(s: string): void {
    if (!s) return;
    variants.add(s);
    const lastComma = s.lastIndexOf(',');
    if (lastComma < 0) return;
    const before = s.substring(0, lastComma);
    const fromComma = s.substring(lastComma);
    variants.add(fromComma);
    add(before);
  }

  add(prefix);
  return Array.from(variants).filter((v) => v === '' || /,\s*$/.test(v));
}

/**
 * Get all suffix variants of a comma-separated suffix string.
 * E.g. ", j \Op," -> ["", ", j \Op,"]; ", j \Op, k \On," -> ["", ",", ", k \On,", ", j \Op, k \On,"]
 * Finds each top-level comma and adds the substring from that comma to end.
 */
function getSuffixVariants(suffix: string): string[] {
  const variants = new Set<string>();
  variants.add('');

  let depth = 0;
  for (let i = 0; i < suffix.length; i++) {
    if (suffix[i] === '{') depth++;
    else if (suffix[i] === '}') depth--;
    else if (suffix[i] === ',' && depth === 0) {
      variants.add(suffix.substring(i));
    }
  }

  return Array.from(variants).filter((v) => v === '' || /^,\s*/.test(v));
}

/**
 * Generate all subexpressions for an expression containing \Bb branches.
 * For each \Bb{cond}{top}{bottom}:
 * - \Blb{cond}{top}{bottom}: prefix combinations (same structure as \Bb, 3 braces)
 * - \Brb: suffix combinations (2 braces)
 * Also includes: expression without the branch, and the full \Bb.
 */
/** True if s has no empty operation (comma-whitespace-comma). */
function noDoubleCommas(s: string): boolean {
  return !/,\s*,/.test(s);
}

/** True if s contains only delimiters (commas, whitespace) - no operations like \Op, \On. */
function isDelimiterOnly(s: string): boolean {
  return /^[\s,]*$/.test(s);
}

/** Redundant: delimiter-only except "," (e.g. ", ", " , ") */
function isRedundantDelimiterOnly(s: string): boolean {
  return /^[\s,]+$/.test(s) && s !== ',';
}

/** Content within an arm that precedes the first nested branch (\\Bb, \\Blb, \\Brb, \\Brs), if any. */
function armContentBeforeFirstBranch(arm: string): string {
  const m = arm.match(/\\(?:Bb|Bs|Blb|Brb|Brs)\s*\{/);
  if (!m || m.index == null) return arm;
  return arm.substring(0, m.index);
}

/** True if an \\Blb arm contains a nested branch and the content before it is delimiter-only (invalid). */
function outerBlbArmInvalid(arm: string): boolean {
  const before = armContentBeforeFirstBranch(arm);
  return before !== arm && isDelimiterOnly(before);
}

/** Extract cond, top, bottom from \\Blb{cond}{top}{bottom} (3 braces). Returns null if not a Blb or parse fails. */
function parseBlbArms(s: string): { cond: string; top: string; bottom: string } | null {
  const m = s.match(/\\Blb\s*\{/);
  if (!m || m.index == null) return null;
  let pos = m.index + m[0].length - 1;
  const parseOne = (): string | null => {
    if (s[pos] !== '{') return null;
    let depth = 0;
    const start = pos + 1;
    for (let i = pos; i < s.length; i++) {
      if (s[i] === '{') depth++;
      else if (s[i] === '}') {
        depth--;
        if (depth === 0) {
          pos = i + 1;
          return s.substring(start, i);
        }
      }
    }
    return null;
  };
  const cond = parseOne();
  if (cond === null) return null;
  while (pos < s.length && s[pos] !== '{' && /[\s,]/.test(s[pos])) pos++;
  const top = parseOne();
  if (top === null) return null;
  while (pos < s.length && s[pos] !== '{' && /[\s,]/.test(s[pos])) pos++;
  const bottom = parseOne();
  if (bottom === null) return null;
  return { cond, top, bottom };
}

/** True if the string contains any \\Blb with an invalid arm (delimiter-only before nested branch). */
function hasInvalidBlbArm(s: string): boolean {
  let idx = 0;
  while (true) {
    const m = s.substring(idx).match(/\\Blb\s*\{/);
    if (!m || m.index == null) break;
    const blbStart = idx + m.index;
    const arms = parseBlbArms(s.substring(blbStart));
    if (arms && (outerBlbArmInvalid(arms.top) || outerBlbArmInvalid(arms.bottom))) return true;
    idx = blbStart + 1;
  }
  return false;
}

/** Collapse multiple consecutive spaces to a single space. */
function normalizeSpaces(s: string): string {
  return s.replace(/\s{2,}/g, ' ');
}

export function generateSubexpressions(expression: string): string[] {
  const results = new Set<string>();
  const processed = new Set<string>();
  const expr = normalizeSpaces(expression);

  function addResult(s: string): void {
    const t = normalizeSpaces(s);
    if (!noDoubleCommas(t)) return;
    if (isRedundantDelimiterOnly(t)) return;
    if (hasInvalidBlbArm(t)) return;
    results.add(t);
  }

  function process(expr: string): void {
    if (processed.has(expr)) return;
    processed.add(expr);
    const bb = parseBb(expr);
    if (!bb) {
      addResult(expr);
      return;
    }

    const prefix = expr.substring(0, bb.start);
    const suffix = expr.substring(bb.end);

    const topItems = splitBranchItems(bb.top);
    const bottomItems = splitBranchItems(bb.bottom);
    const nTop = topItems.length;
    const nBottom = bottomItems.length;

    const prefixVariants = getPrefixVariants(prefix);
    const suffixVariants = getSuffixVariants(suffix);
    // Branches must be between delimiters - need trailing delimiter, so exclude empty suffix
    const branchSuffixVariants = suffixVariants.filter((s) => s !== '');

    // Base: without the branch - all prefix × suffix combinations
    const fallbackPrefixes = new Set<string>();
    for (const p of prefixVariants) {
      for (const s of suffixVariants) {
        const base = p + s;
        if (base.length > 0) {
          addResult(base);
          if (!noDoubleCommas(base) && p.length > 0 && !/^[\s,]+$/.test(p)) fallbackPrefixes.add(p);
        }
      }
    }
    fallbackPrefixes.forEach((p) => addResult(p));

    // Recursively process the content before/after in case there are more branches
    if (/\\B[bs]/.test(prefix)) {
      const leftBb = parseBb(prefix);
      if (leftBb) process(prefix);
    }
    if (/\\B[bs]/.test(suffix)) {
      const rightBb = parseBb(suffix);
      if (rightBb) process(suffix);
    }

    const branchPrefixVariants = prefixVariants.filter((p) => p !== '');
    // \Blb: suffix must be delimiter-only (no operations after Blb, e.g. no ", j \Op,")
    const blbSuffixVariants = branchSuffixVariants.filter((s) => isDelimiterOnly(s));
    // \Brb: prefix must be delimiter-only (no operations before Brb, e.g. no ", i \Op, ")
    const brbPrefixVariants = prefixVariants.filter((p) => isDelimiterOnly(p) && p !== '');

    for (const p of branchPrefixVariants) {
      for (const s of blbSuffixVariants) {
        // \Blb variants: suffix must not have operations after
        // When top/bottom contains a branch, it must hug left (not generated here; recursive case handles)
        for (let pt = 0; pt <= nTop; pt++) {
          for (let pb = 0; pb <= nBottom; pb++) {
            const topPart = branchPrefix(topItems, pt);
            const bottomPart = branchPrefix(bottomItems, pb);
            if (topPart.includes('\\Bb') || topPart.includes('\\Bs') || topPart.includes('\\Blb') || topPart.includes('\\Brb') || topPart.includes('\\Brs') ||
                bottomPart.includes('\\Bb') || bottomPart.includes('\\Bs') || bottomPart.includes('\\Blb') || bottomPart.includes('\\Brb') || bottomPart.includes('\\Brs')) continue;
            const isEmptyBlb = pt === 0 && pb === 0;
            if (isEmptyBlb && s.length > 0) continue;
            const blb = `\\Blb{${bb.cond}}{${topPart}}{${bottomPart}}`;
            addResult(p + blb + s);
          }
        }
      }
    }

    for (const p of brbPrefixVariants) {
      for (const s of branchSuffixVariants) {
        for (let st = 0; st <= nTop; st++) {
          for (let sb = 0; sb <= nBottom; sb++) {
            const topPart = branchSuffix(topItems, st);
            const bottomPart = branchSuffix(bottomItems, sb);
            const brb = `\\Brb{${topPart}}{${bottomPart}}`;
            addResult(p + brb + s);
          }
        }
      }
    }

    // Full \Bb with each prefix × suffix combination
    for (const p of branchPrefixVariants) {
      for (const s of branchSuffixVariants) {
        addResult(p + bb.full + s);
      }
    }

    // Recursively process nested branches inside top/bottom
    // - Outer \Bb: inner is plain or \Bb only
    // - Outer \Blb: inner can be \Blb or \Bb (Blb->Blb, Blb->Bb)
    // - Outer \Brb: inner can be \Brb or \Bb (Brb->Brb, Brb->Bb)
    const recBrbPrefixVariants = prefixVariants.filter((p) => isDelimiterOnly(p) && p !== '');
    const recBlbSuffixVariants = branchSuffixVariants.filter((s) => isDelimiterOnly(s));

    const addRecursive = (
      outerBranch: string,
      isOuterBrb: boolean,
      isOuterBlb: boolean,
    ): void => {
      if (isOuterBrb) {
        for (const p of recBrbPrefixVariants) {
          process(p + outerBranch + suffix);
        }
      } else if (isOuterBlb) {
        for (const s of recBlbSuffixVariants) {
          process(prefix + outerBranch + s);
        }
      } else {
        process(prefix + outerBranch + suffix);
      }
    };

    const hasBbOrBs = (s: string) => /\\B[bs]/.test(s);
    const hasBrbOrBrs = (s: string) => /\\Br[bs]/.test(s);
    if (hasBbOrBs(bb.top)) {
      const topBb = parseBb(bb.top);
      if (topBb) {
        const subTop = generateSubexpressions(bb.top);
        for (const st of subTop) {
          if (st !== bb.top) {
            if (hasBrbOrBrs(st) && !st.includes('\\Blb') && !hasBbOrBs(st)) {
              addRecursive(`\\Brb{${st}}{${bb.bottom}}`, true, false);
            } else if (!st.includes('\\Blb') && !hasBrbOrBrs(st)) {
              addRecursive(`\\Bb{${bb.cond}}{${st}}{${bb.bottom}}`, false, false);
            }
            // Blb->Blb, Blb->Bb: outer \Blb with inner \Blb or \Bb; skip if content before inner branch is delimiter-only
            if ((st.includes('\\Blb') || hasBbOrBs(st)) && !hasBrbOrBrs(st) && !outerBlbArmInvalid(st)) {
              addRecursive(`\\Blb{${bb.cond}}{${st}}{${bb.bottom}}`, false, true);
            }
          }
        }
      }
    }
    if (hasBbOrBs(bb.bottom)) {
      const bottomBb = parseBb(bb.bottom);
      if (bottomBb) {
        const subBottom = generateSubexpressions(bb.bottom);
        for (const sb of subBottom) {
          if (sb !== bb.bottom) {
            if (hasBrbOrBrs(sb) && !sb.includes('\\Blb') && !hasBbOrBs(sb)) {
              addRecursive(`\\Brb{${bb.top}}{${sb}}`, true, false);
            } else if (!sb.includes('\\Blb') && !hasBrbOrBrs(sb)) {
              addRecursive(`\\Bb{${bb.cond}}{${bb.top}}{${sb}}`, false, false);
            }
            // Blb->Blb, Blb->Bb: outer \Blb with inner \Blb or \Bb; skip if content before inner branch is delimiter-only
            if ((sb.includes('\\Blb') || hasBbOrBs(sb)) && !hasBrbOrBrs(sb) && !outerBlbArmInvalid(sb)) {
              addRecursive(`\\Blb{${bb.cond}}{${bb.top}}{${sb}}`, false, true);
            }
          }
        }
      }
    }
  }

  process(expr);

  // Final filter: reject any \Blb with delimiter-only content before nested branch
  const filtered = Array.from(results).filter((r) => !hasInvalidBlbArm(r));

  return filtered.sort((a, b) => {
    const posA = expr.indexOf(a);
    const posB = expr.indexOf(b);
    const startA = posA < 0 ? expr.length : posA;
    const startB = posB < 0 ? expr.length : posB;
    if (startA !== startB) return startA - startB;
    return a.length - b.length;
  });
}
