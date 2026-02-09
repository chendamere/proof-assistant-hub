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

export type TransitionVerificationResponse = {
  id: string;
  matched: boolean;
  error?: string;
};

self.onmessage = (e: MessageEvent<TransitionVerificationRequest>) => {
  const { id, targetLeft, targetRight, rules, rulesToTry } = e.data;
  try {
    const rulesForIndex = rulesToTry ?? rules;
    const index = buildRuleIndex(rulesForIndex);
    const toTry = rulesToTry ?? getRulesForTransition(index, targetLeft, targetRight);

    for (const rule of toTry) {
      const result = checkInferenceRules(
        targetLeft,
        targetRight,
        rule.leftSide,
        rule.rightSide,
        { dagCache: index.dagCache }
      );
      if (result.match) {
        const response: TransitionVerificationResponse = { id, matched: true };
        self.postMessage(response);
        return;
      }
    }
    const response: TransitionVerificationResponse = { id, matched: false };
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
