/**
 * Format branch expressions (\Bb, \Blb, \Brb) as a tree for terminal display.
 * When a branch is encountered, top is shown above and bottom below, recursively.
 */

type BranchInfo =
  | { kind: 'Bb'; cond: string; top: string; bottom: string; start: number; end: number }
  | { kind: 'Blb'; cond: string; top: string; bottom: string; start: number; end: number }
  | { kind: 'Brb'; top: string; bottom: string; start: number; end: number };

function parseOneBraced(expr: string, pos: number): { content: string; end: number } | null {
  if (expr[pos] !== '{') return null;
  let depth = 0;
  const contentStart = pos + 1;
  for (let i = pos; i < expr.length; i++) {
    if (expr[i] === '{') depth++;
    else if (expr[i] === '}') {
      depth--;
      if (depth === 0) {
        return { content: expr.substring(contentStart, i), end: i + 1 };
      }
    }
  }
  return null;
}

function findFirstBranch(expr: string): BranchInfo | null {
  const bb = expr.match(/\\Bb\s*\{/);
  const blb = expr.match(/\\Blb\s*\{/);
  const brb = expr.match(/\\Brb\s*\{/);

  const candidates: { m: RegExpMatchArray; kind: 'Bb' | 'Blb' | 'Brb' }[] = [];
  if (bb) candidates.push({ m: bb, kind: 'Bb' });
  if (blb) candidates.push({ m: blb, kind: 'Blb' });
  if (brb) candidates.push({ m: brb, kind: 'Brb' });

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.m.index! - b.m.index!);
  const { m, kind } = candidates[0];
  const start = m.index!;
  let pos = start + m[0].length - 1;

  if (kind === 'Bb') {
    const condRes = parseOneBraced(expr, pos);
    if (!condRes) return null;
    pos = condRes.end;
    const topRes = parseOneBraced(expr, pos);
    if (!topRes) return null;
    pos = topRes.end;
    const bottomRes = parseOneBraced(expr, pos);
    if (!bottomRes) return null;
    return { kind: 'Bb', cond: condRes.content, top: topRes.content, bottom: bottomRes.content, start, end: bottomRes.end };
  }

  if (kind === 'Blb') {
    const condRes = parseOneBraced(expr, pos);
    if (!condRes) return null;
    pos = condRes.end;
    const topRes = parseOneBraced(expr, pos);
    if (!topRes) return null;
    pos = topRes.end;
    const bottomRes = parseOneBraced(expr, pos);
    if (!bottomRes) return null;
    return { kind: 'Blb', cond: condRes.content, top: topRes.content, bottom: bottomRes.content, start, end: bottomRes.end };
  }

  const topRes = parseOneBraced(expr, pos);
  if (!topRes) return null;
  pos = topRes.end;
  const bottomRes = parseOneBraced(expr, pos);
  if (!bottomRes) return null;
  return { kind: 'Brb', top: topRes.content, bottom: bottomRes.content, start, end: bottomRes.end };
}

/**
 * Format an expression with branches as a multi-line tree.
 * Top branch content appears above, bottom below, with indentation for nesting.
 */
export function formatBranchTree(expr: string, indent = ''): string {
  const branch = findFirstBranch(expr);
  if (!branch) return expr;

  const prefix = expr.substring(0, branch.start);
  const suffix = expr.substring(branch.end);

  const branchLabel = branch.kind === 'Bb' ? `\\Bb{${branch.cond}}` : branch.kind === 'Blb' ? `\\Blb{${branch.cond}}` : '\\Brb';
  const topTree = formatBranchTree(branch.top, '  ');
  const bottomTree = formatBranchTree(branch.bottom, '  ');

  const childIndent = indent + '  ';
  const lines: string[] = [];

  if (prefix.trim()) lines.push(indent + prefix.trimEnd());
  lines.push(indent + branchLabel);

  const topLines = topTree.split('\n');
  lines.push(childIndent + '+-- TOP: ' + topLines[0].trimStart());
  topLines.slice(1).forEach((line) => lines.push(childIndent + '|   ' + line));

  const bottomLines = bottomTree.split('\n');
  lines.push(childIndent + '\\-- BOT: ' + bottomLines[0].trimStart());
  bottomLines.slice(1).forEach((line) => lines.push(childIndent + '    ' + line));

  if (suffix.trim()) lines.push(indent + suffix.trimStart());

  return lines.join('\n');
}

/**
 * Log an expression to console with tree display when it contains branches.
 * Use for debugging: logBranchTree(expr)
 */
export function logBranchTree(expr: string): void {
  if (/\\B[lr]b|\\Bb/.test(expr)) {
    console.log(formatBranchTree(expr));
  } else {
    console.log(expr);
  }
}
