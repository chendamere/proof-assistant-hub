export type RuleType = 'axiom' | 'definition' | 'theorem';
export type RuleCategory = 
  | 'operators' 
  | 'relationships' 
  | 'propositions' 
  | 'induction' 
  | 'arithmetic' 
  | 'logic';

export interface Rule {
  id: string;
  name: string;
  type: RuleType;
  category: RuleCategory;
  description: string;
  leftSide: string;
  rightSide: string;
  section?: string;
  subsection?: string;
}

export const axioms: Rule[] = [
  // Swap axioms of operators
  {
    id: 'swap-id-1',
    name: 'Swap axiom: ID operator with ID operator',
    type: 'axiom',
    category: 'operators',
    section: '3.1.1',
    description: 'ID operators on different operands can swap positions',
    leftSide: ', i⊗m, i⊗n,',
    rightSide: ', i⊗n, i⊗m,',
  },
  {
    id: 'swap-id-copy',
    name: 'Swap axiom: ID operator with copy operator',
    type: 'axiom',
    category: 'operators',
    section: '3.1.1',
    description: 'ID and copy operators can swap when operands are independent',
    leftSide: ', i⊗m, j⊘n,',
    rightSide: ', j⊘n, i⊗m,',
  },
  {
    id: 'swap-copy-copy',
    name: 'Swap axiom: Copy operators',
    type: 'axiom',
    category: 'operators',
    section: '3.1.1',
    description: 'Copy operators on different operands can swap',
    leftSide: ', i⊘m, j⊘n,',
    rightSide: ', j⊘n, i⊘m,',
  },
  {
    id: 'logic-error-1',
    name: 'Logic error with empty sequence',
    type: 'axiom',
    category: 'logic',
    section: '3.1.2',
    description: 'Logic error halts the program regardless of surrounding code',
    leftSide: ', ⊗, c_code',
    rightSide: ', ⊗,',
  },
  {
    id: 'compare-symmetric',
    name: 'Comparison symmetry',
    type: 'axiom',
    category: 'operators',
    section: '3.1.3',
    description: 'Comparison operator is symmetric',
    leftSide: ', i⊛j [c₁, c₂],',
    rightSide: ', j⊛i [c₁, c₂],',
  },
  {
    id: 'release-create',
    name: 'Release after create',
    type: 'axiom',
    category: 'operators',
    section: '3.1.4',
    description: 'Creating and immediately releasing yields empty',
    leftSide: ', ⊙i, i⊕,',
    rightSide: ',',
  },
  {
    id: 'creativity-copy',
    name: 'Axiom of creativity: Copy',
    type: 'axiom',
    category: 'operators',
    section: '3.1.5',
    description: 'A copy followed by release is equivalent to empty',
    leftSide: ', i⊗j, j⊕,',
    rightSide: ',',
  },

  // Definitions
  {
    id: 'def-node-value',
    name: 'Definition: Node value comparison',
    type: 'definition',
    category: 'relationships',
    section: '4.1.1',
    description: 'Defines equality of node values',
    leftSide: 'i = j',
    rightSide: 'value(i) equals value(j)',
  },
  {
    id: 'def-node-null',
    name: 'Definition: Node null comparison',
    type: 'definition',
    category: 'relationships',
    section: '4.1.2',
    description: 'Defines comparison with empty node',
    leftSide: 'i = ϕ',
    rightSide: 'node pointed by i is empty',
  },
  {
    id: 'def-identical',
    name: 'Definition: Identical node comparison',
    type: 'definition',
    category: 'relationships',
    section: '4.1.3',
    description: 'Defines identical node (same memory location)',
    leftSide: 'i ≡ j',
    rightSide: 'i and j point to same node',
  },
  {
    id: 'def-proposition',
    name: 'Definition: Proposition',
    type: 'definition',
    category: 'propositions',
    section: '2.6',
    description: 'Propositions are derived from branch functions',
    leftSide: ', p,',
    rightSide: ', if(p) ,',
  },

  // Theorems - Node Value Comparison
  {
    id: 'thm-nvc-unity',
    name: 'Unity: Node value comparison',
    type: 'theorem',
    category: 'relationships',
    section: '5.2',
    description: 'Any node value equals itself',
    leftSide: ', i = i,',
    rightSide: ',',
  },
  {
    id: 'thm-nvc-symmetry',
    name: 'Symmetry: Node value comparison',
    type: 'theorem',
    category: 'relationships',
    section: '5.3',
    description: 'Node value comparison is symmetric',
    leftSide: ', i = j,',
    rightSide: ', j = i,',
  },
  {
    id: 'thm-nvc-transitivity',
    name: 'Transitivity: Node value comparison',
    type: 'theorem',
    category: 'relationships',
    section: '5.5',
    description: 'Node value comparison is transitive',
    leftSide: ', i = j, j = k,',
    rightSide: ', i = k,',
  },
  {
    id: 'thm-nvc-substitution',
    name: 'Substitution: Node value comparison',
    type: 'theorem',
    category: 'relationships',
    section: '5.6',
    description: 'Equal values can be substituted',
    leftSide: ', i = j, f(i),',
    rightSide: ', i = j, f(j),',
  },

  // Identical Node Theorems
  {
    id: 'thm-inc-unity',
    name: 'Unity: Identical node comparison',
    type: 'theorem',
    category: 'relationships',
    section: '7.3',
    description: 'Any node is identical to itself',
    leftSide: ', i ≡ i,',
    rightSide: ',',
  },
  {
    id: 'thm-inc-symmetry',
    name: 'Symmetry: Identical node comparison',
    type: 'theorem',
    category: 'relationships',
    section: '7.4',
    description: 'Identical node comparison is symmetric',
    leftSide: ', i ≡ j,',
    rightSide: ', j ≡ i,',
  },

  // Induction axioms
  {
    id: 'axiom-next-order',
    name: 'Axiom of next order induction',
    type: 'axiom',
    category: 'induction',
    section: '11.6',
    description: 'Induction over next node traversal',
    leftSide: 'P(ϕ) ∧ ∀i[P(i) → P(next(i))]',
    rightSide: '∀i P(i)',
  },
  {
    id: 'axiom-prev-order',
    name: 'Axiom of previous order induction',
    type: 'axiom',
    category: 'induction',
    section: '13.6',
    description: 'Induction over previous node traversal',
    leftSide: 'P(ϕ) ∧ ∀i[P(i) → P(prev(i))]',
    rightSide: '∀i P(i)',
  },
  {
    id: 'axiom-tree-order',
    name: 'Axiom of tree order induction',
    type: 'axiom',
    category: 'induction',
    section: '19.4',
    description: 'Induction over tree structure',
    leftSide: 'P(ϕ) ∧ ∀i[P(children(i)) → P(i)]',
    rightSide: '∀i P(i)',
  },

  // Number arithmetic
  {
    id: 'def-number-equal',
    name: 'Definition: Number equal',
    type: 'definition',
    category: 'arithmetic',
    section: '21.1',
    description: 'Defines equality of numbers represented by node chains',
    leftSide: 'num(i) = num(j)',
    rightSide: 'chains have equal length',
  },
  {
    id: 'thm-add-commutative',
    name: 'Additive commutativity',
    type: 'theorem',
    category: 'arithmetic',
    section: '30.4',
    description: 'Addition of numbers is commutative',
    leftSide: 'i + j',
    rightSide: 'j + i',
  },
  {
    id: 'thm-add-associative',
    name: 'Additive associativity',
    type: 'theorem',
    category: 'arithmetic',
    section: '30.5',
    description: 'Addition of numbers is associative',
    leftSide: '(i + j) + k',
    rightSide: 'i + (j + k)',
  },

  // Equivalence rules
  {
    id: 'equiv-commutative',
    name: 'Equivalent commutativity',
    type: 'axiom',
    category: 'logic',
    section: '2.5.5',
    description: 'Rule equivalence is commutative',
    leftSide: 'A ⟺ B',
    rightSide: 'B ⟺ A',
  },
  {
    id: 'equiv-transitive',
    name: 'Equivalent transitivity',
    type: 'axiom',
    category: 'logic',
    section: '2.5.5',
    description: 'Rule equivalence is transitive',
    leftSide: 'A ⟺ B, B ⟺ C',
    rightSide: 'A ⟺ C',
  },
  {
    id: 'equiv-substitution',
    name: 'Equivalent substitution',
    type: 'axiom',
    category: 'logic',
    section: '2.5.5',
    description: 'Equivalent rules can be substituted',
    leftSide: 'A ⟺ B, M·A·N',
    rightSide: 'M·B·N',
  },
];

export const categories: { id: RuleCategory; name: string; description: string }[] = [
  { id: 'operators', name: 'Operators', description: 'Rules governing operator behavior and swapping' },
  { id: 'relationships', name: 'Relationships', description: 'Node comparison and relationship rules' },
  { id: 'propositions', name: 'Propositions', description: 'Logical propositions and branch functions' },
  { id: 'induction', name: 'Induction', description: 'Induction principles for proving properties' },
  { id: 'arithmetic', name: 'Arithmetic', description: 'Number operations and properties' },
  { id: 'logic', name: 'Logic System', description: 'Fundamental logical rules and equivalence' },
];

export const getTypeColor = (type: RuleType): string => {
  switch (type) {
    case 'axiom': return 'text-primary';
    case 'definition': return 'text-operator-temp';
    case 'theorem': return 'text-operator-next';
    default: return 'text-foreground';
  }
};

export const getTypeBadgeClass = (type: RuleType): string => {
  switch (type) {
    case 'axiom': return 'bg-primary/20 text-primary border-primary/30';
    case 'definition': return 'bg-operator-temp/20 text-operator-temp border-operator-temp/30';
    case 'theorem': return 'bg-operator-next/20 text-operator-next border-operator-next/30';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};
