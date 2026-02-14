/**
 * VF2 subgraph isomorphism for expression DAGs with variable operand binding.
 * Pattern (rule) operands (i, m, j, etc.) match target operands (1, 2, 3) with consistent binding.
 */

import type { DAGStructure, ExprNodeData } from './types';
import { buildAdjacency, buildEdgeTypeMap, augmentTargetDAGForTcMatching, addTcShortcutEdges } from './utils';

/**
 * Normalize branch structural op for comparison.
 * Branch nodes use :cond or :tail (no Bb/Blb/Brb prefix in node data).
 */
function normalizeBranchOp(op: string): string {
  if (/^:cond(:|$)|^:tail$/.test(op)) return op;
  const m = op.match(/^\\B[lr]?b(:cond(?::\S+)?|:tail)$/);
  return m ? m[1] : op;
}

/** Pattern operands bind to target operands. One-to-one: each rule operand -> unique target operand, each target operand -> at most one rule operand. */
function exprDataMatches(
  pData: ExprNodeData,
  tData: ExprNodeData,
  varToTarget: Map<string, string>,
  targetToVar: Map<string, string>
): boolean {
  // \Tc matches any target node; Tc operands map to sequences of operations in substitution, not to varToTarget
  if (pData.op === '\\Tc') {
    if (pData.operands.length !== 1) return false;
    return true;
  }

  // \Oe (equals) compatible with \Pu (defined): only first operand must match
  // Pattern i \Oe j can match target i \Pu (i defined implies i \Oe i)
  const pHasOe = pData.op.includes('Oe') && !pData.op.includes('nOe');
  const tHasPu = tData.op.includes('Pu') && !tData.op.includes('nPu');
  if (pHasOe && tHasPu) {
    if (pData.operands.length < 1 || tData.operands.length < 1) return false;
    const pOp = pData.operands[0];
    const tOp = tData.operands[0];
    if (varToTarget.has(pOp)) {
      if (varToTarget.get(pOp) !== tOp) return false;
    } else {
      if (targetToVar.has(tOp) && targetToVar.get(tOp) !== pOp) return false;
      varToTarget.set(pOp, tOp);
      targetToVar.set(tOp, pOp);
    }
    return true;
  }

  const pOpNorm = normalizeBranchOp(pData.op);
  const tOpNorm = normalizeBranchOp(tData.op);
  // if (!tData.op.includes('\\Bb') && !tData.op.includes('\\Bs') && (pData.op.includes('\\Bb')|| pData.op.includes('\\Bs'))) return false;
  if (pOpNorm !== tOpNorm) return false;
  if (pData.operands.length !== tData.operands.length) return false;

  for (let i = 0; i < pData.operands.length; i++) {
    const pOp = pData.operands[i];
    const tOp = tData.operands[i];
    if (varToTarget.has(pOp)) {
      if (varToTarget.get(pOp) !== tOp) return false;
    } else {
      if (targetToVar.has(tOp) && targetToVar.get(tOp) !== pOp) return false;
      varToTarget.set(pOp, tOp);
      targetToVar.set(tOp, pOp);
    }
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
  if (pattern.nodes.length === 0) {
    yield { mapping: new Map(), operandMapping: new Map() };
    return;
  }
  if (pattern.nodes.length > target.nodes.length) {
    target = augmentTargetDAGForTcMatching(target);
  }
  if (pattern.nodes.length > target.nodes.length) return;

  // When pattern has \Tc, add shortcut edges so pattern \Tc matches target ", \Os j, \Tc c_1," etc.
  const patternHasTc = pattern.nodes.some((n) => (n.data as ExprNodeData)?.op === '\\Tc');
  if (patternHasTc) {
    target = addTcShortcutEdges(target) as DAGStructure<ExprNodeData>;
  }

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

  const patternKey = (id: string): string | null => {
    const d = (pNodeMap.get(id)?.data ?? {}) as ExprNodeData;
    if (d.op === '\\Tc') return null;
    return `${normalizeBranchOp(d.op)}:${d.operands?.length ?? 0}`;
  };
  const targetKey = (id: string): string => {
    const d = (tNodeMap.get(id)?.data ?? {}) as ExprNodeData;
    return `${normalizeBranchOp(d.op)}:${d.operands?.length ?? 0}`;
  };
  const patternCountsTotal = new Map<string, number>();
  const targetCountsTotal = new Map<string, number>();
  for (const id of pNodes) {
    const k = patternKey(id);
    if (k === null) continue;
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
    if (pk !== null) mappedPatternCounts.set(pk, (mappedPatternCounts.get(pk) ?? 0) - 1);
    mappedTargetCounts.set(tk, (mappedTargetCounts.get(tk) ?? 0) - 1);
  }
  function addMapping(pi: string, ti: string): void {
    mapping.set(pi, ti);
    reverseMapping.set(ti, pi);
    const pk = patternKey(pi);
    const tk = targetKey(ti);
    if (pk !== null) mappedPatternCounts.set(pk, (mappedPatternCounts.get(pk) ?? 0) + 1);
    mappedTargetCounts.set(tk, (mappedTargetCounts.get(tk) ?? 0) + 1);
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

  function fillMap(pi: string, ti: string): boolean {
    const pData = (pNodeMap.get(pi)?.data ?? {}) as ExprNodeData;
    const tData = (tNodeMap.get(ti)?.data ?? {}) as ExprNodeData;
    const savedVar = new Map(varToTarget);
    const savedTarget = new Map(targetToVar);

    if (!exprDataMatches(pData, tData, varToTarget, targetToVar)) {
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return false;
    }

    addMapping(pi, ti);

    if (mapping.size === pNodes.length) return true;
    if (!canExtend()) {
      removeMapping(pi, ti);
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return false;
    }

    const pOutgoing = getOutgoingWithTypes(pi, pAdj, pEdgeTypeMap);
    for (const [p_out, edgeType] of pOutgoing) {
      const t_out = findOutgoingWithType(ti, edgeType, tAdj, tEdgeTypeMap);
      if (!t_out) {
        removeMapping(pi, ti);
        varToTarget.clear();
        targetToVar.clear();
        savedVar.forEach((v, k) => varToTarget.set(k, v));
        savedTarget.forEach((v, k) => targetToVar.set(k, v));
        return false;
      }
      if (mapping.has(p_out)) {
        if (mapping.get(p_out) !== t_out) {
          removeMapping(pi, ti);
          varToTarget.clear();
          targetToVar.clear();
          savedVar.forEach((v, k) => varToTarget.set(k, v));
          savedTarget.forEach((v, k) => targetToVar.set(k, v));
          return false;
        }
        continue;
      }
      if (reverseMapping.has(t_out)) {
        removeMapping(pi, ti);
        varToTarget.clear();
        targetToVar.clear();
        savedVar.forEach((v, k) => varToTarget.set(k, v));
        savedTarget.forEach((v, k) => targetToVar.set(k, v));
        return false;
      }
      if (!fillMap(p_out, t_out)) {
        removeMapping(pi, ti);
        varToTarget.clear();
        targetToVar.clear();
        savedVar.forEach((v, k) => varToTarget.set(k, v));
        savedTarget.forEach((v, k) => targetToVar.set(k, v));
        return false;
      }
    }
    return true;
  }

  function fillMapIncoming(pi: string, ti: string): boolean {
    const pData = (pNodeMap.get(pi)?.data ?? {}) as ExprNodeData;
    const tData = (tNodeMap.get(ti)?.data ?? {}) as ExprNodeData;
    const savedVar = new Map(varToTarget);
    const savedTarget = new Map(targetToVar);

    if (!exprDataMatches(pData, tData, varToTarget, targetToVar)) {
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return false;
    }

    addMapping(pi, ti);

    if (mapping.size === pNodes.length) return true;
    if (!canExtend()) {
      removeMapping(pi, ti);
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return false;
    }

    const pIncoming = getIncomingWithTypes(pi, pAdj, pEdgeTypeMap);
    for (const [p_in, edgeType] of pIncoming) {
      const t_in = findIncomingWithType(ti, edgeType, tAdj, tEdgeTypeMap);
      if (!t_in) {
        removeMapping(pi, ti);
        varToTarget.clear();
        targetToVar.clear();
        savedVar.forEach((v, k) => varToTarget.set(k, v));
        savedTarget.forEach((v, k) => targetToVar.set(k, v));
        return false;
      }
      if (mapping.has(p_in)) {
        if (mapping.get(p_in) !== t_in) {
          removeMapping(pi, ti);
          varToTarget.clear();
          targetToVar.clear();
          savedVar.forEach((v, k) => varToTarget.set(k, v));
          savedTarget.forEach((v, k) => targetToVar.set(k, v));
          return false;
        }
        continue;
      }
      if (reverseMapping.has(t_in)) {
        removeMapping(pi, ti);
        varToTarget.clear();
        targetToVar.clear();
        savedVar.forEach((v, k) => varToTarget.set(k, v));
        savedTarget.forEach((v, k) => targetToVar.set(k, v));
        return false;
      }
      if (!fillMapIncoming(p_in, t_in)) {
        removeMapping(pi, ti);
        varToTarget.clear();
        targetToVar.clear();
        savedVar.forEach((v, k) => varToTarget.set(k, v));
        savedTarget.forEach((v, k) => targetToVar.set(k, v));
        return false;
      }
    }
    return true;
  }

  const fill = useIncoming ? fillMapIncoming : fillMap;

  for (const tStart of tNodes) {
    mapping.clear();
    reverseMapping.clear();
    mappedPatternCounts.clear();
    mappedTargetCounts.clear();
    varToTarget.clear();
    targetToVar.clear();

    if (fill(pStart, tStart) && mapping.size === pNodes.length) {
      yield { mapping: new Map(mapping), operandMapping: new Map(varToTarget) };
    }
  }
}
