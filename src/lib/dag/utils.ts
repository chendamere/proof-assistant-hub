/**
 * Shared DAG graph utilities
 */

import type { DAGStructure } from './types';

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
