'use client';

import React, { memo, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  TriangleAlert,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import type { CanonicalComponent } from '@/types/canonical';
import type { ComponentType } from '@/types';
import type { MappingOverride } from '@/services/schemaTransformer';
import type { AIMappingSuggestion } from '@/services/aiService';
import {
  flattenCanonicalTree,
} from '@/services/schemaTransformer';
import {
  ALL_CANONICAL_TYPES,
  CANONICAL_TO_TARGET,
} from '@/config/schemaMappings';
import { cn } from '@/utils/cn';

const TARGET_TYPES: ComponentType[] = [
  'Container',
  'TextInput',
  'Button',
  'Dropdown',
  'Text',
];

interface MappingPanelProps {
  intermediateSchema: CanonicalComponent[];
  overrides: Map<string, MappingOverride>;
  onOverrideChange: (id: string, override: Partial<MappingOverride>) => void;
  useAI: boolean;
  onToggleAI: () => void;
  aiLoading: boolean;
  onRunAI: () => void;
  aiSuggestions: AIMappingSuggestion[] | null;
}

const DEPTH_INDENT = 20;

const TYPE_COLORS: Record<string, string> = {
  Container: 'bg-blue-100 text-blue-700',
  TextField: 'bg-green-100 text-green-700',
  TextArea: 'bg-teal-100 text-teal-700',
  Button: 'bg-purple-100 text-purple-700',
  Dropdown: 'bg-yellow-100 text-yellow-700',
  Label: 'bg-pink-100 text-pink-700',
  Checkbox: 'bg-orange-100 text-orange-700',
  RadioGroup: 'bg-cyan-100 text-cyan-700',
  DatePicker: 'bg-rose-100 text-rose-700',
  Unknown: 'bg-slate-200 text-slate-600',
};

export const MappingPanel = memo(function MappingPanel({
  intermediateSchema,
  overrides,
  onOverrideChange,
  useAI,
  onToggleAI,
  aiLoading,
  onRunAI,
  aiSuggestions,
}: MappingPanelProps) {
  const flatNodes = useMemo(
    () => flattenCanonicalTree(intermediateSchema),
    [intermediateSchema]
  );

  const getSuggestion = useCallback(
    (sourceType: string | undefined) =>
      aiSuggestions?.find((s) => s.sourceType === sourceType) ?? null,
    [aiSuggestions]
  );

  if (flatNodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
        No intermediate schema loaded yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0">
        <h3 className="text-sm font-semibold text-slate-700">
          Mapping Configuration — {flatNodes.length} components
        </h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600">
            <input
              type="checkbox"
              checked={useAI}
              onChange={onToggleAI}
              className="rounded accent-purple-600"
            />
            AI Assist
          </label>
          {useAI && (
            <button
              onClick={onRunAI}
              disabled={aiLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-600 text-white text-xs font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {aiLoading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Sparkles size={12} />
              )}
              Suggest Mappings
            </button>
          )}
        </div>
      </div>

      {/* AI suggestion banner */}
      {useAI && aiSuggestions && (
        <div className="px-5 py-2 bg-purple-50 border-b border-purple-100 text-xs text-purple-700 flex items-center gap-1.5 flex-shrink-0">
          <Sparkles size={12} />
          AI generated {aiSuggestions.length} suggestions — apply by selecting
          from the dropdowns below.
        </div>
      )}

      {/* Column headers */}
      <div className="grid grid-cols-[2fr_1fr_20px_1fr_1fr_2fr] gap-2 px-5 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex-shrink-0">
        <span>Component</span>
        <span>Canonical Type</span>
        <span></span>
        <span>Target Type</span>
        <span>Binding</span>
        <span>Mapping Rule</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {flatNodes.map(({ node, depth, path }) => {
          const override = overrides.get(node.id);
          const derivedTarget =
            override?.overrideTargetType ??
            CANONICAL_TO_TARGET[node.type] ??
            'Text';
          const suggestion = getSuggestion(node._meta.sourceType);
          const hasSuggestion =
            suggestion &&
            (suggestion.suggestedCanonicalType !== node.type ||
              suggestion.suggestedTargetType !== derivedTarget);

          return (
            <div
              key={node.id}
              className={cn(
                'grid grid-cols-[2fr_1fr_20px_1fr_1fr_2fr] gap-2 items-center',
                'px-5 py-2 border-b border-slate-100 hover:bg-slate-50',
                'text-sm transition-colors'
              )}
            >
              {/* Component label */}
              <div
                className="flex items-center gap-1.5 min-w-0"
                style={{ paddingLeft: depth * DEPTH_INDENT }}
              >
                {node._meta.unmapped && (
                  <TriangleAlert size={12} className="text-yellow-500 flex-shrink-0" />
                )}
                <span className="font-mono text-xs text-slate-500 flex-shrink-0">
                  {node._meta.sourceType}
                </span>
                <span className="text-slate-400 text-xs truncate" title={node.label}>
                  {node.label && node.label !== node._meta.sourceType
                    ? `"${node.label}"`
                    : ''}
                </span>
              </div>

              {/* Canonical type override */}
              <select
                className={cn(
                  'text-xs px-2 py-1 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300',
                  TYPE_COLORS[node.type] ?? 'bg-slate-100 text-slate-700'
                )}
                value={node.type}
                onChange={(e) =>
                  onOverrideChange(node.id, {
                    overrideTargetType:
                      CANONICAL_TO_TARGET[e.target.value as CanonicalComponent['type']] ?? 'Text',
                  })
                }
              >
                {ALL_CANONICAL_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {/* Arrow */}
              <ArrowRight size={12} className="text-slate-300" />

              {/* Target type override */}
              <select
                className="text-xs px-2 py-1 rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                value={derivedTarget}
                onChange={(e) =>
                  onOverrideChange(node.id, {
                    overrideTargetType: e.target.value as ComponentType,
                  })
                }
              >
                {TARGET_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {/* Binding */}
              <span className="text-xs font-mono text-indigo-500 truncate">
                {node.bindings.field ? `.${node.bindings.field}` : ''}
              </span>

              {/* Mapping rule / AI suggestion */}
              <div className="text-xs text-slate-400 truncate flex items-center gap-1.5">
                {hasSuggestion && (
                  <button
                    onClick={() =>
                      onOverrideChange(node.id, {
                        overrideTargetType: suggestion.suggestedTargetType,
                      })
                    }
                    title={`AI: ${suggestion.reason} (confidence: ${Math.round(suggestion.confidence * 100)}%)`}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 hover:bg-purple-200 flex-shrink-0"
                  >
                    <Sparkles size={9} />
                    <span>{suggestion.suggestedTargetType}</span>
                  </button>
                )}
                <span className="truncate" title={node._meta.mappingRule ?? ''}>
                  {node._meta.mappingRule ?? 'No mapping'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Validations summary */}
      <div className="px-5 py-2 border-t border-slate-200 bg-slate-50 flex-shrink-0">
        <p className="text-[11px] text-slate-400">
          <CheckCircle2 size={10} className="inline mr-1 text-green-500" />
          {flatNodes.filter((n) => !n.node._meta.unmapped).length} mapped •
          <TriangleAlert size={10} className="inline mx-1 text-yellow-500" />
          {flatNodes.filter((n) => n.node._meta.unmapped).length} unmapped — click a row&apos;s
          canonical type to override before generating.
        </p>
      </div>
    </div>
  );
});
