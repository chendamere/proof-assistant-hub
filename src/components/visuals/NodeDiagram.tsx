import React from 'react';

export const NodeDiagram: React.FC = () => {
  return (
    <div className="flex flex-col items-center">
      <svg width="320" height="180" viewBox="0 0 320 180" className="max-w-full">
        {/* Previous node arrow */}
        <g className="text-operator-prev">
          <line x1="60" y1="70" x2="105" y2="70" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="60,70 70,65 70,75" fill="currentColor" />
          <text x="30" y="75" className="text-[10px] fill-muted-foreground font-mono">previous</text>
          <text x="42" y="88" className="text-[10px] fill-muted-foreground font-mono">node</text>
        </g>

        {/* Next node arrow */}
        <g className="text-operator-next">
          <line x1="215" y1="70" x2="260" y2="70" stroke="currentColor" strokeWidth="1.5" />
          <polygon points="260,70 250,65 250,75" fill="currentColor" />
          <text x="272" y="75" className="text-[10px] fill-muted-foreground font-mono">next</text>
          <text x="272" y="88" className="text-[10px] fill-muted-foreground font-mono">node</text>
        </g>

        {/* Child node arrow */}
        <g className="text-operator-subnode">
          <line x1="160" y1="105" x2="160" y2="150" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
          <polygon points="160,150 155,140 165,140" fill="currentColor" />
          <text x="125" y="165" className="text-[10px] fill-muted-foreground font-mono">child node</text>
        </g>

        {/* ID indicator */}
        <g className="text-operator-id">
          <circle cx="200" cy="100" r="4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="204" y1="100" x2="225" y2="100" stroke="currentColor" strokeWidth="1" />
          <text x="230" y="104" className="text-[10px] fill-muted-foreground font-mono">id</text>
        </g>

        {/* Main node circle */}
        <circle 
          cx="160" 
          cy="70" 
          r="35" 
          fill="none" 
          stroke="hsl(var(--primary))" 
          strokeWidth="2"
          className="drop-shadow-sm"
        />
        
        {/* Data value text */}
        <text x="160" y="65" textAnchor="middle" className="text-[11px] fill-muted-foreground font-mono">data</text>
        <text x="160" y="80" textAnchor="middle" className="text-[11px] fill-foreground font-medium font-mono">value</text>
      </svg>
      <p className="text-sm text-muted-foreground italic mt-2">Node</p>
    </div>
  );
};

export default NodeDiagram;
