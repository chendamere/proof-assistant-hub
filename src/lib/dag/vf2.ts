/**
 * VF2 algorithm for subgraph isomorphism.
 * Determines if the pattern graph is isomorphic to a subgraph of the target graph.
 * Adapted from UL_DAG with extensions for expression DAGs (variable operand binding).
 */

import type { DAGStructure } from './types';

function dataMatches(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function buildAdjacency(structure: DAGStructure): {
  outgoing: Map<string, Set<string>>;
  incoming: Map<string, Set<string>>;
} {
  const nodeIds = new Set(structure.nodes.map((n) => n.id));
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();

  for (const n of structure.nodes) {
    outgoing.set(n.id, new Set());
    incoming.set(n.id, new Set());
  }
  for (const e of structure.edges) {
    if (nodeIds.has(e.from) && nodeIds.has(e.to)) {
      outgoing.get(e.from)!.add(e.to);
      incoming.get(e.to)!.add(e.from);
    }
  }
  return { outgoing, incoming };
}

/**
 * Check if the pattern graph is isomorphic to a subgraph of the target graph.
 * Returns a mapping from pattern node IDs to target node IDs if found, null otherwise.
 *
 * @param pattern - The smaller graph (candidate subgraph)
 * @param target - The larger graph (the graph to search within)
 * @returns Mapping patternId -> targetId if pattern is subgraph of target, null otherwise
 */
export function vf2SubgraphIsomorphism(
  pattern: DAGStructure,
  target: DAGStructure
): Map<string, string> | null {
  const pNodes = pattern.nodes.map((n) => n.id);
  const tNodes = target.nodes.map((n) => n.id);

  if (pNodes.length === 0) return new Map();
  if (pNodes.length > tNodes.length) return null;

  const pAdj = buildAdjacency(pattern);
  const tAdj = buildAdjacency(target);

  const pNodeMap = new Map(pattern.nodes.map((n) => [n.id, n]));
  const tNodeMap = new Map(target.nodes.map((n) => [n.id, n]));

  const mapping = new Map<string, string>();
  const reverseMapping = new Map<string, string>();

  function feasible(p: string, t: string): boolean {
    // Data of mapped vertices must match
    const pNode = pNodeMap.get(p)!;
    const tNode = tNodeMap.get(t)!;
    if (!dataMatches(pNode.data, tNode.data)) return false;

    // Degree consistency: first/root nodes need same out-degree; last/leaf nodes need same in-degree; others need both
    const pOut = pAdj.outgoing.get(p)?.size ?? 0;
    const pIn = pAdj.incoming.get(p)?.size ?? 0;
    const tOut = tAdj.outgoing.get(t)?.size ?? 0;
    const tIn = tAdj.incoming.get(t)?.size ?? 0;
    const isRoot = pIn === 0;
    const isLeaf = pOut === 0;
    if (isRoot && pOut !== tOut) return false;
    if (isLeaf && pIn !== tIn) return false;
    if (!isRoot && !isLeaf && (pOut !== tOut || pIn !== tIn)) return false;

    // For every outgoing edge (p -> p2) in pattern: if p2 is mapped, (t -> M(p2)) must be in target
    for (const p2 of pAdj.outgoing.get(p) ?? []) {
      if (mapping.has(p2)) {
        const t2 = mapping.get(p2)!;
        if (!tAdj.outgoing.get(t)?.has(t2)) return false;
      }
    }
    // For every incoming edge (p1 -> p) in pattern: if p1 is mapped, (M(p1) -> t) must be in target
    for (const p1 of pAdj.incoming.get(p) ?? []) {
      if (mapping.has(p1)) {
        const t1 = mapping.get(p1)!;
        if (!tAdj.incoming.get(t)?.has(t1)) return false;
      }
    }
    return true;
  }

  function search(): boolean {
    if (mapping.size === pNodes.length) return true;

    const p = pNodes.find((id) => !mapping.has(id))!;
    const usedTargets = new Set(mapping.values());

    for (const t of tNodes) {
      if (usedTargets.has(t)) continue;
      if (!feasible(p, t)) continue;

      mapping.set(p, t);
      reverseMapping.set(t, p);
      if (search()) return true;
      mapping.delete(p);
      reverseMapping.delete(t);
    }
    return false;
  }

  return search() ? new Map(mapping) : null;
}

/**
 * Check if pattern is a subgraph of target (convenience wrapper).
 */
export function isSubgraphIsomorphic(pattern: DAGStructure, target: DAGStructure): boolean {
  return vf2SubgraphIsomorphism(pattern, target) !== null;
}
