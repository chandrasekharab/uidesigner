'use client';

import React, { memo, useState, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileJson,
  GitBranch,
  SlidersHorizontal,
  Layers,
  CheckCircle2,
} from 'lucide-react';

import { useBuilderStore } from '@/store/builderStore';
import { SourceViewer } from './SourceViewer';
import { IntermediateEditor } from './IntermediateEditor';
import { MappingPanel } from './MappingPanel';
import { TargetPreview } from './TargetPreview';
import { PEGA_SAMPLE_STRING } from '@/data/pegaSample';
import {
  parsePegaToIntermediate,
  transformIntermediateToTarget,
  validateMappings,
  type MappingOverride,
  type MappingValidationResult,
} from '@/services/schemaTransformer';
import { suggestMappings, type AIMappingSuggestion } from '@/services/aiService';
import type { CanonicalComponent } from '@/types/canonical';
import type { UIComponent } from '@/types';
import { cn } from '@/utils/cn';

// ─── Step Definition ──────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

const STEPS: { id: Step; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: 1,
    label: 'Source',
    icon: <FileJson size={14} />,
    description: 'Paste or load Pega Constellation JSON',
  },
  {
    id: 2,
    label: 'Intermediate',
    icon: <GitBranch size={14} />,
    description: 'Review & edit the canonical schema',
  },
  {
    id: 3,
    label: 'Map',
    icon: <SlidersHorizontal size={14} />,
    description: 'Configure component type mappings',
  },
  {
    id: 4,
    label: 'Preview',
    icon: <Layers size={14} />,
    description: 'Preview target JSON & load to canvas',
  },
];

// ─── State ────────────────────────────────────────────────────────────────────

interface TStudioState {
  step: Step;
  // Step 1
  sourceText: string;
  sourceParseError: string | null;
  isParsed: boolean;
  // Step 2
  intermediateSchema: CanonicalComponent[];
  intermediateText: string;
  intermediateEditError: string | null;
  validation: MappingValidationResult | null;
  // Step 3
  overrides: Map<string, MappingOverride>;
  useAI: boolean;
  aiLoading: boolean;
  aiSuggestions: AIMappingSuggestion[] | null;
  // Step 4
  targetComponents: UIComponent[];
  targetJSON: string;
}

const INIT: TStudioState = {
  step: 1,
  sourceText: '',
  sourceParseError: null,
  isParsed: false,
  intermediateSchema: [],
  intermediateText: '',
  intermediateEditError: null,
  validation: null,
  overrides: new Map(),
  useAI: false,
  aiLoading: false,
  aiSuggestions: null,
  targetComponents: [],
  targetJSON: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const TransformationStudio = memo(function TransformationStudio() {
  const setComponents = useBuilderStore((s) => s.setComponents);
  const setAppMode = useBuilderStore((s) => s.setAppMode);

  const [state, setState] = useState<TStudioState>(INIT);

  // Keep intermediateText + validation in sync when schema changes via editing
  const syncIntermediateFromSchema = useCallback(
    (schema: CanonicalComponent[]) => {
      setState((prev) => ({
        ...prev,
        intermediateSchema: schema,
        intermediateText: JSON.stringify(schema, null, 2),
        validation: validateMappings(schema),
      }));
    },
    []
  );

  // ── Step 1: Parse source JSON ──────────────────────────────────────────────
  const handleParse = useCallback(() => {
    try {
      const parsed = JSON.parse(state.sourceText);
      const schema = parsePegaToIntermediate(parsed);
      setState((prev) => ({
        ...prev,
        sourceParseError: null,
        isParsed: true,
        step: 2,
        intermediateSchema: schema,
        intermediateText: JSON.stringify(schema, null, 2),
        validation: validateMappings(schema),
        overrides: new Map(),
        targetComponents: [],
        targetJSON: '',
      }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        sourceParseError: `Parse error: ${(e as Error).message}`,
        isParsed: false,
      }));
    }
  }, [state.sourceText]);

  const handleLoadSample = useCallback(() => {
    setState((prev) => ({
      ...prev,
      sourceText: PEGA_SAMPLE_STRING,
      sourceParseError: null,
    }));
  }, []);

  // ── Step 2: Edit intermediate JSON ────────────────────────────────────────
  const handleIntermediateChange = useCallback((text: string) => {
    setState((prev) => ({ ...prev, intermediateText: text, intermediateEditError: null }));
    try {
      const parsed = JSON.parse(text) as CanonicalComponent[];
      setState((prev) => ({
        ...prev,
        intermediateSchema: parsed,
        validation: validateMappings(parsed),
        intermediateEditError: null,
      }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        intermediateEditError: `JSON error: ${(e as Error).message}`,
      }));
    }
  }, []);

  const handleIntermediateBlur = useCallback(() => {
    // Reformat on blur if valid
    if (!state.intermediateEditError) {
      setState((prev) => ({
        ...prev,
        intermediateText: JSON.stringify(prev.intermediateSchema, null, 2),
      }));
    }
  }, [state.intermediateEditError]);

  // ── Step 3: Mapping overrides ─────────────────────────────────────────────
  const handleOverrideChange = useCallback(
    (id: string, partial: Partial<MappingOverride>) => {
      setState((prev) => {
        const next = new Map(prev.overrides);
        next.set(id, { ...(prev.overrides.get(id) ?? {}), ...partial });
        return { ...prev, overrides: next };
      });
    },
    []
  );

  const handleToggleAI = useCallback(() => {
    setState((prev) => ({ ...prev, useAI: !prev.useAI, aiSuggestions: null }));
  }, []);

  const handleRunAI = useCallback(async () => {
    setState((prev) => ({ ...prev, aiLoading: true }));
    try {
      const parsed = JSON.parse(state.sourceText);
      const result = await suggestMappings(parsed);
      setState((prev) => ({ ...prev, aiSuggestions: result.suggestions, aiLoading: false }));
    } catch {
      setState((prev) => ({ ...prev, aiLoading: false }));
    }
  }, [state.sourceText]);

  // ── Step 3 → 4: Generate target ───────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    const target = transformIntermediateToTarget(
      state.intermediateSchema,
      state.overrides
    );
    const json = JSON.stringify(target, null, 2);
    setState((prev) => ({
      ...prev,
      step: 4,
      targetComponents: target,
      targetJSON: json,
    }));
  }, [state.intermediateSchema, state.overrides]);

  // ── Step 4: Load to canvas ────────────────────────────────────────────────
  const handleLoadToCanvas = useCallback(() => {
    setComponents(state.targetComponents);
    setAppMode('builder');
  }, [state.targetComponents, setComponents, setAppMode]);

  const handleExport = useCallback(() => {
    const blob = new Blob([state.targetJSON], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transformed-ui-schema.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [state.targetJSON]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const canGoNext = useCallback((): boolean => {
    switch (state.step) {
      case 1:
        return state.intermediateSchema.length > 0 || state.sourceText.trim().length > 0;
      case 2:
        return state.intermediateSchema.length > 0 && !state.intermediateEditError;
      case 3:
        return true;
      case 4:
        return false;
    }
  }, [state]);

  const handleNext = useCallback(() => {
    if (state.step === 1) {
      handleParse();
      return;
    }
    if (state.step === 3) {
      handleGenerate();
      return;
    }
    setState((prev) => ({ ...prev, step: (prev.step + 1) as Step }));
  }, [state.step, handleParse, handleGenerate]);

  const handleBack = useCallback(() => {
    setState((prev) => ({ ...prev, step: Math.max(1, prev.step - 1) as Step }));
  }, []);

  const nextLabel =
    state.step === 1
      ? 'Parse →'
      : state.step === 3
      ? 'Generate Target →'
      : 'Next →';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      {/* Step indicator */}
      <div className="flex items-center bg-white border-b border-slate-200 px-6 py-2 gap-0 flex-shrink-0">
        {STEPS.map((s, i) => (
          <React.Fragment key={s.id}>
            <button
              onClick={() => {
                // Only allow going back to completed steps
                if (s.id < state.step) {
                  setState((prev) => ({ ...prev, step: s.id }));
                }
              }}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                state.step === s.id
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : s.id < state.step
                  ? 'text-indigo-600 hover:bg-indigo-50 cursor-pointer'
                  : 'text-slate-400 cursor-not-allowed'
              )}
            >
              {s.id < state.step ? (
                <CheckCircle2 size={14} className="text-green-400" />
              ) : (
                s.icon
              )}
              <span>{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <ChevronRight size={14} className="text-slate-300 mx-1 flex-shrink-0" />
            )}
          </React.Fragment>
        ))}

        <div className="flex-1" />

        {/* Step description */}
        <p className="text-xs text-slate-400 mr-4 hidden lg:block">
          {STEPS.find((s) => s.id === state.step)?.description}
        </p>

        {/* Nav buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            disabled={state.step === 1}
            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} /> Back
          </button>
          {state.step < 4 && (
            <button
              onClick={handleNext}
              disabled={!canGoNext()}
              className="flex items-center gap-1 px-4 py-1.5 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {nextLabel} <ChevronRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-hidden">
        {state.step === 1 && (
          <SourceViewer
            value={state.sourceText}
            onChange={(v) =>
              setState((prev) => ({ ...prev, sourceText: v, sourceParseError: null }))
            }
            parseError={state.sourceParseError}
            onParse={handleParse}
            onLoadSample={handleLoadSample}
            isParsed={state.isParsed}
          />
        )}

        {state.step === 2 && (
          <IntermediateEditor
            value={state.intermediateText}
            onChange={handleIntermediateChange}
            onBlur={handleIntermediateBlur}
            editError={state.intermediateEditError}
            validation={state.validation}
          />
        )}

        {state.step === 3 && (
          <MappingPanel
            intermediateSchema={state.intermediateSchema}
            overrides={state.overrides}
            onOverrideChange={handleOverrideChange}
            useAI={state.useAI}
            onToggleAI={handleToggleAI}
            aiLoading={state.aiLoading}
            onRunAI={handleRunAI}
            aiSuggestions={state.aiSuggestions}
          />
        )}

        {state.step === 4 && (
          <TargetPreview
            targetJSON={state.targetJSON}
            targetComponents={state.targetComponents}
            onLoadToCanvas={handleLoadToCanvas}
            onExport={handleExport}
          />
        )}
      </div>
    </div>
  );
});
