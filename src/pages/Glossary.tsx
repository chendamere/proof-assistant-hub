import React, { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { axioms, getTypeBadgeClass, categories, Rule, RuleType, RuleCategory } from '@/data/axioms';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { Search, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Navigation from '@/components/layout/Navigation';
import { useDebounce } from '@/hooks/useDebounce';
import { Button } from '@/components/ui/button';

// Lazy load theorems
const loadTheorems = () => import('@/data/theorems').then(m => m.theorems);
let theoremsCache: Rule[] | null = null;

const Glossary: React.FC = () => {
  // Lazy load and cache theorems
  const [theorems, setTheorems] = useState<Rule[]>([]);
  const [isLoadingTheorems, setIsLoadingTheorems] = useState(false);

  React.useEffect(() => {
    if (!theoremsCache && theorems.length === 0 && !isLoadingTheorems) {
      setIsLoadingTheorems(true);
      loadTheorems().then(loadedTheorems => {
        theoremsCache = loadedTheorems;
        setTheorems(loadedTheorems);
        setIsLoadingTheorems(false);
      });
    } else if (theoremsCache) {
      setTheorems(theoremsCache);
    }
  }, []);

  // Combine all rules
  const allRules: Rule[] = useMemo(() => [...axioms, ...theorems], [theorems]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedType, setSelectedType] = useState<RuleType | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<RuleCategory | 'all'>('all');
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [visibleItems, setVisibleItems] = useState(itemsPerPage);

  // Filter rules with debounced search
  const filteredRules = useMemo(() => {
    return allRules.filter(rule => {
      // Search filter (using debounced query)
      const matchesSearch = debouncedSearchQuery === '' || 
        rule.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        rule.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        rule.leftSide.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        rule.rightSide.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

      // Type filter
      const matchesType = selectedType === 'all' || rule.type === selectedType;

      // Category filter
      const matchesCategory = selectedCategory === 'all' || rule.category === selectedCategory;

      return matchesSearch && matchesType && matchesCategory;
    });
  }, [allRules, debouncedSearchQuery, selectedType, selectedCategory]);

  // Reset visible items when filters change
  React.useEffect(() => {
    setVisibleItems(itemsPerPage);
  }, [debouncedSearchQuery, selectedType, selectedCategory, itemsPerPage]);

  // Get visible rules (pagination)
  const visibleRules = useMemo(() => {
    return filteredRules.slice(0, visibleItems);
  }, [filteredRules, visibleItems]);

  const hasMore = visibleItems < filteredRules.length;

  const loadMore = useCallback(() => {
    setVisibleItems(prev => Math.min(prev + itemsPerPage, filteredRules.length));
  }, [itemsPerPage, filteredRules.length]);

  // Group visible rules by category and type
  const groupedRules = useMemo(() => {
    const groups: Record<string, Record<string, Rule[]>> = {};

    visibleRules.forEach(rule => {
      const categoryKey = rule.category;
      const typeKey = rule.type;

      if (!groups[categoryKey]) {
        groups[categoryKey] = {};
      }
      if (!groups[categoryKey][typeKey]) {
        groups[categoryKey][typeKey] = [];
      }

      groups[categoryKey][typeKey].push(rule);
    });

    return groups;
  }, [visibleRules]);

  // Counts
  const typeCounts = useMemo(() => {
    const counts: Record<RuleType | 'all', number> = { all: filteredRules.length, axiom: 0, definition: 0, theorem: 0 };
    filteredRules.forEach(rule => {
      counts[rule.type] = (counts[rule.type] || 0) + 1;
    });
    return counts;
  }, [filteredRules]);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <div className="pt-20 pb-12 px-4 md:px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">Glossary</h1>
            <p className="text-muted-foreground">
              Complete reference of all axioms, definitions, and theorems
            </p>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search rules..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Type Filter */}
                <Select value={selectedType} onValueChange={(value) => setSelectedType(value as RuleType | 'all')}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Types ({typeCounts.all})
                    </SelectItem>
                    <SelectItem value="axiom">
                      Axioms ({typeCounts.axiom})
                    </SelectItem>
                    <SelectItem value="definition">
                      Definitions ({typeCounts.definition})
                    </SelectItem>
                    <SelectItem value="theorem">
                      Theorems ({typeCounts.theorem})
                    </SelectItem>
                  </SelectContent>
                </Select>

                {/* Category Filter */}
                <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as RuleCategory | 'all')}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Results count */}
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {filteredRules.length} of {allRules.length} rules
          </div>

          {/* Grouped Rules */}
          <ScrollArea className="h-[calc(100vh-300px)]">
            <div className="space-y-8">
              {isLoadingTheorems && (
                <div className="text-center py-8 text-muted-foreground">
                  Loading theorems...
                </div>
              )}
              {Object.entries(groupedRules).map(([categoryKey, typeGroups]) => {
                const category = categories.find(c => c.id === categoryKey);
                const categoryName = category?.name || categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1);
                return (
                  <div key={categoryKey}>
                    <h2 className="text-2xl font-semibold text-foreground mb-4">
                      {categoryName}
                    </h2>
                    
                    {Object.entries(typeGroups).map(([typeKey, rules]) => (
                      <div key={typeKey} className="mb-6">
                        <h3 className="text-lg font-medium text-muted-foreground mb-3 capitalize">
                          {typeKey}s ({rules.length})
                        </h3>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                          {rules.map(rule => (
                            <MemoizedRuleCard key={rule.id} rule={rule} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}
              {hasMore && (
                <div className="flex justify-center py-4">
                  <Button onClick={loadMore} variant="outline">
                    Load More ({filteredRules.length - visibleItems} remaining)
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
};

// Memoized rule card component
const RuleCard: React.FC<{ rule: Rule }> = ({ rule }) => {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        {/* Rule header */}
        <div className="flex items-center gap-2 mb-3">
          <span className={`text-xs px-2 py-1 rounded border font-mono ${getTypeBadgeClass(rule.type as RuleType)}`}>
            {rule.type.charAt(0).toUpperCase()}
          </span>
          <span className="text-sm font-medium text-foreground">{rule.name}</span>
        </div>

        {/* Description */}
        {rule.description && (
          <p className="text-xs text-muted-foreground mb-3">
            {rule.description}
          </p>
        )}

        {/* Rendered expression */}
        <div className="flex items-center gap-2 text-sm overflow-x-auto pb-2 mb-2 border-b border-border">
          <ExpressionRenderer expression={rule.leftSide} size={14} />
          <span className="text-primary font-mono text-xs">≡</span>
          <ExpressionRenderer expression={rule.rightSide} size={14} />
        </div>

        {/* Text form */}
        <div className="bg-muted/30 rounded p-2 font-mono text-xs space-y-1">
          <div className="flex gap-2">
            <span className="text-muted-foreground">L:</span>
            <span className="text-foreground break-all">{rule.leftSide}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground">R:</span>
            <span className="text-foreground break-all">{rule.rightSide}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const MemoizedRuleCard = React.memo(RuleCard);

export default Glossary;
