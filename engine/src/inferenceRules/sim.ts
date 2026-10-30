/**
 * \sim and ~ stand for every operation on the other side of a rule whose
 * operator and operands are not already written on this side. The copies
 * replace the shorthand in place. Callers that store rules keep the shorthand.
 */

function hasSim(expr: string): boolean {
  return /\\sim\b|~/.test(expr);
}

function isSim(op: string): boolean {
  const key = op.replace(/\s+/g, '');
  return key === '\\sim' || key === '~';
}

function opKey(op: string): string {
  return op.replace(/\s+/g, ' ').trim();
}

function splitOps(expr: string): string[] {
  const s = String(expr ?? '').trim().replace(/^,+|,+$/g, '');
  const ops: string[] = [];
  let depth = 0;
  let cur = '';
  for (const c of s) {
    if (c === '{' || c === '(') depth++;
    else if ((c === '}' || c === ')') && depth > 0) depth--;
    if (c === ',' && depth === 0) {
      const op = cur.trim();
      if (op) ops.push(op);
      cur = '';
      continue;
    }
    cur += c;
  }
  const tail = cur.trim();
  if (tail) ops.push(tail);
  return ops;
}

function replaceSim(side: string[], other: string[]): string[] {
  const present = new Set(side.filter((op) => !isSim(op)).map(opKey));
  const copied = other.filter((op) => !isSim(op) && !present.has(opKey(op)));
  const out: string[] = [];
  let used = false;
  for (const op of side) {
    if (!isSim(op)) {
      out.push(op);
      continue;
    }
    if (!used) out.push(...copied);
    used = true;
  }
  return out;
}

function wrap(original: string, body: string): string {
  const t = original.trim();
  if (!body) return t.startsWith(',') ? ',' : '';
  if (t.startsWith(',') && t.endsWith(',')) return `,${body},`;
  return body;
}

/** Expand shorthand on either side. Sides with no shorthand are returned unchanged. */
export function expandSim(left: string, right: string): { left: string; right: string } {
  if (!hasSim(left) && !hasSim(right)) return { left, right };
  const L = splitOps(left);
  const R = splitOps(right);
  const rightOps = R.some(isSim) ? replaceSim(R, L) : R;
  const leftOps = L.some(isSim) ? replaceSim(L, rightOps) : L;
  return { left: wrap(left, leftOps.join(', ')), right: wrap(right, rightOps.join(', ')) };
}
