'use client';

// ─── Detection Overlay ────────────────────────────────────────────────────────
// Renders normalised bounding boxes on top of the uploaded design image.
// Supports selection, inline label editing, and type correction.
// Uses CSS position:absolute with percentage-based coordinates so it auto-
// scales with the parent <img>.

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/utils/cn';
import type { DetectedComponent } from '@/services/designParser';

// ─── Type colours (matching DesignGeneratorExperience.tsx) ────────────────────

const TYPE_COLOURS: Record<string, { border: string; bg: string; text: string }> = {
  input:    { border: 'border-blue-500',   bg: 'bg-blue-500/10',   text: 'text-blue-600' },
  password: { border: 'border-purple-500', bg: 'bg-purple-500/10', text: 'text-purple-600' },
  button:   { border: 'border-green-500',  bg: 'bg-green-500/10',  text: 'text-green-600' },
  dropdown: { border: 'border-cyan-500',   bg: 'bg-cyan-500/10',   text: 'text-cyan-600' },
  checkbox: { border: 'border-teal-500',   bg: 'bg-teal-500/10',   text: 'text-teal-600' },
  radio:    { border: 'border-teal-400',   bg: 'bg-teal-400/10',   text: 'text-teal-600' },
  heading:  { border: 'border-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-600' },
  label:    { border: 'border-yellow-500', bg: 'bg-yellow-400/10', text: 'text-yellow-700' },
  text:     { border: 'border-slate-400',  bg: 'bg-slate-400/10',  text: 'text-slate-600' },
  card:     { border: 'border-indigo-500', bg: 'bg-indigo-500/10', text: 'text-indigo-600' },
  section:  { border: 'border-slate-400',  bg: 'bg-slate-300/10',  text: 'text-slate-500' },
  table:    { border: 'border-pink-500',   bg: 'bg-pink-500/10',   text: 'text-pink-600' },
  link:     { border: 'border-sky-500',    bg: 'bg-sky-400/10',    text: 'text-sky-600' },
};

const DEFAULT_COLOUR = { border: 'border-slate-400', bg: 'bg-slate-200/10', text: 'text-slate-500' };

function getColour(type: string) {
  return TYPE_COLOURS[type] ?? DEFAULT_COLOUR;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DetectionOverlayProps {
  components: DetectedComponent[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<DetectedComponent>) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DetectionOverlay = memo(function DetectionOverlay({
  components,
  selectedId,
  onSelect,
  onUpdate,
}: DetectionOverlayProps) {
  return (
    // This div stretches over the image using position:absolute with
    // inset-0 so it must be inside a `relative` positioned parent.
    <div className="absolute inset-0 pointer-events-none">
      {components.map((comp) => (
        <BoundingBoxItem
          key={comp.id}
          comp={comp}
          selected={comp.id === selectedId}
          onSelect={onSelect}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
});

// ─── Single Bounding Box ──────────────────────────────────────────────────────

function BoundingBoxItem({
  comp,
  selected,
  onSelect,
  onUpdate,
}: {
  comp: DetectedComponent;
  selected: boolean;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, updates: Partial<DetectedComponent>) => void;
}) {
  const { border, bg, text } = getColour(comp.type);
  const [editing, setEditing] = useState(false);
  const [labelValue, setLabelValue] = useState(comp.label);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync if parent updates the label externally
  useEffect(() => {
    setLabelValue(comp.label);
  }, [comp.label]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    []
  );

  const commitLabel = useCallback(() => {
    setEditing(false);
    if (labelValue !== comp.label) {
      onUpdate(comp.id, { label: labelValue });
    }
  }, [labelValue, comp.label, comp.id, onUpdate]);

  const { x, y, width, height } = comp.boundingBox;

  return (
    <div
      className={cn(
        'absolute border-2 rounded cursor-pointer pointer-events-auto transition-all duration-100',
        border,
        bg,
        selected ? 'opacity-100 z-20 shadow-lg' : 'opacity-70 z-10 hover:opacity-100 hover:z-20'
      )}
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${width * 100}%`,
        height: `${height * 100}%`,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(selected ? null : comp.id);
      }}
      onDoubleClick={handleDoubleClick}
      title={`${comp.type}: ${comp.label} (${Math.round(comp.confidence * 100)}%)`}
    >
      {/* Type badge */}
      <div
        className={cn(
          'absolute -top-5 left-0 px-1.5 py-0.5 rounded-t text-[8px] font-bold whitespace-nowrap z-30',
          'bg-white dark:bg-slate-900 border border-b-0',
          border,
          text
        )}
      >
        {comp.type}
      </div>

      {/* Confidence dot */}
      <div
        className={cn(
          'absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full border border-white dark:border-slate-900',
          comp.confidence >= 0.9
            ? 'bg-green-500'
            : comp.confidence >= 0.7
            ? 'bg-yellow-500'
            : 'bg-red-500'
        )}
        title={`${Math.round(comp.confidence * 100)}% confidence`}
      />

      {/* Inline label editor (shown when selected + double-clicked) */}
      {selected && (
        <div
          className="absolute -bottom-7 left-0 right-0 flex items-center gap-1 z-30 pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {editing ? (
            <input
              ref={inputRef}
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitLabel();
                if (e.key === 'Escape') { setEditing(false); setLabelValue(comp.label); }
              }}
              className="flex-1 px-1.5 py-0.5 text-[9px] border border-violet-400 rounded bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none shadow-md"
              placeholder="Edit label…"
            />
          ) : (
            <button
              onDoubleClick={handleDoubleClick}
              className={cn(
                'flex-1 px-1.5 py-0.5 text-[9px] rounded truncate text-left bg-white dark:bg-slate-900 shadow border',
                border,
                text
              )}
              title="Double-click to edit label"
            >
              {comp.label || '(double-click to edit)'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
