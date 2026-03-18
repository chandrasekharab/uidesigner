'use client';

import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FileJson,
  GitBranch,
  SlidersHorizontal,
  Layers,
  CheckCircle2,
  Save,
  FolderOpen,
} from 'lucide-react';

import { useBuilderStore } from '@/store/builderStore';
import { SourceViewer } from './SourceViewer';
import { IntermediateEditor } from './IntermediateEditor';
import { MappingPanel } from './MappingPanel';
import { TargetPreview } from './TargetPreview';
import { ProjectsPanel } from './ProjectsPanel';
import { PEGA_SAMPLE_STRING } from '@/data/pegaSample';
import {
  parsePegaToIntermediate,
  transformIntermediateToTarget,
  validateMappings,
  type MappingOverride,
  type MappingValidationResult,
} from '@/services/schemaTransformer';
import {
  updateProject,
  createProject,
} from '@/services/transformProjectService';
import {
  convertCanonicalToA2UI,
  type TargetFormat,
} from '@/services/schemaTransformer';
import { suggestMappings, type AIMappingSuggestion } from '@/services/aiService';
import type { CanonicalComponent, TransformProject, TransformStatus } from '@/types/canonical';
import type { UIComponent } from '@/types';
import { cn } from '@/utils/cn';

// ─── Step Definition ──────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

const STEPS: { id: Step; label: string; icon: React.ReactNode; description: string }[] = [
  { id: 1, label: 'Source',       icon: <FileJson size={14} />,       description: 'Paste or load Pega Constellation JSON' },
  { id: 2, label: 'Intermediate', icon: <GitBranch size={14} />,      description: 'Review & edit the canonical schema'     },
  { id: 3, label: 'Map',          icon: <SlidersHorizontal size={14} />, description: 'Configure component type mappings'  },
  { id: 4, label: 'Preview',      icon: <Layers size={14} />,         description: 'Preview target JSON & load to canvas'  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveStatus(s: TStudioState): TransformStatus {
  if (s.targetJSON) return 'complete';
  if (s.overrides.size > 0) return 'mapped';
  if (s.intermediateSchema.length > 0) return 'parsed';
  return 'draft';
}

function projectToState(project: TransformProject): TStudioState {
  const overridesMap = new Map<string, MappingOverride>(
    Object.entries(project.overrides).map(([k, v]) => [k, v as MappingOverride])
  );
  const schema = project.intermediateSchema ?? [];
  let step: Step = 1;
  if (project.targetJSON) step = 4;
  else if (schema.length > 0 && overridesMap.size > 0) step = 3;
  else if (schema.length > 0) step = 2;
  return {
    ...INIT,
    sourceText: project.sourceText,
    isParsed: schema.length > 0,
    intermediateSchema: schema,
    intermediateText: schema.length ? JSON.stringify(schema, null, 2) : '',
    validation: schema.length ? validateMappings(schema) : null,
    overrides: overridesMap,
    targetFormat: project.targetFormat ?? 'native',
    targetJSON: project.targetJSON,
    targetComponents: project.targetJSON
      ? (() => { try { return JSON.parse(project.targetJSON) as UIComponent[]; } catch { return []; } })()
      : [],
    step,
  };
}

// ─── Pipeline State ───────────────────────────────────────────────────────────

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
  targetFormat: TargetFormat;
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
  targetFormat: 'native',
  targetComponents: [],
  targetJSON: '',
};

// ─── Component ────────────────────────────────────────────────────────────────

export const TransformationStudio = memo(function TransformationStudio() {
  const setComponents = useBuilderStore((s) => s.setComponents);
  const setAppMode = useBuilderStore((s) => s.setAppMode);
  const pendingTransformJSON = useBuilderStore((s) => s.pendingTransformJSON);
  const setPendingTransformJSON = useBuilderStore((s) => s.setPendingTransformJSON);

  const [activeProject, setActiveProject] = useState<TransformProject | null>(null);
  const [state, setState] = useState<TStudioState>(INIT);
  const [saveIndicator, setSaveIndicator] = useState<'saved' | 'saving' | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Builder → Transform handoff ───────────────────────────────────────────
  // When the builder fires “Send to Transform”, `pendingTransformJSON` is set.
  // We create a new project, populate it with the canvas JSON as source text,
  // select it, and clear the handoff signal.
  useEffect(() => {
    if (!pendingTransformJSON) return;
    const project = createProject(
      `Canvas export – ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    );
    updateProject(project.id, { sourceText: pendingTransformJSON });
    handleSelectProject({ ...project, sourceText: pendingTransformJSON });
    setPendingTransformJSON(null);
  // handleSelectProject is stable (useCallback with no deps that change here)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTransformJSON]);

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const persistToProject = useCallback((projectId: string, s: TStudioState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveIndicator('saving');
    saveTimer.current = setTimeout(() => {
      updateProject(projectId, {
        status: deriveStatus(s),
        sourceText: s.sourceText,
        intermediateSchema: s.intermediateSchema,
        overrides: Object.fromEntries(Array.from(s.overrides.entries())),
        targetFormat: s.targetFormat,
        targetJSON: s.targetJSON,
      });
      setSaveIndicator('saved');
      setTimeout(() => setSaveIndicator(null), 2000);
    }, 800);
  }, []);

  const setStateAndSave = useCallback(
    (updater: (prev: TStudioState) => TStudioState) => {
      setState((prev) => {
        const next = updater(prev);
        if (activeProject) persistToProject(activeProject.id, next);
        return next;
      });
    },
    [activeProject, persistToProject]
  );

  // ── Project selection ─────────────────────────────────────────────────────
  const handleSelectProject = useCallback((project: TransformProject) => {
    setActiveProject(project);
    setState(projectToState(project));
    setSaveIndicator(null);
  }, []);

  // ── Step 1: Parse source JSON ──────────────────────────────────────────────
  const handleParse = useCallback(() => {
    try {
      const parsed = JSON.parse(state.sourceText);
      const schema = parsePegaToIntermediate(parsed);
      setStateAndSave((prev) => ({
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
  }, [state.sourceText, setStateAndSave]);

  const handleLoadSample = useCallback(() => {
    setStateAndSave((prev) => ({ ...prev, sourceText: PEGA_SAMPLE_STRING, sourceParseError: null }));
  }, [setStateAndSave]);

  // ── Step 2: Edit intermediate JSON ────────────────────────────────────────
  const handleIntermediateChange = useCallback((text: string) => {
    setState((prev) => ({ ...prev, intermediateText: text, intermediateEditError: null }));
    try {
      const parsed = JSON.parse(text) as CanonicalComponent[];
      setStateAndSave((prev) => ({
        ...prev,
        intermediateSchema: parsed,
        intermediateText: text,
        validation: validateMappings(parsed),
        intermediateEditError: null,
      }));
    } catch (e) {
      setState((prev) => ({ ...prev, intermediateEditError: `JSON error: ${(e as Error).message}` }));
    }
  }, [setStateAndSave]);

  const handleIntermediateBlur = useCallback(() => {
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
      setStateAndSave((prev) => {
        const next = new Map(prev.overrides);
        next.set(id, { ...(prev.overrides.get(id) ?? {}), ...partial });
        return { ...prev, overrides: next };
      });
    },
    [setStateAndSave]
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
    if (state.targetFormat === 'a2ui') {
      const a2uiSchema = convertCanonicalToA2UI(state.intermediateSchema, state.overrides);
      const json = JSON.stringify(a2uiSchema, null, 2);
      // A2UI format doesn’t map back to UIComponent[] for canvas preview, so we keep an empty array
      setStateAndSave((prev) => ({ ...prev, step: 4, targetComponents: [], targetJSON: json }));
    } else {
      const target = transformIntermediateToTarget(state.intermediateSchema, state.overrides);
      const json = JSON.stringify(target, null, 2);
      setStateAndSave((prev) => ({ ...prev, step: 4, targetComponents: target, targetJSON: json }));
    }
  }, [state.intermediateSchema, state.overrides, state.targetFormat, setStateAndSave]);

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
    const suffix = state.targetFormat === 'a2ui' ? '-a2ui-schema' : '-ui-schema';
    a.download = `${activeProject?.name ?? 'transformed'}${suffix}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [state.targetJSON, state.targetFormat, activeProject]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const canGoNext = useCallback((): boolean => {
    if (!activeProject) return false;
    switch (state.step) {
      case 1: return state.sourceText.trim().length > 0;
      case 2: return state.intermediateSchema.length > 0 && !state.intermediateEditError;
      case 3: return true;
      case 4: return false;
    }
  }, [state, activeProject]);

  const handleNext = useCallback(() => {
    if (state.step === 1) { handleParse(); return; }
    if (state.step === 3) { handleGenerate(); return; }
    setStateAndSave((prev) => ({ ...prev, step: (prev.step + 1) as Step }));
  }, [state.step, handleParse, handleGenerate, setStateAndSave]);

  const handleBack = useCallback(() => {
    setStateAndSave((prev) => ({ ...prev, step: Math.max(1, prev.step - 1) as Step }));
  }, [setStateAndSave]);

  const nextLabel = state.step === 1 ? 'Parse →' : state.step === 3 ? 'Generate Target →' : 'Next →';

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left sidebar — projects list */}
      <ProjectsPanel
        activeId={activeProject?.id ?? null}
        onSelect={handleSelectProject}
      />

      {/* Main pipeline area */}
      <div className="flex flex-col flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
        {/* Step indicator bar */}
        <div className="flex items-center bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 gap-0 flex-shrink-0">
          {/* Active project name */}
          {activeProject ? (
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 mr-3 truncate max-w-[160px]">
              {activeProject.name}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 mr-3">
              <FolderOpen size={12} /> Select a project
            </span>
          )}

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mr-3" />

          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <button
                disabled={!activeProject || s.id >= state.step}
                onClick={() => {
                  if (activeProject && s.id < state.step) {
                    setStateAndSave((prev) => ({ ...prev, step: s.id }));
                  }
                }}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  !activeProject
                    ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                    : state.step === s.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : s.id < state.step
                    ? 'text-indigo-600 hover:bg-indigo-50 cursor-pointer'
                    : 'text-slate-400 dark:text-slate-500 cursor-not-allowed'
                )}
              >
                {activeProject && s.id < state.step
                  ? <CheckCircle2 size={13} className="text-green-400" />
                  : s.icon}
                <span>{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <ChevronRight size={12} className="text-slate-300 dark:text-slate-600 mx-0.5 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}

          <div className="flex-1" />

          {/* Auto-save indicator */}
          {saveIndicator && (
            <span className={cn(
              'flex items-center gap-1 text-[11px] mr-3',
              saveIndicator === 'saving' ? 'text-slate-400 dark:text-slate-500' : 'text-green-600'
            )}>
              <Save size={11} />
              {saveIndicator === 'saving' ? 'Saving…' : 'Saved'}
            </span>
          )}

          {/* Nav buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleBack}
              disabled={!activeProject || state.step === 1}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={13} /> Back
            </button>
            {state.step < 4 && (
              <button
                onClick={handleNext}
                disabled={!canGoNext()}
                className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {nextLabel} <ChevronRight size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Empty state */}
        {!activeProject ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <FolderOpen size={28} className="opacity-40" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No project selected</p>
              <p className="text-xs mt-1">Create or select a project from the left panel to begin.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            {state.step === 1 && (
              <SourceViewer
                value={state.sourceText}
                onChange={(v) =>
                  setStateAndSave((prev) => ({ ...prev, sourceText: v, sourceParseError: null }))
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
                targetFormat={state.targetFormat}
                onTargetFormatChange={(f) =>
                  setStateAndSave((prev) => ({ ...prev, targetFormat: f }))
                }
              />
            )}
            {state.step === 4 && (
              <TargetPreview
                targetJSON={state.targetJSON}
                targetComponents={state.targetComponents}
                targetFormat={state.targetFormat}
                onLoadToCanvas={handleLoadToCanvas}
                onExport={handleExport}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
});
