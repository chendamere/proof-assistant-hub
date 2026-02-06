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

export type BranchKind = 'Bb' | 'Blb' | 'Brb';

/** Node data for expression DAG: operator + operands (ordered) */
export interface ExprNodeData {
  op: string;         // e.g. "\\Oc", ":cond:\\Oe", ":tail" (branch head by :cond, tail by :tail)
  operands: string[]; // for ops: ordered operands; for cond head: [condition]
  /** Character range in original expression (for target DAG) */
  start?: number;
  end?: number;
  /** Branch kind from source expression; used when serializing to prefer target's kind over inferred */
  branchKind?: BranchKind;
}
