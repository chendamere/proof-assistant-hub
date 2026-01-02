import React from 'react';

// Import all operator SVGs
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

// Relationship operators
import PbSvg from '@/assets/operators/binary/Pb.svg';
import PcSvg from '@/assets/operators/binary/Pc.svg';
import PeSvg from '@/assets/operators/binary/Pe.svg';
import PnSvg from '@/assets/operators/binary/Pn.svg';
import PneSvg from '@/assets/operators/binary/Pne.svg';
import PnlSvg from '@/assets/operators/binary/Pnl.svg';
import PnmSvg from '@/assets/operators/binary/Pnm.svg';
import PpSvg from '@/assets/operators/binary/Pp.svg';
import PsSvg from '@/assets/operators/binary/Ps.svg';

// Negated relationship operators
import nPbSvg from '@/assets/operators/binary/nPb.svg';
import nPcSvg from '@/assets/operators/binary/nPc.svg';
import nPeSvg from '@/assets/operators/binary/nPe.svg';
import nPnSvg from '@/assets/operators/binary/nPn.svg';
import nPneSvg from '@/assets/operators/binary/nPne.svg';
import nPnlSvg from '@/assets/operators/binary/nPnl.svg';
import nPnmSvg from '@/assets/operators/binary/nPnm.svg';
import nPpSvg from '@/assets/operators/binary/nPp.svg';
import nPsSvg from '@/assets/operators/binary/nPs.svg';

// Additional unary operators
import TcSvg from '@/assets/operators/unary/Tc.svg';
import TtSvg from '@/assets/operators/unary/Tt.svg';
import PuSvg from '@/assets/operators/unary/Pu.svg';
import nPuSvg from '@/assets/operators/unary/nPu.svg';

// Operator mapping
const operatorMap: Record<string, string> = {
  // Binary operators (O)
  '\\Oa': OaSvg,
  '\\Ob': ObSvg,
  '\\Oc': OcSvg,
  '\\Od': OdSvg,
  '\\Oe': OeSvg,
  
  // Unary operators
  '\\Og': OgSvg,
  '\\Ot': OtSvg,
  '\\On': OnSvg,
  '\\Op': OpSvg,
  '\\Os': OsSvg,
  '\\Or': OrSvg,
  '\\Tc': TcSvg,
  '\\Tt': TtSvg,
  '\\Pu': PuSvg,
  '\\nPu': nPuSvg,
  
  // Relationship operators (P)
  '\\Pb': PbSvg,
  '\\Pc': PcSvg,
  '\\Pe': PeSvg,
  '\\Pn': PnSvg,
  '\\Pne': PneSvg,
  '\\Pnl': PnlSvg,
  '\\Pnm': PnmSvg,
  '\\Pp': PpSvg,
  '\\Ps': PsSvg,
  
  // Negated relationship operators (nP)
  '\\nPb': nPbSvg,
  '\\nPc': nPcSvg,
  '\\nPe': nPeSvg,
  '\\nPn': nPnSvg,
  '\\nPne': nPneSvg,
  '\\nPnl': nPnlSvg,
  '\\nPnm': nPnmSvg,
  '\\nPp': nPpSvg,
  '\\nPs': nPsSvg,
};

interface ExpressionRendererProps {
  expression: string;
  size?: number;
  branchDepth?: number;
  onBranchHeightChange?: (height: number) => void;
}

interface Token {
  type: 'operator' | 'text' | 'branch';
  value: string;
  operatorSrc?: string;
  branchData?: {
    type: 'Bb' | 'Blb' | 'Br' | 'Bls' | 'Brs';
    condition: string;
    branch1: string;
    branch2: string;
  };
}

// Parse branch expressions like \Bb{condition}{branch1}{branch2}
const parseBranchExpression = (expr: string): { match: boolean; branchData?: Token['branchData']; remaining: string } => {
  // Match branch patterns: \Bb{...}{...}{...}, \Blb{...}{...}{...}, \Br{...}{...}{...}, \Bls{...}{...}{...}, \Brs{...}{...}{...}
  const branchPatterns = ['\\Bb', '\\Blb', '\\Br', '\\Bls', '\\Brs'];
  
  for (const pattern of branchPatterns) {
    if (expr.startsWith(pattern)) {
      let remaining = expr.slice(pattern.length);
      
      // Parse three brace groups
      const braces: string[] = [];
      for (let i = 0; i < 3; i++) {
        if (!remaining.startsWith('{')) {
          return { match: false, remaining: expr };
        }
        
        let depth = 0;
        let content = '';
        let j = 0;
        
        for (; j < remaining.length; j++) {
          const char = remaining[j];
          if (char === '{') {
            depth++;
            if (depth > 1) content += char;
          } else if (char === '}') {
            depth--;
            if (depth === 0) break;
            content += char;
          } else {
            content += char;
          }
        }
        
        if (depth !== 0) {
          return { match: false, remaining: expr };
        }
        
        braces.push(content);
        remaining = remaining.slice(j + 1);
      }
      
      return {
        match: true,
        branchData: {
          type: pattern.slice(1) as 'Bb' | 'Blb' | 'Br' | 'Bls' | 'Brs',
          condition: braces[0],
          branch1: braces[1],
          branch2: braces[2],
        },
        remaining,
      };
    }
  }
  
  return { match: false, remaining: expr };
};

// Parse the expression into tokens
const parseExpression = (expr: string): Token[] => {
  const tokens: Token[] = [];
  let remaining = expr;
  
  // Sort operators by length (longest first) to match longer operators first
  const sortedOperators = Object.keys(operatorMap).sort((a, b) => b.length - a.length);
  
  while (remaining.length > 0) {
    let matched = false;
    
    // Try to match branch expressions first
    const branchResult = parseBranchExpression(remaining);
    if (branchResult.match && branchResult.branchData) {
      tokens.push({
        type: 'branch',
        value: remaining.slice(0, remaining.length - branchResult.remaining.length),
        branchData: branchResult.branchData,
      });
      remaining = branchResult.remaining;
      matched = true;
      continue;
    }
    
    // Try to match an operator
    for (const op of sortedOperators) {
      if (remaining.startsWith(op)) {
        tokens.push({
          type: 'operator',
          value: op,
          operatorSrc: operatorMap[op],
        });
        remaining = remaining.slice(op.length);
        matched = true;
        break;
      }
    }
    
    if (!matched) {
      // If no operator matched, take the next character as text
      const char = remaining[0];
      
      // If the last token is text, append to it
      if (tokens.length > 0 && tokens[tokens.length - 1].type === 'text') {
        tokens[tokens.length - 1].value += char;
      } else {
        tokens.push({
          type: 'text',
          value: char,
        });
      }
      remaining = remaining.slice(1);
    }
  }
  
  return tokens;
};

// Branch component for rendering bracket-style branches
const BranchRenderer: React.FC<{
  branchData: Token['branchData'];
  size: number;
  depth?: number;
  onChildHeightChange?: (height: number) => void;
}> = ({ branchData, size, depth = 0, onChildHeightChange }) => {
  const [bracketHeight, setBracketHeight] = React.useState<number>(() => {
    // Calculate initial bracket height based on depth
    const baseHeight = size * 3.6;
    const depthReduction = depth * 0.8;
    const depthMultiplier = Math.max(0, 1 - depthReduction);
    return baseHeight * depthMultiplier;
  });
  
  // Track heights for each branch separately
  const [branch1Height, setBranch1Height] = React.useState<number>(0);
  const [branch2Height, setBranch2Height] = React.useState<number>(0);
  
  // Refs to measure each branch content
  const branch1Ref = React.useRef<HTMLSpanElement>(null);
  const branch2Ref = React.useRef<HTMLSpanElement>(null);
  
  if (!branchData) return null;
  
  const { type, condition, branch1, branch2 } = branchData;
  
  // Helper function to check if content contains nested branches
  const hasNestedBranches = React.useCallback((content: string): boolean => {
    const branchPatterns = ['\\Bb', '\\Blb', '\\Br', '\\Bls', '\\Brs'];
    return branchPatterns.some(pattern => content.includes(pattern));
  }, []);
  
  const branch1HasNested = hasNestedBranches(branch1);
  const branch2HasNested = hasNestedBranches(branch2);
  
  // Calculate minimum bracket height for non-nested branches
  const minBracketHeight = size ; // Minimum height for alignment
  
  // Callback for when branch1 child branches need more height
  const handleBranch1HeightChange = React.useCallback((childHeight: number) => {
    setBranch1Height(childHeight);
    // Increase overall bracket height if needed
    setBracketHeight(prevHeight => {
      const newHeight = Math.max(prevHeight, childHeight, branch2Height || minBracketHeight)*0.5;
      if (onChildHeightChange) {
        onChildHeightChange(newHeight);
      }
      return newHeight;
    });
  }, [size, branch2Height, minBracketHeight, onChildHeightChange]);
  
  // Callback for when branch2 child branches need more height
  const handleBranch2HeightChange = React.useCallback((childHeight: number) => {
    setBranch2Height(childHeight);
    // Increase overall bracket height if needed
    setBracketHeight(prevHeight => {
      const newHeight = Math.max(prevHeight, branch1Height || minBracketHeight, childHeight)*0.5;
      if (onChildHeightChange) {
        onChildHeightChange(newHeight);
      }
      return newHeight;
    });
  }, [size, branch1Height, minBracketHeight, onChildHeightChange]);
  
  // Render content inside branches recursively, incrementing depth
  const renderBranchContent = (content: string, isBranch1: boolean): React.ReactNode => {
    if (!content.trim()) return <span className="opacity-0">.</span>;
    // Increment depth for nested branches
    const childDepth = depth + 1;
    const heightCallback = isBranch1 ? handleBranch1HeightChange : handleBranch2HeightChange;
    return (
      <ExpressionRenderer 
        expression={content} 
        size={size} 
        branchDepth={childDepth}
        onBranchHeightChange={heightCallback}
      />
    );
  };
  
  const content1 = renderBranchContent(branch1, true);
  const content2 = renderBranchContent(branch2, false);
  
  // Update bracket height when branch heights change
  React.useEffect(() => {
    // If a branch has nested content, use its height; otherwise use minimum
    const branch1FinalHeight = branch1HasNested ? branch1Height : minBracketHeight *  (branch2HasNested ? 1: 1.2);
    const branch2FinalHeight = branch2HasNested ? branch2Height : minBracketHeight *  (branch1HasNested ? 1: 1.2);
    
    // Overall bracket height should accommodate both branches
    const totalHeight = Math.max(
      branch1FinalHeight + branch2FinalHeight + (size * 2.5), // gap between branches
      bracketHeight
    );
    
    setBracketHeight(totalHeight);
    if (onChildHeightChange && totalHeight > bracketHeight) {
      onChildHeightChange(totalHeight);
    }
  }, [branch1Height, branch2Height, branch1HasNested, branch2HasNested, minBracketHeight, size]);
  
  // Determine which brackets to show based on type
  const showLeftBracket = type === 'Bb' || type === 'Blb' || type === 'Bls';
  const showRightBracket = type === 'Bb' || type === 'Br' || type === 'Brs';
  
  // Border styles for brackets using CSS
  const leftBracketClass = "border-l border-t border-b border-foreground";
  const rightBracketClass = "border-r border-t border-b border-foreground";
  
  // Calculate font size offset: text-sm is 0.875rem (14px at default 16px base)
  // Half of font size for upward offset
  const transformOffset = 0.3+((!branch1HasNested&&branch2HasNested) ? -1 : 0)+((branch1HasNested&&!branch2HasNested) ? 1 : 0);
  const yoffset = transformOffset.toString() + 'rem';

  return (
    <span className="inline-flex items-center align-middle">
      {/* Condition before brackets */}
      {condition && (
        <span className="inline-flex items-center">
          <ExpressionRenderer expression={condition} size={size} />
        </span>
      )}
      
      {/* Left bracket */}
      {showLeftBracket && (
        <span 
          className={`${leftBracketClass} flex-shrink-0`} 
          style={{ 
            width: '3px', 
            height: `${bracketHeight}px`, 
            alignSelf: 'center'
          }} 
        />
      )}
      
      {/* Branch content - stacked vertically with proportional spacing */}
      <span 
        className="inline-flex flex-col justify-between" 
        style={{ 
          minWidth: '12px', 
          gap: `${size * 2.5}px`, 
          padding: `${size * 0.5}px 0`,
          transform: `translateY(-${yoffset})`
        }}
      >
        {/* Top branch content - aligned with top bracket line */}
        <span 
          ref={branch1Ref}
          className="inline-flex items-center px-1 whitespace-nowrap"
          style={{
            minHeight: branch1HasNested ? 'auto' : `${minBracketHeight}px`,
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          {content1}
        </span>
        
        {/* Bottom branch content - aligned with bottom bracket line */}
        <span 
          ref={branch2Ref}
          className="inline-flex items-center px-1 whitespace-nowrap"
          style={{
            minHeight: branch2HasNested ? 'auto' : `${minBracketHeight}px`,
            display: 'inline-flex',
            alignItems: 'center'
          }}
        >
          {content2}
        </span>
      </span>
      
      {/* Right bracket */}
      {showRightBracket && (
        <span 
          className={`${rightBracketClass} flex-shrink-0`} 
          style={{ 
            width: '3px', 
            height: `${bracketHeight}px`, 
            alignSelf: 'center'
          }} 
        />
      )}
    </span>
  );
};

export const ExpressionRenderer: React.FC<ExpressionRendererProps> = ({ expression, size = 16, branchDepth = 0, onBranchHeightChange }) => {
  if (!expression.trim()) {
    return (
      <span className="text-muted-foreground italic text-sm">Enter an expression above...</span>
    );
  }

  const tokens = parseExpression(expression);
  // Increase size by 20%
  const adjustedSize = size * 1.2;

  return (
    <span className="inline-flex items-center flex-wrap gap-0.5">
      {tokens.map((token, index) => {
        if (token.type === 'branch' && token.branchData) {
          return (
            <BranchRenderer
              key={index}
              branchData={token.branchData}
              size={size}
              depth={branchDepth}
              onChildHeightChange={onBranchHeightChange}
            />
          );
        } else if (token.type === 'operator' && token.operatorSrc) {
          return (
            <img
              key={index}
              src={token.operatorSrc}
              alt={token.value}
              title={token.value}
              style={{ width: adjustedSize, height: adjustedSize, verticalAlign: 'middle' }}
              className="inline-block invert brightness-0 invert align-middle"
            />
          );
        } else {
          return (
            <span key={index} className="font-mono text-foreground text-sm">
              {token.value}
            </span>
          );
        }
      })}
    </span>
  );
};

export default ExpressionRenderer;
