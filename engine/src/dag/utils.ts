/**
 * Shared DAG graph utilities
 */

import type { DAGStructure, DAGEdge, ExprNodeData } from './types';

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

/** Normalize branch op for multiset key (must match vf2Expr key). \Blb and \Bls treated as equivalent.
 * \Oe and \Pe in :cond are treated as equivalent for multiset containment. */
function normalizeBranchOpForMultiset(op: string): string {
  if (/^:cond(:|$)|^:tail$/.test(op)) {
    return op.replace(/:cond:\\Pe\b/, ':cond:\\Oe');
  }
  const m = op.match(/^\\B[lr]?[bs](:cond(?::\S+)?|:tail)$/);
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
 * \Bb, \Blb, \Brb, \Brs nodes are also structural (branch operators) and should not be counted as operations.
 */
export function countOperations<T extends { op?: string }>(structure: DAGStructure<T>): number {
  let count = 0;
  for (const n of structure.nodes) {
    const op = (n.data as { op?: string })?.op ?? '';
    if (op.endsWith(':tail')) continue; // tail is structural, not an operation
    if (op === '\\Bb' || op === '\\Blb' || op === '\\Brb' || op === '\\Brs') continue; // branch operators are structural, not operations
    count++;
  }
  return count;
}

/**
 * Extract subgraph from seedId following outgoing edges, but do NOT include tail nodes.
 * Used when enumerating Tc candidates so we get arm content only (tail is the merge point).
 */
export function extractSubgraphFromNodeExcludingTail<T extends { op?: string }>(
  structure: DAGStructure<T>,
  seedId: string
): DAGStructure<T> {
  const adj = buildAdjacency(structure);
  const nodeMap = new Map(structure.nodes.map((n) => [n.id, n]));
  const tailIds = new Set(
    structure.nodes.filter((n) => (n.data as { op?: string })?.op?.endsWith?.(':tail')).map((n) => n.id)
  );
  const collected = new Set<string>();
  const stack = [seedId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (collected.has(id) || tailIds.has(id)) continue;
    collected.add(id);
    for (const out of adj.outgoing.get(id) ?? []) {
      if (!tailIds.has(out)) stack.push(out);
    }
  }
  const nodes = structure.nodes.filter((n) => collected.has(n.id));
  const edges = structure.edges.filter(
    (e) => collected.has(e.from) && collected.has(e.to)
  );
  return { nodes, edges };
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

/**
 * Extract subgraph of seedId and all nodes that can reach it by following incoming edges.
 * Excludes any node in excludeIds (e.g. tail and cond) so the result is arm content only.
 * Used for \Tc partial-factor to get the full arm expression (e.g. ", m \\Os," not just the last node).
 */
export function extractSubgraphIncomingFromNode<T>(
  structure: DAGStructure<T>,
  seedId: string,
  excludeIds: Set<string> = new Set()
): DAGStructure<T> {
  const adj = buildAdjacency(structure);
  const collected = new Set<string>();
  const stack = [seedId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (collected.has(id) || excludeIds.has(id)) continue;
    collected.add(id);
    for (const from of adj.incoming.get(id) ?? []) {
      stack.push(from);
    }
  }
  const nodes = structure.nodes.filter((n) => collected.has(n.id));
  const edges = structure.edges.filter(
    (e) => collected.has(e.from) && collected.has(e.to)
  );
  return { nodes, edges };
}

/**
 * Trim edges of unmatched target nodes: keep only edges where both endpoints
 * are unmatched (not in matchedIds). Removes boundary edges (matched↔unmatched).
 */
export function trimEdges<T>(
  structure: DAGStructure<T>,
  matchedIds: Set<string>
): DAGEdge[] {
  return structure.edges.filter(
    (e) => !matchedIds.has(e.from) && !matchedIds.has(e.to)
  );
}
