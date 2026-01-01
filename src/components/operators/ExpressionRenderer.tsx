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
import PuSvg from '@/assets/operators/binary/Pu.svg';

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
import nPuSvg from '@/assets/operators/binary/nPu.svg';

// Branch operators
import BbSvg from '@/assets/operators/branch/Bb.svg';
import BlbSvg from '@/assets/operators/branch/Blb.svg';
import BrSvg from '@/assets/operators/branch/Br.svg';

// Additional unary operators
import TcSvg from '@/assets/operators/unary/Tc.svg';
import TtSvg from '@/assets/operators/unary/Tt.svg';

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
  '\\Pu': PuSvg,
  
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
  '\\nPu': nPuSvg,
  
  // Branch operators
  '\\Bb': BbSvg,
  '\\Blb': BlbSvg,
  '\\Br': BrSvg,
};

interface ExpressionRendererProps {
  expression: string;
  size?: number;
}

interface Token {
  type: 'operator' | 'text';
  value: string;
  operatorSrc?: string;
}

// Parse the expression into tokens
const parseExpression = (expr: string): Token[] => {
  const tokens: Token[] = [];
  let remaining = expr;
  
  // Sort operators by length (longest first) to match longer operators first
  const sortedOperators = Object.keys(operatorMap).sort((a, b) => b.length - a.length);
  
  while (remaining.length > 0) {
    let matched = false;
    
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

export const ExpressionRenderer: React.FC<ExpressionRendererProps> = ({ expression, size = 16 }) => {
  if (!expression.trim()) {
    return (
      <span className="text-muted-foreground italic text-sm">Enter an expression above...</span>
    );
  }
  
  const tokens = parseExpression(expression);
  
  return (
    <span className="inline-flex items-center flex-wrap gap-0.5">
      {tokens.map((token, index) => {
        if (token.type === 'operator' && token.operatorSrc) {
          return (
            <img
              key={index}
              src={token.operatorSrc}
              alt={token.value}
              title={token.value}
              style={{ width: size, height: size }}
              className="inline-block opacity-90 dark:invert dark:brightness-[0.85]"
            />
          );
        } else {
          return (
            <span key={index} className="font-mono text-foreground">
              {token.value}
            </span>
          );
        }
      })}
    </span>
  );
};

export default ExpressionRenderer;
