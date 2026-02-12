import type { DependencyGraph, DependencyNode, PlanStatus } from '@ccplans/shared';
import { AlertTriangle, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useFrontmatterEnabled, useSettingsLoading } from '@/contexts/SettingsContext';
import { useDependencyGraph } from '@/lib/hooks/useDependencies';

const NODE_WIDTH = 200;
const NODE_HEIGHT = 80;
const H_GAP = 60;
const V_GAP = 40;

const statusColors: Record<PlanStatus, { fill: string; stroke: string; text: string }> = {
  completed: {
    fill: '#dcfce7',
    stroke: '#16a34a',
    text: '#15803d',
  },
  in_progress: {
    fill: '#dbeafe',
    stroke: '#2563eb',
    text: '#1d4ed8',
  },
  review: {
    fill: '#f3e8ff',
    stroke: '#9333ea',
    text: '#7e22ce',
  },
  todo: {
    fill: '#f3f4f6',
    stroke: '#9ca3af',
    text: '#4b5563',
  },
};

interface LayoutPosition {
  x: number;
  y: number;
}

function layoutGraph(graph: DependencyGraph): Map<string, LayoutPosition> {
  const positions = new Map<string, LayoutPosition>();
  if (graph.nodes.length === 0) return positions;

  const nodeMap = new Map(graph.nodes.map((n) => [n.filename, n]));

  // Assign layers using BFS from root nodes (no dependencies)
  const layers = new Map<string, number>();
  const inDegree = new Map<string, number>();
  for (const node of graph.nodes) {
    const validBlockers = node.blockedBy.filter((b) => nodeMap.has(b));
    inDegree.set(node.filename, validBlockers.length);
  }

  // BFS to assign layers
  const queue: string[] = [];
  for (const [filename, deg] of inDegree) {
    if (deg === 0) {
      queue.push(filename);
      layers.set(filename, 0);
    }
  }

  // Handle cycles: if no root nodes found, start from first node
  if (queue.length === 0 && graph.nodes.length > 0) {
    queue.push(graph.nodes[0].filename);
    layers.set(graph.nodes[0].filename, 0);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current) ?? 0;
    const node = nodeMap.get(current);
    if (!node) continue;

    for (const blocked of node.blocks) {
      if (!nodeMap.has(blocked)) continue;
      const existingLayer = layers.get(blocked);
      if (existingLayer === undefined || existingLayer < currentLayer + 1) {
        layers.set(blocked, currentLayer + 1);
        queue.push(blocked);
      }
    }
  }

  // Assign remaining unvisited nodes
  for (const node of graph.nodes) {
    if (!layers.has(node.filename)) {
      layers.set(node.filename, 0);
    }
  }

  // Group by layer
  const layerGroups = new Map<number, string[]>();
  for (const [filename, layer] of layers) {
    const group = layerGroups.get(layer) ?? [];
    group.push(filename);
    layerGroups.set(layer, group);
  }

  // Position nodes
  for (const [layer, filenames] of layerGroups) {
    const x = layer * (NODE_WIDTH + H_GAP) + 40;
    for (let i = 0; i < filenames.length; i++) {
      const y = i * (NODE_HEIGHT + V_GAP) + 40;
      positions.set(filenames[i], { x, y });
    }
  }

  return positions;
}

function GraphNode({
  node,
  position,
  isOnCriticalPath,
  onClick,
}: {
  node: DependencyNode;
  position: LayoutPosition;
  isOnCriticalPath: boolean;
  onClick: () => void;
}) {
  const colors = statusColors[node.status] ?? statusColors.todo;

  return (
    <g
      transform={`translate(${position.x}, ${position.y})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <rect
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx={8}
        fill={colors.fill}
        stroke={isOnCriticalPath ? '#ef4444' : colors.stroke}
        strokeWidth={isOnCriticalPath ? 3 : 2}
      />
      <text
        x={NODE_WIDTH / 2}
        y={28}
        textAnchor="middle"
        fill={colors.text}
        fontSize={13}
        fontWeight="bold"
      >
        {node.title.length > 22 ? `${node.title.slice(0, 20)}...` : node.title}
      </text>
      <text x={NODE_WIDTH / 2} y={48} textAnchor="middle" fill="#6b7280" fontSize={10}>
        {node.filename.length > 28 ? `${node.filename.slice(0, 26)}...` : node.filename}
      </text>
      <text x={NODE_WIDTH / 2} y={66} textAnchor="middle" fill={colors.text} fontSize={11}>
        {node.status.replace('_', ' ')}
      </text>
    </g>
  );
}

function GraphEdge({
  fromPos,
  toPos,
  isOnCriticalPath,
}: {
  fromPos: LayoutPosition;
  toPos: LayoutPosition;
  isOnCriticalPath: boolean;
}) {
  const startX = fromPos.x + NODE_WIDTH;
  const startY = fromPos.y + NODE_HEIGHT / 2;
  const endX = toPos.x;
  const endY = toPos.y + NODE_HEIGHT / 2;
  const midX = (startX + endX) / 2;

  const path = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

  return (
    <path
      d={path}
      fill="none"
      stroke={isOnCriticalPath ? '#ef4444' : '#9ca3af'}
      strokeWidth={isOnCriticalPath ? 2.5 : 1.5}
      markerEnd={isOnCriticalPath ? 'url(#arrowhead-critical)' : 'url(#arrowhead)'}
    />
  );
}

export function DependencyPage() {
  const frontmatterEnabled = useFrontmatterEnabled();
  const settingsLoading = useSettingsLoading();
  if (settingsLoading) return null;
  if (!frontmatterEnabled) return <Navigate to="/" replace />;

  const { data: graph, isLoading, error } = useDependencyGraph();
  const navigate = useNavigate();
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const positions = useMemo(
    () => (graph ? layoutGraph(graph) : new Map<string, LayoutPosition>()),
    [graph]
  );

  const criticalPathSet = useMemo(() => new Set(graph?.criticalPath ?? []), [graph]);

  const svgSize = useMemo(() => {
    let maxX = 0;
    let maxY = 0;
    for (const pos of positions.values()) {
      maxX = Math.max(maxX, pos.x + NODE_WIDTH + 40);
      maxY = Math.max(maxY, pos.y + NODE_HEIGHT + 40);
    }
    return { width: Math.max(maxX, 400), height: Math.max(maxY, 300) };
  }, [positions]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.2, 3));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.2, 0.3));
  const handleReset = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsPanning(true);
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    }
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isPanning) return;
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      lastMousePos.current = { x: e.clientX, y: e.clientY };
      setTranslate((t) => ({ x: t.x + dx, y: t.y + dy }));
    },
    [isPanning]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-destructive">Failed to load dependency graph</div>
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No dependency relationships found. Add <code>blockedBy</code> to plan frontmatter to create
        dependencies.
      </div>
    );
  }

  // Filter to only show nodes that participate in dependencies
  const relevantNodes = graph.nodes.filter((n) => n.blockedBy.length > 0 || n.blocks.length > 0);

  if (relevantNodes.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No dependency relationships found. Add <code>blockedBy</code> to plan frontmatter to create
        dependencies.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dependency Graph</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg border bg-card hover:bg-accent"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg border bg-card hover:bg-accent"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleReset}
            className="p-2 rounded-lg border bg-card hover:bg-accent"
            title="Reset view"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {graph.hasCycle && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">
            Circular dependency detected! Some plans form a dependency cycle.
          </span>
        </div>
      )}

      {graph.criticalPath.length > 1 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
          <span className="text-sm">
            <strong>Critical path:</strong>{' '}
            {graph.criticalPath
              .map((f) => graph.nodes.find((n) => n.filename === f)?.title ?? f)
              .join(' -> ')}
          </span>
        </div>
      )}

      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-200 border border-green-600" />
          Completed
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-200 border border-blue-600" />
          In Progress
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-purple-200 border border-purple-600" />
          Review
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-200 border border-gray-400" />
          Todo
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded border-2 border-red-500" />
          Critical Path
        </span>
      </div>

      <div
        className="border rounded-lg bg-card overflow-hidden"
        style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${svgSize.width} ${svgSize.height}`}
          style={{
            cursor: isPanning ? 'grabbing' : 'grab',
          }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#9ca3af" />
            </marker>
            <marker
              id="arrowhead-critical"
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
            </marker>
          </defs>
          <g transform={`translate(${translate.x}, ${translate.y}) scale(${scale})`}>
            {/* Edges */}
            {graph.edges.map((edge) => {
              const fromPos = positions.get(edge.from);
              const toPos = positions.get(edge.to);
              if (!fromPos || !toPos) return null;
              const isOnCritical = criticalPathSet.has(edge.from) && criticalPathSet.has(edge.to);
              return (
                <GraphEdge
                  key={`${edge.from}-${edge.to}`}
                  fromPos={fromPos}
                  toPos={toPos}
                  isOnCriticalPath={isOnCritical}
                />
              );
            })}
            {/* Nodes */}
            {graph.nodes.map((node) => {
              const pos = positions.get(node.filename);
              if (!pos) return null;
              if (node.blockedBy.length === 0 && node.blocks.length === 0) {
                return null;
              }
              return (
                <GraphNode
                  key={node.filename}
                  node={node}
                  position={pos}
                  isOnCriticalPath={criticalPathSet.has(node.filename)}
                  onClick={() => navigate(`/plan/${encodeURIComponent(node.filename)}`)}
                />
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
