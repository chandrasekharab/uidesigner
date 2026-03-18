'use client';

import React, { memo } from 'react';
import dynamic from 'next/dynamic';
import {
  CheckCircle2,
  AlertCircle,
  TriangleAlert,
  Loader2,
  GitBranch,
} from 'lucide-react';
import type { MappingValidationResult } from '@/services/schemaTransformer';
import { cn } from '@/utils/cn';

const LazyEditor = dynamic(() => import('@/components/CodeMirrorEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#282c34]">
      <Loader2 size={16} className="animate-spin text-slate-400" />
    </div>
  ),
});

interface IntermediateEditorProps {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  editError: string | null;
  validation: MappingValidationResult | null;
}

export const IntermediateEditor = memo(function IntermediateEditor({
  value,
  onChange,
  onBlur,
  editError,
  validation,
}: IntermediateEditorProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <GitBranch size={16} className="text-indigo-500" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Intermediate Canonical Schema
          </h3>
        </div>
        {validation && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400 dark:text-slate-500">
              {validation.totalNodes} nodes
            </span>
            <span className="text-green-600 font-medium">
              {validation.mappedNodes} mapped
            </span>
            {validation.unmappedNodes > 0 && (
              <span className="text-yellow-600 font-medium">
                {validation.unmappedNodes} unmapped
              </span>
            )}
          </div>
        )}
      </div>

      {/* Edit error */}
      {editError && (
        <div className="flex items-center gap-2 px-5 py-1.5 text-xs font-medium bg-red-950/40 text-red-300 border-b border-red-900">
          <AlertCircle size={12} /> {editError}
        </div>
      )}

      {/* Description */}
      <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100">
        <p className="text-xs text-indigo-700 leading-relaxed">
          This is the platform&apos;s <strong>canonical intermediate schema</strong> — the
          transformation contract between Pega and the target design system. You can edit it
          directly. Changes reflect instantly in the mapping table and target preview.
        </p>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <LazyEditor value={value} onChange={onChange} onBlur={onBlur} />
      </div>

      {/* Validation panel */}
      {validation && (validation.warnings.length > 0 || validation.errors.length > 0) && (
        <div className="border-t border-slate-700 bg-slate-900 max-h-40 overflow-y-auto p-3 space-y-1">
          {validation.errors.map((e, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-red-300">
              <AlertCircle size={11} className="mt-0.5 flex-shrink-0" />
              <span className="font-mono">{e}</span>
            </div>
          ))}
          {validation.warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-yellow-300">
              <TriangleAlert size={11} className="mt-0.5 flex-shrink-0" />
              <span className="font-mono">{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
