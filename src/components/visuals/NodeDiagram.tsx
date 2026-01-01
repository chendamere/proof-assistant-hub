import React from 'react';

export const NodeDiagram: React.FC = () => {
  // Main circle center and radius
  const cx = 170;
  const cy = 90;
  const r = 35;
  const arrowLength = 70;

  // Calculate bottom-right point on circle (45 degrees)
  const angle = Math.PI / 4; // 45 degrees
  const idCircleX = cx + r * Math.cos(angle);
  const idCircleY = cy + r * Math.sin(angle);

  return (
    <div className="flex flex-col items-center">
      <svg width="360" height="210" viewBox="0 0 360 210" className="max-w-full">
        {/* Previous node arrow - connects to left edge of circle */}
        <g className="text-operator-next">
          <line x1={cx - r} y1={cy} x2={cx - r - arrowLength} y2={cy} stroke="currentColor" strokeWidth="1.5" />
          <polygon points={`${cx - r - arrowLength},${cy} ${cx - r - arrowLength + 8},${cy - 5} ${cx - r - arrowLength + 8},${cy + 5}`} fill="currentColor" />
          <text x={cx - r - arrowLength - 10} y={cy - 12} textAnchor="end" className="text-[10px] fill-muted-foreground font-mono">previous</text>
          <text x={cx - r - arrowLength - 10} y={cy} textAnchor="end" className="text-[10px] fill-muted-foreground font-mono">node</text>
        </g>

        {/* Next node arrow - connects from right edge of circle */}
        <g className="text-operator-next">
          <line x1={cx + r} y1={cy} x2={cx + r + arrowLength} y2={cy} stroke="currentColor" strokeWidth="1.5" />
          <polygon points={`${cx + r + arrowLength},${cy} ${cx + r + arrowLength - 8},${cy - 5} ${cx + r + arrowLength - 8},${cy + 5}`} fill="currentColor" />
          <text x={cx + r + arrowLength + 10} y={cy - 5} className="text-[10px] fill-muted-foreground font-mono">next</text>
          <text x={cx + r + arrowLength + 10} y={cy + 7} className="text-[10px] fill-muted-foreground font-mono">node</text>
        </g>

        {/* Child node arrow - connects from bottom edge of circle */}
        <g className="text-operator-next">
          <line x1={cx} y1={cy + r} x2={cx} y2={cy + r + arrowLength} stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2" />
          <polygon points={`${cx},${cy + r + arrowLength} ${cx - 5},${cy + r + arrowLength - 8} ${cx + 5},${cy + r + arrowLength - 8}`} fill="currentColor" />
          <text x={cx} y={cy + r + arrowLength + 15} textAnchor="middle" className="text-[10px] fill-muted-foreground font-mono">child node</text>
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

        {/* ID indicator - small circle at bottom right, with line connecting to main circle */}
        <g className="text-operator-id">
          {/* Line from main circle edge to id circle */}
          <line 
            x1={idCircleX} 
            y1={idCircleY} 
            x2={idCircleX + 25} 
            y2={idCircleY + 25} 
            stroke="currentColor" 
            strokeWidth="1.5" 
          />
          {/* Small ID circle */}
          <circle cx={idCircleX + 30} cy={idCircleY + 30} r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <text x={idCircleX + 45} y={idCircleY + 34} className="text-[10px] fill-muted-foreground font-mono">id</text>
        </g>
        
        {/* Data value text - centered in circle */}
        <text x={cx} y={cy - 5} textAnchor="middle" className="text-[11px] fill-muted-foreground font-mono">data</text>
        <text x={cx} y={cy + 10} textAnchor="middle" className="text-[11px] fill-foreground font-medium font-mono">value</text>
      </svg>
      <p className="text-sm text-muted-foreground italic mt-2">Node</p>
    </div>
  );
};

export default NodeDiagram;
