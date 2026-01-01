import React from 'react';

export const TreeStructureDiagram: React.FC = () => {
  return (
    <div className="flex flex-col items-center">
      <svg width="380" height="280" viewBox="0 0 380 280" className="max-w-full">
        {/* Definitions for markers */}
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="hsl(var(--foreground))" opacity="0.7" />
          </marker>
          <marker id="arrowhead-dashed" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="hsl(var(--muted-foreground))" opacity="0.5" />
          </marker>
        </defs>

        {/* Left vertical chain bracket */}
        <path 
          d="M 45 35 C 30 35 30 165 45 165" 
          fill="none" 
          stroke="hsl(var(--primary))" 
          strokeWidth="1.5"
          opacity="0.6"
        />

        {/* Top node (empty/null - dashed) */}
        <g className="text-muted-foreground">
          <circle cx="65" cy="40" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="65" y="44" textAnchor="middle" className="text-[10px] fill-muted-foreground font-mono">ø</text>
          {/* Self-reference arrow */}
          <path d="M 83 35 C 100 20 100 55 83 45" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" markerEnd="url(#arrowhead-dashed)" />
        </g>

        {/* Vertical arrows between nodes */}
        <line x1="65" y1="58" x2="65" y2="82" stroke="hsl(var(--foreground))" strokeWidth="1.5" markerEnd="url(#arrowhead)" opacity="0.7" />
        <line x1="65" y1="118" x2="65" y2="82" stroke="hsl(var(--foreground))" strokeWidth="1.5" markerEnd="url(#arrowhead)" opacity="0.7" />

        {/* Middle node (solid) */}
        <circle cx="65" cy="100" r="18" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
        
        {/* Child arrow from middle node */}
        <line x1="83" y1="100" x2="140" y2="100" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="4 3" markerEnd="url(#arrowhead-dashed)" />

        {/* Empty child node with self-reference */}
        <g className="text-muted-foreground">
          <circle cx="165" cy="100" r="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="165" y="104" textAnchor="middle" className="text-[10px] fill-muted-foreground font-mono">ø</text>
          <path d="M 181 95 C 205 80 205 120 181 105" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" markerEnd="url(#arrowhead-dashed)" />
        </g>

        {/* Vertical arrows to bottom node */}
        <line x1="65" y1="118" x2="65" y2="142" stroke="hsl(var(--foreground))" strokeWidth="1.5" markerEnd="url(#arrowhead)" opacity="0.7" />
        <line x1="65" y1="178" x2="65" y2="142" stroke="hsl(var(--foreground))" strokeWidth="1.5" markerEnd="url(#arrowhead)" opacity="0.7" />

        {/* Bottom node (solid) */}
        <circle cx="65" cy="160" r="18" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />

        {/* Child arrow to nested structure */}
        <line x1="83" y1="160" x2="140" y2="160" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="4 3" markerEnd="url(#arrowhead-dashed)" />

        {/* Right nested structure bracket */}
        <path 
          d="M 155 135 C 140 135 140 225 155 225" 
          fill="none" 
          stroke="hsl(var(--primary))" 
          strokeWidth="1.5"
          opacity="0.6"
        />

        {/* Nested top node (empty) */}
        <g className="text-muted-foreground">
          <circle cx="175" cy="140" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="175" y="144" textAnchor="middle" className="text-[9px] fill-muted-foreground font-mono">ø</text>
          <path d="M 189 136 C 205 125 205 155 189 144" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" markerEnd="url(#arrowhead-dashed)" />
        </g>

        {/* Vertical arrows in nested */}
        <line x1="175" y1="154" x2="175" y2="168" stroke="hsl(var(--foreground))" strokeWidth="1.5" markerEnd="url(#arrowhead)" opacity="0.7" />
        <line x1="175" y1="198" x2="175" y2="168" stroke="hsl(var(--foreground))" strokeWidth="1.5" markerEnd="url(#arrowhead)" opacity="0.7" />

        {/* Nested middle node (solid) */}
        <circle cx="175" cy="180" r="14" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />

        {/* Child from nested node */}
        <line x1="189" y1="180" x2="240" y2="180" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="4 3" markerEnd="url(#arrowhead-dashed)" />

        {/* Final empty child with self-ref */}
        <g className="text-muted-foreground">
          <circle cx="265" cy="180" r="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x="265" y="184" textAnchor="middle" className="text-[9px] fill-muted-foreground font-mono">ø</text>
          <path d="M 279 176 C 300 162 300 198 279 184" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" markerEnd="url(#arrowhead-dashed)" />
        </g>

        {/* Nested bottom connection back up */}
        <line x1="175" y1="198" x2="175" y2="212" stroke="hsl(var(--foreground))" strokeWidth="1.5" markerEnd="url(#arrowhead)" opacity="0.7" />
        
        {/* Nested bottom node connecting to top */}
        <circle cx="175" cy="220" r="14" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" opacity="0.4" strokeDasharray="3 3" />
      </svg>
      <p className="text-sm text-muted-foreground italic mt-2">Data structure</p>
    </div>
  );
};

export default TreeStructureDiagram;
