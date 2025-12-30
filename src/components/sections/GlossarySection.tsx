import React, { useState, useMemo, useRef, useEffect } from 'react';
import { axioms, getTypeBadgeClass, Rule, RuleType } from '@/data/axioms';
import { EquivalenceSymbol } from '@/components/operators/OperatorSymbols';
import { Input } from '@/components/ui/input';
import { Search, ChevronDown, ChevronUp } from 'lucide-react';

// Operation metadata for position tracking
interface OperationMetadata {
  id: string;
  operator: string;
  operandBefore?: string;
  operandAfter?: string;
  startX: number;
  startY: number;
  width: number;
  height: number;
  type: 'binary' | 'unary' | 'nullary' | 'branch';
}

// Rule expression metadata - stores all operation positions for a rule side
interface RuleExpressionMetadata {
  ruleId: string;
  side: 'left' | 'right';
  operations: OperationMetadata[];
  totalWidth: number;
  totalHeight: number;
}

// Store for all rule metadata
const ruleMetadataStore = new Map<string, { left: RuleExpressionMetadata; right: RuleExpressionMetadata }>();

// Constants for dimension calculation
const OPERATOR_SVG_WIDTH = 14;
const OPERATOR_SVG_HEIGHT = 14;
const BRANCH_SVG_WIDTH = 14;
const BRANCH_SVG_HEIGHT = 64;
const FONT_SIZE = 12; // text-xs font size in pixels
const CHAR_WIDTH = 7; // approximate character width in monospace font
const GAP_BETWEEN_ELEMENTS = 2; // mx-0.5 spacing

// Helper function to calculate text width
const calculateTextWidth = (text: string): number => {
  return text.length * CHAR_WIDTH;
};

// Helper function to calculate operation dimensions
const calculateOperationDimensions = (
  operator: string,
  operandBefore?: string,
  operandAfter?: string,
  isBranch: boolean = false
): { width: number; height: number } => {
  const svgWidth = isBranch ? BRANCH_SVG_WIDTH : OPERATOR_SVG_WIDTH;
  const svgHeight = isBranch ? BRANCH_SVG_HEIGHT : OPERATOR_SVG_HEIGHT;
  
  let width = svgWidth;
  let height = svgHeight;
  
  if (operandBefore) {
    width += calculateTextWidth(operandBefore) + GAP_BETWEEN_ELEMENTS;
  }
  if (operandAfter) {
    width += calculateTextWidth(operandAfter) + GAP_BETWEEN_ELEMENTS;
  }
  
  return { width, height };
};
import OaSvg from '@/assets/operators/binary/Oa.svg';
import ObSvg from '@/assets/operators/binary/Ob.svg';
import OcSvg from '@/assets/operators/binary/Oc.svg';
import OdSvg from '@/assets/operators/binary/Od.svg';
import OeSvg from '@/assets/operators/binary/Oe.svg';
import OgSvg from '@/assets/operators/unary/Og.svg';
import OtSvg from '@/assets/operators/unary/Ot.svg';
import OnSvg from '@/assets/operators/unary/On.svg';
import OpSvg from '@/assets/operators/unary/Op.svg';
import OsSvg from '@/assets/operators/unary/Os.svg';
import OrSvg from '@/assets/operators/nullary/Or.svg';
import PbSvg from '@/assets/operators/binary/Pb.svg';
import PcSvg from '@/assets/operators/binary/Pc.svg';
import PeSvg from '@/assets/operators/binary/Pe.svg';
import PnSvg from '@/assets/operators/binary/Pn.svg';
import PneSvg from '@/assets/operators/binary/Pne.svg';
import PnmSvg from '@/assets/operators/binary/Pnm.svg';
import PpSvg from '@/assets/operators/binary/Pp.svg';
import PsSvg from '@/assets/operators/binary/Ps.svg';
import PuSvg from '@/assets/operators/binary/Pu.svg';
import nPuSvg from '@/assets/operators/binary/nPu.svg';
import nPsSvg from '@/assets/operators/binary/nPs.svg';
import nPeSvg from '@/assets/operators/binary/nPe.svg';
import BlbSvg from '@/assets/operators/branch/Blb.svg';
import BrSvg from '@/assets/operators/branch/Br.svg';

const GlossarySection: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<RuleType | 'all'>('all');
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  const filteredRules = useMemo(() => {
    return axioms.filter(rule => {
      const matchesSearch = 
        rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.leftSide.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rule.rightSide.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = selectedType === 'all' || rule.type === selectedType;
      
      return matchesSearch && matchesType;
    });
  }, [searchQuery, selectedType]);

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

        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-4">
          Showing {filteredRules.length} of {axioms.length} rules
        </p>

        {/* Rules List */}
        <div className="space-y-2">
          {filteredRules.map(rule => (
            <RuleCard 
              key={rule.id} 
              rule={rule} 
              isExpanded={expandedRule === rule.id}
              onToggle={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}
            />
          ))}
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

// Operator SVG mapping
const operatorSvgMap: Record<string, string> = {
  '\\Oa': OaSvg,
  '\\Ob': ObSvg,
  '\\Oc': OcSvg,
  '\\Od': OdSvg,
  '\\Oe': OeSvg,
  '\\Og': OgSvg,
  '\\Ot': OtSvg,
  '\\On': OnSvg,
  '\\Op': OpSvg,
  '\\Os': OsSvg,
  '\\Or': OrSvg,
  '\\Pb': PbSvg,
  '\\Pc': PcSvg,
  '\\Pe': PeSvg,
  '\\Pn': PnSvg,
  '\\Pne': PneSvg,
  '\\Pnm': PnmSvg,
  '\\Pp': PpSvg,
  '\\Ps': PsSvg,
  '\\Pu': PuSvg,
  '\\nPu': nPuSvg,
  '\\nPs': nPsSvg,
  '\\nPe': nPeSvg,
  '\\Blb': BlbSvg,
  '\\Br': BrSvg,
  '\\Brs': BrSvg, // Treat Brs as Br
};

// Helper function to extract nested brace content
const extractBraceContent = (str: string, startIndex: number): { content: string; endIndex: number } | null => {
  if (str[startIndex] !== '{') return null;
  let depth = 0;
  let i = startIndex;
  let contentStart = startIndex + 1;
  
  while (i < str.length) {
    if (str[i] === '{') depth++;
    if (str[i] === '}') {
      depth--;
      if (depth === 0) {
        return {
          content: str.substring(contentStart, i),
          endIndex: i
        };
      }
    }
    i++;
  }
  return null;
};

// Parse branch operator structure
const parseBranchOperator = (
  operator: string, 
  expr: string, 
  startIndex: number
): { operation?: string; topBranch: string; bottomBranch: string; endIndex: number } | null => {
  // Skip operator name
  let i = startIndex + operator.length;
  
  // Skip whitespace
  while (i < expr.length && /\s/.test(expr[i])) i++;
  
  // Parse branches
  // For \Br and \Brs, there are 2 branches (no operation)
  // For \Blb, \Bb, and \Bs, there are 3 parts: operation, top branch, bottom branch
  const isBr = operator === '\\Br' || operator === '\\Brs';
  
  let operation: string | undefined;
  let topBranch: string = '';
  let bottomBranch: string = '';
  
  if (!isBr) {
    // First part is operation
    const opResult = extractBraceContent(expr, i);
    if (!opResult) return null;
    operation = opResult.content;
    i = opResult.endIndex + 1;
    
    // Skip whitespace
    while (i < expr.length && /\s/.test(expr[i])) i++;
  }
  
  // Second part is top branch
  const topResult = extractBraceContent(expr, i);
  if (!topResult) return null;
  topBranch = topResult.content;
  i = topResult.endIndex + 1;
  
  // Skip whitespace
  while (i < expr.length && /\s/.test(expr[i])) i++;
  
  // Third part is bottom branch
  const bottomResult = extractBraceContent(expr, i);
  if (!bottomResult) return null;
  bottomBranch = bottomResult.content;
  i = bottomResult.endIndex + 1;
  
  return { operation, topBranch, bottomBranch, endIndex: i - 1 };
};

// Function to track operation positions in an expression (including branches)
const trackOperationPositions = (
  expr: string,
  ruleId: string,
  side: 'left' | 'right',
  startX: number = 0,
  startY: number = 0
): OperationMetadata[] => {
  const operations: OperationMetadata[] = [];
  let currentX = startX;
  const processed: Set<number> = new Set();
  
  // First, check for branch operators and handle them
  const branchPattern = /(\\Blb|\\Brs|\\Br|\\Bb|\\Bs)/g;
  const branchIndices: Array<{ operator: string; index: number }> = [];
  let branchMatch;
  
  while ((branchMatch = branchPattern.exec(expr)) !== null) {
    branchIndices.push({
      operator: branchMatch[0],
      index: branchMatch.index
    });
  }
  
  // Process branches first
  branchIndices.reverse();
  const processedRanges: Array<{ start: number; end: number }> = [];
  
  for (const { operator, index } of branchIndices) {
    if (processedRanges.some(range => index >= range.start && index < range.end)) {
      continue;
    }
    
    const branchResult = parseBranchOperator(operator, expr, index);
    if (branchResult) {
      processedRanges.push({ start: index, end: branchResult.endIndex + 1 });
      
      // Track branch operation
      const isBb = operator === '\\Bb' || operator === '\\Bs';
      const isBr = operator === '\\Br' || operator === '\\Brs';
      const branchDims = calculateOperationDimensions(operator, undefined, undefined, true);
      
      // For branches, we need to account for the operation width if present
      let branchWidth = branchDims.width;
      if (branchResult.operation) {
        branchWidth += calculateTextWidth(branchResult.operation) + GAP_BETWEEN_ELEMENTS;
      }
      
      const opMetadata: OperationMetadata = {
        id: `${ruleId}-${side}-branch-${operations.length}`,
        operator: operator,
        operandBefore: branchResult.operation,
        operandAfter: undefined,
        startX: currentX,
        startY: startY,
        width: branchWidth,
        height: branchDims.height,
        type: 'branch'
      };
      operations.push(opMetadata);
      
      currentX += branchWidth + GAP_BETWEEN_ELEMENTS;
    }
  }
  
  // Now track non-branch operations
  const pattern = /(\\Blb|\\Brs|\\Br|\\Bb|\\Bs|\\[A-Za-z]+|[,{}]|\w+(?:_\d+)?|R\([^)]*\)|Rc\([^;)]*;[^)]*\)|Rcpo\([^;)]*;[^)]*\)|Rcpm\([^;)]*;[^)]*\)|IsCpo\([^;)]*;[^)]*\)|Cpo\([^)]*\)|Del\([^)]*\)|Ins\([^,)]*;[^)]*\)|if\([^)]*\)|\\Ri|\\Tc\s+\w+|\\In|\\Pn|\d+\+\d+:\w+|\d+×\d+:\w+|⊢|:)/g;
  const tokens: string[] = [];
  const indices: number[] = [];
  let match;
  
  while ((match = pattern.exec(expr)) !== null) {
    tokens.push(match[0]);
    indices.push(match.index);
  }
  
  // First pass: pre-mark operands for non-branch operators
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    // Skip if this is part of a branch operator range
    if (processedRanges.some(range => indices[i] >= range.start && indices[i] < range.end)) {
      continue;
    }
    
    if (operatorSvgMap[token] && !['\\Blb', '\\Br', '\\Bb', '\\Brs', '\\Bs'].includes(token)) {
      const isUnary = ['\\Og', '\\Ot', '\\On', '\\Op', '\\Os'].includes(token);
      const isNullary = token === '\\Or';
      const isBinary = !isUnary && !isNullary;
      
      if (isBinary) {
        let j = i - 1;
        while (j >= 0 && (tokens[j] === ',' || tokens[j] === '{' || tokens[j].startsWith('\\') || processed.has(j))) {
          j--;
        }
        if (j >= 0) {
          processed.add(j);
        }
        
        let k = i + 1;
        while (k < tokens.length && (tokens[k] === ',' || tokens[k] === '}' || tokens[k].startsWith('\\'))) {
          k++;
        }
        if (k < tokens.length) {
          processed.add(k);
        }
      } else if (isUnary) {
        let k = i + 1;
        while (k < tokens.length && (tokens[k] === ',' || tokens[k] === '}' || tokens[k].startsWith('\\'))) {
          k++;
        }
        if (k < tokens.length) {
          processed.add(k);
        }
      }
    }
  }
  
  // Second pass: track non-branch operations
  for (let i = 0; i < tokens.length; i++) {
    // Skip if this is part of a branch operator range
    if (processedRanges.some(range => indices[i] >= range.start && indices[i] < range.end)) {
      continue;
    }
    
    if (processed.has(i)) continue;
    
    const token = tokens[i];
    
    // Skip branch operators (already tracked)
    if (['\\Blb', '\\Br', '\\Bb', '\\Brs', '\\Bs'].includes(token)) {
      continue;
    }
    
    if (token === ',') {
      currentX += calculateTextWidth(',') * 0.3; // 30% width for comma
    } else if (token === '{' || token === '}') {
      currentX += calculateTextWidth(token);
    } else if (operatorSvgMap[token]) {
      const isUnary = ['\\Og', '\\Ot', '\\On', '\\Op', '\\Os'].includes(token);
      const isNullary = token === '\\Or';
      const isBinary = !isUnary && !isNullary;
      
      let operandBefore: string | undefined;
      let operandAfter: string | undefined;
      
      if (isBinary) {
        let j = i - 1;
        while (j >= 0 && (tokens[j] === ',' || tokens[j] === '{' || tokens[j].startsWith('\\'))) {
          j--;
        }
        if (j >= 0) {
          operandBefore = tokens[j];
        }
        
        let k = i + 1;
        while (k < tokens.length && (tokens[k] === ',' || tokens[k] === '}' || tokens[k].startsWith('\\'))) {
          k++;
        }
        if (k < tokens.length) {
          operandAfter = tokens[k];
        }
      } else if (isUnary) {
        let k = i + 1;
        while (k < tokens.length && (tokens[k] === ',' || tokens[k] === '}' || tokens[k].startsWith('\\'))) {
          k++;
        }
        if (k < tokens.length) {
          operandAfter = tokens[k];
        }
      }
      
      const dims = calculateOperationDimensions(token, operandBefore, operandAfter, false);
      const opMetadata: OperationMetadata = {
        id: `${ruleId}-${side}-${operations.length}`,
        operator: token,
        operandBefore,
        operandAfter,
        startX: currentX,
        startY: startY,
        width: dims.width,
        height: dims.height,
        type: isBinary ? 'binary' : isUnary ? 'unary' : 'nullary'
      };
      operations.push(opMetadata);
      
      currentX += dims.width + GAP_BETWEEN_ELEMENTS;
    } else if (!token.startsWith('\\')) {
      // Variables, functions, etc.
      currentX += calculateTextWidth(token) + GAP_BETWEEN_ELEMENTS;
    }
  }
  
  return operations;
};

// Parse non-branch expression with metadata positioning
const parseNonBranchExpression = (
  expr: string, 
  keyPrefix: string, 
  ruleId?: string, 
  side?: 'left' | 'right',
  operationIndexRef?: { current: number }
): React.ReactNode[] => {
  const metadata = ruleId && side ? getRuleMetadata(ruleId)?.[side] : undefined;
  // Use shared index ref if provided, otherwise create local one
  if (!operationIndexRef) {
    operationIndexRef = { current: 0 };
  }
  const parts: React.ReactNode[] = [];
  const processed: Set<number> = new Set();
  
  // Match operators, variables, commas, braces, functions
  // Note: Branch operators like \Brs need to be matched before \Br to avoid partial matches
  const pattern = /(\\Blb|\\Brs|\\Br|\\Bb|\\Bs|\\[A-Za-z]+|[,{}]|\w+(?:_\d+)?|R\([^)]*\)|Rc\([^;)]*;[^)]*\)|Rcpo\([^;)]*;[^)]*\)|Rcpm\([^;)]*;[^)]*\)|IsCpo\([^;)]*;[^)]*\)|Cpo\([^)]*\)|Del\([^)]*\)|Ins\([^,)]*;[^)]*\)|if\([^)]*\)|\\Ri|\\Tc\s+\w+|\\In|\\Pn|\d+\+\d+:\w+|\d+×\d+:\w+|⊢|:)/g;
  const tokens: string[] = [];
  const indices: number[] = [];
  let match;
  
  while ((match = pattern.exec(expr)) !== null) {
    tokens.push(match[0]);
    indices.push(match.index);
  }
  
  // First pass: pre-mark operands that will be used by operators
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (operatorSvgMap[token]) {
      const isUnary = ['\\Og', '\\Ot', '\\On', '\\Op', '\\Os'].includes(token);
      const isNullary = token === '\\Or';
      const isBinary = !isUnary && !isNullary;
      
      if (isBinary) {
        // For binary: mark operand before as processed
        let j = i - 1;
        while (j >= 0 && (tokens[j] === ',' || tokens[j] === '{' || tokens[j].startsWith('\\') || processed.has(j))) {
          j--;
        }
        if (j >= 0) {
          processed.add(j);
        }
        
        // For binary: mark operand after as processed
        let k = i + 1;
        while (k < tokens.length && (tokens[k] === ',' || tokens[k] === '}' || tokens[k].startsWith('\\'))) {
          k++;
        }
        if (k < tokens.length) {
          processed.add(k);
        }
      } else if (isUnary) {
        // For unary: mark operand after as processed
        let k = i + 1;
        while (k < tokens.length && (tokens[k] === ',' || tokens[k] === '}' || tokens[k].startsWith('\\'))) {
          k++;
        }
        if (k < tokens.length) {
          processed.add(k);
        }
      }
    }
  }
  
  // Second pass: render tokens
  for (let i = 0; i < tokens.length; i++) {
    if (processed.has(i)) continue;
    
    const token = tokens[i];
    
    // Skip branch operators here (handled separately)
    if (token === '\\Blb' || token === '\\Br' || token === '\\Bb' || token === '\\Brs' || token === '\\Bs') {
      continue;
    }
    
    if (token === ',') {
      parts.push(<span key={`${keyPrefix}comma-${i}`} className="text-muted-foreground mx-0.5">,</span>);
    } else if (token === '{' || token === '}') {
      parts.push(<span key={`${keyPrefix}brace-${i}`} className="text-muted-foreground">{token}</span>);
    } else if (operatorSvgMap[token]) {
      const svgSrc = operatorSvgMap[token];
      const isUnary = ['\\Og', '\\Ot', '\\On', '\\Op', '\\Os'].includes(token);
      const isNullary = token === '\\Or';
      const isBinary = !isUnary && !isNullary;
      
      let operandBefore: string | undefined;
      let operandAfter: string | undefined;
      
      if (isBinary) {
        // For binary: look for operand before (previous non-comma, non-operator, non-brace token)
        // Don't check processed.has(j) here - we want to find it even if marked, so we can display it
        let j = i - 1;
        while (j >= 0 && (tokens[j] === ',' || tokens[j] === '{' || tokens[j].startsWith('\\'))) {
          j--;
        }
        if (j >= 0) {
          operandBefore = tokens[j];
        }
        
        // For binary: look for operand after (next non-comma, non-operator, non-brace token)
        let k = i + 1;
        while (k < tokens.length && (tokens[k] === ',' || tokens[k] === '}' || tokens[k].startsWith('\\'))) {
          k++;
        }
        if (k < tokens.length) {
          operandAfter = tokens[k];
        }
      } else if (isUnary) {
        // For unary: look for operand after
        let k = i + 1;
        while (k < tokens.length && (tokens[k] === ',' || tokens[k] === '}' || tokens[k].startsWith('\\'))) {
          k++;
        }
        if (k < tokens.length) {
          operandAfter = tokens[k];
        }
      }
      
      // Get metadata for this operation by index (operations are tracked in order)
      // Skip branch operations in metadata (they're handled separately)
      let opMetadata: OperationMetadata | undefined;
      if (metadata && operationIndexRef.current < metadata.operations.length) {
        // Find next non-branch operation
        while (operationIndexRef.current < metadata.operations.length) {
          const candidate = metadata.operations[operationIndexRef.current];
          if (candidate.type !== 'branch') {
            opMetadata = candidate;
            operationIndexRef.current++;
            break;
          }
          operationIndexRef.current++;
        }
      }
      
      // Use absolute positioning if metadata is available
      if (opMetadata && ruleId && side) {
        parts.push(
          <span
            key={`${keyPrefix}op-${i}`}
            className="absolute inline-flex items-center gap-0.5"
            style={{
              left: `${opMetadata.startX}px`,
              top: `${opMetadata.startY}px`,
              width: `${opMetadata.width}px`,
              height: `${opMetadata.height}px`,
              zIndex: 10
            }}
          >
            {operandBefore && <span className="font-mono text-xs">{operandBefore}</span>}
            <img 
              src={svgSrc} 
              alt={token}
              className="inline-block opacity-90"
              style={{ width: '14px', height: '14px', verticalAlign: 'middle', filter: 'brightness(0) invert(1)' }}
            />
            {operandAfter && <span className="font-mono text-xs">{operandAfter}</span>}
          </span>
        );
      } else {
        // Fallback to inline rendering if no metadata
        parts.push(
          <span key={`${keyPrefix}op-${i}`} className="inline-flex items-center gap-0.5 mx-0.5">
            {operandBefore && <span className="font-mono text-xs">{operandBefore}</span>}
            <img 
              src={svgSrc} 
              alt={token}
              className="inline-block opacity-90"
              style={{ width: '14px', height: '14px', verticalAlign: 'middle', filter: 'brightness(0) invert(1)' }}
            />
            {operandAfter && <span className="font-mono text-xs">{operandAfter}</span>}
          </span>
        );
      }
    } else if (token.startsWith('\\')) {
      // Unknown operator - render as text
      parts.push(<span key={`${keyPrefix}unknown-${i}`} className="font-mono text-xs mx-0.5">{token}</span>);
    } else {
      // Variables, functions, etc. (only render if not processed/marked as operand)
      parts.push(<span key={`${keyPrefix}var-${i}`} className="font-mono text-xs mx-0.5">{token}</span>);
    }
  }
  
  return parts.length > 0 ? parts : [<span key={`${keyPrefix}empty`} className="font-mono text-xs">{expr}</span>];
};

// Branch component for visual rendering
const BranchComponent: React.FC<{
  operator: string;
  operation?: string;
  topBranch: string;
  bottomBranch: string;
  keyPrefix: string;
  ruleId?: string;
  side?: 'left' | 'right';
  operationIndexRef?: { current: number };
}> = ({ operator, operation, topBranch, bottomBranch, keyPrefix, ruleId, side, operationIndexRef }) => {
  const metadata = ruleId && side ? getRuleMetadata(ruleId)?.[side] : undefined;
  
  // Get branch operation metadata by current index
  let branchOpMetadata: OperationMetadata | undefined;
  if (metadata && operationIndexRef && operationIndexRef.current < metadata.operations.length) {
    // Find next branch operation
    while (operationIndexRef.current < metadata.operations.length) {
      const candidate = metadata.operations[operationIndexRef.current];
      if (candidate.type === 'branch' && candidate.operator === operator) {
        branchOpMetadata = candidate;
        operationIndexRef.current++;
        break;
      }
      operationIndexRef.current++;
    }
  }
  // For \Bb and \Bs, use Blb SVG instead
  const isBb = operator === '\\Bb' || operator === '\\Bs';
  const mainSvgSrc = isBb ? BlbSvg : operatorSvgMap[operator];
  const brSvgSrc = BrSvg;
  
  // Determine longest branch (by length) for Bb
  const topBranchLength = topBranch.length;
  const bottomBranchLength = bottomBranch.length;
  const longestBranchIsTop = topBranchLength >= bottomBranchLength;
  
  return (
    <span 
      key={keyPrefix} 
      className={branchOpMetadata ? "absolute inline-flex items-center align-middle" : "inline-flex items-center align-middle"}
      style={branchOpMetadata ? {
        left: `${branchOpMetadata.startX}px`,
        top: `${branchOpMetadata.startY}px`,
        width: `${branchOpMetadata.width}px`,
        height: `${branchOpMetadata.height}px`,
        zIndex: 10
      } : {}}
    >
      {/* Operation (if present - for Blb and Bb, not Br/Brs) - inline with previous operations - recursively parse to handle nested branches */}
      {operation && operation.trim() && (
        <>
          {parseExpression(operation, ruleId, side, operationIndexRef)}
        </>
      )}
      
      {/* Branch operator symbol with positioned branches */}
      <span className="mx-0">
        <div className="relative inline-flex items-center justify-center" style={{ minWidth: '50px', minHeight: '80px' }}>
        {/* Main branch operator symbol (Blb for Bb, or operator's SVG for others) - same border width as normal operators (14px) but taller (64px) */}
        <img 
          src={mainSvgSrc} 
          alt={operator}
          className="absolute opacity-90 z-10"
          style={{ 
            width: '14px', 
            height: '64px', 
            filter: 'brightness(0) invert(1)', 
            left: `0%`, 
            top: '50%', 
            transform: 'translate(0%, -50%)',
            objectFit: 'fill'
          }}
        />
        
        {/* For Bb, add Br symbol at the end of the longest branch, centered vertically */}
        {isBb && (
          <img 
            src={brSvgSrc} 
            alt="Br"
            className="absolute opacity-90 z-10"
            style={{ 
              width: '14px', 
              height: '64px', 
              filter: 'brightness(0) invert(1)', 
              left: '100%',

              transform: 'translate(0%, -0%)',
              objectFit: 'fill'
            }}
          />
        )}
        
        {/* Top branch - positioned at top right - recursively parse to handle nested branches */}
        <div className="absolute top-0 right-0 px-0 py-1 max-w-[120px]">
          {parseExpression(topBranch, ruleId, side, operationIndexRef)}
        </div>
        
        {/* Bottom branch - positioned at bottom right - recursively parse to handle nested branches */}
        <div className="absolute bottom-0 right-0 px-0 py-1 max-w-[120px]">
          {parseExpression(bottomBranch, ruleId, side, operationIndexRef)}
        </div>
      </div>
      </span>
    </span>
  );
};

// Parse expression and convert to SVG components with metadata positioning
const parseExpression = (
  expr: string, 
  ruleId?: string, 
  side?: 'left' | 'right',
  operationIndexRef?: { current: number }
): React.ReactNode[] => {
  const parts: React.ReactNode[] = [];
  
  // First, check for branch operators (order matters - longer patterns first)
  const branchPattern = /(\\Blb|\\Brs|\\Br|\\Bb|\\Bs)/g;
  let branchMatch;
  const branchIndices: Array<{ operator: string; index: number }> = [];
  
  while ((branchMatch = branchPattern.exec(expr)) !== null) {
    branchIndices.push({
      operator: branchMatch[0],
      index: branchMatch.index
    });
  }
  
  // Process branches first (from right to left to maintain indices)
  branchIndices.reverse();
  const processedRanges: Array<{ start: number; end: number }> = [];
  
  for (const { operator, index } of branchIndices) {
    // Check if this range is already processed
    if (processedRanges.some(range => index >= range.start && index < range.end)) {
      continue;
    }
    
    const branchResult = parseBranchOperator(operator, expr, index);
    if (branchResult) {
      processedRanges.push({ start: index, end: branchResult.endIndex + 1 });
      
      // Replace this branch with a placeholder for now
      // We'll insert the component at the right position
    }
  }
  
  // Re-sort by start index for left-to-right processing
  processedRanges.sort((a, b) => a.start - b.start);
  
  // Build result by processing non-branch parts and inserting branches
  let lastIndex = 0;
  let partIndex = 0;
  
  for (const { operator, index } of branchIndices.reverse()) {
    // Check if already processed
    if (processedRanges.some(range => index >= range.start && index < range.end && range.start !== index)) {
      continue;
    }
    
      // Add content before this branch
      if (index > lastIndex) {
        const beforeExpr = expr.substring(lastIndex, index);
        if (beforeExpr.trim()) {
          parts.push(...parseNonBranchExpression(beforeExpr, `before-${partIndex}-`, ruleId, side, operationIndexRef));
        }
      }
      
      // Parse and add branch
      const branchResult = parseBranchOperator(operator, expr, index);
      if (branchResult) {
        parts.push(
          <BranchComponent
            key={`branch-${partIndex}`}
            operator={operator}
            operation={branchResult.operation}
            topBranch={branchResult.topBranch}
            bottomBranch={branchResult.bottomBranch}
            keyPrefix={`branch-${partIndex}`}
            ruleId={ruleId}
            side={side}
            operationIndexRef={operationIndexRef}
          />
        );
        lastIndex = branchResult.endIndex + 1;
      } else {
        lastIndex = index + operator.length;
      }
      
      partIndex++;
    }
    
    // Add remaining content
    if (lastIndex < expr.length) {
      const remainingExpr = expr.substring(lastIndex);
      if (remainingExpr.trim()) {
        parts.push(...parseNonBranchExpression(remainingExpr, `after-${partIndex}-`, ruleId, side, operationIndexRef));
      }
    }
    
    // If no branches found, parse normally
    if (branchIndices.length === 0) {
      return parseNonBranchExpression(expr, 'expr-', ruleId, side, operationIndexRef);
    }
  
  return parts.length > 0 ? parts : [<span key="empty" className="font-mono text-xs">{expr}</span>];
};

interface RuleCardProps {
  rule: Rule;
  isExpanded: boolean;
  onToggle: () => void;
}

// Helper function to get rule metadata
const getRuleMetadata = (ruleId: string): { left: RuleExpressionMetadata; right: RuleExpressionMetadata } | undefined => {
  return ruleMetadataStore.get(ruleId);
};

const RuleCard: React.FC<RuleCardProps> = ({ rule, isExpanded, onToggle }) => {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  
  // Track operation positions when rule is expanded
  useEffect(() => {
    if (isExpanded) {
      const leftOps = trackOperationPositions(rule.leftSide, rule.id, 'left');
      const rightOps = trackOperationPositions(rule.rightSide, rule.id, 'right');
      
      const leftTotalWidth = Math.max(...leftOps.map(op => op.startX + op.width), 0);
      const rightTotalWidth = Math.max(...rightOps.map(op => op.startX + op.width), 0);
      const leftTotalHeight = Math.max(...leftOps.map(op => op.height), OPERATOR_SVG_HEIGHT);
      const rightTotalHeight = Math.max(...rightOps.map(op => op.height), OPERATOR_SVG_HEIGHT);
      
      ruleMetadataStore.set(rule.id, {
        left: {
          ruleId: rule.id,
          side: 'left',
          operations: leftOps,
          totalWidth: leftTotalWidth,
          totalHeight: leftTotalHeight
        },
        right: {
          ruleId: rule.id,
          side: 'right',
          operations: rightOps,
          totalWidth: rightTotalWidth,
          totalHeight: rightTotalHeight
        }
      });
    }
  }, [rule.id, rule.leftSide, rule.rightSide, isExpanded]);
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
          
          {/* Text Input Example */}
          <div className="bg-muted/30 rounded-md p-4 mb-4">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Input Text</p>
            <div className="flex flex-wrap items-center justify-center gap-3 font-mono">
              <span className="text-foreground bg-muted px-3 py-1.5 rounded border border-border text-sm">
                {rule.leftSide}
              </span>
              <EquivalenceSymbol size={28} />
              <span className="text-foreground bg-muted px-3 py-1.5 rounded border border-border text-sm">
                {rule.rightSide}
              </span>
            </div>
          </div>

          {/* SVG Rendered Example */}
          <div className="bg-muted/30 rounded-md p-4">
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">SVG Rendered</p>
            <div className="flex flex-wrap items-center justify-center gap-3 min-h-[40px] py-2">
              <div 
                ref={leftRef}
                className="relative bg-muted px-3 py-1.5 rounded border border-border"
                style={{ 
                  position: 'relative',
                  width: getRuleMetadata(rule.id)?.left.totalWidth ? `${getRuleMetadata(rule.id)!.left.totalWidth}px` : 'auto',
                  height: getRuleMetadata(rule.id)?.left.totalHeight ? `${getRuleMetadata(rule.id)!.left.totalHeight}px` : 'auto',
                  minHeight: '40px'
                }}
              >
                {parseExpression(rule.leftSide, rule.id, 'left', { current: 0 })}
              </div>
              <EquivalenceSymbol size={28} />
              <div 
                ref={rightRef}
                className="relative bg-muted px-3 py-1.5 rounded border border-border"
                style={{ 
                  position: 'relative',
                  width: getRuleMetadata(rule.id)?.right.totalWidth ? `${getRuleMetadata(rule.id)!.right.totalWidth}px` : 'auto',
                  height: getRuleMetadata(rule.id)?.right.totalHeight ? `${getRuleMetadata(rule.id)!.right.totalHeight}px` : 'auto',
                  minHeight: '40px'
                }}
              >
                {parseExpression(rule.rightSide, rule.id, 'right', { current: 0 })}
              </div>
            </div>
          </div>
          
          {/* Debug: Show operation metadata */}
          {isExpanded && getRuleMetadata(rule.id) && (
            <div className="mt-4 text-xs text-muted-foreground">
              <details>
                <summary>Operation Positions (Debug)</summary>
                <div className="mt-2 space-y-2">
                  <div>
                    <strong>Left Side:</strong>
                    <ul className="ml-4 list-disc">
                      {getRuleMetadata(rule.id)?.left.operations.map(op => (
                        <li key={op.id}>
                          {op.operator}: x={op.startX.toFixed(1)}, y={op.startY.toFixed(1)}, w={op.width.toFixed(1)}, h={op.height.toFixed(1)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <strong>Right Side:</strong>
                    <ul className="ml-4 list-disc">
                      {getRuleMetadata(rule.id)?.right.operations.map(op => (
                        <li key={op.id}>
                          {op.operator}: x={op.startX.toFixed(1)}, y={op.startY.toFixed(1)}, w={op.width.toFixed(1)}, h={op.height.toFixed(1)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GlossarySection;
