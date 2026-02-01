/**
 * Visual representation of an expression DAG using SVG
 * Adapted from UL_DAG/components/DAGGraphVisual.tsx
 */

import { useId, useMemo } from 'react';
import type { DAGStructure, ExprNodeData } from '@/lib/dag';

const NODE_WIDTH = 90;
const NODE_HEIGHT = 40;
const HORIZONTAL_GAP = 50;
const VERTICAL_GAP = 60;

interface NodePosition {
  x: number;
  y: number;
}

function computeLayout(structure: DAGStructure<ExprNodeData>): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  const nodeIds = new Set(structure.nodes.map((n) => n.id));
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();

  for (const n of structure.nodes) {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  }
  for (const e of structure.edges) {
    if (nodeIds.has(e.from) && nodeIds.has(e.to)) {
      outgoing.get(e.from)!.push(e.to);
      incoming.get(e.to)!.push(e.from);
    }
  }

  const layers = new Map<string, number>();
  const roots = structure.nodes.filter((n) => (incoming.get(n.id)?.length ?? 0) === 0).map((n) => n.id);
  const computing = new Set<string>();

  function getLayer(id: string): number {
    if (layers.has(id)) return layers.get(id)!;
    if (computing.has(id)) {
      layers.set(id, 0);
      return 0;
    }
    computing.add(id);
    const parents = incoming.get(id) ?? [];
    if (parents.length === 0) {
      layers.set(id, 0);
      computing.delete(id);
      return 0;
    }
    const parentLayers = parents.map((p) => getLayer(p));
    const layer = Math.max(...parentLayers) + 1;
    layers.set(id, layer);
    computing.delete(id);
    return layer;
  }

  for (const n of structure.nodes) {
    getLayer(n.id);
  }

  const byLayer = new Map<number, string[]>();
  for (const [id, layer] of layers) {
    const list = byLayer.get(layer) ?? [];
    list.push(id);
    byLayer.set(layer, list);
  }
  for (const list of byLayer.values()) {
    list.sort();
  }

  const maxLayer = Math.max(...layers.values(), 0);
  const layerCounts = [...Array(maxLayer + 1)].map((_, i) => (byLayer.get(i) ?? []).length);
  const maxNodesInLayer = Math.max(...layerCounts, 1);

  const totalWidth = Math.max(maxNodesInLayer * (NODE_WIDTH + HORIZONTAL_GAP) - HORIZONTAL_GAP, NODE_WIDTH);
  const totalHeight = (maxLayer + 1) * (NODE_HEIGHT + VERTICAL_GAP) - VERTICAL_GAP;

  for (let layer = 0; layer <= maxLayer; layer++) {
    const ids = byLayer.get(layer) ?? [];
    const layerWidth = ids.length * (NODE_WIDTH + HORIZONTAL_GAP) - HORIZONTAL_GAP;
    const startX = (totalWidth - layerWidth) / 2 + NODE_WIDTH / 2 + HORIZONTAL_GAP / 2;
    ids.forEach((id, i) => {
      const x = startX + i * (NODE_WIDTH + HORIZONTAL_GAP);
      const y = layer * (NODE_HEIGHT + VERTICAL_GAP) + NODE_HEIGHT / 2;
      positions.set(id, { x, y });
    });
  }

  return positions;
}

function getNodeLabel(node: { id: string; data?: ExprNodeData }): string {
  const d = node.data;
  if (!d) return node.id;
  const op = d.op.replace(/^\\/, '');
  const ops = d.operands?.length ? `(${d.operands.join(',')})` : '';
  const s = `${op}${ops}`;
  return s.length > 14 ? s.slice(0, 12) + '…' : s;
}

export function DAGGraphVisual({ structure }: { structure: DAGStructure<ExprNodeData> }) {
  const markerId = useId().replace(/:/g, '-');
  const { positions, edges } = useMemo(() => {
    const positions = computeLayout(structure);
    const nodeIds = new Set(structure.nodes.map((n) => n.id));
    const edges = structure.edges.filter(
      (e) => nodeIds.has(e.from) && nodeIds.has(e.to) && positions.has(e.from) && positions.has(e.to)
    );
    return { positions, edges };
  }, [structure]);

  const allPos = [...positions.values()];
  const fallback = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
  const minX = allPos.length ? Math.min(...allPos.map((p) => p.x)) - NODE_WIDTH : fallback.minX;
  const maxX = allPos.length ? Math.max(...allPos.map((p) => p.x)) + NODE_WIDTH : fallback.maxX;
  const minY = allPos.length ? Math.min(...allPos.map((p) => p.y)) - NODE_HEIGHT : fallback.minY;
  const maxY = allPos.length ? Math.max(...allPos.map((p) => p.y)) + NODE_HEIGHT : fallback.maxY;
  const width = Math.max(maxX - minX + 40, 400);
  const height = Math.max(maxY - minY + 40, 200);

  const toSvg = (p: NodePosition) => ({ x: p.x - minX + 20, y: p.y - minY + 20 });

  return (
    <div className="overflow-auto rounded-lg border border-border bg-muted/30">
      <svg width={width} height={height} className="block">
        <defs>
          <marker
            id={`arrowhead-${markerId}`}
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--muted-foreground))" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const from = positions.get(e.from)!;
          const to = positions.get(e.to)!;
          const a = toSvg(from);
          const b = toSvg(to);
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = dx / len;
          const ny = dy / len;
          const offset = NODE_HEIGHT / 2 + 4;
          const start = { x: a.x + nx * (NODE_WIDTH / 2 + 4), y: a.y + ny * offset };
          const end = { x: b.x - nx * (NODE_WIDTH / 2 + 4), y: b.y - ny * offset };
          const midX = (start.x + end.x) / 2;
          const midY = (start.y + end.y) / 2;
          const ctrlOffset = Math.min(len * 0.2, 30);
          const ctrl = { x: midX - ny * ctrlOffset, y: midY + nx * ctrlOffset };
          const pathD = `M ${start.x} ${start.y} Q ${ctrl.x} ${ctrl.y} ${end.x} ${end.y}`;

          return (
            <path
              key={`${e.from}-${e.to}-${i}`}
              d={pathD}
              fill="none"
              stroke="hsl(var(--muted-foreground) / 0.7)"
              strokeWidth={2}
              markerEnd={`url(#arrowhead-${markerId})`}
            />
          );
        })}

        {structure.nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          const { x, y } = toSvg(pos);
          const label = getNodeLabel(node);
          return (
            <g key={node.id}>
              <rect
                x={x - NODE_WIDTH / 2}
                y={y - NODE_HEIGHT / 2}
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={8}
                ry={8}
                fill="hsl(var(--background))"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
              />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={12}
                fontWeight={500}
                fill="hsl(var(--foreground))"
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
