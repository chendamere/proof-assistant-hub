/**
 * Shared DAG graph utilities
 */

import type { DAGStructure, ExprNodeData } from './types';

export type Adjacency = {
  outgoing: Map<string, string[]>;
  incoming: Map<string, string[]>;
};

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
  const toAdd: { emptyId: string; from: string; to: string }[] = [];
  for (const e of edges) {
    const fromNode = nodeMap.get(e.from);
    const toNode = nodeMap.get(e.to);
    const fromOp = (fromNode?.data as { op?: string })?.op ?? '';
    const toOp = (toNode?.data as { op?: string })?.op ?? '';
    if (fromOp.includes(':cond') && toOp.endsWith(':tail')) {
      toAdd.push({ emptyId: `empty_${nextEmptyId++}`, from: e.from, to: e.to });
    }
  }
  if (toAdd.length === 0) return structure;
  const newEdges = edges.filter((e) => !toAdd.some((a) => a.from === e.from && a.to === e.to));
  for (const { emptyId, from, to } of toAdd) {
    nodes.push({
      id: emptyId,
      data: { op: '\\Tc', operands: [''] } as T,
    } as any);
    newEdges.push({ from, to: emptyId }, { from: emptyId, to });
  }
  return { nodes, edges: newEdges };
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
