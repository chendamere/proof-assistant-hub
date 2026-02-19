/**
 * Tc mapping: find all candidate \Tc operand → chain mappings for a pattern DAG against a target DAG.
 * Uses the same fill logic as SingleRootDAGInjection (try every root, expand Tc chains, branch structure).
 * Collects every successful full match's Tc mapping into a global list, then trims to obtain
 * the maximal satisfiable signature per operand (merge mappings with the same key).
 */

import type { DAGStructure, DAGEdge, ExprNodeData } from './types';
import { buildAdjacency, buildEdgeTypeMap, reachableFrom } from './utils';

function normalizeBranchOp(op: string): string {
  if (/^:cond(:|$)|^:tail$/.test(op)) return op;
  const m = op.match(/^\\B[lr]?[bs](:cond(?::\S+)?|:tail)$/);
  return m ? m[1] : op;
}

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

  const pHasOe = pData.op.includes('Oe') && !pData.op.includes('nOe');
  const tHasPu = tData.op.includes('Pu') && !tData.op.includes('nPu');
  if (pHasOe && tHasPu) {
    if (pData.operands.length < 1 || tData.operands.length < 1) return false;
    return checkOrBind(pData.operands[0], tData.operands[0]);
  }
  const pHasPe = pData.op.includes('Pe') && !pData.op.includes('nPe');
  const tHasOe = tData.op.includes('Oe') && !tData.op.includes('nOe');
  if (pHasPe && tHasOe) {
    if (pData.operands.length !== tData.operands.length) return false;
    for (let i = 0; i < pData.operands.length; i++) {
      if (!checkOrBind(pData.operands[i], tData.operands[i])) return false;
    }
    return true;
  }
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

function canMatchAsRoot(pData: ExprNodeData, tData: ExprNodeData): boolean {
  if (pData.op === '\\Tc' && (pData.operands?.length ?? 0) >= 1) return true;
  return exprDataMatches(pData, tData, new Map(), new Map());
}

function getTcOperand(pData: ExprNodeData): string {
  return pData.op === '\\Tc' && (pData.operands?.length ?? 0) >= 1 && (pData.operands?.[0] ?? '') !== ''
    ? (pData.operands?.[0] ?? '')
    : '';
}

function isTailOrCond(tData: ExprNodeData): boolean {
  const op = tData.op ?? '';
  return op.endsWith(':tail') || op.includes(':cond');
}

function getOutgoingWithTypes(
  from: string,
  adj: { outgoing: Map<string, string[]> },
  edgeTypeMap: Map<string, number>
): [string, number][] {
  const outs = adj.outgoing.get(from) ?? [];
  return outs.map((to) => [to, edgeTypeMap.get(`${from}\0${to}`) ?? 0] as [string, number]);
}

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

function getIncomingWithTypes(
  to: string,
  adj: { incoming: Map<string, string[]> },
  edgeTypeMap: Map<string, number>
): [string, number][] {
  const ins = adj.incoming.get(to) ?? [];
  return ins.map((from) => [from, edgeTypeMap.get(`${from}\0${to}`) ?? 0] as [string, number]);
}

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

export interface TcMappingOptions {
  fixedOperandMapping?: Map<string, string>;
}

/**
 * Compute Tc operand → chain content mappings by running fill over the target (try every root).
 * Trimming runs after each finished fill: for same operand mapping to different chains in that fill,
 * merge to maximal satisfiable. Returns one snapshot per finished fill (one per root that produced recordings).
 */
export function computeTcMappings(
  pattern: DAGStructure<ExprNodeData>,
  target: DAGStructure<ExprNodeData>,
  options?: TcMappingOptions
): Map<string, TcChainContent[]>[] {
  const fixedOperandMapping = options?.fixedOperandMapping;

  if (pattern.nodes.length === 0 || pattern.nodes.length > target.nodes.length) {
    return [];
  }

  const pNodes = pattern.nodes.map((n) => n.id);
  const pAdj = buildAdjacency(pattern);
  const tAdj = buildAdjacency(target);
  const pEdgeTypeMap = buildEdgeTypeMap(pattern.edges);
  const tEdgeTypeMap = buildEdgeTypeMap(target.edges);
  const pNodeMap = new Map(pattern.nodes.map((n) => [n.id, n]));
  const tNodeMap = new Map(target.nodes.map((n) => [n.id, n]));

  const tcOperandToPatternNodes = new Map<string, string[]>();
  for (const n of pattern.nodes) {
    const d = (n.data ?? {}) as ExprNodeData;
    const op = getTcOperand(d);
    if (op) {
      const list = tcOperandToPatternNodes.get(op) ?? [];
      list.push(n.id);
      tcOperandToPatternNodes.set(op, list);
    }
  }
  const hasTcInPattern = tcOperandToPatternNodes.size > 0;
  if (!hasTcInPattern) return [];

  const { headCount, tailCount, tailIds } = countHeadsAndTails(pattern);
  const useIncoming = headCount < tailCount;
  const pStart = useIncoming
    ? (() => {
        const sinks = pNodes.filter((id) => (pAdj.outgoing.get(id) ?? []).length === 0);
        if (sinks.length > 0) {
          sinks.sort((a, b) => {
            const aEnd = ((pNodeMap.get(a)?.data ?? {}) as ExprNodeData & { end?: number }).end ?? 0;
            const bEnd = ((pNodeMap.get(b)?.data ?? {}) as ExprNodeData & { end?: number }).end ?? 0;
            return bEnd - aEnd;
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
    .filter((ti) => canMatchAsRoot(pStartData, (tNodeMap.get(ti)?.data ?? {}) as ExprNodeData));
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
  const tcMapping = new Map<string, string[]>();
  const varToTarget = new Map<string, string>();
  const targetToVar = new Map<string, string>();
  const mappedPatternCounts = new Map<string, number>();
  const mappedTargetCounts = new Map<string, number>();

  /** Snapshots: one per finished fill (per root). Each snapshot maps each \Tc operand to a list of unique chain variations. */
  const snapshots: Map<string, TcChainContent[]>[] = [];

  /** Candidates collected during current fill; cleared each root. */
  let fillCandidates: Map<string, string[]>[] = [];

  function chainToContent(chain: string[]): TcChainContent {
    const nodes = chain.map((nid) => {
      const d = (tNodeMap.get(nid)?.data ?? {}) as ExprNodeData;
      return { op: d.op ?? '', operands: [...(d.operands ?? [])] };
    });
    const edgeTypes: number[] = [];
    for (let i = 0; i < chain.length - 1; i++) {
      edgeTypes.push(tEdgeTypeMap.get(`${chain[i]}\0${chain[i + 1]}`) ?? 0);
    }
    return { nodes, edgeTypes };
  }

  /** Reachable from seed following only given edge types in the given direction. */
  function reachableWithEdgeTypes(
    seedId: string,
    direction: 'incoming' | 'outgoing',
    allowedTypes: number[],
    adj: { incoming: Map<string, string[]>; outgoing: Map<string, string[]> },
    edgeTypeMap: Map<string, number>
  ): Set<string> {
    const set = new Set<number>(allowedTypes);
    const result = new Set<string>();
    const frontier = [seedId];
    const visited = new Set<string>();
    while (frontier.length > 0) {
      const id = frontier.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      result.add(id);
      const neighbors = direction === 'outgoing' ? adj.outgoing.get(id) ?? [] : adj.incoming.get(id) ?? [];
      for (const n of neighbors) {
        const et = edgeTypeMap.get(`${direction === 'outgoing' ? id : n}\0${direction === 'outgoing' ? n : id}`) ?? 0;
        if (set.has(et)) frontier.push(n);
      }
    }
    return result;
  }

  /** For a cond or tail node, return all nodes in chainSet that belong to the same branch arm (cond, content, tail) so the whole arm is removed together. */
  function getBranchArmNodesInChain(nodeId: string, chainSet: Set<string>): string[] {
    const d = (tNodeMap.get(nodeId)?.data ?? {}) as ExprNodeData;
    const op = d?.op ?? '';
    const branchEdgeTypes = [1, 2, 3, 4];
    if (op.includes(':cond')) {
      const reachable = reachableWithEdgeTypes(nodeId, 'outgoing', branchEdgeTypes, tAdj, tEdgeTypeMap);
      return [...reachable].filter((id) => chainSet.has(id));
    }
    if (op.endsWith(':tail')) {
      const reachable = reachableWithEdgeTypes(nodeId, 'incoming', branchEdgeTypes, tAdj, tEdgeTypeMap);
      return [...reachable].filter((id) => chainSet.has(id));
    }
    return [nodeId];
  }

  /**
   * From a chain (left-to-right order), produce variations: full chain, then repeatedly remove leftmost;
   * if leftmost is cond/tail remove the entire branch arm (cond + all content in that arm + tail), until empty. Also add empty chain.
   * useIncoming: when true we are going right-to-left so we shrink from the left (already in left-to-right order).
   */
  function chainVariations(chainIds: string[], useIncoming: boolean): string[][] {
    const variations: string[][] = [];
    let current = [...chainIds];
    for (;;) {
      variations.push([...current]);
      if (current.length === 0) break;
      const leftmost = current[0]!;
      const toRemove = (useIncoming && isTailOrCond((tNodeMap.get(leftmost)?.data ?? {}) as ExprNodeData))
        ? getBranchArmNodesInChain(leftmost, new Set(current))
        : [leftmost];
      current = current.filter((id) => !toRemove.includes(id));
    }
    return variations;
  }

  /** Collect all unique chains per operand from fill candidates (deduplicated by content signature, no single "best"). */
  function getAllUniqueChainsPerOperand(candidates: Map<string, string[]>[]): Map<string, string[][]> {
    const result = new Map<string, string[][]>();
    const allOps = new Set<string>();
    for (const m of candidates) {
      for (const op of m.keys()) allOps.add(op);
    }
    for (const op of allOps) {
      const chainsFromCandidates = candidates.map((m) => m.get(op)).filter((c): c is string[] => !!c && c.length > 0);
      const seenSig = new Set<string>();
      const uniqueChains: string[][] = [];
      for (const chain of chainsFromCandidates) {
        const sig = chainContentSignature(chain);
        if (seenSig.has(sig)) continue;
        seenSig.add(sig);
        uniqueChains.push(chain);
      }
      if (uniqueChains.length > 0) result.set(op, uniqueChains);
    }
    return result;
  }

  function isTargetMapped(ti: string): boolean {
    if (reverseMapping.has(ti)) return true;
    for (const chain of tcMapping.values()) {
      if (chain.includes(ti)) return true;
    }
    return false;
  }

  /** Expand in one direction (incoming or outgoing type-0 edges). */
  function expandTcChainOneWay(ti: string, useIncoming: boolean): string[] {
    const chain: string[] = [ti];
    const seen = new Set(chain);
    let current = ti;
    for (;;) {
      const nextCandidates = useIncoming
        ? getAllIncomingWithType(current, 0, tAdj, tEdgeTypeMap)
        : getAllOutgoingWithType(current, 0, tAdj, tEdgeTypeMap);
      const next = nextCandidates.find((id) => !isTargetMapped(id) && !seen.has(id));
      if (!next) break;
      chain.push(next);
      seen.add(next);
      current = next;
      const tDataNext = (tNodeMap.get(next)?.data ?? {}) as ExprNodeData;
      if (isTailOrCond(tDataNext)) break;
    }
    return chain;
  }

  /** Expand Tc chain in both directions from ti so the result is direction-independent. Returns [..., left, ti, right, ...] in graph order. */
  function expandTcChain(ti: string, _useIncoming: boolean): string[] {
    const incomingPart = expandTcChainOneWay(ti, true);
    const outgoingPart = expandTcChainOneWay(ti, false);
    const seen = new Set<string>();
    const result: string[] = [];
    for (let i = incomingPart.length - 1; i >= 0; i--) {
      const id = incomingPart[i]!;
      if (!seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
    for (let i = 1; i < outgoingPart.length; i++) {
      const id = outgoingPart[i]!;
      if (!seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
    return result;
  }

  function expandChainToIncludeBranchStructure(chain: string[]): string[] {
    const exclude = new Set<string>();
    for (const id of tNodeMap.keys()) {
      if (isTargetMapped(id) && !chain.includes(id)) exclude.add(id);
    }
    let result = [...chain];
    let added = true;
    let everExpanded = false;
    while (added) {
      added = false;
      const curSet = new Set(result);
      for (const nid of result) {
        const d = (tNodeMap.get(nid)?.data ?? {}) as ExprNodeData;
        const op = d?.op ?? '';
        const e = new Set(exclude);
        for (const r of result) e.add(r);
        if (op.includes(':cond')) {
          const extra = reachableFrom([nid], tAdj, 'outgoing', e);
          for (const x of extra) {
            if (!curSet.has(x)) {
              result.push(x);
              curSet.add(x);
              added = true;
              everExpanded = true;
            }
          }
        } else if (op.endsWith(':tail')) {
          const extra = reachableFrom([nid], tAdj, 'incoming', e);
          for (const x of extra) {
            if (!curSet.has(x)) {
              result.push(x);
              curSet.add(x);
              added = true;
              everExpanded = true;
            }
          }
        }
      }
    }
    if (!everExpanded) {
      let lastCondOrTailIndex = -1;
      for (let i = result.length - 1; i >= 0; i--) {
        const op = (tNodeMap.get(result[i]!)?.data as ExprNodeData)?.op ?? '';
        if (op.includes(':cond') || op.endsWith(':tail')) {
          lastCondOrTailIndex = i;
          break;
        }
      }
      if (lastCondOrTailIndex >= 0) {
        result = result.filter((_, i) => i !== lastCondOrTailIndex);
      }
    }
    return [...new Set(result)];
  }

  function chainContentSignature(chain: string[]): string {
    const nodeSigs = chain.map((nid) => {
      const d = (tNodeMap.get(nid)?.data ?? {}) as ExprNodeData;
      const op = normalizeBranchOp(d.op ?? '');
      const ops = (d.operands ?? []).join(',');
      return `${op}|${ops}`;
    });
    const parts: string[] = [];
    for (let i = 0; i < chain.length; i++) {
      parts.push(nodeSigs[i]!);
      if (i < chain.length - 1) {
        parts.push(String(tEdgeTypeMap.get(`${chain[i]}\0${chain[i + 1]}`) ?? 0));
      }
    }
    return parts.join(';');
  }

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
  function addTcMapping(tcOp: string, pi: string, chain: string[]): void {
    tcMapping.set(tcOp, chain);
    mapping.set(pi, chain[0]!);
    reverseMapping.set(chain[0]!, pi);
    const pk = patternKey(pi);
    mappedPatternCounts.set(pk, (mappedPatternCounts.get(pk) ?? 0) + 1);
    for (const ti of chain) {
      const tk = targetKey(ti);
      mappedTargetCounts.set(tk, (mappedTargetCounts.get(tk) ?? 0) + 1);
    }
  }
  function removeTcMapping(tcOp: string): void {
    const chain = tcMapping.get(tcOp)!;
    tcMapping.delete(tcOp);
    for (const [mPi, mTi] of [...mapping]) {
      if (chain.includes(mTi)) {
        mapping.delete(mPi);
        reverseMapping.delete(mTi);
        const pk = patternKey(mPi);
        mappedPatternCounts.set(pk, (mappedPatternCounts.get(pk) ?? 0) - 1);
      }
    }
    for (const ti of chain) {
      const tk = targetKey(ti);
      mappedTargetCounts.set(tk, (mappedTargetCounts.get(tk) ?? 0) - 1);
    }
  }
  function addTcSecondaryMapping(pi: string, ti: string): void {
    mapping.set(pi, ti);
    reverseMapping.set(ti, pi);
    const pk = patternKey(pi);
    mappedPatternCounts.set(pk, (mappedPatternCounts.get(pk) ?? 0) + 1);
  }

  function getTotalMappedTargetCount(): number {
    const s = new Set<string>();
    for (const ti of reverseMapping.keys()) s.add(ti);
    for (const chain of tcMapping.values()) {
      for (const ti of chain) s.add(ti);
    }
    return s.size;
  }

  function canExtend(): boolean {
    const unmappedP = pNodes.length - mapping.size;
    const unmappedT = tNodeMap.size - getTotalMappedTargetCount();
    if (unmappedP > unmappedT) return false;
    for (const [k, c] of patternCountsTotal) {
      if (k.startsWith('\\Tc')) continue;
      const remP = c - (mappedPatternCounts.get(k) ?? 0);
      const remT = (targetCountsTotal.get(k) ?? 0) - (mappedTargetCounts.get(k) ?? 0);
      if (remP > remT) return false;
    }
    return true;
  }

  /** Record current Tc mapping to global list (full match). */
  function collectOnComplete(): void {
    recordTcMappingSnapshot();
  }

  /** Record current Tc mapping for current fill. Call whenever we assign or merge a chain for a \Tc operand, even if injection later fails. */
  function recordTcMappingSnapshot(): void {
    const copy = new Map<string, string[]>();
    for (const [op, chain] of tcMapping) {
      copy.set(op, [...chain]);
    }
    fillCandidates.push(copy);
  }

  function* fillMap(pi: string, ti: string): Generator<void> {
    const pData = (pNodeMap.get(pi)?.data ?? {}) as ExprNodeData;
    const tData = (tNodeMap.get(ti)?.data ?? {}) as ExprNodeData;
    const savedVar = new Map(varToTarget);
    const savedTarget = new Map(targetToVar);
    const tcOp = getTcOperand(pData);

    if (tcOp) {
      if (!tcMapping.has(tcOp) || tcMapping.get(tcOp)!.length === 0) {
        let chain = expandTcChain(ti, useIncoming);
        chain = expandChainToIncludeBranchStructure(chain);
        addTcMapping(tcOp, pi, chain);
        recordTcMappingSnapshot();
      } else {
        const chain = tcMapping.get(tcOp)!;
        let newChain = expandTcChain(ti, useIncoming);
        newChain = expandChainToIncludeBranchStructure(newChain);
        const existingContent = chainContentSignature(chain);
        const newContent = chainContentSignature(newChain);
        if (chain.length === 0 || existingContent !== newContent) {
          varToTarget.clear();
          targetToVar.clear();
          savedVar.forEach((v, k) => varToTarget.set(k, v));
          savedTarget.forEach((v, k) => targetToVar.set(k, v));
          return;
        }
        const merged: string[] = [...chain];
        for (const id of newChain) {
          if (!merged.includes(id)) merged.push(id);
        }
        const primaryPi = tcOperandToPatternNodes.get(tcOp)![0]!;
        removeTcMapping(tcOp);
        addTcMapping(tcOp, primaryPi, merged);
        addTcSecondaryMapping(pi, ti);
        recordTcMappingSnapshot();
      }
    } else {
      if (!exprDataMatches(pData, tData, varToTarget, targetToVar, fixedOperandMapping)) {
        varToTarget.clear();
        targetToVar.clear();
        savedVar.forEach((v, k) => varToTarget.set(k, v));
        savedTarget.forEach((v, k) => targetToVar.set(k, v));
        return;
      }
      addMapping(pi, ti);
    }

    if (mapping.size === pNodes.length) {
      collectOnComplete();
      if (tcOp) removeTcMapping(tcOp);
      else removeMapping(pi, ti);
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return;
    }
    if (!canExtend()) {
      if (tcOp) removeTcMapping(tcOp);
      else removeMapping(pi, ti);
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return;
    }

    const tiTip = tcOp ? tcMapping.get(tcOp)!.slice(-1)[0]! : ti;
    const pOutgoing = getOutgoingWithTypes(pi, pAdj, pEdgeTypeMap);
    for (const [p_out, edgeType] of pOutgoing) {
      const tOutCandidates = getAllOutgoingWithType(tiTip, edgeType, tAdj, tEdgeTypeMap);
      if (mapping.has(p_out)) {
        const t_out = mapping.get(p_out)!;
        if (!tOutCandidates.includes(t_out)) {
          if (tcOp) removeTcMapping(tcOp);
          else removeMapping(pi, ti);
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
        if (isTargetMapped(t_out)) continue;
        hadCandidates = true;
        const prev = mapping.get(p_out);
        if (prev != null) removeMapping(p_out, prev);
        yield* fillMap(p_out, t_out);
      }
      if (!hadCandidates) {
        if (tcOp) removeTcMapping(tcOp);
        else removeMapping(pi, ti);
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
  ): Generator<void> {
    const pData = (pNodeMap.get(pi)?.data ?? {}) as ExprNodeData;
    const tData = (tNodeMap.get(ti)?.data ?? {}) as ExprNodeData;
    const savedVar = new Map(varToTarget);
    const savedTarget = new Map(targetToVar);
    const tcOp = getTcOperand(pData);

    if (tcOp) {
      if (!tcMapping.has(tcOp) || tcMapping.get(tcOp)!.length === 0) {
        let chain = expandTcChain(ti, useIncoming);
        chain = expandChainToIncludeBranchStructure(chain);
        if (addedByCaller) {
          removeMapping(pi, ti);
          addTcMapping(tcOp, pi, chain);
        } else {
          addTcMapping(tcOp, pi, chain);
        }
        recordTcMappingSnapshot();
      } else {
        const chain = tcMapping.get(tcOp)!;
        let newChain = expandTcChain(ti, useIncoming);
        newChain = expandChainToIncludeBranchStructure(newChain);
        const existingContent = chainContentSignature(chain);
        const newContent = chainContentSignature(newChain);
        if (chain.length === 0 || existingContent !== newContent) {
          removeTcMapping(tcOp);
          varToTarget.clear();
          targetToVar.clear();
          savedVar.forEach((v, k) => varToTarget.set(k, v));
          savedTarget.forEach((v, k) => targetToVar.set(k, v));
          return;
        }
        const merged: string[] = [...chain];
        for (const id of newChain) {
          if (!merged.includes(id)) merged.push(id);
        }
        const primaryPi = tcOperandToPatternNodes.get(tcOp)![0]!;
        removeTcMapping(tcOp);
        if (addedByCaller) removeMapping(pi, ti);
        addTcMapping(tcOp, primaryPi, merged);
        addTcSecondaryMapping(pi, ti);
        recordTcMappingSnapshot();
      }
    } else {
      if (!exprDataMatches(pData, tData, varToTarget, targetToVar, fixedOperandMapping)) {
        varToTarget.clear();
        targetToVar.clear();
        savedVar.forEach((v, k) => varToTarget.set(k, v));
        savedTarget.forEach((v, k) => targetToVar.set(k, v));
        return;
      }
      if (!addedByCaller) addMapping(pi, ti);
    }

    if (mapping.size === pNodes.length) {
      collectOnComplete();
      if (!addedByCaller) {
        if (tcOp) removeTcMapping(tcOp);
        else removeMapping(pi, ti);
      }
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return;
    }
    if (!canExtend()) {
      if (!addedByCaller) {
        if (tcOp) removeTcMapping(tcOp);
        else removeMapping(pi, ti);
      }
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return;
    }

    const tiTip = tcOp ? tcMapping.get(tcOp)![0]! : ti;
    const pIncoming = getIncomingWithTypes(pi, pAdj, pEdgeTypeMap);
    for (const [p_in, edgeType] of pIncoming) {
      if (!mapping.has(p_in)) continue;
      const t_in = mapping.get(p_in)!;
      const tInCandidates = getAllIncomingWithType(tiTip, edgeType, tAdj, tEdgeTypeMap);
      if (!tInCandidates.includes(t_in)) {
        if (!addedByCaller) {
          if (tcOp) removeTcMapping(tcOp);
          else removeMapping(pi, ti);
        }
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
      const tInCands = getAllIncomingWithType(tiTip, edgeType, tAdj, tEdgeTypeMap);
      let hadCandidates = false;
      for (const t_in of tInCands) {
        if (isTargetMapped(t_in)) continue;
        hadCandidates = true;
        const prev = mapping.get(p_in);
        if (prev != null) removeMapping(p_in, prev);
        yield* fillMapIncoming(p_in, t_in);
      }
      if (!hadCandidates && !addedByCaller) {
        if (tcOp) removeTcMapping(tcOp);
        else removeMapping(pi, ti);
      }
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return;
    }

    const withCandidates = unmapped.map(([p_in, edgeType]) => ({
      p_in,
      edgeType,
      candidates: getAllIncomingWithType(tiTip, edgeType, tAdj, tEdgeTypeMap).filter((t) => !isTargetMapped(t)),
    }));
    for (const { candidates } of withCandidates) {
      if (candidates.length === 0) {
        if (!addedByCaller) {
          if (tcOp) removeTcMapping(tcOp);
          else removeMapping(pi, ti);
        }
        varToTarget.clear();
        targetToVar.clear();
        savedVar.forEach((v, k) => varToTarget.set(k, v));
        savedTarget.forEach((v, k) => targetToVar.set(k, v));
        return;
      }
    }

    function* tryAssignments(idx: number, used: Set<string>): Generator<void> {
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
    varToTarget.clear();
    targetToVar.clear();
    savedVar.forEach((v, k) => varToTarget.set(k, v));
    savedTarget.forEach((v, k) => targetToVar.set(k, v));
  }

  const fill = useIncoming ? fillMapIncoming : fillMap;

  for (const tStart of tNodes) {
    mapping.clear();
    reverseMapping.clear();
    tcMapping.clear();
    mappedPatternCounts.clear();
    mappedTargetCounts.clear();
    varToTarget.clear();
    targetToVar.clear();
    fillCandidates = [];
    if (fixedOperandMapping) {
      for (const [k, v] of fixedOperandMapping) {
        varToTarget.set(k, v);
        targetToVar.set(v, k);
      }
    }
    const gen = fill(pStart, tStart);
    while (!gen.next().done) {
      /* drain to collect all recordings for this fill */
    }
    const allChainsPerOp = getAllUniqueChainsPerOperand(fillCandidates);
    if (allChainsPerOp.size === 0) continue;
    const variationMap = new Map<string, TcChainContent[]>();
    for (const [op, chainIdsList] of allChainsPerOp) {
      const seenSig = new Set<string>();
      const uniqueContents: TcChainContent[] = [];
      for (const chainIds of chainIdsList) {
        const varChains = chainVariations(chainIds, useIncoming);
        for (const chain of varChains) {
          const sig = chainContentSignature(chain);
          if (seenSig.has(sig)) continue;
          seenSig.add(sig);
          uniqueContents.push(chainToContent(chain));
        }
      }
      variationMap.set(op, uniqueContents);
    }
    snapshots.push(variationMap);
  }

  return snapshots;
}

/** Content chain: nodes and edge types between consecutive nodes. Portable, no node IDs. */
export interface TcChainContent {
  nodes: ExprNodeData[];
  /** edgeTypes[i] = edge type from nodes[i] to nodes[i+1]; length = max(0, nodes.length - 1). */
  edgeTypes: number[];
}

/** Yield each choice of one chain per operand from a snapshot (Map<op, list of chains>). */
export function* eachTcMappingChoice(
  snapshot: Map<string, TcChainContent[]>
): Generator<Map<string, TcChainContent>> {
  const ops = [...snapshot.keys()];
  if (ops.length === 0) {
    yield new Map();
    return;
  }
  function* rec(idx: number, chosen: Map<string, TcChainContent>): Generator<Map<string, TcChainContent>> {
    if (idx === ops.length) {
      yield new Map(chosen);
      return;
    }
    const op = ops[idx]!;
    const list = snapshot.get(op) ?? [];
    for (const chain of list) {
      chosen.set(op, chain);
      yield* rec(idx + 1, chosen);
    }
  }
  yield* rec(0, new Map());
}

/** True if the pattern DAG contains any node with op \Tc and a non-empty operand. */
export function hasTcInPattern(pattern: DAGStructure<ExprNodeData>): boolean {
  for (const n of pattern.nodes) {
    const d = (n.data ?? {}) as ExprNodeData;
    if (getTcOperand(d)) return true;
  }
  return false;
}

/**
 * Build a DAG that replaces every \Tc node in the pattern with a copy of the chain for that operand.
 * Uses content (op, operands) per node. Chain nodes get ids like tc_${operand}_${index};
 * edges between consecutive chain nodes use type 0 (chain).
 */
export function buildPatternWithTcChains(
  pattern: DAGStructure<ExprNodeData>,
  tcMapping: Map<string, TcChainContent>
): DAGStructure<ExprNodeData> {
  const patternNodeToTcOp = new Map<string, string>();
  for (const n of pattern.nodes) {
    const d = (n.data ?? {}) as ExprNodeData;
    const op = getTcOperand(d);
    if (op) patternNodeToTcOp.set(n.id, op);
  }

  const nodes: { id: string; data?: ExprNodeData }[] = [];
  const edges: DAGEdge[] = [];
  /** Pattern node id -> { entry id, exit id } so each \Tc pattern node gets its own chain copy. */
  const tcEntryExitByPatternNode = new Map<string, { entry: string; exit: string }>();

  const sanitize = (s: string) => s.replace(/\s+/g, '_');

  for (const n of pattern.nodes) {
    const op = patternNodeToTcOp.get(n.id);
    if (op) {
      const chain = tcMapping.get(op);
      if (!chain || chain.nodes.length === 0) continue;
      const prefix = `tc_${sanitize(op)}_${sanitize(n.id)}`;
      const entryId = `${prefix}_0`;
      const exitId = `${prefix}_${chain.nodes.length - 1}`;
      tcEntryExitByPatternNode.set(n.id, { entry: entryId, exit: exitId });
      for (let i = 0; i < chain.nodes.length; i++) {
        const content = chain.nodes[i]!;
        nodes.push({ id: `${prefix}_${i}`, data: { ...content } });
      }
      continue;
    }
    nodes.push({ id: n.id, data: { ...(n.data as ExprNodeData) } });
  }

  for (const n of pattern.nodes) {
    const op = patternNodeToTcOp.get(n.id);
    if (!op) continue;
    const chain = tcMapping.get(op);
    if (!chain || chain.nodes.length === 0) continue;
    const prefix = `tc_${sanitize(op)}_${sanitize(n.id)}`;
    for (let i = 0; i < chain.nodes.length - 1; i++) {
      const et = (chain.edgeTypes[i] ?? 0) as 0 | 1 | 2 | 3 | 4;
      edges.push({
        from: `${prefix}_${i}`,
        to: `${prefix}_${i + 1}`,
        edgeType: et,
      });
    }
  }

  for (const e of pattern.edges) {
    const fromTc = patternNodeToTcOp.get(e.from);
    const toTc = patternNodeToTcOp.get(e.to);
    if (!fromTc && !toTc) {
      edges.push({
        from: e.from,
        to: e.to,
        edgeType: (e.edgeType ?? 0) as 0 | 1 | 2 | 3 | 4,
      });
      continue;
    }
    if (fromTc && toTc) {
      if (fromTc === toTc && e.from === e.to) continue;
      const exit = tcEntryExitByPatternNode.get(e.from)?.exit;
      const entry = tcEntryExitByPatternNode.get(e.to)?.entry;
      if (exit && entry) edges.push({ from: exit, to: entry, edgeType: (e.edgeType ?? 0) as 0 | 1 | 2 | 3 | 4 });
      continue;
    }
    if (fromTc) {
      const exit = tcEntryExitByPatternNode.get(e.from)?.exit;
      if (exit) edges.push({ from: exit, to: e.to, edgeType: (e.edgeType ?? 0) as 0 | 1 | 2 | 3 | 4 });
      continue;
    }
    const entry = tcEntryExitByPatternNode.get(e.to!)?.entry;
    if (entry) edges.push({ from: e.from, to: entry, edgeType: (e.edgeType ?? 0) as 0 | 1 | 2 | 3 | 4 });
  }

  return { nodes, edges };
}
