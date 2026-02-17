/**
 * Convert proof-assistant expressions to DAG structure.
 * Operations become nodes; operands are stored in node data.
 * Branch head nodes are identified by :cond, tail by :tail (no Bb/Blb/Brb in node data).
 */

import type { DAGStructure, DAGNode, DAGEdge, ExprNodeData, EdgeType } from './types';

function pushEdge(edges: DAGEdge[], from: string, to: string, edgeType: EdgeType = 0): void {
  edges.push({ from, to, edgeType });
}
import { normalizeSpacing } from '../inferenceRules/utils';

function parseOneBraced(expr: string, pos: number): { content: string; end: number } | null {
  if (pos >= expr.length || expr[pos] !== '{') return null;
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

/** Operators that take no operands (nullary) */
const NULLARY_OPERATORS = new Set(['\\Or', '\\Ri', '\\Rq']);

/** Plus operator: "a+b:c" form (ignore colon for structure; 3 operands: left, right, result). */
const PLUS_OP = '\\+';
const PLUS_PATTERN = /([a-zA-Z](?:_\d+)?|\d+)\s*\+\s*([a-zA-Z](?:_\d+)?|\d+)\s*:\s*([a-zA-Z](?:_\d+)?|\d+)/g;

/** Times operator: "a \\times b : c" form (ignore colon for structure; 3 operands: left, right, result). */
const TIMES_OP = '\\times';
const TIMES_PATTERN = /([a-zA-Z](?:_\d+)?|\d+)\s*\\times\s*([a-zA-Z](?:_\d+)?|\d+)\s*:\s*([a-zA-Z](?:_\d+)?|\d+)/g;

/** Extract "a+b:c" plus operations first so they become one node with 3 operands and are not confused with \Op. */
function extractPlusOperations(expr: string): Array<{ op: string; operands: string[]; start: number; end: number }> {
  const ops: Array<{ op: string; operands: string[]; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  PLUS_PATTERN.lastIndex = 0;
  while ((m = PLUS_PATTERN.exec(expr)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    ops.push({ op: PLUS_OP, operands: [m[1]!, m[2]!, m[3]!], start, end });
  }
  return ops;
}

/** Extract "a \\times b : c" times operations (3 operands: left, right, result). */
function extractTimesOperations(expr: string): Array<{ op: string; operands: string[]; start: number; end: number }> {
  const ops: Array<{ op: string; operands: string[]; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  TIMES_PATTERN.lastIndex = 0;
  while ((m = TIMES_PATTERN.exec(expr)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    ops.push({ op: TIMES_OP, operands: [m[1]!, m[2]!, m[3]!], start, end });
  }
  return ops;
}

/** Function-like ops: Ins(t;j), Del(j), In(t;j), R(m), Rc(m;n). No backslash prefix. */
const FUNCLIKE_PATTERN = /\b(Ins|Del|In|Rc|R)\(([^)]*)\)/g;

function extractFunctionLikeOperations(expr: string): Array<{ op: string; operands: string[]; start: number; end: number }> {
  const ops: Array<{ op: string; operands: string[]; start: number; end: number }> = [];
  let m: RegExpExecArray | null;
  FUNCLIKE_PATTERN.lastIndex = 0;
  while ((m = FUNCLIKE_PATTERN.exec(expr)) !== null) {
    const opName = m[1]!;
    const args = m[2]!.split(';').map((s) => s.trim()).filter(Boolean);
    const start = m.index;
    const end = m.index + m[0].length;
    ops.push({ op: opName, operands: args, start, end });
  }
  return ops;
}

/** Extract operations from a flat (no branches) comma-separated expression */
function extractOperations(expr: string): Array<{ op: string; operands: string[]; start: number; end: number }> {
  const plusOps = extractPlusOperations(expr);
  const timesOps = extractTimesOperations(expr);
  const funcLikeOps = extractFunctionLikeOperations(expr);
  const specialOps = [...plusOps, ...timesOps, ...funcLikeOps];
  const ops: Array<{ op: string; operands: string[]; start: number; end: number }> = [];
  // Match \Op, \On, \nPs, \nPu, etc. The optional leading 'n' captures negated operators (\nPs, \nPu, \nPe, ...).
  const operatorPattern = /\\(n?[A-Z][a-z]*)\b/g;
  let match;

  while ((match = operatorPattern.exec(expr)) !== null) {
    const opStart = match.index;
    if (specialOps.some((p) => opStart >= p.start && opStart < p.end)) continue;
    const opFull = '\\' + match[1];
    const opEnd = match.index + match[0].length;

    let operandBefore: string | undefined;
    let operandAfter: string | undefined;
    let rangeStart = opStart;

    let afterEnd = opEnd;
    if (!NULLARY_OPERATORS.has(opFull)) {
      // Look backwards for operand before (skip whitespace only; comma is a boundary between list items)
      let beforeStart = opStart - 1;
      while (beforeStart >= 0 && /\s/.test(expr[beforeStart])) beforeStart--;
      if (beforeStart >= 0 && expr[beforeStart] !== ',') {
        const beforeText = expr.substring(Math.max(0, beforeStart - 12), beforeStart + 1);
        const bm = beforeText.match(/([a-zA-Z](?:_\d+)?|\d+)\s*$/);
        if (bm) {
          const matchEnd = beforeStart + 1;
          const matchStart = matchEnd - bm[1].length;
          // Reject if the match is the suffix of a LaTeX command (e.g. "s" from \Os)
          const prevCh = matchStart > 0 ? expr[matchStart - 1] : '';
          if (!/[a-z]/.test(prevCh)) {
            // Also reject when immediately after a \Word (e.g. "s" in "j \Os," before "\Ot")
            let pos = matchStart - 1;
            while (pos >= 0 && /[A-Za-z]/.test(expr[pos])) pos--;
            if (pos < 0 || expr[pos] !== '\\') {
              operandBefore = bm[1];
              rangeStart = matchStart;
            }
          }
        }
      }

      // Look forwards for operand after
      while (afterEnd < expr.length && /\s/.test(expr[afterEnd])) afterEnd++;
      if (afterEnd < expr.length) {
        const afterText = expr.substring(afterEnd);
        const am = afterText.match(/^([a-zA-Z](?:_\d+)?|\d+)/);
        if (am) operandAfter = am[1];
      }
    }

    const operands: string[] = [];
    if (operandBefore !== undefined) operands.push(operandBefore);
    if (operandAfter !== undefined) operands.push(operandAfter);

    // End of this operation: next comma or start of next operator
    let rangeEnd = afterEnd + (operandAfter?.length ?? 0);
    while (rangeEnd < expr.length) {
      if (expr[rangeEnd] === ',') {
        rangeEnd++;
        break;
      }
      if (expr[rangeEnd] === '\\' && expr[rangeEnd + 1]?.match(/[A-Z]/)) break;
      if (expr[rangeEnd] === '{') {
        const braced = parseOneBraced(expr, rangeEnd);
        if (braced) rangeEnd = braced.end;
        else rangeEnd++;
      } else {
        rangeEnd++;
      }
    }

    ops.push({ op: opFull, operands, start: rangeStart, end: rangeEnd });
  }
  const merged = [...specialOps, ...ops].sort((a, b) => a.start - b.start);
  return merged;
}

/** If condition is if(...), extract only the content between parentheses. Trim leading/trailing commas (e.g. ",m \\Pe n," -> "m \\Pe n"). */
function normalizeBranchCondition(cond: string): string {
  let t = cond.trim().replace(/^[\s,]+|[\s,]+$/g, '').trim();
  if (t.startsWith('if(')) {
    let depth = 1;
    let i = 3;
    while (i < t.length && depth > 0) {
      if (t[i] === '(') depth++;
      else if (t[i] === ')') {
        depth--;
        if (depth === 0) return t.substring(3, i).trim().replace(/^[\s,]+|[\s,]+$/g, '').trim();
      }
      i++;
    }
  }
  return t;
}

/** Parse a condition like "i \\Oe j" into { op: "\\Oe", operands: ["i","j"] }. Returns null if no op found. */
function parseConditionOp(cond: string): { op: string; operands: string[] } | null {
  const normalized = normalizeBranchCondition(cond);
  const ops = extractOperations(normalized.trim());
  if (ops.length === 0) return null;
  const first = ops[0];
  return { op: first.op, operands: [...first.operands] };
}

/** Check if expression contains branch operators */
function hasBranch(expr: string): boolean {
  return /\\B[lr]b|\\Brs|\\B[bs]/.test(expr);
}

/** Parse \Bb{cond}{top}{bottom}, \Bs{cond}{top}{bottom}, \Blb{cond}{top}{bottom}, \Brb{top}{bottom}, or \Brs{top}{bottom}. \Bs is treated as \Bb. \Brs is treated as \Brb. */
function parseBranchAtStart(
  expr: string
): {
  kind: 'Bb' | 'Blb' | 'Brb' | 'Brs';
  cond?: string;
  top: string;
  bottom: string;
  condEnd?: number;
  topEnd?: number;
  bottomEnd: number;
} | null {
  const trimmed = expr.trim();
  const bb = trimmed.match(/^[\s,]*\\Bb\s*\{/);
  const bs = trimmed.match(/^[\s,]*\\Bs\s*\{/);
  const blb = trimmed.match(/^[\s,]*\\Blb\s*\{/);
  const bls = trimmed.match(/^[\s,]*\\Bls\s*\{/);
  const brb = trimmed.match(/^[\s,]*\\Brb\s*\{/);
  const brs = trimmed.match(/^[\s,]*\\Brs\s*\{/);

  const candidates: { m: RegExpMatchArray; kind: 'Bb' | 'Blb' | 'Brb' }[] = [];
  if (bb) candidates.push({ m: bb, kind: 'Bb' });
  if (bs) candidates.push({ m: bs, kind: 'Bb' });
  if (blb) candidates.push({ m: blb, kind: 'Blb' });
  if (bls) candidates.push({ m: bls, kind: 'Blb' });
  if (brb) candidates.push({ m: brb, kind: 'Brb' });
  if (brs) candidates.push({ m: brs, kind: 'Brb' });
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.m.index! - b.m.index!);
  const { m, kind } = candidates[0];
  let pos = m.index! + m[0].length - 1;

  if (kind === 'Bb' || kind === 'Blb') {
    const condRes = parseOneBraced(trimmed, pos);
    if (!condRes) return null;
    pos = condRes.end;
    const topRes = parseOneBraced(trimmed, pos);
    if (!topRes) return null;
    pos = topRes.end;
    const bottomRes = parseOneBraced(trimmed, pos);
    if (!bottomRes) return null;
    return {
      kind,
      cond: normalizeBranchCondition(condRes.content),
      top: topRes.content,
      bottom: bottomRes.content,
      condEnd: condRes.end,
      topEnd: topRes.end,
      bottomEnd: bottomRes.end,
    };
  }

  const topRes = parseOneBraced(trimmed, pos);
  if (!topRes) return null;
  pos = topRes.end;
  const bottomRes = parseOneBraced(trimmed, pos);
  if (!bottomRes) return null;
  return { kind, top: topRes.content, bottom: bottomRes.content, topEnd: topRes.end, bottomEnd: bottomRes.end };
}

/** Split expression by top-level commas (not inside braces). Returns [item, startIndex] pairs. */
function splitSequence(expr: string): Array<{ item: string; start: number }> {
  const result: Array<{ item: string; start: number }> = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === '{') depth++;
    else if (expr[i] === '}') depth--;
    else if (expr[i] === ',' && depth === 0) {
      result.push({ item: expr.substring(start, i), start });
      start = i + 1;
    }
  }
  result.push({ item: expr.substring(start), start });
  return result;
}

/** Result of building a sub-DAG: first and last node ids for chaining. */
type BuildResult = {
  firstId?: string;
  firstIds?: string[];
  lastId?: string;
  lastIds?: string[];
} | null;

/** Build a single item: branch or ops. offset = start index of item in full expression (for start/end). */
function buildItem(
  item: string,
  nodes: DAGNode<ExprNodeData>[],
  edges: DAGEdge[],
  nextId: { n: number },
  offset = 0
): BuildResult {
  const trimmed = item.trim();
  if (!trimmed) return null;
  const trimStart = item.search(/\S/);
  const trimmedOffset = offset + (trimStart >= 0 ? trimStart : 0);

  const branch = parseBranchAtStart(trimmed);
  const hasRemainderAfterBranch = branch != null && trimmed.substring(branch.bottomEnd).trim().length > 0;
  if (branch && !hasRemainderAfterBranch) {
    if (branch.kind === 'Brb') {
      const topBracePos = trimmed.indexOf('{');
      const topRes = topBracePos >= 0 ? parseOneBraced(trimmed, topBracePos) : null;
      const botRes = topRes ? parseOneBraced(trimmed, topRes.end) : null;
      const topOffset = topRes ? trimmedOffset + topBracePos + 1 : trimmedOffset;
      const botOffset = topRes && botRes ? trimmedOffset + topRes.end + 1 : trimmedOffset;
      const tailId = `n${nextId.n++}`;
      nodes.push({
        id: tailId,
        data: { op: ':tail', operands: [], start: trimmedOffset, end: trimmedOffset + trimmed.length, branchKind: branch.kind },
      });

      const topResult = buildItem(branch.top, nodes, edges, nextId, topOffset);
      const botResult = buildItem(branch.bottom, nodes, edges, nextId, botOffset);

      const firstIds: string[] = [];
      if (topResult) {
        firstIds.push(topResult.firstId!);
        pushEdge(edges, topResult.lastId!, tailId, 3); // top→tail
      }
      if (botResult) {
        firstIds.push(botResult.firstId!);
        pushEdge(edges, botResult.lastId!, tailId, 4); // bottom→tail
      }
      if (firstIds.length === 0) firstIds.push(tailId);

      return { firstIds, lastId: tailId };
    }

    if (branch.kind === 'Blb') {
      const topOffset = branch.condEnd != null ? trimmedOffset + branch.condEnd + 1 : trimmedOffset;
      const botOffset = branch.topEnd != null ? trimmedOffset + branch.topEnd + 1 : trimmedOffset;
      const condHeadId = `n${nextId.n++}`;
      const condParsed = branch.cond ? parseConditionOp(branch.cond) : null;
      const condOp = condParsed ? `:cond:${condParsed.op}` : ':cond';
      const condOperands = condParsed ? condParsed.operands : branch.cond ? [branch.cond] : [];
      nodes.push({
        id: condHeadId,
        data: { op: condOp, operands: condOperands, start: trimmedOffset, end: branch.condEnd ?? trimmedOffset, branchKind: 'Blb' },
      });

      const lastIds: string[] = [];
      const topResult = buildItem(branch.top, nodes, edges, nextId, topOffset);
      if (topResult) {
        pushEdge(edges, condHeadId, topResult.firstId!, 1); // cond→top
        lastIds.push(topResult.lastId!);
      } else {
        lastIds.push(condHeadId);
      }
      const botResult = buildItem(branch.bottom, nodes, edges, nextId, botOffset);
      if (botResult) {
        pushEdge(edges, condHeadId, botResult.firstId!, 2); // cond→bottom
        lastIds.push(botResult.lastId!);
      } else if (!topResult) {
        lastIds.pop(); // already pushed condHeadId for empty top
        lastIds.push(condHeadId);
      }

      return { firstId: condHeadId, lastIds };
    }

    // Bb: cond head + tail, both arms converge
    const topOffset = branch.condEnd != null ? trimmedOffset + branch.condEnd + 1 : trimmedOffset;
    const botOffset = branch.topEnd != null ? trimmedOffset + branch.topEnd + 1 : trimmedOffset;
    const condHeadId = `n${nextId.n++}`;
    const condParsed = branch.cond ? parseConditionOp(branch.cond) : null;
    const condOp = condParsed ? `:cond:${condParsed.op}` : ':cond';
    const condOperands = condParsed ? condParsed.operands : branch.cond ? [branch.cond] : [];
    nodes.push({
      id: condHeadId,
      data: { op: condOp, operands: condOperands, start: trimmedOffset, end: branch.condEnd ?? trimmedOffset, branchKind: 'Bb' },
    });

    const tailId = `n${nextId.n++}`;
    nodes.push({
      id: tailId,
      data: { op: ':tail', operands: [], start: trimmedOffset, end: trimmedOffset + trimmed.length, branchKind: 'Bb' },
    });

    const topResult = buildItem(branch.top, nodes, edges, nextId, topOffset);
    if (topResult) {
      pushEdge(edges, condHeadId, topResult.firstId!, 1); // cond→top
      pushEdge(edges, topResult.lastId!, tailId, 3); // top→tail
    } else {
      pushEdge(edges, condHeadId, tailId, 0); // empty top arm
    }
    const botResult = buildItem(branch.bottom, nodes, edges, nextId, botOffset);
    if (botResult) {
      pushEdge(edges, condHeadId, botResult.firstId!, 2); // cond→bottom
      pushEdge(edges, botResult.lastId!, tailId, 4); // bottom→tail
    } else {
      pushEdge(edges, condHeadId, tailId, 0); // empty bottom arm
    }

    return { firstId: condHeadId, lastId: tailId };
  }

  // When item contains a branch not at the start (e.g. ",\Os j, \Bb{...},"), or "branch, more" (e.g. ", \Bb{...}{,}{,}, \Or,"),
  // split and build each part so we don't drop content after the branch.
  if (/[{}]/.test(trimmed) && hasBranch(trimmed) && (hasRemainderAfterBranch || !branch)) {
    const parts = splitSequence(trimmed);
    let first: BuildResult = null;
    let prev: BuildResult = null;
    for (const { item, start } of parts) {
      const partTrimmed = item.trim();
      if (!partTrimmed) continue;
      const partOffset = trimmedOffset + start;
      const result = buildItem(partTrimmed, nodes, edges, nextId, partOffset);
      if (result) {
        if (prev) chain(prev, result, edges);
        if (!first) first = result;
        prev = result;
      }
    }
    if (first && prev && first !== prev) {
      const fid = first.firstId ?? first.firstIds?.[0] ?? first.lastId!;
      const lid = prev.lastId ?? prev.lastIds?.[0] ?? prev.firstId!;
      return { firstId: fid, lastId: lid };
    }
    if (prev) return prev;
  }

  const ops = extractOperations(trimmed);
  if (ops.length === 0) return null;

  let firstId: string | null = null;
  let lastId: string | null = null;
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    const nodeId = `n${nextId.n++}`;
    const data: ExprNodeData = {
      op: o.op,
      operands: [...o.operands],
      start: o.start + trimmedOffset,
      end: o.end + trimmedOffset,
    };
    nodes.push({ id: nodeId, data });
    if (i === 0) firstId = nodeId;
    lastId = nodeId;
    if (i > 0) {
      pushEdge(edges, `n${nextId.n - 2}`, nodeId, 0); // chain
    }
  }
  return firstId && lastId ? { firstId, lastId } : null;
}

function chain(from: BuildResult, to: BuildResult, edges: DAGEdge[]): void {
  if (!from || !to) return;
  const fromIds = from.lastIds ?? (from.lastId ? [from.lastId] : []);
  const toIds = to.firstIds ?? (to.firstId ? [to.firstId] : []);
  for (const fid of fromIds) {
    for (const tid of toIds) {
      pushEdge(edges, fid, tid, 0); // chain between items
    }
  }
}

/** Recursively build DAG. Splits by top-level commas so branches are isolated. */
function buildDAGRec(
  expr: string,
  nodes: DAGNode<ExprNodeData>[],
  edges: DAGEdge[],
  nextId: { n: number }
): BuildResult {
  const parts = splitSequence(expr.trim());
  let prev: BuildResult = null;

  for (const { item, start } of parts) {
    const result = buildItem(item, nodes, edges, nextId, start);
    if (result) {
      if (prev) chain(prev, result, edges);
      prev = result;
    }
  }

  return prev;
}

/**
 * Convert expression to DAG.
 * Branch head identified by :cond, tail by :tail.
 * @param expr - Expression (already in pattern form A,B,C for rules, or integers for target)
 */
export function exprToDAG(expr: string): DAGStructure<ExprNodeData> {
  const normalized = normalizeSpacing(expr);
  const nodes: DAGNode<ExprNodeData>[] = [];
  const edges: DAGEdge[] = [];

  if (!normalized.trim()) {
    return { nodes, edges };
  }

  buildDAGRec(normalized, nodes, edges, { n: 0 });

  return { nodes, edges };
}
