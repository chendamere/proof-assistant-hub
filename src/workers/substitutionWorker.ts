/**
 * Web Worker for trySubstitution.
 * Offloads heavy VF2/DAG work from the main thread to avoid UI freezes.
 */

import { trySubstitution } from '@/lib/inferenceRules/substitution';

export type SubstitutionRequest = {
  id: string;
  target: string;
  ruleSide: string;
  otherRuleSide: string;
  expectedResult: string;
  targetSideForOperands: string;
  side: 'left' | 'right';
};

export type SubstitutionResponse = {
  id: string;
  result: ReturnType<typeof trySubstitution>;
  error?: string;
};

self.onmessage = (e: MessageEvent<SubstitutionRequest>) => {
  const { id, target, ruleSide, otherRuleSide, expectedResult, targetSideForOperands, side } = e.data;
  try {
    const result = trySubstitution(
      target,
      ruleSide,
      otherRuleSide,
      expectedResult,
      targetSideForOperands,
      side
    );
    const response: SubstitutionResponse = { id, result };
    self.postMessage(response);
  } catch (err) {
    const response: SubstitutionResponse = {
      id,
      result: null,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
