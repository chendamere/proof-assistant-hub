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

/** Find first node in arm by traversing backward from armLast (chain edges type 0). */
function findFirstInArm<T>(
  armLastId: string,
  incoming: Map<string, Array<{ from: string; et: number }>>,
  nodeMap: Map<string, { data?: { op?: string } }>
): string | null {
  const visited = new Set<string>();
  let current: string | null = armLastId;
  while (current) {
    if (visited.has(current)) return null;
    visited.add(current);
    const ins = incoming.get(current) ?? [];
    const chainIn = ins.find((x) => x.et === 0);
    const armIn = ins.find((x) => x.et === 1 || x.et === 2);
    if (armIn) return current;
    current = chainIn ? chainIn.from : null;
  }
  return armLastId;
}

/**
 * Add shortcut edges cond -> Tc when there is a path cond -> ... -> Tc in an arm.
 * Allows pattern \Tc to match target ", \Os j, \Tc c_1," (Tc after other ops in the arm).
 */
export function addTcShortcutEdges<T extends { op?: string }>(
  structure: DAGStructure<T>
): DAGStructure<T> {
  const nodeMap = new Map(structure.nodes.map((n) => [n.id, n]));
  const outgoing = new Map<string, Array<{ to: string; et: number }>>();
  for (const e of structure.edges) {
    if (!outgoing.has(e.from)) outgoing.set(e.from, []);
    outgoing.get(e.from)!.push({ to: e.to, et: (e.edgeType ?? 0) as number });
  }

  const shortcutEdges: Array<{ from: string; to: string; edgeType: number }> = [];
  const edgeSet = new Set(structure.edges.map((e) => `${e.from}\0${e.to}\0${e.edgeType ?? 0}`));

  // Add tail -> cond first so pattern \Tc maps to whole \Bb block (preferred over tail->Tc)
  const incoming = new Map<string, Array<{ from: string; et: number }>>();
  for (const e of structure.edges) {
    if (!incoming.has(e.to)) incoming.set(e.to, []);
    incoming.get(e.to)!.push({ from: e.from, et: (e.edgeType ?? 0) as number });
  }
  const tailToCond = new Map<string, string>();
  for (const n of structure.nodes) {
    const op = (n.data as { op?: string })?.op ?? '';
    if (!op.endsWith(':tail')) continue;
    const tailId = n.id;
    for (const { from: armLastId, et } of incoming.get(tailId) ?? []) {
      if (et !== 3 && et !== 4) continue;
      const firstInArm = findFirstInArm(armLastId, incoming, nodeMap);
      if (!firstInArm) continue;
      const condEdge = (incoming.get(firstInArm) ?? []).find((x) => x.et === 1 || x.et === 2);
      if (!condEdge) continue;
      const condId = condEdge.from;
      if (!tailToCond.has(tailId)) tailToCond.set(tailId, condId);
      break;
    }
  }
  for (const [tailId, condId] of tailToCond) {
    const key = `${tailId}\0${condId}\0${0}`;
    if (!edgeSet.has(key)) {
      shortcutEdges.push({ from: tailId, to: condId, edgeType: 0 });
      edgeSet.add(key);
    }
  }

  for (const e of structure.edges) {
    const fromOp = (nodeMap.get(e.from)?.data as { op?: string })?.op ?? '';
    const toOp = (nodeMap.get(e.to)?.data as { op?: string })?.op ?? '';
    const et = (e.edgeType ?? 0) as number;
    if (!fromOp.includes(':cond') || (et !== 1 && et !== 2)) continue;
    // Skip when arm starts with nested branch: inner cond will add its own shortcuts
    if (toOp.includes(':cond')) continue;

    const firstInArm = e.to;
    const tcInArm = new Set<string>();
    const visited = new Set<string>();
    const queue = [firstInArm];

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const op = (nodeMap.get(id)?.data as { op?: string })?.op ?? '';
      if (op.endsWith(':tail')) continue;
      if (op === '\\Tc') tcInArm.add(id);
      for (const { to } of outgoing.get(id) ?? []) {
        if (!visited.has(to)) queue.push(to);
      }
    }

    for (const tcId of tcInArm) {
      const key = `${e.from}\0${tcId}\0${et}`;
      if (!edgeSet.has(key)) {
        shortcutEdges.push({ from: e.from, to: tcId, edgeType: et });
        edgeSet.add(key);
      }
    }
  }

  // Add tail -> Tc when Tc -> tail (edges 3 or 4), so pattern \Brs{,}{,} ,\Tc c can match
  // target \Bb{...}{,\Tc c_1,}{,\Tc c_2,} (Tc in arm chains to tail)
  for (const e of structure.edges) {
    const toOp = (nodeMap.get(e.to)?.data as { op?: string })?.op ?? '';
    const fromOp = (nodeMap.get(e.from)?.data as { op?: string })?.op ?? '';
    const et = (e.edgeType ?? 0) as number;
    if (!toOp.endsWith(':tail') || (et !== 3 && et !== 4)) continue;
    if (fromOp !== '\\Tc') continue;
    const key = `${e.to}\0${e.from}\0${0}`;
    if (!edgeSet.has(key)) {
      shortcutEdges.push({ from: e.to, to: e.from, edgeType: 0 });
      edgeSet.add(key);
    }
  }

  if (shortcutEdges.length === 0) return structure;
  // Prepend so cond->Tc / tail->Tc are tried before other edges
  return {
    nodes: structure.nodes,
    edges: [...shortcutEdges, ...structure.edges],
  };
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
