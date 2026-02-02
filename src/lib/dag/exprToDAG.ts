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

/** Check if expression contains branch operators */
function hasBranch(expr: string): boolean {
  return /\\B[lr]b|\\Bb/.test(expr);
}

/** Parse \Bb{cond}{top}{bottom}, \Blb{cond}{top}{bottom}, or \Brb{top}{bottom} - only when expr is solely a branch */
function parseBranchAtStart(
  expr: string
): { kind: 'Bb' | 'Blb' | 'Brb'; cond?: string; top: string; bottom: string } | null {
  const trimmed = expr.trim();
  const bb = trimmed.match(/^\s*\\Bb\s*\{/);
  const blb = trimmed.match(/^\s*\\Blb\s*\{/);
  const brb = trimmed.match(/^\s*\\Brb\s*\{/);

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
    return { kind, cond: condRes.content, top: topRes.content, bottom: bottomRes.content };
  }

  const topRes = parseOneBraced(trimmed, pos);
  if (!topRes) return null;
  pos = topRes.end;
  const bottomRes = parseOneBraced(trimmed, pos);
  if (!bottomRes) return null;
  return { kind, top: topRes.content, bottom: bottomRes.content };
}

/** Recursively build DAG. Handles branch when expr is solely \Bb, \Blb, or \Brb. */
function buildDAGRec(
  expr: string,
  nodes: DAGNode<ExprNodeData>[],
  edges: DAGEdge[],
  nextId: { n: number }
): void {
  const trimmed = expr.trim();
  if (!trimmed) return;

  const branch = parseBranchAtStart(trimmed);
  if (branch) {
    const branchId = `n${nextId.n++}`;
    const opFull = branch.kind === 'Bb' ? '\\Bb' : branch.kind === 'Blb' ? '\\Blb' : '\\Brb';
    const operands = branch.cond ? [branch.cond] : [];
    nodes.push({ id: branchId, data: { op: opFull, operands } });

    const topNodes: DAGNode<ExprNodeData>[] = [];
    const topEdges: DAGEdge[] = [];
    const topNextId = { n: 0 };
    buildDAGRec(branch.top, topNodes, topEdges, topNextId);
    const topRoot = topNodes[0]?.id;
    if (topRoot) {
      const offset = nextId.n;
      topNodes.forEach((n) => nodes.push({ ...n, id: `n${offset + parseInt(n.id.slice(1), 10)}` }));
      nextId.n += topNodes.length;
      topEdges.forEach((e) =>
        edges.push({
          from: `n${offset + parseInt(e.from.slice(1), 10)}`,
          to: `n${offset + parseInt(e.to.slice(1), 10)}`,
        })
      );
      edges.push({ from: branchId, to: `n${offset}` });
    }

    const bottomNodes: DAGNode<ExprNodeData>[] = [];
    const bottomEdges: DAGEdge[] = [];
    const bottomNextId = { n: 0 };
    buildDAGRec(branch.bottom, bottomNodes, bottomEdges, bottomNextId);
    const bottomRoot = bottomNodes[0]?.id;
    if (bottomRoot) {
      const offset = nextId.n;
      bottomNodes.forEach((n) => nodes.push({ ...n, id: `n${offset + parseInt(n.id.slice(1), 10)}` }));
      nextId.n += bottomNodes.length;
      bottomEdges.forEach((e) =>
        edges.push({
          from: `n${offset + parseInt(e.from.slice(1), 10)}`,
          to: `n${offset + parseInt(e.to.slice(1), 10)}`,
        })
      );
      edges.push({ from: branchId, to: `n${offset}` });
    }
    return;
  }

  const ops = extractOperations(trimmed);
  for (let i = 0; i < ops.length; i++) {
    const o = ops[i];
    const nodeId = `n${nextId.n++}`;
    const data: ExprNodeData = { op: o.op, operands: [...o.operands], start: o.start, end: o.end };
    nodes.push({ id: nodeId, data });
    if (i > 0) {
      edges.push({ from: `n${nextId.n - 2}`, to: nodeId });
    }
  }
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
