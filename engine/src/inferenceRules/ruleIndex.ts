/**
 * Rule index for fast filtering by operation-count delta and operator signature.
 * Non-\Tc rules are bucketed by (opCountRight - opCountLeft).
 * \Tc rules are kept separately and filtered by non-hole operators and branch shape.
 */

import type { DAGStructure } from '../dag';
import type { ExprNodeData } from '../dag/types';

import { exprToDAG, countOperations, extractOperators } from '../dag';
import { normalizeSpacing } from './utils';
import { ruleStatistics } from './ruleStatistics';
import { expandSim } from './sim';

export interface IndexedRule {
  id: string;
  leftSide: string;
  rightSide: string;
}

/** Skeleton facts for a \Tc rule, used to drop impossible candidates. */
export interface TcRuleMeta {
  /** Operators other than \Tc on either side. */
  nonTcOps: Set<string>;
  /** Number of \Tc hole occurrences across both sides. */
  holeCount: number;
  /** True when the rule mentions a branch form. */
  hasBranch: boolean;
  /** Non-\Tc operation count on the smaller side (for ordering). */
  patternSize: number;
}

export interface RuleIndex {
  /** Rules bucketed by delta = opCountRight - opCountLeft */
  byDelta: Map<number, IndexedRule[]>;
  /** Rules containing \Tc (filtered further per transition) */
  tcRules: IndexedRule[];
  /** Operator set per rule id (union of left and right). Includes non-\Tc ops for Tc rules. */
  ruleOpSets: Map<string, Set<string>>;
  /** Op count of pattern side (min of left, right) for ordering - smaller first */
  rulePatternSize: Map<string, number>;
  /** Per-\Tc-rule skeleton for candidate filtering */
  tcMeta: Map<string, TcRuleMeta>;
  /** Pre-computed DAGs for rule sides, keyed by normalized expr */
  dagCache: Map<string, DAGStructure<ExprNodeData>>;
}

const BRANCH_OPS = new Set([
  '\\Bb',
  '\\Bs',
  '\\Blb',
  '\\Bls',
  '\\Br',
  '\\Brb',
  '\\Brs',
]);

function hasTc(expr: string): boolean {
  return /\\Tc\b/.test(expr);
}

function countTcHoles(expr: string): number {
  const matches = expr.match(/\\Tc\b/g);
  return matches?.length ?? 0;
}

function opsWithoutTc(ops: Set<string>): Set<string> {
  const out = new Set<string>();
  for (const op of ops) {
    if (op === '\\Tc') continue;
    out.add(op);
  }
  return out;
}

function setHasBranch(ops: Set<string>): boolean {
  for (const op of ops) {
    if (BRANCH_OPS.has(op)) return true;
    // DAG cond nodes are :cond:\Pe etc.; branch wrappers may appear as \Bb:cond:...
    if (op.startsWith('\\Bb') || op.startsWith('\\Bs') || op.startsWith('\\Bl') || op.startsWith('\\Br')) {
      return true;
    }
  }
  return false;
}

/**
 * Build an index of rules by operation-count delta, with operator sets and DAG cache.
 */
export function buildRuleIndex(
  rules: IndexedRule[],
  sharedDagCache?: Map<string, DAGStructure<ExprNodeData>>
): RuleIndex {
  const byDelta = new Map<number, IndexedRule[]>();
  const tcRules: IndexedRule[] = [];
  const ruleOpSets = new Map<string, Set<string>>();
  const rulePatternSize = new Map<string, number>();
  const tcMeta = new Map<string, TcRuleMeta>();
  const dagCache = sharedDagCache ?? new Map<string, DAGStructure<ExprNodeData>>();

  const cachedDag = (expr: string): { norm: string; dag: DAGStructure<ExprNodeData> } => {
    const norm = normalizeSpacing(expr);
    let dag = dagCache.get(norm);
    if (!dag) {
      dag = exprToDAG(norm) as DAGStructure<ExprNodeData>;
      dagCache.set(norm, dag);
    }
    return { norm, dag };
  };

  for (const rule of rules) {
    const resolved = expandSim(rule.leftSide, rule.rightSide);
    if (hasTc(rule.leftSide) || hasTc(rule.rightSide)) {
      tcRules.push(rule);
      try {
        const { dag: leftDAG } = cachedDag(resolved.left);
        const { dag: rightDAG } = cachedDag(resolved.right);
        const opsLeft = extractOperators(leftDAG);
        const opsRight = extractOperators(rightDAG);
        const opsUnion = new Set<string>([...opsLeft, ...opsRight]);
        const nonTcOps = opsWithoutTc(opsUnion);
        const opLeft = countOperations(leftDAG);
        const opRight = countOperations(rightDAG);
        // Subtract holes from pattern size so multi-hole rules sort later than small concrete ones.
        const holeCount = countTcHoles(rule.leftSide) + countTcHoles(rule.rightSide);
        const patternSize = Math.max(0, Math.min(opLeft, opRight) - holeCount);
        const hasBranch =
          setHasBranch(opsUnion) ||
          /\\B(?:lb|ls|rb|rs|b|s|r)\b/.test(rule.leftSide) ||
          /\\B(?:lb|ls|rb|rs|b|s|r)\b/.test(rule.rightSide);
        ruleOpSets.set(rule.id, nonTcOps);
        rulePatternSize.set(rule.id, patternSize);
        tcMeta.set(rule.id, { nonTcOps, holeCount, hasBranch, patternSize });
      } catch {
        /* keep the rule with no meta; filtering will leave it in */
      }
      continue;
    }

    try {
      const { dag: leftDAG } = cachedDag(resolved.left);
      const { dag: rightDAG } = cachedDag(resolved.right);

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

  return { byDelta, tcRules, ruleOpSets, rulePatternSize, tcMeta, dagCache };
}

function setIntersects(a: Set<string>, b: Set<string>): boolean {
  for (const x of a) if (b.has(x)) return true;
  return false;
}

/**
 * Keep a \Tc rule only when its non-hole skeleton can appear in this transition.
 * Rules without meta (parse failure) stay; that is the conservative path.
 */
function tcRuleFitsTransition(
  rule: IndexedRule,
  meta: TcRuleMeta | undefined,
  transitionOps: Set<string>,
  transitionHasBranch: boolean
): boolean {
  if (!meta) return true;
  if (meta.hasBranch && !transitionHasBranch) return false;
  if (meta.nonTcOps.size === 0) return true;
  if (transitionOps.size === 0) return true;
  return setIntersects(meta.nonTcOps, transitionOps);
}

/**
 * Get rules to try for a transition targetLeft -> targetRight.
 * Returns rules whose delta matches the transition's op-count change, plus filtered \Tc rules.
 * Filters by operator-signature overlap (rule must share at least one op with transition).
 * Sorted by pattern size (smaller first) for faster early match.
 */
export function getRulesForTransition(
  index: RuleIndex,
  targetLeft: string,
  targetRight: string
): IndexedRule[] {
  try {
    const resolved = expandSim(targetLeft, targetRight);
    // Reuse the shared DAG cache — avoid re-parsing the same step sides on every justify.
    const cached = (expr: string) => {
      const norm = normalizeSpacing(expr);
      let dag = index.dagCache.get(norm);
      if (!dag) {
        dag = exprToDAG(norm) as DAGStructure<ExprNodeData>;
        index.dagCache.set(norm, dag);
      }
      return dag;
    };
    const leftDAG = cached(resolved.left);
    const rightDAG = cached(resolved.right);
    const opLeft = countOperations(leftDAG);
    const opRight = countOperations(rightDAG);
    const delta = opRight - opLeft;

    const opsLeft = extractOperators(leftDAG);
    const opsRight = extractOperators(rightDAG);
    const transitionOps = new Set<string>([...opsLeft, ...opsRight]);
    const transitionHasBranch =
      setHasBranch(transitionOps) ||
      /\\B(?:lb|ls|rb|rs|b|s|r)\b/.test(targetLeft) ||
      /\\B(?:lb|ls|rb|rs|b|s|r)\b/.test(targetRight);

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

    for (const r of index.tcRules) {
      if (seen.has(r.id)) continue;
      if (!tcRuleFitsTransition(r, index.tcMeta.get(r.id), transitionOps, transitionHasBranch)) continue;
      seen.add(r.id);
      result.push(r);
    }

    const patternSize = index.rulePatternSize;
    const tcMeta = index.tcMeta;

    result.sort((a, b) => {
      const scoreA = ruleStatistics.getPriorityScore(a.id);
      const scoreB = ruleStatistics.getPriorityScore(b.id);
      if (Math.abs(scoreA - scoreB) > 0.1) {
        return scoreB - scoreA;
      }

      // Prefer fewer \Tc holes before larger patterns: deep nests pay per hole.
      const holesA = tcMeta.get(a.id)?.holeCount ?? 0;
      const holesB = tcMeta.get(b.id)?.holeCount ?? 0;
      if (holesA !== holesB) return holesA - holesB;

      const sa = patternSize?.get(a.id) ?? 999;
      const sb = patternSize?.get(b.id) ?? 999;
      if (sa !== sb) return sa - sb;

      const rejectA = ruleStatistics.getAvgRejectTime(a.id);
      const rejectB = ruleStatistics.getAvgRejectTime(b.id);
      return rejectA - rejectB;
    });

    return result;
  } catch (err) {
    console.warn('getRulesForTransition: DAG parsing failed for target, returning only tcRules', err);
    return [...index.tcRules];
  }
}
