/**
 * Client for the substitution Web Worker.
 * Provides async trySubstitution that runs off the main thread.
 */

import type { SubstitutionRequest, SubstitutionResponse } from '@/workers/substitutionWorker';

let workerInstance: Worker | null = null;

// Relative path so Vite resolves the worker correctly in dev and production (avoids alias/MIME issues)
const SUBSTITUTION_WORKER_URL = new URL('../workers/substitutionWorker.ts', import.meta.url);

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(SUBSTITUTION_WORKER_URL, { type: 'module' });
  }
  return workerInstance;
}

let requestId = 0;

export type TrySubstitutionParams = {
  target: string;
  ruleSide: string;
  otherRuleSide: string;
  expectedResult: string;
  targetSideForOperands: string;
  side: 'left' | 'right';
};

export function trySubstitutionWorker(params: TrySubstitutionParams): Promise<SubstitutionResponse['result']> {
  const id = `sub-${++requestId}`;
  const worker = getWorker();

  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<SubstitutionResponse>) => {
      if (e.data.id !== id) return;
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', errorHandler);
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        resolve(e.data.result);
      }
    };

    const errorHandler = (ev: ErrorEvent) => {
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', errorHandler);
      reject(new Error(ev.message ?? 'Worker error'));
    };

    worker.addEventListener('message', handler);
    worker.addEventListener('error', errorHandler);

    const request: SubstitutionRequest = { id, ...params };
    worker.postMessage(request);
  });
}
