/**
 * Convert DAG back to expression string.
 * Supports operand substitution via mapping (rule vars -> target operands).
 */

import type { DAGStructure, ExprNodeData, BranchKind } from './types';
import { buildAdjacency } from './utils';
import { ensureCommaWrapped } from '../inferenceRules/utils';

/** Unary ops written "operand op" in axioms/theorems (e.g. m \Os). \Ot stays "op operand" (\Ot m). */
const OPERAND_FIRST_UNARY_OPS = new Set(['\\Os', '\\Oc', '\\Od', '\\Ob', '\\Og', '\\Oa']);

function formatOp(data: ExprNodeData, subst?: Map<string, string>, literalTc?: boolean): string {
  const op = data.op;
  if (op.endsWith(':tail') || op.includes(':cond')) return '';
  const ops = (data.operands ?? []).map((o) => subst?.get(o) ?? o);
  // When literalTc is true (default): output "\Tc operand" (never plain operand when no \Tc in pattern).
  // When literalTc is false: output just operand (only when rule \Tc placeholder expands to content).
  if (op === '\\Tc' && ops.length === 1) return literalTc ? `\\Tc ${ops[0]}` : ops[0];
  // \+ (plus): "a+b:c" form (3 operands: left, right, result)
  if (op === '\\+' && ops.length === 3) return `${ops[0]}+${ops[1]}:${ops[2]}`;
  // \times: "a \times b : c" form (3 operands: left, right, result)
  if (op === '\\times' && ops.length === 3) return `${ops[0]} \\times ${ops[1]} : ${ops[2]}`;
  if (ops.length >= 2) return `${ops[0]} ${op} ${ops[1]}`;
  if (ops.length === 1 && OPERAND_FIRST_UNARY_OPS.has(op)) return `${ops[0]} ${op}`;
  if (ops.length === 1) return `${op} ${ops[0]}`;
  return op;
}

/** Format condition for display: wrap in if(...) so display shows "if(i \Pe j)" while data stores only the inner condition. */
function formatCond(data: ExprNodeData, subst?: Map<string, string>): string {
  const op = data.op;
  const ops = (data.operands ?? []).map((o) => subst?.get(o) ?? o);
  let inner = '';
  if (op.includes(':cond:')) {
    const match = op.match(/:cond:(.+)$/);
    const innerOp = match ? match[1] : '';
    if (ops.length >= 2) inner = `${ops[0]} ${innerOp} ${ops[1]}`;
    else if (ops.length === 1) inner = `${ops[0]} ${innerOp}`;
    else inner = innerOp;
  } else {
    inner = (ops.join(' ')).trim();
  }
  return inner ? `if(${inner})` : '';
}

/** Options for dagToExpr. literalTc: when true (default), serialize \Tc as "\\Tc operand"; when false, as just operand. We never want plain operands when there is no \\Tc in pattern. */
export type DagToExprOptions = { literalTc?: boolean };

/**
 * Convert DAG back to expression string with optional operand substitution.
 * @param structure - The DAG (e.g. from exprToDAG of rule's other side)
 * @param operandMapping - Map rule operand -> target operand (e.g. i->1, m->2)
 * @param options - literalTc: true (default) to always output "\\Tc operand"; false only when rule \\Tc expands to content
 */
export function dagToExpr(
  structure: DAGStructure<ExprNodeData>,
  operandMapping?: Map<string, string>,
  options?: DagToExprOptions
): string {
  if (structure.nodes.length === 0) return ',';

  const literalTc = options?.literalTc ?? true;
  const nodeMap = new Map(structure.nodes.map((n) => [n.id, n]));
  const adj = buildAdjacency(structure);
  const { outgoing } = adj;
  const edgeTypeMap = new Map<string, number>();
  for (const e of structure.edges) {
    edgeTypeMap.set(`${e.from}\0${e.to}`, (e.edgeType ?? 0) as number);
  }
  /** Get cond's arm children sorted by edge type (1=top before 2=bottom). When cond has arm edges (1,2), use only those. */
  function getCondChildrenSorted(condId: string): string[] {
    const children = outgoing.get(condId) ?? [];
    if (children.length <= 1) return children;
    const withType = children.map((c) => ({ id: c, et: edgeTypeMap.get(`${condId}\0${c}`) ?? 0 }));
    const armChildren = withType.filter((x) => x.et === 1 || x.et === 2);
    const use = armChildren.length >= 2 ? armChildren : withType;
    use.sort((a, b) => {
      const order = (et: number) => (et === 1 || et === 3 ? 0 : et === 2 || et === 4 ? 1 : 2);
      return order(a.et) - order(b.et) || a.et - b.et;
    });
    return use.map((x) => x.id);
  }

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
      const s = formatOp(data, operandMapping, literalTc);
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
      const children = getCondChildrenSorted(startId);
      const kind = inferBranchKind(data!, children);
      const cond = formatCond(data!, operandMapping);
      const topStr = children[0] ? serializeArmContent(children[0]) : ',';
      const botStr = children[1] ? serializeArmContent(children[1]) : ',';
      const inner = `\\${kind}{${cond}}{${topStr}}{${botStr}}`;
      return ',' + inner + ',';
    }
    const { parts, nextId } = serializeChainUntilBranch(startId);
    let result = parts.length ? ',' + parts.join(', ') + ',' : ',';
    // Chain may end at a nested branch (e.g. prefix-arms merge: repl arm -> target arm with nested \Bb)
    if (nextId) {
      const nextOp = (nodeMap.get(nextId)?.data as ExprNodeData)?.op ?? '';
      if (nextOp.includes(':cond')) {
        const inner = serializeArmContent(nextId);
        // Insert comma between chain and nested branch so format is ",op,\Bb{...}," not ",op\Bb{...},"
        const branchContent = inner === ',' ? '' : inner.slice(1, -1);
        result = result.slice(0, -1) + (branchContent ? ',' + branchContent : '') + ',';
      }
    }
    return result;
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
      const children = getCondChildrenSorted(id);
      if (children.length < 1) {
        const kind = (data as ExprNodeData & { branchKind?: BranchKind })?.branchKind ?? 'Blb';
        itemParts.push(`, \\${kind}{${formatCond(data!, operandMapping)}}{,}{,}`);
        return [];
      }
      const kind = inferBranchKind(data!, children);
      const cond = formatCond(data!, operandMapping);
      let topStr = children[0] ? serializeArmContent(children[0]) : ',';
      let botStr = children[1] ? serializeArmContent(children[1]) : ',';
      // Normalize arm order: empty arm first (e.g. {,}{\Or,}) so substitution results match expected.
      if (topStr !== ',' && botStr === ',') [topStr, botStr] = [botStr, topStr];
      itemParts.push(`, \\${kind}{${cond}}{${topStr}}{${botStr}}`);
      if (kind === 'Bb' && children[0]) {
        const firstChild = children[0];
        const firstChildOp = (nodeMap.get(firstChild)?.data as ExprNodeData)?.op ?? '';
        // When top arm is empty, cond points directly to tail, so firstChild is the tail.
        const tailId = firstChildOp.endsWith(':tail')
          ? firstChild
          : (outgoing.get(firstChild) ?? []).find(
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

  // Brb/Brs: two roots that both lead to the same tail (no cond node)
  let worklist = [...roots];
  if (roots.length === 2 && isBrbDualRoots(roots[0], roots[1])) {
    const [r0, r1] = roots;
    visited.add(r0);
    visited.add(r1);
    const topParts = serializeChainUntilBranch(r0).parts;
    const botParts = serializeChainUntilBranch(r1).parts;
    const topStr = topParts.length ? ',' + topParts.join(', ') + ',' : '';
    const botStr = botParts.length ? ',' + botParts.join(', ') + ',' : '';
    const tailKind = getReachableTailBranchKind([r0, r1]);
    const brOp = tailKind === 'Brs' ? 'Brs' : 'Brb';
    itemParts.push(`, \\${brOp}{${topStr}}{${botStr}}`);
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
  return ensureCommaWrapped(joined);
}
