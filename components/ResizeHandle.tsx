'use client';

/**
 * ResizeHandle
 * ─────────────
 * A 6 px wide vertical drag handle placed between two panels.
 * Consumes handleProps produced by useResizePanel().
 *
 * Props:
 *   handleProps  — spread returned by useResizePanel()
 *   className    — additional Tailwind classes (optional)
 */

import React from 'react';
import { cn } from '@/utils/cn';

interface ResizeHandleProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleProps: Record<string, any>;
  className?: string;
}

export function ResizeHandle({ handleProps, className }: ResizeHandleProps) {
  return (
    <div
      {...handleProps}
      className={cn(
        'group flex items-center justify-center select-none',
        'bg-transparent hover:bg-indigo-50 dark:hover:bg-indigo-950/20',
        'transition-colors duration-100',
        className,
      )}
      style={{ ...handleProps.style }}
    >
      {/* Three grip dots */}
      <div className="flex flex-col gap-[3px] pointer-events-none">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-[3px] h-[3px] rounded-full bg-slate-300 dark:bg-slate-600 group-hover:bg-indigo-400 dark:group-hover:bg-indigo-500 transition-colors"
          />
        ))}
      </div>
    </div>
  );
}
