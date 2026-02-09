/**
 * Client for the transition verification Web Worker.
 * Provides async verifyTransition that runs off the main thread.
 * Parallelizes rule tries across multiple workers: tries several rules in parallel
 * and stops as soon as one matches.
 */

import type {
  TransitionVerificationRequest,
  TransitionVerificationResponse,
} from '@/workers/transitionVerificationWorker';
import { buildRuleIndex, getRulesForTransition } from '@/lib/inferenceRules/ruleIndex';

const WORKER_URL = new URL('@/workers/transitionVerificationWorker.ts', import.meta.url);
const PARALLEL_WORKERS = Math.min(4, Math.max(1, navigator.hardwareConcurrency ?? 4));

const workerPool: Worker[] = [];
let poolIndex = 0;

function getWorkerFromPool(): Worker {
  if (workerPool.length < PARALLEL_WORKERS) {
    workerPool.push(new Worker(WORKER_URL, { type: 'module' }));
  }
  const w = workerPool[poolIndex % workerPool.length];
  poolIndex += 1;
  return w;
}

let requestId = 0;

export type VerifyTransitionParams = {
  targetLeft: string;
  targetRight: string;
  rules: Array<{ id: string; leftSide: string; rightSide: string }>;
};

function verifyChunk(
  worker: Worker,
  baseId: string,
  chunkIndex: number,
  targetLeft: string,
  targetRight: string,
  rulesChunk: Array<{ id: string; leftSide: string; rightSide: string }>
): Promise<boolean> {
  const id = `${baseId}-${chunkIndex}`;
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<TransitionVerificationResponse>) => {
      if (!e.data.id.startsWith(baseId) || e.data.id !== id) return;
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

    const request: TransitionVerificationRequest = {
      id,
      targetLeft,
      targetRight,
      rules: [],
      rulesToTry: rulesChunk,
    };
    worker.postMessage(request);
  });
}

export function verifyTransitionWorker(
  params: VerifyTransitionParams
): Promise<boolean> {
  const baseId = `tv-${++requestId}`;
  const { targetLeft, targetRight, rules } = params;

  // Build index and get filtered rules on main thread (fast, no VF2)
  const index = buildRuleIndex(rules);
  const rulesToTry = getRulesForTransition(index, targetLeft, targetRight);

  if (rulesToTry.length === 0) {
    return Promise.resolve(false);
  }

  // Split into parallel chunks
  const chunkCount = Math.min(PARALLEL_WORKERS, rulesToTry.length);
  const chunkSize = Math.ceil(rulesToTry.length / chunkCount);
  const chunks: Array<Array<{ id: string; leftSide: string; rightSide: string }>> = [];
  for (let i = 0; i < chunkCount; i++) {
    const chunk = rulesToTry.slice(i * chunkSize, (i + 1) * chunkSize);
    if (chunk.length > 0) chunks.push(chunk);
  }

  if (chunks.length === 0) return Promise.resolve(false);
  if (chunks.length === 1) {
    return verifyChunk(
      getWorkerFromPool(),
      baseId,
      0,
      targetLeft,
      targetRight,
      chunks[0]
    );
  }

  // Run chunks in parallel; resolve true as soon as any matches, false when all done
  return new Promise((resolve, reject) => {
    let settled = 0;
    let foundMatch = false;
    let rejected = false;

    const maybeSettle = () => {
      if (foundMatch) return;
      if (rejected) return;
      settled += 1;
      if (settled === chunks.length) resolve(false);
    };

    chunks.forEach((chunk, i) => {
      verifyChunk(
        getWorkerFromPool(),
        baseId,
        i,
        targetLeft,
        targetRight,
        chunk
      )
        .then((matched) => {
          if (matched) {
            foundMatch = true;
            resolve(true);
          }
          maybeSettle();
        })
        .catch((err) => {
          rejected = true;
          reject(err);
        });
    });
  });
}
