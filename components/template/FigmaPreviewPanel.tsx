'use client';

/**
 * FigmaPreviewPanel
 * ──────────────────
 * Visual canvas preview of a parsed Figma design.
 * Renders Figma nodes as absolutely-positioned, colour-coded boxes,
 * scaled and centred to fill the available area.
 *
 * Structural nodes (frame / group) that map to a FigmaTargetRegion
 * register their DOM element with `targetRegionRefs` so the parent
 * studio's SVG connector system can draw bezier paths to them.
 */

import React, {
  memo,
  useMemo,
  useRef,
  useState,
  useLayoutEffect,
  useCallback,
} from 'react';
import { cn } from '@/utils/cn';
import type { FigmaNode } from '@/services/figmaParser';
import type { FigmaTargetRegion } from '@/services/figmaLayoutTransformer';
import type { FigmaRegionMapping } from '@/models/RegionMapping';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface FigmaPreviewPanelProps {
  figmaNodes: FigmaNode[];
  figmaRegions: FigmaTargetRegion[];
  mappings: FigmaRegionMapping[];
  connectingFromId: string | null;
  onSelectNode: (region: FigmaTargetRegion) => void;
  targetRegionRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

// ─── Node type colours ────────────────────────────────────────────────────────

const TYPE_PALETTE: Record<
  string,
  { border: string; bg: string; label: string }
> = {
  frame:     { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)',   label: '#1d4ed8' },
  group:     { border: '#8b5cf6', bg: 'rgba(139,92,246,0.08)',   label: '#6d28d9' },
  component: { border: '#10b981', bg: 'rgba(16,185,129,0.08)',   label: '#047857' },
  instance:  { border: '#34d399', bg: 'rgba(52,211,153,0.07)',   label: '#059669' },
  text:      { border: '#f59e0b', bg: 'rgba(245,158,11,0.04)',   label: '#b45309' },
  shape:     { border: '#94a3b8', bg: 'rgba(148,163,184,0.04)',  label: '#64748b' },
  unknown:   { border: '#cbd5e1', bg: 'rgba(203,213,225,0.04)',  label: '#94a3b8' },
};

const MAPPED_PALETTE = {
  border: '#16a34a',
  bg: 'rgba(34,197,94,0.11)',
  label: '#15803d',
};

// ─── Flat node list up to a given depth ──────────────────────────────────────

interface FlatEntry {
  node: FigmaNode;
  depth: number;
  region?: FigmaTargetRegion;
}

function flattenNodes(
  nodes: FigmaNode[],
  regions: FigmaTargetRegion[],
  maxDepth: number,
  depth = 0,
): FlatEntry[] {
  const out: FlatEntry[] = [];
  for (const n of nodes) {
    if (!n.visible || n.opacity < 0.1) continue;
    out.push({ node: n, depth, region: regions.find((r) => r.figmaNodeId === n.id) });
    if (depth < maxDepth) {
      out.push(...flattenNodes(n.children, regions, maxDepth, depth + 1));
    }
  }
  return out;
}

// ─── Overall bounding box ─────────────────────────────────────────────────────

function computeExtent(entries: FlatEntry[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const { node } of entries) {
    const b = node.layout.bounds;
    if (!b) continue;
    if (b.x < minX) minX = b.x;
    if (b.y < minY) minY = b.y;
    if (b.x + b.width  > maxX) maxX = b.x + b.width;
    if (b.y + b.height > maxY) maxY = b.y + b.height;
  }
  return {
    minX: isFinite(minX) ? minX : 0,
    minY: isFinite(minY) ? minY : 0,
    totalW: isFinite(maxX) && isFinite(minX) ? maxX - minX : 0,
    totalH: isFinite(maxY) && isFinite(minY) ? maxY - minY : 0,
  };
}

// ─── Single node box ──────────────────────────────────────────────────────────

interface NodeBoxProps {
  entry: FlatEntry;
  scale: number;
  ox: number;
  oy: number;
  isMapped: boolean;
  connectingFromId: string | null;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (region: FigmaTargetRegion) => void;
  targetRegionRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

const NodeBox = memo(function NodeBox({
  entry,
  scale,
  ox,
  oy,
  isMapped,
  connectingFromId,
  hoveredId,
  onHover,
  onSelect,
  targetRegionRefs,
}: NodeBoxProps) {
  const { node, depth, region } = entry;
  const b = node.layout.bounds;
  if (!b) return null;

  const x = Math.round(b.x * scale + ox);
  const y = Math.round(b.y * scale + oy);
  const w = Math.round(b.width  * scale);
  const h = Math.round(b.height * scale);

  if (w < 2 || h < 2) return null;

  const isStructural = node.type === 'frame' || node.type === 'group';
  const canTarget = isStructural && !!region;
  const isHovered = hoveredId === node.id;
  const palette = isMapped ? MAPPED_PALETTE : (TYPE_PALETTE[node.type] ?? TYPE_PALETTE.unknown);

  const opacity = Math.max(0.25, 1 - depth * 0.15);
  const borderWidth = Math.max(0.8, 1.6 - depth * 0.25);
  const fontSize = Math.max(8, Math.min(10, w * 0.1));
  const showName = isStructural && w > 40 && h > 18;
  const showMappedBadge = isMapped && w > 50 && h > 28;

  const refCallback = useCallback(
    (el: HTMLDivElement | null) => {
      if (!canTarget || !region) return;
      if (el) targetRegionRefs.current.set(region.id, el);
      else    targetRegionRefs.current.delete(region.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canTarget, region?.id],
  );

  return (
    <div
      ref={canTarget ? refCallback : undefined}
      title={node.name}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        border: `${borderWidth}px solid ${isHovered && canTarget ? '#6366f1' : palette.border}`,
        borderRadius: 2,
        backgroundColor: isHovered && canTarget ? 'rgba(99,102,241,0.12)' : palette.bg,
        opacity,
        cursor: canTarget ? 'pointer' : 'default',
        zIndex: depth,
        boxSizing: 'border-box',
        transition: 'background-color 0.12s, border-color 0.12s, box-shadow 0.12s',
        boxShadow: isHovered && canTarget ? '0 0 0 2px rgba(99,102,241,0.3)' : undefined,
      }}
      onMouseEnter={() => canTarget && onHover(node.id)}
      onMouseLeave={() => canTarget && onHover(null)}
      onClick={() => {
        if (canTarget && region) onSelect(region);
      }}
    >
      {/* Node name label */}
      {showName && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: 3,
            fontSize,
            color: isHovered && canTarget ? '#4f46e5' : palette.label,
            fontWeight: 600,
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1.2,
            maxWidth: w - 6,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {node.name}
        </span>
      )}

      {/* "mapped" badge */}
      {showMappedBadge && (
        <span
          style={{
            position: 'absolute',
            bottom: 2,
            right: 3,
            fontSize: 8,
            color: MAPPED_PALETTE.label,
            backgroundColor: 'rgba(240,253,244,0.92)',
            padding: '1px 4px',
            borderRadius: 3,
            fontWeight: 700,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          mapped
        </span>
      )}

      {/* Connecting-mode "Map here" badge */}
      {connectingFromId && canTarget && isHovered && (
        <span
          style={{
            position: 'absolute',
            bottom: 2,
            right: 3,
            fontSize: 8,
            color: '#fff',
            backgroundColor: '#6366f1',
            padding: '1px 5px',
            borderRadius: 3,
            fontWeight: 700,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          Map here
        </span>
      )}
    </div>
  );
});

// ─── Main panel ───────────────────────────────────────────────────────────────

export const FigmaPreviewPanel = memo(function FigmaPreviewPanel({
  figmaNodes,
  figmaRegions,
  mappings,
  connectingFromId,
  onSelectNode,
  targetRegionRefs,
}: FigmaPreviewPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 280, h: 420 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const PADDING = 16;

  const allEntries = useMemo(
    () => flattenNodes(figmaNodes, figmaRegions, 3),
    [figmaNodes, figmaRegions],
  );

  const extent = useMemo(() => computeExtent(allEntries), [allEntries]);

  const { scale, ox, oy } = useMemo(() => {
    const { minX, minY, totalW, totalH } = extent;
    if (totalW === 0 || totalH === 0) return { scale: 1, ox: PADDING, oy: PADDING };

    const availW = size.w - PADDING * 2;
    const availH = size.h - PADDING * 2;
    const s = Math.min(availW / totalW, availH / totalH);
    const scaledW = totalW * s;
    const scaledH = totalH * s;
    return {
      scale: s,
      ox: (size.w - scaledW) / 2 - minX * s,
      oy: (size.h - scaledH) / 2 - minY * s,
    };
  }, [size, extent]);

  // Empty state
  if (figmaNodes.length === 0) {
    return (
      <div
        ref={containerRef}
        className="flex flex-col items-center justify-center h-full px-6 text-center"
      >
        <p className="text-xs text-slate-400 dark:text-slate-500">
          No Figma layout imported yet.
        </p>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
          Use "Import Figma Layout" in the toolbar to load a design.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 overflow-hidden"
      style={{
        backgroundColor: '#f8f9fb',
        backgroundImage:
          'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
        backgroundSize: '20px 20px',
      }}
    >
      {/* Canvas: node boxes */}
      {allEntries.map((entry) => {
        const isMapped =
          !!entry.region &&
          mappings.some(
            (m) =>
              m.targetFigmaNodeId === entry.node.id ||
              m.targetRegionId === entry.region!.id,
          );
        return (
          <NodeBox
            key={entry.node.id}
            entry={entry}
            scale={scale}
            ox={ox}
            oy={oy}
            isMapped={isMapped}
            connectingFromId={connectingFromId}
            hoveredId={hoveredId}
            onHover={setHoveredId}
            onSelect={onSelectNode}
            targetRegionRefs={targetRegionRefs}
          />
        );
      })}

      {/* Connecting-mode hint */}
      {connectingFromId && (
        <div
          className="absolute bottom-3 left-3 right-3 z-50 pointer-events-none"
        >
          <div className="bg-indigo-600 text-white text-[10px] font-semibold text-center py-1.5 px-3 rounded-lg shadow-md">
            Click a <strong>frame</strong> or <strong>group</strong> to set it as the target region
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-2 left-2 flex flex-col gap-1 z-40 pointer-events-none">
        {[
          { type: 'frame',     label: 'Frame' },
          { type: 'group',     label: 'Group' },
          { type: 'component', label: 'Component' },
        ].map(({ type, label }) => {
          const p = TYPE_PALETTE[type];
          return (
            <div key={type} className="flex items-center gap-1">
              <div
                style={{ width: 8, height: 8, border: `1.5px solid ${p.border}`, backgroundColor: p.bg, borderRadius: 1 }}
              />
              <span style={{ fontSize: 9, color: p.label, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>
                {label}
              </span>
            </div>
          );
        })}
        <div className="flex items-center gap-1 mt-0.5">
          <div
            style={{ width: 8, height: 8, border: `1.5px solid ${MAPPED_PALETTE.border}`, backgroundColor: MAPPED_PALETTE.bg, borderRadius: 1 }}
          />
          <span style={{ fontSize: 9, color: MAPPED_PALETTE.label, fontFamily: 'system-ui, sans-serif', fontWeight: 600 }}>
            Mapped
          </span>
        </div>
      </div>

      {/* Scale indicator */}
      <div
        className="absolute top-2 right-2 z-40 pointer-events-none"
        style={{
          fontSize: 9,
          color: '#94a3b8',
          backgroundColor: 'rgba(255,255,255,0.85)',
          padding: '2px 6px',
          borderRadius: 4,
          fontFamily: 'system-ui, sans-serif',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {Math.round(scale * 100)}%
      </div>
    </div>
  );
});
