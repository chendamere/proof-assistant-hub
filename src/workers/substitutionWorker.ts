/**
 * Web Worker for trySubstitutionByMatchPairs.
 * Offloads heavy VF2/DAG work from the main thread to avoid UI freezes.
 */

import { trySubstitutionByMatchPairs } from '@/lib/inferenceRules/substitution';

export type SubstitutionRequest = {
  id: string;
  targetLeft: string;
  targetRight: string;
  ruleLeft: string;
  ruleRight: string;
};

export type SubstitutionResponse = {
  id: string;
  result: ReturnType<typeof trySubstitutionByMatchPairs>;
  error?: string;
};

self.onmessage = (e: MessageEvent<SubstitutionRequest>) => {
  const { id, targetLeft, targetRight, ruleLeft, ruleRight } = e.data;
  try {
    const result = trySubstitutionByMatchPairs(targetLeft, targetRight, ruleLeft, ruleRight, undefined);
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
