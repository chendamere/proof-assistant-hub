/**
 * DAG-based substitution: replace matched sub-DAG with replacement DAG,
 * connecting prefix DAG tails to replacement heads and replacement tails to suffix DAG heads.
 * Uses structural boundaries instead of character positions.
 */

import type { DAGStructure, DAGNode, DAGEdge, ExprNodeData } from './types';

function buildAdjacency(structure: DAGStructure) {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of structure.nodes) {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  }
  for (const e of structure.edges) {
    outgoing.get(e.from)!.push(e.to);
    incoming.get(e.to)!.push(e.from);
  }
  return { outgoing, incoming };
}

/**
 * Substitute the matched sub-DAG in target with the replacement DAG.
 * Connects prefix DAG output to replacement DAG input, and replacement DAG output to suffix DAG input.
 *
 * @param targetDAG - Full target expression DAG
 * @param patternDAG - Rule side that matched (for structure correspondence)
 * @param replacementDAG - Rule's other side (what to substitute in)
 * @param mapping - VF2 mapping: patternNodeId -> targetNodeId
 * @param operandMapping - Maps rule operands to target operands
 */
export function substituteInDAG(
  targetDAG: DAGStructure<ExprNodeData>,
  patternDAG: DAGStructure<ExprNodeData>,
  replacementDAG: DAGStructure<ExprNodeData>,
  mapping: Map<string, string>,
  operandMapping: Map<string, string>
): DAGStructure<ExprNodeData> {
  const matchedIds = new Set(mapping.values());
  const tAdj = buildAdjacency(targetDAG);
  const pAdj = buildAdjacency(patternDAG);
  const rAdj = buildAdjacency(replacementDAG);

  const tNodeMap = new Map(targetDAG.nodes.map((n) => [n.id, n]));
  const pNodeMap = new Map(patternDAG.nodes.map((n) => [n.id, n]));
  const rNodeMap = new Map(replacementDAG.nodes.map((n) => [n.id, n]));

  // Partition target nodes: prefix (upstream of match), suffix (downstream of match)
  const prefixNodes = new Set<string>();
  const suffixNodes = new Set<string>();

  for (const n of targetDAG.nodes) {
    if (matchedIds.has(n.id)) continue;
    prefixNodes.add(n.id);
    suffixNodes.add(n.id);
  }

  // Prefix: nodes that have a path TO a matched node (walk backward from matched)
  const prefixCandidates = new Set<string>();
  let frontier = [...matchedIds];
  const visited = new Set<string>();
  while (frontier.length > 0) {
    const id = frontier.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const from of tAdj.incoming.get(id) ?? []) {
      if (!matchedIds.has(from)) {
        prefixCandidates.add(from);
        frontier.push(from);
      }
    }
  }
  // Prefix = nodes that can reach matched (transitive backward)
  const canReachMatched = new Set(prefixCandidates);
  frontier = [...prefixCandidates];
  visited.clear();
  while (frontier.length > 0) {
    const id = frontier.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    canReachMatched.add(id);
    for (const from of tAdj.incoming.get(id) ?? []) {
      if (!matchedIds.has(from)) frontier.push(from);
    }
  }
  // Suffix: nodes that matched has a path TO (walk forward from matched)
  const suffixCandidates = new Set<string>();
  frontier = [...matchedIds];
  visited.clear();
  while (frontier.length > 0) {
    const id = frontier.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const to of tAdj.outgoing.get(id) ?? []) {
      if (!matchedIds.has(to)) {
        suffixCandidates.add(to);
        frontier.push(to);
      }
    }
  }
  const canBeReachedFromMatched = new Set(suffixCandidates);
  frontier = [...suffixCandidates];
  visited.clear();
  while (frontier.length > 0) {
    const id = frontier.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    canBeReachedFromMatched.add(id);
    for (const to of tAdj.outgoing.get(id) ?? []) {
      if (!matchedIds.has(to)) frontier.push(to);
    }
  }

  const prefixSet = canReachMatched;
  const suffixSet = canBeReachedFromMatched;

  // Map pattern nodes to replacement nodes by index (assume same structure)
  const patternNodeToReplacementNode = new Map<string, string>();
  for (let i = 0; i < patternDAG.nodes.length && i < replacementDAG.nodes.length; i++) {
    patternNodeToReplacementNode.set(patternDAG.nodes[i].id, replacementDAG.nodes[i].id);
  }

  // Map target node -> replacement node (for matched nodes)
  const targetToReplacement = new Map<string, string>();
  const replacementIdMap = new Map<string, string>();
  let nextId = 0;
  for (const rNode of replacementDAG.nodes) {
    const newId = `sub_${nextId++}`;
    replacementIdMap.set(rNode.id, newId);
  }
  for (const [pId, tId] of mapping) {
    const rId = patternNodeToReplacementNode.get(pId);
    if (rId != null) {
      targetToReplacement.set(tId, replacementIdMap.get(rId)!);
    }
  }

  // Map replacement node id -> matched target node id (reverse of targetToReplacement)
  const replacementToTarget = new Map<string, string>();
  for (const [tId, replId] of targetToReplacement) {
    replacementToTarget.set(replId, tId);
  }

  // Apply operand substitution to node data; use target's branchKind for tail when substituting Brb in Bb
  const applySubst = (rData: ExprNodeData, rNodeId: string, newReplId: string): ExprNodeData => {
    const operands = (rData.operands ?? []).map((o) => operandMapping.get(o) ?? o);
    const data: ExprNodeData = { ...rData, operands };
    const matchedTargetId = replacementToTarget.get(newReplId);
    if (matchedTargetId) {
      const tNode = tNodeMap.get(matchedTargetId);
      const tData = tNode?.data as (ExprNodeData & { branchKind?: 'Bb' | 'Blb' | 'Brb' }) | undefined;
      if (tData?.branchKind && (rData.op.endsWith(':tail') || rData.op.includes(':cond'))) {
        data.branchKind = tData.branchKind;
      }
    }
    return data;
  };

  const mergedNodes: DAGNode<ExprNodeData>[] = [];
  const mergedEdges: DAGEdge[] = [];

  // Add prefix nodes
  for (const id of prefixSet) {
    const node = tNodeMap.get(id)!;
    mergedNodes.push({ id: node.id, data: node.data });
  }
  for (const e of targetDAG.edges) {
    if (prefixSet.has(e.from) && prefixSet.has(e.to)) {
      mergedEdges.push(e);
    }
  }

  // Add replacement nodes with new IDs and operand mapping
  for (const rNode of replacementDAG.nodes) {
    const newId = replacementIdMap.get(rNode.id)!;
    mergedNodes.push({
      id: newId,
      data: applySubst(rNode.data as ExprNodeData, rNode.id, newId),
    });
  }
  for (const e of replacementDAG.edges) {
    const from = replacementIdMap.get(e.from);
    const to = replacementIdMap.get(e.to);
    if (from && to) mergedEdges.push({ from, to });
  }

  // Add suffix nodes
  for (const id of suffixSet) {
    const node = tNodeMap.get(id)!;
    mergedNodes.push({ id: node.id, data: node.data });
  }
  for (const e of targetDAG.edges) {
    if (suffixSet.has(e.from) && suffixSet.has(e.to)) {
      mergedEdges.push(e);
    }
  }

  // Boundary edges: prefix -> replacement (prefix had edge to matched; redirect to replacement)
  for (const e of targetDAG.edges) {
    if (prefixSet.has(e.from) && matchedIds.has(e.to)) {
      const replId = targetToReplacement.get(e.to);
      if (replId) {
        mergedEdges.push({ from: e.from, to: replId });
      }
    }
  }

  // Boundary edges: replacement -> suffix (matched had edge to suffix; replacement feeds suffix)
  for (const e of targetDAG.edges) {
    if (matchedIds.has(e.from) && suffixSet.has(e.to)) {
      const replId = targetToReplacement.get(e.from);
      if (replId) {
        mergedEdges.push({ from: replId, to: e.to });
      }
    }
  }

  // Boundary edges: prefix -> suffix (e.g. empty branch arm: cond directly to tail)
  for (const e of targetDAG.edges) {
    if (prefixSet.has(e.from) && suffixSet.has(e.to)) {
      mergedEdges.push({ from: e.from, to: e.to });
    }
  }

  return { nodes: mergedNodes, edges: mergedEdges };
}
