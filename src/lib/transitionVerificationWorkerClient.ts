/**
 * Client for the transition verification Web Worker.
 * Provides async verifyTransition that runs off the main thread.
 */

import type {
  TransitionVerificationRequest,
  TransitionVerificationResponse,
} from '@/workers/transitionVerificationWorker';

let workerInstance: Worker | null = null;

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('@/workers/transitionVerificationWorker.ts', import.meta.url),
      { type: 'module' }
    );
  }
  return workerInstance;
}

let requestId = 0;

export type VerifyTransitionParams = {
  targetLeft: string;
  targetRight: string;
  rules: Array<{ id: string; leftSide: string; rightSide: string }>;
};

export function verifyTransitionWorker(
  params: VerifyTransitionParams
): Promise<boolean> {
  const id = `tv-${++requestId}`;
  const worker = getWorker();

  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<TransitionVerificationResponse>) => {
      if (e.data.id !== id) return;
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', errorHandler);
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        resolve(e.data.matched);
      }
    };

    const errorHandler = (ev: ErrorEvent) => {
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', errorHandler);
      reject(new Error(ev.message ?? 'Worker error'));
    };

    worker.addEventListener('message', handler);
    worker.addEventListener('error', errorHandler);

    const request: TransitionVerificationRequest = { id, ...params };
    worker.postMessage(request);
  });
}
