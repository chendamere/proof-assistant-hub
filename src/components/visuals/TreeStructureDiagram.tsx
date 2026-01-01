import React from 'react';

export const TreeStructureDiagram: React.FC = () => {
  const nodeRadius = 18;
  const nodeSpacing = 55;
  const arrowColor = "hsl(var(--operator-next))";
  const primaryColor = "hsl(var(--primary))";
  const mutedColor = "hsl(var(--muted-foreground))";

  // Node component helper
  const Node = ({ x, y, isNull = false }: { x: number; y: number; isNull?: boolean }) => (
    <circle
      cx={x}
      cy={y}
      r={nodeRadius}
      fill="none"
      stroke={isNull ? mutedColor : primaryColor}
      strokeWidth={isNull ? 1.5 : 2}
      strokeDasharray={isNull ? "4 3" : "none"}
    />
  );

  // Null symbol inside node
  const NullSymbol = ({ x, y }: { x: number; y: number }) => (
    <text x={x} y={y + 4} textAnchor="middle" className="text-[12px] fill-muted-foreground font-mono">ø</text>
  );

  // Bidirectional arrow between two nodes (vertical)
  const VerticalArrows = ({ x, y1, y2 }: { x: number; y1: number; y2: number }) => {
    const startY = y1 + nodeRadius;
    const endY = y2 - nodeRadius;
    const midY = (startY + endY) / 2;
    
    return (
      <g stroke={arrowColor} strokeWidth="1.5" fill={arrowColor}>
        {/* Down arrow */}
        <line x1={x - 4} y1={startY} x2={x - 4} y2={endY} />
        <polygon points={`${x - 4},${endY} ${x - 7},${endY - 6} ${x - 1},${endY - 6}`} />
        
        {/* Up arrow */}
        <line x1={x + 4} y1={endY} x2={x + 4} y2={startY} />
        <polygon points={`${x + 4},${startY} ${x + 1},${startY + 6} ${x + 7},${startY + 6}`} />
      </g>
    );
  };

  // Child arrow (dashed, horizontal)
  const ChildArrow = ({ x1, y, x2 }: { x1: number; y: number; x2: number }) => (
    <g stroke={arrowColor} strokeWidth="1.5" fill={arrowColor}>
      <line x1={x1 + nodeRadius} y1={y} x2={x2 - nodeRadius} y2={y} strokeDasharray="4 3" />
      <polygon points={`${x2 - nodeRadius},${y} ${x2 - nodeRadius - 6},${y - 4} ${x2 - nodeRadius - 6},${y + 4}`} />
    </g>
  );

  // Left chain positions
  const leftX = 60;
  const chain1 = [40, 40 + nodeSpacing, 40 + nodeSpacing * 2]; // y positions for 3 nodes

  // Right chain positions (child of bottom-left node)
  const rightX = 180;
  const chain2 = [chain1[1], chain1[1] + nodeSpacing]; // 2 nodes

  // Far right single node (child of right chain)
  const farRightX = 280;

  return (
    <div className="flex flex-col items-center">
      <svg width="340" height="220" viewBox="0 0 340 220" className="max-w-full">
        {/* LEFT CHAIN - 3 nodes with top one being null */}
        <Node x={leftX} y={chain1[0]} isNull />
        <NullSymbol x={leftX} y={chain1[0]} />
        
        <Node x={leftX} y={chain1[1]} />
        <Node x={leftX} y={chain1[2]} />

        {/* Arrows between left chain nodes */}
        <VerticalArrows x={leftX} y1={chain1[0]} y2={chain1[1]} />
        <VerticalArrows x={leftX} y1={chain1[1]} y2={chain1[2]} />
        
        {/* Closing arrows from bottom to top (curved) - bidirectional */}
        {/* Up arrow (outer curve) */}
        <path
          d={`M ${leftX - nodeRadius} ${chain1[2]} 
              C ${leftX - 50} ${chain1[2]} ${leftX - 50} ${chain1[0]} ${leftX - nodeRadius} ${chain1[0]}`}
          fill="none"
          stroke={arrowColor}
          strokeWidth="1.5"
        />
        <polygon 
          points={`${leftX - nodeRadius},${chain1[0]} ${leftX - nodeRadius - 6},${chain1[0] + 4} ${leftX - nodeRadius - 6},${chain1[0] - 4}`} 
          fill={arrowColor}
        />
        
        {/* Down arrow (inner curve) */}
        <path
          d={`M ${leftX - nodeRadius} ${chain1[0]} 
              C ${leftX - 38} ${chain1[0]} ${leftX - 38} ${chain1[2]} ${leftX - nodeRadius} ${chain1[2]}`}
          fill="none"
          stroke={arrowColor}
          strokeWidth="1.5"
        />
        <polygon 
          points={`${leftX - nodeRadius},${chain1[2]} ${leftX - nodeRadius - 6},${chain1[2] - 4} ${leftX - nodeRadius - 6},${chain1[2] + 4}`} 
          fill={arrowColor}
        />

        {/* Child arrow from middle-left to right chain */}
        <ChildArrow x1={leftX} y={chain1[1]} x2={rightX} />

        {/* RIGHT CHAIN - 2 nodes with bottom one being null */}
        <Node x={rightX} y={chain2[0]} />
        <Node x={rightX} y={chain2[1]} isNull />
        <NullSymbol x={rightX} y={chain2[1]} />

        {/* Arrows between right chain nodes */}
        <VerticalArrows x={rightX} y1={chain2[0]} y2={chain2[1]} />

        {/* Closing curve for right chain - bidirectional */}
        {/* Up arrow (outer curve) */}
        <path
          d={`M ${rightX - nodeRadius} ${chain2[1]} 
              C ${rightX - 40} ${chain2[1]} ${rightX - 40} ${chain2[0]} ${rightX - nodeRadius} ${chain2[0]}`}
          fill="none"
          stroke={arrowColor}
          strokeWidth="1.5"
        />
        <polygon 
          points={`${rightX - nodeRadius},${chain2[0]} ${rightX - nodeRadius - 6},${chain2[0] + 4} ${rightX - nodeRadius - 6},${chain2[0] - 4}`} 
          fill={arrowColor}
        />
        
        {/* Down arrow (inner curve) */}
        <path
          d={`M ${rightX - nodeRadius} ${chain2[0]} 
              C ${rightX - 28} ${chain2[0]} ${rightX - 28} ${chain2[1]} ${rightX - nodeRadius} ${chain2[1]}`}
          fill="none"
          stroke={arrowColor}
          strokeWidth="1.5"
        />
        <polygon 
          points={`${rightX - nodeRadius},${chain2[1]} ${rightX - nodeRadius - 6},${chain2[1] - 4} ${rightX - nodeRadius - 6},${chain2[1] + 4}`} 
          fill={arrowColor}
        />

        {/* Child arrow from right chain top node to far right */}
        <ChildArrow x1={rightX} y={chain2[0]} x2={farRightX} />

        {/* FAR RIGHT - single null node with self-loop */}
        <Node x={farRightX} y={chain2[0]} isNull />
        <NullSymbol x={farRightX} y={chain2[0]} />

        {/* Self-referencing loop */}
        <path
          d={`M ${farRightX + nodeRadius * 0.7} ${chain2[0] - nodeRadius * 0.7}
              C ${farRightX + 40} ${chain2[0] - 35} ${farRightX + 40} ${chain2[0] + 35} ${farRightX + nodeRadius * 0.7} ${chain2[0] + nodeRadius * 0.7}`}
          fill="none"
          stroke={arrowColor}
          strokeWidth="1.5"
        />
        <polygon 
          points={`${farRightX + nodeRadius * 0.7},${chain2[0] + nodeRadius * 0.7} ${farRightX + nodeRadius * 0.7 + 2},${chain2[0] + nodeRadius * 0.7 - 8} ${farRightX + nodeRadius * 0.7 + 8},${chain2[0] + nodeRadius * 0.7 - 2}`} 
          fill={arrowColor}
        />
      </svg>
      <p className="text-sm text-muted-foreground italic mt-2">Data structure</p>
    </div>
  );
};

export default TreeStructureDiagram;
