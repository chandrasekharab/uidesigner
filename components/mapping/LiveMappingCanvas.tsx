'use client';

/**
 * LiveMappingCanvas
 * ─────────────────
 * Interactive dual-panel visual mapping canvas for the Template Mapping Studio.
 *
 * Layout:
 *   [Left: Pega Source Regions] ← SVG bezier arrows → [Right: Target/Figma Regions]
 *
 * Features:
 *   • Drag source port (●) → drop on target region → creates a mapping arrow
 *   • Click an arrow → select it → edit or delete via floating edit panel
 *   • Re-route: delete old arrow & drag a new connection
 *   • Color-coded arrows by mapping type (1:1 indigo, 1:N amber, N:1 emerald)
 *   • Dashed violet arrows for AI-suggested mappings
 *   • Animated stroke-dashoffset on hover
 *   • Undo / Redo (Ctrl+Z / Ctrl+Y or ⌘Z / ⌘Y)
 *   • Delete / Backspace removes the selected mapping
 *   • ESC cancels a drag in progress
 */

import React, {
  memo,
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  Sparkles,
  Loader2,
  Play,
  RotateCcw,
  Undo2,
  Redo2,
  Trash2,
  ArrowRight,
  CheckCircle2,
  X,
  Layers,
  Link2,
  Info,
  Zap,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { PegaTemplate, PegaTemplateRegion } from '@/config/pegaTemplates';
import type {
  RegionMapping,
  MappingType,
  TargetLayoutRegion,
  TransformationRule,
  TransformationType,
} from '@/models/RegionMapping';
import { deriveMappingLabel } from '@/models/RegionMapping';

// ─── Colour palette ────────────────────────────────────────────────────────────

const MAPPING_PALETTE: Record<MappingType, { stroke: string; label: string }> = {
  'one-to-one':  { stroke: '#6366f1', label: '1 → 1' },
  'one-to-many': { stroke: '#f59e0b', label: '1 → N' },
  'many-to-one': { stroke: '#10b981', label: 'N → 1' },
};

const AI_STROKE    = '#8b5cf6';
const SEL_STROKE   = '#4338ca';
const HOVER_STROKE = '#818cf8';
const GHOST_STROKE = '#94a3b8';

// ─── Internal types ────────────────────────────────────────────────────────────

interface ComputedArrow {
  mappingId: string;
  d:         string;
  midX:      number;
  midY:      number;
  stroke:    string;
  selected:  boolean;
  hovered:   boolean;
  aiSugg:    boolean;
  typeLabel: string;
}

interface DragState {
  sourceId:    string;
  ghostPath:   string;
  overTargetId: string | null;
}

// ─── Public props ──────────────────────────────────────────────────────────────

export interface LiveMappingCanvasProps {
  /** Selected Pega source template */
  sourceTemplate: PegaTemplate | null;
  /** Target regions (standard TargetLayoutRegion or figma-extended) */
  targetRegions: TargetLayoutRegion[];
  /** Current mapping set — managed externally */
  mappings: RegionMapping[];
  /** Called every time the mapping set changes inside the canvas */
  onMappingsChange: (mappings: RegionMapping[]) => void;
  /** Whether target regions are Figma-derived */
  figmaMode?: boolean;
  /** Async auto-map trigger (parent handles AI logic) */
  onAutoMap?: () => Promise<void>;
  isAutoMapping?: boolean;
  /** Generate output trigger */
  onGenerate?: () => void;
  isGenerating?: boolean;
}

// ─── Bezier helpers ────────────────────────────────────────────────────────────

function cubicPath(x1: number, y1: number, x2: number, y2: number): string {
  const ctrl = Math.max(60, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + ctrl} ${y1} ${x2 - ctrl} ${y2} ${x2} ${y2}`;
}

/** Evaluate a cubic bezier at t=0.5 to get the midpoint label position */
function bezierMid(
  x1: number, y1: number,
  x2: number, y2: number,
): { x: number; y: number } {
  const ctrl = Math.max(60, Math.abs(x2 - x1) * 0.45);
  const cx1 = x1 + ctrl, cy1 = y1;
  const cx2 = x2 - ctrl, cy2 = y2;
  return {
    x: 0.125 * x1 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x2,
    y: 0.125 * y1 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y2,
  };
}

// ─── SVG marker defs ───────────────────────────────────────────────────────────

const MARKER_DEFS: Array<{ id: string; color: string }> = [
  { id: 'mc-onetoone',  color: MAPPING_PALETTE['one-to-one'].stroke  },
  { id: 'mc-onetomany', color: MAPPING_PALETTE['one-to-many'].stroke },
  { id: 'mc-manytoone', color: MAPPING_PALETTE['many-to-one'].stroke },
  { id: 'mc-ai',        color: AI_STROKE    },
  { id: 'mc-sel',       color: SEL_STROKE   },
  { id: 'mc-hover',     color: HOVER_STROKE },
  { id: 'mc-ghost',     color: GHOST_STROKE },
];

function ArrowDefs() {
  return (
    <defs>
      {MARKER_DEFS.map(({ id, color }) => (
        <marker
          key={id}
          id={id}
          markerWidth="9"
          markerHeight="7"
          refX="8.5"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 9 3.5, 0 7" fill={color} />
        </marker>
      ))}
    </defs>
  );
}

function markerFor(m: RegionMapping, selected: boolean, hovered: boolean): string {
  if (selected) return 'url(#mc-sel)';
  if (hovered)  return 'url(#mc-hover)';
  if (m.source === 'ai-suggested') return 'url(#mc-ai)';
  return `url(#mc-${m.mappingType.replace(/-/g, '')})`;
}

// ─── Source Region Card ────────────────────────────────────────────────────────

interface SourceCardProps {
  region:       PegaTemplateRegion;
  isMapped:     boolean;
  isDragSource: boolean;
  isDragging:   boolean;
  elRef:        (el: HTMLDivElement | null) => void;
  onPortDown:   (e: React.PointerEvent) => void;
}

const SourceCard = memo(function SourceCard({
  region, isMapped, isDragSource, isDragging, elRef, onPortDown,
}: SourceCardProps) {
  const [hover, setHover] = useState(false);

  return (
    <div
      ref={elRef}
      className={cn(
        'relative rounded-xl border-2 px-3 py-2.5 transition-all duration-150 select-none',
        isDragSource
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 shadow-lg ring-2 ring-indigo-200 dark:ring-indigo-800'
          : isMapped
          ? 'border-green-400 dark:border-green-700 bg-green-50/60 dark:bg-green-950/20'
          : hover
          ? 'border-indigo-300 dark:border-indigo-600 bg-slate-50 dark:bg-slate-800/50 shadow-sm'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900',
      )}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Left colour swatch */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
        style={{ backgroundColor: region.color }}
      />

      <div className="pl-2 pr-5">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
            {region.name}
          </span>
          {isMapped && <CheckCircle2 size={11} className="text-green-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 dark:text-slate-400">{region.type}</span>
          {region.pegaLayout && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500">
              {region.pegaLayout}
            </span>
          )}
        </div>
      </div>

      {/* Connection port — right edge */}
      <div
        onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onPortDown(e); }}
        title={`Connect from "${region.name}"`}
        className={cn(
          'absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2',
          'w-3.5 h-3.5 rounded-full border-2 cursor-crosshair z-20',
          'transition-all duration-150',
          isDragSource
            ? 'scale-125 shadow-md'
            : (hover || isDragging)
            ? 'opacity-100 scale-110'
            : 'opacity-50 hover:opacity-100 hover:scale-125',
        )}
        style={{
          borderColor: region.color,
          backgroundColor: isDragSource ? region.color : 'white',
        }}
      />
    </div>
  );
});

// ─── Target Region Card ────────────────────────────────────────────────────────

interface TargetCardProps {
  region:     TargetLayoutRegion & { figmaPath?: string; figmaDepth?: number };
  isMapped:   boolean;
  isDragOver: boolean;
  figmaMode:  boolean;
  elRef:      (el: HTMLDivElement | null) => void;
}

const TargetCard = memo(function TargetCard({
  region, isMapped, isDragOver, figmaMode, elRef,
}: TargetCardProps) {
  return (
    <div
      ref={elRef}
      className={cn(
        'relative rounded-xl border-2 px-3 py-2.5 transition-all duration-150 select-none',
        isDragOver
          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 shadow-lg ring-2 ring-indigo-300 dark:ring-indigo-700 scale-[1.02]'
          : isMapped
          ? 'border-green-400 dark:border-green-700 bg-green-50/60 dark:bg-green-950/20'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-200 dark:hover:border-slate-600',
      )}
    >
      {/* Right colour swatch */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 rounded-r-xl"
        style={{ backgroundColor: region.color }}
      />

      {/* Connection port — left edge */}
      <div
        className={cn(
          'absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2',
          'w-3.5 h-3.5 rounded-full border-2 z-20 transition-all duration-150',
          isDragOver ? 'scale-150 shadow-md' : 'opacity-50',
        )}
        style={{
          borderColor: region.color,
          backgroundColor: isDragOver ? region.color : undefined,
        }}
      />

      <div className="pl-4 pr-2">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
            {region.name}
          </span>
          {isMapped && <CheckCircle2 size={11} className="text-green-500 shrink-0" />}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 dark:text-slate-400">{region.layout}</span>
          {figmaMode && region.figmaDepth !== undefined && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400">
              F/{region.figmaDepth}
            </span>
          )}
        </div>
        {figmaMode && region.figmaPath && (
          <p className="text-[9px] text-slate-400 truncate mt-0.5">{region.figmaPath}</p>
        )}
      </div>
    </div>
  );
});

// ─── Mapping edit panel ────────────────────────────────────────────────────────

const TRANSFORM_OPTS: Array<{ value: TransformationType; label: string }> = [
  { value: 'layout-change',      label: 'Layout Change' },
  { value: 'widget-replacement', label: 'Widget Replacement' },
  { value: 'field-grouping',     label: 'Field Grouping' },
  { value: 'property-remap',     label: 'Property Remap' },
  { value: 'visibility-rule',    label: 'Visibility Rule' },
];

interface EditPanelProps {
  mapping:    RegionMapping;
  srcName:    string;
  tgtName:    string;
  onClose:    () => void;
  onChange:   (patch: Partial<RegionMapping>) => void;
  onDelete:   () => void;
}

const MappingEditPanel = memo(function MappingEditPanel({
  mapping, srcName, tgtName, onClose, onChange, onDelete,
}: EditPanelProps) {
  const dotColor =
    mapping.source === 'ai-suggested'
      ? AI_STROKE
      : MAPPING_PALETTE[mapping.mappingType]?.stroke ?? SEL_STROKE;

  const rules = mapping.transformations ?? [];

  const addRule = () => {
    onChange({
      transformations: [
        ...rules,
        { type: 'layout-change', label: 'New rule', params: {} },
      ],
    });
  };

  const removeRule = (i: number) =>
    onChange({ transformations: rules.filter((_, idx) => idx !== i) });

  const patchRule = (i: number, p: Partial<TransformationRule>) =>
    onChange({ transformations: rules.map((r, idx) => (idx === i ? { ...r, ...p } : r)) });

  return (
    <div
      className="absolute bottom-4 right-4 z-50 w-72 rounded-2xl shadow-2xl overflow-hidden"
      style={{ border: `1px solid ${dotColor}44` }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700"
        style={{ borderLeft: `3px solid ${dotColor}` }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dotColor }} />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Edit Mapping</span>
          {mapping.source === 'ai-suggested' && (
            <span className="text-[9px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1.5 py-0.5 rounded-full font-bold">
              AI
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="bg-white dark:bg-slate-900 p-4 space-y-4 max-h-96 overflow-y-auto">
        {/* Source → Target summary */}
        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 text-xs">
          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[80px]">{srcName}</span>
          <ArrowRight size={11} className="text-slate-400 shrink-0" />
          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[80px]">{tgtName}</span>
        </div>

        {/* Mapping type */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Mapping Type
          </p>
          <div className="flex gap-1.5">
            {(Object.entries(MAPPING_PALETTE) as [MappingType, { stroke: string; label: string }][]).map(
              ([type, { stroke, label }]) => (
                <button
                  key={type}
                  onClick={() => onChange({ mappingType: type })}
                  className={cn(
                    'flex-1 text-[10px] font-bold py-1.5 rounded-lg border transition-all',
                    mapping.mappingType === type
                      ? 'text-white shadow-sm'
                      : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 hover:border-slate-300',
                  )}
                  style={
                    mapping.mappingType === type
                      ? { backgroundColor: stroke, borderColor: stroke }
                      : {}
                  }
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
            Notes
          </p>
          <textarea
            rows={2}
            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 placeholder-slate-400 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:focus:ring-indigo-600"
            placeholder="Optional notes…"
            value={mapping.notes ?? ''}
            onChange={(e) => onChange({ notes: e.target.value })}
          />
        </div>

        {/* Transformation rules */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Transformations
            </p>
            <button
              onClick={addRule}
              className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              + Add
            </button>
          </div>

          {rules.length === 0 ? (
            <p className="text-[10px] text-slate-400 italic">
              No rules — click <strong>+ Add</strong> to define transformations.
            </p>
          ) : (
            <div className="space-y-1.5">
              {rules.map((rule, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5 border border-slate-200 dark:border-slate-700"
                >
                  <select
                    className="flex-1 text-[10px] bg-transparent border-0 text-slate-600 dark:text-slate-300 focus:outline-none"
                    value={rule.type}
                    onChange={(e) =>
                      patchRule(idx, { type: e.target.value as TransformationType })
                    }
                  >
                    {TRANSFORM_OPTS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => removeRule(idx)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI confidence */}
        {mapping.source === 'ai-suggested' && mapping.confidence !== undefined && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">Confidence</span>
            <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-violet-500"
                style={{ width: `${Math.round(mapping.confidence * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-slate-400 tabular-nums">
              {Math.round(mapping.confidence * 100)}%
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-700">
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
        >
          <Trash2 size={12} /> Delete
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
});

// ─── Main Canvas ───────────────────────────────────────────────────────────────

export const LiveMappingCanvas = memo(function LiveMappingCanvas({
  sourceTemplate,
  targetRegions,
  mappings,
  onMappingsChange,
  figmaMode = false,
  onAutoMap,
  isAutoMapping = false,
  onGenerate,
  isGenerating = false,
}: LiveMappingCanvasProps) {

  // ── Local state ──────────────────────────────────────────────────────────
  const [localMappings, setLocalMappings] = useState<RegionMapping[]>(mappings);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [hoveredId,     setHoveredId]     = useState<string | null>(null);
  const [dragState,     setDragState]     = useState<DragState | null>(null);
  const [arrows,        setArrows]        = useState<ComputedArrow[]>([]);
  const [svgSize,       setSvgSize]       = useState({ w: 0, h: 0 });

  // ── Panel widths (resizable) ─────────────────────────────────────────────
  const MIN_PANEL = 160;
  const MAX_PANEL = 520;
  const [leftW,  setLeftW]  = useState(276);
  const [rightW, setRightW] = useState(276);
  // Which handle is being dragged: 'left' | 'right' | null
  const resizeDragRef = useRef<{ side: 'left' | 'right'; startX: number; startW: number } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.PointerEvent, side: 'left' | 'right') => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      resizeDragRef.current = {
        side,
        startX: e.clientX,
        startW: side === 'left' ? leftW : rightW,
      };
    },
    [leftW, rightW],
  );

  const handleResizeMove = useCallback(
    (e: React.PointerEvent) => {
      const rd = resizeDragRef.current;
      if (!rd) return;
      const delta = e.clientX - rd.startX;
      const next = Math.min(MAX_PANEL, Math.max(MIN_PANEL,
        rd.side === 'left' ? rd.startW + delta : rd.startW - delta,
      ));
      if (rd.side === 'left') setLeftW(next);
      else                    setRightW(next);
    },
    [],
  );

  const handleResizeEnd = useCallback(() => {
    resizeDragRef.current = null;
  }, []);

  // ── History (undo / redo) ────────────────────────────────────────────────
  const historyRef    = useRef<RegionMapping[][]>([[...mappings]]);
  const historyIdx    = useRef(0);

  // ── DOM refs ─────────────────────────────────────────────────────────────
  const containerRef  = useRef<HTMLDivElement>(null);
  const sourceRefs    = useRef<Map<string, HTMLDivElement>>(new Map());
  const targetRefs    = useRef<Map<string, HTMLDivElement>>(new Map());

  // ── Sync from parent (e.g. after AI auto-map) ────────────────────────────
  useEffect(() => {
    setLocalMappings(mappings);
    historyRef.current = [[...mappings]];
    historyIdx.current = 0;
    setSelectedId(null);
  // only re-sync when the parent replaces the array reference
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mappings]);

  // ── Arrow recalculation ──────────────────────────────────────────────────
  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    if (cRect.width === 0) return;
    setSvgSize({ w: cRect.width, h: cRect.height });

    const srcRegions = sourceTemplate?.regions ?? [];
    const computed: ComputedArrow[] = [];

    for (const m of localMappings) {
      const srcEl = sourceRefs.current.get(m.sourceRegionId);
      const tgtEl = targetRefs.current.get(m.targetRegionId);
      if (!srcEl || !tgtEl) continue;

      const sR = srcEl.getBoundingClientRect();
      const tR = tgtEl.getBoundingClientRect();

      const x1 = sR.right  - cRect.left;
      const y1 = (sR.top + sR.bottom) / 2 - cRect.top;
      const x2 = tR.left   - cRect.left;
      const y2 = (tR.top + tR.bottom) / 2 - cRect.top;

      const d   = cubicPath(x1, y1, x2, y2);
      const mid = bezierMid(x1, y1, x2, y2);

      const isAI   = m.source === 'ai-suggested';
      const isSel  = selectedId === m.id;
      const isHov  = hoveredId  === m.id;
      const stroke = isSel ? SEL_STROKE
        : isHov  ? HOVER_STROKE
        : isAI   ? AI_STROKE
        : MAPPING_PALETTE[m.mappingType]?.stroke ?? SEL_STROKE;

      const srcName = srcRegions.find((r) => r.id === m.sourceRegionId)?.name ?? m.sourceRegionId;
      const tgtName = targetRegions.find((r) => r.id === m.targetRegionId)?.name ?? m.targetRegionId;

      computed.push({
        mappingId: m.id,
        d,
        midX: mid.x,
        midY: mid.y,
        stroke,
        selected: isSel,
        hovered:  isHov,
        aiSugg:   isAI,
        typeLabel: MAPPING_PALETTE[m.mappingType]?.label ?? '1→1',
      });
    }
    setArrows(computed);
  }, [localMappings, selectedId, hoveredId, sourceTemplate, targetRegions]);

  useLayoutEffect(() => { recalc(); }, [recalc]);
  useEffect(() => {
    const ro = new ResizeObserver(recalc);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [recalc]);

  // ── History helpers ──────────────────────────────────────────────────────
  const push = useCallback((next: RegionMapping[]) => {
    const cut = historyRef.current.slice(0, historyIdx.current + 1);
    cut.push([...next]);
    historyRef.current = cut;
    historyIdx.current = cut.length - 1;
  }, []);

  const commit = useCallback((next: RegionMapping[]) => {
    setLocalMappings(next);
    onMappingsChange(next);
    push(next);
    setSelectedId(null);
  }, [onMappingsChange, push]);

  const undo = useCallback(() => {
    if (historyIdx.current <= 0) return;
    historyIdx.current--;
    const prev = historyRef.current[historyIdx.current];
    setLocalMappings([...prev]);
    onMappingsChange([...prev]);
    setSelectedId(null);
  }, [onMappingsChange]);

  const redo = useCallback(() => {
    if (historyIdx.current >= historyRef.current.length - 1) return;
    historyIdx.current++;
    const next = historyRef.current[historyIdx.current];
    setLocalMappings([...next]);
    onMappingsChange([...next]);
    setSelectedId(null);
  }, [onMappingsChange]);

  const canUndo = historyIdx.current > 0;
  const canRedo = historyIdx.current < historyRef.current.length - 1;

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDragState(null);
        setSelectedId(null);
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        commit(localMappings.filter((m) => m.id !== selectedId));
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        if (e.key === 'z' &&  e.shiftKey) { e.preventDefault(); redo(); }
        if (e.key === 'y') { e.preventDefault(); redo(); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, localMappings, undo, redo, commit]);

  // ── Drag: start ──────────────────────────────────────────────────────────
  const handlePortDown = useCallback((e: React.PointerEvent, sourceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(null);
    setDragState({ sourceId, ghostPath: '', overTargetId: null });
  }, []);

  // ── Drag: move ───────────────────────────────────────────────────────────
  const handleMove = useCallback((e: React.PointerEvent) => {
    if (!dragState || !containerRef.current) return;
    const cR = containerRef.current.getBoundingClientRect();
    const curX = e.clientX - cR.left;
    const curY = e.clientY - cR.top;

    const srcEl = sourceRefs.current.get(dragState.sourceId);
    if (!srcEl) return;
    const sR = srcEl.getBoundingClientRect();
    const portX = sR.right  - cR.left;
    const portY = (sR.top + sR.bottom) / 2 - cR.top;

    const ghostPath = cubicPath(portX, portY, curX, curY);

    let overTargetId: string | null = null;
    for (const [id, el] of targetRefs.current) {
      const tR = el.getBoundingClientRect();
      if (
        e.clientX >= tR.left - 24 &&
        e.clientX <= tR.right + 24 &&
        e.clientY >= tR.top - 6 &&
        e.clientY <= tR.bottom + 6
      ) {
        overTargetId = id;
        break;
      }
    }

    setDragState({ ...dragState, ghostPath, overTargetId });
  }, [dragState]);

  // ── Drag: end ────────────────────────────────────────────────────────────
  const handleUp = useCallback(() => {
    if (!dragState) return;
    const { sourceId, overTargetId } = dragState;

    if (overTargetId) {
      const exists = localMappings.some(
        (m) => m.sourceRegionId === sourceId && m.targetRegionId === overTargetId,
      );
      if (!exists) {
        const srcName = sourceTemplate?.regions.find((r) => r.id === sourceId)?.name ?? sourceId;
        const tgtName = targetRegions.find((r) => r.id === overTargetId)?.name ?? overTargetId;
        const nm: RegionMapping = {
          id:             uuidv4(),
          sourceRegionId: sourceId,
          targetRegionId: overTargetId,
          mappingType:    'one-to-one',
          transformations: [],
          label:          deriveMappingLabel(srcName, tgtName),
          source:         'manual',
        };
        commit([...localMappings, nm]);
      }
    }
    setDragState(null);
  }, [dragState, localMappings, sourceTemplate, targetRegions, commit]);

  // ── Arrow interaction ────────────────────────────────────────────────────
  const handleArrowClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  // ── Edit callbacks ───────────────────────────────────────────────────────
  const handleChange = useCallback((id: string, patch: Partial<RegionMapping>) => {
    const updated = localMappings.map((m) => (m.id === id ? { ...m, ...patch } : m));
    // Don't push to history for notes/label edits; only structural changes
    setLocalMappings(updated);
    onMappingsChange(updated);
    setSelectedId(id);
  }, [localMappings, onMappingsChange]);

  const handleDelete = useCallback((id: string) => {
    commit(localMappings.filter((m) => m.id !== id));
  }, [localMappings, commit]);

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedMapping = localMappings.find((m) => m.id === selectedId);
  const mappedSrcIds    = useMemo(() => new Set(localMappings.map((m) => m.sourceRegionId)), [localMappings]);
  const mappedTgtIds    = useMemo(() => new Set(localMappings.map((m) => m.targetRegionId)), [localMappings]);
  const srcRegions      = sourceTemplate?.regions ?? [];

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">

      {/* ── Global CSS for arrow animation ─────────────────────────────── */}
      <style>{`
        @keyframes lmcDashFlow { to { stroke-dashoffset: -24; } }
        .lmc-arrow-anim { animation: lmcDashFlow 0.9s linear infinite; }
      `}</style>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shrink-0 flex-wrap">
        {/* Title */}
        <Link2 size={14} className={figmaMode ? 'text-violet-500' : 'text-rose-500'} />
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 mr-0.5">
          Live Canvas
        </span>

        {/* Mapping count pill */}
        <span
          className={cn(
            'text-[10px] px-2 py-0.5 rounded-full font-semibold',
            figmaMode
              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
              : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
          )}
        >
          {localMappings.length} mapping{localMappings.length !== 1 ? 's' : ''}
        </span>

        {/* Legend */}
        <div className="flex items-center gap-3 ml-1 flex-wrap">
          {(Object.entries(MAPPING_PALETTE) as [MappingType, { stroke: string; label: string }][]).map(
            ([type, { stroke, label }]) => (
              <div key={type} className="flex items-center gap-1">
                <div className="w-5 h-0.5 rounded" style={{ backgroundColor: stroke }} />
                <span className="text-[9px] text-slate-400 dark:text-slate-500">{label}</span>
              </div>
            ),
          )}
          <div className="flex items-center gap-1">
            <div
              className="w-5 h-0.5 rounded"
              style={{
                background: `repeating-linear-gradient(to right, ${AI_STROKE} 0, ${AI_STROKE} 4px, transparent 4px, transparent 8px)`,
              }}
            />
            <span className="text-[9px] text-slate-400 dark:text-slate-500">AI</span>
          </div>
        </div>

        {/* Right-side actions */}
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <Undo2 size={13} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <Redo2 size={13} />
          </button>
          <button
            onClick={() => {
              if (!localMappings.length) return;
              if (!confirm('Clear all mappings?')) return;
              commit([]);
            }}
            disabled={!localMappings.length}
            title="Clear all"
            className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors"
          >
            <RotateCcw size={13} />
          </button>

          {onAutoMap && (
            <button
              onClick={onAutoMap}
              disabled={isAutoMapping || !sourceTemplate || targetRegions.length === 0}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-40',
                figmaMode
                  ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100'
                  : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100',
              )}
            >
              {isAutoMapping
                ? <Loader2 size={12} className="animate-spin" />
                : <Sparkles size={12} />}
              Auto-map
            </button>
          )}

          {onGenerate && (
            <button
              onClick={onGenerate}
              disabled={isGenerating || localMappings.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white disabled:opacity-40 transition-all"
            >
              {isGenerating
                ? <Loader2 size={12} className="animate-spin" />
                : <Play size={12} />}
              Generate
            </button>
          )}
        </div>
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!sourceTemplate && (
        <div className="flex flex-col items-center justify-center flex-1 text-center py-20">
          <Layers size={40} className="text-slate-300 dark:text-slate-600 mb-4" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No source template loaded</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            Select a Pega template in the <strong>Mapping View</strong> tab first
          </p>
        </div>
      )}

      {/* ── Canvas ──────────────────────────────────────────────────────── */}
      {sourceTemplate && (
        <div
          ref={containerRef}
          className="relative flex flex-1 overflow-hidden"
          style={{ cursor: resizeDragRef.current ? 'col-resize' : dragState ? 'crosshair' : 'default' }}
          onPointerMove={(e) => { handleResizeMove(e); handleMove(e); }}
          onPointerUp={(e) => { handleResizeEnd(); handleUp(); }}
          onPointerLeave={() => { resizeDragRef.current = null; if (dragState) setDragState(null); }}
          onClick={() => { if (!dragState) setSelectedId(null); }}
        >
          {/* ── SVG overlay ───────────────────────────────────────────── */}
          <svg
            className="absolute inset-0"
            width={svgSize.w}
            height={svgSize.h}
            style={{ zIndex: 5, overflow: 'visible' }}
          >
            <ArrowDefs />

            {/* Ghost arrow while dragging */}
            {dragState?.ghostPath && (
              <path
                d={dragState.ghostPath}
                fill="none"
                stroke={dragState.overTargetId ? MAPPING_PALETTE['one-to-one'].stroke : GHOST_STROKE}
                strokeWidth={2}
                strokeDasharray="7 5"
                opacity={0.85}
                markerEnd={`url(#${dragState.overTargetId ? 'mc-onetoone' : 'mc-ghost'})`}
                pointerEvents="none"
              />
            )}

            {/* Mapping arrows */}
            {arrows.map((a) => {
              const raw = localMappings.find((m) => m.id === a.mappingId)!;
              return (
                <g key={a.mappingId}>
                  {/* Wide invisible hit-area */}
                  <path
                    d={a.d}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={20}
                    style={{ pointerEvents: 'visibleStroke', cursor: 'pointer' }}
                    onClick={(e) => handleArrowClick(e, a.mappingId)}
                    onMouseEnter={() => setHoveredId(a.mappingId)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                  {/* Visible arrow */}
                  <path
                    d={a.d}
                    fill="none"
                    stroke={a.stroke}
                    strokeWidth={a.selected ? 2.8 : a.hovered ? 2.2 : 1.8}
                    strokeDasharray={a.aiSugg ? '9 5' : undefined}
                    opacity={a.selected ? 1 : 0.82}
                    markerEnd={markerFor(raw, a.selected, a.hovered)}
                    className={a.hovered && !a.selected ? 'lmc-arrow-anim' : undefined}
                    style={
                      a.hovered && !a.selected
                        ? { strokeDasharray: '8 5', strokeDashoffset: 0 }
                        : undefined
                    }
                    pointerEvents="none"
                  />
                  {/* Label badge on select / hover */}
                  {(a.selected || a.hovered) && (
                    <g pointerEvents="none">
                      <rect
                        x={a.midX - 22}
                        y={a.midY - 9}
                        width={44}
                        height={18}
                        rx={5}
                        fill={a.stroke}
                        opacity={0.95}
                      />
                      <text
                        x={a.midX}
                        y={a.midY + 4}
                        textAnchor="middle"
                        fill="white"
                        fontSize={8}
                        fontWeight="700"
                        fontFamily="system-ui, sans-serif"
                      >
                        {a.typeLabel}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* ── Left: Source panel ────────────────────────────────────── */}
          <div
            className="flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900"
            style={{ width: leftW, minWidth: MIN_PANEL, maxWidth: MAX_PANEL, zIndex: 10, position: 'relative', flexShrink: 0 }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Source · Pega Template</p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                  {sourceTemplate.name}
                </p>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 ml-2">
                {mappedSrcIds.size}/{srcRegions.length}
              </span>
            </div>

            {/* Region list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              {/* Instruction hint when no mappings yet */}
              {localMappings.length === 0 && !dragState && (
                <div className="flex items-start gap-2 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2.5">
                  <Info size={12} className="text-indigo-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
                    Drag the <strong>●</strong> port on the right edge of any region and drop on a target to create a mapping.
                  </p>
                </div>
              )}

              {srcRegions.map((region) => (
                <SourceCard
                  key={region.id}
                  region={region}
                  isMapped={mappedSrcIds.has(region.id)}
                  isDragSource={dragState?.sourceId === region.id}
                  isDragging={!!dragState}
                  elRef={(el) => {
                    if (el) sourceRefs.current.set(region.id, el);
                    else    sourceRefs.current.delete(region.id);
                  }}
                  onPortDown={(e) => handlePortDown(e, region.id)}
                />
              ))}
            </div>
          </div>

          {/* ── Left resize handle ───────────────────────────────────── */}
          <div
            className="group relative z-20 flex items-center justify-center shrink-0"
            style={{ width: 8, cursor: 'col-resize' }}
            onPointerDown={(e) => handleResizeStart(e, 'left')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
          >
            <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-700 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-600 transition-colors" />
            {/* Grip dots */}
            <div className="absolute flex flex-col gap-1 pointer-events-none">
              {[0,1,2].map((i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-500 transition-colors" />
              ))}
            </div>
          </div>

          {/* ── Center: dot-grid background ──────────────────────────── */}
          <div
            className="flex-1 overflow-hidden"
            style={{
              zIndex: 1,
              backgroundColor: '#f8f9fb',
              backgroundImage:
                'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
              backgroundSize: '22px 22px',
            }}
          >
            {/* Connecting hint */}
            {dragState && (
              <div className="flex items-center justify-center h-full pointer-events-none">
                <div className="bg-indigo-600/90 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg">
                  Drop on a target region →
                </div>
              </div>
            )}

            {/* Empty-map hint in center when nothing connected */}
            {!dragState && localMappings.length === 0 && targetRegions.length > 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 pointer-events-none opacity-50">
                <Zap size={32} className="text-slate-400" />
                <p className="text-xs text-slate-400 font-medium">No mappings yet</p>
              </div>
            )}
          </div>

          {/* ── Right resize handle ──────────────────────────────────── */}
          <div
            className="group relative z-20 flex items-center justify-center shrink-0"
            style={{ width: 8, cursor: 'col-resize' }}
            onPointerDown={(e) => handleResizeStart(e, 'right')}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeEnd}
          >
            <div className="w-0.5 h-full bg-slate-200 dark:bg-slate-700 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-600 transition-colors" />
            <div className="absolute flex flex-col gap-1 pointer-events-none">
              {[0,1,2].map((i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-500 transition-colors" />
              ))}
            </div>
          </div>

          {/* ── Right: Target panel ───────────────────────────────────── */}
          <div
            className="flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900"
            style={{ width: rightW, minWidth: MIN_PANEL, maxWidth: MAX_PANEL, zIndex: 10, position: 'relative', flexShrink: 0 }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {figmaMode ? 'Target · Figma Layout' : 'Target · Layout Regions'}
                </p>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate mt-0.5">
                  {targetRegions.length} region{targetRegions.length !== 1 ? 's' : ''}
                </p>
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 ml-2">
                {mappedTgtIds.size}/{targetRegions.length}
              </span>
            </div>

            {/* Region list or empty state */}
            {targetRegions.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-12 text-center px-4">
                <Layers size={28} className="text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {figmaMode ? 'Import a Figma layout first' : 'Add target regions in Mapping View'}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {/* Drop hint when dragging */}
                {dragState && (
                  <div className="flex items-start gap-2 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2">
                    <Info size={11} className="text-indigo-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-indigo-700 dark:text-indigo-300">
                      Hover a region below and release to connect.
                    </p>
                  </div>
                )}

                {targetRegions.map((region) => (
                  <TargetCard
                    key={region.id}
                    region={region as TargetLayoutRegion & { figmaPath?: string; figmaDepth?: number }}
                    isMapped={mappedTgtIds.has(region.id)}
                    isDragOver={dragState?.overTargetId === region.id}
                    figmaMode={figmaMode}
                    elRef={(el) => {
                      if (el) targetRefs.current.set(region.id, el);
                      else    targetRefs.current.delete(region.id);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Mapping edit panel (floating) ─────────────────────────── */}
          {selectedMapping && (() => {
            const srcName = srcRegions.find((r) => r.id === selectedMapping.sourceRegionId)?.name
              ?? selectedMapping.sourceRegionId;
            const tgtName = targetRegions.find((r) => r.id === selectedMapping.targetRegionId)?.name
              ?? selectedMapping.targetRegionId;
            return (
              <MappingEditPanel
                mapping={selectedMapping}
                srcName={srcName}
                tgtName={tgtName}
                onClose={() => setSelectedId(null)}
                onChange={(patch) => handleChange(selectedMapping.id, patch)}
                onDelete={() => handleDelete(selectedMapping.id)}
              />
            );
          })()}

          {/* ── Keyboard hint ─────────────────────────────────────────── */}
          {localMappings.length > 0 && !selectedId && !dragState && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
              <div className="bg-slate-800/80 dark:bg-black/70 text-white text-[10px] font-medium px-3 py-1.5 rounded-full shadow">
                Click arrow to edit · Delete to remove · Ctrl+Z undo
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
