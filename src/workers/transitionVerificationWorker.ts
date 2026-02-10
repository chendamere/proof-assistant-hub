/**
 * Web Worker for transition verification in ProofSteps.
 * Offloads checkInferenceRules (VF2/DAG work) from the main thread to keep the page responsive.
 * Rules are filtered by op-count delta before checking for faster verification.
 */

import { checkInferenceRules } from '@/lib/inferenceRules';
import { buildRuleIndex, getRulesForTransition } from '@/lib/inferenceRules/ruleIndex';

export type TransitionVerificationRequest = {
  id: string;
  targetLeft: string;
  targetRight: string;
  rules: Array<{ id: string; leftSide: string; rightSide: string }>;
  /** Optional pre-filtered rules to try (chunk for parallel verification). When set, skips getRulesForTransition. */
  rulesToTry?: Array<{ id: string; leftSide: string; rightSide: string }>;
};

/** Serializable match details for UI (pattern used, where match started, node map). */
export type MatchInfo = {
  matchedRuleId: string;
  description?: string;
  startPosition?: number;
  side?: 'left' | 'right' | 'both';
  /** Exact pattern rule: left side (e.g. axiom LHS). */
  ruleLeft?: string;
  /** Exact pattern rule: right side (e.g. axiom RHS). */
  ruleRight?: string;
  /** Name of the inference rule that matched (e.g. "Equivalent Substitution"). */
  inferenceRuleName?: string;
  /** Node map: pattern node id → target node id (VF2 injection result). */
  nodeMap?: Record<string, string>;
};

export type TransitionVerificationResponse = {
  id: string;
  matched: boolean;
  matchedRuleId?: string; // ID of the rule that matched (if any)
  matchInfo?: MatchInfo; // When matched: which rule and where it matched (for collapsible success details)
  rulesTried?: Array<{ ruleId: string; matched: boolean; matchTime: number }>; // All rules tried in this chunk with timing
  error?: string;
};

self.onmessage = (e: MessageEvent<TransitionVerificationRequest>) => {
  const { id, targetLeft, targetRight, rules, rulesToTry } = e.data;
  try {
    const rulesForIndex = rulesToTry ?? rules;
    const index = buildRuleIndex(rulesForIndex);
    const toTry = rulesToTry ?? getRulesForTransition(index, targetLeft, targetRight);

    const rulesTried: Array<{ ruleId: string; matched: boolean; matchTime: number }> = [];
    
    for (const rule of toTry) {
      const ruleStartTime = performance.now();
      const result = checkInferenceRules(
        targetLeft,
        targetRight,
        rule.leftSide,
        rule.rightSide,
        { dagCache: index.dagCache }
      );
      const ruleMatchTime = performance.now() - ruleStartTime;
      
      rulesTried.push({
        ruleId: rule.id,
        matched: result.match,
        matchTime: ruleMatchTime,
      });
      
      if (result.match) {
        const pos = result.matchPosition;
        const nodeMapping = pos?.nodeMapping;
        const matchInfo: MatchInfo = {
          matchedRuleId: rule.id,
          description: pos?.description,
          startPosition: pos?.position,
          side: pos?.side,
          ruleLeft: rule.leftSide,
          ruleRight: rule.rightSide,
          inferenceRuleName: result.inferenceRule,
          nodeMap: nodeMapping ? Object.fromEntries(nodeMapping) : undefined,
        };
        const response: TransitionVerificationResponse = {
          id,
          matched: true,
          matchedRuleId: rule.id,
          matchInfo,
          rulesTried,
        };
        self.postMessage(response);
        return;
      }
    }
    
    const response: TransitionVerificationResponse = {
      id,
      matched: false,
      rulesTried,
    };
    self.postMessage(response);
  } catch (err) {
    const response: TransitionVerificationResponse = {
      id,
      matched: false,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
