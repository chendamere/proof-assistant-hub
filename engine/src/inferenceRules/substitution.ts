/**
 * Substitution logic for inference rules
 * Uses DAG injection (VF2) for rule applicability after operand normalization.
 * A single VF2 pass on the full target finds the match and operand mapping.
 */

import type { DAGStructure, ExprNodeData } from '../dag';
import { MatchPosition } from './types';
import { normalizeSpacing, ensureCommaWrapped, oeToPeInExpression, peToOeInExpression } from './utils';
import type { TcChainContent } from '../dag';
import { exprToDAG, dagToExpr, SingleRootDAGInjection, hasTcInPattern, computeTcMappings, buildPatternWithTcChains, eachTcMappingChoice } from '../dag';

function chainEdgeKey(e: { from: number; to: number; edgeType: number }): string {
  return `${e.from}\t${e.to}\t${e.edgeType}`;
}

function chainContentEqual(a: TcChainContent, b: TcChainContent): boolean {
  if (a.nodes.length !== b.nodes.length) return false;
  if ((a.entry ?? 0) !== (b.entry ?? 0) || (a.exit ?? a.nodes.length - 1) !== (b.exit ?? b.nodes.length - 1)) return false;
  for (let i = 0; i < a.nodes.length; i++) {
    const x = a.nodes[i]!;
    const y = b.nodes[i]!;
    if ((x.op ?? '') !== (y.op ?? '')) return false;
    if ((x.operands ?? []).join(',') !== (y.operands ?? []).join(',')) return false;
    if ((x.branchKind ?? '') !== (y.branchKind ?? '')) return false;
  }
  const aEdges = a.edges ?? a.edgeTypes.map((edgeType, i) => ({ from: i, to: i + 1, edgeType }));
  const bEdges = b.edges ?? b.edgeTypes.map((edgeType, i) => ({ from: i, to: i + 1, edgeType }));
  if (aEdges.length !== bEdges.length) return false;
  const bSet = new Set(bEdges.map(chainEdgeKey));
  return aEdges.every((e) => bSet.has(chainEdgeKey(e)));
}

/** Fixed is a single choice (one chain per op). Snapshot has list of chains per op; we need at least one choice in snapshot that equals fixed. */
function tcChainContentMatches(
  snapshot: Map<string, TcChainContent[]>,
  fixed: Map<string, TcChainContent>
): boolean {
  for (const [op, fixedChain] of fixed) {
    const list = snapshot.get(op);
    if (!list) return false;
    const found = list.some((snapChain) => chainContentEqual(snapChain, fixedChain));
    if (!found) return false;
  }
  return true;
}

function tcChainContentToDisplayRecord(m: Map<string, TcChainContent>): Record<string, string[]> {
  const r: Record<string, string[]> = {};
  for (const [op, chain] of m) {
    if ((chain.edges?.length ?? 0) > 0) {
      const dag: DAGStructure<ExprNodeData> = {
        nodes: chain.nodes.map((data, i) => ({ id: `n${i}`, data })),
        edges: chain.edges!.map((e) => ({
          from: `n${e.from}`,
          to: `n${e.to}`,
          edgeType: e.edgeType as 0 | 1 | 2 | 3 | 4,
        })),
      };
      r[op] = [dagToExpr(dag)];
      continue;
    }
    r[op] = chain.nodes.map((d) => {
      if (d.op?.endsWith(':tail')) return ':tail';
      if (d.op?.includes(':cond')) return d.op ?? '';
      return `${d.op ?? ''} ${(d.operands ?? []).join(' ')}`.trim();
    });
  }
  return r;
}


/** Single match from injection: position, root target node id, and boundary signature for pairing. */
export interface SubstitutionMatch {
  position: MatchPosition;
  rootTargetNodeId: string;
  /** Boundary signature: sorted (direction, edgeType) for edges not in pattern that connect match to rest of target. Empty = no additional edges. */
  boundarySignature: string;
}

/** Node signature string for one node (op|operands). */
function nodeSignature(d: ExprNodeData | undefined): string {
  const op = d?.op ?? '';
  const operands = d?.operands ?? [];
  return `${op}|${operands.join(',')}`;
}

/** Build canonical signature list for unmatched target nodes (op + operands, no mapping). */
function getUnmatchedNodeSignatures(
  targetDAG: DAGStructure<ExprNodeData>,
  matchedIds: Set<string>
): string[] {
  const sigs: string[] = [];
  for (const n of targetDAG.nodes) {
    if (matchedIds.has(n.id)) continue;
    const d = n.data as ExprNodeData | undefined;
    sigs.push(nodeSignature(d));
  }
  sigs.sort();
  return sigs;
}

/** Build id -> nodeSig for unmatched nodes (for edge signature). */
function getUnmatchedIdToSig(
  targetDAG: DAGStructure<ExprNodeData>,
  matchedIds: Set<string>
): Map<string, string> {
  const idToSig = new Map<string, string>();
  for (const n of targetDAG.nodes) {
    if (matchedIds.has(n.id)) continue;
    const d = n.data as ExprNodeData | undefined;
    if ((d?.op ?? '') === '\\Tc' && (d?.operands?.length ?? 0) === 1 && (d?.operands?.[0] ?? '') === '') continue;
    idToSig.set(n.id, nodeSignature(d));
  }
  return idToSig;
}

/** Canonical signature for edges between unmatched nodes (induced subgraph). Same nodes but different edges then differ. */
function getUnmatchedEdgeSignature(
  targetDAG: DAGStructure<ExprNodeData>,
  matchedIds: Set<string>,
  idToSig: Map<string, string>
): string {
  const parts: string[] = [];
  for (const e of targetDAG.edges) {
    if (matchedIds.has(e.from) || matchedIds.has(e.to)) continue;
    const fromSig = idToSig.get(e.from);
    const toSig = idToSig.get(e.to);
    if (fromSig === undefined || toSig === undefined) continue;
    const et = (e.edgeType ?? 0) as number;
    parts.push(`${fromSig}\t${toSig}\t${et}`);
  }
  parts.sort();
  return parts.join(';');
}

/** Match from DAG injection for pairing: unmatched node signatures, edge signature, side, operand mapping, and DAG data. */
export interface InjectionMatchForPairing {
  unmatchedNodeSignatures: string[];
  /** Canonical signature of edges between unmatched nodes (induced subgraph); ensures pairing requires same structure. */
  unmatchedEdgeSignature: string;
  /** Pattern operand -> target value (operand string or Tc expression key). Portable across DAGs for use as fixedOperandMapping. */
  operandMapping: Map<string, string>;
  /** Tc operand names (e.g. "c" for \\Tc c); excluded from operandMappingsConsistent since they use node IDs per DAG. */
  tcOperandKeys?: Set<string>;
  /** Tc operand -> chain content (op, operands per node) for display. Values are expression strings per node. */
  tcMapping?: Record<string, string[]>;
  /** Tc operand -> chain content; used as fixedTcMapping when finding the other side. */
  tcMappingContent?: Map<string, TcChainContent>;
  side: 'left' | 'right';
  targetDAG: DAGStructure<ExprNodeData>;
  nodeMapping: Map<string, string>;
}

export interface FindInjectionMatchesOptions {
  /** Use these operand bindings as fixed constraints; only accept matches consistent with them. */
  fixedOperandMapping?: Map<string, string>;
  /** Use this Tc mapping from the other side; only accept snapshots whose content matches. */
  fixedTcMapping?: Map<string, TcChainContent>;
}

/**
 * Find injection matches for pairing. DAG injection only; no indices, no string comparison,
 * no prefix/suffix, no boundary. Returns each match with its unmatched target node signatures
 * and operand mapping. When fixedOperandMapping is provided, trims candidates to those consistent with it.
 */
export function findInjectionMatchesForPairing(
  target: string,
  pattern: string,
  side: 'left' | 'right',
  options?: FindInjectionMatchesOptions
): InjectionMatchForPairing[] {
  const normalizedTarget = normalizeSpacing(target);
  const normalizedPattern = normalizeSpacing(pattern);
  const patternDAG = exprToDAG(normalizedPattern);
  const targetDAG = exprToDAG(normalizedTarget);

  if (patternDAG.nodes.length > targetDAG.nodes.length) return [];

  // Empty pattern (e.g. rule side ","): match nothing, so all target nodes are unmatched.
  if (patternDAG.nodes.length === 0) {
    const matchedIds = new Set<string>();
    const unmatchedNodeSignatures = getUnmatchedNodeSignatures(targetDAG, matchedIds);
    const idToSig = getUnmatchedIdToSig(targetDAG, matchedIds);
    const unmatchedEdgeSignature = getUnmatchedEdgeSignature(targetDAG, matchedIds, idToSig);
    return [{
      unmatchedNodeSignatures,
      unmatchedEdgeSignature,
      operandMapping: new Map(),
      side,
      targetDAG,
      nodeMapping: new Map(),
    }];
  }

  const matches: InjectionMatchForPairing[] = [];

  if (hasTcInPattern(patternDAG)) {
    const fixedTcMapping = options?.fixedTcMapping;
    if (fixedTcMapping) {
      // Use the provided mapping as the only choice (e.g. when pairing right with left).
      for (const tcMappingResult of [fixedTcMapping]) {
        const convertedPattern = buildPatternWithTcChains(patternDAG, tcMappingResult);
        for (const result of SingleRootDAGInjection(convertedPattern, targetDAG, {
          fixedOperandMapping: options?.fixedOperandMapping,
        })) {
          const matchedIds = new Set(result.mapping.values());
          const unmatchedNodeSignatures = getUnmatchedNodeSignatures(targetDAG, matchedIds);
          const idToSig = getUnmatchedIdToSig(targetDAG, matchedIds);
          const unmatchedEdgeSignature = getUnmatchedEdgeSignature(targetDAG, matchedIds, idToSig);
          matches.push({
            unmatchedNodeSignatures,
            unmatchedEdgeSignature,
            operandMapping: result.operandMapping,
            tcOperandKeys: new Set(tcMappingResult.keys()),
            tcMapping: tcChainContentToDisplayRecord(tcMappingResult),
            tcMappingContent: tcMappingResult,
            side,
            targetDAG,
            nodeMapping: result.mapping,
          });
        }
      }
    } else {
      const snapshots = computeTcMappings(patternDAG, targetDAG, {
        fixedOperandMapping: options?.fixedOperandMapping,
      });
      for (const snap of snapshots) {
        for (const tcMappingResult of eachTcMappingChoice(snap)) {
          const convertedPattern = buildPatternWithTcChains(patternDAG, tcMappingResult);
          for (const result of SingleRootDAGInjection(convertedPattern, targetDAG, {
            fixedOperandMapping: options?.fixedOperandMapping,
          })) {
            const matchedIds = new Set(result.mapping.values());
            const unmatchedNodeSignatures = getUnmatchedNodeSignatures(targetDAG, matchedIds);
            const idToSig = getUnmatchedIdToSig(targetDAG, matchedIds);
            const unmatchedEdgeSignature = getUnmatchedEdgeSignature(targetDAG, matchedIds, idToSig);
            matches.push({
              unmatchedNodeSignatures,
              unmatchedEdgeSignature,
              operandMapping: result.operandMapping,
              tcOperandKeys: new Set(tcMappingResult.keys()),
              tcMapping: tcChainContentToDisplayRecord(tcMappingResult),
              tcMappingContent: tcMappingResult,
              side,
              targetDAG,
              nodeMapping: result.mapping,
            });
          }
        }
      }
    }
    return matches;
  }

  for (const result of SingleRootDAGInjection(patternDAG, targetDAG, {
    fixedOperandMapping: options?.fixedOperandMapping,
  })) {
      const matchedIds = new Set(result.mapping.values());
      const unmatchedNodeSignatures = getUnmatchedNodeSignatures(targetDAG, matchedIds);
      const idToSig = getUnmatchedIdToSig(targetDAG, matchedIds);
      const unmatchedEdgeSignature = getUnmatchedEdgeSignature(targetDAG, matchedIds, idToSig);
      matches.push({
        unmatchedNodeSignatures,
        unmatchedEdgeSignature,
        operandMapping: result.operandMapping,
        tcOperandKeys: undefined,
        side,
        targetDAG,
        nodeMapping: result.mapping,
      });
  }

  return matches;
}

function sigKey(sigs: string[]): string {
  return sigs.join(';');
}

function injectionMatchesPair(a: InjectionMatchForPairing, b: InjectionMatchForPairing): boolean {
  if (a.unmatchedNodeSignatures.length === 0 && b.unmatchedNodeSignatures.length === 0) return true;
  const nodeSigsMatch = sigKey(a.unmatchedNodeSignatures) === sigKey(b.unmatchedNodeSignatures);
  const edgeSigsEqual = a.unmatchedEdgeSignature === b.unmatchedEdgeSignature;
  const bothHaveTc = (a.tcOperandKeys?.size ?? 0) > 0 && (b.tcOperandKeys?.size ?? 0) > 0;
  const emptyArmOk = !bothHaveTc && emptyArmEdgeCompatible(a, b);
  return nodeSigsMatch && (edgeSigsEqual || emptyArmOk);
}

/** True iff operand mappings agree on all shared keys. Tc operands are excluded (they use node IDs per DAG). */
function operandMappingsConsistent(a: InjectionMatchForPairing, b: InjectionMatchForPairing): boolean {
  for (const k of a.operandMapping.keys()) {
    if (a.tcOperandKeys?.has(k) || b.tcOperandKeys?.has(k)) continue;
    if (b.operandMapping.has(k) && a.operandMapping.get(k) !== b.operandMapping.get(k)) return false;
  }
  return true;
}

function parseEdgeParts(sig: string): Set<string> {
  if (!sig) return new Set();
  return new Set(sig.split(';').filter(Boolean));
}

/** True when edge part is an "empty arm" edge: cond→tail type 0 (arm with no content). */
function isEmptyArmEdge(edgePart: string): boolean {
  const parts = edgePart.split('\t');
  return parts.length >= 3 && parts[1] === ':tail|' && parts[2] === '0';
}

/** True when node sigs match and the only edge difference is empty-arm edges (cond→tail type 0). For create-branch pairing. */
function emptyArmEdgeCompatible(a: InjectionMatchForPairing, b: InjectionMatchForPairing): boolean {
  if (sigKey(a.unmatchedNodeSignatures) !== sigKey(b.unmatchedNodeSignatures)) return false;
  const edgesA = parseEdgeParts(a.unmatchedEdgeSignature);
  const edgesB = parseEdgeParts(b.unmatchedEdgeSignature);
  if (edgesA.size === edgesB.size && [...edgesA].every((e) => edgesB.has(e))) return true;
  const smaller = edgesA.size <= edgesB.size ? edgesA : edgesB;
  const larger = edgesA.size <= edgesB.size ? edgesB : edgesA;
  for (const e of smaller) if (!larger.has(e)) return false;
  const extra = [...larger].filter((e) => !smaller.has(e));
  return extra.every(isEmptyArmEdge);
}

/** True when one side's unmatched nodes (and their induced edges) are a subset of the other. Reduces Tc false positives. */
function tcSubsetCompatible(a: InjectionMatchForPairing, b: InjectionMatchForPairing): boolean {
  const setA = new Set(a.unmatchedNodeSignatures);
  const setB = new Set(b.unmatchedNodeSignatures);
  // Reject when one side has 0 unmatched: empty ⊆ anything is trivial, not meaningful Brs Tc pairing
  if (setA.size === 0 || setB.size === 0) return false;
  const edgesA = parseEdgeParts(a.unmatchedEdgeSignature);
  const edgesB = parseEdgeParts(b.unmatchedEdgeSignature);

  let larger: Set<string>;
  let smaller: Set<string>;
  if (setA.size <= setB.size) {
    for (const n of setA) if (!setB.has(n)) return false;
    for (const e of edgesA) if (!edgesB.has(e)) return false;
    larger = edgesB;
    smaller = edgesA;
  } else {
    for (const n of setB) if (!setA.has(n)) return false;
    for (const e of edgesB) if (!edgesA.has(e)) return false;
    larger = edgesA;
    smaller = edgesB;
  }
  const extra = [...larger].filter((e) => !smaller.has(e));
  if (extra.length === 0) return true;
  // Reject when any extra edge is empty-arm (cond→tail type 0): create-branch adds new arms, Brs Tc does not
  if (extra.some(isEmptyArmEdge)) return false;
  // Reject when larger has exactly one extra node and it's :tail| (create-branch adds one Bb with empty arms)
  const largerNodeSet = setA.size >= setB.size ? setA : setB;
  const smallerNodeSet = setA.size >= setB.size ? setB : setA;
  const extraNodes = [...largerNodeSet].filter((n) => !smallerNodeSet.has(n));
  if (extraNodes.length === 1 && extraNodes[0] === ':tail|') return false;
  // Reject when larger has more :tail| AND extra nodes don't include \Tc| (create-branch adds cond+tail only)
  const tailCount = (sigs: string[]) => sigs.filter((n) => n === ':tail|').length;
  const largerSigs = setA.size >= setB.size ? a.unmatchedNodeSignatures : b.unmatchedNodeSignatures;
  const smallerSigs = setA.size >= setB.size ? b.unmatchedNodeSignatures : a.unmatchedNodeSignatures;
  const extraHasTc = extraNodes.some((n) => n.startsWith('\\Tc|'));
  if (tailCount(largerSigs) > tailCount(smallerSigs) && !extraHasTc) return false;
  // Reject when tailCount increases AND extra includes new cond :cond:\Pe|* — create-branch adds new Bb (cond+tail), not Brs Tc
  const extraHasCond = extraNodes.some((n) => n.startsWith(':cond:\\Pe|'));
  if (tailCount(largerSigs) > tailCount(smallerSigs) && extraHasCond) return false;
  return true;
}

/** Pair when strict sigs match, or (Tc only) when one side's unmatched structure is a subset of the other. */
function matchesPair(a: InjectionMatchForPairing, b: InjectionMatchForPairing): boolean {
  const bothHaveTc =
    (a.tcOperandKeys?.size ?? 0) > 0 && (b.tcOperandKeys?.size ?? 0) > 0;
  const sigsMatch =
    injectionMatchesPair(a, b) || (bothHaveTc && tcSubsetCompatible(a, b));
  return sigsMatch && operandMappingsConsistent(a, b);
}

/** Test if two matches pair (for diagnosis). */
export function testPairing(a: InjectionMatchForPairing, b: InjectionMatchForPairing): boolean {
  return matchesPair(a, b);
}

/** Debug: show why pairing fails. Uses unmatched node and edge signatures. */
export function debugTcPairingComparison(
  a: InjectionMatchForPairing,
  b: InjectionMatchForPairing
): {
  paired: boolean;
  reason: string;
  rawSigA: string;
  rawSigB: string;
  rawSigsEqual: boolean;
  edgeSigA: string;
  edgeSigB: string;
  edgeSigsEqual: boolean;
} {
  const rawSigA = sigKey(a.unmatchedNodeSignatures);
  const rawSigB = sigKey(b.unmatchedNodeSignatures);
  const rawSigsEqual = rawSigA === rawSigB;
  const edgeSigsEqual = a.unmatchedEdgeSignature === b.unmatchedEdgeSignature;
  const paired = rawSigsEqual && edgeSigsEqual;

  return {
    paired,
    reason: paired ? 'Node and edge sigs match' : !rawSigsEqual ? 'Node sigs differ' : 'Edge sigs differ',
    rawSigA,
    rawSigB,
    rawSigsEqual,
    edgeSigA: a.unmatchedEdgeSignature,
    edgeSigB: b.unmatchedEdgeSignature,
    edgeSigsEqual,
  };
}

function tcMappingHasEmptyChain(
  tcMapping: Map<string, TcChainContent> | undefined
): tcMapping is Map<string, TcChainContent> {
  if (!tcMapping) return false;
  for (const chain of tcMapping.values()) {
    if (chain.nodes.length === 0) return true;
  }
  return false;
}

function exprNodeKey(d: ExprNodeData | undefined): string {
  return `${d?.op ?? ''}|${(d?.operands ?? []).join(',')}|${d?.branchKind ?? ''}`;
}

/** Structural equality of instantiated rule DAGs. Node ids are ignored; op, operands, branch kind, and edge types are not. */
function dagStructurallyEqual(
  a: DAGStructure<ExprNodeData>,
  b: DAGStructure<ExprNodeData>
): boolean {
  if (a.nodes.length !== b.nodes.length || a.edges.length !== b.edges.length) return false;
  if (a.nodes.length === 0) return true;

  const aKeys = a.nodes.map((n) => exprNodeKey(n.data)).sort();
  const bKeys = b.nodes.map((n) => exprNodeKey(n.data)).sort();
  for (let i = 0; i < aKeys.length; i++) {
    if (aKeys[i] !== bKeys[i]) return false;
  }

  const aType = new Map<string, number>();
  const bType = new Map<string, number>();
  for (const e of a.edges) aType.set(`${e.from}\0${e.to}`, e.edgeType ?? 0);
  for (const e of b.edges) bType.set(`${e.from}\0${e.to}`, e.edgeType ?? 0);

  const aIds = a.nodes.map((n) => n.id);
  const bIds = b.nodes.map((n) => n.id);
  const aKeyById = new Map(a.nodes.map((n) => [n.id, exprNodeKey(n.data)]));
  const bKeyById = new Map(b.nodes.map((n) => [n.id, exprNodeKey(n.data)]));
  const map = new Map<string, string>();
  const usedB = new Set<string>();

  const edgeType = (table: Map<string, number>, from: string, to: string): number =>
    table.get(`${from}\0${to}`) ?? -1;

  function edgesMatch(aId: string, bId: string): boolean {
    for (const [aOther, bOther] of map) {
      if (edgeType(aType, aId, aOther) !== edgeType(bType, bId, bOther)) return false;
      if (edgeType(aType, aOther, aId) !== edgeType(bType, bOther, bId)) return false;
    }
    return true;
  }

  function assign(index: number): boolean {
    if (index === aIds.length) return true;
    const aId = aIds[index]!;
    const aKey = aKeyById.get(aId);
    for (const bId of bIds) {
      if (usedB.has(bId) || bKeyById.get(bId) !== aKey) continue;
      if (!edgesMatch(aId, bId)) continue;
      usedB.add(bId);
      map.set(aId, bId);
      if (assign(index + 1)) return true;
      map.delete(aId);
      usedB.delete(bId);
    }
    return false;
  }

  return assign(0);
}

/**
 * An empty \Tc chain deletes those nodes from both rule sides. The binding justifies a
 * step only when the two instantiated patterns are still different graphs. A non-empty
 * binding is left to the existing pair check.
 */
function emptyTcBindingJustifiesChange(
  patternA: string,
  patternB: string,
  tcMapping: Map<string, TcChainContent> | undefined
): boolean {
  if (!tcMappingHasEmptyChain(tcMapping)) return true;
  const a = buildPatternWithTcChains(exprToDAG(normalizeSpacing(patternA)), tcMapping);
  const b = buildPatternWithTcChains(exprToDAG(normalizeSpacing(patternB)), tcMapping);
  return !dagStructurallyEqual(a, b);
}

function toMatchPosition(m: InjectionMatchForPairing): MatchPosition {
  return {
    side: m.side,
    description: `Rule found (DAG injection) in ${m.side} side`,
    wasPatternMatch: true,
    targetDAG: m.targetDAG,
    nodeMapping: m.nodeMapping,
    unmatchedTargetNodeSignatures: m.unmatchedNodeSignatures,
    tcMapping: m.tcMapping,
  };
}

/**
 * Alternative to trySubstitution: use injection-only and complementary match pairs.
 * A match pair is valid when the unmatched target subgraph (nodes + edges incident to them)
 * is identical on both sides. Success when we have (Left,ruleL→ruleR)+(Right,ruleR→ruleL)
 * or (Left,ruleR→ruleL)+(Right,ruleL→ruleR) with same context structure.
 */
export const trySubstitutionByMatchPairs = (
  targetLeft: string,
  targetRight: string,
  ruleLeft: string,
  ruleRight: string,
  stepCounter?: { count: number }
): { match: boolean; position?: MatchPosition; reconstructedExpr?: string; matchDirections?: string[] } | null => {
  const normL = normalizeSpacing(targetLeft);
  const normR = normalizeSpacing(targetRight);
  const targetOrExpectedHasPe = normL.includes('\\Pe') || normR.includes('\\Pe');
  const targetOrExpectedHasOe = normL.includes('\\Oe') || normR.includes('\\Oe');
  const ruleHasOe = normalizeSpacing(ruleLeft).includes('\\Oe') || normalizeSpacing(ruleRight).includes('\\Oe');
  const ruleHasPe = normalizeSpacing(ruleLeft).includes('\\Pe') || normalizeSpacing(ruleRight).includes('\\Pe');

  let effLeft = ruleLeft;
  let effRight = ruleRight;
  if (targetOrExpectedHasPe && ruleHasOe) {
    effLeft = oeToPeInExpression(ruleLeft);
    effRight = oeToPeInExpression(ruleRight);
  } else if (targetOrExpectedHasOe && ruleHasPe) {
    effLeft = peToOeInExpression(ruleLeft);
    effRight = peToOeInExpression(ruleRight);
  }

  const patternFor = (target: string, ruleSide: string, effectiveSide: string) =>
    targetOrExpectedHasPe && ruleHasOe && target.includes('\\Oe') ? ruleSide : effectiveSide;

  // Pair 1: ruleLeft in targetLeft AND ruleRight in targetRight — same unmatched nodes (op+operands)
  const pair1PatternA = patternFor(targetLeft, ruleLeft, effLeft);
  const pair1PatternB = patternFor(targetRight, ruleRight, effRight);
  const leftMatches1 = findInjectionMatchesForPairing(targetLeft, pair1PatternA, 'left');
  let pair1: InjectionMatchForPairing | undefined;
  for (const lm of leftMatches1) {
    if (!emptyTcBindingJustifiesChange(pair1PatternA, pair1PatternB, lm.tcMappingContent)) continue;
    const rightMatches1 = findInjectionMatchesForPairing(
      targetRight,
      pair1PatternB,
      'right',
      {
        fixedOperandMapping: lm.operandMapping,
        fixedTcMapping: lm.tcMappingContent,
      }
    );
    if (rightMatches1.some((rm) => matchesPair(lm, rm))) {
      pair1 = lm;
      break;
    }
  }

  if (pair1) {
    return {
      match: true,
      position: toMatchPosition(pair1),
      reconstructedExpr: ensureCommaWrapped(targetRight),
      matchDirections: ['Left(ruleL→ruleR)', 'Right(ruleR→ruleL)'],
    };
  }

  // Pair 2: ruleRight in targetLeft AND ruleLeft in targetRight — same unmatched nodes (op+operands)
  const pair2PatternA = patternFor(targetLeft, ruleRight, effRight);
  const pair2PatternB = patternFor(targetRight, ruleLeft, effLeft);
  const leftMatches2 = findInjectionMatchesForPairing(targetLeft, pair2PatternA, 'left');
  let pair2: InjectionMatchForPairing | undefined;
  for (const lm of leftMatches2) {
    if (!emptyTcBindingJustifiesChange(pair2PatternA, pair2PatternB, lm.tcMappingContent)) continue;
    const rightMatches2 = findInjectionMatchesForPairing(
      targetRight,
      pair2PatternB,
      'right',
      {
        fixedOperandMapping: lm.operandMapping,
        fixedTcMapping: lm.tcMappingContent,
      }
    );
    if (rightMatches2.some((rm) => matchesPair(lm, rm))) {
      pair2 = lm;
      break;
    }
  }

  if (pair2) {
    return {
      match: true,
      position: toMatchPosition(pair2),
      reconstructedExpr: ensureCommaWrapped(targetRight),
      matchDirections: ['Left(ruleR→ruleL)', 'Right(ruleL→ruleR)'],
    };
  }

  return null;
};
