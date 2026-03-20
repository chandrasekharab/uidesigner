'use client';

import React, { memo, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  TriangleAlert,
  CheckCircle2,
  ArrowRight,
  Rows3,
  Columns2,
  Columns3,
  LayoutGrid,
  PanelTop,
  MessageCircle,
  Paperclip,
  ListChecks,
  Table,
  ClipboardList,
  FileText,
  Frame,
  Square,
  AlignHorizontalSpaceAround,
} from 'lucide-react';
import type { CanonicalComponent, CanonicalCategory } from '@/types/canonical';
import type { ComponentType } from '@/types';
import type { MappingOverride, TargetFormat } from '@/services/schemaTransformer';
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
  targetFormat: TargetFormat;
  onTargetFormatChange: (f: TargetFormat) => void;
}

const DEPTH_INDENT = 20;

const TYPE_COLORS: Record<string, string> = {
  // Field types
  Container: 'bg-blue-100 text-blue-700',
  TextField: 'bg-green-100 text-green-700',
  TextArea: 'bg-teal-100 text-teal-700',
  Button: 'bg-purple-100 text-purple-700',
  Dropdown: 'bg-yellow-100 text-yellow-700',
  Label: 'bg-pink-100 text-pink-700',
  Checkbox: 'bg-orange-100 text-orange-700',
  RadioGroup: 'bg-cyan-100 text-cyan-700',
  DatePicker: 'bg-rose-100 text-rose-700',
  // Layout types
  SingleColumn:    'bg-blue-50 text-blue-600',
  TwoColumn:       'bg-indigo-100 text-indigo-700',
  ThreeColumn:     'bg-violet-100 text-violet-700',
  FourColumn:      'bg-purple-100 text-purple-600',
  InlineLayout:    'bg-sky-100 text-sky-700',
  TabsLayout:      'bg-cyan-100 text-cyan-700',
  AccordionLayout: 'bg-teal-100 text-teal-600',
  Section:         'bg-slate-100 text-slate-600',
  // Widget types
  PulseWidget:       'bg-emerald-100 text-emerald-700',
  AttachmentsWidget: 'bg-amber-100 text-amber-700',
  StepsWidget:       'bg-lime-100 text-lime-700',
  DataGrid:          'bg-orange-100 text-orange-700',
  CaseSummary:       'bg-red-100 text-red-700',
  RichTextWidget:    'bg-fuchsia-100 text-fuchsia-700',
  EmbeddedView:      'bg-cyan-100 text-cyan-600',
  // Fallback
  Unknown: 'bg-slate-200 text-slate-600',
};

/** Category badge styles */
const CATEGORY_COLORS: Record<CanonicalCategory, string> = {
  field:   'bg-slate-100 text-slate-500 border border-slate-200',
  layout:  'bg-blue-50  text-blue-600  border border-blue-200',
  widget:  'bg-emerald-50 text-emerald-600 border border-emerald-200',
};

/** Widget/layout icon components keyed by canonical type */
const TYPE_ICON: Record<string, React.ReactNode> = {
  // Layouts
  SingleColumn:    <Rows3 size={11} />,
  TwoColumn:       <Columns2 size={11} />,
  ThreeColumn:     <Columns3 size={11} />,
  FourColumn:      <LayoutGrid size={11} />,
  InlineLayout:    <AlignHorizontalSpaceAround size={11} />,
  TabsLayout:      <PanelTop size={11} />,
  AccordionLayout: <Square size={11} />,
  Section:         <Square size={11} />,
  // Widgets
  PulseWidget:       <MessageCircle size={11} />,
  AttachmentsWidget: <Paperclip size={11} />,
  StepsWidget:       <ListChecks size={11} />,
  DataGrid:          <Table size={11} />,
  CaseSummary:       <ClipboardList size={11} />,
  RichTextWidget:    <FileText size={11} />,
  EmbeddedView:      <Frame size={11} />,
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
  targetFormat,
  onTargetFormatChange,
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
      <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
        No intermediate schema loaded yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Mapping Configuration — {flatNodes.length} components
        </h3>
        <div className="flex items-center gap-3">
          {/* Output format toggle */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => onTargetFormatChange('native')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs transition-colors',
                targetFormat === 'native'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-700 dark:text-slate-100 font-medium'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              Native
            </button>
            <button
              onClick={() => onTargetFormatChange('a2ui')}
              className={cn(
                'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs transition-colors',
                targetFormat === 'a2ui'
                  ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 font-semibold'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
              )}
            >
              <ArrowRight size={10} />Google A2UI
            </button>
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
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
      <div className="grid grid-cols-[2fr_1fr_20px_1fr_1fr_2fr] gap-2 px-5 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex-shrink-0">
        <span>Component</span>
        <span>Canonical Type</span>
        <span></span>
        <span>Target Type</span>
        <span>Binding</span>
        <span>Mapping Rule</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto min-h-0">
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

          const category: CanonicalCategory = node.category ?? 'field';
          const isLayout = category === 'layout';
          const isWidget = category === 'widget';
          const typeIcon = TYPE_ICON[node.type];

          return (
            <div
              key={node.id}
              className={cn(
                'grid grid-cols-[2fr_1fr_20px_1fr_1fr_2fr] gap-2 items-start',
                'px-5 py-2 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50',
                'text-sm transition-colors',
                isLayout && 'bg-blue-50/30 dark:bg-blue-950/20',
                isWidget && 'bg-emerald-50/30 dark:bg-emerald-950/20'
              )}
            >
              {/* Component label + category badge */}
              <div
                className="flex flex-wrap items-center gap-1 min-w-0 pt-0.5"
                style={{ paddingLeft: depth * DEPTH_INDENT }}
              >
                {node._meta.unmapped && (
                  <TriangleAlert size={12} className="text-yellow-500 flex-shrink-0" />
                )}
                {/* Category badge */}
                <span className={cn(
                  'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0',
                  CATEGORY_COLORS[category]
                )}>
                  {typeIcon}
                  {category}
                </span>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                  {node._meta.sourceType}
                </span>
                <span className="text-slate-400 dark:text-slate-500 text-xs truncate" title={node.label}>
                  {node.label && node.label !== node._meta.sourceType
                    ? `"${node.label}"`
                    : ''}
                </span>
                {/* Layout config badge */}
                {isLayout && node.layoutConfig && (
                  <span className="text-[10px] text-blue-500 bg-blue-50 border border-blue-100 rounded px-1 py-0.5 flex-shrink-0">
                    {node.layoutConfig.columns
                      ? `${node.layoutConfig.columns}col`
                      : node.layoutConfig.layoutType ?? ''}
                  </span>
                )}
                {/* Widget data source indicator */}
                {isWidget && node.dataSource && (
                  <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 rounded px-1 py-0.5 flex-shrink-0">
                    {node.dataSource.sourceClass ?? node.dataSource.property ?? 'data'}
                  </span>
                )}
              </div>

              {/* Canonical type override */}
              <select
                className={cn(
                  'text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-300',
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
              <ArrowRight size={12} className="text-slate-300 dark:text-slate-600 mt-1" />

              {/* Target type override */}
              <select
                className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-300"
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
              <span className="text-xs font-mono text-indigo-500 truncate pt-0.5">
                {node.bindings.field ? `.${node.bindings.field}` : ''}
              </span>

              {/* Mapping rule / AI suggestion */}
              <div className="text-xs text-slate-400 dark:text-slate-500 truncate flex items-start gap-1.5 pt-0.5">
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
      <div className="px-5 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          <CheckCircle2 size={10} className="inline mr-1 text-green-500" />
          {flatNodes.filter((n) => !n.node._meta.unmapped).length} mapped •
          <TriangleAlert size={10} className="inline mx-1 text-yellow-500" />
          {flatNodes.filter((n) => n.node._meta.unmapped).length} unmapped —
          <span className="text-blue-500 ml-1">
            {flatNodes.filter((n) => (n.node.category ?? 'field') === 'layout').length} layouts
          </span>
          <span className="text-emerald-500 ml-1">
            {flatNodes.filter((n) => (n.node.category ?? 'field') === 'widget').length} widgets
          </span>
        </p>
      </div>
    </div>
  );
});
