/**
 * DAG-based substitution: replace matched sub-DAG with replacement DAG,
 * connecting prefix DAG tails to replacement heads and replacement tails to suffix DAG heads.
 * Uses structural boundaries instead of character positions.
 */

import type { DAGStructure, DAGNode, DAGEdge, EdgeType, ExprNodeData } from './types';
import { buildAdjacency, reachableFrom } from './utils';

/** Assign new ids to a DAG and return the new structure plus id maps. */
function cloneDAGWithNewIds(
  dag: DAGStructure<ExprNodeData>,
  idPrefix: string,
  startId: number
): { dag: DAGStructure<ExprNodeData>; idMap: Map<string, string>; nextId: number } {
  const idMap = new Map<string, string>();
  let nextId = startId;
  for (const n of dag.nodes) {
    const newId = `${idPrefix}_${nextId++}`;
    idMap.set(n.id, newId);
  }
  const nodes: DAGNode<ExprNodeData>[] = dag.nodes.map((n) => ({
    id: idMap.get(n.id)!,
    data: n.data,
  }));
  const edges: DAGEdge[] = dag.edges.map((e) => ({
    from: idMap.get(e.from)!,
    to: idMap.get(e.to)!,
    edgeType: e.edgeType,
  }));
  return { dag: { nodes, edges }, idMap, nextId };
}

/** Get head node ids (no incoming from within the same DAG). */
function getHeads(dag: DAGStructure<ExprNodeData>): Set<string> {
  const nodeIds = new Set(dag.nodes.map((n) => n.id));
  const hasIncoming = new Set<string>();
  for (const e of dag.edges) {
    if (nodeIds.has(e.to)) hasIncoming.add(e.to);
  }
  const heads = new Set<string>();
  for (const id of nodeIds) {
    if (!hasIncoming.has(id)) heads.add(id);
  }
  return heads;
}

/** Get tail node ids (no outgoing to within the same DAG). */
function getTails(dag: DAGStructure<ExprNodeData>): Set<string> {
  const nodeIds = new Set(dag.nodes.map((n) => n.id));
  const hasOutgoing = new Set<string>();
  for (const e of dag.edges) {
    if (nodeIds.has(e.from)) hasOutgoing.add(e.from);
  }
  const tails = new Set<string>();
  for (const id of nodeIds) {
    if (!hasOutgoing.has(id)) tails.add(id);
  }
  return tails;
}

/** Branch structure: cond, tail, arm heads (type 1/2 from cond), arm node sets. */
function getTargetBranchStructure(
  targetDAG: DAGStructure<ExprNodeData>,
  matchedIds: Set<string>,
  tAdj: ReturnType<typeof buildAdjacency>
): {
  condId: string | null;
  tailId: string | null;
  arm1HeadId: string | null;
  arm2HeadId: string | null;
  arm1NodeIds: Set<string>;
  arm2NodeIds: Set<string>;
} {
  const condId = targetDAG.nodes.find((n) => matchedIds.has(n.id) && ((n.data as ExprNodeData)?.op ?? '').includes(':cond'))?.id ?? null;
  if (!condId) {
    return { condId: null, tailId: null, arm1HeadId: null, arm2HeadId: null, arm1NodeIds: new Set(), arm2NodeIds: new Set() };
  }
  // When there are nested branches, pick the outer tail: :tail with incoming type 3 and 4 that is not the "from" of type 3/4 (sink).
  const tailCandidates = targetDAG.nodes.filter(
    (n) => matchedIds.has(n.id) && ((n.data as ExprNodeData)?.op ?? '').endsWith(':tail')
  );
  const fromOfType3Or4 = new Set(targetDAG.edges.filter((e) => (e.edgeType ?? 0) === 3 || (e.edgeType ?? 0) === 4).map((e) => e.from));
  const tailId =
    tailCandidates.find(
      (n) =>
        targetDAG.edges.some((e) => e.to === n.id && (e.edgeType ?? 0) === 3) &&
        targetDAG.edges.some((e) => e.to === n.id && (e.edgeType ?? 0) === 4) &&
        !fromOfType3Or4.has(n.id)
    )?.id ?? null;
  if (!tailId) {
    return { condId, tailId, arm1HeadId: null, arm2HeadId: null, arm1NodeIds: new Set(), arm2NodeIds: new Set() };
  }
  const incomingToTail = targetDAG.edges.filter((e) => e.to === tailId);
  let arm1LastId: string | null = null;
  let arm2LastId: string | null = null;
  for (const e of incomingToTail) {
    const et = (e.edgeType ?? 0) as number;
    if (et === 3 && matchedIds.has(e.from)) arm1LastId = e.from;
    if (et === 4 && matchedIds.has(e.from)) arm2LastId = e.from;
  }
  const exclude = new Set<string>([tailId, condId]);
  const arm1NodeIds = arm1LastId ? new Set([arm1LastId, ...reachableFrom([arm1LastId], tAdj, 'incoming', exclude)].filter((id) => matchedIds.has(id))) : new Set<string>();
  const arm2NodeIds = arm2LastId ? new Set([arm2LastId, ...reachableFrom([arm2LastId], tAdj, 'incoming', exclude)].filter((id) => matchedIds.has(id))) : new Set<string>();
  const arm1HeadId = arm1NodeIds.size > 0 ? (targetDAG.edges.find((e) => e.from === condId && (e.edgeType ?? 0) === 1 && arm1NodeIds.has(e.to))?.to ?? null) : null;
  const arm2HeadId = arm2NodeIds.size > 0 ? (targetDAG.edges.find((e) => e.from === condId && (e.edgeType ?? 0) === 2 && arm2NodeIds.has(e.to))?.to ?? null) : null;
  return { condId, tailId, arm1HeadId, arm2HeadId, arm1NodeIds, arm2NodeIds };
}

/** Replacement branch structure: cond, tail (null for Blb), arm node sets, and prefix nodes (nodes before the branch). */
function getReplacementBranchStructure(
  replacementDAG: DAGStructure<ExprNodeData>,
  rAdj: ReturnType<typeof buildAdjacency>
): {
  condId: string | null;
  tailId: string | null;
  arm1HeadId: string | null;
  arm2HeadId: string | null;
  arm1NodeIds: Set<string>;
  arm2NodeIds: Set<string>;
  prefixNodeIds: Set<string>;
} {
  const condId = replacementDAG.nodes.find((n) => ((n.data as ExprNodeData)?.op ?? '').includes(':cond'))?.id ?? null;
  const tailId = replacementDAG.nodes.find((n) => ((n.data as ExprNodeData)?.op ?? '').endsWith(':tail'))?.id ?? null;
  if (!condId) {
    return {
      condId,
      tailId,
      arm1HeadId: null,
      arm2HeadId: null,
      arm1NodeIds: new Set(),
      arm2NodeIds: new Set(),
      prefixNodeIds: new Set(),
    };
  }
  const branchSet = new Set([
    condId,
    ...(tailId ? [tailId] : []),
    ...reachableFrom([condId], rAdj, 'outgoing', new Set<string>()),
  ]);
  const incomingToCond = reachableFrom([condId], rAdj, 'incoming', new Set<string>());
  const prefixNodeIds = new Set([...incomingToCond].filter((id) => id !== condId && !branchSet.has(id)));
  const arm1HeadId = replacementDAG.edges.find((e) => e.from === condId && (e.edgeType ?? 0) === 1)?.to ?? null;
  const arm2HeadId = replacementDAG.edges.find((e) => e.from === condId && (e.edgeType ?? 0) === 2)?.to ?? null;
  const excludeTail = tailId ? new Set([tailId]) : new Set<string>();
  const arm1NodeIds = arm1HeadId ? new Set([arm1HeadId, ...reachableFrom([arm1HeadId], rAdj, 'outgoing', excludeTail)].filter((id) => id !== tailId)) : new Set<string>();
  const arm2NodeIds = arm2HeadId ? new Set([arm2HeadId, ...reachableFrom([arm2HeadId], rAdj, 'outgoing', excludeTail)].filter((id) => id !== tailId)) : new Set<string>();
  return { condId, tailId, arm1HeadId, arm2HeadId, arm1NodeIds, arm2NodeIds, prefixNodeIds };
}

/**
 * Substitute when pattern matched only a branch cond and replacement is a full branch:
 * prepend replacement's arm content to each target arm (preserve target arm content).
 * Result: prefix_target, replacement_prefix (e.g. \Ot j), replacement_cond, (repl_arm1 → target_arm1 → tail), (repl_arm2 → target_arm2 → tail), suffix_target.
 */
function substituteInDAGPrefixArms(
  targetDAG: DAGStructure<ExprNodeData>,
  replacementDAG: DAGStructure<ExprNodeData>,
  mapping: Map<string, string>,
  operandMapping: Map<string, string>,
  prefixSet: Set<string>,
  suffixSet: Set<string>,
  matchedIds: Set<string>
): DAGStructure<ExprNodeData> {
  const tAdj = buildAdjacency(targetDAG);
  const rAdj = buildAdjacency(replacementDAG);
  const tNodeMap = new Map(targetDAG.nodes.map((n) => [n.id, n]));
  const rNodeMap = new Map(replacementDAG.nodes.map((n) => [n.id, n]));

  const tBranch = getTargetBranchStructure(targetDAG, matchedIds, tAdj);
  const rBranch = getReplacementBranchStructure(replacementDAG, rAdj);
  if (!tBranch.condId || !tBranch.tailId || !rBranch.condId) {
    return substituteInDAG(targetDAG, { nodes: [], edges: [] } as DAGStructure<ExprNodeData>, replacementDAG, mapping, operandMapping);
  }
  const useTargetTail = rBranch.tailId == null;

  const applySubst = (data: ExprNodeData): ExprNodeData => ({
    ...data,
    operands: (data.operands ?? []).map((o) => operandMapping.get(o) ?? o),
  });

  let nextId = 0;
  const replIdMap = new Map<string, string>();
  for (const n of replacementDAG.nodes) {
    replIdMap.set(n.id, `pa_${nextId++}`);
  }

  const mergedNodes: DAGNode<ExprNodeData>[] = [];
  const mergedEdges: DAGEdge[] = [];

  for (const id of prefixSet) {
    const node = tNodeMap.get(id)!;
    mergedNodes.push({ id: node.id, data: node.data });
  }
  const redirectSourceId = targetDAG.edges.find((e) => prefixSet.has(e.from) && e.to === tBranch.condId)?.from ?? null;
  for (const e of targetDAG.edges) {
    if (prefixSet.has(e.from) && prefixSet.has(e.to) && e.from !== redirectSourceId) mergedEdges.push(e);
  }

  const replPrefixNodes = [...rBranch.prefixNodeIds];
  for (const id of replPrefixNodes) {
    const node = rNodeMap.get(id)!;
    mergedNodes.push({ id: replIdMap.get(id)!, data: applySubst(node.data as ExprNodeData) });
  }
  for (const e of replacementDAG.edges) {
    if (rBranch.prefixNodeIds.has(e.from) && rBranch.prefixNodeIds.has(e.to)) {
      mergedEdges.push({
        from: replIdMap.get(e.from)!,
        to: replIdMap.get(e.to)!,
        edgeType: e.edgeType,
      });
    }
  }

  const replCondId = replIdMap.get(rBranch.condId)!;
  mergedNodes.push({ id: replCondId, data: applySubst(rNodeMap.get(rBranch.condId)!.data as ExprNodeData) });
  if (!useTargetTail && rBranch.tailId) {
    const replTailId = replIdMap.get(rBranch.tailId)!;
    mergedNodes.push({ id: replTailId, data: (rNodeMap.get(rBranch.tailId)!.data as ExprNodeData) });
  }
  const mergeTailId = useTargetTail ? tBranch.tailId : replIdMap.get(rBranch.tailId)!;

  for (const id of rBranch.arm1NodeIds) {
    const node = rNodeMap.get(id)!;
    mergedNodes.push({ id: replIdMap.get(id)!, data: applySubst(node.data as ExprNodeData) });
  }
  for (const id of rBranch.arm2NodeIds) {
    const node = rNodeMap.get(id)!;
    mergedNodes.push({ id: replIdMap.get(id)!, data: applySubst(node.data as ExprNodeData) });
  }
  for (const id of tBranch.arm1NodeIds) {
    const node = tNodeMap.get(id)!;
    mergedNodes.push({ id: node.id, data: node.data });
  }
  for (const id of tBranch.arm2NodeIds) {
    const node = tNodeMap.get(id)!;
    mergedNodes.push({ id: node.id, data: node.data });
  }
  for (const id of suffixSet) {
    const node = tNodeMap.get(id)!;
    mergedNodes.push({ id: node.id, data: node.data });
  }
  if (useTargetTail && tBranch.tailId && !suffixSet.has(tBranch.tailId)) {
    const tailNode = tNodeMap.get(tBranch.tailId)!;
    mergedNodes.push({ id: tailNode.id, data: tailNode.data });
  }

  const replNodeIds = new Set<string>([
    ...rBranch.prefixNodeIds,
    rBranch.condId,
    ...(rBranch.tailId ? [rBranch.tailId] : []),
    ...rBranch.arm1NodeIds,
    ...rBranch.arm2NodeIds,
  ]);
  for (const e of replacementDAG.edges) {
    if (!replNodeIds.has(e.from) || !replNodeIds.has(e.to)) continue;
    const from = replIdMap.get(e.from);
    const to = replIdMap.get(e.to);
    if (from && to) mergedEdges.push({ from, to, edgeType: e.edgeType });
  }
  for (const e of targetDAG.edges) {
    if (tBranch.arm1NodeIds.has(e.from) && tBranch.arm1NodeIds.has(e.to)) mergedEdges.push(e);
    if (tBranch.arm2NodeIds.has(e.from) && tBranch.arm2NodeIds.has(e.to)) mergedEdges.push(e);
    if (suffixSet.has(e.from) && suffixSet.has(e.to)) mergedEdges.push(e);
  }

  const replArm1Heads = rBranch.arm1HeadId ? [replIdMap.get(rBranch.arm1HeadId)!] : [];
  const replArm2Heads = rBranch.arm2HeadId ? [replIdMap.get(rBranch.arm2HeadId)!] : [];
  const replArm1Tails = getTails({ nodes: replacementDAG.nodes.filter((n) => rBranch.arm1NodeIds.has(n.id)), edges: replacementDAG.edges.filter((e) => rBranch.arm1NodeIds.has(e.from) && rBranch.arm1NodeIds.has(e.to)) });
  const replArm2Tails = getTails({ nodes: replacementDAG.nodes.filter((n) => rBranch.arm2NodeIds.has(n.id)), edges: replacementDAG.edges.filter((e) => rBranch.arm2NodeIds.has(e.from) && rBranch.arm2NodeIds.has(e.to)) });
  const replArm1TailId = replArm1Tails.size > 0 ? replIdMap.get([...rBranch.arm1NodeIds].find((id) => replArm1Tails.has(id))!)! : null;
  const replArm2TailId = replArm2Tails.size > 0 ? replIdMap.get([...rBranch.arm2NodeIds].find((id) => replArm2Tails.has(id))!)! : null;

  const prefixToRepl = targetDAG.edges.filter((e) => prefixSet.has(e.from) && matchedIds.has(e.to));
  const prefixToCond = prefixToRepl.find((e) => e.to === tBranch.condId);
  if (prefixToCond) {
    if (replPrefixNodes.length > 0) {
      const firstReplPrefix = replPrefixNodes[0]!;
      const lastReplPrefix = replPrefixNodes[replPrefixNodes.length - 1]!;
      const outs = replacementDAG.edges.filter((e) => e.from === lastReplPrefix).map((e) => e.to);
      if (outs.includes(rBranch.condId)) {
        mergedEdges.push({ from: prefixToCond.from, to: replIdMap.get(firstReplPrefix)!, edgeType: (prefixToCond.edgeType ?? 0) as EdgeType });
      } else {
        mergedEdges.push({ from: prefixToCond.from, to: replCondId, edgeType: (prefixToCond.edgeType ?? 0) as EdgeType });
      }
    } else {
      mergedEdges.push({ from: prefixToCond.from, to: replCondId, edgeType: (prefixToCond.edgeType ?? 0) as EdgeType });
    }
  }
  // lastReplPrefix -> replCond is already in replacement internal edges; avoid duplicate

  if (replArm1Heads.length > 0) mergedEdges.push({ from: replCondId, to: replArm1Heads[0]!, edgeType: 1 as EdgeType });
  if (replArm2Heads.length > 0) mergedEdges.push({ from: replCondId, to: replArm2Heads[0]!, edgeType: 2 as EdgeType });
  const arm1HeadIsTail = tBranch.arm1HeadId === tBranch.tailId;
  const arm2HeadIsTail = tBranch.arm2HeadId === tBranch.tailId;
  if (replArm1TailId) {
    if (tBranch.arm1HeadId && !arm1HeadIsTail) mergedEdges.push({ from: replArm1TailId, to: tBranch.arm1HeadId, edgeType: 0 as EdgeType });
    else mergedEdges.push({ from: replArm1TailId, to: mergeTailId, edgeType: 3 as EdgeType });
  }
  if (tBranch.arm1NodeIds.size > 0) {
    const arm1Last = [...tBranch.arm1NodeIds].find((id) => targetDAG.edges.some((e) => e.from === id && e.to === tBranch.tailId && (e.edgeType ?? 0) === 3));
    if (arm1Last) mergedEdges.push({ from: arm1Last, to: mergeTailId, edgeType: 3 as EdgeType });
  }
  if (replArm2TailId) {
    if (tBranch.arm2HeadId && !arm2HeadIsTail) mergedEdges.push({ from: replArm2TailId, to: tBranch.arm2HeadId, edgeType: 0 as EdgeType });
    else mergedEdges.push({ from: replArm2TailId, to: mergeTailId, edgeType: 4 as EdgeType });
  }
  if (tBranch.arm2NodeIds.size > 0) {
    const arm2Last = [...tBranch.arm2NodeIds].find((id) => targetDAG.edges.some((e) => e.from === id && e.to === tBranch.tailId && (e.edgeType ?? 0) === 4));
    if (arm2Last) mergedEdges.push({ from: arm2Last, to: mergeTailId, edgeType: 4 as EdgeType });
  }
  for (const e of targetDAG.edges) {
    if (e.from === tBranch.tailId && suffixSet.has(e.to)) mergedEdges.push({ from: mergeTailId, to: e.to, edgeType: e.edgeType });
  }

  return { nodes: mergedNodes, edges: mergedEdges };
}

/**
 * Partition the target DAG into prefix and suffix DAGs given the matched subgraph.
 * When the match is inside a branch arm, the opposite branch arm is included in the prefix,
 * and the suffix is the continuation of the matched arm only (suffix-side branch arm is empty).
 *
 * @param dag - Full target expression DAG
 * @param matchedIds - Set of node IDs that form the matched subgraph
 * @returns prefixDAG (nodes that can reach matched + opposite branch arm), suffixDAG (nodes reachable from matched; when in a branch, only the matched arm's continuation, so the other arm in suffix is empty)
 */
export function getPrefixAndSuffixDAG(
  dag: DAGStructure<ExprNodeData>,
  matchedIds: Set<string>
): { prefixDAG: DAGStructure<ExprNodeData>; suffixDAG: DAGStructure<ExprNodeData> } {
  const tAdj = buildAdjacency(dag);
  const allTargetIds = new Set(dag.nodes.map((n) => n.id));
  const tNodeMap = new Map(dag.nodes.map((n) => [n.id, n]));

  // Partition: prefix = nodes that can reach matched; suffix = nodes reachable from matched
  const prefixSet = reachableFrom(matchedIds, tAdj, 'incoming', matchedIds);
  const suffixSet = reachableFrom(matchedIds, tAdj, 'outgoing', matchedIds);

  // Sibling set: nodes in neither prefix, suffix, nor matched (e.g. opposite branch arm when match is in one arm)
  const siblingSet = new Set<string>();
  for (const id of allTargetIds) {
    if (!matchedIds.has(id) && !prefixSet.has(id) && !suffixSet.has(id)) siblingSet.add(id);
  }

  // When match is in a branch: opposite arm is in sibling. Include it in prefix.
  const prefixNodeIds = new Set<string>([...prefixSet, ...siblingSet]);
  const suffixNodeIds = new Set(suffixSet);

  const prefixNodes: DAGNode<ExprNodeData>[] = [];
  const prefixEdges: DAGEdge[] = [];
  for (const id of prefixNodeIds) {
    const node = tNodeMap.get(id);
    if (node) prefixNodes.push({ id: node.id, data: node.data as ExprNodeData });
  }
  for (const e of dag.edges) {
    if (prefixNodeIds.has(e.from) && prefixNodeIds.has(e.to)) {
      prefixEdges.push({ from: e.from, to: e.to, edgeType: e.edgeType });
    }
  }

  const suffixNodes: DAGNode<ExprNodeData>[] = [];
  const suffixEdges: DAGEdge[] = [];
  for (const id of suffixNodeIds) {
    const node = tNodeMap.get(id);
    if (node) suffixNodes.push({ id: node.id, data: node.data as ExprNodeData });
  }
  // Suffix DAG: only edges between suffix nodes (suffix-side branch arm is empty: we do not include edges from prefix/sibling into suffix)
  for (const e of dag.edges) {
    if (suffixNodeIds.has(e.from) && suffixNodeIds.has(e.to)) {
      suffixEdges.push({ from: e.from, to: e.to, edgeType: e.edgeType });
    }
  }

  return {
    prefixDAG: { nodes: prefixNodes, edges: prefixEdges },
    suffixDAG: { nodes: suffixNodes, edges: suffixEdges },
  };
}

/**
 * Merge for partial-factor case: build result from target DAG by replacing the two branch arm
 * contents with trimmed arm DAGs and inserting the common-suffix DAG after the branch tail.
 * Used when the rule pattern is ", \Brs{,\Tc c,}{,\Tc c,}" and we factor out \Tc c.
 *
 * @param targetDAG - Full target expression DAG
 * @param patternDAG - Rule side that matched (has tail + two \Tc nodes)
 * @param mapping - VF2 mapping: patternNodeId -> targetNodeId
 * @param arm1DAG - DAG for first (top) arm content after trim
 * @param arm2DAG - DAG for second (bottom) arm content after trim
 * @param suffixInsertDAG - DAG for the common suffix to insert after the branch
 * @param operandMapping - Maps rule operands to target operands (for arm/suffix node data)
 */
export function substituteInDAGPartialFactor(
  targetDAG: DAGStructure<ExprNodeData>,
  patternDAG: DAGStructure<ExprNodeData>,
  mapping: Map<string, string>,
  arm1DAG: DAGStructure<ExprNodeData>,
  arm2DAG: DAGStructure<ExprNodeData>,
  suffixInsertDAG: DAGStructure<ExprNodeData>,
  operandMapping: Map<string, string>
): DAGStructure<ExprNodeData> {
  const matchedIds = new Set(mapping.values());
  const tAdj = buildAdjacency(targetDAG);
  const tNodeMap = new Map(targetDAG.nodes.map((n) => [n.id, n]));
  const allTargetIds = new Set(targetDAG.nodes.map((n) => n.id));

  const prefixSet = reachableFrom(matchedIds, tAdj, 'incoming', matchedIds);
  let suffixSet = reachableFrom(matchedIds, tAdj, 'outgoing', matchedIds);
  const siblingSet = new Set<string>();
  for (const id of allTargetIds) {
    if (!matchedIds.has(id) && !prefixSet.has(id) && !suffixSet.has(id)) siblingSet.add(id);
  }
  if (siblingSet.size > 0) {
    const tailNodesInSuffix = targetDAG.nodes.filter(
      (n) => (n.data as ExprNodeData)?.op?.endsWith?.(':tail') && suffixSet.has(n.id)
    );
    const tailIds = new Set(tailNodesInSuffix.map((n) => n.id));
    if (tailIds.size > 0) {
      const continuation = reachableFrom(tailIds, tAdj, 'outgoing', new Set<string>());
      for (const id of continuation) suffixSet.delete(id);
    }
  }

  const patternTailId = patternDAG.nodes.find((n) => (n.data as ExprNodeData)?.op?.endsWith?.(':tail'))?.id;
  if (!patternTailId) return targetDAG;
  const targetTailId = mapping.get(patternTailId);
  if (!targetTailId) return targetDAG;

  const tailIncoming = patternDAG.edges.filter((e) => e.to === patternTailId);
  let targetArm1HeadId: string | null = null;
  let targetArm2HeadId: string | null = null;
  for (const e of tailIncoming) {
    const et = (e.edgeType ?? 0) as number;
    const fromTargetId = mapping.get(e.from);
    if (fromTargetId != null) {
      if (et === 3) targetArm1HeadId = fromTargetId;
      else if (et === 4) targetArm2HeadId = fromTargetId;
    }
  }
  if (targetArm1HeadId == null || targetArm2HeadId == null) return targetDAG;

  const condId: string | null = (() => {
    for (const e of targetDAG.edges) {
      if (e.to === targetArm1HeadId && ((e.edgeType ?? 0) as number) === 1) return e.from;
    }
    return null;
  })();

  // Nodes that can reach the cond (segment before Bb, e.g. root, \Ot m) — keep these in prefix, not in arm-only
  const prefixOfBranch = new Set<string>();
  if (condId != null) {
    for (const id of reachableFrom([condId], tAdj, 'incoming', new Set<string>())) {
      prefixSet.add(id);
      prefixOfBranch.add(id);
    }
  }

  // Arm-only = nodes strictly between cond and tail (exclude cond, tail, and segment before Bb)
  const arm1Only = new Set<string>([targetArm1HeadId]);
  for (const id of reachableFrom([targetArm1HeadId], tAdj, 'incoming', new Set<string>())) {
    if (id !== targetTailId && id !== condId && !prefixOfBranch.has(id)) arm1Only.add(id);
  }
  const arm2Only = new Set<string>([targetArm2HeadId]);
  for (const id of reachableFrom([targetArm2HeadId], tAdj, 'incoming', new Set<string>())) {
    if (id !== targetTailId && id !== condId && !prefixOfBranch.has(id)) arm2Only.add(id);
  }
  const prefixForMerge = new Set<string>();
  for (const id of prefixSet) {
    if (!arm1Only.has(id) && !arm2Only.has(id)) prefixForMerge.add(id);
  }

  let nextId = 0;
  const arm1Clone = cloneDAGWithNewIds(arm1DAG, 'pf_a1', nextId);
  nextId = arm1Clone.nextId;
  const arm2Clone = cloneDAGWithNewIds(arm2DAG, 'pf_a2', nextId);
  nextId = arm2Clone.nextId;
  const suffixClone = cloneDAGWithNewIds(suffixInsertDAG, 'pf_s', nextId);

  const applyOperands = (data: ExprNodeData): ExprNodeData => ({
    ...data,
    operands: (data.operands ?? []).map((o) => operandMapping.get(o) ?? o),
  });

  const mergedNodes: DAGNode<ExprNodeData>[] = [];
  const mergedEdges: DAGEdge[] = [];

  for (const id of prefixForMerge) {
    const node = tNodeMap.get(id)!;
    mergedNodes.push({ id: node.id, data: node.data });
  }

  const tailNode = tNodeMap.get(targetTailId)!;
  mergedNodes.push({ id: tailNode.id, data: tailNode.data });

  for (const n of arm1Clone.dag.nodes) {
    mergedNodes.push({ id: n.id, data: applyOperands(n.data as ExprNodeData) });
  }
  for (const n of arm2Clone.dag.nodes) {
    mergedNodes.push({ id: n.id, data: applyOperands(n.data as ExprNodeData) });
  }
  for (const n of suffixClone.dag.nodes) {
    mergedNodes.push({ id: n.id, data: applyOperands(n.data as ExprNodeData) });
  }
  for (const id of suffixSet) {
    const node = tNodeMap.get(id)!;
    mergedNodes.push({ id: node.id, data: node.data });
  }

  const addedEdge = new Set<string>();
  const addEdge = (edge: DAGEdge) => {
    const key = `${edge.from}\t${edge.to}`;
    if (!addedEdge.has(key)) {
      addedEdge.add(key);
      mergedEdges.push(edge);
    }
  };
  for (const e of targetDAG.edges) {
    if (prefixForMerge.has(e.from) && (prefixForMerge.has(e.to) || e.to === condId)) addEdge(e);
    if (siblingSet.has(e.from) && siblingSet.has(e.to)) addEdge(e);
    if (suffixSet.has(e.from) && suffixSet.has(e.to)) addEdge(e);
  }

  for (const e of arm1Clone.dag.edges) mergedEdges.push(e);
  for (const e of arm2Clone.dag.edges) mergedEdges.push(e);
  for (const e of suffixClone.dag.edges) mergedEdges.push(e);

  const arm1Heads = getHeads(arm1Clone.dag);
  const arm2Heads = getHeads(arm2Clone.dag);
  const arm1Tails = getTails(arm1Clone.dag);
  const arm2Tails = getTails(arm2Clone.dag);
  const suffixHeads = getHeads(suffixClone.dag);
  const suffixTails = getTails(suffixClone.dag);

  const arm1HeadId = arm1Heads.size > 0 ? [...arm1Heads][0]! : null;
  const arm2HeadId = arm2Heads.size > 0 ? [...arm2Heads][0]! : null;
  if (condId != null && prefixForMerge.has(condId)) {
    if (arm1HeadId) mergedEdges.push({ from: condId, to: arm1HeadId, edgeType: 1 as EdgeType });
    else mergedEdges.push({ from: condId, to: targetTailId, edgeType: 1 as EdgeType }); // empty top arm
    if (arm2HeadId) mergedEdges.push({ from: condId, to: arm2HeadId, edgeType: 2 as EdgeType });
    else mergedEdges.push({ from: condId, to: targetTailId, edgeType: 2 as EdgeType }); // empty bottom arm
  }

  const arm1TailId = arm1Tails.size > 0 ? [...arm1Tails][0]! : null;
  const arm2TailId = arm2Tails.size > 0 ? [...arm2Tails][0]! : null;
  if (arm1TailId) mergedEdges.push({ from: arm1TailId, to: targetTailId, edgeType: 3 as EdgeType });
  if (arm2TailId) mergedEdges.push({ from: arm2TailId, to: targetTailId, edgeType: 4 as EdgeType });

  const tailToSuffix = [...targetDAG.edges].filter((e) => e.from === targetTailId && suffixSet.has(e.to));
  const suffixHeadId = suffixHeads.size > 0 ? [...suffixHeads][0]! : null;
  if (suffixHeadId) {
    mergedEdges.push({ from: targetTailId, to: suffixHeadId, edgeType: 0 as EdgeType });
  }
  for (const e of tailToSuffix) {
    for (const sid of suffixTails) {
      mergedEdges.push({ from: sid, to: e.to, edgeType: (e.edgeType ?? 0) as EdgeType });
    }
  }

  for (const e of targetDAG.edges) {
    if (prefixForMerge.has(e.from) && suffixSet.has(e.to)) mergedEdges.push(e);
    if (siblingSet.has(e.from) && suffixSet.has(e.to)) mergedEdges.push(e);
  }

  if (typeof process !== 'undefined' && process.env.DEBUG_PARTIAL_FACTOR === '1') {
    const mergedAdj = buildAdjacency({ nodes: mergedNodes, edges: mergedEdges });
    const roots = mergedNodes
      .filter((n) => (mergedAdj.incoming.get(n.id)?.length ?? 0) === 0)
      .map((n) => n.id);
    const opOf = (id: string) => (mergedNodes.find((m) => m.id === id)?.data as ExprNodeData)?.op ?? (tNodeMap.get(id)?.data as ExprNodeData)?.op ?? '?';
    const incomingToCond = condId != null ? (tAdj.incoming.get(condId) ?? []) : [];
    console.error('[DEBUG_PARTIAL_FACTOR] substituteInDAGPartialFactor:');
    console.error('  prefixSet size:', prefixSet.size, 'prefixForMerge size:', prefixForMerge.size);
    console.error('  incoming to cond:', condId, incomingToCond.map((id) => `${id}(${opOf(id)})`));
    console.error('  prefixForMerge ids:', [...prefixForMerge].slice(0, 20).map((id) => `${id}(${opOf(id)})`));
    console.error('  condId:', condId, condId ? opOf(condId) : '');
    console.error('  targetTailId:', targetTailId, 'targetArm1HeadId:', targetArm1HeadId, 'targetArm2HeadId:', targetArm2HeadId);
    console.error('  arm1Only size:', arm1Only.size, 'arm2Only size:', arm2Only.size);
    console.error('  arm1Clone nodes:', arm1Clone.dag.nodes.length, 'arm2Clone:', arm2Clone.dag.nodes.length, 'suffixClone:', suffixClone.dag.nodes.length);
    console.error('  merged nodes:', mergedNodes.length, 'merged edges:', mergedEdges.length);
    console.error('  merged roots:', roots, roots.map((id) => opOf(id)));
    console.error('  edges from cond:', mergedEdges.filter((e) => e.from === condId));
  }

  return { nodes: mergedNodes, edges: mergedEdges };
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
  let matchedIds = new Set(mapping.values());
  const tAdj = buildAdjacency(targetDAG);
  const rAdj = buildAdjacency(replacementDAG);

  const tNodeMap = new Map(targetDAG.nodes.map((n) => [n.id, n]));
  const allTargetIds = new Set(targetDAG.nodes.map((n) => n.id));

  // When pattern matched only a branch cond (e.g. \Blb{i \Pu}{,}{,}) and replacement is a full branch,
  // expand matched to the whole branch (cond + arms + tail) so we replace the entire branch.
  if (
    patternDAG.nodes.length === 1 &&
    replacementDAG.nodes.length > 1 &&
    [...matchedIds].every((id) => {
      const op = (tNodeMap.get(id)?.data as ExprNodeData)?.op ?? '';
      return op.includes(':cond');
    })
  ) {
    const outgoingFromMatched = reachableFrom(matchedIds, tAdj, 'outgoing', new Set<string>());
    matchedIds = new Set([...matchedIds, ...outgoingFromMatched]);
  }

  // Partition: prefix = nodes that can reach matched; suffix = nodes reachable from matched
  const prefixSet = reachableFrom(matchedIds, tAdj, 'incoming', matchedIds);
  const suffixSet = reachableFrom(matchedIds, tAdj, 'outgoing', matchedIds);

  // Sibling set: nodes neither in prefix, suffix, nor matched (e.g. top arm when match is in bottom arm)
  const siblingSet = new Set<string>();
  for (const id of allTargetIds) {
    if (!matchedIds.has(id) && !prefixSet.has(id) && !suffixSet.has(id)) siblingSet.add(id);
  }

  // When substituting inside a branch (sibling present), suffix = matched arm only, not the continuation after the branch.
  // Remove from suffix any node reachable from a branch tail (the continuation after the branch).
  if (siblingSet.size > 0) {
    const tailNodesInSuffix = targetDAG.nodes.filter(
      (n) => (n.data as ExprNodeData)?.op?.endsWith?.(':tail') && suffixSet.has(n.id)
    );
    const tailIds = new Set(tailNodesInSuffix.map((n) => n.id));
    if (tailIds.size > 0) {
      const continuation = reachableFrom(tailIds, tAdj, 'outgoing', new Set<string>());
      for (const id of continuation) suffixSet.delete(id);
    }
  }

  // Option B: pattern matched only a branch cond, replacement is a full branch with arm content — prepend replacement arms to target arms.
  const patternSingleCond =
    patternDAG.nodes.length === 1 &&
    ((patternDAG.nodes[0]?.data as ExprNodeData)?.op ?? '').includes(':cond');
  if (patternSingleCond && replacementDAG.nodes.length > 1) {
    const rBranch = getReplacementBranchStructure(replacementDAG, rAdj);
    const replHasArms = rBranch.condId && (rBranch.arm1NodeIds.size > 0 || rBranch.arm2NodeIds.size > 0);
    if (replHasArms) {
      return substituteInDAGPrefixArms(
        targetDAG,
        replacementDAG,
        mapping,
        operandMapping,
        prefixSet,
        suffixSet,
        matchedIds
      );
    }
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

  // Prefix->replacement first (in arm order 1 then 2) so branch head's children are [top_arm, bottom_arm].
  // Then prefix->prefix and prefix->sibling so \Or stays in the right arm (sibling in bottom when replacement in top).
  addPrefixToReplacementEdges(
    targetDAG.edges,
    replacementDAG,
    mergedEdges,
    prefixSet,
    matchedIds,
    siblingSet,
    replacementHeads,
    replacementIdMap
  );
  const prefixEdgesToAdd = targetDAG.edges.filter(
    (e) => prefixSet.has(e.from) && (prefixSet.has(e.to) || siblingSet.has(e.to))
  );
  prefixEdgesToAdd.sort(
    (a, b) =>
      edgeTypeOrder((a.edgeType ?? 0) as number) - edgeTypeOrder((b.edgeType ?? 0) as number) ||
      ((a.edgeType ?? 0) as number) - ((b.edgeType ?? 0) as number)
  );
  for (const e of prefixEdgesToAdd) mergedEdges.push(e);

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
    replacementTails,
    tAdj,
    targetDAG,
    replacementDAG,
    replacementIdMap
  );

  // Ensure branch-head arm order: empty arm (replacement) first, content arm (sibling) second,
  // so dagToExpr yields top = replacement, bottom = sibling (e.g. {,}{\Or,}).
  const replacementIds = new Set(replacementIdMap.values());
  orderBranchHeadEdges(mergedEdges, replacementIds, siblingSet);

  return { nodes: mergedNodes, edges: mergedEdges };
}

/** Edge type order for branch: top arm (0,1,3) before bottom arm (2,4) so dagToExpr serializes top then bottom. */
const TOP_ARM_TYPES = new Set([0, 1, 3]);
function edgeTypeOrder(et: number): number {
  return TOP_ARM_TYPES.has(et) ? 0 : 1;
}

/**
 * Reorder edges from branch heads so that edge type 1 (top arm) comes before type 2 (bottom arm).
 * This preserves structural arm order so dagToExpr yields top arm then bottom arm.
 */
function orderBranchHeadEdges(
  edges: DAGEdge[],
  replacementIds: Set<string>,
  _siblingSet: Set<string>
): void {
  const byFrom = new Map<string, DAGEdge[]>();
  for (const e of edges) {
    const list = byFrom.get(e.from) ?? [];
    list.push(e);
    byFrom.set(e.from, list);
  }
  const fromOrder: string[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    if (!seen.has(e.from)) {
      seen.add(e.from);
      fromOrder.push(e.from);
    }
  }
  edges.length = 0;
  for (const from of fromOrder) {
    const list = byFrom.get(from)!;
    const hasType1Or2 = list.some((e) => ((e.edgeType ?? 0) as number) === 1 || ((e.edgeType ?? 0) as number) === 2);
    if (hasType1Or2) {
      list.sort(
        (a, b) =>
          edgeTypeOrder((a.edgeType ?? 0) as number) - edgeTypeOrder((b.edgeType ?? 0) as number) ||
          ((a.edgeType ?? 0) as number) - ((b.edgeType ?? 0) as number)
      );
    }
    edges.push(...list);
  }
}

/** NewId -> original replacement node id (for sorting heads by arm). */
function buildNewIdToOriginal(replacementIdMap: Map<string, string>): Map<string, string> {
  const m = new Map<string, string>();
  for (const [orig, newId] of replacementIdMap) m.set(newId, orig);
  return m;
}

/** Compute arm type (1=top, 2=bottom) for each replacement head. For Brs there is no cond node so use path to tail: edge type 3→top, 4→bottom. */
function getReplacementHeadArmTypes(
  replacementDAG: DAGStructure<ExprNodeData>,
  replacementIdMap: Map<string, string>,
  replacementHeads: Set<string>
): Map<string, number> {
  const result = new Map<string, number>();
  const nodeIds = new Set(replacementDAG.nodes.map((n) => n.id));
  const newIdToOrig = buildNewIdToOriginal(replacementIdMap);

  for (const e of replacementDAG.edges) {
    const toNewId = replacementIdMap.get(e.to);
    if (toNewId != null) {
      const et = (e.edgeType ?? 0) as number;
      if (et === 1 || et === 2) result.set(toNewId, et);
    }
  }

  const tailIds = replacementDAG.nodes
    .filter((n) => (n.data as ExprNodeData)?.op?.endsWith?.(':tail'))
    .map((n) => n.id);
  if (tailIds.length === 0) return result;

  for (const tailId of tailIds) {
    const incomingToTail = replacementDAG.edges.filter((e) => e.to === tailId);
    const typeByFrom = new Map<string, number>();
    for (const e of incomingToTail) {
      typeByFrom.set(e.from, (e.edgeType ?? 0) as number);
    }
    const armTypeByNode = new Map<string, number>();
    const worklist: string[] = [...typeByFrom.keys()];
    for (const from of worklist) {
      const et = typeByFrom.get(from);
      if (et === 3 || et === 4) armTypeByNode.set(from, et === 3 ? 1 : 2);
    }
    while (worklist.length > 0) {
      const id = worklist.pop()!;
      const arm = armTypeByNode.get(id);
      if (arm == null) continue;
      for (const e of replacementDAG.edges) {
        if (e.to === id && nodeIds.has(e.from) && !armTypeByNode.has(e.from)) {
          armTypeByNode.set(e.from, arm);
          worklist.push(e.from);
        }
      }
    }
    for (const newId of replacementHeads) {
      const orig = newIdToOrig.get(newId);
      if (orig != null && armTypeByNode.has(orig)) {
        result.set(newId, armTypeByNode.get(orig)!);
      }
    }
  }
  return result;
}

/** Add prefix->replacement head edges: one per matched arm only. When the opposite arm is a sibling, do not add replacement there so \Or stays in the right arm. */
function addPrefixToReplacementEdges(
  targetEdges: DAGEdge[],
  replacementDAG: DAGStructure<ExprNodeData>,
  out: DAGEdge[],
  prefixSet: Set<string>,
  matchedIds: Set<string>,
  siblingSet: Set<string>,
  replacementHeads: Set<string>,
  replacementIdMap: Map<string, string>
): void {
  let prefixToMatched: Array<{ from: string; edgeType: number }> = [];
  for (const e of targetEdges) {
    if (prefixSet.has(e.from) && matchedIds.has(e.to)) {
      prefixToMatched.push({ from: e.from, edgeType: (e.edgeType ?? 0) as number });
    }
  }
  const siblingArmType = new Set<number>();
  for (const e of targetEdges) {
    if (prefixSet.has(e.from) && siblingSet.has(e.to)) {
      const et = (e.edgeType ?? 0) as number;
      if (et === 1 || et === 2) siblingArmType.add(et);
    }
  }
  if (siblingArmType.size > 0) {
    prefixToMatched = prefixToMatched.filter((x) => !siblingArmType.has(x.edgeType));
  }
  prefixToMatched.sort(
    (a, b) => edgeTypeOrder(a.edgeType) - edgeTypeOrder(b.edgeType) || a.edgeType - b.edgeType
  );

  const incomingOrArmType = getReplacementHeadArmTypes(replacementDAG, replacementIdMap, replacementHeads);
  const headIdsByArm = new Map<number, string>();
  for (const hid of replacementHeads) {
    const arm = incomingOrArmType.get(hid) ?? 0;
    if (arm === 1 || arm === 2) headIdsByArm.set(arm, hid);
  }
  // When replacement has no branch structure (e.g. single node like ",\Or,"), use its single head for the matched arm
  const singleHead = replacementHeads.size === 1 ? [...replacementHeads][0]! : null;

  for (const { from: prefixId, edgeType } of prefixToMatched) {
    let headId = headIdsByArm.get(edgeType);
    if (headId == null && singleHead != null) headId = singleHead;
    if (headId != null) out.push({ from: prefixId, to: headId, edgeType: edgeType as EdgeType });
  }
}

/** Get arm type (1 or 2) for each matched node based on target branch structure. Returns 0 if not in a branch arm. */
function getMatchedNodeArmTypes(
  targetDAG: DAGStructure<ExprNodeData>,
  matchedIds: Set<string>,
  tAdj: { outgoing: Map<string, string[]> }
): Map<string, number> {
  const result = new Map<string, number>();
  const condId =
    targetDAG.nodes.find(
      (n) => matchedIds.has(n.id) && ((n.data as ExprNodeData)?.op ?? '').includes(':cond')
    )?.id ?? null;
  if (!condId) return result;
  // Trace arm membership from cond via edge types 1 (arm1) and 2 (arm2)
  const armByNode = new Map<string, number>();
  armByNode.set(condId, 0);
  const targetEdges = targetDAG.edges;
  const worklist: Array<{ id: string; arm: number }> = [];
  for (const to of tAdj.outgoing.get(condId) ?? []) {
    const e = targetEdges.find((ed) => ed.from === condId && ed.to === to);
    const et = (e?.edgeType ?? 0) as number;
    if (et === 1 || et === 2) {
      armByNode.set(to, et);
      worklist.push({ id: to, arm: et });
    }
  }
  while (worklist.length > 0) {
    const { id, arm } = worklist.pop()!;
    for (const to of tAdj.outgoing.get(id) ?? []) {
      if (matchedIds.has(to) && !armByNode.has(to)) {
        armByNode.set(to, arm);
        worklist.push({ id: to, arm });
      }
    }
  }
  for (const id of matchedIds) {
    const a = armByNode.get(id);
    if (a != null && a !== 0) result.set(id, a);
  }
  return result;
}

/** Get arm type (1, 2, or 0 for "both") for each replacement tail. Blb with empty arms has one tail serving both. */
function getReplacementTailArmTypes(
  replacementDAG: DAGStructure<ExprNodeData>,
  replacementIdMap: Map<string, string>,
  replacementTails: Set<string>
): Map<string, number> {
  const result = new Map<string, number>();
  const rAdj = buildAdjacency(replacementDAG);
  const newIdToOrig = buildNewIdToOriginal(replacementIdMap);
  const nodeIds = new Set(replacementDAG.nodes.map((n) => n.id));
  const condId = replacementDAG.nodes.find(
    (n) => ((n.data as ExprNodeData)?.op ?? '').includes(':cond')
  )?.id;

  // Propagate arm from cond (edge 1->arm1, 2->arm2) to all nodes
  const armTypeByNode = new Map<string, number>();
  if (condId) {
    armTypeByNode.set(condId, 0);
    const worklist: Array<{ id: string; arm: number }> = [];
    for (const e of replacementDAG.edges) {
      if (e.from === condId && ((e.edgeType ?? 0) === 1 || (e.edgeType ?? 0) === 2)) {
        const arm = (e.edgeType ?? 0) === 1 ? 1 : 2;
        armTypeByNode.set(e.to, arm);
        worklist.push({ id: e.to, arm });
      }
    }
    while (worklist.length > 0) {
      const { id, arm } = worklist.pop()!;
      for (const to of rAdj.outgoing.get(id) ?? []) {
        if (nodeIds.has(to) && !armTypeByNode.has(to)) {
          armTypeByNode.set(to, arm);
          worklist.push({ id: to, arm });
        }
      }
    }
  }

  for (const tailNewId of replacementTails) {
    const orig = newIdToOrig.get(tailNewId);
    result.set(tailNewId, orig != null ? (armTypeByNode.get(orig) ?? 0) : 0);
  }
  return result;
}

function addBoundaryEdges(
  targetEdges: DAGEdge[],
  out: DAGEdge[],
  prefixSet: Set<string>,
  suffixSet: Set<string>,
  siblingSet: Set<string>,
  matchedIds: Set<string>,
  _replacementHeads: Set<string>,
  replacementTails: Set<string>,
  tAdj: { outgoing: Map<string, string[]> },
  targetDAG: DAGStructure<ExprNodeData>,
  replacementDAG: DAGStructure<ExprNodeData>,
  replacementIdMap: Map<string, string>
): void {
  // prefix->replacement already added in addPrefixToReplacementEdges (in type order)

  const suffixFromMatched: Array<{ suffixId: string; edgeType: number; fromMatchedId: string }> = [];
  for (const e of targetEdges) {
    if (matchedIds.has(e.from) && suffixSet.has(e.to)) {
      suffixFromMatched.push({
        suffixId: e.to,
        edgeType: (e.edgeType ?? 0) as number,
        fromMatchedId: e.from,
      });
    }
  }
  suffixFromMatched.sort(
    (a, b) => edgeTypeOrder(a.edgeType) - edgeTypeOrder(b.edgeType) || a.edgeType - b.edgeType
  );

  const matchedArmByNode = getMatchedNodeArmTypes(targetDAG, matchedIds, tAdj);
  const tailArmByNode = getReplacementTailArmTypes(replacementDAG, replacementIdMap, replacementTails);

  // When replacement has arm content, get arm tails: either nodes that feed the structural tail with type 3/4,
  // or (for Blb with no structural tail) the replacement tails that have arm type 1 or 2.
  const newIdToOrig = buildNewIdToOriginal(replacementIdMap);
  const replacementArmTailsByArm = new Map<number, string>(); // arm 1 or 2 -> newId
  for (const tailId of replacementTails) {
    const origId = newIdToOrig.get(tailId);
    if (origId == null) continue;
    for (const e of replacementDAG.edges) {
      if (e.to !== origId || !replacementDAG.nodes.some((n) => n.id === e.from)) continue;
      const et = (e.edgeType ?? 0) as number;
      const fromNew = replacementIdMap.get(e.from);
      if (fromNew != null && (et === 3 || et === 4)) replacementArmTailsByArm.set(et === 3 ? 1 : 2, fromNew);
    }
    const arm = tailArmByNode.get(tailId) ?? 0;
    if (arm >= 1 && arm <= 2) replacementArmTailsByArm.set(arm, tailId); // Blb: tails are the arm tails
  }

  const addedEdge = new Set<string>();
  const addEdgeOnce = (from: string, to: string, edgeType: EdgeType) => {
    const key = `${from}\t${to}\t${edgeType}`;
    if (!addedEdge.has(key)) {
      addedEdge.add(key);
      out.push({ from, to, edgeType });
    }
  };

  // First: connect replacement arm tails (j \Os nodes) to arm-specific suffix (\Tc c_1, c_2).
  // edgeType 1 or 2 from cond indicates arm 1 or 2.
  for (const { suffixId, edgeType } of suffixFromMatched) {
    if (edgeType === 1 || edgeType === 2) {
      const armTail = replacementArmTailsByArm.get(edgeType);
      if (armTail != null) {
        addEdgeOnce(armTail, suffixId, (edgeType === 1 ? 3 : 4) as EdgeType);
      }
    }
  }

  // Second: connect structural replacement tail to suffix (for non-arm-specific or when no arm tails)
  for (const tailId of replacementTails) {
    const tailArm = tailArmByNode.get(tailId) ?? 0;
    for (const { suffixId, edgeType, fromMatchedId } of suffixFromMatched) {
      const suffixArm = matchedArmByNode.get(fromMatchedId) ?? 0;
      const alreadyViaArmTail = (edgeType === 1 || edgeType === 2) && replacementArmTailsByArm.has(edgeType);
      if (alreadyViaArmTail) continue; // already connected via arm tail
      if (tailArm === 0 || suffixArm === 0 || tailArm === suffixArm) {
        const et = edgeType as EdgeType;
        const useType =
          tailArm === 0 && suffixArm >= 1 && suffixArm <= 2 ? (suffixArm as EdgeType) : et;
        addEdgeOnce(tailId, suffixId, useType);
      }
    }
  }

  // prefix->suffix (empty arms) and sibling->suffix (sibling arms)
  // prefix->sibling is added with prefix edges to preserve arm order
  for (const e of targetEdges) {
    if (prefixSet.has(e.from) && suffixSet.has(e.to)) out.push({ from: e.from, to: e.to, edgeType: e.edgeType });
    if (siblingSet.has(e.from) && suffixSet.has(e.to)) out.push({ from: e.from, to: e.to, edgeType: e.edgeType });
  }
}
