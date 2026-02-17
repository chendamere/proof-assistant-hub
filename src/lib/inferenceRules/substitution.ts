/**
 * Substitution logic for inference rules
 * Uses DAG injection (VF2) for rule applicability after operand normalization.
 * A single VF2 pass on the full target finds the match and operand mapping.
 */

import type { DAGStructure, ExprNodeData } from '../dag';
import { MatchPosition } from './types';
import { normalizeSpacing, ensureCommaWrapped, oeToPeInExpression, peToOeInExpression } from './utils';
import { exprToDAG, dagToExpr, SingleRootDAGInjection,  } from '../dag';


/** Single match from injection: position, root target node id, and boundary signature for pairing. */
export interface SubstitutionMatch {
  position: MatchPosition;
  rootTargetNodeId: string;
  /** Boundary signature: sorted (direction, edgeType) for edges not in pattern that connect match to rest of target. Empty = no additional edges. */
  boundarySignature: string;
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
    const op = d?.op ?? '';
    const operands = d?.operands ?? [];
    if (op === '\\Tc' && operands.length === 1 && operands[0] === '') continue;
    sigs.push(`${op}|${operands.join(',')}`);
  }
  sigs.sort();
  return sigs;
}

/** Match from DAG injection for pairing: unmatched node signatures, side, operand mapping, and DAG data. */
export interface InjectionMatchForPairing {
  unmatchedNodeSignatures: string[];
  /** Pattern operand -> target value (operand string or Tc expression key). Portable across DAGs for use as fixedOperandMapping. */
  operandMapping: Map<string, string>;
  side: 'left' | 'right';
  targetDAG: DAGStructure<ExprNodeData>;
  nodeMapping: Map<string, string>;
}

export interface FindInjectionMatchesOptions {
  /** Use these operand bindings as fixed constraints; only accept matches consistent with them. */
  fixedOperandMapping?: Map<string, string>;
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
    return [{
      unmatchedNodeSignatures,
      operandMapping: new Map(),
      side,
      targetDAG,
      nodeMapping: new Map(),
    }];
  }

  const matches: InjectionMatchForPairing[] = [];
  for (const result of SingleRootDAGInjection(patternDAG, targetDAG, {
    fixedOperandMapping: options?.fixedOperandMapping,
  })) {
    const matchedIds = new Set(result.mapping.values());
    matches.push({
      unmatchedNodeSignatures: getUnmatchedNodeSignatures(targetDAG, matchedIds),
      operandMapping: result.operandMapping,
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
  return sigKey(a.unmatchedNodeSignatures) === sigKey(b.unmatchedNodeSignatures);
}

/** True iff operand mappings agree on all shared keys. */
function operandMappingsConsistent(a: InjectionMatchForPairing, b: InjectionMatchForPairing): boolean {
  for (const k of a.operandMapping.keys()) {
    if (b.operandMapping.has(k) && a.operandMapping.get(k) !== b.operandMapping.get(k)) return false;
  }
  return true;
}

function matchesPair(a: InjectionMatchForPairing, b: InjectionMatchForPairing): boolean {
  return injectionMatchesPair(a, b) && operandMappingsConsistent(a, b);
}

/** Test if two matches pair (for diagnosis). */
export function testPairing(a: InjectionMatchForPairing, b: InjectionMatchForPairing): boolean {
  return matchesPair(a, b);
}

/** Debug: show why pairing fails. Uses unmatched node signatures. */
export function debugTcPairingComparison(
  a: InjectionMatchForPairing,
  b: InjectionMatchForPairing
): {
  paired: boolean;
  reason: string;
  rawSigA: string;
  rawSigB: string;
  rawSigsEqual: boolean;
} {
  const rawSigA = sigKey(a.unmatchedNodeSignatures);
  const rawSigB = sigKey(b.unmatchedNodeSignatures);
  const rawSigsEqual = rawSigA === rawSigB;

  return {
    paired: rawSigsEqual,
    reason: rawSigsEqual ? 'Raw sigs match' : 'Raw sigs differ',
    rawSigA,
    rawSigB,
    rawSigsEqual,
  };
}

function toMatchPosition(m: InjectionMatchForPairing): MatchPosition {
  return {
    side: m.side,
    description: `Rule found (DAG injection) in ${m.side} side`,
    wasPatternMatch: true,
    targetDAG: m.targetDAG,
    nodeMapping: m.nodeMapping,
    unmatchedTargetNodeSignatures: m.unmatchedNodeSignatures,
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
  const leftMatches1 = findInjectionMatchesForPairing(targetLeft, patternFor(targetLeft, ruleLeft, effLeft), 'left');
  let pair1: InjectionMatchForPairing | undefined;
  for (const lm of leftMatches1) {
    const rightMatches1 = findInjectionMatchesForPairing(
      targetRight,
      patternFor(targetRight, ruleRight, effRight),
      'right',
      { fixedOperandMapping: lm.operandMapping }
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
  const leftMatches2 = findInjectionMatchesForPairing(targetLeft, patternFor(targetLeft, ruleRight, effRight), 'left');
  let pair2: InjectionMatchForPairing | undefined;
  for (const lm of leftMatches2) {
    const rightMatches2 = findInjectionMatchesForPairing(
      targetRight,
      patternFor(targetRight, ruleLeft, effLeft),
      'right',
      { fixedOperandMapping: lm.operandMapping }
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
