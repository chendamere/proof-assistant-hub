/**
 * Client for the transition verification Web Worker.
 * Provides async verifyTransition that runs off the main thread.
 * Parallelizes rule tries across multiple workers: tries several rules in parallel
 * and stops as soon as one matches.
 * Falls back to main-thread verification if the worker fails to load (e.g. strict MIME on static hosts).
 */

import type {
  TransitionVerificationRequest,
  TransitionVerificationResponse,
  MatchInfo,
} from '@/workers/transitionVerificationWorker';
import { buildRuleIndex, getRulesForTransition } from '@/lib/inferenceRules/ruleIndex';
import { ruleStatistics } from '@/lib/inferenceRules/ruleStatistics';
import { diagnoseFailure } from '@/lib/inferenceRules/errorDiagnosis';
import { normalizeSpacing } from '@/lib/inferenceRules/utils';
import { checkInferenceRules } from '@/lib/inferenceRules';

// Relative path so Vite resolves the worker correctly in dev and production (avoids alias/MIME issues)
const WORKER_URL = new URL('../workers/transitionVerificationWorker.ts', import.meta.url);
const FALSE_RESULT_CACHE_MAX = 500;

/** When true, worker failed to load (e.g. 404 or wrong MIME); use main-thread verification. */
let workerFailed = false;

/** Cache for transition verification false results (key = normalized left + "\\n---\\n" + normalized right). */
const falseResultCache = new Map<string, VerifyTransitionResult>();
const PARALLEL_WORKERS = Math.min(4, Math.max(1, navigator.hardwareConcurrency ?? 4));

const workerPool: Worker[] = [];
let poolIndex = 0;

function getWorkerFromPool(): Worker | null {
  if (workerFailed) return null;
  try {
    if (workerPool.length < PARALLEL_WORKERS) {
      workerPool.push(new Worker(WORKER_URL, { type: 'module' }));
    }
    const w = workerPool[poolIndex % workerPool.length];
    poolIndex += 1;
    return w;
  } catch {
    workerFailed = true;
    return null;
  }
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
): Promise<{ matched: boolean; response: TransitionVerificationResponse }> {
  const id = `${baseId}-${chunkIndex}`;
  return new Promise((resolve, reject) => {
    const handler = (e: MessageEvent<TransitionVerificationResponse>) => {
      if (!e.data.id.startsWith(baseId) || e.data.id !== id) return;
      worker.removeEventListener('message', handler);
      worker.removeEventListener('error', errorHandler);
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else {
        resolve({ matched: e.data.matched, response: e.data });
      }
    };

    const errorHandler = (ev: ErrorEvent) => {
      workerFailed = true;
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

export interface VerifyTransitionResult {
  matched: boolean;
  /** When matched: which rule and where it matched (for collapsible success details). */
  matchInfo?: MatchInfo;
  diagnosis?: import('@/lib/inferenceRules/errorDiagnosis').DiagnosisResult;
}

/** Run transition verification on the main thread (fallback when worker fails to load). */
function verifyTransitionMainThread(
  targetLeft: string,
  targetRight: string,
  rules: Array<{ id: string; leftSide: string; rightSide: string }>,
  index: ReturnType<typeof buildRuleIndex>,
  rulesToTry: Array<{ id: string; leftSide: string; rightSide: string }>
): VerifyTransitionResult {
  const rulesTried: Array<{ ruleId: string; matched: boolean; matchTime: number }> = [];
  for (const rule of rulesToTry) {
    const ruleStartTime = performance.now();
    const result = checkInferenceRules(
      targetLeft,
      targetRight,
      rule.leftSide,
      rule.rightSide,
      { dagCache: index.dagCache }
    );
    const ruleMatchTime = performance.now() - ruleStartTime;
    rulesTried.push({ ruleId: rule.id, matched: result.match, matchTime: ruleMatchTime });
    ruleStatistics.recordAttempt(rule.id, ruleMatchTime, result.match);
    if (result.match) {
      const pos = result.matchPosition;
      return {
        matched: true,
        matchInfo: {
          matchedRuleId: rule.id,
          description: pos?.description,
          startPosition: pos?.position,
          side: pos?.side,
          ruleLeft: rule.leftSide,
          ruleRight: rule.rightSide,
          inferenceRuleName: result.inferenceRule,
          nodeMap: pos?.nodeMapping ? Object.fromEntries(pos.nodeMapping) : undefined,
        },
      };
    }
  }
  const diagnosis = diagnoseFailure(targetLeft, targetRight, rulesTried, rules, index);
  return { matched: false, diagnosis };
}

function cacheFalseResult(key: string, result: VerifyTransitionResult): void {
  if (falseResultCache.size >= FALSE_RESULT_CACHE_MAX) {
    const first = falseResultCache.keys().next().value;
    if (first !== undefined) falseResultCache.delete(first);
  }
  falseResultCache.set(key, result);
}

export function verifyTransitionWorker(
  params: VerifyTransitionParams
): Promise<VerifyTransitionResult> {
  const baseId = `tv-${++requestId}`;
  const { targetLeft, targetRight, rules } = params;

  const cacheKey = normalizeSpacing(targetLeft) + '\n---\n' + normalizeSpacing(targetRight);
  const cached = falseResultCache.get(cacheKey);
  if (cached !== undefined) return Promise.resolve(cached);

  // Build index and get filtered rules on main thread (fast, no VF2)
  const index = buildRuleIndex(rules);
  const rulesToTry = getRulesForTransition(index, targetLeft, targetRight);

  if (rulesToTry.length === 0) {
    // Generate diagnosis for no rules case
    const diagnosis = diagnoseFailure(targetLeft, targetRight, [], rules, index);
    const result: VerifyTransitionResult = { matched: false, diagnosis };
    cacheFalseResult(cacheKey, result);
    return Promise.resolve(result);
  }

  // Fallback when worker failed to load (e.g. 404 or wrong MIME on static host)
  if (workerFailed) {
    const result = verifyTransitionMainThread(targetLeft, targetRight, rules, index, rulesToTry);
    if (!result.matched) cacheFalseResult(cacheKey, result);
    return Promise.resolve(result);
  }

  // Split into parallel chunks
  const chunkCount = Math.min(PARALLEL_WORKERS, rulesToTry.length);
  const chunkSize = Math.ceil(rulesToTry.length / chunkCount);
  const chunks: Array<Array<{ id: string; leftSide: string; rightSide: string }>> = [];
  for (let i = 0; i < chunkCount; i++) {
    const chunk = rulesToTry.slice(i * chunkSize, (i + 1) * chunkSize);
    if (chunk.length > 0) chunks.push(chunk);
  }

  if (chunks.length === 0) {
    const diagnosis = diagnoseFailure(targetLeft, targetRight, [], rules, index);
    const result: VerifyTransitionResult = { matched: false, diagnosis };
    cacheFalseResult(cacheKey, result);
    return Promise.resolve(result);
  }
  
  if (chunks.length === 1) {
    const w = getWorkerFromPool();
    if (!w) {
      const result = verifyTransitionMainThread(targetLeft, targetRight, rules, index, rulesToTry);
      if (!result.matched) cacheFalseResult(cacheKey, result);
      return Promise.resolve(result);
    }
    return verifyChunk(
      w,
      baseId,
      0,
      targetLeft,
      targetRight,
      chunks[0]
    ).then(({ matched, response }) => {
      // Track statistics for all rules tried
      if (response.rulesTried) {
        for (const { ruleId, matched: ruleMatched, matchTime } of response.rulesTried) {
          ruleStatistics.recordAttempt(ruleId, matchTime, ruleMatched);
        }
      }
      
      // Generate diagnosis if no match
      if (!matched && response.rulesTried) {
        const diagnosis = diagnoseFailure(targetLeft, targetRight, response.rulesTried, rules, index);
        const result: VerifyTransitionResult = { matched: false, diagnosis };
        cacheFalseResult(cacheKey, result);
        return result;
      }
      
      return { matched: true, matchInfo: response.matchInfo };
    });
  }

  // Run chunks in parallel; resolve true as soon as any matches, false when all done
  const workers = chunks.map(() => getWorkerFromPool());
  if (workers.some((w) => w === null)) {
    const result = verifyTransitionMainThread(targetLeft, targetRight, rules, index, rulesToTry);
    if (!result.matched) cacheFalseResult(cacheKey, result);
    return Promise.resolve(result);
  }

  return new Promise((resolve, reject) => {
    let settled = 0;
    let foundMatch = false;
    let rejected = false;
    const allRulesTried: Array<{ ruleId: string; matched: boolean; matchTime: number }> = [];

    const maybeSettle = () => {
      if (foundMatch) return;
      if (rejected) return;
      settled += 1;
      if (settled === chunks.length) {
        // All chunks done, generate diagnosis
        const diagnosis = diagnoseFailure(targetLeft, targetRight, allRulesTried, rules, index);
        const result: VerifyTransitionResult = { matched: false, diagnosis };
        cacheFalseResult(cacheKey, result);
        resolve(result);
      }
    };

    chunks.forEach((chunk, i) => {
      verifyChunk(
        workers[i]!,
        baseId,
        i,
        targetLeft,
        targetRight,
        chunk
      )
        .then(({ matched, response }) => {
          // Track statistics for all rules tried in this chunk
          if (response.rulesTried) {
            for (const { ruleId, matched: ruleMatched, matchTime } of response.rulesTried) {
              ruleStatistics.recordAttempt(ruleId, matchTime, ruleMatched);
              allRulesTried.push({ ruleId, matched: ruleMatched, matchTime });
            }
          }
          
          if (matched) {
            foundMatch = true;
            resolve({ matched: true, matchInfo: response.matchInfo });
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
