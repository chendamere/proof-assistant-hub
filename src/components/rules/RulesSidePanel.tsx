import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { axioms, Rule, RuleType, getTypeBadgeClass } from '@/data/axioms';
import { BookOpen, Search, ChevronDown, ChevronUp, GripVertical, X, PanelRightOpen } from 'lucide-react';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { usePanelContext } from '@/contexts/PanelContext';
import { useDebounce } from '@/hooks/useDebounce';

// Lazy load theorems
const loadTheorems = () => import('@/data/theorems').then(m => m.theorems);
let theoremsCache: Rule[] | null = null;

interface DraggableRuleCardProps {
  rule: Rule;
}

const DraggableRuleCard: React.FC<DraggableRuleCardProps> = React.memo(({ rule }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const handleDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const data = JSON.stringify({
      id: rule.id,
      name: rule.name,
      leftSide: rule.leftSide,
      rightSide: rule.rightSide,
    });
    e.dataTransfer.setData('application/json', data);
    e.dataTransfer.effectAllowed = 'copy';
    
    // Create a custom drag image
    const dragImage = document.createElement('div');
    dragImage.textContent = rule.name;
    dragImage.style.cssText = 'position: absolute; top: -1000px; padding: 8px 12px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-radius: 6px; font-size: 12px; font-weight: 500;';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  }, [rule]);

  return (
    <div
      draggable="true"
      onDragStart={handleDragStart}
      className="group bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors select-none"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground mt-1 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        
        <div className="flex-1 min-w-0">
          {/* Rule header */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${getTypeBadgeClass(rule.type)}`}>
              {rule.type.charAt(0).toUpperCase()}
            </span>
            <span className="text-xs text-foreground font-medium truncate">{rule.name}</span>
          </div>
          
          {/* Rendered expression */}
          <div className="flex items-center gap-2 text-sm overflow-x-auto pb-1 pointer-events-none">
            <ExpressionRenderer expression={rule.leftSide} size={12} />
            <span className="text-primary font-mono text-xs">≡</span>
            <ExpressionRenderer expression={rule.rightSide} size={12} />
          </div>
          
          {/* Expand button for text form */}
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground mt-1"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3 mr-1" />
                    Hide text
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3 mr-1" />
                    Show text
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="bg-muted/50 rounded p-2 font-mono text-xs space-y-1">
                <div className="flex gap-2">
                  <span className="text-muted-foreground">L:</span>
                  <span className="text-foreground break-all">{rule.leftSide}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground">R:</span>
                  <span className="text-foreground break-all">{rule.rightSide}</span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
});

DraggableRuleCard.displayName = 'DraggableRuleCard';

export const RulesSidePanel: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedType, setSelectedType] = useState<RuleType | 'all'>('all');
  const { isRulesPanelOpen, setRulesPanelOpen, isWorkbenchExpanded } = usePanelContext();
  
  // Lazy load theorems
  const [theorems, setTheorems] = useState<Rule[]>([]);
  const [isLoadingTheorems, setIsLoadingTheorems] = useState(false);

  useEffect(() => {
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
  }, [theorems.length, isLoadingTheorems]);

  const isOpen = isRulesPanelOpen;
  const setIsOpen = setRulesPanelOpen;

  // Combine axioms and theorems
  const allRules = useMemo(() => [...axioms, ...theorems], [theorems]);

  const filteredRules = useMemo(() => {
    return allRules.filter(rule => {
      const matchesSearch = debouncedSearchQuery === '' ||
        rule.name.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        rule.description.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        rule.leftSide.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
        rule.rightSide.toLowerCase().includes(debouncedSearchQuery.toLowerCase());
      
      const matchesType = selectedType === 'all' || rule.type === selectedType;
      
      return matchesSearch && matchesType;
    });
  }, [allRules, debouncedSearchQuery, selectedType]);

  // Limit visible rules for performance (show first 100, load more on scroll)
  const [visibleCount, setVisibleCount] = useState(100);
  const visibleRules = useMemo(() => filteredRules.slice(0, visibleCount), [filteredRules, visibleCount]);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const handleScroll = useCallback(() => {
    if (!scrollAreaRef.current) return;
    const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    if (!viewport) return;
    
    const scrollPercentage = (viewport.scrollTop + viewport.clientHeight) / viewport.scrollHeight;
    if (scrollPercentage > 0.8 && visibleCount < filteredRules.length) {
      setVisibleCount(prev => Math.min(prev + 50, filteredRules.length));
    }
  }, [visibleCount, filteredRules.length]);
  
  useEffect(() => {
    const viewport = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement;
    if (!viewport) return;
    
    viewport.addEventListener('scroll', handleScroll);
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <>

      {/* Side Panel - Non-modal, always accessible for drag */}
      <div 
        className={`fixed top-0 right-0 h-full w-[380px] bg-background border-l border-border shadow-xl z-50 transform transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-semibold">Drag & Drop Rules</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="px-4 pt-3 pb-2 space-y-1">
          <p className="text-sm text-muted-foreground">
            <GripVertical className="w-3.5 h-3.5 inline-block mr-1 text-primary" />
            <span className="text-foreground font-medium">Drag & drop</span> any rule card below onto the Proof Verifier to auto-fill both sides.
          </p>
        </div>

        {/* Filters */}
        <div className="p-4 space-y-3 border-b border-border">
          {/* Search */}
          <div 
            className="relative"
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={(e) => {
              e.preventDefault();
              try {
                const jsonData = e.dataTransfer.getData('application/json');
                if (jsonData) {
                  const data = JSON.parse(jsonData);
                  if (data.name) {
                    setSearchQuery(data.name);
                  }
                }
              } catch (err) {
                console.error('Failed to parse dropped data:', err);
              }
            }}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search rules... (or drop a rule)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-8 bg-muted/50 border-border h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedType('all')}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                selectedType === 'all' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({allRules.length})
            </button>
            <button
              onClick={() => setSelectedType('axiom')}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                selectedType === 'axiom' 
                  ? 'bg-primary/20 text-primary border border-primary/30' 
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Axioms
            </button>
            <button
              onClick={() => setSelectedType('definition')}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                selectedType === 'definition' 
                  ? 'bg-operator-temp/20 text-operator-temp border border-operator-temp/30' 
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Definitions
            </button>
            <button
              onClick={() => setSelectedType('theorem')}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                selectedType === 'theorem' 
                  ? 'bg-operator-next/20 text-operator-next border border-operator-next/30' 
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Theorems
            </button>
          </div>
        </div>

        {/* Results count */}
        <div className="px-4 py-2 text-xs text-muted-foreground border-b border-border">
          {filteredRules.length} rules found
        </div>

        {/* Rules List */}
        <ScrollArea ref={scrollAreaRef} className="h-[calc(100vh-280px)]">
          <div className="p-4 space-y-2">
            {isLoadingTheorems && (
              <div className="text-center py-4 text-muted-foreground text-sm">
                Loading theorems...
              </div>
            )}
            {visibleRules.map((rule) => (
              <DraggableRuleCard key={rule.id} rule={rule} />
            ))}

            {filteredRules.length === 0 && !isLoadingTheorems && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No rules match your search
              </div>
            )}
            
            {visibleCount < filteredRules.length && (
              <div className="text-center py-4 text-muted-foreground text-xs">
                Showing {visibleCount} of {filteredRules.length} rules. Scroll for more...
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </>
  );
};

export default RulesSidePanel;
