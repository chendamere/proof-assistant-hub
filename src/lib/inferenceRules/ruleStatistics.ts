/**
 * Rule statistics tracker for learning-based prioritization.
 * Tracks success rates and match times to improve rule ordering.
 */

export interface RuleStatistics {
  /** Rule ID */
  ruleId: string;
  /** Total attempts */
  attempts: number;
  /** Successful matches */
  successes: number;
  /** Average time to match (ms) - only for successful matches */
  avgMatchTime: number;
  /** Failed attempts (rejects); optional for backward compatibility with stored stats */
  rejectCount?: number;
  /** Average time to reject (ms) - only for failed attempts; try fast-reject rules first */
  avgRejectTime?: number;
}

export class RuleStatisticsTracker {
  private stats = new Map<string, RuleStatistics>();
  private readonly STORAGE_KEY = 'proof-assistant-rule-stats';

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Record a rule attempt
   * @param ruleId - The rule ID
   * @param matchTime - Time taken to check the rule (ms)
   * @param matched - Whether the rule matched
   */
  recordAttempt(ruleId: string, matchTime: number, matched: boolean): void {
    const current = this.stats.get(ruleId) || {
      ruleId,
      attempts: 0,
      successes: 0,
      avgMatchTime: 0,
      rejectCount: 0,
      avgRejectTime: 0,
    };

    current.attempts++;
    if (matched) {
      current.successes++;
      // Update average match time using exponential moving average
      const alpha = 0.1; // smoothing factor
      if (current.avgMatchTime === 0) {
        current.avgMatchTime = matchTime;
      } else {
        current.avgMatchTime = current.avgMatchTime * (1 - alpha) + matchTime * alpha;
      }
    } else {
      current.rejectCount = (current.rejectCount ?? 0) + 1;
      const rejAlpha = 0.1;
      if (current.avgRejectTime === 0) {
        current.avgRejectTime = matchTime;
      } else {
        current.avgRejectTime =
          (current.avgRejectTime ?? 0) * (1 - rejAlpha) + matchTime * rejAlpha;
      }
    }

    this.stats.set(ruleId, current);
    this.saveToStorage();
  }

  /**
   * Get success rate for a rule (0-1)
   */
  getSuccessRate(ruleId: string): number {
    const stat = this.stats.get(ruleId);
    if (!stat || stat.attempts === 0) return 0.5; // Default to neutral for new rules
    return stat.successes / stat.attempts;
  }

  /**
   * Get priority score for a rule (0-1, higher = more likely to succeed)
   * Combines success rate with confidence based on number of attempts
   */
  getPriorityScore(ruleId: string): number {
    const stat = this.stats.get(ruleId);
    if (!stat) return 0.5; // Neutral default for unknown rules

    // Success rate
    const successRate = this.getSuccessRate(ruleId);
    
    // Confidence increases with more attempts (capped at 10 attempts)
    const confidence = Math.min(stat.attempts / 10, 1);
    
    // Combine: high success rate + high confidence = high priority
    // For low confidence, blend with neutral (0.5)
    return successRate * confidence + 0.5 * (1 - confidence);
  }

  /**
   * Get average time (ms) to reject for a rule when it doesn't match.
   * Lower = try first when we want to burn through quick rejects.
   * Returns Infinity if no reject data so unknown rules sort last.
   */
  getAvgRejectTime(ruleId: string): number {
    const stat = this.stats.get(ruleId);
    if (!stat || (stat.rejectCount ?? 0) === 0) return Infinity;
    return stat.avgRejectTime ?? Infinity;
  }

  /**
   * Get statistics for a rule (for debugging/display)
   */
  getStatistics(ruleId: string): RuleStatistics | undefined {
    return this.stats.get(ruleId);
  }

  /**
   * Get all statistics (for debugging/display)
   */
  getAllStatistics(): RuleStatistics[] {
    return Array.from(this.stats.values());
  }

  /**
   * Reset statistics for a specific rule
   */
  resetRule(ruleId: string): void {
    this.stats.delete(ruleId);
    this.saveToStorage();
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.stats.clear();
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const data = Array.from(this.stats.values());
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      }
    } catch (e) {
      console.warn('Failed to save rule statistics:', e);
    }
  }

  private loadFromStorage(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          const data: RuleStatistics[] = JSON.parse(stored);
          for (const stat of data) {
            this.stats.set(stat.ruleId, stat);
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load rule statistics:', e);
    }
  }
}

// Singleton instance
export const ruleStatistics = new RuleStatisticsTracker();
