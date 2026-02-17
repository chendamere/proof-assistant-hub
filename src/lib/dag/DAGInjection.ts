/**
 * VF2 subgraph isomorphism for expression DAGs with variable operand binding.
 * Pattern (rule) operands (i, m, j, etc.) match target operands (1, 2, 3) with consistent binding.
 */

import type { DAGStructure, ExprNodeData } from './types';
import { buildAdjacency, buildEdgeTypeMap } from './utils';

/**
 * Normalize branch structural op for comparison.
 * Branch nodes use :cond or :tail (no Bb/Blb/Brb prefix in node data).
 * \Blb and \Bls are treated as equivalent (same semantics).
 */
function normalizeBranchOp(op: string): string {
  if (/^:cond(:|$)|^:tail$/.test(op)) return op;
  const m = op.match(/^\\B[lr]?[bs](:cond(?::\S+)?|:tail)$/);
  return m ? m[1] : op;
}

/** Pattern operands bind to target operands. One-to-one: each rule operand -> unique target operand, each target operand -> at most one rule operand.
 * \Tc in target is treated as literal (op + operands). When fixedOperandMapping is provided, uses existing bindings for those keys. */
function exprDataMatches(
  pData: ExprNodeData,
  tData: ExprNodeData,
  varToTarget: Map<string, string>,
  targetToVar: Map<string, string>,
  fixedOperandMapping?: Map<string, string>
): boolean {
  const checkOrBind = (pOp: string, tOp: string): boolean => {
    if (fixedOperandMapping?.has(pOp)) {
      return fixedOperandMapping.get(pOp) === tOp;
    }
    if (varToTarget.has(pOp)) {
      return varToTarget.get(pOp) === tOp;
    }
    if (targetToVar.has(tOp) && targetToVar.get(tOp) !== pOp) return false;
    varToTarget.set(pOp, tOp);
    targetToVar.set(tOp, pOp);
    return true;
  };

  // \Oe (equals) compatible with \Pu (defined): only first operand must match
  // Pattern i \Oe j can match target i \Pu (i defined implies i \Oe i)
  const pHasOe = pData.op.includes('Oe') && !pData.op.includes('nOe');
  const tHasPu = tData.op.includes('Pu') && !tData.op.includes('nPu');
  if (pHasOe && tHasPu) {
    if (pData.operands.length < 1 || tData.operands.length < 1) return false;
    return checkOrBind(pData.operands[0], tData.operands[0]);
  }

  // \Pe (previous-equals) compatible with \Oe (equals): target \Oe matches pattern \Pe
  const pHasPe = pData.op.includes('Pe') && !pData.op.includes('nPe');
  const tHasOe = tData.op.includes('Oe') && !tData.op.includes('nOe');
  if (pHasPe && tHasOe) {
    if (pData.operands.length !== tData.operands.length) return false;
    for (let i = 0; i < pData.operands.length; i++) {
      if (!checkOrBind(pData.operands[i], tData.operands[i])) return false;
    }
    return true;
  }

  // \Oe (equals) compatible with \Pe (previous-equals): pattern \Oe matches target \Pe
  const pHasOeCond = pData.op.includes('Oe') && !pData.op.includes('nOe');
  const tHasPe = tData.op.includes('Pe') && !tData.op.includes('nPe');
  if (pHasOeCond && tHasPe) {
    if (pData.operands.length !== tData.operands.length) return false;
    for (let i = 0; i < pData.operands.length; i++) {
      if (!checkOrBind(pData.operands[i], tData.operands[i])) return false;
    }
    return true;
  }

  const pOpNorm = normalizeBranchOp(pData.op);
  const tOpNorm = normalizeBranchOp(tData.op);
  if (pOpNorm !== tOpNorm) return false;
  if (pData.operands.length !== tData.operands.length) return false;

  for (let i = 0; i < pData.operands.length; i++) {
    if (!checkOrBind(pData.operands[i], tData.operands[i])) return false;
  }
  return true;
}

/** True iff pattern node data can match target node data as root (with empty bindings). Used to filter root candidates. */
function canMatchAsRoot(pData: ExprNodeData, tData: ExprNodeData): boolean {
  return exprDataMatches(pData, tData, new Map(), new Map());
}

/** Outgoing edges with types: [(toId, edgeType), ...] */
function getOutgoingWithTypes(
  from: string,
  adj: { outgoing: Map<string, string[]> },
  edgeTypeMap: Map<string, number>
): [string, number][] {
  const outs = adj.outgoing.get(from) ?? [];
  return outs.map((to) => [to, edgeTypeMap.get(`${from}\0${to}`) ?? 0] as [string, number]);
}

/** Find target node reachable from t via edge of given type; null if none. */
function findOutgoingWithType(
  from: string,
  edgeType: number,
  adj: { outgoing: Map<string, string[]> },
  edgeTypeMap: Map<string, number>
): string | null {
  for (const to of adj.outgoing.get(from) ?? []) {
    if ((edgeTypeMap.get(`${from}\0${to}`) ?? 0) === edgeType) return to;
  }
  return null;
}

/** All target nodes reachable from from via edge of given type (for backtracking over Tc candidates). */
function getAllOutgoingWithType(
  from: string,
  edgeType: number,
  adj: { outgoing: Map<string, string[]> },
  edgeTypeMap: Map<string, number>
): string[] {
  const result: string[] = [];
  for (const to of adj.outgoing.get(from) ?? []) {
    if ((edgeTypeMap.get(`${from}\0${to}`) ?? 0) === edgeType) result.push(to);
  }
  return result;
}

/** Incoming edges with types: [(fromId, edgeType), ...] */
function getIncomingWithTypes(
  to: string,
  adj: { incoming: Map<string, string[]> },
  edgeTypeMap: Map<string, number>
): [string, number][] {
  const ins = adj.incoming.get(to) ?? [];
  return ins.map((from) => [from, edgeTypeMap.get(`${from}\0${to}`) ?? 0] as [string, number]);
}

/** Find target node that has edge of given type into ti; null if none. */
function findIncomingWithType(
  to: string,
  edgeType: number,
  adj: { incoming: Map<string, string[]> },
  edgeTypeMap: Map<string, number>
): string | null {
  for (const from of adj.incoming.get(to) ?? []) {
    if ((edgeTypeMap.get(`${from}\0${to}`) ?? 0) === edgeType) return from;
  }
  return null;
}

/** All target nodes that have edge of given type into to (for backtracking over Tc candidates). */
function getAllIncomingWithType(
  to: string,
  edgeType: number,
  adj: { incoming: Map<string, string[]> },
  edgeTypeMap: Map<string, number>
): string[] {
  const result: string[] = [];
  for (const from of adj.incoming.get(to) ?? []) {
    if ((edgeTypeMap.get(`${from}\0${to}`) ?? 0) === edgeType) result.push(from);
  }
  return result;
}

/** Count :cond (head) and :tail nodes in pattern. */
function countHeadsAndTails(
  structure: DAGStructure<ExprNodeData>
): { headCount: number; tailCount: number; tailIds: string[] } {
  let headCount = 0;
  let tailCount = 0;
  const tailIds: string[] = [];
  for (const n of structure.nodes) {
    const op = (n.data as ExprNodeData)?.op ?? '';
    if (op.includes(':cond')) headCount++;
    if (op.endsWith(':tail')) {
      tailCount++;
      tailIds.push(n.id);
    }
  }
  return { headCount, tailCount, tailIds };
}

export interface SingleRootDAGInjectionOptions {
  /** Cap root attempts to avoid runaway cost on large targets (e.g. 30+ nodes). */
  maxRootAttempts?: number;
  /** Fixed operand bindings from a prior match. For keys in this map, only accept candidates that match; do not add new bindings. */
  fixedOperandMapping?: Map<string, string>;
}

/**
 * Single-root DAG injection: try each target node as starting position. Uses fillMap to recursively
 * match pattern to target with top-with-top, bot-with-bot edge pairing.
 * When headCount < tailCount (Brb-style: no cond, arms converge to tail), traverses right-to-left
 * using incoming edges. Returns all matches.
 */
export function* SingleRootDAGInjection(
  pattern: DAGStructure<ExprNodeData>,
  target: DAGStructure<ExprNodeData>,
  options?: SingleRootDAGInjectionOptions
): Generator<{ mapping: Map<string, string>; operandMapping: Map<string, string> }> {
  const fixedOperandMapping = options?.fixedOperandMapping;
  if (pattern.nodes.length === 0) {
    yield { mapping: new Map(), operandMapping: new Map() };
    return;
  }
  if (pattern.nodes.length > target.nodes.length) return;

  const pNodes = pattern.nodes.map((n) => n.id);
  const pAdj = buildAdjacency(pattern);
  const tAdj = buildAdjacency(target);
  const pEdgeTypeMap = buildEdgeTypeMap(pattern.edges);
  const tEdgeTypeMap = buildEdgeTypeMap(target.edges);
  const pNodeMap = new Map(pattern.nodes.map((n) => [n.id, n]));
  const tNodeMap = new Map(target.nodes.map((n) => [n.id, n]));

  const { headCount, tailCount, tailIds } = countHeadsAndTails(pattern);
  const useIncoming = headCount < tailCount;
  // When right-to-left: start from a sink (no outgoing) so we traverse incoming and reach all pattern nodes.
  // E.g. \Brs{,}{,} ,\Tc c: tail has outgoing to \Tc c; we must start from \Tc c to map both.
  const pStart = useIncoming
    ? (() => {
        const sinks = pNodes.filter((id) => (pAdj.outgoing.get(id) ?? []).length === 0);
        if (sinks.length > 0) {
          sinks.sort((a, b) => {
            const aEnd = ((pNodeMap.get(a)?.data ?? {}) as ExprNodeData & { end?: number }).end ?? 0;
            const bEnd = ((pNodeMap.get(b)?.data ?? {}) as ExprNodeData & { end?: number }).end ?? 0;
            return bEnd - aEnd; // rightmost first
          });
          return sinks[0]!;
        }
        return tailIds[0] ?? pNodes[0];
      })()
    : (pNodes.find((id) => (pAdj.incoming.get(id) ?? []).length === 0) ?? pNodes[0]);
  const pStartData = (pNodeMap.get(pStart)?.data ?? {}) as ExprNodeData;
  const pStartOpNorm = normalizeBranchOp(pStartData.op);
  let tNodes = target.nodes
    .map((n) => n.id)
    .filter((ti) =>
      canMatchAsRoot(pStartData, (tNodeMap.get(ti)?.data ?? {}) as ExprNodeData)
    );
  // When more tails than heads (e.g. Brs/Brb), use right-to-left traversal and try last outermost
  // target node first (rightmost by character position). Otherwise same-op-first for earlier match.
  tNodes = [...tNodes].sort((a, b) => {
    if (useIncoming) {
      const aEnd = ((tNodeMap.get(a)?.data ?? {}) as ExprNodeData & { end?: number }).end ?? 0;
      const bEnd = ((tNodeMap.get(b)?.data ?? {}) as ExprNodeData & { end?: number }).end ?? 0;
      return bEnd - aEnd;
    }
    const aNorm = normalizeBranchOp(((tNodeMap.get(a)?.data ?? {}) as ExprNodeData).op);
    const bNorm = normalizeBranchOp(((tNodeMap.get(b)?.data ?? {}) as ExprNodeData).op);
    const aMatch = aNorm === pStartOpNorm ? 1 : 0;
    const bMatch = bNorm === pStartOpNorm ? 1 : 0;
    return bMatch - aMatch;
  });

  const patternKey = (id: string): string => {
    const d = (pNodeMap.get(id)?.data ?? {}) as ExprNodeData;
    return `${normalizeBranchOp(d.op ?? '')}:${d.operands?.length ?? 0}`;
  };
  const targetKey = (id: string): string => {
    const d = (tNodeMap.get(id)?.data ?? {}) as ExprNodeData;
    return `${normalizeBranchOp(d.op)}:${d.operands?.length ?? 0}`;
  };
  const patternCountsTotal = new Map<string, number>();
  const targetCountsTotal = new Map<string, number>();
  for (const id of pNodes) {
    const k = patternKey(id);
    patternCountsTotal.set(k, (patternCountsTotal.get(k) ?? 0) + 1);
  }
  for (const id of tNodeMap.keys()) {
    const k = targetKey(id);
    targetCountsTotal.set(k, (targetCountsTotal.get(k) ?? 0) + 1);
  }

  const mapping = new Map<string, string>();
  const reverseMapping = new Map<string, string>();
  const varToTarget = new Map<string, string>();
  const targetToVar = new Map<string, string>();
  const mappedPatternCounts = new Map<string, number>();
  const mappedTargetCounts = new Map<string, number>();

  function removeMapping(pi: string, ti: string): void {
    mapping.delete(pi);
    reverseMapping.delete(ti);
    const pk = patternKey(pi);
    const tk = targetKey(ti);
    mappedPatternCounts.set(pk, (mappedPatternCounts.get(pk) ?? 0) - 1);
    mappedTargetCounts.set(tk, (mappedTargetCounts.get(tk) ?? 0) - 1);
  }
  function addMapping(pi: string, ti: string): void {
    mapping.set(pi, ti);
    reverseMapping.set(ti, pi);
    const pk = patternKey(pi);
    const tk = targetKey(ti);
    mappedPatternCounts.set(pk, (mappedPatternCounts.get(pk) ?? 0) + 1);
    mappedTargetCounts.set(tk, (mappedTargetCounts.get(tk) ?? 0) + 1);
  }

  /** Build operand mapping for export (varToTarget). */
  function buildOperandMapping(): Map<string, string> {
    return new Map(varToTarget);
  }

  /** Returns false if the current partial mapping cannot extend to a full match (prune). O(keys) not O(nodes). */
  function canExtend(): boolean {
    const unmappedP = pNodes.length - mapping.size;
    const unmappedT = tNodeMap.size - reverseMapping.size;
    if (unmappedP > unmappedT) return false;
    for (const [k, c] of patternCountsTotal) {
      const remP = c - (mappedPatternCounts.get(k) ?? 0);
      const remT = (targetCountsTotal.get(k) ?? 0) - (mappedTargetCounts.get(k) ?? 0);
      if (remP > remT) return false;
    }
    return true;
  }

  function* fillMap(pi: string, ti: string): Generator<{ mapping: Map<string, string>; operandMapping: Map<string, string> }> {
    const pData = (pNodeMap.get(pi)?.data ?? {}) as ExprNodeData;
    const tData = (tNodeMap.get(ti)?.data ?? {}) as ExprNodeData;
    const savedVar = new Map(varToTarget);
    const savedTarget = new Map(targetToVar);

    if (!exprDataMatches(pData, tData, varToTarget, targetToVar, fixedOperandMapping)) {
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return;
    }

    addMapping(pi, ti);

    if (mapping.size === pNodes.length) {
      yield { mapping: new Map(mapping), operandMapping: buildOperandMapping() };
      removeMapping(pi, ti);
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return;
    }
    if (!canExtend()) {
      removeMapping(pi, ti);
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return;
    }

    const pOutgoing = getOutgoingWithTypes(pi, pAdj, pEdgeTypeMap);
    for (const [p_out, edgeType] of pOutgoing) {
      const tOutCandidates = getAllOutgoingWithType(ti, edgeType, tAdj, tEdgeTypeMap);
      if (mapping.has(p_out)) {
        const t_out = mapping.get(p_out)!;
        if (!tOutCandidates.includes(t_out)) {
          removeMapping(pi, ti);
          varToTarget.clear();
          targetToVar.clear();
          savedVar.forEach((v, k) => varToTarget.set(k, v));
          savedTarget.forEach((v, k) => targetToVar.set(k, v));
          return;
        }
        continue;
      }
      let hadCandidates = false;
      for (const t_out of tOutCandidates) {
        if (reverseMapping.has(t_out)) continue;
        hadCandidates = true;
        const prev = mapping.get(p_out);
        if (prev != null) removeMapping(p_out, prev);
        yield* fillMap(p_out, t_out);
      }
      if (!hadCandidates) {
        removeMapping(pi, ti);
        varToTarget.clear();
        targetToVar.clear();
        savedVar.forEach((v, k) => varToTarget.set(k, v));
        savedTarget.forEach((v, k) => targetToVar.set(k, v));
        return;
      }
    }
  }

  function* fillMapIncoming(
    pi: string,
    ti: string,
    addedByCaller = false
  ): Generator<{ mapping: Map<string, string>; operandMapping: Map<string, string> }> {
    const pData = (pNodeMap.get(pi)?.data ?? {}) as ExprNodeData;
    const tData = (tNodeMap.get(ti)?.data ?? {}) as ExprNodeData;
    const savedVar = new Map(varToTarget);
    const savedTarget = new Map(targetToVar);

    if (!exprDataMatches(pData, tData, varToTarget, targetToVar, fixedOperandMapping)) {
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return;
    }

    if (!addedByCaller) addMapping(pi, ti);

    if (mapping.size === pNodes.length) {
      yield { mapping: new Map(mapping), operandMapping: buildOperandMapping() };
      if (!addedByCaller) removeMapping(pi, ti);
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return;
    }
    if (!canExtend()) {
      if (!addedByCaller) removeMapping(pi, ti);
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return;
    }

    const pIncoming = getIncomingWithTypes(pi, pAdj, pEdgeTypeMap);
    for (const [p_in, edgeType] of pIncoming) {
      if (!mapping.has(p_in)) continue;
      const t_in = mapping.get(p_in)!;
      const tInCandidates = getAllIncomingWithType(ti, edgeType, tAdj, tEdgeTypeMap);
      if (!tInCandidates.includes(t_in)) {
        if (!addedByCaller) removeMapping(pi, ti);
        varToTarget.clear();
        targetToVar.clear();
        savedVar.forEach((v, k) => varToTarget.set(k, v));
        savedTarget.forEach((v, k) => targetToVar.set(k, v));
        return;
      }
    }
    const unmapped = pIncoming.filter(([p_in]) => !mapping.has(p_in));
    if (unmapped.length === 0) return;

    if (unmapped.length === 1) {
      const [[p_in, edgeType]] = unmapped;
      const tInCandidates = getAllIncomingWithType(ti, edgeType, tAdj, tEdgeTypeMap);
      let hadCandidates = false;
      for (const t_in of tInCandidates) {
        if (reverseMapping.has(t_in)) continue;
        hadCandidates = true;
        const prev = mapping.get(p_in);
        if (prev != null) removeMapping(p_in, prev);
        yield* fillMapIncoming(p_in, t_in);
      }
      if (!hadCandidates) {
        if (!addedByCaller) removeMapping(pi, ti);
        varToTarget.clear();
        targetToVar.clear();
        savedVar.forEach((v, k) => varToTarget.set(k, v));
        savedTarget.forEach((v, k) => targetToVar.set(k, v));
        return;
      }
      return;
    }

    // Multiple sibling incomings: map ALL before recursing (Cartesian product of valid assignments)
    const withCandidates = unmapped.map(([p_in, edgeType]) => ({
      p_in,
      edgeType,
      candidates: getAllIncomingWithType(ti, edgeType, tAdj, tEdgeTypeMap).filter((t) => !reverseMapping.has(t)),
    }));
    for (const { candidates } of withCandidates) {
      if (candidates.length === 0) {
        if (!addedByCaller) removeMapping(pi, ti);
        varToTarget.clear();
        targetToVar.clear();
        savedVar.forEach((v, k) => varToTarget.set(k, v));
        savedTarget.forEach((v, k) => targetToVar.set(k, v));
        return;
      }
    }

    function* tryAssignments(idx: number, used: Set<string>): Generator<{ mapping: Map<string, string>; operandMapping: Map<string, string> }> {
      if (idx === withCandidates.length) {
        for (const { p_in } of withCandidates) {
          const t_in = mapping.get(p_in)!;
          yield* fillMapIncoming(p_in, t_in, true);
        }
        return;
      }
      const { p_in, candidates } = withCandidates[idx]!;
      for (const t_in of candidates) {
        if (used.has(t_in)) continue;
        used.add(t_in);
        addMapping(p_in, t_in);
        yield* tryAssignments(idx + 1, used);
        removeMapping(p_in, t_in);
        used.delete(t_in);
      }
    }
    yield* tryAssignments(0, new Set());
  }

  const fill = useIncoming ? fillMapIncoming : fillMap;

  for (const tStart of tNodes) {
    mapping.clear();
    reverseMapping.clear();
    mappedPatternCounts.clear();
    mappedTargetCounts.clear();
    varToTarget.clear();
    targetToVar.clear();
    if (fixedOperandMapping) {
      for (const [k, v] of fixedOperandMapping) {
        varToTarget.set(k, v);
        targetToVar.set(v, k);
      }
    }

    yield* fill(pStart, tStart);
  }
}
