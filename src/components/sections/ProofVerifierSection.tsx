import React, { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { axioms, Rule, getTypeBadgeClass } from '@/data/axioms';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import { CheckCircle2, XCircle, AlertCircle, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';

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
    
    // Simple character-based similarity
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
    
    // Simulate verification delay
    setTimeout(() => {
      const normLeft = normalizeExpression(leftInput);
      const normRight = normalizeExpression(rightInput);
      
      // Check if this matches any known rule
      let bestMatch: Rule | null = null;
      let bestSimilarity = 0;
      
      for (const rule of axioms) {
        const ruleNormLeft = normalizeExpression(rule.leftSide);
        const ruleNormRight = normalizeExpression(rule.rightSide);
        
        // Check exact match
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
        
        // Check partial similarity
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

  const exampleRules = [
    { left: ', i = i,', right: ',' },
    { left: ', i = j,', right: ', j = i,' },
    { left: 'A ⟺ B', right: 'B ⟺ A' },
    { left: ', ⊙i, i⊕,', right: ',' },
  ];

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

        {/* Input Area */}
        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <div className="grid md:grid-cols-[1fr,auto,1fr] gap-4 items-center">
            {/* Left Side */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block font-mono">
                Left Side (A)
              </label>
              <Textarea
                placeholder=", i = j,"
                value={leftInput}
                onChange={(e) => setLeftInput(e.target.value)}
                className="font-mono bg-muted/50 border-border min-h-[100px] resize-none"
              />
            </div>

            {/* Equivalence Symbol */}
            <div className="flex justify-center">
              <EquivalenceSymbol size={40} />
            </div>

            {/* Right Side */}
            <div>
              <label className="text-sm text-muted-foreground mb-2 block font-mono">
                Right Side (B)
              </label>
              <Textarea
                placeholder=", j = i,"
                value={rightInput}
                onChange={(e) => setRightInput(e.target.value)}
                className="font-mono bg-muted/50 border-border min-h-[100px] resize-none"
              />
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
            className={`rounded-lg p-6 mb-8 animate-fade-in ${
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

        {/* Examples */}
        <div className="bg-card border border-border rounded-lg p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-primary" />
            Try These Examples
          </h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {exampleRules.map((example, index) => (
              <button
                key={index}
                onClick={() => {
                  setLeftInput(example.left);
                  setRightInput(example.right);
                  setResult(null);
                }}
                className="p-3 bg-muted/30 rounded-md hover:bg-muted/50 transition-colors text-left font-mono text-sm"
              >
                <span className="text-foreground">{example.left}</span>
                <span className="text-primary mx-2">⟺</span>
                <span className="text-foreground">{example.right}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Syntax Guide */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            <span className="text-primary">Tip:</span> Use standard ASCII characters or copy operators from the glossary.
            Commas (,) separate code elements. Use ⊙, ⊚, ⊗, ⊘, ⊖, ⊕, ⊝, ⊛ for operators, or their text equivalents.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ProofVerifierSection;
