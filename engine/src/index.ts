/**
 * Proof engine public API.
 *
 * The website imports this package. This package does not import the website,
 * so the same code can run from a terminal (see cli.ts) and, later, a standalone executable.
 */

export {
  checkInferenceRules,
  InferenceRules,
  generateSubexpressions,
  formatBranchTree,
  oeToPeInExpression,
  peToOeInExpression,
  proofStepsOeToPe,
} from './inferenceRules/index';
export type { CheckInferenceRulesOptions, MatchPosition, InferenceRule } from './inferenceRules/index';

export { normalizeSpacing, ensureCommaWrapped } from './inferenceRules/utils';
export { trySubstitutionByMatchPairs } from './inferenceRules/substitution';
export { buildRuleIndex, getRulesForTransition } from './inferenceRules/ruleIndex';
export type { IndexedRule, RuleIndex } from './inferenceRules/ruleIndex';
export { diagnoseFailure } from './inferenceRules/errorDiagnosis';
export type { DiagnosisResult } from './inferenceRules/errorDiagnosis';
export { ruleStatistics } from './inferenceRules/ruleStatistics';

export {
  exprToDAG,
  dagToExpr,
  SingleRootDAGInjection,
  countOperations,
} from './dag/index';
export type { DAGStructure, ExprNodeData, DAGNode, DAGEdge } from './dag/index';

export { checkGrammar } from './grammarChecker';
export type { GrammarError, GrammarCheckResult } from './grammarChecker';

export { normalizeOperands, normalizeRule } from './operandNormalizer';
export type { NormalizedOperand, NormalizationResult } from './operandNormalizer';
