/**
 * Convert DAG back to expression string.
 * Supports operand substitution via mapping (rule vars -> target operands).
 */

import type { DAGStructure, ExprNodeData } from './types';

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
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of structure.nodes) {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  }
  for (const e of structure.edges) {
    outgoing.get(e.from)!.push(e.to);
    incoming.get(e.to)!.push(e.from);
  }

  const roots = structure.nodes
    .filter((n) => (incoming.get(n.id)?.length ?? 0) === 0)
    .map((n) => n.id);

  const itemParts: string[] = [];
  const visited = new Set<string>();

  function serializeChain(startId: string): { parts: string[]; nextId: string | null } {
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

  function serializeArm(startId: string): string[] {
    const parts: string[] = [];
    let cur: string | null = startId;
    while (cur) {
      if (visited.has(cur)) break;
      const node = nodeMap.get(cur);
      const data = node?.data as ExprNodeData | undefined;
      const op = data?.op ?? '';
      if (!data || op.endsWith(':tail') || op.includes(':cond')) break;
      visited.add(cur);
      const s = formatOp(data!, operandMapping);
      if (s) parts.push(s);
      const next = outgoing.get(cur) ?? [];
      if (next.length !== 1) break;
      cur = next[0];
    }
    return parts;
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

    if (op.includes(':cond') && (outgoing.get(id)?.length ?? 0) >= 2) {
      visited.add(id);
      const children = outgoing.get(id) ?? [];
      const isBlb = op.startsWith('\\Blb');
      const isBrb = op.startsWith('\\Brb');
      const kind = isBlb ? 'Blb' : isBrb ? 'Brb' : 'Bb';
      const cond = formatCond(data!, operandMapping);
      const topParts = serializeArm(children[0]);
      const botParts = serializeArm(children[1]);
      const topStr = topParts.length ? ',' + topParts.join(', ') + ',' : '';
      const botStr = botParts.length ? ',' + botParts.join(', ') + ',' : '';
      itemParts.push(`, \\${kind}{${cond}}{${topStr}}{${botStr}}`);
      if (kind === 'Bb' || kind === 'Brb') {
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

    const { parts, nextId } = serializeChain(id);
    if (parts.length) {
      itemParts.push(', ' + parts.join(', '));
    }
    if (nextId) nextIds.push(nextId);
    return nextIds;
  }

  let worklist = [...roots];
  while (worklist.length) {
    const id = worklist.shift()!;
    const next = processFrom(id);
    worklist = [...next.filter((n) => !visited.has(n)), ...worklist];
  }

  const joined = itemParts.join('');
  return (joined.startsWith(',') ? joined : ',' + joined) + (joined ? ',' : '');
}
