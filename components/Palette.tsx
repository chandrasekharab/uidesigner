'use client';

import React, { memo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import {
  Layout,
  TextCursorInput,
  MousePointerClick,
  ChevronsUpDown,
  Type,
} from 'lucide-react';
import { PALETTE_ITEMS } from '@/utils/componentDefaults';
import type { PaletteItem } from '@/types';
import { cn } from '@/utils/cn';
import { useResizePanel } from '@/utils/resizePanel';
import { ResizeHandle } from '@/components/ResizeHandle';

// ─── Icon Map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactNode> = {
  layout: <Layout size={18} />,
  'text-cursor-input': <TextCursorInput size={18} />,
  'mouse-pointer-click': <MousePointerClick size={18} />,
  'chevrons-up-down': <ChevronsUpDown size={18} />,
  type: <Type size={18} />,
};

// ─── Draggable Palette Item ───────────────────────────────────────────────────

interface PaletteCardProps {
  item: PaletteItem;
}

const PaletteCard = memo(function PaletteCard({ item }: PaletteCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { source: 'palette', type: item.type },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700',
        'bg-white dark:bg-slate-800 cursor-grab active:cursor-grabbing select-none',
        'hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:shadow-sm',
        'transition-all duration-150 text-sm font-medium text-slate-700 dark:text-slate-200',
        isDragging && 'opacity-40 scale-95'
      )}
    >
      <span className="text-indigo-500">{ICON_MAP[item.icon]}</span>
      <span>{item.label}</span>
    </div>
  );
});

// ─── Palette Panel ────────────────────────────────────────────────────────────

export const Palette = memo(function Palette() {
  const { width, handleProps } = useResizePanel({ initial: 224, direction: 'right' });
  return (
    <aside style={{ width }} className="relative flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col">
      <ResizeHandle handleProps={handleProps} className="absolute top-0 right-0 h-full w-1.5 cursor-col-resize z-10" />
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Components
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {PALETTE_ITEMS.map((item) => (
          <PaletteCard key={item.type} item={item} />
        ))}
      </div>

      <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800">
        <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
          Drag components onto the canvas to build your UI.
        </p>
      </div>
    </aside>
  );
});
