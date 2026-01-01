import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { axioms, Rule, RuleType, getTypeBadgeClass } from '@/data/axioms';
import { BookOpen, Search, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface DraggableRuleCardProps {
  rule: Rule;
}

const DraggableRuleCard: React.FC<DraggableRuleCardProps> = ({ rule }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      id: rule.id,
      name: rule.name,
      leftSide: rule.leftSide,
      rightSide: rule.rightSide,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="group bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/50 transition-colors"
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground mt-1 opacity-50 group-hover:opacity-100 transition-opacity" />
        
        <div className="flex-1 min-w-0">
          {/* Rule header */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${getTypeBadgeClass(rule.type)}`}>
              {rule.type.charAt(0).toUpperCase()}
            </span>
            <span className="text-xs text-foreground font-medium truncate">{rule.name}</span>
          </div>
          
          {/* Rendered expression */}
          <div className="flex items-center gap-2 text-sm overflow-x-auto pb-1">
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
};

interface RulesSidePanelProps {
  onRuleDrop?: (rule: { id: string; name: string; leftSide: string; rightSide: string }) => void;
}

export const RulesSidePanel: React.FC<RulesSidePanelProps> = ({ onRuleDrop }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<RuleType | 'all'>('all');
  const [isOpen, setIsOpen] = useState(false);

  const filteredRules = axioms.filter(rule => {
    const matchesSearch = 
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.leftSide.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.rightSide.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = selectedType === 'all' || rule.type === selectedType;
    
    return matchesSearch && matchesType;
  });

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2"
        >
          <BookOpen className="w-4 h-4" />
          Rules Panel
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[400px] sm:w-[450px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-0">
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Drag & Drop Rules
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Drag rules into the proof verifier input fields
          </p>
        </SheetHeader>

        {/* Filters */}
        <div className="p-4 space-y-3 border-b border-border">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-muted/50 border-border h-9"
            />
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
              All ({axioms.length})
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
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {filteredRules.map(rule => (
              <DraggableRuleCard key={rule.id} rule={rule} />
            ))}
            
            {filteredRules.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No rules match your search
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

export default RulesSidePanel;
