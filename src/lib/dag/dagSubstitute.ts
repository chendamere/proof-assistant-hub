/**
 * DAG-based substitution: replace matched sub-DAG with replacement DAG,
 * connecting prefix DAG tails to replacement heads and replacement tails to suffix DAG heads.
 * Uses structural boundaries instead of character positions.
 */

import type { DAGStructure, DAGNode, DAGEdge, EdgeType, ExprNodeData } from './types';
import { buildAdjacency, reachableFrom } from './utils';

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
  const rAdj = buildAdjacency(replacementDAG);

  const tNodeMap = new Map(targetDAG.nodes.map((n) => [n.id, n]));
  const allTargetIds = new Set(targetDAG.nodes.map((n) => n.id));

  // Partition: prefix = nodes that can reach matched; suffix = nodes reachable from matched
  const prefixSet = reachableFrom(matchedIds, tAdj, 'incoming', matchedIds);
  const suffixSet = reachableFrom(matchedIds, tAdj, 'outgoing', matchedIds);

  // Sibling set: nodes neither in prefix, suffix, nor matched (e.g. top arm when match is in bottom arm)
  const siblingSet = new Set<string>();
  for (const id of allTargetIds) {
    if (!matchedIds.has(id) && !prefixSet.has(id) && !suffixSet.has(id)) siblingSet.add(id);
  }

  const replacementIdMap = new Map<string, string>();
  let nextId = 0;
  for (const rNode of replacementDAG.nodes) {
    const newId = `sub_${nextId++}`;
    replacementIdMap.set(rNode.id, newId);
  }

  // Replacement HEADS: nodes with no incoming edges from within replacement (entry points)
  const replacementHeads = new Set<string>();
  for (const n of replacementDAG.nodes) {
    const newId = replacementIdMap.get(n.id)!;
    const incomingFromRepl = (rAdj.incoming.get(n.id) ?? []).filter((id) =>
      replacementDAG.nodes.some((rn) => rn.id === id)
    );
    if (incomingFromRepl.length === 0) replacementHeads.add(newId);
  }

  // Replacement TAILS: nodes with no outgoing edges to within replacement (exit points)
  const replacementTails = new Set<string>();
  for (const n of replacementDAG.nodes) {
    const newId = replacementIdMap.get(n.id)!;
    const outgoingToRepl = (rAdj.outgoing.get(n.id) ?? []).filter((id) =>
      replacementDAG.nodes.some((rn) => rn.id === id)
    );
    if (outgoingToRepl.length === 0) replacementTails.add(newId);
  }

  // For branchKind: when pattern and replacement have same structure, copy from matched target
  const patternNodeToReplacementNode = new Map<string, string>();
  for (let i = 0; i < patternDAG.nodes.length && i < replacementDAG.nodes.length; i++) {
    patternNodeToReplacementNode.set(patternDAG.nodes[i].id, replacementDAG.nodes[i].id);
  }
  const replacementToTarget = new Map<string, string>();
  for (const [pId, tId] of mapping) {
    const rId = patternNodeToReplacementNode.get(pId);
    if (rId != null) {
      replacementToTarget.set(replacementIdMap.get(rId)!, tId);
    }
  }

  const applySubst = (rData: ExprNodeData, rNodeId: string, newReplId: string): ExprNodeData => {
    const operands = (rData.operands ?? []).map((o) => operandMapping.get(o) ?? o);
    const data: ExprNodeData = { ...rData, operands };
    const matchedTargetId = replacementToTarget.get(newReplId);
    if (matchedTargetId) {
      const tNode = tNodeMap.get(matchedTargetId);
      const tData = tNode?.data as (ExprNodeData & { branchKind?: 'Bb' | 'Blb' | 'Brb' | 'Brs' }) | undefined;
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

  // Add replacement nodes and edges
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
    if (from && to) mergedEdges.push({ from, to, edgeType: e.edgeType });
  }

  // Boundary: prefix->replacement heads first (in edge-type order) so :cond's children
  // are serialized top arm then bottom by dagToExpr
  addPrefixToReplacementEdges(
    targetDAG.edges,
    mergedEdges,
    prefixSet,
    matchedIds,
    replacementHeads
  );

  // Prefix edges (prefix->prefix, prefix->sibling)
  for (const e of targetDAG.edges) {
    if (prefixSet.has(e.from) && (prefixSet.has(e.to) || siblingSet.has(e.to))) mergedEdges.push(e);
  }

  // Add sibling nodes and edges (e.g. top arm when match is in bottom arm)
  for (const id of siblingSet) {
    const node = tNodeMap.get(id)!;
    mergedNodes.push({ id: node.id, data: node.data });
  }
  for (const e of targetDAG.edges) {
    if (siblingSet.has(e.from) && siblingSet.has(e.to)) mergedEdges.push(e);
  }

  // Add suffix nodes and edges
  for (const id of suffixSet) {
    const node = tNodeMap.get(id)!;
    mergedNodes.push({ id: node.id, data: node.data });
  }
  for (const e of targetDAG.edges) {
    if (suffixSet.has(e.from) && suffixSet.has(e.to)) mergedEdges.push(e);
  }

  // Boundary: replacement->suffix, prefix->suffix (empty arms), sibling->suffix
  addBoundaryEdges(
    targetDAG.edges,
    mergedEdges,
    prefixSet,
    suffixSet,
    siblingSet,
    matchedIds,
    replacementHeads,
    replacementTails
  );

  return { nodes: mergedNodes, edges: mergedEdges };
}

/** Edge type order for branch: top arm (0,1,3) before bottom arm (2,4) so dagToExpr serializes top then bottom. */
const TOP_ARM_TYPES = new Set([0, 1, 3]);
function edgeTypeOrder(et: number): number {
  return TOP_ARM_TYPES.has(et) ? 0 : 1;
}

/** Add prefix->replacement head edges in edge-type order so :cond children are top then bottom. */
function addPrefixToReplacementEdges(
  targetEdges: DAGEdge[],
  out: DAGEdge[],
  prefixSet: Set<string>,
  matchedIds: Set<string>,
  replacementHeads: Set<string>
): void {
  const prefixToMatched: Array<{ from: string; edgeType: number }> = [];
  for (const e of targetEdges) {
    if (prefixSet.has(e.from) && matchedIds.has(e.to)) {
      prefixToMatched.push({ from: e.from, edgeType: (e.edgeType ?? 0) as number });
    }
  }
  prefixToMatched.sort(
    (a, b) => edgeTypeOrder(a.edgeType) - edgeTypeOrder(b.edgeType) || a.edgeType - b.edgeType
  );
  const headIds = [...replacementHeads];
  for (const { from: prefixId, edgeType } of prefixToMatched) {
    for (const headId of headIds) {
      out.push({ from: prefixId, to: headId, edgeType: edgeType as EdgeType });
    }
  }
}

function addBoundaryEdges(
  targetEdges: DAGEdge[],
  out: DAGEdge[],
  prefixSet: Set<string>,
  suffixSet: Set<string>,
  siblingSet: Set<string>,
  matchedIds: Set<string>,
  _replacementHeads: Set<string>,
  replacementTails: Set<string>
): void {
  // prefix->replacement already added in addPrefixToReplacementEdges (in type order)

  const suffixReceivedFromMatched = new Set<string>();
  for (const e of targetEdges) {
    if (matchedIds.has(e.from) && suffixSet.has(e.to)) suffixReceivedFromMatched.add(e.to);
  }
  for (const tailId of replacementTails) {
    for (const suffixId of suffixReceivedFromMatched) {
      out.push({ from: tailId, to: suffixId, edgeType: (targetEdges.find((e) => matchedIds.has(e.from) && e.to === suffixId)?.edgeType ?? 0) as EdgeType });
    }
  }

  // prefix->suffix (empty arms) and sibling->suffix (sibling arms)
  // prefix->sibling is added with prefix edges to preserve arm order
  for (const e of targetEdges) {
    if (prefixSet.has(e.from) && suffixSet.has(e.to)) out.push({ from: e.from, to: e.to, edgeType: e.edgeType });
    if (siblingSet.has(e.from) && suffixSet.has(e.to)) out.push({ from: e.from, to: e.to, edgeType: e.edgeType });
  }
}
