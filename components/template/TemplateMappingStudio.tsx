'use client';

/**
 * TemplateMappingStudio
 * ─────────────────────
 * Three-panel visual transformation tool:
 *
 *   [Source Panel]  ←  SVG connectors  →  [Target Builder]
 *                       [Output Panel]
 *
 * Users:
 *   1. Select a Pega Constellation template (left)
 *   2. Define a target layout with named regions (right)
 *   3. Click-connect source → target regions (visual lines in center)
 *   4. Generate the target UIComponent JSON
 *   5. Optionally use AI Auto-map
 */

import React, {
  memo,
  useState,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
} from 'react';
import { v4 as uuidv4 } from 'uuid';
import {
  LayoutTemplate,
  ChevronRight,
  Plus,
  Trash2,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Copy,
  Download,
  ArrowRight,
  Unlink,
  RotateCcw,
  Play,
  FileJson,
  Settings,
  ChevronDown,
  ChevronUp,
  Zap,
  Eye,
  GripVertical,
  X,
  Layers,
  Box,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import {
  PEGA_TEMPLATES,
  PEGA_TEMPLATE_MAP,
  TEMPLATE_ACCENT_CLASSES,
  type PegaTemplate,
  type PegaTemplateRegion,
} from '@/config/pegaTemplates';
import type {
  RegionMapping,
  TargetLayoutRegion,
  TargetLayout,
  MappingType,
  TargetLayoutType,
  RegionMappingSuggestion,
} from '@/models/RegionMapping';
import {
  validateRegionMappings,
  deriveMappingLabel,
} from '@/models/RegionMapping';
import {
  transformUsingRegionMapping,
  type RegionMappingTransformResult,
} from '@/services/schemaTransformer';
import {
  suggestRegionMappings,
  optimizeLayoutMapping,
  mapPegaToFigma,
  autoMapPegaToFigma,
  autoConnectRegions,
} from '@/services/aiService';
import type { FigmaParseResult } from '@/services/figmaParser';
import {
  transformFigmaToTargetLayout,
} from '@/services/figmaLayoutTransformer';
import type { FigmaTargetRegion } from '@/services/figmaLayoutTransformer';
import type { FigmaRegionMapping } from '@/models/RegionMapping';
import {
  transformUsingFigmaLayout,
  type FigmaTransformResult,
} from '@/services/schemaTransformer';
import { FigmaTargetPanel } from './FigmaTargetPanel';
import { FigmaImportDialog } from './FigmaImportDialog';
import { LiveMappingCanvas } from '@/components/mapping/LiveMappingCanvas';

// ─── Types ────────────────────────────────────────────────────────────────────

type StudioTab = 'mapping' | 'canvas' | 'output' | 'validation' | 'log';

interface ConnectorPath {
  id: string;
  d: string;
  color: string;
  selected: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LAYOUT_TYPE_OPTIONS: Array<{ value: TargetLayoutType; label: string; description: string }> = [
  { value: 'flex',     label: 'Flex (Stack)',   description: 'Single-column flexible stack' },
  { value: 'grid',     label: 'Grid',           description: 'Multi-column CSS grid' },
  { value: 'tabs',     label: 'Tabs',           description: 'Tabbed navigation container' },
  { value: 'sections', label: 'Sections',       description: 'Collapsible accordion sections' },
  { value: 'inline',   label: 'Inline',         description: 'Horizontal inline layout' },
];

const MAPPING_TYPE_OPTIONS: Array<{ value: MappingType; label: string }> = [
  { value: 'one-to-one',   label: '1 → 1' },
  { value: 'one-to-many',  label: '1 → N' },
  { value: 'many-to-one',  label: 'N → 1' },
];

const REGION_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16',
];

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'info';
type ToastState = { type: ToastType; msg: string } | null;

function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const show = useCallback((type: ToastType, msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);
  const ToastEl = toast ? (
    <div className={cn(
      'fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-xl text-sm font-medium animate-in slide-in-from-bottom-2 duration-200',
      toast.type === 'success' ? 'bg-green-600 text-white' :
      toast.type === 'error'   ? 'bg-red-600 text-white'   :
                                 'bg-indigo-600 text-white'
    )}>
      {toast.type === 'success' ? <CheckCircle2 size={14} /> :
       toast.type === 'error'   ? <AlertCircle size={14} />  : <Info size={14} />}
      {toast.msg}
    </div>
  ) : null;
  return { show, ToastEl };
}

// ─── Source Panel ─────────────────────────────────────────────────────────────

interface SourcePanelProps {
  selectedTemplate: PegaTemplate | null;
  onSelectTemplate: (t: PegaTemplate) => void;
  connectingFromId: string | null;
  onStartConnect: (regionId: string) => void;
  onCancelConnect: () => void;
  mappings: RegionMapping[];
  sourceRegionRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

const SourcePanel = memo(function SourcePanel({
  selectedTemplate,
  onSelectTemplate,
  connectingFromId,
  onStartConnect,
  onCancelConnect,
  mappings,
  sourceRegionRefs,
}: SourcePanelProps) {
  const [showPicker, setShowPicker] = useState(!selectedTemplate);

  const isMapped = (regionId: string) =>
    mappings.some((m) => m.sourceRegionId === regionId);

  return (
    <div className="flex flex-col h-full overflow-hidden border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" style={{ width: 272 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Source</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Pega Template</p>
        </div>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
        >
          {selectedTemplate ? 'Switch' : 'Pick'} ↓
        </button>
      </div>

      {/* Template Picker */}
      {showPicker && (
        <div className="p-3 border-b border-slate-200 dark:border-slate-700 space-y-1.5 bg-slate-50 dark:bg-slate-800/30">
          {PEGA_TEMPLATES.map((t) => {
            const acc = TEMPLATE_ACCENT_CLASSES[t.accentColor];
            return (
              <button
                key={t.id}
                onClick={() => { onSelectTemplate(t); setShowPicker(false); }}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg border text-xs transition-all',
                  selectedTemplate?.id === t.id
                    ? `${acc.bg} ${acc.border} ${acc.text} font-semibold`
                    : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/20'
                )}
              >
                <div className="font-semibold">{t.name}</div>
                <div className="text-[10px] opacity-70 mt-0.5 leading-tight">{t.description.substring(0, 60)}…</div>
              </button>
            );
          })}
        </div>
      )}

      {/* Region List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {selectedTemplate ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn('text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md', TEMPLATE_ACCENT_CLASSES[selectedTemplate.accentColor].badge)}>
                {selectedTemplate.name}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">{selectedTemplate.regions.length} regions</span>
            </div>
            {selectedTemplate.regions.map((region) => {
              const mapped = isMapped(region.id);
              const connecting = connectingFromId === region.id;
              return (
                <div
                  key={region.id}
                  ref={(el) => { if (el) sourceRegionRefs.current.set(region.id, el); }}
                  className={cn(
                    'group relative rounded-lg border-2 p-2.5 transition-all cursor-pointer select-none',
                    connecting
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 shadow-md ring-2 ring-indigo-300 dark:ring-indigo-700'
                      : mapped
                      ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'
                  )}
                  onClick={() => connecting ? onCancelConnect() : onStartConnect(region.id)}
                >
                  {/* Color swatch */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
                    style={{ backgroundColor: region.color }}
                  />
                  <div className="pl-1.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                        {region.name}
                      </span>
                      {mapped && <CheckCircle2 size={12} className="text-green-500 shrink-0" />}
                      {connecting && <span className="text-[10px] font-bold text-indigo-600">Connecting…</span>}
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight block">
                      {region.type} · {region.pegaLayout ?? 'stacked'}
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight block truncate mt-0.5">
                      {region.description}
                    </span>
                  </div>
                  {!connecting && !mapped && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-white/90 dark:bg-slate-900/90 px-2 py-0.5 rounded-full shadow">
                        Click to connect →
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <LayoutTemplate size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Choose a template above</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">to see its source regions</p>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Target Builder Panel ─────────────────────────────────────────────────────

interface TargetBuilderPanelProps {
  targetRegions: TargetLayoutRegion[];
  onAddRegion: (name: string, layout: TargetLayoutType) => void;
  onRemoveRegion: (id: string) => void;
  onUpdateRegion: (id: string, patch: Partial<TargetLayoutRegion>) => void;
  connectingFromId: string | null;
  onCompleteConnect: (targetRegionId: string) => void;
  mappings: RegionMapping[];
  targetRegionRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

const TargetBuilderPanel = memo(function TargetBuilderPanel({
  targetRegions,
  onAddRegion,
  onRemoveRegion,
  onUpdateRegion,
  connectingFromId,
  onCompleteConnect,
  mappings,
  targetRegionRefs,
}: TargetBuilderPanelProps) {
  const [newName, setNewName] = useState('');
  const [newLayout, setNewLayout] = useState<TargetLayoutType>('flex');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const isMapped = (id: string) => mappings.some((m) => m.targetRegionId === id);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddRegion(trimmed, newLayout);
    setNewName('');
  };

  return (
    <div className="flex flex-col h-full overflow-hidden border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900" style={{ width: 272 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Target</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">Your Layout</p>
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">{targetRegions.length} region(s)</span>
      </div>

      {/* Region List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {connectingFromId && (
          <div className="rounded-lg border-2 border-dashed border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/20 p-2 text-center mb-2">
            <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
              ← Click a region to complete connection
            </p>
          </div>
        )}

        {targetRegions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Plus size={28} className="text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No target regions yet</p>
            <p className="text-xs text-slate-400 mt-1">Add regions below to build your layout</p>
          </div>
        ) : (
          targetRegions.map((region) => {
            const mapped = isMapped(region.id);
            const isDropTarget = !!connectingFromId;
            return (
              <div
                key={region.id}
                ref={(el) => { if (el) targetRegionRefs.current.set(region.id, el); }}
                className={cn(
                  'group relative rounded-lg border-2 p-2.5 transition-all select-none',
                  isDropTarget
                    ? 'cursor-pointer border-indigo-300 dark:border-indigo-600 hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 hover:shadow-md'
                    : mapped
                    ? 'border-green-400 dark:border-green-600 bg-green-50 dark:bg-green-950/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                )}
                onClick={() => isDropTarget && onCompleteConnect(region.id)}
              >
                {/* Color strip */}
                <div
                  className="absolute right-0 top-0 bottom-0 w-1 rounded-r-lg"
                  style={{ backgroundColor: region.color }}
                />
                <div className="pr-1.5">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {/* Inline name editor */}
                    {editingId === region.id ? (
                      <input
                        autoFocus
                        className="flex-1 text-xs font-semibold bg-transparent border-b border-indigo-300 outline-none text-slate-800 dark:text-slate-100"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => { onUpdateRegion(region.id, { name: editName || region.name }); setEditingId(null); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateRegion(region.id, { name: editName || region.name }); setEditingId(null); } }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        className="flex-1 text-xs font-semibold text-slate-800 dark:text-slate-100 truncate cursor-text"
                        onDoubleClick={(e) => { e.stopPropagation(); setEditingId(region.id); setEditName(region.name); }}
                      >
                        {region.name}
                      </span>
                    )}
                    {mapped && <CheckCircle2 size={12} className="text-green-500 shrink-0" />}
                    {!isDropTarget && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveRegion(region.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-red-500 transition-all"
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  {/* Layout type selector */}
                  <select
                    className="mt-1 w-full text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-600 dark:text-slate-300 cursor-pointer"
                    value={region.layout}
                    onChange={(e) => onUpdateRegion(region.id, { layout: e.target.value as TargetLayoutType })}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {LAYOUT_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {/* Columns input for grid */}
                  {(region.layout === 'grid' || region.layout === 'flex') && (
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400">cols:</span>
                      <input
                        type="number"
                        min={1} max={4}
                        className="w-10 text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-slate-600 dark:text-slate-300"
                        value={region.columns ?? 1}
                        onChange={(e) => onUpdateRegion(region.id, { columns: Number(e.target.value) })}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  )}
                </div>
                {isDropTarget && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-white/90 dark:bg-slate-900/90 px-2 py-0.5 rounded-full shadow">
                      ← Drop here
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Region */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
        <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Add Region</p>
        <input
          type="text"
          className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-2"
          placeholder="Region name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
        />
        <div className="flex gap-1.5">
          <select
            className="flex-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-700 dark:text-slate-300"
            value={newLayout}
            onChange={(e) => setNewLayout(e.target.value as TargetLayoutType)}
          >
            {LAYOUT_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus size={12} /> Add
          </button>
        </div>
      </div>
    </div>
  );
});

// ─── Center: Connector Canvas ─────────────────────────────────────────────────

interface ConnectorCanvasProps {
  mappings: RegionMapping[];
  selectedMappingId: string | null;
  onSelectMapping: (id: string | null) => void;
  onDeleteMapping: (id: string) => void;
  onChangeMappingType: (id: string, type: MappingType) => void;
  connectingFromId: string | null;
  sourceTemplate: PegaTemplate | null;
  targetRegions: TargetLayoutRegion[];
  connectorPaths: ConnectorPath[];
  containerWidth: number;
  containerHeight: number;
}

const ConnectorCanvas = memo(function ConnectorCanvas({
  mappings,
  selectedMappingId,
  onSelectMapping,
  onDeleteMapping,
  onChangeMappingType,
  connectingFromId,
  sourceTemplate,
  targetRegions,
  connectorPaths,
  containerWidth,
  containerHeight,
}: ConnectorCanvasProps) {
  const sourceName = (id: string) =>
    sourceTemplate?.regions.find((r) => r.id === id)?.name ?? id;
  const targetName = (id: string) =>
    targetRegions.find((r) => r.id === id)?.name ?? id;
  const sourceColor = (id: string) =>
    sourceTemplate?.regions.find((r) => r.id === id)?.color ?? '#6366f1';

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-900/50">
      {/* SVG connector layer */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={containerWidth}
        height={containerHeight}
        style={{ zIndex: 1 }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#6366f1" opacity="0.7" />
          </marker>
          <marker id="arrowhead-selected" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#4f46e5" />
          </marker>
        </defs>
        {connectorPaths.map((cp) => (
          <path
            key={cp.id}
            d={cp.d}
            fill="none"
            stroke={cp.selected ? '#4f46e5' : cp.color}
            strokeWidth={cp.selected ? 2.5 : 1.8}
            strokeDasharray={cp.selected ? undefined : '6 3'}
            opacity={cp.selected ? 1 : 0.65}
            markerEnd={cp.selected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)'}
          />
        ))}
      </svg>

      {/* Mapping cards */}
      <div className="relative z-10 flex-1 overflow-y-auto p-4 space-y-2">
        {connectingFromId && (
          <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-indigo-400 dark:border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/20 mb-3">
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: sourceColor(connectingFromId) }}
            />
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              Connecting: <em>{sourceName(connectingFromId)}</em> → select a target region
            </span>
            <kbd className="text-[10px] bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded">ESC</kbd>
          </div>
        )}

        {mappings.length === 0 && !connectingFromId && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ArrowRight size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No mappings yet</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Click a source region, then click a target region to connect them
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
              or use <span className="font-semibold text-indigo-500">Auto-map</span> to let AI suggest connections
            </p>
          </div>
        )}

        {mappings.map((m) => {
          const selected = selectedMappingId === m.id;
          const color = sourceColor(m.sourceRegionId);
          return (
            <div
              key={m.id}
              onClick={() => onSelectMapping(selected ? null : m.id)}
              className={cn(
                'group rounded-xl border-2 p-3 cursor-pointer transition-all',
                selected
                  ? 'border-indigo-500 bg-white dark:bg-slate-800 shadow-md'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm'
              )}
            >
              <div className="flex items-center gap-2">
                {/* Source badge */}
                <span
                  className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full text-white truncate max-w-[90px]"
                  style={{ backgroundColor: color }}
                  title={sourceName(m.sourceRegionId)}
                >
                  {sourceName(m.sourceRegionId)}
                </span>

                {/* Arrow */}
                <ArrowRight size={12} className="text-slate-400 shrink-0" />

                {/* Target badge */}
                <span
                  className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 truncate max-w-[90px]"
                  title={targetName(m.targetRegionId)}
                >
                  {targetName(m.targetRegionId)}
                </span>

                <div className="ml-auto flex items-center gap-1.5">
                  {/* Type selector */}
                  <select
                    className="text-[10px] bg-transparent border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5 text-slate-500 dark:text-slate-400"
                    value={m.mappingType}
                    onChange={(e) => onChangeMappingType(m.id, e.target.value as MappingType)}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {MAPPING_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {/* AI badge */}
                  {m.source === 'ai-suggested' && (
                    <span className="text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-medium">
                      AI
                    </span>
                  )}
                  {/* Delete */}
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteMapping(m.id); }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-red-500 transition-all"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* Notes / label */}
              {m.label && (
                <p className="text-[10px] text-slate-400 mt-1 truncate">{m.label}</p>
              )}

              {/* Confidence */}
              {m.source === 'ai-suggested' && m.confidence !== undefined && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500"
                      style={{ width: `${Math.round(m.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{Math.round(m.confidence * 100)}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ─── Output Panel ─────────────────────────────────────────────────────────────

interface OutputPanelProps {
  result: RegionMappingTransformResult | null;
  isGenerating: boolean;
  onCopy: (text: string) => void;
  onDownload: (text: string, filename: string) => void;
}

const OutputPanel = memo(function OutputPanel({
  result,
  isGenerating,
  onCopy,
  onDownload,
}: OutputPanelProps) {
  const [activeView, setActiveView] = useState<'target' | 'intermediate' | 'log'>('target');

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <Loader2 size={28} className="text-indigo-500 animate-spin mb-3" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Generating output…</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <FileJson size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No output yet</p>
        <p className="text-xs text-slate-400 mt-1">Click "Generate Output" to transform your mapping</p>
      </div>
    );
  }

  const targetJson = JSON.stringify(result.targetComponents, null, 2);
  const intermediateJson = JSON.stringify(result.intermediateSchema, null, 2);
  const logText = result.log.join('\n');

  const tabs: Array<{ key: typeof activeView; label: string; count?: number }> = [
    { key: 'target',       label: 'Target JSON',     count: result.targetComponents.length },
    { key: 'intermediate', label: 'Intermediate',    count: result.intermediateSchema.length },
    { key: 'log',          label: 'Transform Log',   count: result.log.length },
  ];

  const currentContent = activeView === 'target' ? targetJson : activeView === 'intermediate' ? intermediateJson : logText;
  const filename = activeView === 'target' ? 'target-output.json' : activeView === 'intermediate' ? 'intermediate-schema.json' : 'transform-log.txt';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tabs + Actions */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveView(t.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all',
                activeView === t.key
                  ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-1 rounded text-[10px]">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {result.unmappedSourceRegionIds.length > 0 && (
            <span className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
              {result.unmappedSourceRegionIds.length} unmapped
            </span>
          )}
          {result.emptyTargetRegionIds.length > 0 && (
            <span className="text-[10px] text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded-full">
              {result.emptyTargetRegionIds.length} empty targets
            </span>
          )}
          <button
            onClick={() => onCopy(currentContent)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          >
            <Copy size={12} /> Copy
          </button>
          <button
            onClick={() => onDownload(currentContent, filename)}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
          >
            <Download size={12} /> Export
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <pre className="text-xs text-slate-700 dark:text-slate-200 bg-slate-950/5 dark:bg-slate-950/30 p-4 h-full font-mono leading-relaxed whitespace-pre-wrap break-all">
          {currentContent}
        </pre>
      </div>
    </div>
  );
});

// ─── Validation Panel ─────────────────────────────────────────────────────────

interface ValidationPanelProps {
  selectedTemplate: PegaTemplate | null;
  targetRegions: TargetLayoutRegion[];
  mappings: RegionMapping[];
}

const ValidationPanel = memo(function ValidationPanel({
  selectedTemplate,
  targetRegions,
  mappings,
}: ValidationPanelProps) {
  const sourceIds = selectedTemplate?.regions.map((r) => r.id) ?? [];
  const targetIds = targetRegions.map((r) => r.id);
  const summary = validateRegionMappings(mappings, sourceIds, targetIds);

  const severityIcon = (s: string) =>
    s === 'error' ? <AlertCircle size={12} className="text-red-500" /> :
    s === 'warning' ? <AlertCircle size={12} className="text-amber-500" /> :
    <Info size={12} className="text-blue-500" />;

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Source Coverage</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {summary.mappedSourceRegions}
            <span className="text-sm text-slate-400">/{summary.totalSourceRegions}</span>
          </p>
          <div className="mt-1.5 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{ width: `${summary.totalSourceRegions ? (summary.mappedSourceRegions / summary.totalSourceRegions) * 100 : 0}%` }}
            />
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Target Coverage</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
            {summary.mappedTargetRegions}
            <span className="text-sm text-slate-400">/{summary.totalTargetRegions}</span>
          </p>
          <div className="mt-1.5 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${summary.totalTargetRegions ? (summary.mappedTargetRegions / summary.totalTargetRegions) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status badge */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium',
        summary.valid
          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
      )}>
        {summary.valid
          ? <CheckCircle2 size={16} />
          : <AlertCircle size={16} />}
        {summary.valid ? 'Mappings are valid — ready to generate' : 'Mapping has errors — resolve before generating'}
      </div>

      {/* Issue list */}
      {summary.issues.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            Issues ({summary.issues.length})
          </p>
          {summary.issues.map((issue, i) => (
            <div
              key={i}
              className={cn(
                'flex items-start gap-2 px-3 py-2 rounded-lg text-xs',
                issue.severity === 'error'   ? 'bg-red-50    dark:bg-red-900/20    text-red-700    dark:text-red-400' :
                issue.severity === 'warning' ? 'bg-amber-50  dark:bg-amber-900/20  text-amber-700  dark:text-amber-400' :
                                               'bg-blue-50   dark:bg-blue-900/20   text-blue-700   dark:text-blue-400'
              )}
            >
              {severityIcon(issue.severity)}
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      {summary.issues.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CheckCircle2 size={14} className="text-green-500" />
          No issues found
        </div>
      )}
    </div>
  );
});

// ─── Main Studio ──────────────────────────────────────────────────────────────

export const TemplateMappingStudio = memo(function TemplateMappingStudio() {
  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<PegaTemplate | null>(
    PEGA_TEMPLATES[0] ?? null
  );
  const [targetRegions, setTargetRegions] = useState<TargetLayoutRegion[]>([
    { id: uuidv4(), name: 'Main Content', layout: 'flex',   columns: 1, color: '#6366f1', order: 0, description: '' },
    { id: uuidv4(), name: 'Sidebar',      layout: 'flex',   columns: 1, color: '#10b981', order: 1, description: '' },
    { id: uuidv4(), name: 'Actions',      layout: 'inline', columns: 1, color: '#f59e0b', order: 2, description: '' },
  ]);
  const [mappings, setMappings] = useState<RegionMapping[]>([]);
  const [connectingFromId, setConnectingFromId] = useState<string | null>(null);
  const [selectedMappingId, setSelectedMappingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<StudioTab>('mapping');
  const [outputPanelOpen, setOutputPanelOpen] = useState(false);
  const [transformResult, setTransformResult] = useState<RegionMappingTransformResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAutoMapping, setIsAutoMapping] = useState(false);

  // ── Figma Mode State ───────────────────────────────────────────────────────
  const [figmaMode, setFigmaMode] = useState(false);
  const [showFigmaDialog, setShowFigmaDialog] = useState(false);
  const [figmaParseResult, setFigmaParseResult] = useState<FigmaParseResult | null>(null);
  const [figmaSourceName, setFigmaSourceName] = useState<string>('');
  const [figmaRegions, setFigmaRegions] = useState<FigmaTargetRegion[]>([]);
  // Figma mode uses FigmaRegionMapping (extends RegionMapping) so the same
  // connector + output machinery can operate on it without changes.
  const [figmaMappings, setFigmaMappings] = useState<FigmaRegionMapping[]>([]);
  const [figmaTransformResult, setFigmaTransformResult] = useState<FigmaTransformResult | null>(null);
  const [isFigmaAutoMapping, setIsFigmaAutoMapping] = useState(false);

  // SVG connector state
  const containerRef = useRef<HTMLDivElement>(null);
  const sourceRegionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const targetRegionRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [connectorPaths, setConnectorPaths] = useState<ConnectorPath[]>([]);
  const [svgSize, setSvgSize] = useState({ w: 0, h: 0 });

  const { show: showToast, ToastEl } = useToast();

  // ── Keyboard: ESC cancels connect ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConnectingFromId(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Recalculate SVG connector paths ───────────────────────────────────────
  const recalcConnectors = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    setSvgSize({ w: cRect.width, h: cRect.height });

    // Use figma mappings or standard mappings depending on current mode
    const currentMappings = figmaMode ? figmaMappings : mappings;

    const paths: ConnectorPath[] = [];
    for (const m of currentMappings) {
      const srcEl = sourceRegionRefs.current.get(m.sourceRegionId);
      const tgtEl = targetRegionRefs.current.get(m.targetRegionId);
      if (!srcEl || !tgtEl) continue;

      const sRect = srcEl.getBoundingClientRect();
      const tRect = tgtEl.getBoundingClientRect();

      const x1 = sRect.right  - cRect.left;
      const y1 = sRect.top    + sRect.height / 2 - cRect.top;
      const x2 = tRect.left   - cRect.left;
      const y2 = tRect.top    + tRect.height / 2 - cRect.top;

      const dx = Math.abs(x2 - x1) * 0.5;
      const d = `M ${x1} ${y1} C ${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;

      const color = selectedTemplate?.regions.find((r) => r.id === m.sourceRegionId)?.color ?? '#6366f1';
      paths.push({ id: m.id, d, color, selected: m.id === selectedMappingId });
    }
    setConnectorPaths(paths);
  }, [figmaMode, figmaMappings, mappings, selectedMappingId, selectedTemplate]);

  useLayoutEffect(() => {
    recalcConnectors();
  }, [recalcConnectors, figmaMode ? figmaRegions : targetRegions]);

  // Recalc on resize
  useEffect(() => {
    const ro = new ResizeObserver(() => recalcConnectors());
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [recalcConnectors]);

  // ── Mapping CRUD ──────────────────────────────────────────────────────────
  const handleStartConnect = useCallback((regionId: string) => {
    setConnectingFromId(regionId);
    setSelectedMappingId(null);
  }, []);

  const handleCompleteConnect = useCallback((targetRegionId: string) => {
    if (!connectingFromId) return;
    const sourceRegionId = connectingFromId;

    // Prevent duplicate one-to-one
    const existing = mappings.find(
      (m) => m.sourceRegionId === sourceRegionId && m.targetRegionId === targetRegionId
    );
    if (existing) {
      showToast('info', 'This connection already exists.');
      setConnectingFromId(null);
      return;
    }

    const sourceName = selectedTemplate?.regions.find((r) => r.id === sourceRegionId)?.name ?? sourceRegionId;
    const targetName = targetRegions.find((r) => r.id === targetRegionId)?.name ?? targetRegionId;

    const newMapping: RegionMapping = {
      id: uuidv4(),
      sourceRegionId,
      targetRegionId,
      mappingType: 'one-to-one',
      transformations: [],
      label: deriveMappingLabel(sourceName, targetName),
      source: 'manual',
    };

    setMappings((prev) => [...prev, newMapping]);
    setConnectingFromId(null);
    setTransformResult(null);
    showToast('success', `Connected: ${sourceName} → ${targetName}`);
  }, [connectingFromId, mappings, selectedTemplate, targetRegions, showToast]);

  const handleDeleteMapping = useCallback((id: string) => {
    setMappings((prev) => prev.filter((m) => m.id !== id));
    if (selectedMappingId === id) setSelectedMappingId(null);
    setTransformResult(null);
  }, [selectedMappingId]);

  const handleChangeMappingType = useCallback((id: string, type: MappingType) => {
    setMappings((prev) =>
      prev.map((m) => m.id === id ? { ...m, mappingType: type } : m)
    );
  }, []);

  // ── Target Region CRUD ────────────────────────────────────────────────────
  const handleAddTargetRegion = useCallback((name: string, layout: TargetLayoutType) => {
    const colorIdx = targetRegions.length % REGION_COLORS.length;
    const region: TargetLayoutRegion = {
      id: uuidv4(),
      name,
      layout,
      columns: layout === 'grid' ? 2 : 1,
      color: REGION_COLORS[colorIdx],
      order: targetRegions.length,
      description: '',
    };
    setTargetRegions((prev) => [...prev, region]);
    setTransformResult(null);
  }, [targetRegions.length]);

  const handleRemoveTargetRegion = useCallback((id: string) => {
    setTargetRegions((prev) => prev.filter((r) => r.id !== id));
    setMappings((prev) => prev.filter((m) => m.targetRegionId !== id));
    setTransformResult(null);
  }, []);

  const handleUpdateTargetRegion = useCallback((id: string, patch: Partial<TargetLayoutRegion>) => {
    setTargetRegions((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  }, []);

  // ── Template selection (resets everything) ────────────────────────────────
  const handleSelectTemplate = useCallback((t: PegaTemplate) => {
    setSelectedTemplate(t);
    setMappings([]);
    setConnectingFromId(null);
    setSelectedMappingId(null);
    setTransformResult(null);
    sourceRegionRefs.current.clear();
    showToast('info', `Template "${t.name}" loaded. Start connecting regions.`);
  }, [showToast]);

  // ── Clear All ─────────────────────────────────────────────────────────────
  const handleClearAll = useCallback(() => {
    const count = figmaMode ? figmaMappings.length : mappings.length;
    if (count === 0) return;
    if (!confirm('Clear all mappings?')) return;
    if (figmaMode) {
      setFigmaMappings([]);
      setFigmaTransformResult(null);
    } else {
      setMappings([]);
      setTransformResult(null);
    }
    setSelectedMappingId(null);
  }, [mappings.length, figmaMappings.length, figmaMode]);

  // ── Figma Import ──────────────────────────────────────────────────────────
  const handleFigmaImport = useCallback((result: FigmaParseResult, name: string) => {
    setFigmaParseResult(result);
    setFigmaSourceName(name);
    const { regions } = transformFigmaToTargetLayout(result.nodes, 2, false);
    setFigmaRegions(regions);
    setFigmaMappings([]);
    setFigmaTransformResult(null);
    setFigmaMode(true);
    sourceRegionRefs.current.clear();
    targetRegionRefs.current.clear();
    showToast('success', `Figma layout "${name}" imported — ${regions.length} target region(s) created.`);
  }, [showToast]);

  // ── Figma node selected as connection target ──────────────────────────────
  const handleFigmaNodeSelect = useCallback((region: FigmaTargetRegion) => {
    if (!connectingFromId) return;
    const sourceRegionId = connectingFromId;

    // Prevent duplicate
    const existing = figmaMappings.find(
      (m) => m.sourceRegionId === sourceRegionId && m.targetRegionId === region.id
    );
    if (existing) {
      showToast('info', 'This connection already exists.');
      setConnectingFromId(null);
      return;
    }

    const srcName = selectedTemplate?.regions.find((r) => r.id === sourceRegionId)?.name ?? sourceRegionId;

    const newMapping: FigmaRegionMapping = {
      id: uuidv4(),
      sourceRegionId,
      targetRegionId: region.id,
      targetFigmaNodeId: region.figmaNodeId,
      targetFigmaNodeName: region.name,
      targetFigmaNodePath: region.figmaPath,
      mappingType: 'one-to-one',
      transformations: [],
      label: deriveMappingLabel(srcName, region.name),
      source: 'manual',
    };

    setFigmaMappings((prev) => [...prev, newMapping]);
    setConnectingFromId(null);
    setFigmaTransformResult(null);
    showToast('success', `Connected: ${srcName} → ${region.name} (Figma)`);
  }, [connectingFromId, figmaMappings, selectedTemplate, showToast]);

  // ── Figma Auto-Map (AI) ───────────────────────────────────────────────────
  const handleFigmaAutoMap = useCallback(async () => {
    if (!selectedTemplate || !figmaParseResult) {
      showToast('error', 'Select a source template and import a Figma layout first.');
      return;
    }
    setIsFigmaAutoMapping(true);
    try {
      // Build a map from figmaNodeId → targetRegionId
      const figmaNodeToRegionId = new Map(
        figmaRegions.map((r) => [r.figmaNodeId, r.id])
      );

      const newMappings = await autoMapPegaToFigma(
        selectedTemplate.regions.map((r) => ({ id: r.id, name: r.name, type: r.type, description: r.description })),
        figmaParseResult.nodes,
        figmaNodeToRegionId
      );

      setFigmaMappings(newMappings);
      setFigmaTransformResult(null);
      showToast(
        'success',
        `AI (mock) suggested ${newMappings.length} Figma mapping(s). Review and adjust.`
      );
    } catch (e) {
      showToast('error', `Figma auto-map failed: ${(e as Error).message}`);
    } finally {
      setIsFigmaAutoMapping(false);
    }
  }, [selectedTemplate, figmaParseResult, figmaRegions, showToast]);

  // ── Figma Generate ────────────────────────────────────────────────────────
  const handleFigmaGenerate = useCallback(async () => {
    if (!selectedTemplate) {
      showToast('error', 'Select a source template first.');
      return;
    }
    if (figmaMappings.length === 0) {
      showToast('error', 'Add at least one Figma mapping before generating.');
      return;
    }
    setIsGenerating(true);
    setActiveTab('output');
    try {
      const result = transformUsingFigmaLayout(
        selectedTemplate.sampleJson,
        figmaMappings,
        figmaRegions,
        selectedTemplate.id
      );
      setFigmaTransformResult(result);
      showToast('success', `Generated ${result.targetComponents.length} component(s) from Figma layout.`);
    } catch (e) {
      showToast('error', `Figma generation failed: ${(e as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [selectedTemplate, figmaMappings, figmaRegions, showToast]);

  // ── Toggle Figma Mode ─────────────────────────────────────────────────────
  const handleToggleFigmaMode = useCallback(() => {
    if (!figmaMode && !figmaParseResult) {
      // Opening figma mode without an import — show the dialog
      setShowFigmaDialog(true);
      return;
    }
    setFigmaMode((prev) => !prev);
    setConnectingFromId(null);
    setSelectedMappingId(null);
    sourceRegionRefs.current.clear();
    targetRegionRefs.current.clear();
  }, [figmaMode, figmaParseResult]);

  // In figma mode, expose figma mappings as the "active" mapping set
  // so existing connector/output components can reuse them transparently.
  const activeMappings: RegionMapping[] = figmaMode ? figmaMappings : mappings;
  const activeTargetRegions: TargetLayoutRegion[] = figmaMode ? figmaRegions : targetRegions;
  const activeTransformResult = figmaMode ? figmaTransformResult : transformResult;
  const activeMapCount = activeMappings.length;

  // ── AI Auto-Map ───────────────────────────────────────────────────────────
  const handleAutoMap = useCallback(async () => {
    if (figmaMode) { await handleFigmaAutoMap(); return; }
    if (!selectedTemplate) {
      showToast('error', 'Select a source template first.');
      return;
    }
    if (targetRegions.length === 0) {
      showToast('error', 'Add target regions before auto-mapping.');
      return;
    }
    setIsAutoMapping(true);
    try {
      const result = await suggestRegionMappings(
        selectedTemplate.regions.map((r) => ({ id: r.id, name: r.name, type: r.type, description: r.description })),
        targetRegions.map((r) => ({ id: r.id, name: r.name, layout: r.layout }))
      );

      const newMappings: RegionMapping[] = result.suggestions.map((s: RegionMappingSuggestion) => {
        const srcName = selectedTemplate.regions.find((r) => r.id === s.sourceRegionId)?.name ?? s.sourceRegionId;
        const tgtName = targetRegions.find((r) => r.id === s.targetRegionId)?.name ?? s.targetRegionId;
        return {
          id: uuidv4(),
          sourceRegionId: s.sourceRegionId,
          targetRegionId: s.targetRegionId,
          mappingType: s.mappingType,
          transformations: [],
          label: deriveMappingLabel(srcName, tgtName),
          source: 'ai-suggested',
          confidence: s.confidence,
        };
      });

      setMappings(newMappings);
      setTransformResult(null);
      showToast(
        'success',
        result.mock
          ? `AI (mock) suggested ${newMappings.length} mappings. Review and adjust.`
          : `AI suggested ${newMappings.length} mappings.`
      );
    } catch (e) {
      showToast('error', `Auto-map failed: ${(e as Error).message}`);
    } finally {
      setIsAutoMapping(false);
    }
  }, [figmaMode, handleFigmaAutoMap, selectedTemplate, targetRegions, showToast]);

  // ── Generate Output ───────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (figmaMode) { await handleFigmaGenerate(); return; }
    if (!selectedTemplate) {
      showToast('error', 'Select a source template first.');
      return;
    }
    if (mappings.length === 0) {
      showToast('error', 'Add at least one mapping before generating.');
      return;
    }
    setIsGenerating(true);
    setOutputPanelOpen(true);
    setActiveTab('output');
    try {
      // Run synchronously (CPU-bound but fast enough for mock data)
      const result = transformUsingRegionMapping(
        selectedTemplate.sampleJson,
        mappings,
        targetRegions,
        selectedTemplate.id
      );
      setTransformResult(result);
      showToast('success', `Generated ${result.targetComponents.length} target component(s).`);
    } catch (e) {
      showToast('error', `Generation failed: ${(e as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [figmaMode, handleFigmaGenerate, selectedTemplate, mappings, targetRegions, showToast]);

  // ── Copy / Download ───────────────────────────────────────────────────────
  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => showToast('success', 'Copied to clipboard'));
  }, [showToast]);

  const handleDownload = useCallback((text: string, filename: string) => {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  const studioTabs: Array<{ key: StudioTab; label: string }> = [
    { key: 'mapping',    label: 'Mapping View' },
    { key: 'canvas',     label: '⚡ Live Canvas' },
    { key: 'output',     label: 'Output' },
    { key: 'validation', label: 'Validation' },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 overflow-hidden">
      {/* ── Studio Toolbar ──────────────────────────────────────────────────── */}
      <div className="h-11 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-2 shrink-0">
        <LayoutTemplate size={16} className="text-rose-600 dark:text-rose-400" />
        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 mr-2">
          Template Mapping Studio
        </span>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5 mr-3">
          {studioTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-semibold transition-all',
                activeTab === t.key
                  ? 'bg-white dark:bg-slate-700 text-rose-700 dark:text-rose-300 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Figma mode toggle */}
        <button
          onClick={handleToggleFigmaMode}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
            figmaMode
              ? 'bg-violet-600 border-violet-700 text-white hover:bg-violet-700'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-violet-400 hover:text-violet-700 dark:hover:text-violet-300'
          )}
          title={figmaMode ? 'Switch to standard Target Builder mode' : 'Switch to Figma Target Layout mode'}
        >
          {figmaMode ? <ToggleRight size={13} /> : <ToggleLeft size={13} />}
          <Layers size={12} />
          {figmaMode ? 'Figma Mode' : 'Figma'}
          {!figmaMode && (
            <span className="text-[9px] bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-1 rounded font-medium">NEW</span>
          )}
        </button>

        {/* Import Figma button (when in figma mode or no layout loaded) */}
        {figmaMode && (
          <button
            onClick={() => setShowFigmaDialog(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40 border border-violet-200 dark:border-violet-800"
          >
            <Box size={12} />
            {figmaParseResult ? `${figmaSourceName}` : 'Import Figma Layout'}
          </button>
        )}

        {/* Mapping count */}
        {activeMapCount > 0 && (
          <span className={cn(
            'text-xs px-2 py-0.5 rounded-full',
            figmaMode
              ? 'text-violet-700 dark:text-violet-300 bg-violet-100 dark:bg-violet-900/30'
              : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'
          )}>
            {activeMapCount} {figmaMode ? 'figma ' : ''}mapping(s)
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          {/* AI Auto-map */}
          <button
            onClick={handleAutoMap}
            disabled={
              (figmaMode ? (isFigmaAutoMapping || !figmaParseResult) : (isAutoMapping || targetRegions.length === 0))
              || !selectedTemplate
            }
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              figmaMode
                ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40'
                : 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {(figmaMode ? isFigmaAutoMapping : isAutoMapping)
              ? <Loader2 size={13} className="animate-spin" />
              : <Sparkles size={13} />}
            {figmaMode ? 'Auto-map to Figma' : 'Auto-map'}
            <span className="text-[10px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-1 rounded font-medium">Mock AI</span>
          </button>

          {/* Clear */}
          <button
            onClick={handleClearAll}
            disabled={mappings.length === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-40 transition-colors"
          >
            <RotateCcw size={13} /> Clear
          </button>

          {/* Generate */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || activeMapCount === 0}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
              'bg-rose-600 hover:bg-rose-700 text-white',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
          >
            {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            Generate Output
          </button>
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────────── */}
      {activeTab === 'mapping' && (
        <div
          ref={containerRef}
          className="flex flex-1 overflow-hidden relative"
          style={{ position: 'relative' }}
        >
          {/* Absolute SVG overlay spans the full container */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={svgSize.w}
            height={svgSize.h}
            style={{ zIndex: 2 }}
          >
            <defs>
              <marker id="arrow-tip" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#6366f1" opacity="0.8" />
              </marker>
              <marker id="arrow-tip-sel" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#4f46e5" />
              </marker>
            </defs>
            {connectorPaths.map((cp) => (
              <path
                key={cp.id}
                d={cp.d}
                fill="none"
                stroke={cp.selected ? '#4f46e5' : cp.color}
                strokeWidth={cp.selected ? 2.5 : 1.8}
                strokeDasharray={cp.selected ? undefined : '7 4'}
                opacity={cp.selected ? 1 : 0.7}
                markerEnd={cp.selected ? 'url(#arrow-tip-sel)' : 'url(#arrow-tip)'}
              />
            ))}
          </svg>

          {/* Left: Source */}
          <SourcePanel
            selectedTemplate={selectedTemplate}
            onSelectTemplate={handleSelectTemplate}
            connectingFromId={connectingFromId}
            onStartConnect={handleStartConnect}
            onCancelConnect={() => setConnectingFromId(null)}
            mappings={mappings}
            sourceRegionRefs={sourceRegionRefs}
          />

          {/* Center: Connector Canvas */}
          <ConnectorCanvas
            mappings={activeMappings}
            selectedMappingId={selectedMappingId}
            onSelectMapping={setSelectedMappingId}
            onDeleteMapping={figmaMode
              ? (id) => { setFigmaMappings((prev) => prev.filter((m) => m.id !== id)); setFigmaTransformResult(null); }
              : handleDeleteMapping
            }
            onChangeMappingType={figmaMode
              ? (id, type) => setFigmaMappings((prev) => prev.map((m) => m.id === id ? { ...m, mappingType: type } : m))
              : handleChangeMappingType
            }
            connectingFromId={connectingFromId}
            sourceTemplate={selectedTemplate}
            targetRegions={activeTargetRegions}
            connectorPaths={connectorPaths}
            containerWidth={svgSize.w}
            containerHeight={svgSize.h}
          />

          {/* Right: Target Builder (standard) or Figma Target Panel */}
          {figmaMode ? (
            <FigmaTargetPanel
              figmaNodes={figmaParseResult?.nodes ?? []}
              figmaRegions={figmaRegions}
              mappings={figmaMappings}
              connectingFromId={connectingFromId}
              onSelectNode={handleFigmaNodeSelect}
              onCancelConnect={() => setConnectingFromId(null)}
              targetRegionRefs={targetRegionRefs}
            />
          ) : (
            <TargetBuilderPanel
              targetRegions={targetRegions}
              onAddRegion={handleAddTargetRegion}
              onRemoveRegion={handleRemoveTargetRegion}
              onUpdateRegion={handleUpdateTargetRegion}
              connectingFromId={connectingFromId}
              onCompleteConnect={handleCompleteConnect}
              mappings={mappings}
              targetRegionRefs={targetRegionRefs}
            />
          )}
        </div>
      )}

      {activeTab === 'canvas' && (
        <div className="flex-1 overflow-hidden">
          <LiveMappingCanvas
            sourceTemplate={selectedTemplate}
            targetRegions={activeTargetRegions}
            mappings={activeMappings}
            onMappingsChange={(updated) => {
              if (figmaMode) {
                setFigmaMappings(updated as FigmaRegionMapping[]);
                setFigmaTransformResult(null);
              } else {
                setMappings(updated);
                setTransformResult(null);
              }
            }}
            figmaMode={figmaMode}
            onAutoMap={handleAutoMap}
            isAutoMapping={figmaMode ? isFigmaAutoMapping : isAutoMapping}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />
        </div>
      )}

      {activeTab === 'output' && (
        <div className="flex-1 overflow-hidden">
          <OutputPanel
            result={activeTransformResult}
            isGenerating={isGenerating}
            onCopy={handleCopy}
            onDownload={handleDownload}
          />
        </div>
      )}

      {activeTab === 'validation' && (
        <div className="flex-1 overflow-hidden">
          <ValidationPanel
            selectedTemplate={selectedTemplate}
            targetRegions={activeTargetRegions}
            mappings={activeMappings}
          />
        </div>
      )}

      {/* Figma Import Dialog */}
      {showFigmaDialog && (
        <FigmaImportDialog
          onImport={handleFigmaImport}
          onClose={() => setShowFigmaDialog(false)}
        />
      )}

      {ToastEl}
    </div>
  );
});
