/**
 * Shared DAG graph utilities
 */

import type { DAGStructure, ExprNodeData } from './types';

export type Adjacency = {
  outgoing: Map<string, string[]>;
  incoming: Map<string, string[]>;
};

/** Build O(1) lookup map for edge types. Key: from + NUL + to. */
export function buildEdgeTypeMap(
  edges: Array<{ from: string; to: string; edgeType?: number }>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of edges) {
    map.set(`${e.from}\0${e.to}`, (e.edgeType ?? 0) as number);
  }
  return map;
}

/** Build adjacency lists from a DAG structure. */
export function buildAdjacency<T>(structure: DAGStructure<T>): Adjacency {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of structure.nodes) {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  }
  for (const e of structure.edges) {
    if (outgoing.has(e.from) && incoming.has(e.to)) {
      outgoing.get(e.from)!.push(e.to);
      incoming.get(e.to)!.push(e.from);
    }
  }
  return { outgoing, incoming };
}

/**
 * Find all nodes reachable from seedIds by following edges in the given direction,
 * excluding any node in exclude. For 'incoming': nodes that can reach a seed.
 * For 'outgoing': nodes reachable from a seed.
 */
export function reachableFrom(
  seedIds: Iterable<string>,
  adj: Adjacency,
  direction: 'incoming' | 'outgoing',
  exclude: Set<string>
): Set<string> {
  const neighborMap = direction === 'incoming' ? adj.incoming : adj.outgoing;
  const result = new Set<string>();
  const frontier = [...seedIds];
  const visited = new Set<string>();
  while (frontier.length > 0) {
    const id = frontier.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const n of neighborMap.get(id) ?? []) {
      if (!exclude.has(n)) {
        result.add(n);
        frontier.push(n);
      }
    }
  }
  return result;
}

/**
 * Augment target DAG with placeholder nodes for empty arms so \Tc in pattern can match.
 * When target has cond->tail direct (empty arm), insert \Tc placeholder so node count matches pattern.
 */
export function augmentTargetDAGForTcMatching<T extends { op?: string }>(
  structure: DAGStructure<T>
): DAGStructure<T> {
  const nodes = [...structure.nodes];
  const edges = [...structure.edges];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    if (!outgoing.has(e.from)) outgoing.set(e.from, []);
    outgoing.get(e.from)!.push(e.to);
  }
  let nextEmptyId = 0;
  const toAdd: { emptyId: string; from: string; to: string; topArm: boolean }[] = [];
  const condEmptyCount = new Map<string, number>();
  for (const e of edges) {
    const fromNode = nodeMap.get(e.from);
    const toNode = nodeMap.get(e.to);
    const fromOp = (fromNode?.data as { op?: string })?.op ?? '';
    const toOp = (toNode?.data as { op?: string })?.op ?? '';
    if (fromOp.includes(':cond') && toOp.endsWith(':tail')) {
      const count = condEmptyCount.get(e.from) ?? 0;
      condEmptyCount.set(e.from, count + 1);
      toAdd.push({ emptyId: `empty_${nextEmptyId++}`, from: e.from, to: e.to, topArm: count === 0 });
    }
  }
  if (toAdd.length === 0) return structure;
  const newEdges = edges.filter((e) => !toAdd.some((a) => a.from === e.from && a.to === e.to));
  for (const { emptyId, from, to, topArm } of toAdd) {
    nodes.push({
      id: emptyId,
      data: { op: '\\Tc', operands: [''] } as unknown as ExprNodeData,
    } as any);
    if (topArm) {
      newEdges.push({ from, to: emptyId, edgeType: 1 }, { from: emptyId, to, edgeType: 3 }); // empty top arm
    } else {
      newEdges.push({ from, to: emptyId, edgeType: 2 }, { from: emptyId, to, edgeType: 4 }); // empty bottom arm
    }
  }
  return { nodes, edges: newEdges };
}

/**
 * Extract operator identifiers from a DAG for signature matching.
 * For :cond:\Pe returns \Pe; for \Od returns \Od. Used to filter rules by operator overlap.
 */
export function extractOperators<T extends { op?: string }>(structure: DAGStructure<T>): Set<string> {
  const ops = new Set<string>();
  for (const n of structure.nodes) {
    const op = (n.data as { op?: string })?.op ?? '';
    if (!op) continue;
    const base = op.startsWith(':cond:') ? op.slice(6) : op;
    if (base && !base.endsWith(':tail')) ops.add(base);
  }
  return ops;
}

/** Normalize branch op for multiset key (must match vf2Expr key). */
function normalizeBranchOpForMultiset(op: string): string {
  if (/^:cond(:|$)|^:tail$/.test(op)) return op;
  const m = op.match(/^\\B[lr]?b(:cond(?::\S+)?|:tail)$/);
  return m ? m[1] : op;
}

/**
 * (op, operandCount) multiset for a DAG (non-\Tc nodes). Key = normalizedOp:operandCount.
 * Used to pre-filter rules: pattern multiset must be <= target multiset for a match to exist.
 */
export function getOpCountMultiset<T extends { op?: string; operands?: unknown[] }>(
  structure: DAGStructure<T>
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const n of structure.nodes) {
    const op = (n.data as { op?: string })?.op ?? '';
    if (op === '\\Tc') continue;
    const key = `${normalizeBranchOpForMultiset(op)}:${(n.data as { operands?: unknown[] })?.operands?.length ?? 0}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * True iff pattern's (op, count) multiset is contained in target's (patternCount[key] <= targetCount[key] for all keys).
 */
export function patternOpMultisetContainedInTarget<T extends { op?: string; operands?: unknown[] }>(
  pattern: DAGStructure<T>,
  target: DAGStructure<T>
): boolean {
  const pMultiset = getOpCountMultiset(pattern);
  const tMultiset = getOpCountMultiset(target);
  for (const [key, c] of pMultiset) {
    if ((tMultiset.get(key) ?? 0) < c) return false;
  }
  return true;
}

/**
 * Count operations in a DAG. Branch head + condition counts as one; :tail (merge point) is structural and not counted.
 */
export function countOperations<T extends { op?: string }>(structure: DAGStructure<T>): number {
  let count = 0;
  for (const n of structure.nodes) {
    const op = (n.data as { op?: string })?.op ?? '';
    if (op.endsWith(':tail')) continue; // tail is structural, not an operation
    count++;
  }
  return count;
}

/**
 * Extract subgraph of nodes reachable from seedId by following outgoing edges.
 * Includes tail nodes as terminal points. Used for \Tc operand context extraction.
 */
export function extractSubgraphFromNode<T>(
  structure: DAGStructure<T>,
  seedId: string
): DAGStructure<T> {
  const adj = buildAdjacency(structure);
  const nodeMap = new Map(structure.nodes.map((n) => [n.id, n]));
  const collected = new Set<string>();
  const stack = [seedId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (collected.has(id)) continue;
    collected.add(id);
    const node = nodeMap.get(id);
    if (!node) continue;
    const data = node.data as { op?: string };
    if (data?.op?.endsWith?.(':tail')) continue; // include tail but don't follow beyond
    for (const out of adj.outgoing.get(id) ?? []) {
      stack.push(out);
    }
  }
  const nodes = structure.nodes.filter((n) => collected.has(n.id));
  const edges = structure.edges.filter(
    (e) => collected.has(e.from) && collected.has(e.to)
  );
  return { nodes, edges };
}
