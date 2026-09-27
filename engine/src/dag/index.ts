/**
 * DAG module for expression-to-DAG conversion and subgraph isomorphism
 */

export type { DAGNode, DAGEdge, DAGStructure, ExprNodeData, BranchKind, EdgeType } from './types';
export { exprToDAG } from './exprToDAG';
export { dagToExpr } from './dagToExpr';
export { SingleRootDAGInjection } from './DAGInjection';
export { computeTcMappings, hasTcInPattern, buildPatternWithTcChains, eachTcMappingChoice, type TcMappingOptions, type TcChainContent } from './TcMapping';
export { substituteInDAG, substituteInDAGPartialFactor, getPrefixAndSuffixDAG } from './dagSubstitute';
export { extractSubgraphFromNode, extractSubgraphFromNodeExcludingTail, extractSubgraphIncomingFromNode, countOperations, extractOperators, patternOpMultisetContainedInTarget, trimEdges } from './utils';
