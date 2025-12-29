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
      <path d="M4 8h32M4 16h32" stroke="currentColor" strokeWidth="2.5" />
      <path d="M30 4l8 8-8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M18 4l-8 8 8 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
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

// Operator legend component
export const OperatorLegend: React.FC = () => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
    <div className="flex items-center gap-2">
      <GlobalSpaceOp operand="i" />
      <span className="text-sm text-muted-foreground">Global space</span>
    </div>
    <div className="flex items-center gap-2">
      <TempSpaceOp operand="i" />
      <span className="text-sm text-muted-foreground">Temporary space</span>
    </div>
    <div className="flex items-center gap-2">
      <CopyOp operand="i" operand2="j" />
      <span className="text-sm text-muted-foreground">Copy</span>
    </div>
    <div className="flex items-center gap-2">
      <IdOp operand="i" operand2="j" />
      <span className="text-sm text-muted-foreground">Node ID</span>
    </div>
    <div className="flex items-center gap-2">
      <SubnodeOp operand="i" operand2="j" />
      <span className="text-sm text-muted-foreground">Subnode</span>
    </div>
    <div className="flex items-center gap-2">
      <ReleaseOp operand="i" />
      <span className="text-sm text-muted-foreground">Release</span>
    </div>
    <div className="flex items-center gap-2">
      <NextNodeOp operand="i" />
      <span className="text-sm text-muted-foreground">Next node</span>
    </div>
    <div className="flex items-center gap-2">
      <PrevNodeOp operand="i" />
      <span className="text-sm text-muted-foreground">Previous node</span>
    </div>
    <div className="flex items-center gap-2">
      <CompareOp operand="i" operand2="j" />
      <span className="text-sm text-muted-foreground">Compare</span>
    </div>
    <div className="flex items-center gap-2">
      <AssignOp operand="i" operand2="j" />
      <span className="text-sm text-muted-foreground">Assign</span>
    </div>
    <div className="flex items-center gap-2">
      <ErrorOp />
      <span className="text-sm text-muted-foreground">Logic error</span>
    </div>
    <div className="flex items-center gap-2">
      <EmptyNode />
      <span className="text-sm text-muted-foreground">Empty node</span>
    </div>
  </div>
);
