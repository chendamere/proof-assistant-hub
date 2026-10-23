# Proof-step check: what was filled, and what is still a checker limit

Chapters 1–4 stay clear (252 passed, 0 failed). No axiom or theorem statement was changed.

## Intermediates inserted

A book arrow that is two or three uses of an earlier rule now has those expressions written into the proof. Each inserted link was checked with the existing matcher before it was written.

| Chapter file | Insertions |
| --- | ---: |
| Theorems_of_Identical_Node_Comparison.tex | 76 |
| Swap_Theorems_of_Same_Operand.tex | 25 |
| Theorems_of_Operators_and_Relationships.tex | 27 |
| Recursive_Function_R.tex | 1 |

Identical-node comparison, rechecked after the longer one-site chains: 173 passed, 0 failed (was 102 passed, 9 failed). Those nine arrows each became a chain of existing rules: bubble one atom to the branch with `swap-id-1`, `swap-id-2`, `swap-id-release`, or `swap-release-release`, then one `swap-id-branch` or `swap-release-branch-1` on both arms, then bubble again inside the arm. Theorem `::73::` also uses the earlier node-value symmetry `,i \Pe j, m \Od n, ⟺ ,m \Od n, i \Pe j,` and deletes `j \Od n_2, n_2 \Os` from each arm with `create-id`. The matcher already accepted each link. No axiom was added.

## Fixes that do not change the formal system

- Line continuation in `scripts/extract-proof-steps.js`. A proof line ending in `\\` used to keep one backslash, which glued onto the next line as `\ \Bb`. The extractor now strips the whole trailing run of backslashes.
- `exprToDAG` no longer recurses forever when a brace group does not split on a top-level comma. That input now throws `unparsed branch` (or stops at depth 100) instead of overflowing the stack. Returning no node was tried and rejected: it dropped real `\Os` atoms and made chapter 4 fail.
- The step generator can now emit a substitution the checker already accepted: a definition whose arms are a prefix of the proof’s arms, with the rest of each arm kept. Example: `\Blb{i \Ps j}{,}{,}` expands one `\Bb{m \Ps n}{\Tc c_1}{\Tc c_2}` and leaves `c_1` and `c_2` on the new arms. The second arm reuses the same fresh temporaries when the book does. This is only in the generator. The matcher is unchanged.

## Checker behavior that was not “fixed”

These are real limits of the current algorithm. Widening them would accept steps the rules do not state.

- A definition written as an empty `\Blb` is injected into a `\Bb` that already has arm code. The matcher allows that (chapter 4’s null-comparison proofs depend on it). The generator now follows it. It is not a new axiom.
- `\Pe` and `\Oe` are treated as the same relation, in both directions. A pattern `i \Oe i` can match a unary `\Pu` condition, because only the first operand is compared. Do not cite `equiv-self` for a step whose condition is `\Pu`.
- `\Tc` rules are generated only when every hole sits inside a branch arm. A free hole such as `\Or ⟺ \Or, \Tc code` is not enumerated, so “delete arbitrary code after `\Or`” is not invented as a wildcard.
- The `\Brs` operator theorems in `Rules_of_Operators.tex` are in the proof-step table and are not in `theorems.ts`, so a later proof cannot cite them. Regenerating `theorems.ts` would renumber ids. Left as a gap.
- `Rules_of_Node_Connectivity.tex` line 683 is missing a comma: `i \Oc i_1 j \Oc j_1`. That is a source typo. The checker is right to reject the glued operands.

## Still open after the one-arm chains

Empty-branch proofs that move code into both arms of an empty-condition `\Blb` are the Axiom of Empty Branch Function, `,\Tc c, \Blb{}{,}{,} ⟺ ,\Blb{}{,\Tc c,}{,\Tc c,}`. The matcher now keeps arm code that was already there, the same way a non-`\Tc` pattern keeps an arm suffix, and it accepts an empty condition. Collapsing each arm to `\Pu` / `\Ps` is one earlier proposition at a time.

Recheck after inserting one-site chains (each link an earlier rule, one arm then the other):

| Chapter | Passed | Failed |
| --- | ---: | ---: |
| 1–4 | 252 | 0 |
| Identical node comparison | 173 | 0 |
| Empty branch function | 10 | 0 |
| Swap theorems of the same operand | 196 | 0 |
| Operators and relationships | 145 | 1 |
| Next-order induction | 16 | 8 |
| Recursive function R | 86 | 59 |

Operators and relationships: 145 passed, 1 failed. Eight arrows are filled with earlier rules. Code that sits after a branch whose bottom arm is already `\Or` is distributed into both arms by Code Distribution, then Error Code deletes the copy that landed after `\Or`, leaving it in the top arm only. `i \On, j \On` is put back in front of that `\Or` by Error Absorbs Next, `i` first and then `j`. `i \On, i \Op` and `j \On, j \Op` are created inside one arm at a time. The long bottom-arm permutation swaps `i \Ps j` past `j \nPu` and `j \Ob t_2` by flipping the comparison, using the same-operand swap, and flipping back. `i \nPs j` moves past `j \Ob t_2` the same way.

The remaining arrow is `::5::` step 2, `,i \Oc j, i \Od t, j \Os,` to `,i \Oc j, i \Od t, j \nPs t, j \Os,`. The only rule that introduces `j \nPs t` from an id is this theorem itself (`i \Od t ⟺ i \Od t, i \nPs t`). Copying the id onto `j` and then applying it would cite the theorem inside its own proof. No earlier rule produces that comparison. Induction and `R(i)` are unchanged. No axiom was added.
