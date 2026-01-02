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
}> = ({ branchData, size }) => {
  if (!branchData) return null;
  
  const { type, condition, branch1, branch2 } = branchData;
  
  // Render content inside branches recursively
  const renderBranchContent = (content: string) => {
    if (!content.trim()) return null;
    return <ExpressionRenderer expression={content} size={size} />;
  };
  
  const bracketStyle = {
    strokeWidth: 1.5,
    stroke: 'currentColor',
    fill: 'none',
  };
  
  // Left bracket SVG
  const LeftBracket = () => (
    <svg 
      viewBox="0 0 8 40" 
      className="h-full text-foreground"
      style={{ width: '6px', minHeight: '32px' }}
      preserveAspectRatio="none"
    >
      <path d="M7 1 L2 1 L2 39 L7 39" {...bracketStyle} />
    </svg>
  );
  
  // Right bracket SVG
  const RightBracket = () => (
    <svg 
      viewBox="0 0 8 40" 
      className="h-full text-foreground"
      style={{ width: '6px', minHeight: '32px' }}
      preserveAspectRatio="none"
    >
      <path d="M1 1 L6 1 L6 39 L1 39" {...bracketStyle} />
    </svg>
  );
  
  const content1 = renderBranchContent(branch1);
  const content2 = renderBranchContent(branch2);
  
  // Determine which brackets to show based on type
  const showLeftBracket = type === 'Bb' || type === 'Blb' || type === 'Bls';
  const showRightBracket = type === 'Bb' || type === 'Br' || type === 'Brs';
  
  return (
    <span className="inline-flex items-center">
      {/* Condition before brackets */}
      {condition && (
        <span className="inline-flex items-center mr-0.5">
          <ExpressionRenderer expression={condition} size={size} />
        </span>
      )}
      
      {/* Branch structure */}
      <span className="inline-flex items-stretch">
        {showLeftBracket && <LeftBracket />}
        
        <span className="inline-flex flex-col justify-center px-0.5 min-w-[8px]">
          {/* Top branch content */}
          <span className="inline-flex items-center justify-start leading-tight py-0.5">
            {content1 || <span className="w-1" />}
          </span>
          
          {/* Bottom branch content */}
          <span className="inline-flex items-center justify-start leading-tight py-0.5">
            {content2 || <span className="w-1" />}
          </span>
        </span>
        
        {showRightBracket && <RightBracket />}
      </span>
    </span>
  );
};

export const ExpressionRenderer: React.FC<ExpressionRendererProps> = ({ expression, size = 16 }) => {
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
