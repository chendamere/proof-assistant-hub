/**
 * Layer between book text and the checker.
 *
 * Book form stays in the tex and on screen: `i \Oe j`, `\In \Ps i`, `i \Os`.
 * The checker reads operator-first: `\Oe i j`, `\Ps \In i`, `\Os i`.
 * The first \ command in that form is the operator. Later \ commands are flag
 * operands, fixed names such as \In, not schematic variables (i, m, c_1).
 *
 * BOOKMARK: a schematic operand does not match a flag operand. \In matches
 * only \In. Revisit if a schematic variable should be allowed to bind to a flag.
 */

export type ExpressionParseMode = 'normal' | 'operator-first';

const MARK = '\uE000OF';

const KNOWN_OPERATORS = new Set([
  '\\Or', '\\Ri', '\\Rq', '\\sim',
  '\\Os', '\\Oc', '\\Od', '\\Ob', '\\Og', '\\Oa', '\\Ot', '\\On', '\\Op', '\\Oe',
  '\\Pu', '\\nPu',
  '\\Ps', '\\Pe', '\\Pc', '\\Pn', '\\Pb', '\\Pp', '\\Pne', '\\Pnl', '\\Pnm',
  '\\nPs', '\\nPe', '\\nPc', '\\nPn', '\\nPb', '\\nPp', '\\nPne', '\\nPnl', '\\nPnm',
  '\\Tc', '\\Tt',
  '\\Bb', '\\Bs', '\\Blb', '\\Bls', '\\Brb', '\\Brs', '\\Br',
]);

/** Unary operators the book writes after the operand: `i \Os`, `i \On`. */
const POSTFIX_UNARY = new Set([
  '\\Os', '\\Oc', '\\Od', '\\Ob', '\\Og', '\\Oa', '\\On', '\\Op', '\\Pu', '\\nPu',
]);

const modeStack: ExpressionParseMode[] = ['normal'];

export function currentParseMode(): ExpressionParseMode {
  return modeStack[modeStack.length - 1] ?? 'normal';
}

export function isFlagOperand(value: string): boolean {
  return value.startsWith('\\');
}

export function markOperatorFirst(expr: string): string {
  return expr.startsWith(MARK) ? expr : MARK + expr;
}

export function pushExpressionParse(expr: string): string {
  if (expr.startsWith(MARK)) {
    modeStack.push('operator-first');
    return expr.slice(MARK.length);
  }
  modeStack.push('normal');
  return expr;
}

export function popExpressionParse(): void {
  if (modeStack.length > 1) modeStack.pop();
}

function splitTop(expr: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i];
    if (c === '{' || c === '(') depth++;
    else if ((c === '}' || c === ')') && depth > 0) depth--;
    else if (c === ',' && depth === 0) {
      parts.push(expr.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(expr.slice(start));
  return parts;
}

function tokenizeFlat(s: string): string[] | null {
  if (/[{}()+]/.test(s)) return null;
  const tokens: string[] = [];
  let i = 0;
  while (i < s.length) {
    if (/\s/.test(s[i]!)) {
      i++;
      continue;
    }
    if (s[i] === '\\') {
      const m = /^\\[A-Za-z]+/.exec(s.slice(i));
      if (!m) return null;
      tokens.push(m[0]);
      i += m[0].length;
      continue;
    }
    const id = /^[A-Za-z][A-Za-z0-9_]*|^\d+/.exec(s.slice(i));
    if (!id) return null;
    tokens.push(id[0]);
    i += id[0].length;
  }
  return tokens;
}

/** One flat operation, in either book form or operator-first form. */
export function parseOperatorFirstFlat(
  item: string,
  mode: ExpressionParseMode = currentParseMode()
): { op: string; operands: string[] } | null {
  const tokens = tokenizeFlat(item.trim());
  if (!tokens || tokens.length === 0) return null;
  const commands = tokens.filter((t) => t.startsWith('\\'));
  if (commands.length === 0) return null;

  let opIndex = -1;
  if (mode === 'operator-first' && tokens[0]!.startsWith('\\')) {
    opIndex = 0;
  } else {
    const known = tokens
      .map((t, i) => (t.startsWith('\\') && KNOWN_OPERATORS.has(t) ? i : -1))
      .filter((i) => i >= 0);
    if (known.length === 1) opIndex = known[0]!;
    else if (known.length === 0 && commands.length === 1) opIndex = tokens.indexOf(commands[0]!);
    else return null;
  }

  const op = tokens[opIndex]!;
  const operands = tokens.filter((_, i) => i !== opIndex);
  return { op, operands };
}

function showFlat(op: string, operands: string[]): string {
  if (operands.length === 0) return op;
  if (operands.length === 1 && POSTFIX_UNARY.has(op)) return `${operands[0]} ${op}`;
  if (operands.length === 1) return `${op} ${operands[0]}`;
  if (op === '\\+' && operands.length === 3) return `${operands[0]}+${operands[1]}:${operands[2]}`;
  return `${operands[0]} ${op} ${operands.slice(1).join(' ')}`;
}

function rewriteItem(item: string, mode: ExpressionParseMode, toBook: boolean): string {
  const trimmed = item.trim();
  if (!trimmed) return item;
  const branch = /\\(?:Bb|Bs|Blb|Bls|Brb|Brs|Br)\b/.exec(trimmed);
  if (branch && branch.index === trimmed.search(/\S/)) {
    return rewriteBranches(trimmed, mode, toBook);
  }
  const parsed = parseOperatorFirstFlat(trimmed, mode);
  if (!parsed) return item;
  const body = toBook ? showFlat(parsed.op, parsed.operands) : [parsed.op, ...parsed.operands].join(' ');
  const lead = item.match(/^\s*/)?.[0] ?? '';
  return lead + body;
}

function rewriteBranches(expr: string, mode: ExpressionParseMode, toBook: boolean): string {
  let out = '';
  let i = 0;
  while (i < expr.length) {
    if (expr[i] === '{') {
      let depth = 0;
      const start = i + 1;
      for (; i < expr.length; i++) {
        if (expr[i] === '{') depth++;
        else if (expr[i] === '}') {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
      }
      const inner = expr.slice(start, i - 1);
      out += '{' + rewriteSequence(inner, mode, toBook) + '}';
      continue;
    }
    out += expr[i];
    i++;
  }
  return out;
}

function rewriteSequence(expr: string, mode: ExpressionParseMode, toBook: boolean): string {
  return splitTop(expr)
    .map((part) => rewriteItem(part, mode, toBook))
    .join(',');
}

/** Book form or already-operator-first text → operator-first text. */
export function toOperatorFirst(expr: string): string {
  const { mode, text } = expr.startsWith(MARK)
    ? { mode: 'operator-first' as const, text: expr.slice(MARK.length) }
    : { mode: currentParseMode(), text: expr };
  return rewriteSequence(text, mode, false);
}

/** Operator-first text → book form for display. */
export function fromOperatorFirst(expr: string): string {
  const text = expr.startsWith(MARK) ? expr.slice(MARK.length) : expr;
  return rewriteSequence(text, 'operator-first', true);
}
