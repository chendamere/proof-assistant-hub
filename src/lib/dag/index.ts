/**
 * DAG module for expression-to-DAG conversion and subgraph isomorphism
 */

export type { DAGNode, DAGEdge, DAGStructure, ExprNodeData, BranchKind, EdgeType } from './types';
export { exprToDAG } from './exprToDAG';
export { dagToExpr } from './dagToExpr';
export { SingleRootDAGInjection } from './vf2Expr';
export { substituteInDAG } from './dagSubstitute';
export { extractSubgraphFromNode, augmentTargetDAGForTcMatching, countOperations, extractOperators, patternOpMultisetContainedInTarget } from './utils';
