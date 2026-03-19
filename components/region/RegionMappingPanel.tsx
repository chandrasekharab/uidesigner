'use client';

// ─── RegionMappingPanel ───────────────────────────────────────────────────────
// Three-column mapping interface:
//   Left   — selected region info + cropped image preview
//   Center — AI analysis result with detected type and confidence
//   Right  — schema mapping controls (category, type, pega type)
//
// Allows full user override at every step.

import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  Wand2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Lightbulb,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Region, RegionMappedSchema, RegionMappingCategory, RegionDetectedType } from '@/types/region';
import { suggestRegionSchemaMapping, detectRegionType } from '@/services/aiService';
import { SCHEMA_MAPPING_OPTIONS } from '@/data/mockRegionSamples';

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  const pct  = Math.round(value * 100);
  const color = value > 0.8 ? 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
              : value > 0.6 ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400'
              : 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold', color)}>
      {pct}% confidence
    </span>
  );
}

// ─── RegionMappingPanel ───────────────────────────────────────────────────────

interface RegionMappingPanelProps {
  region: Region | null;
  onUpdateMapping: (regionId: string, schema: RegionMappedSchema) => void;
}

export const RegionMappingPanel = memo(function RegionMappingPanel({
  region, onUpdateMapping,
}: RegionMappingPanelProps) {
  const [analysing,  setAnalysing]  = useState(false);
  const [analysisResult, setAnalysisResult] = useState<{
    detectedType: RegionDetectedType;
    confidence: number;
    reason: string;
  } | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<RegionMappedSchema | null>(null);
  const [suggestionReason, setSuggestionReason] = useState('');

  // Local mapping state (user can override AI)
  const [category,    setCategory]    = useState<RegionMappingCategory>('layout');
  const [canonicalType, setCanonicalType] = useState('SingleColumn');
  const [pegaType,    setPegaType]    = useState('region');
  const [label,       setLabel]       = useState('');

  // ── Sync local state to current region ─────────────────────────────────────
  useEffect(() => {
    if (!region) {
      setAnalysisResult(null);
      setAiSuggestion(null);
      return;
    }
    if (region.mappedSchema) {
      setCategory(region.mappedSchema.category);
      setCanonicalType(region.mappedSchema.canonicalType);
      setPegaType(region.mappedSchema.pegaType ?? 'region');
      setLabel(region.mappedSchema.label ?? region.name);
    } else {
      setCategory('layout');
      setCanonicalType('SingleColumn');
      setPegaType('region');
      setLabel(region.name);
      setAnalysisResult(null);
      setAiSuggestion(null);
    }
  }, [region?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-run analysis when region changes and has no mapping ───────────────
  useEffect(() => {
    if (region && !region.mappedSchema && !analysing && !analysisResult) {
      runAnalysis();
    }
  }, [region?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const runAnalysis = useCallback(async () => {
    if (!region) return;
    setAnalysing(true);
    try {
      const [typeResult, mapResult] = await Promise.all([
        detectRegionType(region.imageSegment, region.name),
        suggestRegionSchemaMapping({ name: region.name, detectedType: region.detectedType }),
      ]);
      setAnalysisResult({ detectedType: typeResult.type, confidence: typeResult.confidence, reason: typeResult.reason });
      setAiSuggestion(mapResult.mapping);
      setSuggestionReason(mapResult.reason);

      // Pre-fill the form with the suggestion
      setCategory(mapResult.mapping.category);
      setCanonicalType(mapResult.mapping.canonicalType);
      setPegaType(mapResult.mapping.pegaType ?? 'region');
      setLabel(mapResult.mapping.label ?? region.name);
    } finally {
      setAnalysing(false);
    }
  }, [region]);

  const applyMapping = useCallback(() => {
    if (!region) return;
    const schema: RegionMappedSchema = {
      category,
      canonicalType,
      pegaType: pegaType || undefined,
      label: label || region.name,
    };
    onUpdateMapping(region.id, schema);
  }, [region, category, canonicalType, pegaType, label, onUpdateMapping]);

  const applySuggestion = useCallback(() => {
    if (!region || !aiSuggestion) return;
    setCategory(aiSuggestion.category);
    setCanonicalType(aiSuggestion.canonicalType);
    setPegaType(aiSuggestion.pegaType ?? 'region');
    setLabel(aiSuggestion.label ?? region.name);
  }, [region, aiSuggestion]);

  // ── When category changes, reset canonical selection ───────────────────────
  const handleCategoryChange = (cat: RegionMappingCategory) => {
    setCategory(cat);
    const opts = SCHEMA_MAPPING_OPTIONS[cat];
    if (opts.length > 0) {
      setCanonicalType(opts[0].value);
      setPegaType(opts[0].pegaType);
    }
  };

  // ── When canonical type changes, sync pega type ────────────────────────────
  const handleCanonicalChange = (val: string) => {
    setCanonicalType(val);
    const opts = SCHEMA_MAPPING_OPTIONS[category] ?? [];
    const found = opts.find((o) => o.value === val);
    if (found) setPegaType(found.pegaType);
  };

  if (!region) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Wand2 size={32} className="text-slate-300 dark:text-slate-600 mb-2" />
        <p className="text-sm text-slate-400">Select a region to map it.</p>
      </div>
    );
  }

  const mappingOptions = SCHEMA_MAPPING_OPTIONS[category] ?? [];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white dark:bg-slate-900">
      {/* ── Region summary ─────────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: region.color }} />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
            {region.name}
          </span>
          {region.mappedSchema && <CheckCircle2 size={13} className="text-green-500 shrink-0" />}
        </div>
        {region.imageSegment && (
          <img
            src={region.imageSegment}
            alt={`Preview of ${region.name}`}
            className="w-full rounded border border-slate-200 dark:border-slate-700 object-cover max-h-24 mt-1"
          />
        )}
      </div>

      {/* ── AI Analysis ────────────────────────────────────────────────────── */}
      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            AI Analysis
          </span>
          <button
            onClick={runAnalysis}
            disabled={analysing}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 disabled:opacity-50"
          >
            {analysing
              ? <><Loader2 size={10} className="animate-spin" /> Analysing…</>
              : <><RefreshCw size={10} /> Re-run</>
            }
          </button>
        </div>

        {analysing && (
          <div className="flex items-center gap-2 py-2 text-xs text-slate-400">
            <Loader2 size={12} className="animate-spin text-indigo-400" />
            Detecting region type…
          </div>
        )}

        {analysisResult && !analysing && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                {analysisResult.detectedType}
              </span>
              <ConfidenceBadge value={analysisResult.confidence} />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              {analysisResult.reason}
            </p>

            {aiSuggestion && (
              <div className="mt-2 p-2 rounded bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800">
                <div className="flex items-start gap-1.5">
                  <Lightbulb size={11} className="text-indigo-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                      Suggested: {aiSuggestion.canonicalType}
                    </p>
                    <p className="text-[10px] text-indigo-500 dark:text-indigo-400">{suggestionReason}</p>
                  </div>
                </div>
                <button
                  onClick={applySuggestion}
                  className="mt-1.5 w-full text-[11px] px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  Apply suggestion
                </button>
              </div>
            )}
          </div>
        )}

        {!analysisResult && !analysing && (
          <button
            onClick={runAnalysis}
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 py-1 transition-colors"
          >
            <Wand2 size={11} /> Analyse this region
          </button>
        )}
      </div>

      {/* ── Mapping form ───────────────────────────────────────────────────── */}
      <div className="flex-1 px-3 py-2 space-y-3">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
          Schema Mapping
        </span>

        {/* Category */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Category
          </label>
          <div className="flex gap-1">
            {(['layout', 'widget', 'fieldGroup'] as RegionMappingCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={cn(
                  'flex-1 py-1 rounded text-[11px] font-medium border transition-colors capitalize',
                  category === cat
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Canonical type */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Type
          </label>
          <select
            value={canonicalType}
            onChange={(e) => handleCanonicalChange(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          >
            {mappingOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Pega type */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Pega Type
          </label>
          <input
            value={pegaType}
            onChange={(e) => setPegaType(e.target.value)}
            className="w-full px-2 py-1.5 text-xs font-mono border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>

        {/* Label */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
            Schema Label
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
        </div>
      </div>

      {/* ── Apply button ────────────────────────────────────────────────────── */}
      <div className="px-3 pb-3 shrink-0">
        <button
          onClick={applyMapping}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <CheckCircle2 size={14} />
          {region.mappedSchema ? 'Update Mapping' : 'Apply Mapping'}
        </button>
        {region.mappedSchema && (
          <p className="text-[10px] text-slate-400 text-center mt-1">
            Already mapped — click to update.
          </p>
        )}
      </div>
    </div>
  );
});
