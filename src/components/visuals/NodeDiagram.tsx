import React from 'react';

export const NodeDiagram: React.FC = () => {
  // Main circle center and radius
  const cx = 160;
  const cy = 90;
  const r = 35;

  return (
    <div className="flex flex-col items-center">
      <svg width="340" height="200" viewBox="0 0 340 200" className="max-w-full">
        {/* Previous node arrow - connects to left edge of circle */}
        <g className="text-operator-prev">
          <line x1={cx - r} y1={cy} x2="50" y2={cy} stroke="currentColor" strokeWidth="1.5" />
          <polygon points="50,90 60,85 60,95" fill="currentColor" />
          <text x="20" y="70" className="text-[10px] fill-muted-foreground font-mono">previous</text>
          <text x="30" y="82" className="text-[10px] fill-muted-foreground font-mono">node</text>
        </g>

        {/* Next node arrow - connects from right edge of circle */}
        <g className="text-operator-next">
          <line x1={cx + r} y1={cy} x2="290" y2={cy} stroke="currentColor" strokeWidth="1.5" />
          <polygon points="290,90 280,85 280,95" fill="currentColor" />
          <text x="295" y="85" className="text-[10px] fill-muted-foreground font-mono">next</text>
          <text x="295" y="97" className="text-[10px] fill-muted-foreground font-mono">node</text>
        </g>

        {/* Child node arrow - connects from bottom edge of circle */}
        <g className="text-operator-subnode">
          <line x1={cx} y1={cy + r} x2={cx} y2="175" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
          <polygon points="160,175 155,165 165,165" fill="currentColor" />
          <text x="115" y="190" className="text-[10px] fill-muted-foreground font-mono">child node</text>
        </g>

        {/* ID indicator - small circle touching the main circle at bottom-right */}
        <g className="text-operator-id">
          {/* Position at ~45 degree angle from center */}
          <circle cx={cx + r * 0.7} cy={cy + r * 0.7} r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1={cx + r * 0.7 + 5} y1={cy + r * 0.7} x2="250" y2={cy + r * 0.7} stroke="currentColor" strokeWidth="1" />
          <text x="255" y={cy + r * 0.7 + 4} className="text-[10px] fill-muted-foreground font-mono">id</text>
        </g>

        {/* Main node circle */}
        <circle 
          cx={cx} 
          cy={cy} 
          r={r} 
          fill="none" 
          stroke="hsl(var(--primary))" 
          strokeWidth="2"
          className="drop-shadow-sm"
        />
        
        {/* Data value text - centered in circle */}
        <text x={cx} y={cy - 5} textAnchor="middle" className="text-[11px] fill-muted-foreground font-mono">data</text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="text-[11px] fill-foreground font-medium font-mono">value</text>
      </svg>
      <p className="text-sm text-muted-foreground italic mt-2">Node</p>
    </div>
  );
};

export default NodeDiagram;
