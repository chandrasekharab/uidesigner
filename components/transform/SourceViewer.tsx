'use client';

import React, { memo } from 'react';
import dynamic from 'next/dynamic';
import { FileJson, FlaskConical, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';

const LazyEditor = dynamic(() => import('@/components/CodeMirrorEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#282c34]">
      <Loader2 size={16} className="animate-spin text-slate-400" />
    </div>
  ),
});

interface SourceViewerProps {
  value: string;
  onChange: (v: string) => void;
  parseError: string | null;
  onParse: () => void;
  onLoadSample: () => void;
  isParsed: boolean;
}

export const SourceViewer = memo(function SourceViewer({
  value,
  onChange,
  parseError,
  onParse,
  onLoadSample,
  isParsed,
}: SourceViewerProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <FileJson size={16} className="text-orange-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Source: Pega Constellation JSON
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onLoadSample}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-200 transition-colors"
          >
            Load Sample
          </button>
          <button
            onClick={onParse}
            disabled={!value.trim()}
            className="px-3 py-1.5 text-xs font-medium rounded-md bg-orange-600 hover:bg-orange-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Parse →
          </button>
        </div>
      </div>

      {/* Status bar */}
      {(parseError || isParsed) && (
        <div
          className={cn(
            'flex items-center gap-2 px-5 py-1.5 text-xs font-medium',
            parseError
              ? 'bg-red-950/40 text-red-300 border-b border-red-900'
              : 'bg-green-950/40 text-green-300 border-b border-green-900'
          )}
        >
          {parseError ? (
            <>
              <AlertCircle size={12} /> {parseError}
            </>
          ) : (
            <>
              <CheckCircle2 size={12} /> Valid JSON — ready to parse
            </>
          )}
        </div>
      )}

      {/* Description */}
      <div className="px-5 py-3 bg-orange-50 border-b border-orange-100">
        <div className="flex items-start gap-2">
          <FlaskConical size={14} className="text-orange-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-orange-700 leading-relaxed">
            Paste your Pega Constellation View JSON below, or click{' '}
            <strong>Load Sample</strong> to use a pre-built example. Then click{' '}
            <strong>Parse →</strong> to generate the intermediate canonical schema.
          </p>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <LazyEditor
          value={value}
          onChange={onChange}
        />
      </div>
    </div>
  );
});
