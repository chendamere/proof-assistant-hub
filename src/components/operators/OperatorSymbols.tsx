import React from 'react';
import { cn } from '@/lib/utils';

interface OperatorProps {
  className?: string;
  size?: number;
  operand?: string;
  operand2?: string;
}

// ⊙ Global Space Operator
export const GlobalSpaceOp: React.FC<OperatorProps> = ({ className, size = 20, operand }) => (
  <span className={cn("operator-symbol inline-flex items-center gap-0.5", className)}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-operator-global">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2" fill="currentColor" />
    </svg>
    {operand && <span className="font-mono text-foreground">{operand}</span>}
  </span>
);

// ⊚ Temporary Space Operator
export const TempSpaceOp: React.FC<OperatorProps> = ({ className, size = 20, operand }) => (
  <span className={cn("operator-symbol inline-flex items-center gap-0.5", className)}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-operator-temp">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
    {operand && <span className="font-mono text-foreground">{operand}</span>}
  </span>
);

// ⊗ Copy Operator
export const CopyOp: React.FC<OperatorProps> = ({ className, size = 20, operand, operand2 }) => (
  <span className={cn("operator-symbol inline-flex items-center gap-0.5", className)}>
    {operand && <span className="font-mono text-foreground">{operand}</span>}
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-operator-copy">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" />
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" />
    </svg>
    {operand2 && <span className="font-mono text-foreground">{operand2}</span>}
  </span>
);

// ⊘ ID Operator
export const IdOp: React.FC<OperatorProps> = ({ className, size = 20, operand, operand2 }) => (
  <span className={cn("operator-symbol inline-flex items-center gap-0.5", className)}>
    {operand && <span className="font-mono text-foreground">{operand}</span>}
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-operator-id">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <line x1="6" y1="18" x2="18" y2="6" stroke="currentColor" strokeWidth="2" />
    </svg>
    {operand2 && <span className="font-mono text-foreground">{operand2}</span>}
  </span>
);

// ⊖ Subnode Operator
export const SubnodeOp: React.FC<OperatorProps> = ({ className, size = 20, operand, operand2 }) => (
  <span className={cn("operator-symbol inline-flex items-center gap-0.5", className)}>
    {operand && <span className="font-mono text-foreground">{operand}</span>}
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-operator-subnode">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="2" />
    </svg>
    {operand2 && <span className="font-mono text-foreground">{operand2}</span>}
  </span>
);

// ⊕ Release Operator
export const ReleaseOp: React.FC<OperatorProps> = ({ className, size = 20, operand }) => (
  <span className={cn("operator-symbol inline-flex items-center gap-0.5", className)}>
    {operand && <span className="font-mono text-foreground">{operand}</span>}
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-operator-release">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <line x1="12" y1="6" x2="12" y2="18" stroke="currentColor" strokeWidth="2" />
      <line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="2" />
    </svg>
  </span>
);

// ⊝ Next Node Operator
export const NextNodeOp: React.FC<OperatorProps> = ({ className, size = 20, operand }) => (
  <span className={cn("operator-symbol inline-flex items-center gap-0.5", className)}>
    {operand && <span className="font-mono text-foreground">{operand}</span>}
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-operator-next">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M9 8l6 4-6 4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  </span>
);

// ⊖ Previous Node Operator  
export const PrevNodeOp: React.FC<OperatorProps> = ({ className, size = 20, operand }) => (
  <span className={cn("operator-symbol inline-flex items-center gap-0.5", className)}>
    {operand && <span className="font-mono text-foreground">{operand}</span>}
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-operator-prev">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M15 8l-6 4 6 4" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  </span>
);

// ⊛ Compare Operator (branching)
export const CompareOp: React.FC<OperatorProps> = ({ className, size = 20, operand, operand2 }) => (
  <span className={cn("operator-symbol inline-flex items-center gap-0.5", className)}>
    {operand && <span className="font-mono text-foreground">{operand}</span>}
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-operator-compare">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12" y1="3" x2="12" y2="6" stroke="currentColor" strokeWidth="1.5" />
      <line x1="12" y1="18" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" />
      <line x1="3" y1="12" x2="6" y2="12" stroke="currentColor" strokeWidth="1.5" />
      <line x1="18" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
    {operand2 && <span className="font-mono text-foreground">{operand2}</span>}
  </span>
);

// ⊛ Assign Operator
export const AssignOp: React.FC<OperatorProps> = ({ className, size = 20, operand, operand2 }) => (
  <span className={cn("operator-symbol inline-flex items-center gap-0.5", className)}>
    {operand && <span className="font-mono text-foreground">{operand}</span>}
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-operator-assign">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.3" />
    </svg>
    {operand2 && <span className="font-mono text-foreground">{operand2}</span>}
  </span>
);

// ⊗ Logic Error Operator
export const ErrorOp: React.FC<OperatorProps> = ({ className, size = 20 }) => (
  <span className={cn("operator-symbol", className)}>
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-operator-error">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
      <line x1="8" y1="8" x2="16" y2="16" stroke="currentColor" strokeWidth="2.5" />
      <line x1="16" y1="8" x2="8" y2="16" stroke="currentColor" strokeWidth="2.5" />
    </svg>
  </span>
);

// ⟺ Equivalence Symbol
export const EquivalenceSymbol: React.FC<{ className?: string; size?: number }> = ({ className, size = 24 }) => (
  <span className={cn("operator-symbol mx-2", className)}>
    <svg width={size} height={size * 0.5} viewBox="0 0 48 24" fill="none" className="text-primary">
      <path d="M10 8h28M10 16h28" stroke="currentColor" strokeWidth="2.5" />
      <path d="M32 4l8 8-8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M16 4l-8 8 8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  </span>
);

// Empty Node (φ)
export const EmptyNode: React.FC<{ className?: string }> = ({ className }) => (
  <span className={cn("font-mono text-muted-foreground italic", className)}>ϕ</span>
);

// Comma separator used in formal notation
export const CommaSep: React.FC<{ className?: string }> = ({ className }) => (
  <span className={cn("text-muted-foreground mx-0.5", className)}>,</span>
);

// Import SVG operators
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

// SVG-based operator component
interface SvgOperatorProps {
  src: string;
  label: string;
  description: string;
  syntax: string;
  size?: number;
  operandBefore?: string;
  operandAfter?: string;
}

const SvgOperator: React.FC<SvgOperatorProps> = ({ src, label, description, syntax, size = 10, operandBefore, operandAfter }) => (
  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
    <div className="flex items-center gap-0.5 font-mono">
      {operandBefore && <span className="text-foreground text-[10px]">{operandBefore}</span>}
      <img 
        src={src} 
        alt={label} 
        style={{ width: size, height: size }} 
        className="inline-block opacity-80 invert brightness-[0.85] sepia saturate-[3] hue-rotate-[10deg]" 
      />
      {operandAfter && <span className="text-foreground text-[10px]">{operandAfter}</span>}
    </div>
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{syntax}</code>
      </div>
      <span className="text-[10px] text-muted-foreground truncate">{description}</span>
    </div>
  </div>
);

// Operator data for search functionality
const operatorData = [
  { category: 'binary', src: OaSvg, label: 'Assign', description: 'i ← j (assign value)', syntax: 'iOaj', operandBefore: 'i', operandAfter: 'j' },
  { category: 'binary', src: ObSvg, label: 'Subnode', description: 'Get/set child node', syntax: 'iObj', operandBefore: 'i', operandAfter: 'j' },
  { category: 'binary', src: OcSvg, label: 'Copy', description: 'Copy node reference', syntax: 'iOcj', operandBefore: 'i', operandAfter: 'j' },
  { category: 'binary', src: OdSvg, label: 'ID', description: 'Get node identifier', syntax: 'iOdj', operandBefore: 'i', operandAfter: 'j' },
  { category: 'binary', src: OeSvg, label: 'Equivalence', description: 'Value comparison branch', syntax: 'iOej', operandBefore: 'i', operandAfter: 'j' },
  { category: 'unary', src: OgSvg, label: 'Global Space', description: 'Allocate global node', syntax: 'Ogi', operandAfter: 'i' },
  { category: 'unary', src: OtSvg, label: 'Temp Space', description: 'Allocate temporary node', syntax: 'Oti', operandAfter: 'i' },
  { category: 'unary', src: OnSvg, label: 'Next Node', description: 'Move to next node', syntax: 'iOn', operandBefore: 'i' },
  { category: 'unary', src: OpSvg, label: 'Prev Node', description: 'Move to previous node', syntax: 'iOp', operandBefore: 'i' },
  { category: 'unary', src: OsSvg, label: 'Release', description: 'Release node reference', syntax: 'iOs', operandBefore: 'i' },
  { category: 'nullary', src: OrSvg, label: 'Error', description: 'Logic error state', syntax: 'Or' },
];

// Operator legend component with search and actual SVGs
export const OperatorLegend: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const filteredOperators = operatorData.filter(op => 
    op.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.syntax.toLowerCase().includes(searchTerm.toLowerCase()) ||
    op.description.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const binaryOps = filteredOperators.filter(op => op.category === 'binary');
  const unaryOps = filteredOperators.filter(op => op.category === 'unary');
  const nullaryOps = filteredOperators.filter(op => op.category === 'nullary');

  return (
    <div className="p-4">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search operators..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg bg-muted/50 border border-border focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
        />
      </div>
      
      {binaryOps.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Binary Operators</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {binaryOps.map(op => (
              <SvgOperator key={op.syntax} {...op} />
            ))}
          </div>
        </div>
      )}
      
      {unaryOps.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Unary Operators</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {unaryOps.map(op => (
              <SvgOperator key={op.syntax} {...op} />
            ))}
          </div>
        </div>
      )}
      
      {nullaryOps.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">Nullary Operators</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {nullaryOps.map(op => (
              <SvgOperator key={op.syntax} {...op} />
            ))}
          </div>
        </div>
      )}
      
      {filteredOperators.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-4">No operators found</p>
      )}
    </div>
  );
};
