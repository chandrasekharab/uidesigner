'use client';

// ─── RegionList ───────────────────────────────────────────────────────────────
// Left-panel list of all drawn regions.
// Supports inline renaming, selection, reordering, and deletion.

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Pencil,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Region } from '@/types/region';

// ─── Detected type badge colours ─────────────────────────────────────────────

const TYPE_BADGE: Record<string, string> = {
  Header:       'bg-red-100    text-red-700   dark:bg-red-900/30   dark:text-red-300',
  CaseSummary:  'bg-cyan-100   text-cyan-700  dark:bg-cyan-900/30  dark:text-cyan-300',
  Steps:        'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  FormSection:  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  Attachments:  'bg-green-100  text-green-700 dark:bg-green-900/30 dark:text-green-300',
  ActivityFeed: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  DataGrid:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  Navigation:   'bg-teal-100   text-teal-700  dark:bg-teal-900/30  dark:text-teal-300',
  Footer:       'bg-slate-100  text-slate-600 dark:bg-slate-700    dark:text-slate-300',
  Card:         'bg-sky-100    text-sky-700   dark:bg-sky-900/30   dark:text-sky-300',
  Tabs:         'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  Modal:        'bg-rose-100   text-rose-700  dark:bg-rose-900/30  dark:text-rose-300',
};

// ─── Inline name editor ───────────────────────────────────────────────────────

interface InlineEditorProps {
  name: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}

const InlineEditor = memo(function InlineEditor({ name, onCommit, onCancel }: InlineEditorProps) {
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.select(); }, []);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed) onCommit(trimmed);
    else onCancel();
  };

  return (
    <input
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter')  { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      }}
      className="w-full px-1 py-0.5 text-sm border border-indigo-400 rounded bg-white dark:bg-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-indigo-400"
      onClick={(e) => e.stopPropagation()}
    />
  );
});

// ─── Single Region Row ────────────────────────────────────────────────────────

interface RegionRowProps {
  region: Region;
  selected: boolean;
  index: number;
  isMapped: boolean;
  onSelect: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

const RegionRow = memo(function RegionRow({
  region, selected, index, isMapped,
  onSelect, onRename, onDelete,
}: RegionRowProps) {
  const [editing, setEditing] = useState(false);

  const handleRename = (name: string) => {
    onRename(region.id, name);
    setEditing(false);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-selected={selected}
      onClick={onSelect}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
      className={cn(
        'group flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors border-b border-slate-100 dark:border-slate-800',
        selected
          ? 'bg-indigo-50 dark:bg-indigo-950/40'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
      )}
    >
      {/* Colour swatch */}
      <div
        className="mt-0.5 shrink-0 w-3 h-3 rounded-sm ring-1 ring-white ring-offset-1"
        style={{ background: region.color }}
      />

      <div className="flex-1 min-w-0">
        {/* Name / inline editor */}
        {editing ? (
          <InlineEditor
            name={region.name}
            onCommit={handleRename}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
              {region.name}
            </span>
            <button
              title="Rename"
              onClick={(e) => { e.stopPropagation(); setEditing(true); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-opacity"
            >
              <Pencil size={10} />
            </button>
          </div>
        )}

        {/* Detected type badge */}
        {region.detectedType && (
          <span className={cn(
            'inline-block mt-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded',
            TYPE_BADGE[region.detectedType] ?? 'bg-slate-100 text-slate-500'
          )}>
            {region.detectedType}
          </span>
        )}

        {/* Bounding box info */}
        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
          {Math.round(region.boundingBox.x * 100)}%,{Math.round(region.boundingBox.y * 100)}%{' '}
          {Math.round(region.boundingBox.width * 100)}×{Math.round(region.boundingBox.height * 100)}%
        </p>
      </div>

      {/* Mapping status icon */}
      <div className="shrink-0 flex items-center gap-1 mt-0.5">
        {isMapped
          ? <CheckCircle2 size={12} className="text-green-500" aria-label="Mapped" />
          : <AlertCircle  size={12} className="text-amber-400" aria-label="Not yet mapped" />
        }
        <ChevronRight size={12} className={cn('transition-opacity text-slate-400', selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')} />
      </div>

      {/* Delete button */}
      <button
        title="Delete region"
        onClick={(e) => { e.stopPropagation(); onDelete(region.id); }}
        className="opacity-0 group-hover:opacity-100 shrink-0 p-0.5 rounded text-slate-400 hover:text-red-500 transition-opacity"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
});

// ─── RegionList ───────────────────────────────────────────────────────────────

interface RegionListProps {
  regions: Region[];
  selectedRegionId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export const RegionList = memo(function RegionList({
  regions, selectedRegionId, onSelect, onRename, onDelete, onClearAll,
}: RegionListProps) {
  const mappedCount = regions.filter((r) => r.mappedSchema).length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center gap-2">
          <Layers size={13} className="text-indigo-500" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Regions</span>
          <span className="ml-auto text-xs text-slate-400">{mappedCount}/{regions.length} mapped</span>
        </div>
        {regions.length > 0 && (
          <div className="mt-1 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${regions.length > 0 ? (mappedCount / regions.length) * 100 : 0}%` }}
            />
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {regions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center px-4">
            <Layers size={28} className="text-slate-300 dark:text-slate-600 mb-2" />
            <p className="text-xs text-slate-400">No regions yet.</p>
            <p className="text-xs text-slate-400 mt-1">Draw a box on the image to create one.</p>
          </div>
        ) : (
          regions.map((r, i) => (
            <RegionRow
              key={r.id}
              region={r}
              selected={r.id === selectedRegionId}
              index={i}
              isMapped={Boolean(r.mappedSchema)}
              onSelect={() => onSelect(r.id)}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))
        )}
      </div>

      {/* Footer */}
      {regions.length > 0 && (
        <div className="px-3 py-1.5 border-t border-slate-200 dark:border-slate-700 shrink-0">
          <button
            onClick={onClearAll}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Clear all regions
          </button>
        </div>
      )}
    </div>
  );
});
