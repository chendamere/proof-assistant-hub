import React, { useState, useMemo } from 'react';
import { axioms, categories, getTypeBadgeClass, Rule, RuleType, RuleCategory } from '@/data/axioms';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import { Input } from '@/components/ui/input';
import { Search, Filter, ChevronDown, ChevronUp } from 'lucide-react';

const GlossarySection: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<RuleType | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<RuleCategory | 'all'>('all');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const filteredRules = useMemo(() => {
    return axioms.filter(rule => {
      const matchesSearch = 
        rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.leftSide.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.rightSide.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = selectedType === 'all' || rule.type === selectedType;
      const matchesCategory = selectedCategory === 'all' || rule.category === selectedCategory;
      
      return matchesSearch && matchesType && matchesCategory;
    });
  }, [searchQuery, selectedType, selectedCategory]);

  const groupedRules = useMemo(() => {
    const groups: Record<RuleCategory, Rule[]> = {
      operators: [],
      relationships: [],
      propositions: [],
      induction: [],
      arithmetic: [],
      logic: [],
    };
    
    filteredRules.forEach(rule => {
      groups[rule.category].push(rule);
    });
    
    return groups;
  }, [filteredRules]);

  const counts = useMemo(() => ({
    axiom: axioms.filter(r => r.type === 'axiom').length,
    definition: axioms.filter(r => r.type === 'definition').length,
    theorem: axioms.filter(r => r.type === 'theorem').length,
  }), []);

  return (
    <section id="glossary" className="py-20 px-6 bg-muted/20">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-glow mb-4">
            Glossary of Rules
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Browse all axioms, definitions, and theorems of the Universal Language formal system.
          </p>
          
          {/* Stats */}
          <div className="flex justify-center gap-6 mt-6">
            <div className="text-center">
              <span className="text-2xl font-bold text-primary">{counts.axiom}</span>
              <span className="text-sm text-muted-foreground block">Axioms</span>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-operator-temp">{counts.definition}</span>
              <span className="text-sm text-muted-foreground block">Definitions</span>
            </div>
            <div className="text-center">
              <span className="text-2xl font-bold text-operator-next">{counts.theorem}</span>
              <span className="text-sm text-muted-foreground block">Theorems</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-lg p-4 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search rules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-muted/50 border-border"
              />
            </div>

            {/* Type Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedType('all')}
                className={`px-3 py-2 rounded-md text-sm font-mono transition-colors ${
                  selectedType === 'all' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedType('axiom')}
                className={`px-3 py-2 rounded-md text-sm font-mono transition-colors ${
                  selectedType === 'axiom' 
                    ? 'bg-primary/20 text-primary border border-primary/30' 
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Axioms
              </button>
              <button
                onClick={() => setSelectedType('definition')}
                className={`px-3 py-2 rounded-md text-sm font-mono transition-colors ${
                  selectedType === 'definition' 
                    ? 'bg-operator-temp/20 text-operator-temp border border-operator-temp/30' 
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Definitions
              </button>
              <button
                onClick={() => setSelectedType('theorem')}
                className={`px-3 py-2 rounded-md text-sm font-mono transition-colors ${
                  selectedType === 'theorem' 
                    ? 'bg-operator-next/20 text-operator-next border border-operator-next/30' 
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                Theorems
              </button>
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Filter className="w-4 h-4 text-muted-foreground self-center" />
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                selectedCategory === 'all' 
                  ? 'bg-accent text-accent-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Categories
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  selectedCategory === cat.id 
                    ? 'bg-accent text-accent-foreground' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-4">
          Showing {filteredRules.length} of {axioms.length} rules
        </p>

        {/* Rules List */}
        <div className="space-y-8">
          {categories.map(category => {
            const categoryRules = groupedRules[category.id];
            if (categoryRules.length === 0) return null;

            return (
              <div key={category.id}>
                <h3 className="text-lg font-semibold text-primary mb-4 flex items-center gap-2">
                  {category.name}
                  <span className="text-xs text-muted-foreground font-normal">
                    ({categoryRules.length})
                  </span>
                </h3>
                <div className="space-y-2">
                  {categoryRules.map(rule => (
                    <RuleCard 
                      key={rule.id} 
                      rule={rule} 
                      isExpanded={expandedRule === rule.id}
                      onToggle={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {filteredRules.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>No rules match your search criteria.</p>
          </div>
        )}
      </div>
    </section>
  );
};

interface RuleCardProps {
  rule: Rule;
  isExpanded: boolean;
  onToggle: () => void;
}

const RuleCard: React.FC<RuleCardProps> = ({ rule, isExpanded, onToggle }) => {
  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden card-glow">
      <button 
        onClick={onToggle}
        className="w-full p-4 text-left flex items-start gap-4 hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded text-xs font-mono uppercase ${getTypeBadgeClass(rule.type)}`}>
              {rule.type}
            </span>
            {rule.section && (
              <span className="text-xs text-muted-foreground font-mono">
                §{rule.section}
              </span>
            )}
          </div>
          <h4 className="font-semibold text-foreground">{rule.name}</h4>
        </div>
        <div className="text-muted-foreground">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border pt-4 animate-fade-in">
          <p className="text-muted-foreground text-sm mb-4">{rule.description}</p>
          
          <div className="bg-muted/30 rounded-md p-4">
            <div className="flex flex-wrap items-center justify-center gap-3 font-mono">
              <span className="text-foreground bg-muted px-3 py-1.5 rounded border border-border">
                {rule.leftSide}
              </span>
              <EquivalenceSymbol size={28} />
              <span className="text-foreground bg-muted px-3 py-1.5 rounded border border-border">
                {rule.rightSide}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlossarySection;
