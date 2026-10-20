/**
 * Manual \\Tc instantiations.
 *
 * Automatic search tries every subexpression of the proof step. When a rule has
 * too many \\Tc holes for that search, add one entry here. The fragment is still
 * checked: after the holes are replaced, ordinary substitution must produce the
 * other side of the step. An entry that does not substitute is ignored.
 */

export interface TcBindingEntry {
  ruleLeft: string;
  ruleRight: string;
  stepLeft: string;
  stepRight: string;
  /** Tc operand name → code fragment. "," or "" is the empty fragment. */
  bindings: Record<string, string>;
}

export const tcBindings: TcBindingEntry[] = [];
