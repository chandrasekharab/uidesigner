// ─── Red Border Detector ──────────────────────────────────────────────────────
// Client-side (canvas API) utility that scans an uploaded image for
// axis-aligned rectangles outlined with a red border.
//
// Algorithm
//   1. Decode the image into a canvas.
//   2. Build a binary "red pixel" mask (high R, low G/B).
//   3. Find connected components of red pixels (iterative flood-fill, 4-conn).
//   4. Classify each component: if its pixel count matches the expected
//      perimeter of a rectangle border, accept it as a widget outline.
//   5. Compute the interior bounding box (inset by the border thickness).
//   6. Crop + return each interior as a base64 JPEG imageSegment.
//
// Tuning levers
//   RED_R_MIN, RED_G_MAX, RED_B_MAX — colour detection thresholds.
//   THICK_MIN / THICK_MAX          — acceptable border thickness in pixels.
//   MIN_SIDE                        — reject rects smaller than this.
//   MAX_SCALE_DIM                   — downsample images wider / taller than
//                                     this before processing (performance).

import { v4 as uuidv4 } from 'uuid';

// ─── Configuration ────────────────────────────────────────────────────────────

const RED_R_MIN    = 150;
const RED_G_MAX    = 100;
const RED_B_MAX    = 100;
const RED_RATIO    = 1.5;    // R must be ≥ ratio × max(G, B)
const THICK_MIN    = 0.5;    // average border thickness (px) — avoids stray speckles
const THICK_MAX    = 22;     // max thickness; thicker → more likely painted fill
const MIN_SIDE     = 28;     // minimum bounding box side in *processed* pixels
const MAX_SCALE_DIM = 1400;  // downsample above this dimension

// ─── Public types ─────────────────────────────────────────────────────────────

/** A single widget region extracted from a red-bordered source image. */
export interface DetectedWidget {
  id: string;
  /** Human-readable label assigned in reading order (top-left → bottom-right) */
  name: string;
  /** Interior bounds in original image pixels (border excluded) */
  pixelBounds:      { x: number; y: number; width: number; height: number };
  /** Same bounds normalised to 0–1 */
  normalizedBounds: { x: number; y: number; width: number; height: number };
  /** Estimated stroke thickness of the red border (pixels) */
  borderThickness: number;
  /** Detection confidence 0–1 */
  confidence: number;
  /** Base64 JPEG data-URL of the cropped interior */
  imageSegment: string;
}

export interface RedBorderDetectionResult {
  widgets: DetectedWidget[];
  /** Original image natural width (pixels) */
  imageWidth: number;
  /** Original image natural height (pixels) */
  imageHeight: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isRed(r: number, g: number, b: number): boolean {
  return (
    r >= RED_R_MIN &&
    g <= RED_G_MAX &&
    b <= RED_B_MAX &&
    r >= RED_RATIO * g &&
    r >= RED_RATIO * b
  );
}

/** Return the canvas draw size, capped at MAX_SCALE_DIM while preserving AR. */
function scaledDims(natW: number, natH: number): [number, number] {
  if (natW <= MAX_SCALE_DIM && natH <= MAX_SCALE_DIM) return [natW, natH];
  const s = MAX_SCALE_DIM / Math.max(natW, natH);
  return [Math.round(natW * s), Math.round(natH * s)];
}

/** Crop a region from `src` canvas and return a JPEG base64 data-URL. */
function cropToDataUrl(
  src: HTMLCanvasElement,
  x: number, y: number, w: number, h: number,
): string {
  const out = document.createElement('canvas');
  out.width  = Math.max(1, w);
  out.height = Math.max(1, h);
  // willReadFrequently not needed here (write-only)
  out.getContext('2d')?.drawImage(src, x, y, w, h, 0, 0, w, h);
  return out.toDataURL('image/jpeg', 0.82);
}

// ─── Core function ────────────────────────────────────────────────────────────

/**
 * Load `imageUrl`, detect red-bordered rectangles, and return an array of
 * `DetectedWidget` objects sorted in reading order.
 *
 * Must be called in a browser context (uses HTMLCanvasElement / HTMLImageElement).
 */
export function detectRedBorderedWidgets(
  imageUrl: string,
): Promise<RedBorderDetectionResult> {
  return new Promise<RedBorderDetectionResult>((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      // ── 1. Determine natural size ────────────────────────────────────────
      const natW = img.naturalWidth  || img.width  || 900;
      const natH = img.naturalHeight || img.height || 700;
      const [W, H] = scaledDims(natW, natH);
      const scaleX = natW / W;
      const scaleY = natH / H;

      // ── 2. Draw onto an offscreen canvas ─────────────────────────────────
      const canvas = document.createElement('canvas');
      canvas.width  = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { reject(new Error('Canvas 2D context unavailable')); return; }
      ctx.drawImage(img, 0, 0, W, H);

      const { data } = ctx.getImageData(0, 0, W, H);

      // ── 3. Build red pixel mask ───────────────────────────────────────────
      const mask = new Uint8Array(W * H);
      for (let i = 0; i < W * H; i++) {
        if (isRed(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])) mask[i] = 1;
      }

      // ── 4. Connected components (4-connectivity, iterative) ───────────────
      const vis   = new Uint8Array(W * H);
      // Pre-allocate a typed-array stack for performance on large images
      const stk   = new Int32Array(W * H);

      type Comp = {
        minX: number; maxX: number;
        minY: number; maxY: number;
        count: number;
      };
      const comps: Comp[] = [];

      for (let seed = 0; seed < W * H; seed++) {
        if (!mask[seed] || vis[seed]) continue;

        let sp = 0;
        stk[sp++] = seed;
        vis[seed]  = 1;

        let minX = W, maxX = 0, minY = H, maxY = 0, count = 0;

        while (sp > 0) {
          const p  = stk[--sp];
          const py = (p / W) | 0;
          const px =  p % W;

          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
          count++;

          // 4 neighbours
          if (px > 0     && mask[p - 1] && !vis[p - 1]) { vis[p - 1] = 1; stk[sp++] = p - 1; }
          if (px < W - 1 && mask[p + 1] && !vis[p + 1]) { vis[p + 1] = 1; stk[sp++] = p + 1; }
          if (py > 0     && mask[p - W] && !vis[p - W]) { vis[p - W] = 1; stk[sp++] = p - W; }
          if (py < H - 1 && mask[p + W] && !vis[p + W]) { vis[p + W] = 1; stk[sp++] = p + W; }
        }

        comps.push({ minX, maxX, minY, maxY, count });
      }

      // ── 5. Filter to rectangle-border-like components ─────────────────────
      const widgets: DetectedWidget[] = [];

      for (const c of comps) {
        const bw = c.maxX - c.minX;
        const bh = c.maxY - c.minY;

        // Reject tiny or extremely elongated shapes
        if (bw < MIN_SIDE || bh < MIN_SIDE) continue;
        if (bw / bh > 20 || bh / bw > 20)  continue;

        // Average border thickness = total red pixels ÷ perimeter
        const perim = 2 * (bw + bh);
        const thick = c.count / perim;

        if (thick < THICK_MIN || thick > THICK_MAX) continue;

        // ── 6. Interior bounding box ──────────────────────────────────────
        // Inset by ceil(thick) + 1 safety margin
        const ins = Math.ceil(thick) + 1;
        const ix  = Math.max(0,           c.minX + ins);
        const iy  = Math.max(0,           c.minY + ins);
        const iw  = Math.max(1, Math.min(W - ix, bw - ins * 2));
        const ih  = Math.max(1, Math.min(H - iy, bh - ins * 2));

        // Back-project to natural image coordinates
        const nx = Math.round(ix * scaleX);
        const ny = Math.round(iy * scaleY);
        const nw = Math.round(iw * scaleX);
        const nh = Math.round(ih * scaleY);

        const imageSegment = cropToDataUrl(canvas, ix, iy, iw, ih);

        // Confidence: thinner borders are more reliably rectangles
        const conf = parseFloat(
          Math.min(0.99, 0.6 + 0.39 / Math.max(1, thick / 2)).toFixed(2)
        );

        widgets.push({
          id:   uuidv4(),
          name: '',   // filled in after sort
          pixelBounds:      { x: nx,        y: ny,        width: nw,        height: nh },
          normalizedBounds: { x: nx / natW, y: ny / natH, width: nw / natW, height: nh / natH },
          borderThickness:  parseFloat(thick.toFixed(1)),
          confidence: conf,
          imageSegment,
        });
      }

      // ── 7. Sort reading order and assign names ────────────────────────────
      widgets.sort(
        (a, b) => a.pixelBounds.y - b.pixelBounds.y || a.pixelBounds.x - b.pixelBounds.x
      );
      widgets.forEach((w, i) => { w.name = `Widget ${i + 1}`; });

      resolve({ widgets, imageWidth: natW, imageHeight: natH });
    };

    img.onerror = () => reject(new Error('Image load failed in red-border detector'));
    // Allow SVG data-URLs to paint cross-origin-free
    img.src = imageUrl;
  });
}
