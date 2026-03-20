/**
 * useResizePanel
 * ──────────────
 * Lightweight hook that returns:
 *   - `width`          — current panel width (px)
 *   - `handleProps`    — spread onto the resize-grip <div>
 *
 * Growing direction is controlled by `direction`:
 *   'right'  — drag right  increases width (left panels)
 *   'left'   — drag left increases width  (right panels)
 *
 * Usage:
 *   const { width, handleProps } = useResizePanel({ initial: 256, direction: 'right' });
 *   <aside style={{ width }}>…</aside>
 *   <div {...handleProps} className="resize-handle-css" />
 */
'use client';

import { useCallback, useRef, useState } from 'react';

interface UseResizePanelOptions {
  /** Starting width in pixels */
  initial: number;
  /** Minimum allowed width (default 120) */
  min?: number;
  /** Maximum allowed width (default 600) */
  max?: number;
  /**
   * 'right'  — dragging right from a left-side panel increases its width
   * 'left'   — dragging left  from a right-side panel increases its width
   */
  direction: 'right' | 'left';
}

interface ResizeHandleProps {
  style: React.CSSProperties;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  role: string;
  'aria-label': string;
  tabIndex: number;
}

export function useResizePanel({
  initial,
  min = 120,
  max = 600,
  direction,
}: UseResizePanelOptions): { width: number; handleProps: ResizeHandleProps } {
  const [width, setWidth] = useState(initial);
  const dragging = useRef(false);
  const startX   = useRef(0);
  const startW   = useRef(0);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragging.current = true;
      startX.current   = e.clientX;
      startW.current   = width;
    },
    [width],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const delta = direction === 'right'
        ? e.clientX - startX.current
        : startX.current - e.clientX;
      setWidth(Math.min(max, Math.max(min, startW.current + delta)));
    },
    [direction, min, max],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragging.current = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  const handleProps: ResizeHandleProps = {
    style: {
      width: 6,
      flexShrink: 0,
      cursor: 'col-resize',
      zIndex: 20,
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    role: 'separator',
    'aria-label': 'Resize panel',
    tabIndex: -1,
  };

  return { width, handleProps };
}
