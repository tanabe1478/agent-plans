import type {
  DependencyEdge,
  DependencyGraph,
  DependencyNode,
  PlanDependencies,
} from '@ccplans/shared';
import { planService } from './planService.js';

/**
 * Build the full dependency graph from all plans
 */
export async function buildDependencyGraph(): Promise<DependencyGraph> {
  const plans = await planService.listPlans();

  // Build node map with blockedBy from frontmatter
  const nodeMap = new Map<string, DependencyNode>();
  for (const plan of plans) {
    const blockedBy = plan.frontmatter?.blockedBy ?? [];
    nodeMap.set(plan.filename, {
      filename: plan.filename,
      title: plan.title,
      status: plan.frontmatter?.status ?? 'todo',
      blockedBy,
      blocks: [],
    });
  }

  // Compute reverse edges (blocks)
  for (const node of nodeMap.values()) {
    for (const blocker of node.blockedBy) {
      const blockerNode = nodeMap.get(blocker);
      if (blockerNode) {
        blockerNode.blocks.push(node.filename);
      }
    }
  }

  // Build edges
  const edges: DependencyEdge[] = [];
  for (const node of nodeMap.values()) {
    for (const blocker of node.blockedBy) {
      if (nodeMap.has(blocker)) {
        edges.push({ from: blocker, to: node.filename });
      }
    }
  }

  const nodes = Array.from(nodeMap.values());
  const cycles = detectCycles(nodes);
  const criticalPath = cycles.length > 0 ? [] : findCriticalPath(nodes);

  return {
    nodes,
    edges,
    hasCycle: cycles.length > 0,
    criticalPath,
  };
}

/**
 * Get dependencies for a specific plan
 */
export async function getPlanDependencies(filename: string): Promise<PlanDependencies> {
  const graph = await buildDependencyGraph();
  const nodeMap = new Map(graph.nodes.map((n) => [n.filename, n]));
  const target = nodeMap.get(filename);

  if (!target) {
    throw new Error(`Plan not found: ${filename}`);
  }

  const blockedBy = target.blockedBy
    .map((f) => nodeMap.get(f))
    .filter((n): n is DependencyNode => n !== undefined);

  const blocks = target.blocks
    .map((f) => nodeMap.get(f))
    .filter((n): n is DependencyNode => n !== undefined);

  // Build full dependency chain (upstream)
  const chain = buildChain(filename, nodeMap);

  return { blockedBy, blocks, chain };
}

/**
 * Detect cycles using DFS
 * Returns arrays of filenames forming cycles
 */
export function detectCycles(nodes: DependencyNode[]): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.filename, node.blockedBy);
  }

  const visited = new Set<string>();
  const recStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(current: string, path: string[]): void {
    visited.add(current);
    recStack.add(current);
    path.push(current);

    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      if (!adjacency.has(neighbor)) continue;

      if (!visited.has(neighbor)) {
        dfs(neighbor, path);
      } else if (recStack.has(neighbor)) {
        // Found a cycle
        const cycleStart = path.indexOf(neighbor);
        if (cycleStart >= 0) {
          cycles.push(path.slice(cycleStart));
        }
      }
    }

    path.pop();
    recStack.delete(current);
  }

  for (const node of nodes) {
    if (!visited.has(node.filename)) {
      dfs(node.filename, []);
    }
  }

  return cycles;
}

/**
 * Find the critical path (longest dependency chain) using topological sort
 */
export function findCriticalPath(nodes: DependencyNode[]): string[] {
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map((n) => [n.filename, n]));

  // Compute in-degree (number of blockers)
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    inDegree.set(node.filename, 0);
  }
  for (const node of nodes) {
    for (const blocker of node.blockedBy) {
      if (nodeMap.has(blocker)) {
        inDegree.set(node.filename, (inDegree.get(node.filename) ?? 0) + 1);
      }
    }
  }

  // Topological sort with longest path tracking
  const queue: string[] = [];
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();

  for (const [filename, deg] of inDegree) {
    if (deg === 0) {
      queue.push(filename);
      dist.set(filename, 1);
      prev.set(filename, null);
    } else {
      dist.set(filename, 0);
      prev.set(filename, null);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) continue;
    const currentDist = dist.get(current) ?? 0;
    const node = nodeMap.get(current);
    if (!node) continue;

    // Process nodes that this one blocks
    for (const blocked of node.blocks) {
      if (!nodeMap.has(blocked)) continue;

      if (currentDist + 1 > (dist.get(blocked) ?? 0)) {
        dist.set(blocked, currentDist + 1);
        prev.set(blocked, current);
      }

      const newDeg = (inDegree.get(blocked) ?? 1) - 1;
      inDegree.set(blocked, newDeg);
      if (newDeg === 0) {
        queue.push(blocked);
      }
    }
  }

  // Find the endpoint with the longest distance
  let maxDist = 0;
  let endNode: string | null = null;
  for (const [filename, d] of dist) {
    if (d > maxDist) {
      maxDist = d;
      endNode = filename;
    }
  }

  if (!endNode || maxDist <= 1) return [];

  // Reconstruct path
  const path: string[] = [];
  let current: string | null = endNode;
  while (current !== null) {
    path.unshift(current);
    current = prev.get(current) ?? null;
  }

  return path;
}

/**
 * Build full upstream dependency chain for a plan
 */
function buildChain(filename: string, nodeMap: Map<string, DependencyNode>): string[] {
  const chain: string[] = [];
  const visited = new Set<string>();

  function walk(current: string): void {
    if (visited.has(current)) return;
    visited.add(current);
    const node = nodeMap.get(current);
    if (!node) return;
    for (const blocker of node.blockedBy) {
      walk(blocker);
    }
    chain.push(current);
  }

  walk(filename);
  return chain;
}
