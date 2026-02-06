/**
 * Convert DAG back to expression string.
 * Supports operand substitution via mapping (rule vars -> target operands).
 */

import type { DAGStructure, ExprNodeData, BranchKind } from './types';
import { buildAdjacency } from './utils';

function formatOp(data: ExprNodeData, subst?: Map<string, string>): string {
  const op = data.op;
  if (op.endsWith(':tail') || op.includes(':cond')) return '';
  const ops = (data.operands ?? []).map((o) => subst?.get(o) ?? o);
  if (ops.length >= 2) return `${ops[0]} ${op} ${ops[1]}`;
  if (ops.length === 1) return `${ops[0]} ${op}`;
  return op;
}

function formatCond(data: ExprNodeData, subst?: Map<string, string>): string {
  const op = data.op;
  const ops = (data.operands ?? []).map((o) => subst?.get(o) ?? o);
  if (op.includes(':cond:')) {
    const match = op.match(/:cond:(.+)$/);
    const innerOp = match ? match[1] : '';
    if (ops.length >= 2) return `${ops[0]} ${innerOp} ${ops[1]}`;
    if (ops.length === 1) return `${ops[0]} ${innerOp}`;
  }
  return (ops.join(' ')).trim();
}

/**
 * Convert DAG to expression string with optional operand substitution.
 * @param structure - The DAG (e.g. from exprToDAG of rule's other side)
 * @param operandMapping - Map rule operand -> target operand (e.g. i->1, m->2)
 */
export function dagToExpr(
  structure: DAGStructure<ExprNodeData>,
  operandMapping?: Map<string, string>
): string {
  if (structure.nodes.length === 0) return '';

  const nodeMap = new Map(structure.nodes.map((n) => [n.id, n]));
  const adj = buildAdjacency(structure);
  const { outgoing } = adj;

  const roots = structure.nodes
    .filter((n) => (adj.incoming.get(n.id)?.length ?? 0) === 0)
    .map((n) => n.id);

  const itemParts: string[] = [];
  const visited = new Set<string>();

  /** Set of :tail node ids reachable from id. */
  function findTailsReachableFrom(id: string): Set<string> {
    const hits = new Set<string>();
    const stack = [id];
    const seen = new Set(stack);
    while (stack.length) {
      const cur = stack.pop()!;
      const op = (nodeMap.get(cur)?.data as ExprNodeData)?.op ?? '';
      if (op.endsWith(':tail')) hits.add(cur);
      for (const c of outgoing.get(cur) ?? []) {
        if (!seen.has(c)) {
          seen.add(c);
          stack.push(c);
        }
      }
    }
    return hits;
  }

  function reachesTail(id: string): boolean {
    return findTailsReachableFrom(id).size > 0;
  }

  function armsLeadToTail(children: string[]): boolean {
    if (children.length < 2) return false;
    return reachesTail(children[0]) && reachesTail(children[1]);
  }

  /** Get branchKind from the first reachable tail node (for target kind when substituting Blb in Bb). */
  function getReachableTailBranchKind(children: string[]): BranchKind | undefined {
    const stack = [...children];
    const seen = new Set(children);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      const node = nodeMap.get(cur);
      const data = node?.data as (ExprNodeData & { branchKind?: BranchKind }) | undefined;
      const op = data?.op ?? '';
      if (op.endsWith(':tail') && data?.branchKind) return data.branchKind;
      for (const c of outgoing.get(cur) ?? []) {
        if (!seen.has(c)) {
          seen.add(c);
          stack.push(c);
        }
      }
    }
    return undefined;
  }

  /** Do these two roots both reach the same :tail? */
  function isBrbDualRoots(r0: string, r1: string): boolean {
    const t0 = findTailsReachableFrom(r0);
    const t1 = findTailsReachableFrom(r1);
    for (const t of t0) {
      if (t1.has(t)) return true;
    }
    return false;
  }

  /** Infer Bb/Blb/Brb from cond node and children. */
  function inferBranchKind(
    condData: ExprNodeData,
    children: string[]
  ): BranchKind {
    const hasTail = children.length >= 2 ? armsLeadToTail(children) : reachesTail(children[0]);
    const kind: BranchKind = hasTail ? 'Bb' : 'Blb';
    const tailKind = getReachableTailBranchKind(children);
    if (tailKind) return tailKind;
    const condBranchKind = (condData as ExprNodeData & { branchKind?: BranchKind })?.branchKind;
    return condBranchKind ?? kind;
  }

  /** Serialize ops in a chain until cond/tail/fork; returns parts and nextId (or null). */
  function serializeChainUntilBranch(startId: string): { parts: string[]; nextId: string | null } {
    const parts: string[] = [];
    let cur: string | null = startId;
    while (cur) {
      if (visited.has(cur)) break;
      const node = nodeMap.get(cur);
      const data = node?.data as ExprNodeData | undefined;
      const op = data?.op ?? '';
      if (!data || op.endsWith(':tail') || op.includes(':cond')) break;
      visited.add(cur);
      const s = formatOp(data, operandMapping);
      if (s) parts.push(s);
      const next = outgoing.get(cur) ?? [];
      if (next.length !== 1) break;
      cur = next[0];
    }
    return { parts, nextId: cur };
  }

  /** Serialize arm content: either ops (comma-separated) or a nested branch. Returns string for braced content. */
  function serializeArmContent(startId: string): string {
    const node = nodeMap.get(startId);
    const data = node?.data as ExprNodeData | undefined;
    const op = data?.op ?? '';
    if (op.endsWith(':tail')) return ','; // empty arm
    if (op.includes(':cond') && (outgoing.get(startId)?.length ?? 0) >= 1) {
      const children = outgoing.get(startId) ?? [];
      const kind = inferBranchKind(data!, children);
      const cond = formatCond(data!, operandMapping);
      const topStr = children[0] ? serializeArmContent(children[0]) : ',';
      const botStr = children[1] ? serializeArmContent(children[1]) : ',';
      const inner = `\\${kind}{${cond}}{${topStr}}{${botStr}}`;
      return ',' + inner + ',';
    }
    const { parts } = serializeChainUntilBranch(startId);
    return parts.length ? ',' + parts.join(', ') + ',' : ',';
  }

  function processFrom(id: string): string[] {
    const nextIds: string[] = [];
    if (visited.has(id)) return nextIds;
    const node = nodeMap.get(id);
    const data = node?.data as ExprNodeData | undefined;
    const op = data?.op ?? '';

    if (op.endsWith(':tail')) {
      visited.add(id);
      return [...(outgoing.get(id) ?? [])];
    }

    if (op.includes(':cond')) {
      visited.add(id);
      const children = outgoing.get(id) ?? [];
      if (children.length < 1) {
        const kind = (data as ExprNodeData & { branchKind?: BranchKind })?.branchKind ?? 'Blb';
        itemParts.push(`, \\${kind}{${formatCond(data!, operandMapping)}}{,}{,}`);
        return [];
      }
      const kind = inferBranchKind(data!, children);
      const cond = formatCond(data!, operandMapping);
      const topStr = children[0] ? serializeArmContent(children[0]) : ',';
      const botStr = children[1] ? serializeArmContent(children[1]) : ',';
      itemParts.push(`, \\${kind}{${cond}}{${topStr}}{${botStr}}`);
      if (kind === 'Bb' && children[0]) {
        const tailId = (outgoing.get(children[0]) ?? []).find(
          (c) => (nodeMap.get(c)?.data as ExprNodeData)?.op?.endsWith(':tail')
        );
        if (tailId) {
          visited.add(tailId);
          return [...(outgoing.get(tailId) ?? [])];
        }
      }
      return [];
    }

    const { parts, nextId } = serializeChainUntilBranch(id);
    if (parts.length) itemParts.push(', ' + parts.join(', '));
    if (nextId) nextIds.push(nextId);
    return nextIds;
  }

  // Brb: two roots that both lead to the same tail (no cond node)
  let worklist = [...roots];
  if (roots.length === 2 && isBrbDualRoots(roots[0], roots[1])) {
    const [r0, r1] = roots;
    visited.add(r0);
    visited.add(r1);
    const topParts = serializeChainUntilBranch(r0).parts;
    const botParts = serializeChainUntilBranch(r1).parts;
    const topStr = topParts.length ? ',' + topParts.join(', ') + ',' : '';
    const botStr = botParts.length ? ',' + botParts.join(', ') + ',' : '';
    itemParts.push(`, \\Brb{${topStr}}{${botStr}}`);
    const tailId = (outgoing.get(r0) ?? []).find(
      (c) => (nodeMap.get(c)?.data as ExprNodeData)?.op?.endsWith(':tail')
    );
    if (tailId) {
      visited.add(tailId);
      worklist = [...(outgoing.get(tailId) ?? [])];
    } else {
      worklist = [];
    }
  }

  while (worklist.length) {
    const id = worklist.shift()!;
    const next = processFrom(id);
    worklist = [...next.filter((n) => !visited.has(n)), ...worklist];
  }

  const joined = itemParts.join('');
  return (joined.startsWith(',') ? joined : ',' + joined) + (joined ? ',' : '');
}
