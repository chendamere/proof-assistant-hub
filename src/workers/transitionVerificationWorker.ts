/**
 * Web Worker for transition verification in ProofSteps.
 * Offloads checkInferenceRules (VF2/DAG work) from the main thread to keep the page responsive.
 */

import { checkInferenceRules } from '@/lib/inferenceRules';

export type TransitionVerificationRequest = {
  id: string;
  targetLeft: string;
  targetRight: string;
  rules: Array<{ id: string; leftSide: string; rightSide: string }>;
};

export type TransitionVerificationResponse = {
  id: string;
  matched: boolean;
  error?: string;
};

self.onmessage = (e: MessageEvent<TransitionVerificationRequest>) => {
  const { id, targetLeft, targetRight, rules } = e.data;
  try {
    for (const rule of rules) {
      const result = checkInferenceRules(
        targetLeft,
        targetRight,
        rule.leftSide,
        rule.rightSide
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
