/**
 * Rule index for fast filtering by operation-count delta and operator signature.
 * Non-\Tc rules are bucketed by (opCountRight - opCountLeft); \Tc rules are always tried.
 */

import type { DAGStructure } from '../dag';
import type { ExprNodeData } from '../dag/types';
import { exprToDAG, countOperations, extractOperators } from '../dag';
import { normalizeSpacing } from './utils';
import { ruleStatistics } from './ruleStatistics';

export interface IndexedRule {
  id: string;
  leftSide: string;
  rightSide: string;
}

export interface RuleIndex {
  /** Rules bucketed by delta = opCountRight - opCountLeft */
  byDelta: Map<number, IndexedRule[]>;
  /** Rules containing \Tc (always tried) */
  tcRules: IndexedRule[];
  /** Operator set per rule id (union of left and right). Tc rules excluded. */
  ruleOpSets: Map<string, Set<string>>;
  /** Op count of pattern side (min of left, right) for ordering - smaller first */
  rulePatternSize: Map<string, number>;
  /** Pre-computed DAGs for rule sides, keyed by normalized expr */
  dagCache: Map<string, DAGStructure<ExprNodeData>>;
}

function hasTc(expr: string): boolean {
  return /\\Tc\b/.test(expr);
}

/**
 * Build an index of rules by operation-count delta, with operator sets and DAG cache.
 */
export function buildRuleIndex(rules: IndexedRule[]): RuleIndex {
  const byDelta = new Map<number, IndexedRule[]>();
  const tcRules: IndexedRule[] = [];
  const ruleOpSets = new Map<string, Set<string>>();
  const rulePatternSize = new Map<string, number>();
  const dagCache = new Map<string, DAGStructure<ExprNodeData>>();

  for (const rule of rules) {
    if (hasTc(rule.leftSide) || hasTc(rule.rightSide)) {
      tcRules.push(rule);
      try {
        const normLeft = normalizeSpacing(rule.leftSide);
        const normRight = normalizeSpacing(rule.rightSide);
        dagCache.set(normLeft, exprToDAG(normLeft) as DAGStructure<ExprNodeData>);
        dagCache.set(normRight, exprToDAG(normRight) as DAGStructure<ExprNodeData>);
      } catch {
        /* ignore */
      }
      continue;
    }

    try {
      const normLeft = normalizeSpacing(rule.leftSide);
      const normRight = normalizeSpacing(rule.rightSide);
      const leftDAG = exprToDAG(normLeft);
      const rightDAG = exprToDAG(normRight);

      dagCache.set(normLeft, leftDAG);
      dagCache.set(normRight, rightDAG);

      const opLeft = countOperations(leftDAG);
      const opRight = countOperations(rightDAG);
      const delta = opRight - opLeft;

      const opsLeft = extractOperators(leftDAG);
      const opsRight = extractOperators(rightDAG);
      const opsUnion = new Set<string>([...opsLeft, ...opsRight]);
      ruleOpSets.set(rule.id, opsUnion);
      rulePatternSize.set(rule.id, Math.min(opLeft, opRight));

      const bucket = byDelta.get(delta) ?? [];
      bucket.push(rule);
      byDelta.set(delta, bucket);
    } catch {
      tcRules.push(rule);
    }
  }

  return { byDelta, tcRules, ruleOpSets, rulePatternSize, dagCache };
}

function setIntersects(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

/**
 * Get rules to try for a transition targetLeft -> targetRight.
 * Returns rules whose delta matches the transition's op-count change, plus all \Tc rules.
 * Filters by operator-signature overlap (rule must share at least one op with transition).
 * Sorted by pattern size (smaller first) for faster early match.
 */
export function getRulesForTransition(
  index: RuleIndex,
  targetLeft: string,
  targetRight: string
): IndexedRule[] {
  try {
    const leftDAG = exprToDAG(normalizeSpacing(targetLeft));
    const rightDAG = exprToDAG(normalizeSpacing(targetRight));
    const opLeft = countOperations(leftDAG);
    const opRight = countOperations(rightDAG);
    const delta = opRight - opLeft;

    const opsLeft = extractOperators(leftDAG);
    const opsRight = extractOperators(rightDAG);
    const transitionOps = new Set<string>([...opsLeft, ...opsRight]);

    const bucketPos = index.byDelta.get(delta) ?? [];
    const bucketNeg = delta !== 0 ? (index.byDelta.get(-delta) ?? []) : [];
    const seen = new Set<string>();
    const result: IndexedRule[] = [];
    for (const r of [...bucketPos, ...bucketNeg]) {
      if (seen.has(r.id)) continue;
      const ruleOps = index.ruleOpSets?.get(r.id);
      if (ruleOps && transitionOps.size > 0 && !setIntersects(ruleOps, transitionOps)) continue;
      seen.add(r.id);
      result.push(r);
    }

    const withTc = [...result, ...index.tcRules];
    const patternSize = index.rulePatternSize;
    
    // Sort by priority: statistics first, then pattern size, then fast-reject first
    withTc.sort((a, b) => {
      // Primary: success rate from statistics
      const scoreA = ruleStatistics.getPriorityScore(a.id);
      const scoreB = ruleStatistics.getPriorityScore(b.id);
      
      // If scores differ significantly (more than 0.1), use statistics
      if (Math.abs(scoreA - scoreB) > 0.1) {
        return scoreB - scoreA; // Higher score first
      }

      // Secondary: pattern size (smaller first) - fallback for similar scores
      const sa = patternSize?.get(a.id) ?? 999;
      const sb = patternSize?.get(b.id) ?? 999;
      if (sa !== sb) return sa - sb;

      // Tertiary: try fast-reject rules first (lower avg reject time = try earlier)
      const rejectA = ruleStatistics.getAvgRejectTime(a.id);
      const rejectB = ruleStatistics.getAvgRejectTime(b.id);
      return rejectA - rejectB;
    });
    
    return withTc;
  } catch {
    return [...Array.from(index.byDelta.values()).flat(), ...index.tcRules];
  }
}
