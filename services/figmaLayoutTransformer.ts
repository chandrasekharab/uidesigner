/**
 * figmaLayoutTransformer.ts
 * ──────────────────────────
 * Converts a parsed Figma tree (FigmaNode[]) into platform-native
 * TargetLayoutRegion[] — the same structure used by the existing
 * Template Mapping Studio's target builder.
 *
 * Mapping strategy:
 *   FRAME with auto-layout = VERTICAL  → TargetLayoutRegion { layout: 'flex' }
 *   FRAME with auto-layout = HORIZONTAL → TargetLayoutRegion { layout: 'inline' }
 *   FRAME with grid-like children       → TargetLayoutRegion { layout: 'grid' }
 *   GROUP with tab-like children        → TargetLayoutRegion { layout: 'tabs' }
 *   FRAME with accordion-like children  → TargetLayoutRegion { layout: 'sections' }
 *   Text / Shape                        → skipped (non-structural)
 *
 * This transformer is intentionally simple. Users can override any inferred
 * layout type via the Target Builder UI.
 */

import type { FigmaNode } from './figmaParser';
import type { TargetLayoutRegion, TargetLayoutType } from '@/models/RegionMapping';
import { v4 as uuidv4 } from 'uuid';

// ─── Figma → TargetLayout node ────────────────────────────────────────────────

/** A Figma-derived TargetLayoutRegion — extends the base type with figma metadata */
export interface FigmaTargetRegion extends TargetLayoutRegion {
  /** Originating Figma node id so mappings can reference Figma nodes */
  figmaNodeId: string;
  /** Path string from figma (e.g. "Page 1 / Header") */
  figmaPath: string;
  /** Depth from the top-level frame */
  figmaDepth: number;
  /** Whether this region has figma-defined children that can be recursively mapped */
  hasFigmaChildren: boolean;
}

export interface FigmaTransformResult {
  regions: FigmaTargetRegion[];
  /** Flat list including nested child regions (for deep mapping) */
  allRegions: FigmaTargetRegion[];
  /** How many Figma nodes were skipped (shapes, text nodes) */
  skippedCount: number;
}

// ─── Color palette for auto-assigned region colors ───────────────────────────

const REGION_PALETTE = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
  '#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7',
];

// ─── Layout inference logic ───────────────────────────────────────────────────

/**
 * Infer whether a frame/group has "grid-like" children:
 * many children of similar width stacked in rows.
 */
function looksLikeGrid(node: FigmaNode): boolean {
  if (node.children.length < 4) return false;
  const frameChildren = node.children.filter(
    (c) => c.type === 'frame' || c.type === 'group'
  );
  if (frameChildren.length < 4) return false;
  // Check if widths are roughly equal (within 20%)
  const widths = frameChildren
    .map((c) => c.layout.bounds?.width ?? 0)
    .filter((w) => w > 0);
  if (widths.length < 4) return false;
  const avg = widths.reduce((a, b) => a + b, 0) / widths.length;
  const allClose = widths.every((w) => Math.abs(w - avg) / avg < 0.25);
  return allClose;
}

/**
 * Infer whether a frame looks like a tab container:
 * horizontal layout with a short list of child frames (~2-6 children)
 * where children are named "Tab …" or "Page …" or just sequentially.
 */
function looksLikeTabs(node: FigmaNode): boolean {
  const childCount = node.children.filter(
    (c) => c.type === 'frame' || c.type === 'group'
  ).length;
  if (childCount < 2 || childCount > 8) return false;
  const tabNames = /tab|page|panel|section/i;
  const hasTabName = node.children
    .filter((c) => c.type === 'frame' || c.type === 'group')
    .some((c) => tabNames.test(c.name));
  return hasTabName || (node.layout.mode === 'horizontal' && childCount <= 6);
}

/**
 * Infer whether a frame looks like an accordion/sections layout:
 * vertical stack where each child is labelled with expand/collapse icons
 * or names like "Section …", "Accordion …".
 */
function looksLikeSections(node: FigmaNode): boolean {
  const sectionNames = /section|accordion|collapse|expand|panel/i;
  const children = node.children.filter((c) => c.type === 'frame' || c.type === 'group');
  if (children.length < 2) return false;
  return children.filter((c) => sectionNames.test(c.name)).length >= 1;
}

/** Main layout inferencer */
function inferLayoutType(node: FigmaNode): TargetLayoutType {
  const mode = node.layout.mode;

  if (looksLikeTabs(node))    return 'tabs';
  if (looksLikeSections(node)) return 'sections';
  if (looksLikeGrid(node))    return 'grid';

  if (mode === 'horizontal')  return 'inline';
  if (mode === 'vertical')    return 'flex';

  // Fallback: grid if many structural children
  const structuralChildren = node.children.filter(
    (c) => c.type === 'frame' || c.type === 'group' || c.type === 'component' || c.type === 'instance'
  );
  if (structuralChildren.length >= 3) return 'grid';

  return 'flex';
}

/** Infer column count from grid-like frame */
function inferColumns(node: FigmaNode, layoutType: TargetLayoutType): number {
  if (layoutType === 'grid') {
    const frameChildren = node.children.filter(
      (c) => c.type === 'frame' || c.type === 'group'
    );
    if (frameChildren.length === 2) return 2;
    if (frameChildren.length === 3) return 3;
    if (frameChildren.length >= 4)  return 4;
  }
  if (layoutType === 'inline') return node.children.length;
  return 1;
}

// ─── Transform recursion ──────────────────────────────────────────────────────

interface ConvertContext {
  colorIndex: number;
  allRegions: FigmaTargetRegion[];
  skippedCount: number;
}

function convertNode(
  node: FigmaNode,
  order: number,
  ctx: ConvertContext
): FigmaTargetRegion | null {
  // Skip non-structural nodes
  if (node.type === 'text' || node.type === 'shape' || node.type === 'unknown') {
    ctx.skippedCount++;
    return null;
  }

  // Skip invisible nodes
  if (!node.visible || node.opacity < 0.1) {
    ctx.skippedCount++;
    return null;
  }

  const layoutType = inferLayoutType(node);
  const columns = inferColumns(node, layoutType);
  const color = REGION_PALETTE[ctx.colorIndex % REGION_PALETTE.length];
  ctx.colorIndex++;

  const region: FigmaTargetRegion = {
    // TargetLayoutRegion fields
    id: uuidv4(),
    name: node.name,
    layout: layoutType,
    columns,
    color,
    order,
    description: `Figma: ${node.rawType} · ${node.path}`,
    nestable: node.children.some((c) => c.type === 'frame' || c.type === 'group'),
    orientation: node.layout.mode === 'horizontal' ? 'horizontal' : 'vertical',
    // Figma-specific extension fields
    figmaNodeId: node.id,
    figmaPath: node.path,
    figmaDepth: node.depth,
    hasFigmaChildren: node.children.some(
      (c) => c.type === 'frame' || c.type === 'group' || c.type === 'component' || c.type === 'instance'
    ),
  };

  ctx.allRegions.push(region);
  return region;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Transform a parsed Figma tree into TargetLayoutRegion[].
 *
 * @param nodes          Top-level Figma nodes (from FigmaParseResult.nodes)
 * @param maxDepth       Maximum nesting depth to convert (default: 2 — frames + their children)
 * @param flatten        If true, include nested frames as additional top-level regions
 */
export function transformFigmaToTargetLayout(
  nodes: FigmaNode[],
  maxDepth = 2,
  flatten = false
): FigmaTransformResult {
  const ctx: ConvertContext = {
    colorIndex: 0,
    allRegions: [],
    skippedCount: 0,
  };

  const topLevel: FigmaTargetRegion[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const region = convertNode(nodes[i], i, ctx);
    if (region) topLevel.push(region);
  }

  // If flatten=true, also convert second-level frames (children of top-level)
  if (flatten && maxDepth >= 2) {
    for (const node of nodes) {
      for (let j = 0; j < node.children.length; j++) {
        const child = node.children[j];
        if (child.type === 'frame' || child.type === 'group') {
          const childRegion = convertNode(child, topLevel.length + j, ctx);
          if (childRegion && !ctx.allRegions.find((r) => r.figmaNodeId === child.id)) {
            topLevel.push(childRegion);
          }
        }
      }
    }
  }

  return {
    regions: topLevel,
    allRegions: ctx.allRegions,
    skippedCount: ctx.skippedCount,
  };
}

/**
 * Transform a single FigmaNode and its direct children into regions.
 * Useful when the user drills into a specific Figma frame to map its internals.
 */
export function transformFigmaFrameChildren(frame: FigmaNode): FigmaTargetRegion[] {
  const ctx: ConvertContext = {
    colorIndex: 0,
    allRegions: [],
    skippedCount: 0,
  };

  const regions: FigmaTargetRegion[] = [];
  for (let i = 0; i < frame.children.length; i++) {
    const r = convertNode(frame.children[i], i, ctx);
    if (r) regions.push(r);
  }
  return regions;
}

/**
 * Given a FigmaNode id and a FigmaTransformResult, find the matching region.
 */
export function findRegionByFigmaId(
  figmaNodeId: string,
  result: FigmaTransformResult
): FigmaTargetRegion | undefined {
  return result.allRegions.find((r) => r.figmaNodeId === figmaNodeId);
}

/**
 * Convert TargetLayoutType → human-readable label + description.
 */
export function layoutTypeLabel(type: TargetLayoutType): { label: string; description: string } {
  const map: Record<TargetLayoutType, { label: string; description: string }> = {
    flex:     { label: 'Flex Stack',     description: 'Vertical flexible stack (auto-layout column)' },
    grid:     { label: 'Grid',           description: 'Multi-column CSS grid' },
    tabs:     { label: 'Tabs',           description: 'Tabbed navigation container' },
    sections: { label: 'Sections',       description: 'Collapsible accordion sections' },
    inline:   { label: 'Inline Row',     description: 'Horizontal auto-layout row' },
  };
  return map[type] ?? { label: type, description: '' };
}
