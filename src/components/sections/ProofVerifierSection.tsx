import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { SyntaxInput } from '@/components/ui/syntax-input';
import { Rule, getTypeBadgeClass } from '@/data/axioms';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { Play, Plus, RotateCcw, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ProofStep {
  id: string;
  expression: string;
  appliedRule: string;
}

const ProofVerifierSection: React.FC = () => {
  // State for the rule to prove
  const [leftSideToProve, setLeftSideToProve] = useState('');
  const [rightSideToProve, setRightSideToProve] = useState('');
  const [isProving, setIsProving] = useState(false);
  
  // Proof steps
  const [proofSteps, setProofSteps] = useState<ProofStep[]>([]);
  const [currentExpression, setCurrentExpression] = useState('');
  const [currentRule, setCurrentRule] = useState('');
  
  // Drag state
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const data = JSON.parse(jsonData);
        if (data.leftSide && data.rightSide) {
          setLeftSideToProve(data.leftSide);
          setRightSideToProve(data.rightSide);
        }
      }
    } catch (err) {
      console.error('Failed to parse dropped data:', err);
    }
  }, []);

  const startProving = () => {
    if (!leftSideToProve.trim() || !rightSideToProve.trim()) return;
    
    setIsProving(true);
    setProofSteps([{
      id: 'step-0',
      expression: leftSideToProve,
      appliedRule: 'Starting expression (left side)',
    }]);
    setCurrentExpression('');
    setCurrentRule('');
  };

  const addProofStep = () => {
    if (!currentExpression.trim() || !currentRule.trim()) return;
    
    const newStep: ProofStep = {
      id: `step-${proofSteps.length}`,
      expression: currentExpression,
      appliedRule: currentRule,
    };
    
    setProofSteps([...proofSteps, newStep]);
    setCurrentExpression('');
    setCurrentRule('');
  };

  const handleReset = () => {
    setLeftSideToProve('');
    setRightSideToProve('');
    setIsProving(false);
    setProofSteps([]);
    setCurrentExpression('');
    setCurrentRule('');
  };

  const handleRuleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      const jsonData = e.dataTransfer.getData('application/json');
      if (jsonData) {
        const data = JSON.parse(jsonData);
        if (data.name) {
          setCurrentRule(data.name);
        }
      }
    } catch (err) {
      console.error('Failed to parse dropped data:', err);
    }
  }, []);

  return (
    <section className="h-full flex flex-col p-4">
      {/* Header */}
      <div className="text-center mb-4 flex-shrink-0">
        <h2 className="text-2xl font-bold text-glow mb-1">
          Proof Verifier
        </h2>
        <p className="text-sm text-muted-foreground">
          {isProving 
            ? 'Build your proof step by step' 
            : 'Enter a rule to prove, then begin the proving process'
          }
        </p>
      </div>

      {!isProving ? (
        /* Rule Input Phase */
        <div 
          className={`bg-card border rounded-lg p-6 flex-1 flex flex-col transition-all duration-200 ${
            isDragOver ? 'border-primary border-2 border-dashed bg-primary/5' : 'border-border'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <p className="text-center text-sm text-muted-foreground mb-4">
            Drag a rule from the <span className="text-primary font-medium">Rules Panel</span> or enter manually
          </p>
          
          <div className="grid md:grid-cols-[1fr,auto,1fr] gap-4 items-start flex-1">
            {/* Left Side */}
            <div className="space-y-3">
              <label className="text-sm text-muted-foreground block font-mono">
                Left Side (to prove)
              </label>
              <SyntaxInput
                placeholder=", i \Pu,"
                value={leftSideToProve}
                onChange={setLeftSideToProve}
              />
              <div className="p-3 bg-muted/30 rounded-lg border border-border/50 min-h-[48px] flex items-center">
                <ExpressionRenderer expression={leftSideToProve} size={20} />
              </div>
            </div>

            {/* Equivalence Symbol */}
            <div className="flex justify-center pt-8">
              <EquivalenceSymbol size={40} />
            </div>

            {/* Right Side */}
            <div className="space-y-3">
              <label className="text-sm text-muted-foreground block font-mono">
                Right Side (goal)
              </label>
              <SyntaxInput
                placeholder=", j \Pu,"
                value={rightSideToProve}
                onChange={setRightSideToProve}
              />
              <div className="p-3 bg-muted/30 rounded-lg border border-border/50 min-h-[48px] flex items-center">
                <ExpressionRenderer expression={rightSideToProve} size={20} />
              </div>
            </div>
          </div>

          {/* Start Button */}
          <div className="flex justify-center gap-4 mt-6">
            <Button
              onClick={startProving}
              disabled={!leftSideToProve.trim() || !rightSideToProve.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              <Play className="w-4 h-4" />
              Start Proving
            </Button>
          </div>
        </div>
      ) : (
        /* Proving Phase */
        <div className="flex-1 flex flex-col gap-4 overflow-hidden">
          {/* Goal Display */}
          <div className="bg-card border border-border rounded-lg p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wide">Goal to prove</span>
              <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 gap-1 text-xs">
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            </div>
            <div className="flex items-center gap-3 justify-center">
              <div className="p-2 bg-muted/50 rounded border border-border/50">
                <ExpressionRenderer expression={leftSideToProve} size={16} />
              </div>
              <EquivalenceSymbol size={24} />
              <div className="p-2 bg-primary/10 rounded border border-primary/30">
                <ExpressionRenderer expression={rightSideToProve} size={16} />
              </div>
            </div>
          </div>

          {/* Proof Steps */}
          <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
              <span className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
                Proof Steps ({proofSteps.length})
              </span>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {proofSteps.map((step, index) => (
                  <div key={step.id} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-mono">
                      {index}
                    </div>
                    <div className="flex-1">
                      <div className="p-2 bg-muted/30 rounded border border-border/50 mb-1">
                        <ExpressionRenderer expression={step.expression} size={14} />
                      </div>
                      <span className="text-xs text-muted-foreground">{step.appliedRule}</span>
                    </div>
                  </div>
                ))}
                
                {/* Check if last step matches goal */}
                {proofSteps.length > 0 && proofSteps[proofSteps.length - 1].expression.trim() === rightSideToProve.trim() && (
                  <div className="mt-4 p-3 bg-operator-next/10 border border-operator-next/30 rounded-lg text-center">
                    <span className="text-operator-next font-medium text-sm">✓ Proof Complete!</span>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* New Step Input */}
          <div className="bg-card border border-border rounded-lg p-4 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <ChevronRight className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Add Next Step</span>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground font-mono">Next Expression</label>
                <SyntaxInput
                  placeholder="Enter the next expression..."
                  value={currentExpression}
                  onChange={setCurrentExpression}
                />
                <div className="p-2 bg-muted/30 rounded border border-border/50 min-h-[40px] flex items-center">
                  <ExpressionRenderer expression={currentExpression} size={14} />
                </div>
              </div>
              
              <div 
                className="space-y-2"
                onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                onDrop={handleRuleDrop}
              >
                <label className="text-xs text-muted-foreground font-mono">Applied Rule (drag from Rules Panel)</label>
                <SyntaxInput
                  placeholder="Drop or enter rule name..."
                  value={currentRule}
                  onChange={setCurrentRule}
                />
              </div>
            </div>
            
            <div className="flex justify-end mt-4">
              <Button
                onClick={addProofStep}
                disabled={!currentExpression.trim() || !currentRule.trim()}
                size="sm"
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Step
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default ProofVerifierSection;
