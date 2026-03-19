'use client';

// ─── WidgetExtractionPanel ────────────────────────────────────────────────────
// Shows the output of the red-border pixel detector:
//   • A responsive thumbnail grid of every extracted widget
//   • A formatted JSON view of the detection metadata
//   • Copy / Download buttons for the JSON
//   • "Load into Drawing Flow" CTA to continue the full mapping pipeline

import React, { memo, useState } from 'react';
import {
  Copy,
  Download,
  CheckCircle2,
  ImageIcon,
  ChevronRight,
  ScanSearch,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { DetectedWidget } from '@/utils/redBorderDetector';

// ─── Props ────────────────────────────────────────────────────────────────────

interface WidgetExtractionPanelProps {
  widgets: DetectedWidget[];
  imageWidth: number;
  imageHeight: number;
  fileName: string;
  /** Called when the user clicks "Load into Drawing Flow" */
  onContinue: () => void;
}

// ─── JSON shape (segments excluded — too verbose) ─────────────────────────────

function buildOutputJson(
  widgets: DetectedWidget[],
  imageWidth: number,
  imageHeight: number,
  fileName: string,
) {
  return {
    source:      fileName,
    detectedAt:  new Date().toISOString(),
    imageSize:   { width: imageWidth, height: imageHeight },
    widgetCount: widgets.length,
    widgets: widgets.map(({ id, name, pixelBounds, normalizedBounds, borderThickness, confidence }) => ({
      id,
      name,
      pixelBounds: {
        x:      pixelBounds.x,
        y:      pixelBounds.y,
        width:  pixelBounds.width,
        height: pixelBounds.height,
      },
      normalizedBounds: {
        x:      parseFloat(normalizedBounds.x.toFixed(4)),
        y:      parseFloat(normalizedBounds.y.toFixed(4)),
        width:  parseFloat(normalizedBounds.width.toFixed(4)),
        height: parseFloat(normalizedBounds.height.toFixed(4)),
      },
      borderThickness,
      confidence,
    })),
  };
}

// ─── Confidence pill ──────────────────────────────────────────────────────────

function ConfPill({ v }: { v: number }) {
  const pct   = Math.round(v * 100);
  const color = v >= 0.8 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
              : v >= 0.6 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              :             'bg-red-100   text-red-700   dark:bg-red-900/30   dark:text-red-300';
  return (
    <span className={cn('inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded', color)}>
      {pct}%
    </span>
  );
}

// ─── WidgetExtractionPanel ────────────────────────────────────────────────────

export const WidgetExtractionPanel = memo(function WidgetExtractionPanel({
  widgets,
  imageWidth,
  imageHeight,
  fileName,
  onContinue,
}: WidgetExtractionPanelProps) {
  const [tab,    setTab]    = useState<'grid' | 'json'>('grid');
  const [copied, setCopied] = useState(false);

  const outputJson = buildOutputJson(widgets, imageWidth, imageHeight, fileName);
  const jsonStr    = JSON.stringify(outputJson, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${fileName.replace(/\.[^.]+$/, '')}-widgets.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden">

      {/* ── Header bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shrink-0 flex-wrap gap-y-1.5">

        <ScanSearch size={15} className="text-teal-500 shrink-0" />
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {widgets.length} widget{widgets.length !== 1 ? 's' : ''} detected
        </span>
        <span className="text-xs text-slate-400">from red borders in <span className="font-mono">{fileName}</span></span>

        {/* Tabs */}
        <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 gap-0.5 ml-3">
          <button
            onClick={() => setTab('grid')}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-semibold transition-all',
              tab === 'grid'
                ? 'bg-white dark:bg-slate-700 text-indigo-700 dark:text-indigo-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            Widgets
          </button>
          <button
            onClick={() => setTab('json')}
            className={cn(
              'px-3 py-1 rounded-md text-xs font-semibold transition-all',
              tab === 'json'
                ? 'bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            )}
          >
            JSON
          </button>
        </div>

        <div className="flex-1" />

        {/* JSON actions */}
        {tab === 'json' && (
          <>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Copy size={12} />
              {copied ? 'Copied!' : 'Copy JSON'}
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Download size={12} /> Download
            </button>
          </>
        )}

        <button
          onClick={onContinue}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shrink-0"
        >
          Edit &amp; Map Regions <ChevronRight size={12} />
        </button>
      </div>

      {/* ── Widgets grid ────────────────────────────────────────────────────── */}
      {tab === 'grid' && (
        <div className="flex-1 overflow-y-auto p-4">
          {widgets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16">
              <ScanSearch size={32} className="text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm font-medium text-slate-500">No red-bordered widgets found</p>
              <p className="text-xs text-slate-400 mt-1">
                Ensure your image has clearly drawn red rectangles around each widget.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {widgets.map((w) => (
                <div
                  key={w.id}
                  className="flex flex-col rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-800 hover:shadow-md transition-shadow"
                >
                  {/* Thumbnail */}
                  {w.imageSegment ? (
                    <img
                      src={w.imageSegment}
                      alt={w.name}
                      className="w-full h-32 object-cover border-b border-slate-100 dark:border-slate-700"
                    />
                  ) : (
                    <div className="h-32 flex items-center justify-center bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600">
                      <ImageIcon size={22} className="text-slate-400" />
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="p-2.5 flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {w.name}
                      </span>
                      <ConfPill v={w.confidence} />
                    </div>

                    {/* Pixel size */}
                    <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {w.pixelBounds.width} × {w.pixelBounds.height} px
                    </p>

                    {/* Position */}
                    <p className="text-[10px] text-slate-400">
                      @{w.pixelBounds.x},{w.pixelBounds.y}px &nbsp;·&nbsp;
                      {Math.round(w.normalizedBounds.x * 100)}%,{Math.round(w.normalizedBounds.y * 100)}%
                    </p>

                    {/* Border thickness */}
                    <p className="text-[10px] text-slate-400">
                      Border ≈ {w.borderThickness}px
                    </p>

                    {/* Normalised bbox */}
                    <p className="text-[10px] font-mono text-slate-400 leading-snug">
                      {w.normalizedBounds.x.toFixed(3)}, {w.normalizedBounds.y.toFixed(3)},&nbsp;
                      {w.normalizedBounds.width.toFixed(3)} × {w.normalizedBounds.height.toFixed(3)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── JSON output ─────────────────────────────────────────────────────── */}
      {tab === 'json' && (
        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-2">
          <p className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
            Detection metadata for {widgets.length} widget{widgets.length !== 1 ? 's' : ''}.
            Image segments are shown as thumbnails above and excluded from this JSON for brevity.
          </p>
          <pre className="flex-1 overflow-auto text-[11px] font-mono bg-slate-900 text-green-300 p-4 rounded-xl leading-relaxed">
            {jsonStr}
          </pre>
        </div>
      )}
    </div>
  );
});
