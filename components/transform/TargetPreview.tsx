'use client';

import React, { memo } from 'react';
import dynamic from 'next/dynamic';
import { Download, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';
import type { UIComponent } from '@/types';
import { ComponentRenderer } from '@/components/ComponentRenderer';
import { cn } from '@/utils/cn';

const LazyEditor = dynamic(() => import('@/components/CodeMirrorEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#282c34]">
      <Loader2 size={16} className="animate-spin text-slate-400" />
    </div>
  ),
});

interface TargetPreviewProps {
  targetJSON: string;
  targetComponents: UIComponent[];
  onLoadToCanvas: () => void;
  onExport: () => void;
}

export const TargetPreview = memo(function TargetPreview({
  targetJSON,
  targetComponents,
  onLoadToCanvas,
  onExport,
}: TargetPreviewProps) {
  if (!targetJSON) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm p-8 text-center">
        <div>
          <div className="text-4xl mb-3">⚡</div>
          <p className="font-medium">Target schema not generated yet.</p>
          <p className="text-xs mt-1">Go back and click &ldquo;Generate Target&rdquo; to continue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" />
          <h3 className="text-sm font-semibold text-slate-700">
            Target UI Schema — {targetComponents.length} root component
            {targetComponents.length !== 1 ? 's' : ''}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
          >
            <Download size={13} />
            Export JSON
          </button>
          <button
            onClick={onLoadToCanvas}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            <ArrowRight size={13} />
            Load to Canvas
          </button>
        </div>
      </div>

      {/* Two-column: JSON + Canvas Preview */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: JSON output */}
        <div className="w-1/2 flex flex-col border-r border-slate-200">
          <div className="px-4 py-2 bg-slate-800 border-b border-slate-700">
            <span className="text-[11px] text-slate-400 font-mono uppercase tracking-wider">
              Generated JSON
            </span>
          </div>
          <div className="flex-1 overflow-hidden">
            <LazyEditor
              value={targetJSON}
              onChange={() => {}}
              readOnly
            />
          </div>
        </div>

        {/* Right: Canvas Preview */}
        <div className="w-1/2 flex flex-col">
          <div className="px-4 py-2 bg-white border-b border-slate-200">
            <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
              Canvas Preview
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-2">
            {targetComponents.map((c) => (
              <ComponentRenderer
                key={c.id}
                component={c}
                onSelect={() => {}}
                previewMode
              />
            ))}
          </div>
        </div>
      </div>

      {/* Success banner */}
      <div className="px-5 py-2.5 bg-green-50 border-t border-green-200 flex-shrink-0">
        <p className="text-xs text-green-700">
          <strong>Transformation complete.</strong> Click{' '}
          <strong>&ldquo;Load to Canvas&rdquo;</strong> to open the generated UI in the builder for
          further editing, or <strong>&ldquo;Export JSON&rdquo;</strong> to download.
        </p>
      </div>
    </div>
  );
});
