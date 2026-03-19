'use client';

// ─── RegionEditor ─────────────────────────────────────────────────────────────
// Compact properties editor for a selected region.
// Shown in the right panel before the full mapping step.

import React, { memo, useState } from 'react';
import { cn } from '@/utils/cn';
import type { Region, RegionDetectedType } from '@/types/region';

const DETECTED_TYPES: RegionDetectedType[] = [
  'Header', 'FormSection', 'Attachments', 'ActivityFeed',
  'Steps', 'DataGrid', 'CaseSummary', 'Navigation',
  'Footer', 'Card', 'Tabs', 'Modal', 'Unknown',
];

const COLOUR_SWATCHES = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#6366f1', '#a855f7', '#ec4899',
  '#14b8a6', '#f43f5e',
];

interface RegionEditorProps {
  region: Region;
  onUpdate: (id: string, updates: Partial<Region>) => void;
  onDelete: (id: string) => void;
}

export const RegionEditor = memo(function RegionEditor({ region, onUpdate, onDelete }: RegionEditorProps) {
  const [nameVal, setNameVal] = useState(region.name);

  const commitName = () => {
    const trimmed = nameVal.trim();
    if (trimmed && trimmed !== region.name) {
      onUpdate(region.id, { name: trimmed });
    } else {
      setNameVal(region.name);
    }
  };

  // Keep local state in sync when selected region changes
  if (nameVal !== region.name && document.activeElement?.tagName !== 'INPUT') {
    setNameVal(region.name);
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Region Name
        </label>
        <input
          value={nameVal}
          onChange={(e) => setNameVal(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.currentTarget.blur(); } }}
          className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      {/* Detected type */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Visual Type
        </label>
        <select
          value={region.detectedType ?? 'Unknown'}
          onChange={(e) => onUpdate(region.id, { detectedType: e.target.value as RegionDetectedType })}
          className="w-full px-2 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
        >
          {DETECTED_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Colour */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Highlight Colour
        </label>
        <div className="flex flex-wrap gap-1.5">
          {COLOUR_SWATCHES.map((c) => (
            <button
              key={c}
              title={c}
              onClick={() => onUpdate(region.id, { color: c })}
              style={{ background: c }}
              className={cn(
                'w-5 h-5 rounded-full transition-transform hover:scale-110',
                region.color === c ? 'ring-2 ring-offset-1 ring-slate-400 scale-110' : ''
              )}
            />
          ))}
        </div>
      </div>

      {/* Bounding-box info (read-only) */}
      <div>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
          Bounding Box (normalised)
        </label>
        <div className="grid grid-cols-2 gap-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
          <span>x: {region.boundingBox.x.toFixed(3)}</span>
          <span>y: {region.boundingBox.y.toFixed(3)}</span>
          <span>w: {region.boundingBox.width.toFixed(3)}</span>
          <span>h: {region.boundingBox.height.toFixed(3)}</span>
        </div>
      </div>

      {/* Cropped preview */}
      {region.imageSegment && (
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            Cropped Preview
          </label>
          <img
            src={region.imageSegment}
            alt={`Crop of ${region.name}`}
            className="w-full rounded border border-slate-200 dark:border-slate-700 object-cover max-h-28"
          />
        </div>
      )}

      {/* Delete */}
      <button
        onClick={() => onDelete(region.id)}
        className="mt-1 text-xs text-red-400 hover:text-red-600 text-left transition-colors"
      >
        Delete this region
      </button>
    </div>
  );
});
