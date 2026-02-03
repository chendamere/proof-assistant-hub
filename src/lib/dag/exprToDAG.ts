/**
 * Convert proof-assistant expressions to DAG structure.
 * Operations become nodes; operands are stored in node data.
 * Bb, Blb, Brb are nodes with two outgoing edges (top, bottom arms).
 */

import type { DAGStructure, DAGNode, DAGEdge, ExprNodeData } from './types';
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

/** Extract operations from a flat (no branches) comma-separated expression */
function extractOperations(expr: string): Array<{ op: string; operands: string[]; start: number; end: number }> {
  const ops: Array<{ op: string; operands: string[]; start: number; end: number }> = [];
  const operatorPattern = /\\([A-Z][a-z]*)\b/g;
  let match;

  while ((match = operatorPattern.exec(expr)) !== null) {
    const opFull = '\\' + match[1];
    const opStart = match.index;
    const opEnd = match.index + match[0].length;

    // Look backwards for operand before (skip whitespace and comma)
    let beforeStart = opStart - 1;
    while (beforeStart >= 0 && /\s/.test(expr[beforeStart])) beforeStart--;
    if (beforeStart >= 0 && expr[beforeStart] === ',') {
      beforeStart--;
      while (beforeStart >= 0 && /\s/.test(expr[beforeStart])) beforeStart--;
    }
    let operandBefore: string | undefined;
    let rangeStart = opStart;
    if (beforeStart >= 0) {
      const beforeText = expr.substring(Math.max(0, beforeStart - 12), beforeStart + 1);
      const bm = beforeText.match(/([a-zA-Z](?:_\d+)?|\d+)\s*$/);
      if (bm) {
        operandBefore = bm[1];
        rangeStart = beforeStart - bm[1].length + 1;
      }
    }

    // Look forwards for operand after
    let afterEnd = opEnd;
    while (afterEnd < expr.length && /\s/.test(expr[afterEnd])) afterEnd++;
    let operandAfter: string | undefined;
    if (afterEnd < expr.length) {
      const afterText = expr.substring(afterEnd);
      const am = afterText.match(/^([a-zA-Z](?:_\d+)?|\d+)/);
      if (am) operandAfter = am[1];
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
  return ops;
}

/** Parse a condition like "i \\Oe j" into { op: "\\Oe", operands: ["i","j"] }. Returns null if no op found. */
function parseConditionOp(cond: string): { op: string; operands: string[] } | null {
  const ops = extractOperations(cond.trim());
  if (ops.length === 0) return null;
  const first = ops[0];
  return { op: first.op, operands: [...first.operands] };
}

/** Check if expression contains branch operators */
function hasBranch(expr: string): boolean {
  return /\\B[lr]b|\\Bb/.test(expr);
}

/** Parse \Bb{cond}{top}{bottom}, \Blb{cond}{top}{bottom}, or \Brb{top}{bottom}. Returns content and end positions. */
function parseBranchAtStart(
  expr: string
): {
  kind: 'Bb' | 'Blb' | 'Brb';
  cond?: string;
  top: string;
  bottom: string;
  condEnd?: number;
  topEnd?: number;
  bottomEnd: number;
} | null {
  const trimmed = expr.trim();
  const bb = trimmed.match(/^[\s,]*\\Bb\s*\{/);
  const blb = trimmed.match(/^[\s,]*\\Blb\s*\{/);
  const brb = trimmed.match(/^[\s,]*\\Brb\s*\{/);

  const candidates: { m: RegExpMatchArray; kind: 'Bb' | 'Blb' | 'Brb' }[] = [];
  if (bb) candidates.push({ m: bb, kind: 'Bb' });
  if (blb) candidates.push({ m: blb, kind: 'Blb' });
  if (brb) candidates.push({ m: brb, kind: 'Brb' });
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
      cond: condRes.content,
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
  if (branch) {
    const opFull = branch.kind === 'Bb' ? '\\Bb' : branch.kind === 'Blb' ? '\\Blb' : '\\Brb';

    if (branch.kind === 'Brb') {
      const topBracePos = trimmed.indexOf('{');
      const topRes = topBracePos >= 0 ? parseOneBraced(trimmed, topBracePos) : null;
      const botRes = topRes ? parseOneBraced(trimmed, topRes.end) : null;
      const topOffset = topRes ? trimmedOffset + topBracePos + 1 : trimmedOffset;
      const botOffset = topRes && botRes ? trimmedOffset + topRes.end + 1 : trimmedOffset;
      const tailId = `n${nextId.n++}`;
      nodes.push({
        id: tailId,
        data: { op: `${opFull}:tail`, operands: [], start: trimmedOffset, end: trimmedOffset + trimmed.length },
      });

      const topResult = buildItem(branch.top, nodes, edges, nextId, topOffset);
      const botResult = buildItem(branch.bottom, nodes, edges, nextId, botOffset);

      const firstIds: string[] = [];
      if (topResult) {
        firstIds.push(topResult.firstId!);
        edges.push({ from: topResult.lastId!, to: tailId });
      }
      if (botResult) {
        firstIds.push(botResult.firstId!);
        edges.push({ from: botResult.lastId!, to: tailId });
      }
      if (firstIds.length === 0) firstIds.push(tailId);

      return { firstIds, lastId: tailId };
    }

    if (branch.kind === 'Blb') {
      const topOffset = branch.condEnd != null ? trimmedOffset + branch.condEnd + 1 : trimmedOffset;
      const botOffset = branch.topEnd != null ? trimmedOffset + branch.topEnd + 1 : trimmedOffset;
      const condHeadId = `n${nextId.n++}`;
      const condParsed = branch.cond ? parseConditionOp(branch.cond) : null;
      const condOp = condParsed
        ? `${opFull}:cond:${condParsed.op}`
        : `${opFull}:cond`;
      const condOperands = condParsed ? condParsed.operands : branch.cond ? [branch.cond] : [];
      nodes.push({
        id: condHeadId,
        data: { op: condOp, operands: condOperands, start: trimmedOffset, end: branch.condEnd ?? trimmedOffset },
      });

      const lastIds: string[] = [];
      const topResult = buildItem(branch.top, nodes, edges, nextId, topOffset);
      if (topResult) {
        edges.push({ from: condHeadId, to: topResult.firstId! });
        lastIds.push(topResult.lastId!);
      } else {
        lastIds.push(condHeadId);
      }
      const botResult = buildItem(branch.bottom, nodes, edges, nextId, botOffset);
      if (botResult) {
        edges.push({ from: condHeadId, to: botResult.firstId! });
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
    const condOp = condParsed
      ? `${opFull}:cond:${condParsed.op}`
      : `${opFull}:cond`;
    const condOperands = condParsed ? condParsed.operands : branch.cond ? [branch.cond] : [];
    nodes.push({
      id: condHeadId,
      data: { op: condOp, operands: condOperands, start: trimmedOffset, end: branch.condEnd ?? trimmedOffset },
    });

    const tailId = `n${nextId.n++}`;
    nodes.push({
      id: tailId,
      data: { op: `${opFull}:tail`, operands: [], start: trimmedOffset, end: trimmedOffset + trimmed.length },
    });

    const topResult = buildItem(branch.top, nodes, edges, nextId, topOffset);
    if (topResult) {
      edges.push({ from: condHeadId, to: topResult.firstId! });
      edges.push({ from: topResult.lastId!, to: tailId });
    } else {
      edges.push({ from: condHeadId, to: tailId });
    }
    const botResult = buildItem(branch.bottom, nodes, edges, nextId, botOffset);
    if (botResult) {
      edges.push({ from: condHeadId, to: botResult.firstId! });
      edges.push({ from: botResult.lastId!, to: tailId });
    } else {
      edges.push({ from: condHeadId, to: tailId });
    }

    return { firstId: condHeadId, lastId: tailId };
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
      edges.push({ from: `n${nextId.n - 2}`, to: nodeId });
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
      edges.push({ from: fid, to: tid });
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
 * Bb, Blb, Brb are nodes with two outgoing edges (to top and bottom arms).
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
