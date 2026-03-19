'use client';

// ─── RegionCanvas ─────────────────────────────────────────────────────────────
// Interactive drawing canvas for the "Highlight & Map Regions" feature.
//
// Features:
//  · Display an uploaded image (or SVG data-URL)
//  · Draw new rectangular regions by click-and-drag
//  · Move existing regions by dragging their interior
//  · Resize regions via four corner handles
//  · Zoom in / out (10 %–300 %) with scroll or buttons
//  · Colour-coded per-region highlight with label badge
//  · Snap-to-grid toggle (16 px grid)
//  · All coordinates stored as normalised (0–1) values

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  memo,
} from 'react';
import { ZoomIn, ZoomOut, Maximize2, MousePointer2, Pencil, Grid3X3 } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Region, RegionBoundingBox } from '@/types/region';

// ─── Types ────────────────────────────────────────────────────────────────────

type ToolMode = 'draw' | 'select';
type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw';

interface DrawState {
  startX: number; startY: number;
  currX: number;  currY: number;
}

interface DragState {
  regionId: string;
  startX: number; startY: number;
  origBox: RegionBoundingBox;
}

interface ResizeState {
  regionId: string;
  handle: ResizeHandle;
  startX: number; startY: number;
  origBox: RegionBoundingBox;
}

interface RegionCanvasProps {
  imageUrl: string;
  regions: Region[];
  selectedRegionId: string | null;
  onRegionCreate: (bbox: RegionBoundingBox, imageSegment: string) => void;
  onRegionUpdate: (id: string, updates: Partial<Region>) => void;
  onRegionSelect: (id: string | null) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_REGION_SIZE = 0.02; // minimum 2 % of image dimension
const HANDLE_SIZE     = 8;    // px, for corner handles
const SNAP_GRID       = 16;   // px grid for snapping

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.min(Math.max(v, lo), hi);
}

function normBox(
  ax: number, ay: number,
  bx: number, by: number,
  W: number,  H: number,
): RegionBoundingBox {
  const x = clamp(Math.min(ax, bx) / W, 0, 1);
  const y = clamp(Math.min(ay, by) / H, 0, 1);
  const w = clamp(Math.abs(bx - ax) / W, 0, 1 - x);
  const h = clamp(Math.abs(by - ay) / H, 0, 1 - y);
  return { x, y, width: w, height: h };
}

function snapToGrid(v: number, gridPx: number, totalPx: number): number {
  return Math.round(v * totalPx / gridPx) * gridPx / totalPx;
}

/** Crop a region from the image and return a JPEG base64 data-URL. */
async function cropRegion(imageUrl: string, box: RegionBoundingBox): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const cw = Math.max(1, Math.round(img.naturalWidth  * box.width));
      const ch = Math.max(1, Math.round(img.naturalHeight * box.height));
      const canvas = document.createElement('canvas');
      canvas.width  = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(''); return; }
      ctx.drawImage(
        img,
        img.naturalWidth  * box.x,
        img.naturalHeight * box.y,
        cw, ch,
        0, 0, cw, ch,
      );
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => resolve('');
    img.src = imageUrl;
  });
}

// ─── Corner Handle Sub-component ──────────────────────────────────────────────

const HANDLE_CURSORS: Record<ResizeHandle, string> = {
  nw: 'nw-resize', ne: 'ne-resize',
  se: 'se-resize', sw: 'sw-resize',
};

interface HandleProps {
  handle: ResizeHandle;
  color: string;
  onMouseDown: (e: React.MouseEvent, handle: ResizeHandle) => void;
}

const CornerHandle = memo(function CornerHandle({ handle, color, onMouseDown }: HandleProps) {
  const pos: Record<ResizeHandle, React.CSSProperties> = {
    nw: { top: -HANDLE_SIZE / 2,  left:  -HANDLE_SIZE / 2 },
    ne: { top: -HANDLE_SIZE / 2,  right: -HANDLE_SIZE / 2 },
    se: { bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2 },
    sw: { bottom: -HANDLE_SIZE / 2, left:  -HANDLE_SIZE / 2 },
  };
  return (
    <div
      role="presentation"
      style={{
        position: 'absolute',
        width:  HANDLE_SIZE,
        height: HANDLE_SIZE,
        background: '#fff',
        border: `2px solid ${color}`,
        borderRadius: 2,
        cursor: HANDLE_CURSORS[handle],
        zIndex: 20,
        ...pos[handle],
      }}
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown(e, handle); }}
    />
  );
});

// ─── Region Overlay ───────────────────────────────────────────────────────────

interface RegionBoxProps {
  region: Region;
  selected: boolean;
  displayW: number;
  displayH: number;
  onMouseDown: (e: React.MouseEvent) => void;
  onResizeMouseDown: (e: React.MouseEvent, handle: ResizeHandle) => void;
  onSelect: () => void;
}

const RegionBox = memo(function RegionBox({
  region, selected, displayW, displayH,
  onMouseDown, onResizeMouseDown, onSelect,
}: RegionBoxProps) {
  const { x, y, width, height } = region.boundingBox;
  const color = region.color;

  return (
    <div
      role="button"
      aria-label={`Region: ${region.name}`}
      tabIndex={0}
      style={{
        position: 'absolute',
        left:   `${x * 100}%`,
        top:    `${y * 100}%`,
        width:  `${width  * 100}%`,
        height: `${height * 100}%`,
        border: `2px solid ${color}`,
        background: `${color}18`,
        cursor: 'move',
        zIndex: selected ? 15 : 10,
        outline: selected ? `2px solid ${color}` : 'none',
        outlineOffset: 1,
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(); onMouseDown(e); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(); }}
    >
      {/* Label badge */}
      <span
        style={{
          position:   'absolute',
          top:        -22,
          left:       0,
          background: color,
          color:      '#fff',
          fontSize:   11,
          fontWeight: 600,
          padding:    '1px 6px',
          borderRadius: '4px 4px 0 0',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
          maxWidth:   `${displayW * width}px`,
          overflow:   'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {region.name}
      </span>

      {/* Resize handles (visible on selected) */}
      {selected && (
        <>
          {(['nw', 'ne', 'se', 'sw'] as ResizeHandle[]).map((h) => (
            <CornerHandle
              key={h}
              handle={h}
              color={color}
              onMouseDown={onResizeMouseDown}
            />
          ))}
        </>
      )}
    </div>
  );
});

// ─── RegionCanvas ─────────────────────────────────────────────────────────────

export const RegionCanvas = memo(function RegionCanvas({
  imageUrl,
  regions,
  selectedRegionId,
  onRegionCreate,
  onRegionUpdate,
  onRegionSelect,
}: RegionCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLDivElement>(null);
  const imgRef       = useRef<HTMLImageElement>(null);

  const [mode,      setMode]      = useState<ToolMode>('draw');
  const [zoom,      setZoom]      = useState(1);
  const [snapGrid,  setSnapGrid]  = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgDims,   setImgDims]   = useState({ w: 900, h: 700 });

  // interaction state
  const [drawing,  setDrawing]  = useState<DrawState | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [resizing, setResizing] = useState<ResizeState | null>(null);

  // Reset loaded state when image changes
  useEffect(() => { setImgLoaded(false); }, [imageUrl]);

  const handleImgLoad = useCallback(() => {
    if (imgRef.current) {
      setImgDims({
        w: imgRef.current.naturalWidth  || imgRef.current.offsetWidth,
        h: imgRef.current.naturalHeight || imgRef.current.offsetHeight,
      });
    }
    setImgLoaded(true);
  }, []);

  // ── Coordinate helpers ──────────────────────────────────────────────────────

  const getCanvasCoords = useCallback((e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top)  / zoom,
    };
  }, [zoom]);

  // Display dimensions of the image (accounting for zoom via CSS scale)
  const displayW = imgDims.w;
  const displayH = imgDims.h;

  const maybeSnap = useCallback((norm: number, total: number): number => {
    if (!snapGrid) return norm;
    return snapToGrid(norm, SNAP_GRID / zoom, total);
  }, [snapGrid, zoom]);

  // ── Mouse handlers ─────────────────────────────────────────────────────────

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (mode !== 'draw') return;
    const { x, y } = getCanvasCoords(e);
    setDrawing({ startX: x, startY: y, currX: x, currY: y });
    onRegionSelect(null);
  }, [mode, getCanvasCoords, onRegionSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drawing && !dragging && !resizing) return;
    const { x, y } = getCanvasCoords(e);

    if (drawing) {
      setDrawing((d) => d ? { ...d, currX: x, currY: y } : null);
      return;
    }

    if (dragging) {
      const dx = (x - dragging.startX) / displayW;
      const dy = (y - dragging.startY) / displayH;
      const ob  = dragging.origBox;
      const newBox: RegionBoundingBox = {
        x:      clamp(ob.x + dx, 0, 1 - ob.width),
        y:      clamp(ob.y + dy, 0, 1 - ob.height),
        width:  ob.width,
        height: ob.height,
      };
      onRegionUpdate(dragging.regionId, { boundingBox: newBox });
      return;
    }

    if (resizing) {
      const dx   = (x - resizing.startX) / displayW;
      const dy   = (y - resizing.startY) / displayH;
      const ob   = resizing.origBox;
      let { x: bx, y: by, width: bw, height: bh } = ob;

      switch (resizing.handle) {
        case 'nw': bx = clamp(bx + dx, 0, ob.x + ob.width  - MIN_REGION_SIZE); by = clamp(by + dy, 0, ob.y + ob.height - MIN_REGION_SIZE); bw = ob.width  - (bx - ob.x); bh = ob.height - (by - ob.y); break;
        case 'ne': bw = clamp(ob.width  + dx, MIN_REGION_SIZE, 1 - ob.x);      by = clamp(by + dy, 0, ob.y + ob.height - MIN_REGION_SIZE); bh = ob.height - (by - ob.y); break;
        case 'se': bw = clamp(ob.width  + dx, MIN_REGION_SIZE, 1 - ob.x);      bh = clamp(ob.height + dy, MIN_REGION_SIZE, 1 - ob.y);      break;
        case 'sw': bx = clamp(bx + dx, 0, ob.x + ob.width  - MIN_REGION_SIZE); bw = ob.width  - (bx - ob.x);                               bh = clamp(ob.height + dy, MIN_REGION_SIZE, 1 - ob.y); break;
      }

      onRegionUpdate(resizing.regionId, { boundingBox: { x: bx, y: by, width: bw, height: bh } });
      return;
    }
  }, [drawing, dragging, resizing, getCanvasCoords, displayW, displayH, onRegionUpdate]);

  const handleMouseUp = useCallback(async (e: React.MouseEvent) => {
    if (dragging) { setDragging(null); return; }
    if (resizing) { setResizing(null); return; }

    if (!drawing) return;
    const { x, y } = getCanvasCoords(e);
    let box = normBox(drawing.startX, drawing.startY, x, y, displayW, displayH);

    if (snapGrid) {
      box = {
        x:      maybeSnap(box.x,      1),
        y:      maybeSnap(box.y,      1),
        width:  maybeSnap(box.width,  1),
        height: maybeSnap(box.height, 1),
      };
    }

    setDrawing(null);

    if (box.width < MIN_REGION_SIZE || box.height < MIN_REGION_SIZE) return;

    const segment = await cropRegion(imageUrl, box);
    onRegionCreate(box, segment);
  }, [drawing, dragging, resizing, getCanvasCoords, displayW, displayH, snapGrid, maybeSnap, imageUrl, onRegionCreate]);

  // ── Region drag / resize ────────────────────────────────────────────────────

  const startDrag = useCallback((e: React.MouseEvent, region: Region) => {
    if (mode !== 'select') return;
    const { x, y } = getCanvasCoords(e);
    setDragging({ regionId: region.id, startX: x, startY: y, origBox: { ...region.boundingBox } });
  }, [mode, getCanvasCoords]);

  const startResize = useCallback((e: React.MouseEvent, region: Region, handle: ResizeHandle) => {
    const { x, y } = getCanvasCoords(e);
    setResizing({ regionId: region.id, handle, startX: x, startY: y, origBox: { ...region.boundingBox } });
  }, [getCanvasCoords]);

  // ── Zoom ────────────────────────────────────────────────────────────────────

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => clamp(z - e.deltaY * 0.001, 0.1, 3));
  }, []);

  const zoomIn  = () => setZoom((z) => clamp(parseFloat((z + 0.15).toFixed(2)), 0.1, 3));
  const zoomOut = () => setZoom((z) => clamp(parseFloat((z - 0.15).toFixed(2)), 0.1, 3));
  const zoomFit = useCallback(() => {
    if (!containerRef.current) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    setZoom(clamp(Math.min(cw / displayW, ch / displayH) * 0.95, 0.1, 3));
  }, [displayW, displayH]);

  // ── Draw preview box coords ─────────────────────────────────────────────────
  const drawPreview = drawing
    ? (() => {
        const left   = Math.min(drawing.startX, drawing.currX);
        const top    = Math.min(drawing.startY, drawing.currY);
        const width  = Math.abs(drawing.currX  - drawing.startX);
        const height = Math.abs(drawing.currY  - drawing.startY);
        return { left, top, width, height };
      })()
    : null;

  // ── Cursor ──────────────────────────────────────────────────────────────────
  const cursor = mode === 'draw' ? 'crosshair' : 'default';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
        <span className="text-xs text-slate-500 mr-1">Tool:</span>
        <button
          onClick={() => setMode('draw')}
          title="Draw new region"
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
            mode === 'draw'
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          <Pencil size={12} /> Draw
        </button>
        <button
          onClick={() => setMode('select')}
          title="Select / move regions"
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
            mode === 'select'
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          <MousePointer2 size={12} /> Select
        </button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        <button onClick={zoomOut}  title="Zoom out"  className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomOut  size={13} /></button>
        <span className="text-xs text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={zoomIn}   title="Zoom in"   className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><ZoomIn   size={13} /></button>
        <button onClick={zoomFit}  title="Fit to canvas" className="p-1 rounded text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Maximize2 size={13} /></button>

        <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1" />

        <button
          onClick={() => setSnapGrid((s) => !s)}
          title="Toggle snap-to-grid"
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
            snapGrid
              ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
              : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
          )}
        >
          <Grid3X3 size={12} /> Snap
        </button>

        <div className="flex-1" />
        <span className="text-xs text-slate-400">
          {regions.length} region{regions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Scroll container */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-slate-200 dark:bg-slate-800 relative"
        onWheel={handleWheel}
      >
        {/* Inner canvas — sized to the image and then scaled */}
        <div
          ref={canvasRef}
          style={{
            position:        'relative',
            width:           displayW,
            height:          displayH,
            transform:       `scale(${zoom})`,
            transformOrigin: '0 0',
            cursor,
            userSelect:      'none',
          }}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            if (drawing)  setDrawing(null);
            if (dragging) setDragging(null);
            if (resizing) setResizing(null);
          }}
        >
          {/* The image */}
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Design screenshot"
            draggable={false}
            onLoad={handleImgLoad}
            style={{ display: 'block', width: displayW, height: displayH, pointerEvents: 'none' }}
          />

          {/* Existing regions */}
          {imgLoaded && regions.map((region) => (
            <RegionBox
              key={region.id}
              region={region}
              selected={region.id === selectedRegionId}
              displayW={displayW * zoom}
              displayH={displayH * zoom}
              onSelect={() => onRegionSelect(region.id)}
              onMouseDown={(e) => startDrag(e, region)}
              onResizeMouseDown={(e, handle) => { onRegionSelect(region.id); startResize(e, region, handle); }}
            />
          ))}

          {/* Draw preview */}
          {drawing && drawPreview && (
            <div
              style={{
                position: 'absolute',
                left:     drawPreview.left,
                top:      drawPreview.top,
                width:    drawPreview.width,
                height:   drawPreview.height,
                border:   '2px dashed #6366f1',
                background: 'rgba(99,102,241,0.12)',
                pointerEvents: 'none',
                zIndex: 50,
              }}
            />
          )}

          {/* Snap-grid overlay */}
          {snapGrid && imgLoaded && (
            <svg
              style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
              width={displayW}
              height={displayH}
            >
              {Array.from({ length: Math.ceil(displayW / SNAP_GRID) + 1 }).map((_, i) => (
                <line key={`v${i}`} x1={i * SNAP_GRID} y1={0} x2={i * SNAP_GRID} y2={displayH} stroke="rgba(99,102,241,0.12)" strokeWidth={1} />
              ))}
              {Array.from({ length: Math.ceil(displayH / SNAP_GRID) + 1 }).map((_, i) => (
                <line key={`h${i}`} x1={0} y1={i * SNAP_GRID} x2={displayW} y2={i * SNAP_GRID} stroke="rgba(99,102,241,0.12)" strokeWidth={1} />
              ))}
            </svg>
          )}
        </div>
      </div>

      {/* Hint bar */}
      <div className="px-3 py-1 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0">
        <p className="text-xs text-slate-400">
          {mode === 'draw'
            ? 'Click and drag to draw a region · Switch to Select to move or resize'
            : 'Click a region to select · Drag to move · Corner handles to resize'}
        </p>
      </div>
    </div>
  );
});
