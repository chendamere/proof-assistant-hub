import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { SyntaxInput } from '@/components/ui/syntax-input';
import { axioms, Rule, getTypeBadgeClass } from '@/data/axioms';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { CheckCircle2, XCircle, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';

interface VerificationResult {
  isValid: boolean;
  matchedRule: Rule | null;
  message: string;
  similarity?: number;
}

const ProofVerifierSection: React.FC = () => {
  const [leftInput, setLeftInput] = useState('');
  const [rightInput, setRightInput] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [leftDragOver, setLeftDragOver] = useState(false);
  const [rightDragOver, setRightDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent, side: 'left' | 'right') => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (side === 'left') {
      setLeftDragOver(true);
    } else {
      setRightDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent, side: 'left' | 'right') => {
    e.preventDefault();
    if (side === 'left') {
      setLeftDragOver(false);
    } else {
      setRightDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    setLeftDragOver(false);
    setRightDragOver(false);
    
    try {
      const jsonData = e.dataTransfer.getData('application/json');
      
      if (jsonData) {
        const data = JSON.parse(jsonData);
        if (data.leftSide && data.rightSide) {
          setLeftInput(data.leftSide);
          setRightInput(data.rightSide);
          setResult(null);
        }
      }
    } catch (err) {
      console.error('Failed to parse dropped data:', err);
    }
  }, []);

  const normalizeExpression = (expr: string): string => {
    return expr
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/,+/g, ',')
      .replace(/^,|,$/g, '')
      .trim();
  };

  const calculateSimilarity = (a: string, b: string): number => {
    const normA = normalizeExpression(a);
    const normB = normalizeExpression(b);
    
    if (normA === normB) return 1;
    
    const longer = normA.length > normB.length ? normA : normB;
    const shorter = normA.length > normB.length ? normB : normA;
    
    if (longer.length === 0) return 1;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    
    return matches / longer.length;
  };

  const verifyStatement = () => {
    setIsVerifying(true);
    
    setTimeout(() => {
      const normLeft = normalizeExpression(leftInput);
      const normRight = normalizeExpression(rightInput);
      
      let bestMatch: Rule | null = null;
      let bestSimilarity = 0;
      
      for (const rule of axioms) {
        const ruleNormLeft = normalizeExpression(rule.leftSide);
        const ruleNormRight = normalizeExpression(rule.rightSide);
        
        if (
          (normLeft === ruleNormLeft && normRight === ruleNormRight) ||
          (normLeft === ruleNormRight && normRight === ruleNormLeft)
        ) {
          setResult({
            isValid: true,
            matchedRule: rule,
            message: `Valid! This matches the ${rule.type}: "${rule.name}"`,
            similarity: 1,
          });
          setIsVerifying(false);
          return;
        }
        
        const leftSim = Math.max(
          calculateSimilarity(normLeft, ruleNormLeft),
          calculateSimilarity(normLeft, ruleNormRight)
        );
        const rightSim = Math.max(
          calculateSimilarity(normRight, ruleNormLeft),
          calculateSimilarity(normRight, ruleNormRight)
        );
        const avgSim = (leftSim + rightSim) / 2;
        
        if (avgSim > bestSimilarity) {
          bestSimilarity = avgSim;
          bestMatch = rule;
        }
      }
      
      if (bestSimilarity > 0.7) {
        setResult({
          isValid: false,
          matchedRule: bestMatch,
          message: `Not an exact match, but similar to "${bestMatch?.name}". Check your syntax.`,
          similarity: bestSimilarity,
        });
      } else if (bestSimilarity > 0.4) {
        setResult({
          isValid: false,
          matchedRule: bestMatch,
          message: `This might be related to "${bestMatch?.name}", but the expression needs correction.`,
          similarity: bestSimilarity,
        });
      } else {
        setResult({
          isValid: false,
          matchedRule: null,
          message: 'This equivalence could not be verified against known rules. It may be invalid or require proof.',
          similarity: 0,
        });
      }
      
      setIsVerifying(false);
    }, 800);
  };

  const handleReset = () => {
    setLeftInput('');
    setRightInput('');
    setResult(null);
  };

  return (
    <section id="verifier" className="py-20 px-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-glow mb-4">
            Proof Verifier
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Enter an equivalence relation to verify it against the formal system's axioms and theorems.
          </p>
        </div>

        {/* Hint */}
        <p className="text-center text-sm text-muted-foreground mb-4">
          Tip: Open the <span className="text-primary font-medium">Rules Panel</span> to drag and drop existing rules into the inputs below.
        </p>

        {/* Input Area - Entire box is drop zone */}
        <div 
          className={`bg-card border rounded-lg p-6 mb-8 transition-all duration-200 ${
            leftDragOver || rightDragOver
              ? 'border-primary border-2 border-dashed bg-primary/5'
              : 'border-border'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setLeftDragOver(true);
          }}
          onDragLeave={(e) => {
            // Only trigger if leaving the container entirely
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setLeftDragOver(false);
              setRightDragOver(false);
            }
          }}
          onDrop={(e) => handleDrop(e, 'left')}
        >
          {(leftDragOver || rightDragOver) && (
            <div className="text-center text-primary text-sm font-medium mb-4 animate-pulse">
              Drop rule to fill both sides
            </div>
          )}
          
          <div className="grid md:grid-cols-[1fr,auto,1fr] gap-4 items-start">
            {/* Left Side */}
            <div className="space-y-3">
              <label className="text-sm text-muted-foreground mb-2 block font-mono">
                Left Side (A)
              </label>
              <SyntaxInput
                placeholder=", i \Pu j,"
                value={leftInput}
                onChange={setLeftInput}
              />
              {/* Rendered Expression */}
              <div className="p-3 bg-muted/30 rounded-lg border border-border/50 min-h-[48px] flex items-center">
                <ExpressionRenderer expression={leftInput} size={20} />
              </div>
            </div>

            {/* Equivalence Symbol */}
            <div className="flex justify-center pt-8">
              <EquivalenceSymbol size={40} />
            </div>

            {/* Right Side */}
            <div className="space-y-3">
              <label className="text-sm text-muted-foreground mb-2 block font-mono">
                Right Side (B)
              </label>
              <SyntaxInput
                placeholder=", j \Pu i,"
                value={rightInput}
                onChange={setRightInput}
              />
              {/* Rendered Expression */}
              <div className="p-3 bg-muted/30 rounded-lg border border-border/50 min-h-[48px] flex items-center">
                <ExpressionRenderer expression={rightInput} size={20} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-4 mt-6">
            <Button
              onClick={verifyStatement}
              disabled={!leftInput.trim() || !rightInput.trim() || isVerifying}
              className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
            >
              {isVerifying ? (
                <>
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  Verifying...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Verify Statement
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div 
            className={`rounded-lg p-6 animate-fade-in ${
              result.isValid 
                ? 'bg-operator-next/10 border border-operator-next/30' 
                : 'bg-destructive/10 border border-destructive/30'
            }`}
          >
            <div className="flex items-start gap-4">
              {result.isValid ? (
                <CheckCircle2 className="w-6 h-6 text-operator-next flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-destructive flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-semibold ${result.isValid ? 'text-operator-next' : 'text-destructive'}`}>
                  {result.isValid ? 'Valid Equivalence' : 'Not Verified'}
                </p>
                <p className="text-muted-foreground mt-1">{result.message}</p>
                
                {result.matchedRule && (
                  <div className="mt-4 p-4 bg-card rounded-md border border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono uppercase ${getTypeBadgeClass(result.matchedRule.type)}`}>
                        {result.matchedRule.type}
                      </span>
                      <span className="text-sm font-semibold">{result.matchedRule.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
                      <span className="bg-muted px-2 py-1 rounded">{result.matchedRule.leftSide}</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className="bg-muted px-2 py-1 rounded">{result.matchedRule.rightSide}</span>
                    </div>
                  </div>
                )}

                {result.similarity !== undefined && result.similarity < 1 && result.similarity > 0 && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Similarity:</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[200px]">
                      <div 
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${result.similarity * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{Math.round(result.similarity * 100)}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default ProofVerifierSection;
