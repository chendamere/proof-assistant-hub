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
  // ============= RULES OF OPERATORS =============
  // Swap Axioms - ID Operator
  {
    id: 'swap-id-1',
    name: 'ID Swap (same node)',
    type: 'axiom',
    category: 'operators',
    description: 'Swap two ID operators on the same node',
    leftSide: ',i \\Od m, i \\Od n,',
    rightSide: ',i \\Od n, i \\Od m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - id operator'
  },
  {
    id: 'swap-id-2',
    name: 'ID Swap (different nodes)',
    type: 'axiom',
    category: 'operators',
    description: 'Swap ID operators on different nodes',
    leftSide: ',i \\Od m, j \\Od n,',
    rightSide: ',j \\Od n, i \\Od m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - id operator'
  },
  {
    id: 'swap-id-copy',
    name: 'ID-Copy Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap ID and Copy operators',
    leftSide: ',i \\Od m, j \\Oc n,',
    rightSide: ',j \\Oc n, i \\Od m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - id operator'
  },
  {
    id: 'swap-id-subnode',
    name: 'ID-Subnode Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap ID and Subnode operators',
    leftSide: ',i \\Od m, j \\Ob n,',
    rightSide: ',j \\Ob n, i \\Od m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - id operator'
  },
  {
    id: 'swap-id-global',
    name: 'ID-Global Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap ID and Global Space operators',
    leftSide: ',i \\Od m, \\Og n,',
    rightSide: ', \\Og n, i \\Od m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - id operator'
  },
  {
    id: 'swap-id-temp',
    name: 'ID-Temp Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap ID and Temporary Space operators',
    leftSide: ',i \\Od m, \\Ot n,',
    rightSide: ', \\Ot n, i \\Od m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - id operator'
  },
  {
    id: 'swap-id-next',
    name: 'ID-Next Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap ID and Next Node operators',
    leftSide: ',i \\Od m, j \\On,',
    rightSide: ', j \\On, i \\Od m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - id operator'
  },
  {
    id: 'swap-id-release',
    name: 'ID-Release Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap ID and Release operators',
    leftSide: ',i \\Od m, j \\Os,',
    rightSide: ', j \\Os, i \\Od m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - id operator'
  },
  {
    id: 'swap-id-branch',
    name: 'ID-Branch Distribution',
    type: 'axiom',
    category: 'operators',
    description: 'Distribute ID operator into branch',
    leftSide: ',i \\Od m, \\Blb{j \\Oe t}{,}{,},',
    rightSide: ', \\Blb{j \\Oe t}{,i \\Od m,}{,i \\Od m,},',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - id operator'
  },

  // Swap Axioms - Copy Operator
  {
    id: 'swap-copy-copy',
    name: 'Copy Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap two Copy operators',
    leftSide: ',i \\Oc m, j \\Oc n,',
    rightSide: ',j \\Oc n, i \\Oc m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - copy operator'
  },
  {
    id: 'swap-copy-subnode',
    name: 'Copy-Subnode Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Copy and Subnode operators',
    leftSide: ',i \\Oc m, j \\Ob n,',
    rightSide: ',j \\Ob n, i \\Oc m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - copy operator'
  },
  {
    id: 'swap-copy-global',
    name: 'Copy-Global Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Copy and Global Space operators',
    leftSide: ',i \\Oc m, \\Og n,',
    rightSide: ', \\Og n, i \\Oc m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - copy operator'
  },
  {
    id: 'swap-copy-temp',
    name: 'Copy-Temp Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Copy and Temporary Space operators',
    leftSide: ',i \\Oc m, \\Ot n,',
    rightSide: ', \\Ot n, i \\Oc m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - copy operator'
  },
  {
    id: 'swap-copy-next',
    name: 'Copy-Next Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Copy and Next Node operators',
    leftSide: ',i \\Oc m, j \\On,',
    rightSide: ', j \\On, i \\Oc m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - copy operator'
  },
  {
    id: 'swap-copy-release',
    name: 'Copy-Release Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Copy and Release operators',
    leftSide: ',i \\Oc m, j \\Os,',
    rightSide: ', j \\Os, i \\Oc m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - copy operator'
  },
  {
    id: 'swap-copy-branch',
    name: 'Copy-Branch Distribution',
    type: 'axiom',
    category: 'operators',
    description: 'Distribute Copy operator into branch',
    leftSide: ',i \\Oc m, \\Blb{j \\Oe t}{,}{,}',
    rightSide: ', \\Blb{j \\Oe t}{,i \\Oc m,}{,i \\Oc m,}',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - copy operator'
  },

  // Swap Axioms - Subnode Operator
  {
    id: 'swap-subnode-subnode',
    name: 'Subnode Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap two Subnode operators',
    leftSide: ',i \\Ob m, j \\Ob n,',
    rightSide: ',j \\Ob n, i \\Ob m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - subnode operator'
  },
  {
    id: 'swap-subnode-global',
    name: 'Subnode-Global Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Subnode and Global Space operators',
    leftSide: ',i \\Ob m, \\Og n,',
    rightSide: ', \\Og n, i \\Ob m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - subnode operator'
  },
  {
    id: 'swap-subnode-temp',
    name: 'Subnode-Temp Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Subnode and Temporary Space operators',
    leftSide: ',i \\Ob m, \\Ot n,',
    rightSide: ', \\Ot n, i \\Ob m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - subnode operator'
  },
  {
    id: 'swap-subnode-next',
    name: 'Subnode-Next Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Subnode and Next Node operators',
    leftSide: ',i \\Ob m, j \\On,',
    rightSide: ', j \\On, i \\Ob m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - subnode operator'
  },
  {
    id: 'swap-subnode-release',
    name: 'Subnode-Release Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Subnode and Release operators',
    leftSide: ',i \\Ob m, j \\Os,',
    rightSide: ', j \\Os, i \\Ob m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - subnode operator'
  },
  {
    id: 'swap-subnode-branch',
    name: 'Subnode-Branch Distribution',
    type: 'axiom',
    category: 'operators',
    description: 'Distribute Subnode operator into branch',
    leftSide: ',i \\Ob m, \\Blb{j \\Oe t}{,}{,},',
    rightSide: ', \\Blb{j \\Oe t}{,i \\Ob m,}{,i \\Ob m,},',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - subnode operator'
  },

  // Swap Axioms - Temporary Space Operator
  {
    id: 'swap-temp-temp',
    name: 'Temp Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap two Temporary Space operators',
    leftSide: ', \\Ot m, \\Ot n,',
    rightSide: ', \\Ot n, \\Ot m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - temporary space operator'
  },
  {
    id: 'swap-temp-global',
    name: 'Temp-Global Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Temporary and Global Space operators',
    leftSide: ', \\Ot m, \\Og n,',
    rightSide: ', \\Og n, \\Ot m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - temporary space operator'
  },
  {
    id: 'swap-temp-next',
    name: 'Temp-Next Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Temporary Space and Next Node operators',
    leftSide: ', \\Ot m, j \\On,',
    rightSide: ', j \\On, \\Ot m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - temporary space operator'
  },
  {
    id: 'swap-temp-release',
    name: 'Temp-Release Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Temporary Space and Release operators',
    leftSide: ', \\Ot m, j \\Os,',
    rightSide: ', j \\Os, \\Ot m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - temporary space operator'
  },
  {
    id: 'swap-temp-branch',
    name: 'Temp-Branch Distribution',
    type: 'axiom',
    category: 'operators',
    description: 'Distribute Temporary Space operator into branch',
    leftSide: ', \\Ot m, \\Blb{j \\Oe t}{,}{,},',
    rightSide: ', \\Blb{j \\Oe t}{, \\Ot m,}{, \\Ot m,},',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - temporary space operator'
  },

  // Swap Axioms - Global Space Operator
  {
    id: 'swap-global-global',
    name: 'Global Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap two Global Space operators',
    leftSide: ', \\Og m, \\Og n,',
    rightSide: ', \\Og n, \\Og m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - global space operator'
  },
  {
    id: 'swap-global-next',
    name: 'Global-Next Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Global Space and Next Node operators',
    leftSide: ', \\Og m, j \\On,',
    rightSide: ', j \\On, \\Og m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - global space operator'
  },
  {
    id: 'swap-global-release',
    name: 'Global-Release Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Global Space and Release operators',
    leftSide: ', \\Og m, j \\Os,',
    rightSide: ', j \\Os, \\Og m,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - global space operator'
  },
  {
    id: 'swap-global-branch',
    name: 'Global-Branch Distribution',
    type: 'axiom',
    category: 'operators',
    description: 'Distribute Global Space operator into branch',
    leftSide: ', \\Og m, \\Blb{j \\Oe t}{,}{,},',
    rightSide: ', \\Blb{j \\Oe t}{, \\Og m,}{, \\Og m,},',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - global space operator'
  },

  // Swap Axioms - Next Node Operator
  {
    id: 'swap-next-next',
    name: 'Next Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap two Next Node operators',
    leftSide: ',i \\On, j \\On,',
    rightSide: ', j \\On, i \\On,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - next node operator'
  },
  {
    id: 'swap-next-prev',
    name: 'Next-Prev Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Next and Previous Node operators on same node',
    leftSide: ',i \\On, i \\Op,',
    rightSide: ', i \\Op, i \\On,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - next node operator'
  },
  {
    id: 'swap-next-release',
    name: 'Next-Release Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap Next Node and Release operators',
    leftSide: ',i \\On, j \\Os,',
    rightSide: ', j \\Os, i \\On,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - next node operator'
  },
  {
    id: 'swap-next-branch',
    name: 'Next-Branch Distribution',
    type: 'axiom',
    category: 'operators',
    description: 'Distribute Next Node operator into branch',
    leftSide: ',i \\On, \\Blb{j \\Oe t}{,}{,}',
    rightSide: ', \\Blb{j \\Oe t}{,i \\On,}{,i \\On,}',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - next node operator'
  },

  // Swap Axioms - Release Operator
  {
    id: 'swap-release-release',
    name: 'Release Swap',
    type: 'axiom',
    category: 'operators',
    description: 'Swap two Release operators',
    leftSide: ',i \\Os, j \\Os,',
    rightSide: ', j \\Os, i \\Os,',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - release operator'
  },
  {
    id: 'swap-release-branch-1',
    name: 'Release-Branch Distribution 1',
    type: 'axiom',
    category: 'operators',
    description: 'Distribute Release operator into branch',
    leftSide: ',i \\Os, \\Blb{j \\Oe t}{,}{,}',
    rightSide: ', \\Blb{j \\Oe t}{,i \\Os,}{,i \\Os,}',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - release operator'
  },
  {
    id: 'swap-release-branch-2',
    name: 'Release-Branch Distribution 2',
    type: 'axiom',
    category: 'operators',
    description: 'Distribute Release operator into self-comparison branch',
    leftSide: ',i \\Os, \\Blb{j \\Oe j}{,}{,}',
    rightSide: ', \\Blb{j \\Oe j}{,i \\Os,}{,i \\Os,}',
    section: 'Axioms of Operators',
    subsection: 'swap axioms of operator - release operator'
  },

  // Fundamental Axioms of Logic Error Operator
  {
    id: 'error-code',
    name: 'Error Code',
    type: 'axiom',
    category: 'logic',
    description: 'Error produces code termination',
    leftSide: ',\\Or,',
    rightSide: ',\\Or, \\Tc code,',
    section: 'Axioms of Operators',
    subsection: 'fundamental axioms of logic error operator'
  },
  {
    id: 'error-next',
    name: 'Error Absorbs Next',
    type: 'axiom',
    category: 'logic',
    description: 'Error absorbs Next Node operator',
    leftSide: ',i \\On, \\Or,',
    rightSide: ',\\Or,',
    section: 'Axioms of Operators',
    subsection: 'fundamental axioms of logic error operator'
  },
  {
    id: 'error-release',
    name: 'Error Absorbs Release',
    type: 'axiom',
    category: 'logic',
    description: 'Error absorbs Release operator',
    leftSide: ',i \\Os, \\Or,',
    rightSide: ',\\Or,',
    section: 'Axioms of Operators',
    subsection: 'fundamental axioms of logic error operator'
  },
  {
    id: 'error-assign',
    name: 'Error Absorbs Assign',
    type: 'axiom',
    category: 'logic',
    description: 'Error absorbs Assign operator',
    leftSide: ',i \\Oa j, \\Or,',
    rightSide: ',\\Or,',
    section: 'Axioms of Operators',
    subsection: 'fundamental axioms of logic error operator'
  },

  // Fundamental Axioms of Equivalent Comparison Operator
  {
    id: 'equiv-code-dist',
    name: 'Code Distribution',
    type: 'axiom',
    category: 'logic',
    description: 'Distribute code into branch',
    leftSide: ',\\Brs{,}{,} ,\\Tc c,',
    rightSide: ', \\Brs{,\\Tc c,}{,\\Tc c,},',
    section: 'Axioms of Operators',
    subsection: 'fundamental axioms of equivalent comparison operator'
  },
  {
    id: 'equiv-self',
    name: 'Self-Equivalence',
    type: 'axiom',
    category: 'logic',
    description: 'Self-comparison always fails (error)',
    leftSide: ', \\Blb{i \\Oe i}{,}{,},',
    rightSide: ', \\Blb{i \\Oe i}{,}{, \\Or,},',
    section: 'Axioms of Operators',
    subsection: 'fundamental axioms of equivalent comparison operator'
  },
  {
    id: 'equiv-symmetric',
    name: 'Equivalence Symmetry',
    type: 'axiom',
    category: 'logic',
    description: 'Equivalence comparison is symmetric',
    leftSide: ', \\Blb{i \\Oe j}{,}{,},',
    rightSide: ', \\Blb{j \\Oe i}{,}{,},',
    section: 'Axioms of Operators',
    subsection: 'fundamental axioms of equivalent comparison operator'
  },
  {
    id: 'equiv-nest-left',
    name: 'Equivalence Nest Left',
    type: 'axiom',
    category: 'logic',
    description: 'Nest equivalence on left branch',
    leftSide: ', \\Bb{i \\Oe j}{,\\Tc c_1,}{,\\Tc c_2,},',
    rightSide: ', \\Bb{i \\Oe j}{, \\Bb{i \\Oe j}{,\\Tc c_1,}{,\\Tc c_3,},}{,\\Tc c_2,} ,',
    section: 'Axioms of Operators',
    subsection: 'fundamental axioms of equivalent comparison operator'
  },
  {
    id: 'equiv-nest-right',
    name: 'Equivalence Nest Right',
    type: 'axiom',
    category: 'logic',
    description: 'Nest equivalence on right branch',
    leftSide: ', \\Bb{i \\Oe j}{,\\Tc c_1,}{,\\Tc c_2,},',
    rightSide: ', \\Bb{i \\Oe j}{, \\Tc c_1,}{,\\Bb{i \\Oe j}{,\\Tc c_3,}{,\\Tc c_2,},} ,',
    section: 'Axioms of Operators',
    subsection: 'fundamental axioms of equivalent comparison operator'
  },
  {
    id: 'equiv-subst',
    name: 'Equivalence Substitution',
    type: 'axiom',
    category: 'logic',
    description: 'Substitute equivalent values in nested comparison',
    leftSide: ', \\Blb{i \\Oe j}{,\\Blb{i \\Oe m}{,}{,}}{,},',
    rightSide: ', \\Blb{i \\Oe j}{, \\Blb{j \\Oe m}{,}{,}}{,},',
    section: 'Axioms of Operators',
    subsection: 'fundamental axioms of equivalent comparison operator'
  },
  {
    id: 'equiv-swap-nested',
    name: 'Equivalence Swap Nested',
    type: 'axiom',
    category: 'logic',
    description: 'Swap nested equivalence comparisons',
    leftSide: ', \\Bb{i \\Oe j}{,\\Bb{m \\Oe n}{,\\Tc c_1,}{,\\Tc c_2,},}{, \\Bb{m \\Oe n}{,\\Tc c_3,}{,\\Tc c_4,},},',
    rightSide: ', \\Bb{m \\Oe n}{,\\Bb{i \\Oe j}{,\\Tc c_1,}{,\\Tc c_3,},}{, \\Bb{i \\Oe j}{,\\Tc c_2,}{,\\Tc c_4,},},',
    section: 'Axioms of Operators',
    subsection: 'fundamental axioms of equivalent comparison operator'
  },

  // Fundamental Axioms of Release Operator
  {
    id: 'release-next',
    name: 'Release After Next',
    type: 'axiom',
    category: 'operators',
    description: 'Next followed by Release simplifies to Release',
    leftSide: ',i \\On, i \\Os,',
    rightSide: ',i \\Os,',
    section: 'Axioms of Operators',
    subsection: 'fundamental axioms of release operator'
  },

  // Axioms of Creativity
  {
    id: 'create-branch',
    name: 'Create Branch',
    type: 'axiom',
    category: 'operators',
    description: 'Create empty branch comparison',
    leftSide: ',',
    rightSide: ', \\Bs{i \\Oe j}{,}{,} ,',
    section: 'Axioms of Operators',
    subsection: 'axioms of creativity'
  },
  {
    id: 'create-copy',
    name: 'Create Copy',
    type: 'axiom',
    category: 'operators',
    description: 'Create Copy operator with Release',
    leftSide: ',',
    rightSide: ',i \\Oc m, m \\Os,',
    section: 'Axioms of Operators',
    subsection: 'axioms of creativity'
  },
  {
    id: 'create-id',
    name: 'Create ID',
    type: 'axiom',
    category: 'operators',
    description: 'Create ID operator with Release',
    leftSide: ',',
    rightSide: ',i \\Od m, m \\Os,',
    section: 'Axioms of Operators',
    subsection: 'axioms of creativity'
  },
  {
    id: 'create-subnode',
    name: 'Create Subnode',
    type: 'axiom',
    category: 'operators',
    description: 'Create Subnode operator with Release',
    leftSide: ',',
    rightSide: ',i \\Ob m, m \\Os,',
    section: 'Axioms of Operators',
    subsection: 'axioms of creativity'
  },
  {
    id: 'create-global',
    name: 'Create Global Space',
    type: 'axiom',
    category: 'operators',
    description: 'Create Global Space operator with Release',
    leftSide: ',',
    rightSide: ',\\Og m, m \\Os,',
    section: 'Axioms of Operators',
    subsection: 'axioms of creativity'
  },
  {
    id: 'create-temp',
    name: 'Create Temp Space',
    type: 'axiom',
    category: 'operators',
    description: 'Create Temporary Space operator with Release',
    leftSide: ',',
    rightSide: ',\\Ot m, m \\Os,',
    section: 'Axioms of Operators',
    subsection: 'axioms of creativity'
  },
  {
    id: 'create-next-prev',
    name: 'Create Next-Prev Pair',
    type: 'axiom',
    category: 'operators',
    description: 'Create Next and Previous operators',
    leftSide: ',',
    rightSide: ',i \\On, i \\Op,',
    section: 'Axioms of Operators',
    subsection: 'axioms of creativity'
  },
  {
    id: 'create-empty',
    name: 'Create Empty',
    type: 'axiom',
    category: 'operators',
    description: 'Empty creation (identity)',
    leftSide: ',',
    rightSide: ', ,',
    section: 'Axioms of Operators',
    subsection: 'axioms of creativity'
  },

  // ============= RULES OF THREE FUNDAMENTAL RELATIONSHIPS =============
  // Definition of node value comparison
  {
    id: 'def-value-comp-same',
    name: 'Value Comparison (same node)',
    type: 'definition',
    category: 'relationships',
    description: 'Definition of value comparison for same node',
    leftSide: ', \\Blb{i \\Pe i}{,}{,}',
    rightSide: ', \\Blb{i \\Oe i}{,}{,}',
    section: 'Definition of Relationships',
    subsection: 'Definition of node value comparison'
  },
  {
    id: 'def-value-comp-prop-same',
    name: 'Value Comparison Proposition (same)',
    type: 'definition',
    category: 'propositions',
    description: 'Proposition form for same node value comparison',
    leftSide: ',i \\Pe i,',
    rightSide: ',\\Bb{i \\Pe i}{,}{,\\Or,},',
    section: 'Definition of Relationships',
    subsection: 'Definition of node value comparison'
  },
  {
    id: 'def-value-comp-diff',
    name: 'Value Comparison (different nodes)',
    type: 'definition',
    category: 'relationships',
    description: 'Definition of value comparison for different nodes',
    leftSide: ', \\Blb{i \\Pe j}{,}{,}',
    rightSide: ', \\Blb{i \\Oe j}{,}{,}',
    section: 'Definition of Relationships',
    subsection: 'Definition of node value comparison'
  },
  {
    id: 'def-value-comp-prop',
    name: 'Value Comparison Proposition',
    type: 'definition',
    category: 'propositions',
    description: 'Proposition form for value comparison',
    leftSide: ',i \\Pe j,',
    rightSide: ',\\Bb{i \\Pe j}{,}{,\\Or,},',
    section: 'Definition of Relationships',
    subsection: 'Definition of node value comparison'
  },
  {
    id: 'def-value-comp-neg',
    name: 'Negative Value Comparison',
    type: 'definition',
    category: 'propositions',
    description: 'Negated value comparison proposition',
    leftSide: ',i \\nPe j,',
    rightSide: ',\\Bb{i \\Pe j}{,\\Or,}{,},',
    section: 'Definition of Relationships',
    subsection: 'Definition of node value comparison'
  },

  // Definition of node null comparison
  {
    id: 'def-null-comp',
    name: 'Null Comparison',
    type: 'definition',
    category: 'relationships',
    description: 'Definition of null comparison',
    leftSide: ', \\Blb{i \\Pu }{,}{,}',
    rightSide: ', \\Ot j, \\Blb{i \\Pe j}{,j \\Os,}{,j \\Os,}',
    section: 'Definition of Relationships',
    subsection: 'Definition of node null comparison'
  },
  {
    id: 'def-null-prop',
    name: 'Null Proposition',
    type: 'definition',
    category: 'propositions',
    description: 'Proposition form for null comparison',
    leftSide: ',i \\Pu,',
    rightSide: ',\\Bb{i \\Pu}{,}{,\\Or,},',
    section: 'Definition of Relationships',
    subsection: 'Definition of node null comparison'
  },
  {
    id: 'def-null-neg',
    name: 'Negative Null Comparison',
    type: 'definition',
    category: 'propositions',
    description: 'Negated null comparison proposition',
    leftSide: ',i \\nPu,',
    rightSide: ',\\Bb{i \\Pu}{,\\Or,}{,},',
    section: 'Definition of Relationships',
    subsection: 'Definition of node null comparison'
  },

  // Definition of identical node comparison
  {
    id: 'def-identical-comp',
    name: 'Identical Node Comparison',
    type: 'definition',
    category: 'relationships',
    description: 'Definition of identical node comparison',
    leftSide: ', \\Blb{i \\Ps j}{,}{,}',
    rightSide: ',i \\Od m, j \\Od n, \\Blb{m \\Pe n}{,m \\Os, n \\Os,}{,m \\Os, n \\Os,}',
    section: 'Definition of Relationships',
    subsection: 'Definition of identical node comparison'
  },
  {
    id: 'def-identical-prop',
    name: 'Identical Proposition',
    type: 'definition',
    category: 'propositions',
    description: 'Proposition form for identical comparison',
    leftSide: ',i \\Ps j,',
    rightSide: ',\\Bb{i \\Ps j}{,}{,\\Or,},',
    section: 'Definition of Relationships',
    subsection: 'Definition of identical node comparison'
  },
  {
    id: 'def-identical-neg',
    name: 'Negative Identical Comparison',
    type: 'definition',
    category: 'propositions',
    description: 'Negated identical comparison proposition',
    leftSide: ',i \\nPs j,',
    rightSide: ',\\Bb{i \\Ps j}{,\\Or,}{,},',
    section: 'Definition of Relationships',
    subsection: 'Definition of identical node comparison'
  },

  // Axioms of Relationships - Substitution axioms
  {
    id: 'subst-identical-id',
    name: 'Identical Substitution (ID)',
    type: 'axiom',
    category: 'relationships',
    description: 'Substitute identical nodes in ID operator',
    leftSide: ',i \\Ps j, i \\Od t,',
    rightSide: ', i \\Ps j, j \\Od t,',
    section: 'Axioms of Relationships',
    subsection: 'Substitution axioms of identical node comparison'
  },
  {
    id: 'subst-identical-copy',
    name: 'Identical Substitution (Copy)',
    type: 'axiom',
    category: 'relationships',
    description: 'Substitute identical nodes in Copy operator',
    leftSide: ',i \\Ps j, i \\Oc t,',
    rightSide: ', i \\Ps j, j \\Oc t,',
    section: 'Axioms of Relationships',
    subsection: 'Substitution axioms of identical node comparison'
  },
  {
    id: 'subst-identical-subnode',
    name: 'Identical Substitution (Subnode)',
    type: 'axiom',
    category: 'relationships',
    description: 'Substitute identical nodes in Subnode operator',
    leftSide: ',i \\Ps j, i \\Ob t,',
    rightSide: ', i \\Ps j, j \\Ob t,',
    section: 'Axioms of Relationships',
    subsection: 'Substitution axioms of identical node comparison'
  },
  {
    id: 'subst-identical-value',
    name: 'Identical Substitution (Value)',
    type: 'axiom',
    category: 'relationships',
    description: 'Substitute identical nodes in value comparison',
    leftSide: ',i \\Ps j, \\Blb{i \\Pe j}{,}{,}',
    rightSide: ', i \\Ps j, \\Blb{i \\Pe i}{,}{,}',
    section: 'Axioms of Relationships',
    subsection: 'Substitution axioms of identical node comparison'
  },

  // Axioms of node id operator and propositions
  {
    id: 'id-not-null',
    name: 'ID Implies Not Null',
    type: 'axiom',
    category: 'relationships',
    description: 'ID operator implies target is not null',
    leftSide: ', i \\Od m,',
    rightSide: ', i \\Od m, m \\nPu,',
    section: 'Axioms of Relationships',
    subsection: 'Axioms of node id operator and propositions'
  },
  {
    id: 'id-value-equal',
    name: 'ID Value Equality',
    type: 'axiom',
    category: 'relationships',
    description: 'Two IDs on same node have equal values',
    leftSide: ', i \\Od m, i \\Od n,',
    rightSide: ', i \\Od m, i \\Od n, m \\Pe n,',
    section: 'Axioms of Relationships',
    subsection: 'Axioms of node id operator and propositions'
  },

  // Axioms of copy operator and propositions
  {
    id: 'copy-identical',
    name: 'Copy Implies Identical',
    type: 'axiom',
    category: 'relationships',
    description: 'Copy operator implies identical nodes',
    leftSide: ', i \\Oc j,',
    rightSide: ', i \\Oc j, i \\Ps j,',
    section: 'Axioms of Relationships',
    subsection: 'Axioms of copy operator and propositions'
  },

  // Axioms of subnode operator and propositions
  {
    id: 'subnode-null-copy',
    name: 'Subnode on Null Becomes Copy',
    type: 'axiom',
    category: 'relationships',
    description: 'Subnode on null node becomes Copy',
    leftSide: ',i \\Pu, i \\Ob t,',
    rightSide: ', i \\Pu, i \\Oc t,',
    section: 'Axioms of Relationships',
    subsection: 'Axioms of subnode operator and propositions'
  },
  {
    id: 'subnode-target-null',
    name: 'Subnode Target is Null',
    type: 'axiom',
    category: 'relationships',
    description: 'Subnode target is initially null',
    leftSide: ', i \\Ob t,',
    rightSide: ', i \\Ob t, t \\Pu,',
    section: 'Axioms of Relationships',
    subsection: 'Axioms of subnode operator and propositions'
  },
  {
    id: 'subnode-identical-dist',
    name: 'Subnode Identical Distribution',
    type: 'axiom',
    category: 'relationships',
    description: 'Distribute identical comparison through subnodes',
    leftSide: ',i_1 \\nPu, i_2 \\nPu, i_1 \\Ob t_1, i_2 \\Ob t_2, \\Bls{i_1 \\Ps i_2}{,}{,}',
    rightSide: ',i_1 \\nPu, i_2 \\nPu, i_1 \\Ob t_1, i_2 \\Ob t_2, \\Bls{t_1 \\Ps t_2}{,}{,}',
    section: 'Axioms of Relationships',
    subsection: 'Axioms of subnode operator and propositions'
  },

  // Axioms of global space operator and propositions
  {
    id: 'global-copy',
    name: 'Global Space Copy',
    type: 'axiom',
    category: 'relationships',
    description: 'Two global space operators imply Copy',
    leftSide: ',\\Og i, \\Og j,',
    rightSide: ', \\Og i, i \\Oc j,',
    section: 'Axioms of Relationships',
    subsection: 'Axioms of global space operator and propositions'
  },
  {
    id: 'global-null',
    name: 'Global Space is Null',
    type: 'axiom',
    category: 'relationships',
    description: 'Global space node is initially null',
    leftSide: ', \\Og i,',
    rightSide: ', \\Og i, i \\Pu,',
    section: 'Axioms of Relationships',
    subsection: 'Axioms of global space operator and propositions'
  },

  // Axioms of temporary space operator and propositions
  {
    id: 'temp-value-equal',
    name: 'Temp Space Value Equality',
    type: 'axiom',
    category: 'relationships',
    description: 'Two temp space operators have equal values',
    leftSide: ', \\Ot i, \\Ot j,',
    rightSide: ', \\Ot i, \\Ot j, i \\Pe j,',
    section: 'Axioms of Relationships',
    subsection: 'Axioms of temporary space operator and propositions'
  },
  {
    id: 'temp-next-null',
    name: 'Temp Space Next is Null',
    type: 'axiom',
    category: 'relationships',
    description: 'Temp space with next is null',
    leftSide: ', \\Ot i, i \\On,',
    rightSide: ', \\Ot i, i \\On, i \\Pu,',
    section: 'Axioms of Relationships',
    subsection: 'Axioms of temporary space operator and propositions'
  },
  {
    id: 'temp-not-identical',
    name: 'Temp Space Not Identical',
    type: 'axiom',
    category: 'relationships',
    description: 'Temp space node is not identical to others',
    leftSide: ',\\Ot i,',
    rightSide: ', \\Ot i, i \\nPs j,',
    section: 'Axioms of Relationships',
    subsection: 'Axioms of temporary space operator and propositions'
  },

  // Axioms of next node operator and propositions
  {
    id: 'next-identical-dist',
    name: 'Next Identical Distribution',
    type: 'axiom',
    category: 'relationships',
    description: 'Distribute identical comparison through next operators',
    leftSide: ',i \\On, j \\On, \\Blb{i \\Ps j}{,}{,}',
    rightSide: ', \\Blb{i \\Ps j}{,i \\On, j \\On,}{,i \\On, j \\On,}',
    section: 'Axioms of Relationships',
    subsection: 'Axioms of next node operator and propositions'
  },

  // ============= RECURSIVE FUNCTIONS =============
  // Definition of R(i)
  {
    id: 'def-R-i',
    name: 'Recursive Function R(i)',
    type: 'definition',
    category: 'induction',
    description: 'Definition of the recursive function R(i) that traverses to null',
    leftSide: ',R(i),',
    rightSide: ',\\Bb{if(i \\Pu)}{,}{, i \\On, R(i),},',
    section: 'Recursive Functions',
    subsection: 'Definition of R(i)'
  },
  {
    id: 'thm-R-i-null',
    name: 'R(i) on Null',
    type: 'theorem',
    category: 'induction',
    description: 'R(i) simplifies when i is null',
    leftSide: ', i \\Pu, R(i),',
    rightSide: ', i \\Pu,',
    section: 'Recursive Functions',
    subsection: 'Theorems of R(i)'
  },
  {
    id: 'thm-R-i-not-null',
    name: 'R(i) on Non-Null',
    type: 'theorem',
    category: 'induction',
    description: 'R(i) expands when i is not null',
    leftSide: ', i \\nPu, R(i),',
    rightSide: ', i \\nPu, i \\On, R(i),',
    section: 'Recursive Functions',
    subsection: 'Theorems of R(i)'
  },
  {
    id: 'thm-R-i-result',
    name: 'R(i) Result',
    type: 'theorem',
    category: 'induction',
    description: 'R(i) terminates with null result',
    leftSide: ', R(i),',
    rightSide: ', R(i), i \\Pu,',
    section: 'Recursive Functions',
    subsection: 'Theorems of R(i)'
  },
  {
    id: 'thm-R-i-release',
    name: 'R(i) with Release',
    type: 'theorem',
    category: 'induction',
    description: 'R(i) followed by release simplifies',
    leftSide: ', R(i), i \\Os,',
    rightSide: ', i \\Os,',
    section: 'Recursive Functions',
    subsection: 'Theorems of R(i)'
  },

  // Definition of Rc(i;j)
  {
    id: 'def-Rc-ij',
    name: 'Recursive Function Rc(i;j)',
    type: 'definition',
    category: 'induction',
    description: 'Definition of paired recursive function Rc(i;j)',
    leftSide: ',Rc(i;j),',
    rightSide: ',\\Bb{if(i \\Pu)}{,}{,\\Bb{if(j \\Pu)}{,}{, i \\On, j \\On, Rc(i;j),},},',
    section: 'Recursive Functions',
    subsection: 'Definition of Rc(i;j)'
  },
  {
    id: 'thm-Rc-i-null',
    name: 'Rc(i;j) when i is Null',
    type: 'theorem',
    category: 'induction',
    description: 'Rc(i;j) simplifies when i is null',
    leftSide: ', i \\Pu, Rc(i;j),',
    rightSide: ', i \\Pu,',
    section: 'Recursive Functions',
    subsection: 'Theorems of Rc(i;j)'
  },
  {
    id: 'thm-Rc-j-null',
    name: 'Rc(i;j) when j is Null',
    type: 'theorem',
    category: 'induction',
    description: 'Rc(i;j) simplifies when j is null',
    leftSide: ', j \\Pu, Rc(i;j),',
    rightSide: ', j \\Pu,',
    section: 'Recursive Functions',
    subsection: 'Theorems of Rc(i;j)'
  },

  // Tree Order Induction
  {
    id: 'def-tree-induction',
    name: 'Tree Order Induction',
    type: 'axiom',
    category: 'induction',
    description: 'Axiom of inference for tree order induction',
    leftSide: 'premise: i \\Pu ⊢ P(i); \\In \\Pn i, P(i) ⊢ P(i)',
    rightSide: 'conclusion: P(i)',
    section: 'Tree Order Induction',
    subsection: 'Axiom of Tree Order Induction'
  },
  {
    id: 'thm-Pb-transitive',
    name: 'Pb Transitivity',
    type: 'theorem',
    category: 'induction',
    description: 'The before relationship is transitive',
    leftSide: ', i \\Pb j, j \\Pb k,',
    rightSide: ', i \\Pb j, j \\Pb k, i \\Pb k,',
    section: 'Tree Order Induction',
    subsection: 'Theorems of tree order'
  },

  // Next Order Induction
  {
    id: 'def-SHi-swap',
    name: 'Flag Object SHi Swap',
    type: 'definition',
    category: 'induction',
    description: 'Swap definition for flag object SHi with identical node',
    leftSide: ',\\In \\Ps i, \\Ot m,',
    rightSide: ', \\Ot m, \\In \\Ps i,',
    section: 'Next Order Induction',
    subsection: 'Definition of flag object SHi'
  },
  {
    id: 'def-SHi-next',
    name: 'Flag Object SHi with Next',
    type: 'definition',
    category: 'induction',
    description: 'Definition of flag object SHi with next node',
    leftSide: ', \\In \\Pn i,',
    rightSide: ', i \\Oc i_0, i_0 \\Op, \\In \\Ps i_0, i_0 \\Os,',
    section: 'Next Order Induction',
    subsection: 'Definition of flag object SHi with next node'
  },

  // Rcpo and Rcpm
  {
    id: 'def-IsCpo',
    name: 'IsCpo Condition',
    type: 'definition',
    category: 'induction',
    description: 'Definition of IsCpo(i;r) condition',
    leftSide: ',IsCpo(i;r),',
    rightSide: ', i \\nPc r, r \\Pu,',
    section: 'Recursive Functions',
    subsection: 'Definition of IsCpo'
  },
  {
    id: 'def-Rcpo',
    name: 'Recursive Function Rcpo(i;r)',
    type: 'definition',
    category: 'induction',
    description: 'Definition of copy operation recursive function',
    leftSide: ', Rcpo(i;r),',
    rightSide: ', \\Bb{if(i \\Pu)}{,}{, r \\Ob r_0, i \\Od t, t \\Oa r_0, r_0 \\Os, i \\On, Rcpo(i;r), },',
    section: 'Recursive Functions',
    subsection: 'Definition of Rcpo'
  },
  {
    id: 'thm-Rcpo-null',
    name: 'Rcpo on Null',
    type: 'theorem',
    category: 'induction',
    description: 'Rcpo(i;r) simplifies when i is null',
    leftSide: ', i \\Pu, Rcpo(i;r),',
    rightSide: ', i \\Pu,',
    section: 'Recursive Functions',
    subsection: 'Theorems of Rcpo'
  },

  // Cpo Function
  {
    id: 'def-Cpo',
    name: 'Function Cpo(r)',
    type: 'definition',
    category: 'induction',
    description: 'Definition of the Cpo copy function',
    leftSide: ', Cpo(r),',
    rightSide: ', r \\Od m, m \\Oa r, m \\Os,',
    section: 'Functions',
    subsection: 'Definition of Cpo(r)'
  },
  {
    id: 'thm-Cpo-property',
    name: 'Cpo Property',
    type: 'theorem',
    category: 'induction',
    description: 'Cpo(r) implies r is not null',
    leftSide: ', Cpo(r),',
    rightSide: '~, r \\nPu,',
    section: 'Functions',
    subsection: 'Property of Cpo'
  },

  // ============= ARITHMETIC OPERATIONS =============
  // Addition
  {
    id: 'thm-add-swap-copy',
    name: 'Addition Swap with Copy',
    type: 'theorem',
    category: 'arithmetic',
    description: 'Addition operation swaps with copy operator',
    leftSide: ', i+j:r, m \\Oc n,',
    rightSide: ', m \\Oc n, i+j:r,',
    section: 'Addition',
    subsection: 'Swap'
  },
  {
    id: 'thm-add-swap-id',
    name: 'Addition Swap with ID',
    type: 'theorem',
    category: 'arithmetic',
    description: 'Addition operation swaps with ID operator',
    leftSide: ', i+j:r, m \\Od n,',
    rightSide: ', m \\Od n, i+j:r,',
    section: 'Addition',
    subsection: 'Swap'
  },
  {
    id: 'thm-add-swap-release',
    name: 'Addition Swap with Release',
    type: 'theorem',
    category: 'arithmetic',
    description: 'Addition operation swaps with release operator',
    leftSide: ', i+j:r, m \\Os,',
    rightSide: ', m \\Os, i+j:r,',
    section: 'Addition',
    subsection: 'Swap'
  },
  {
    id: 'thm-add-swap-prop',
    name: 'Addition Swap with Proposition',
    type: 'theorem',
    category: 'arithmetic',
    description: 'Addition operation swaps with value proposition',
    leftSide: ', i+j:r, m \\Pe n,',
    rightSide: ', m \\Pe n, i+j:r,',
    section: 'Addition',
    subsection: 'Swap'
  },
  {
    id: 'thm-add-general',
    name: 'Addition General Property',
    type: 'theorem',
    category: 'arithmetic',
    description: 'Addition can always be performed with release',
    leftSide: ',',
    rightSide: ', i+j:r, r \\Os,',
    section: 'Addition',
    subsection: 'General property'
  },

  // Multiplication
  {
    id: 'def-mult',
    name: 'Multiplication Definition',
    type: 'definition',
    category: 'arithmetic',
    description: 'Definition of multiplication operation',
    leftSide: ', i × j:r,',
    rightSide: ', \\Ot r, r \\Oc r_0, i \\Oc i_0, Rcpm(i_0;j;r_0), i_0 \\Os, r_0 \\Os,',
    section: 'Multiplication',
    subsection: 'Definition'
  },
  {
    id: 'thm-mult-swap-copy',
    name: 'Multiplication Swap with Copy',
    type: 'theorem',
    category: 'arithmetic',
    description: 'Multiplication operation swaps with copy operator',
    leftSide: ', i × j:r, m \\Oc n,',
    rightSide: ', m \\Oc n, i × j:r,',
    section: 'Multiplication',
    subsection: 'Swap'
  },
  {
    id: 'thm-mult-swap-release',
    name: 'Multiplication Swap with Release',
    type: 'theorem',
    category: 'arithmetic',
    description: 'Multiplication operation swaps with release operator',
    leftSide: ', i × j:r, m \\Os,',
    rightSide: ', m \\Os, i × j:r,',
    section: 'Multiplication',
    subsection: 'Swap'
  },
  {
    id: 'thm-mult-swap-prop',
    name: 'Multiplication Swap with Proposition',
    type: 'theorem',
    category: 'arithmetic',
    description: 'Multiplication operation swaps with propositions',
    leftSide: ', i × j:r, m \\Pe n,',
    rightSide: ', m \\Pe n, i × j:r,',
    section: 'Multiplication',
    subsection: 'Swap'
  },

  // ============= DELETE AND INSERT FUNCTIONS =============
  // Del(j) Definition
  {
    id: 'def-Del',
    name: 'Delete Function Del(j)',
    type: 'definition',
    category: 'operators',
    description: 'Definition of the delete node function',
    leftSide: ',Del(j),',
    rightSide: ', j \\nPu, \\Ot t, t \\Oa j, t \\Os,',
    section: 'Axioms of Assign Operator',
    subsection: 'Definition of Del(j)'
  },
  {
    id: 'thm-Del-swap-id',
    name: 'Del Swap with ID',
    type: 'theorem',
    category: 'operators',
    description: 'Delete function swaps with ID operator when nodes differ',
    leftSide: ', m \\nPs j, m \\Od n, Del(j),',
    rightSide: ', m \\nPs j, Del(j), m \\Od n,',
    section: 'Delete Node Function',
    subsection: 'Swap'
  },
  {
    id: 'thm-Del-swap-global',
    name: 'Del Swap with Global',
    type: 'theorem',
    category: 'operators',
    description: 'Delete function swaps with global space operator',
    leftSide: ', \\Og g, Del(j),',
    rightSide: ', Del(j), \\Og g,',
    section: 'Delete Node Function',
    subsection: 'Swap'
  },

  // Ins(t;j) Definition
  {
    id: 'def-Ins',
    name: 'Insert Function Ins(t;j)',
    type: 'definition',
    category: 'operators',
    description: 'Definition of the insert node function',
    leftSide: ',Ins(t;j),',
    rightSide: ', t \\nPu, t \\Oa j,',
    section: 'Axioms of Assign Operator',
    subsection: 'Definition of Ins(t;j)'
  },
  {
    id: 'thm-Ins-property',
    name: 'Ins Implies Value Equality',
    type: 'theorem',
    category: 'operators',
    description: 'Insert function implies value equality',
    leftSide: ', Ins(t;j),',
    rightSide: '~, t \\Pe j,',
    section: 'Insert Node Function',
    subsection: 'Property'
  },

  // ============= PARADOX AND LOGIC =============
  {
    id: 'thm-contradiction',
    name: 'Contradiction Rule',
    type: 'theorem',
    category: 'logic',
    description: 'Error implies any code',
    leftSide: ', \\Or , \\Ri , \\Tc c_1,',
    rightSide: ', \\Tc c_2,',
    section: 'Paradox',
    subsection: 'Theorems of contradiction'
  },
  {
    id: 'thm-value-contradiction',
    name: 'Value Contradiction',
    type: 'theorem',
    category: 'logic',
    description: 'Contradictory value comparison implies error',
    leftSide: ', i \\Pe j, i \\nPe j,',
    rightSide: ', \\Or,',
    section: 'Paradox',
    subsection: 'Theorems of contradiction'
  },
  {
    id: 'thm-null-contradiction',
    name: 'Null Contradiction',
    type: 'theorem',
    category: 'logic',
    description: 'Contradictory null comparison implies error',
    leftSide: ', i \\Pu, i \\nPu,',
    rightSide: ', \\Or,',
    section: 'Paradox',
    subsection: 'Theorems of contradiction'
  },
  {
    id: 'thm-identical-contradiction',
    name: 'Identical Contradiction',
    type: 'theorem',
    category: 'logic',
    description: 'Contradictory identical comparison implies error',
    leftSide: ', i \\Ps j, i \\nPs j,',
    rightSide: ', \\Or,',
    section: 'Paradox',
    subsection: 'Theorems of contradiction'
  },

  // ============= NODE CONNECTIVITY =============
  {
    id: 'def-Pc',
    name: 'Node Connectivity Definition',
    type: 'definition',
    category: 'relationships',
    description: 'Definition of node connectivity relation Pc',
    leftSide: ', \\Blb{i \\Pc j}{,}{,}',
    rightSide: ',i \\Oc i_0, Rcpo(i_0;j), i_0 \\Os, \\Blb{i \\Ps j}{,}{,}',
    section: 'Node Connectivity',
    subsection: 'Definition'
  },
  {
    id: 'thm-Pc-reflexive',
    name: 'Pc Reflexivity',
    type: 'theorem',
    category: 'relationships',
    description: 'Node connectivity is reflexive',
    leftSide: ', i \\nPu,',
    rightSide: ', i \\nPu, i \\Pc i,',
    section: 'Node Connectivity',
    subsection: 'Theorems'
  },
  {
    id: 'thm-Pc-transitive',
    name: 'Pc Transitivity',
    type: 'theorem',
    category: 'relationships',
    description: 'Node connectivity is transitive',
    leftSide: ', i \\Pc j, j \\Pc k,',
    rightSide: ', i \\Pc j, j \\Pc k, i \\Pc k,',
    section: 'Node Connectivity',
    subsection: 'Theorems'
  },

  // ============= NODE CONTINUITY =============
  {
    id: 'def-Pn',
    name: 'Node Continuity Definition',
    type: 'definition',
    category: 'relationships',
    description: 'Definition of next node relation Pn',
    leftSide: ', \\Blb{i \\Pn j}{,}{,}',
    rightSide: ', i \\On, \\Blb{i \\Ps j}{,}{,}',
    section: 'Node Continuity',
    subsection: 'Definition'
  },
  {
    id: 'thm-Pn-unique',
    name: 'Next Node Uniqueness',
    type: 'theorem',
    category: 'relationships',
    description: 'Next node is unique',
    leftSide: ', i \\Pn j, i \\Pn k,',
    rightSide: ', i \\Pn j, i \\Pn k, j \\Ps k,',
    section: 'Node Continuity',
    subsection: 'Theorems'
  },

  // ============= SUBNODE RELATIONSHIP =============
  {
    id: 'thm-subnode-transitive',
    name: 'Subnode Transitivity',
    type: 'theorem',
    category: 'relationships',
    description: 'Subnode relationship with connectivity implies connectivity',
    leftSide: ', i \\Ob j, j \\Pc k,',
    rightSide: ', i \\Ob j, j \\Pc k, i \\Pc k,',
    section: 'Relationship of Subnode',
    subsection: 'Theorems'
  },

  // ============= NUMBER COMPARISONS =============
  {
    id: 'thm-Pe-reflexive',
    name: 'Value Equality Reflexivity',
    type: 'theorem',
    category: 'relationships',
    description: 'Value equality is reflexive',
    leftSide: ', i \\nPu,',
    rightSide: ', i \\nPu, i \\Pe i,',
    section: 'Number Equal Relationship',
    subsection: 'Theorems'
  },
  {
    id: 'thm-Pe-symmetric',
    name: 'Value Equality Symmetry',
    type: 'theorem',
    category: 'relationships',
    description: 'Value equality is symmetric',
    leftSide: ', i \\Pe j,',
    rightSide: ', j \\Pe i,',
    section: 'Number Equal Relationship',
    subsection: 'Theorems'
  },
  {
    id: 'thm-Pe-transitive',
    name: 'Value Equality Transitivity',
    type: 'theorem',
    category: 'relationships',
    description: 'Value equality is transitive',
    leftSide: ', i \\Pe j, j \\Pe k,',
    rightSide: ', i \\Pe j, j \\Pe k, i \\Pe k,',
    section: 'Number Equal Relationship',
    subsection: 'Theorems'
  },

  // More/Less Than
  {
    id: 'def-Pne',
    name: 'More Than Definition',
    type: 'definition',
    category: 'arithmetic',
    description: 'Definition of more than relationship',
    leftSide: ', \\Blb{i \\Pne j}{,}{,}',
    rightSide: ', j \\Oc j_0, Rcpo(j_0;i), j_0 \\Os, \\Blb{i \\nPs j}{,}{,}',
    section: 'Number More Less Than',
    subsection: 'Definition'
  },
  {
    id: 'def-Pnm',
    name: 'Less Than Definition',
    type: 'definition',
    category: 'arithmetic',
    description: 'Definition of less than relationship',
    leftSide: ', \\Blb{i \\Pnm j}{,}{,}',
    rightSide: ', i \\Oc i_0, Rcpo(i_0;j), i_0 \\Os, \\Blb{i \\nPs j}{,}{,}',
    section: 'Number More Less Than',
    subsection: 'Definition'
  },
  {
    id: 'thm-Pne-Pnm-opposite',
    name: 'More/Less Opposite',
    type: 'theorem',
    category: 'arithmetic',
    description: 'More than and less than are opposite relationships',
    leftSide: ', i \\Pne j,',
    rightSide: ', j \\Pnm i,',
    section: 'Number More Less Than',
    subsection: 'Theorems'
  },

  // ============= IDENTICAL NODE COMPARISON THEOREMS =============
  {
    id: 'thm-Ps-reflexive',
    name: 'Identical Node Reflexivity',
    type: 'theorem',
    category: 'propositions',
    description: 'Identical node comparison is reflexive',
    leftSide: ', i \\nPu,',
    rightSide: ', i \\nPu, i \\Ps i,',
    section: 'Identical Node Comparison',
    subsection: 'Unity'
  },
  {
    id: 'thm-Ps-symmetric',
    name: 'Identical Node Symmetry',
    type: 'theorem',
    category: 'propositions',
    description: 'Identical node comparison is symmetric',
    leftSide: ', i \\Ps j,',
    rightSide: ', j \\Ps i,',
    section: 'Identical Node Comparison',
    subsection: 'Symmetry'
  },
  {
    id: 'thm-Ps-transitive',
    name: 'Identical Node Transitivity',
    type: 'theorem',
    category: 'propositions',
    description: 'Identical node comparison is transitive',
    leftSide: ', i \\Ps j, j \\Ps k,',
    rightSide: ', i \\Ps j, j \\Ps k, i \\Ps k,',
    section: 'Identical Node Comparison',
    subsection: 'Transitivity'
  },

  // ============= NULL COMPARISON THEOREMS =============
  {
    id: 'thm-Pu-branch-prop',
    name: 'Null Branch to Proposition',
    type: 'theorem',
    category: 'propositions',
    description: 'Convert null branch function to proposition',
    leftSide: ', \\Bb{if(m \\Pu)}{, m \\Pu,}{,},',
    rightSide: ', \\Bb{if(m \\Pu)}{,}{,},',
    section: 'Node Null Comparison',
    subsection: 'Branch function to propositions'
  },
  {
    id: 'thm-nPu-branch-prop',
    name: 'Not Null Branch to Proposition',
    type: 'theorem',
    category: 'propositions',
    description: 'Convert not null branch function to proposition',
    leftSide: ', \\Bb{if(m \\Pu)}{,}{, m \\nPu,},',
    rightSide: ', \\Bb{if(m \\Pu)}{,}{,},',
    section: 'Node Null Comparison',
    subsection: 'Branch function to propositions'
  },

  // ============= EMPTY BRANCH FUNCTION =============
  {
    id: 'thm-empty-branch-value',
    name: 'Empty Branch Value',
    type: 'theorem',
    category: 'logic',
    description: 'Empty branch with value comparison',
    leftSide: ', \\Bs{i \\Oe j}{,}{,},',
    rightSide: ', \\Bb{if(i \\Pe j)}{,}{,},',
    section: 'Empty Branch Function',
    subsection: 'Theorems'
  },
  {
    id: 'thm-empty-branch-null',
    name: 'Empty Branch Null',
    type: 'theorem',
    category: 'logic',
    description: 'Empty branch with null comparison',
    leftSide: ', \\Bs{i \\Pu}{,}{,},',
    rightSide: ', \\Bb{if(i \\Pu)}{,}{,},',
    section: 'Empty Branch Function',
    subsection: 'Theorems'
  },

  // ============= NODE RING =============
  {
    id: 'def-node-ring',
    name: 'Node Ring Definition',
    type: 'definition',
    category: 'relationships',
    description: 'Definition of node ring structure',
    leftSide: ', i \\Pn j, j \\Pc i,',
    rightSide: ', i is part of ring,',
    section: 'Node Ring',
    subsection: 'Definition'
  },

  // ============= ASSIGN OPERATOR TEMP SPACE =============
  {
    id: 'thm-assign-temp-swap',
    name: 'Assign Temp Swap',
    type: 'theorem',
    category: 'operators',
    description: 'Assign operator swaps with temp space operator',
    leftSide: ', \\Ot g, t \\Oa j,',
    rightSide: ', t \\Oa j, \\Ot g,',
    section: 'Assign Operator Temp Space',
    subsection: 'Swap'
  },

  // ============= SWAP THEOREMS OF SAME OPERAND =============
  {
    id: 'thm-same-operand-id-copy',
    name: 'Same Operand ID-Copy Swap',
    type: 'theorem',
    category: 'operators',
    description: 'ID and Copy operators on same operand can swap',
    leftSide: ', i \\Od m, i \\Oc n,',
    rightSide: ', i \\Oc n, i \\Od m,',
    section: 'Swap Theorems Same Operand',
    subsection: 'Operators'
  },
  {
    id: 'thm-same-operand-id-subnode',
    name: 'Same Operand ID-Subnode Swap',
    type: 'theorem',
    category: 'operators',
    description: 'ID and Subnode operators on same operand can swap',
    leftSide: ', i \\Od m, i \\Ob n,',
    rightSide: ', i \\Ob n, i \\Od m,',
    section: 'Swap Theorems Same Operand',
    subsection: 'Operators'
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
