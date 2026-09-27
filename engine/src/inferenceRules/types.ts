/**
 * Types and interfaces for inference rules
 */

import type { DAGStructure, ExprNodeData } from '../dag/types';

export interface MatchPosition {
  side: 'left' | 'right' | 'both';
  position?: number;
  description: string;
  prefix?: string;
  suffix?: string;
  operandMapping?: Map<string, string>; // Maps ruleSide operand numbers to target operand numbers (for pattern matching)
  wasPatternMatch?: boolean; // Indicates if this match was via pattern matching
  /** For DAG-based substitution: structural boundaries instead of character positions */
  targetDAG?: DAGStructure<ExprNodeData>;
  patternDAG?: DAGStructure<ExprNodeData>;
  nodeMapping?: Map<string, string>; // patternNodeId -> targetNodeId (VF2 result)
  /** Unmatched target nodes (op|operands) when check passed; context that stayed the same. */
  unmatchedTargetNodeSignatures?: string[];
  /** When rule has \\Tc: operand → target expression(s) it mapped to (for display). */
  tcMapping?: Record<string, string[]>;
}

export interface InferenceRuleContext {
  stepCounter?: { count: number };
  dagCache?: Map<string, DAGStructure<ExprNodeData>>;
}

export interface InferenceRule {
  name: string;
  description: string;
  check: (
    targetLeft: string,
    targetRight: string,
    ruleLeft: string,
    ruleRight: string,
    context?: InferenceRuleContext
  ) => { match: boolean; position?: MatchPosition };
}
