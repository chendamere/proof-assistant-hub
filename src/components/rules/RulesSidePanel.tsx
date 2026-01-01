import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { axioms, Rule, RuleType, getTypeBadgeClass } from '@/data/axioms';
import { BookOpen, Search, ChevronDown, ChevronUp, GripVertical, X, PanelRightOpen } from 'lucide-react';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface DraggableRuleCardProps {
  rule: Rule;
}

const DraggableRuleCard: React.FC<DraggableRuleCardProps> = ({ rule }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    const data = JSON.stringify({
      id: rule.id,
      name: rule.name,
      leftSide: rule.leftSide,
      rightSide: rule.rightSide,
    });
    e.dataTransfer.setData('text/plain', data);
    e.dataTransfer.setData('application/json', data);
    e.dataTransfer.effectAllowed = 'copy';
    
    // Create a custom drag image
    const dragImage = document.createElement('div');
    dragImage.textContent = rule.name;
    dragImage.style.cssText = 'position: absolute; top: -1000px; padding: 8px 12px; background: hsl(var(--primary)); color: hsl(var(--primary-foreground)); border-radius: 6px; font-size: 12px; font-weight: 500;';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

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
};

export const RulesSidePanel: React.FC = () => {
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
    <>
      {/* Toggle Button */}
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <PanelRightOpen className="w-4 h-4" />
        Rules Panel
      </Button>

      {/* Side Panel - Non-modal, always accessible for drag */}
      <div 
        className={`fixed top-0 right-0 h-full w-[380px] bg-background border-l border-border shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${
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

        <p className="text-sm text-muted-foreground px-4 pt-2">
          Drag rules to the proof verifier inputs
        </p>

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
        <ScrollArea className="h-[calc(100vh-280px)]">
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
      </div>

      {/* Backdrop for closing */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/20"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default RulesSidePanel;
