/**
 * VF2 subgraph isomorphism for expression DAGs with variable operand binding.
 * Pattern (rule) operands (i, m, j, etc.) match target operands (1, 2, 3) with consistent binding.
 */

import type { DAGStructure, ExprNodeData } from './types';

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
  const pOpNorm = normalizeBranchOp(pData.op);
  const tOpNorm = normalizeBranchOp(tData.op);
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

/**
 * Check if pattern DAG is isomorphic to a subgraph of target DAG, with variable binding.
 * Returns { mapping: patternNodeId -> targetNodeId, operandMapping: ruleOperand -> targetOperand } or null.
 */
export function vf2ExprSubgraphIsomorphism(
  pattern: DAGStructure<ExprNodeData>,
  target: DAGStructure<ExprNodeData>
): { mapping: Map<string, string>; operandMapping: Map<string, string> } | null {
  const pNodes = pattern.nodes.map((n) => n.id);
  const tNodes = target.nodes.map((n) => n.id);

  if (pNodes.length === 0) return { mapping: new Map(), operandMapping: new Map() };
  if (pNodes.length > tNodes.length) return null;

  const pAdj = buildAdjacency(pattern);
  const tAdj = buildAdjacency(target);

  const pNodeMap = new Map(pattern.nodes.map((n) => [n.id, n]));
  const tNodeMap = new Map(target.nodes.map((n) => [n.id, n]));

  const mapping = new Map<string, string>();
  const reverseMapping = new Map<string, string>();
  const varToTarget = new Map<string, string>();
  const targetToVar = new Map<string, string>();

  function feasible(p: string, t: string): boolean {
    const pNode = pNodeMap.get(p)!;
    const tNode = tNodeMap.get(t)!;
    const pData = pNode.data as ExprNodeData;
    const tData = tNode.data as ExprNodeData;

    const savedVar = new Map(varToTarget);
    const savedTarget = new Map(targetToVar);
    if (!exprDataMatches(pData, tData, varToTarget, targetToVar)) {
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return false;
    }

    // const pOut = pAdj.outgoing.get(p)?.size ?? 0;
    // const pIn = pAdj.incoming.get(p)?.size ?? 0;
    // const tOut = tAdj.outgoing.get(t)?.size ?? 0;
    // const tIn = tAdj.incoming.get(t)?.size ?? 0;
    // const isRoot = pIn === 0;
    // const isLeaf = pOut === 0;
    // if (isRoot && pOut !== tOut) {
    //   varToTarget.clear();
    //   targetToVar.clear();
    //   savedVar.forEach((v, k) => varToTarget.set(k, v));
    //   savedTarget.forEach((v, k) => targetToVar.set(k, v));
    //   return false;
    // }
    // if (isLeaf && pIn !== tIn) {
    //   varToTarget.clear();
    //   targetToVar.clear();
    //   savedVar.forEach((v, k) => varToTarget.set(k, v));
    //   savedTarget.forEach((v, k) => targetToVar.set(k, v));
    //   return false;
    // }
    // if (!isRoot && !isLeaf && (pOut !== tOut || pIn !== tIn)) {
    //   varToTarget.clear();
    //   targetToVar.clear();
    //   savedVar.forEach((v, k) => varToTarget.set(k, v));
    //   savedTarget.forEach((v, k) => targetToVar.set(k, v));
    //   return false;
    // }

    for (const p2 of pAdj.outgoing.get(p) ?? []) {
      if (mapping.has(p2)) {
        const t2 = mapping.get(p2)!;
        if (!tAdj.outgoing.get(t)?.has(t2)) {
          varToTarget.clear();
          targetToVar.clear();
          savedVar.forEach((v, k) => varToTarget.set(k, v));
          savedTarget.forEach((v, k) => targetToVar.set(k, v));
          return false;
        }
      }
    }
    for (const p1 of pAdj.incoming.get(p) ?? []) {
      if (mapping.has(p1)) {
        const t1 = mapping.get(p1)!;
        if (!tAdj.incoming.get(t)?.has(t1)) {
          varToTarget.clear();
          targetToVar.clear();
          savedVar.forEach((v, k) => varToTarget.set(k, v));
          savedTarget.forEach((v, k) => targetToVar.set(k, v));
          return false;
        }
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

  if (!search()) return null;

  // operandMapping: rule operand (e.g. "i", "m") -> target operand (e.g. "1", "2")
  return { mapping, operandMapping: new Map(varToTarget) };
}

/**
 * Find ALL subgraph isomorphisms. Yields { mapping, operandMapping } for each match.
 */
export function* vf2ExprSubgraphIsomorphismAll(
  pattern: DAGStructure<ExprNodeData>,
  target: DAGStructure<ExprNodeData>
): Generator<{ mapping: Map<string, string>; operandMapping: Map<string, string> }> {
  const pNodes = pattern.nodes.map((n) => n.id);
  const tNodes = target.nodes.map((n) => n.id);

  if (pNodes.length === 0) {
    yield { mapping: new Map(), operandMapping: new Map() };
    return;
  }
  if (pNodes.length > tNodes.length) return;

  const pAdj = buildAdjacency(pattern);
  const tAdj = buildAdjacency(target);
  const pNodeMap = new Map(pattern.nodes.map((n) => [n.id, n]));
  const tNodeMap = new Map(target.nodes.map((n) => [n.id, n]));

  const mapping = new Map<string, string>();
  const reverseMapping = new Map<string, string>();
  const varToTarget = new Map<string, string>();
  const targetToVar = new Map<string, string>();

  function feasible(p: string, t: string): boolean {
    const pNode = pNodeMap.get(p)!;
    const tNode = tNodeMap.get(t)!;
    const pData = pNode.data as ExprNodeData;
    const tData = tNode.data as ExprNodeData;
    const savedVar = new Map(varToTarget);
    const savedTarget = new Map(targetToVar);
    if (!exprDataMatches(pData, tData, varToTarget, targetToVar)) {
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
      return false;
    }
    for (const p2 of pAdj.outgoing.get(p) ?? []) {
      if (mapping.has(p2)) {
        const t2 = mapping.get(p2)!;
        if (!tAdj.outgoing.get(t)?.has(t2)) {
          varToTarget.clear();
          targetToVar.clear();
          savedVar.forEach((v, k) => varToTarget.set(k, v));
          savedTarget.forEach((v, k) => targetToVar.set(k, v));
          return false;
        }
      }
    }
    for (const p1 of pAdj.incoming.get(p) ?? []) {
      if (mapping.has(p1)) {
        const t1 = mapping.get(p1)!;
        if (!tAdj.incoming.get(t)?.has(t1)) {
          varToTarget.clear();
          targetToVar.clear();
          savedVar.forEach((v, k) => varToTarget.set(k, v));
          savedTarget.forEach((v, k) => targetToVar.set(k, v));
          return false;
        }
      }
    }
    return true;
  }

  function* search(): Generator<{ mapping: Map<string, string>; operandMapping: Map<string, string> }> {
    if (mapping.size === pNodes.length) {
      yield { mapping: new Map(mapping), operandMapping: new Map(varToTarget) };
      return;
    }
    const p = pNodes.find((id) => !mapping.has(id))!;
    const usedTargets = new Set(mapping.values());
    for (const t of tNodes) {
      if (usedTargets.has(t)) continue;
      const savedVar = new Map(varToTarget);
      const savedTarget = new Map(targetToVar);
      if (!feasible(p, t)) continue;
      mapping.set(p, t);
      reverseMapping.set(t, p);
      yield* search();
      mapping.delete(p);
      reverseMapping.delete(t);
      varToTarget.clear();
      targetToVar.clear();
      savedVar.forEach((v, k) => varToTarget.set(k, v));
      savedTarget.forEach((v, k) => targetToVar.set(k, v));
    }
  }

  yield* search();
}
