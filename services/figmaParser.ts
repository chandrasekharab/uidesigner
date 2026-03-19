/**
 * figmaParser.ts
 * ──────────────
 * Parses raw Figma file exports (JSON) into a platform-friendly tree
 * structure that can be used for region mapping.
 *
 * Supports:
 *  - Figma REST API file responses (document.children[*].children = frames)
 *  - Simplified Figma JSON exports
 *  - Partial node objects (paste/manual construction)
 *
 * Figma node type mapping:
 *   FRAME / COMPONENT_SET  → 'frame'
 *   GROUP                  → 'group'
 *   COMPONENT / INSTANCE   → 'component'
 *   TEXT                   → 'text'
 *   RECTANGLE, ELLIPSE, etc → 'shape'
 *   unknown                → 'unknown'
 */

// ─── Public Types ─────────────────────────────────────────────────────────────

export type FigmaNodeType =
  | 'frame'
  | 'group'
  | 'component'
  | 'instance'
  | 'text'
  | 'shape'
  | 'unknown';

export type FigmaLayoutMode = 'horizontal' | 'vertical' | 'none';

export interface FigmaBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FigmaLayout {
  mode: FigmaLayoutMode;
  /** Item gap / spacing between children */
  itemSpacing?: number;
  /** Inner padding (auto-layout only) */
  padding?: { top: number; right: number; bottom: number; left: number };
  /** Fixed or hug-content sizing */
  primaryAxisSizing?: 'fixed' | 'auto';
  counterAxisSizing?: 'fixed' | 'auto';
  /** Absolute bounding box dimensions (all nodes) */
  bounds?: FigmaBounds;
}

/** Platform-normalised Figma node */
export interface FigmaNode {
  /** Figma node id */
  id: string;
  /** Human-readable name (as shown in Figma layers panel) */
  name: string;
  /** Normalised type category */
  type: FigmaNodeType;
  /** Layout / sizing information */
  layout: FigmaLayout;
  /** Nested children */
  children: FigmaNode[];
  /** Whether the layer is visible */
  visible: boolean;
  /** 0-1 opacity */
  opacity: number;
  /** For COMPONENT / INSTANCE — originating componentId */
  componentId?: string;
  /** Original raw Figma type string (e.g. 'FRAME', 'COMPONENT_SET') */
  rawType: string;
  /** Depth from the root frame */
  depth: number;
  /** Path string for debugging — e.g. "Page 1 / Header / Avatar" */
  path: string;
}

/** Summary returned by parseFigmaExport() */
export interface FigmaParseResult {
  /** Top-level frame / group nodes (one per "artboard" on the selected page) */
  nodes: FigmaNode[];
  /** Flat lookup map: node id → FigmaNode (includes all descendents) */
  allNodes: Map<string, FigmaNode>;
  /** Aggregated statistics */
  meta: {
    pageCount: number;
    totalNodes: number;
    componentCount: number;
    instanceCount: number;
    frameCount: number;
    textCount: number;
    /** First page name used for extraction */
    primaryPage: string;
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const FIGMA_TYPE_MAP: Record<string, FigmaNodeType> = {
  FRAME:           'frame',
  COMPONENT:       'component',
  COMPONENT_SET:   'frame',
  INSTANCE:        'instance',
  GROUP:           'group',
  SECTION:         'frame',
  TEXT:            'text',
  RECTANGLE:       'shape',
  ELLIPSE:         'shape',
  VECTOR:          'shape',
  STAR:            'shape',
  POLYGON:         'shape',
  LINE:            'shape',
  BOOLEAN_OPERATION: 'shape',
  SLICE:           'shape',
};

function resolveType(rawType: string): FigmaNodeType {
  return FIGMA_TYPE_MAP[rawType] ?? 'unknown';
}

function resolveLayoutMode(raw: Record<string, unknown>): FigmaLayoutMode {
  const lm = String(raw.layoutMode ?? '').toUpperCase();
  if (lm === 'HORIZONTAL') return 'horizontal';
  if (lm === 'VERTICAL')   return 'vertical';
  return 'none';
}

function resolveLayout(raw: Record<string, unknown>): FigmaLayout {
  const bbox = raw.absoluteBoundingBox as Record<string, unknown> | undefined;
  const bounds: FigmaBounds | undefined = bbox
    ? {
        x: Number(bbox.x ?? 0),
        y: Number(bbox.y ?? 0),
        width: Number(bbox.width ?? 0),
        height: Number(bbox.height ?? 0),
      }
    : undefined;

  const layout: FigmaLayout = {
    mode: resolveLayoutMode(raw),
    bounds,
  };

  if (raw.itemSpacing !== undefined) layout.itemSpacing = Number(raw.itemSpacing);

  if (raw.paddingTop !== undefined || raw.paddingLeft !== undefined) {
    layout.padding = {
      top:    Number(raw.paddingTop    ?? 0),
      right:  Number(raw.paddingRight  ?? 0),
      bottom: Number(raw.paddingBottom ?? 0),
      left:   Number(raw.paddingLeft   ?? 0),
    };
  }

  if (raw.primaryAxisSizingMode === 'FIXED') layout.primaryAxisSizing = 'fixed';
  else if (raw.primaryAxisSizingMode === 'AUTO') layout.primaryAxisSizing = 'auto';

  if (raw.counterAxisSizingMode === 'FIXED') layout.counterAxisSizing = 'fixed';
  else if (raw.counterAxisSizingMode === 'AUTO') layout.counterAxisSizing = 'auto';

  return layout;
}

/** Accumulation counter passed by reference during traversal */
interface Stats {
  total: number;
  frames: number;
  components: number;
  instances: number;
  texts: number;
}

function parseNode(
  raw: Record<string, unknown>,
  depth: number,
  path: string,
  allNodes: Map<string, FigmaNode>,
  stats: Stats
): FigmaNode {
  stats.total++;
  const rawType = String(raw.type ?? 'UNKNOWN');
  const type = resolveType(rawType);

  if (type === 'frame')     stats.frames++;
  if (type === 'component') stats.components++;
  if (type === 'instance')  stats.instances++;
  if (type === 'text')      stats.texts++;

  const id   = String(raw.id   ?? `node-${stats.total}`);
  const name = String(raw.name ?? rawType);

  const children: FigmaNode[] = [];
  const rawChildren = raw.children as Record<string, unknown>[] | undefined;
  if (Array.isArray(rawChildren)) {
    for (const child of rawChildren) {
      children.push(parseNode(child, depth + 1, `${path} / ${name}`, allNodes, stats));
    }
  }

  const node: FigmaNode = {
    id,
    name,
    type,
    rawType,
    layout: resolveLayout(raw),
    children,
    visible: raw.visible !== false,
    opacity: typeof raw.opacity === 'number' ? raw.opacity : 1,
    componentId: raw.componentId as string | undefined,
    depth,
    path,
  };

  allNodes.set(id, node);
  return node;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a raw Figma export / API response JSON and return a structured result.
 *
 * Accepts several envelope shapes:
 *  1. Full Figma API file response:  { document: { type: 'DOCUMENT', children: [...pages] } }
 *  2. Single page object:            { type: 'CANVAS', children: [...frames] }
 *  3. Array of frames directly:      [{ type: 'FRAME', ... }, ...]
 *  4. Single frame/group:            { type: 'FRAME', children: [...] }
 */
export function parseFigmaExport(raw: unknown): FigmaParseResult {
  if (!raw || typeof raw !== 'object') {
    return emptyResult('empty input');
  }

  const obj = raw as Record<string, unknown>;
  const allNodes = new Map<string, FigmaNode>();
  const stats: Stats = { total: 0, frames: 0, components: 0, instances: 0, texts: 0 };

  let topLevelFrames: Record<string, unknown>[] = [];
  let primaryPage = 'Page 1';
  let pageCount = 1;

  // ── Shape 1: Full Figma API doc ─────────────────────────────────────────
  if (obj.document && typeof obj.document === 'object') {
    const doc = obj.document as Record<string, unknown>;
    const pages = (doc.children as Record<string, unknown>[] | undefined) ?? [];
    pageCount = pages.length;

    // Use first non-empty canvas page
    const firstPage = pages.find((p) => (p.children as unknown[])?.length > 0) ?? pages[0];
    if (firstPage) {
      primaryPage = String(firstPage.name ?? 'Page 1');
      topLevelFrames = (firstPage.children as Record<string, unknown>[] | undefined) ?? [];
    }
  }
  // ── Shape 2: Single canvas (page) ───────────────────────────────────────
  else if (String(obj.type ?? '').toUpperCase() === 'CANVAS') {
    primaryPage = String(obj.name ?? 'Page 1');
    topLevelFrames = (obj.children as Record<string, unknown>[] | undefined) ?? [];
  }
  // ── Shape 3: Array of frames ────────────────────────────────────────────
  else if (Array.isArray(raw)) {
    topLevelFrames = raw as Record<string, unknown>[];
  }
  // ── Shape 4: Single frame / group ───────────────────────────────────────
  else if (obj.type) {
    topLevelFrames = [obj];
  }
  // ── Fallback: treat as partial node ─────────────────────────────────────
  else {
    topLevelFrames = [{ type: 'FRAME', name: 'Imported Layout', id: 'root', children: obj.children ?? [] }];
  }

  // Filter hidden top-level frames (unless everything is hidden)
  const visibleFrames = topLevelFrames.filter((f) => f.visible !== false);
  const framesToParse = visibleFrames.length > 0 ? visibleFrames : topLevelFrames;

  const nodes = framesToParse.map((f) =>
    parseNode(f, 0, primaryPage, allNodes, stats)
  );

  return {
    nodes,
    allNodes,
    meta: {
      pageCount,
      totalNodes: stats.total,
      componentCount: stats.components,
      instanceCount: stats.instances,
      frameCount: stats.frames,
      textCount: stats.texts,
      primaryPage,
    },
  };
}

function emptyResult(reason: string): FigmaParseResult {
  return {
    nodes: [],
    allNodes: new Map(),
    meta: {
      pageCount: 0,
      totalNodes: 0,
      componentCount: 0,
      instanceCount: 0,
      frameCount: 0,
      textCount: 0,
      primaryPage: reason,
    },
  };
}

// ─── Utility: flatten tree ────────────────────────────────────────────────────

export interface FlatFigmaNode {
  node: FigmaNode;
  depth: number;
  path: string;
  hasChildren: boolean;
}

/** Flatten a FigmaNode tree into a sorted list for tree-view rendering */
export function flattenFigmaTree(
  nodes: FigmaNode[],
  depth = 0
): FlatFigmaNode[] {
  return nodes.flatMap((node) => [
    { node, depth, path: node.path, hasChildren: node.children.length > 0 },
    ...flattenFigmaTree(node.children, depth + 1),
  ]);
}

/** Retrieve all leaf nodes (no children) — useful for widget-level mapping */
export function getFigmaLeafNodes(nodes: FigmaNode[]): FigmaNode[] {
  const leaves: FigmaNode[] = [];
  function visit(n: FigmaNode) {
    if (n.children.length === 0) {
      leaves.push(n);
    } else {
      n.children.forEach(visit);
    }
  }
  nodes.forEach(visit);
  return leaves;
}

/** Get all container nodes (frames + groups) — suitable as mapping targets */
export function getFigmaContainerNodes(nodes: FigmaNode[]): FigmaNode[] {
  const containers: FigmaNode[] = [];
  function visit(n: FigmaNode) {
    if (n.type === 'frame' || n.type === 'group') {
      containers.push(n);
    }
    n.children.forEach(visit);
  }
  nodes.forEach(visit);
  return containers;
}

/** Describe a figma node's layout in human-readable form */
export function describeFigmaLayout(node: FigmaNode): string {
  const mode = node.layout.mode;
  const dims = node.layout.bounds
    ? `${Math.round(node.layout.bounds.width)}×${Math.round(node.layout.bounds.height)}`
    : '';
  if (mode === 'horizontal') return `Flex row${dims ? ' · ' + dims : ''}`;
  if (mode === 'vertical')   return `Flex column${dims ? ' · ' + dims : ''}`;
  return dims ? `Fixed · ${dims}` : 'No auto-layout';
}
