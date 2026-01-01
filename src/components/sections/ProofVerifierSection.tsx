import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { SyntaxInput } from '@/components/ui/syntax-input';
import { axioms, Rule, getTypeBadgeClass } from '@/data/axioms';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import { ExpressionRenderer } from '@/components/operators/ExpressionRenderer';
import { CheckCircle2, XCircle, AlertCircle, Sparkles, ArrowRight, RotateCcw, Keyboard } from 'lucide-react';

interface VerificationResult {
  isValid: boolean;
  matchedRule: Rule | null;
  message: string;
  similarity?: number;
}

// Keyboard shortcuts for operators
const operatorShortcuts = [
  { key: 'a', syntax: '\\Oa', label: 'Assign', description: 'Ctrl+A' },
  { key: 'b', syntax: '\\Ob', label: 'Subnode', description: 'Ctrl+B' },
  { key: 'c', syntax: '\\Oc', label: 'Copy', description: 'Ctrl+C' },
  { key: 'd', syntax: '\\Od', label: 'ID', description: 'Ctrl+D' },
  { key: 'e', syntax: '\\Oe', label: 'Equiv', description: 'Ctrl+E' },
  { key: 'g', syntax: '\\Og', label: 'Global', description: 'Ctrl+G' },
  { key: 't', syntax: '\\Ot', label: 'Temp', description: 'Ctrl+T' },
  { key: 'n', syntax: '\\On', label: 'Next', description: 'Ctrl+N' },
  { key: 'p', syntax: '\\Op', label: 'Prev', description: 'Ctrl+P' },
  { key: 's', syntax: '\\Os', label: 'Release', description: 'Ctrl+S' },
  { key: 'r', syntax: '\\Or', label: 'Error', description: 'Ctrl+R' },
];

const ProofVerifierSection: React.FC = () => {
  const [leftInput, setLeftInput] = useState('');
  const [rightInput, setRightInput] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [activeField, setActiveField] = useState<'left' | 'right'>('left');
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [leftDragOver, setLeftDragOver] = useState(false);
  const [rightDragOver, setRightDragOver] = useState(false);
  
  const leftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const rightTextareaRef = useRef<HTMLTextAreaElement>(null);

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

  const insertAtCursor = useCallback((syntax: string) => {
    const textarea = activeField === 'left' ? leftTextareaRef.current : rightTextareaRef.current;
    const setInput = activeField === 'left' ? setLeftInput : setRightInput;
    const currentValue = activeField === 'left' ? leftInput : rightInput;
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = currentValue.substring(0, start) + syntax + currentValue.substring(end);
      setInput(newValue);
      
      // Set cursor position after inserted text
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + syntax.length, start + syntax.length);
      }, 0);
    }
  }, [activeField, leftInput, rightInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>, field: 'left' | 'right') => {
    if (e.ctrlKey || e.metaKey) {
      const shortcut = operatorShortcuts.find(s => s.key === e.key.toLowerCase());
      if (shortcut) {
        e.preventDefault();
        const textarea = field === 'left' ? leftTextareaRef.current : rightTextareaRef.current;
        const setInput = field === 'left' ? setLeftInput : setRightInput;
        const currentValue = field === 'left' ? leftInput : rightInput;
        
        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newValue = currentValue.substring(0, start) + shortcut.syntax + currentValue.substring(end);
          setInput(newValue);
          
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + shortcut.syntax.length, start + shortcut.syntax.length);
          }, 0);
        }
      }
    }
  }, [leftInput, rightInput]);

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

  const exampleRules: { left: string; right: string }[] = [
    { left: ', i \\Pu, R(i),', right: ', i \\Pu,' },
    { left: ', i \\Ps j,', right: ', j \\Ps i,' },
    { left: ', i \\Pe j, j \\Pe k,', right: ', i \\Pe j, j \\Pe k, i \\Pe k,' },
    { left: ', R(i), i \\Os,', right: ', i \\Os,' },
    { left: ', i+j:r, m \\Oc n,', right: ', m \\Oc n, i+j:r,' },
    { left: ', i \\Pc j, j \\Pc k,', right: ', i \\Pc j, j \\Pc k, i \\Pc k,' },
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

        {/* Keyboard Shortcuts Toggle */}
        <div className="mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowShortcuts(!showShortcuts)}
            className="gap-2"
          >
            <Keyboard className="w-4 h-4" />
            {showShortcuts ? 'Hide' : 'Show'} Keyboard Shortcuts
          </Button>
        </div>

        {/* Keyboard Shortcuts Panel */}
        {showShortcuts && (
          <div className="bg-card border border-border rounded-lg p-4 mb-6 animate-fade-in">
            <h4 className="text-sm font-semibold text-primary mb-3">Quick Insert Shortcuts</h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {operatorShortcuts.map((shortcut) => (
                <button
                  key={shortcut.key}
                  onClick={() => insertAtCursor(shortcut.syntax)}
                  className="flex flex-col items-center p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors border border-border/50"
                >
                  <code className="text-xs font-mono text-foreground">{shortcut.syntax}</code>
                  <span className="text-[10px] text-muted-foreground mt-1">{shortcut.description}</span>
                  <span className="text-[10px] text-primary">{shortcut.label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Click a button or use keyboard shortcuts while typing. Active field: <span className="text-primary font-mono">{activeField === 'left' ? 'Left (A)' : 'Right (B)'}</span>
            </p>
          </div>
        )}

        {/* Input Area */}
        <div className="bg-card border border-border rounded-lg p-6 mb-8">
          <div className="grid md:grid-cols-[1fr,auto,1fr] gap-4 items-start">
            {/* Left Side */}
            <div 
              className={`space-y-3 p-3 -m-3 rounded-lg transition-all duration-200 ${
                leftDragOver 
                  ? 'bg-primary/10 border-2 border-dashed border-primary' 
                  : 'border-2 border-transparent'
              }`}
              onDragOver={(e) => handleDragOver(e, 'left')}
              onDragLeave={(e) => handleDragLeave(e, 'left')}
              onDrop={(e) => handleDrop(e, 'left')}
            >
              <label className="text-sm text-muted-foreground mb-2 block font-mono">
                Left Side (A)
                {leftDragOver && <span className="text-primary ml-2">Drop rule here</span>}
              </label>
              <SyntaxInput
                textareaRef={leftTextareaRef}
                placeholder=", i \Pu j,"
                value={leftInput}
                onChange={setLeftInput}
                onFocus={() => setActiveField('left')}
                onKeyDown={(e) => handleKeyDown(e, 'left')}
                isActive={activeField === 'left'}
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
            <div 
              className={`space-y-3 p-3 -m-3 rounded-lg transition-all duration-200 ${
                rightDragOver 
                  ? 'bg-primary/10 border-2 border-dashed border-primary' 
                  : 'border-2 border-transparent'
              }`}
              onDragOver={(e) => handleDragOver(e, 'right')}
              onDragLeave={(e) => handleDragLeave(e, 'right')}
              onDrop={(e) => handleDrop(e, 'right')}
            >
              <label className="text-sm text-muted-foreground mb-2 block font-mono">
                Right Side (B)
                {rightDragOver && <span className="text-primary ml-2">Drop rule here</span>}
              </label>
              <SyntaxInput
                textareaRef={rightTextareaRef}
                placeholder=", j \Pu i,"
                value={rightInput}
                onChange={setRightInput}
                onFocus={() => setActiveField('right')}
                onKeyDown={(e) => handleKeyDown(e, 'right')}
                isActive={activeField === 'right'}
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
            <span className="text-primary">Tip:</span> Use keyboard shortcuts (Ctrl+A, Ctrl+B, etc.) to quickly insert operators, or click the buttons above.
          </p>
        </div>
      </div>
    </section>
  );
};

export default ProofVerifierSection;
