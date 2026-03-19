'use client';

/**
 * FigmaTargetPanel
 * ─────────────────
 * Right-panel component for the Template Mapping Studio's Figma mode.
 *
 * Responsibilities:
 *  - Display parsed Figma structural tree (frames, groups, components)
 *  - Highlight nodes on hover
 *  - Show bounding-box layout hierarchy
 *  - Allow users to select a Figma node as a mapping target
 *  - Show which nodes are already mapped / unmapped
 */

import React, { memo, useState, useCallback } from 'react';
import {
  Layers,
  ChevronRight,
  ChevronDown,
  Box,
  Layout,
  Puzzle,
  Type,
  Square,
  HelpCircle,
  CheckCircle2,
  Maximize2,
  MoveHorizontal,
  MoveVertical,
  Minus,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { FigmaNode } from '@/services/figmaParser';
import { describeFigmaLayout } from '@/services/figmaParser';
import type { FigmaTargetRegion } from '@/services/figmaLayoutTransformer';
import type { FigmaRegionMapping } from '@/models/RegionMapping';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FigmaTargetPanelProps {
  /** Top-level figma nodes from the parse result */
  figmaNodes: FigmaNode[];
  /** Figma-derived target regions (from transformFigmaToTargetLayout) */
  figmaRegions: FigmaTargetRegion[];
  /** Current set of mappings (to show which nodes are mapped) */
  mappings: FigmaRegionMapping[];
  /** Whether we are in "connecting" mode (waiting for a target click) */
  connectingFromId: string | null;
  /** Callback when user selects a Figma node as the mapping target */
  onSelectNode: (region: FigmaTargetRegion) => void;
  /** Callback when user cancels connection */
  onCancelConnect: () => void;
  /** Target region refs for SVG connectors (reuses existing connector system) */
  targetRegionRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

// ─── Node type icons ──────────────────────────────────────────────────────────

function FigmaNodeIcon({ type, size = 12 }: { type: FigmaNode['type']; size?: number }) {
  const cls = 'shrink-0';
  switch (type) {
    case 'frame':     return <Layout size={size} className={cn(cls, 'text-blue-500')} />;
    case 'group':     return <Layers size={size} className={cn(cls, 'text-purple-500')} />;
    case 'component': return <Puzzle size={size} className={cn(cls, 'text-green-500')} />;
    case 'instance':  return <Puzzle size={size} className={cn(cls, 'text-emerald-400')} />;
    case 'text':      return <Type size={size} className={cn(cls, 'text-orange-400')} />;
    case 'shape':     return <Square size={size} className={cn(cls, 'text-slate-400')} />;
    default:          return <HelpCircle size={size} className={cn(cls, 'text-slate-300')} />;
  }
}

function LayoutModeIcon({ mode, size = 11 }: { mode: FigmaNode['layout']['mode']; size?: number }) {
  if (mode === 'horizontal') return <MoveHorizontal size={size} className="text-sky-400 shrink-0" />;
  if (mode === 'vertical')   return <MoveVertical   size={size} className="text-indigo-400 shrink-0" />;
  return <Minus size={size} className="text-slate-300 shrink-0" />;
}

// ─── Single Figma tree node row ───────────────────────────────────────────────

interface FigmaNodeRowProps {
  node: FigmaNode;
  depth: number;
  region?: FigmaTargetRegion;
  isMapped: boolean;
  isConnecting: boolean;
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onSelect: (region: FigmaTargetRegion) => void;
  targetRegionRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

const FigmaNodeRow = memo(function FigmaNodeRow({
  node,
  depth,
  region,
  isMapped,
  isConnecting,
  isHovered,
  isSelected,
  onHover,
  onSelect,
  targetRegionRefs,
}: FigmaNodeRowProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const isStructural = node.type === 'frame' || node.type === 'group';
  const canTarget = isStructural && !!region;

  const bounds = node.layout.bounds;
  const boundsStr = bounds
    ? `${Math.round(bounds.width)}×${Math.round(bounds.height)}`
    : '';

  return (
    <div>
      <div
        ref={canTarget && region ? (el) => { if (el) targetRegionRefs.current.set(region.id, el); } : undefined}
        className={cn(
          'group flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all select-none',
          canTarget && isConnecting
            ? 'cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/30 hover:ring-1 hover:ring-indigo-400'
            : canTarget
            ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60'
            : 'cursor-default',
          isMapped && 'bg-green-50/60 dark:bg-green-950/20',
          isHovered && 'bg-sky-50 dark:bg-sky-950/20 ring-1 ring-sky-300 dark:ring-sky-700',
          isSelected && 'bg-indigo-50 dark:bg-indigo-950/30 ring-1 ring-indigo-400',
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
        onMouseEnter={() => canTarget && onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        onClick={() => {
          if (canTarget && region) onSelect(region);
        }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            className="shrink-0 p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {/* Node type icon */}
        <FigmaNodeIcon type={node.type} size={12} />

        {/* Name */}
        <span className={cn(
          'flex-1 truncate font-medium',
          node.type === 'text' || node.type === 'shape'
            ? 'text-slate-400 dark:text-slate-500 font-normal'
            : 'text-slate-700 dark:text-slate-200',
        )}>
          {node.name}
        </span>

        {/* Layout mode indicator */}
        {isStructural && <LayoutModeIcon mode={node.layout.mode} />}

        {/* Bounds */}
        {boundsStr && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums hidden group-hover:inline">
            {boundsStr}
          </span>
        )}

        {/* Mapped badge */}
        {isMapped && (
          <CheckCircle2 size={11} className="text-green-500 shrink-0" />
        )}

        {/* Drop target hint during connection */}
        {canTarget && isConnecting && (
          <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/40 px-1 rounded hidden group-hover:inline">
            Map here
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FigmaNodeRowContainer
              key={child.id}
              node={child}
              depth={depth + 1}
              isConnecting={isConnecting}
              onSelect={onSelect}
              targetRegionRefs={targetRegionRefs}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ─── Container that resolves region + mapping state ──────────────────────────

interface FigmaNodeRowContainerProps {
  node: FigmaNode;
  depth: number;
  isConnecting: boolean;
  onSelect: (region: FigmaTargetRegion) => void;
  targetRegionRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

// This is a display-only wrapper; mapping state is passed down from the outer panel
// using a shared hover context via closure capture in FigmaTargetPanel.
// We use a module-level registry to avoid prop-drilling deep down.

let _panelRegions: FigmaTargetRegion[] = [];
let _panelMappings: FigmaRegionMapping[] = [];
let _panelHoverId: string | null = null;
let _panelOnHover: (id: string | null) => void = () => {};
let _panelSelectedId: string | null = null;

const FigmaNodeRowContainer = memo(function FigmaNodeRowContainer({
  node,
  depth,
  isConnecting,
  onSelect,
  targetRegionRefs,
}: FigmaNodeRowContainerProps) {
  const region = _panelRegions.find((r) => r.figmaNodeId === node.id);
  const isMapped = _panelMappings.some(
    (m) => m.targetFigmaNodeId === node.id || (region && m.targetRegionId === region.id)
  );
  const isHovered = _panelHoverId === node.id;
  const isSelected = _panelSelectedId === node.id;

  return (
    <FigmaNodeRow
      node={node}
      depth={depth}
      region={region}
      isMapped={isMapped}
      isConnecting={isConnecting}
      isHovered={isHovered}
      isSelected={isSelected}
      onHover={_panelOnHover}
      onSelect={onSelect}
      targetRegionRefs={targetRegionRefs}
    />
  );
});

// ─── Stats bar ────────────────────────────────────────────────────────────────

interface FigmaStatsBarProps {
  totalNodes: number;
  frameCount: number;
  componentCount: number;
  mappedCount: number;
}

function FigmaStatsBar({ totalNodes, frameCount, componentCount, mappedCount }: FigmaStatsBarProps) {
  const stats = [
    { label: 'Nodes',      value: totalNodes,      color: 'text-slate-500' },
    { label: 'Frames',     value: frameCount,       color: 'text-blue-500' },
    { label: 'Components', value: componentCount,   color: 'text-green-500' },
    { label: 'Mapped',     value: mappedCount,      color: 'text-indigo-600' },
  ];
  return (
    <div className="flex gap-3 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/30">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col items-center min-w-0">
          <span className={cn('text-sm font-bold tabular-nums', s.color)}>{s.value}</span>
          <span className="text-[9px] text-slate-400 uppercase tracking-wide">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export const FigmaTargetPanel = memo(function FigmaTargetPanel({
  figmaNodes,
  figmaRegions,
  mappings,
  connectingFromId,
  onSelectNode,
  onCancelConnect,
  targetRegionRefs,
}: FigmaTargetPanelProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'frames' | 'components'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sync module-level state for FigmaNodeRowContainer children
  _panelRegions   = figmaRegions;
  _panelMappings  = mappings;
  _panelHoverId   = hoveredId;
  _panelOnHover   = setHoveredId;
  _panelSelectedId = selectedId;

  const handleSelect = useCallback((region: FigmaTargetRegion) => {
    setSelectedId(region.figmaNodeId);
    onSelectNode(region);
  }, [onSelectNode]);

  // Count stats
  let totalNodes = 0, frames = 0, components = 0;
  function countNodes(nodes: FigmaNode[]) {
    for (const n of nodes) {
      totalNodes++;
      if (n.type === 'frame') frames++;
      if (n.type === 'component' || n.type === 'instance') components++;
      countNodes(n.children);
    }
  }
  countNodes(figmaNodes);
  const mappedCount = figmaRegions.filter((r) =>
    mappings.some((m) => m.targetFigmaNodeId === r.figmaNodeId || m.targetRegionId === r.id)
  ).length;

  // Filter top-level nodes by search / filter tab
  const filteredNodes = figmaNodes.filter((n) => {
    if (searchQuery) {
      return n.name.toLowerCase().includes(searchQuery.toLowerCase());
    }
    if (filter === 'frames')     return n.type === 'frame' || n.type === 'group';
    if (filter === 'components') return n.type === 'component' || n.type === 'instance';
    return true;
  });

  return (
    <div
      className="flex flex-col h-full overflow-hidden border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
      style={{ width: 296 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
        <div>
          <div className="flex items-center gap-1.5">
            <Box size={13} className="text-violet-500" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
              Figma Layout
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            {figmaNodes.length} top-level frame(s)
          </p>
        </div>
        {connectingFromId && (
          <button
            onClick={onCancelConnect}
            className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline font-medium"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Stats bar */}
      <FigmaStatsBar
        totalNodes={totalNodes}
        frameCount={frames}
        componentCount={components}
        mappedCount={mappedCount}
      />

      {/* Connecting hint */}
      {connectingFromId && (
        <div className="mx-2 mt-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 shrink-0">
          ← Click a Figma frame to map it
        </div>
      )}

      {/* Search + filter */}
      <div className="px-2 py-2 border-b border-slate-100 dark:border-slate-800 space-y-1.5 shrink-0">
        <input
          type="text"
          className="w-full text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:text-slate-100 placeholder-slate-400"
          placeholder="Search nodes…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="flex gap-1">
          {(['all', 'frames', 'components'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'flex-1 text-[10px] py-0.5 rounded font-medium transition-all',
                filter === f
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {figmaNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Maximize2 size={28} className="text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No Figma layout loaded</p>
            <p className="text-xs text-slate-400 mt-1">Use "Import Figma Layout" above</p>
          </div>
        ) : filteredNodes.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No nodes match "{searchQuery}"
          </div>
        ) : (
          filteredNodes.map((node) => (
            <FigmaNodeRowContainer
              key={node.id}
              node={node}
              depth={0}
              isConnecting={!!connectingFromId}
              onSelect={handleSelect}
              targetRegionRefs={targetRegionRefs}
            />
          ))
        )}
      </div>

      {/* Legend */}
      <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 shrink-0">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {[
            { icon: <Layout size={9} className="text-blue-500" />,  label: 'Frame' },
            { icon: <Layers size={9} className="text-purple-500" />, label: 'Group' },
            { icon: <Puzzle size={9} className="text-green-500" />,  label: 'Component' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1">
              {item.icon}
              <span className="text-[9px] text-slate-400">{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <MoveHorizontal size={9} className="text-sky-400" />
            <span className="text-[9px] text-slate-400">H-layout</span>
          </div>
          <div className="flex items-center gap-1">
            <MoveVertical size={9} className="text-indigo-400" />
            <span className="text-[9px] text-slate-400">V-layout</span>
          </div>
        </div>
      </div>
    </div>
  );
});
