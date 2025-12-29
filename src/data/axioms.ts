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

export const axioms: Rule[] = [];

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
