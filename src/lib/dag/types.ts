/**
 * Directed Acyclic Graph (DAG) Types
 * Adapted from UL_DAG for expression-to-DAG conversion
 */

export interface DAGNode<T = unknown> {
  id: string;
  data?: T;
}

export interface DAGEdge {
  from: string;
  to: string;
}

export interface DAGStructure<T = unknown> {
  nodes: DAGNode<T>[];
  edges: DAGEdge[];
}

export interface DAGValidationResult {
  isValid: boolean;
  isAcyclic: boolean;
  cycles?: string[][];
  orphanNodes?: string[];
  missingReferences?: { edge: DAGEdge; missing: 'from' | 'to' }[];
}

/** Node data for expression DAG: operator + operands (ordered) */
export interface ExprNodeData {
  op: string;         // e.g. "\\Oc", "\\Bb"
  operands: string[]; // ordered: ["1","2"] or ["A","B"] for pattern
  /** Character range in original expression (for target DAG) */
  start?: number;
  end?: number;
}
