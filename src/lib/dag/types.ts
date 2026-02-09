/**
 * Directed Acyclic Graph (DAG) Types
 * Adapted from UL_DAG for expression-to-DAG conversion
 */

export interface DAGNode<T = unknown> {
  id: string;
  data?: T;
}

/** Edge type for branch structure: 0=chain/empty, 1=cond→top, 2=cond→bottom, 3=top→tail, 4=bottom→tail */
export type EdgeType = 0 | 1 | 2 | 3 | 4;

export interface DAGEdge {
  from: string;
  to: string;
  /** Branch role: 0=chain or empty arm, 1=cond→first of top arm, 2=cond→first of bottom, 3=last of top→tail, 4=last of bottom→tail */
  edgeType?: EdgeType;
}

export interface DAGStructure<T = unknown> {
  nodes: DAGNode<T>[];
  edges: DAGEdge[];
}

export type BranchKind = 'Bb' | 'Blb' | 'Brb' | 'Brs';

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
