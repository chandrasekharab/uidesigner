import type { UIComponent } from '@/types';
import type { CanonicalType, CanonicalCategory, LayoutConfig } from '@/types/canonical';
import type { ComponentType } from '@/types';

// ─── AI Mapping Suggestion Types ──────────────────────────────────────────────

export interface AIMappingSuggestion {
  sourceType: string;
  suggestedCanonicalType: CanonicalType;
  suggestedTargetType: ComponentType;
  confidence: number;  // 0-1
  reason: string;
}

export interface AISuggestMappingsResult {
  suggestions: AIMappingSuggestion[];
  mock: boolean;
}

// ─── AI Service ───────────────────────────────────────────────────────────────
// This service abstracts all AI interactions.
// Swap mock implementations for real ones by providing NEXT_PUBLIC_AI_API_KEY.

export interface AIGenerateResult {
  components: UIComponent[];
  mock: boolean;
}

export interface AIValidateResult {
  valid: boolean;
  errors: string[];
  suggestions: string[];
}

/**
 * Generate a UI component tree from a natural language prompt.
 * Calls the /api/ai/generate endpoint which proxies to the AI provider.
 */
export async function generateUIFromPrompt(
  prompt: string
): Promise<AIGenerateResult> {
  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? 'AI generation failed');
  }

  return res.json();
}

/**
 * Validate a JSON schema against the component schema rules.
 * Currently a client-side mock — extend with real AI-powered validation.
 */
export async function validateJSON(schema: unknown[]): Promise<AIValidateResult> {
  const errors: string[] = [];
  const suggestions: string[] = [];

  if (!Array.isArray(schema)) {
    return { valid: false, errors: ['Root must be an array'], suggestions: [] };
  }

  for (const [i, node] of schema.entries()) {
    if (typeof node !== 'object' || node === null) {
      errors.push(`Item at index ${i} must be an object`);
      continue;
    }
    const n = node as Record<string, unknown>;
    if (!n.id) errors.push(`Item at index ${i} is missing "id"`);
    if (!n.type) errors.push(`Item at index ${i} is missing "type"`);
    if (!n.props) suggestions.push(`Item "${n.id}" has no "props" — defaults will be used`);
  }

  return {
    valid: errors.length === 0,
    errors,
    suggestions,
  };
}

// ─── AI-Assisted Schema Transformation ───────────────────────────────────────

/**
 * Request AI-powered mapping suggestions for unmapped or ambiguous Pega types.
 * Calls /api/ai/suggest-mappings — returns mock suggestions when no API key set.
 */
export async function suggestMappings(
  pegaJson: unknown
): Promise<AISuggestMappingsResult> {
  const res = await fetch('/api/ai/suggest-mappings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pegaJson }),
  });
  if (!res.ok) throw new Error('AI mapping suggestion failed');
  return res.json();
}

/**
 * Ask the AI to generate a full intermediate canonical schema from Pega JSON.
 * Currently delegates to the generate endpoint as a stub.
 * Replace with a dedicated schema-generation prompt in production.
 */
export async function autoGenerateIntermediateSchema(
  pegaJson: unknown
): Promise<AIGenerateResult> {
  const snippet = JSON.stringify(pegaJson).substring(0, 400);
  return generateUIFromPrompt(`Convert this Pega JSON to a UI form: ${snippet}`);
}

// ─── A2UI Renderer AI Functions ───────────────────────────────────────────────

export interface AIOptimizeResult {
  optimized: UIComponent[];
  changes: string[];
  mock: boolean;
}

export interface AIFixSuggestion {
  error: string;
  suggestion: string;
  autoFix?: Record<string, unknown>;
}

export interface AIFixesResult {
  suggestions: AIFixSuggestion[];
  mock: boolean;
}

/**
 * Ask AI to optimize a schema for A2UI rendering.
 * Calls /api/ai/optimize-schema — returns mock output when no API key is set.
 */
export async function optimizeSchemaForA2UI(
  schema: UIComponent[]
): Promise<AIOptimizeResult> {
  const res = await fetch('/api/ai/optimize-schema', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ schema }),
  });
  if (!res.ok) throw new Error('AI optimization failed');
  return res.json();
}

/**
 * Ask AI to suggest fixes for rendering errors/warnings.
 * Client-side mock — suitable for development; swap for a real call in production.
 */
export async function suggestFixesForRendering(
  errors: string[]
): Promise<AIFixesResult> {
  const suggestions: AIFixSuggestion[] = errors.map((err) => {
    if (err.toLowerCase().includes('label')) {
      return { error: err, suggestion: 'Add a descriptive label to this component.' };
    }
    if (err.toLowerCase().includes('type')) {
      return { error: err, suggestion: 'Ensure the "type" field is one of: Container, TextInput, Button, Dropdown, Text.' };
    }
    if (err.toLowerCase().includes('id')) {
      return { error: err, suggestion: 'Each component must have a unique "id" field (UUID recommended).' };
    }
    return { error: err, suggestion: `Review the schema structure near: ${err}` };
  });
  return { suggestions, mock: true };
}

// ─── Design-to-Pega Vision Functions ─────────────────────────────────────────

import type { ParsedDesign } from '@/services/designParser';
import type { PegaConstellationMetadata } from '@/services/pegaMetadataGenerator';

export interface AIDesignDetectResult {
  design: ParsedDesign;
  mock: boolean;
}

export interface AIDesignSchemaResult {
  metadata: PegaConstellationMetadata;
  mock: boolean;
}

/**
 * Send an image file to the AI vision pipeline.
 * Calls /api/ai/parse-design, which proxies to a real vision model when
 * AI_API_KEY is set, or returns a mock response in dev mode.
 */
export async function detectUIFromImage(
  file: File
): Promise<AIDesignDetectResult> {
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch('/api/ai/parse-design', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? 'Design detection failed');
  }

  const design: ParsedDesign = await res.json();
  return { design, mock: design.mock };
}

/**
 * Generate a Pega Constellation schema from a text description of the design.
 * Useful when no image is available — delegates to the generate endpoint.
 */
export async function generatePegaSchemaFromDesign(
  description: string
): Promise<AIDesignSchemaResult> {
  const prompt = `You are a Pega Constellation metadata generator. 
Generate a valid Pega Constellation View JSON for the following UI description:
"${description}"

Return JSON matching: { view: { type, name, regions: [{ name, fields: [...] }], actions: [...] } }`;

  const res = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    // Fallback mock
    return buildMockPegaSchemaFromDescription(description);
  }

  const data = await res.json();

  // The generate endpoint returns { components, mock }.
  // Wrap into a minimal Pega metadata envelope.
  const metadata: PegaConstellationMetadata = {
    view: {
      type: 'form',
      name: description.substring(0, 40),
      regions: [
        {
          name: 'body',
          layout: 'stacked',
          fields: (data.components ?? []).map((c: { props?: { label?: string; content?: string }; type?: string }) => ({
            type: c.type === 'Button' ? 'button' : 'text',
            label: c.props?.label ?? c.props?.content ?? '',
          })),
        },
      ],
      actions: [],
    },
  };

  return { metadata, mock: data.mock ?? true };
}

function buildMockPegaSchemaFromDescription(
  description: string
): AIDesignSchemaResult {
  const lower = description.toLowerCase();
  const isLogin = lower.includes('login') || lower.includes('sign in');
  const isForm = lower.includes('form') || lower.includes('register');

  const metadata: PegaConstellationMetadata = {
    view: {
      type: 'form',
      name: description.substring(0, 50),
      regions: [
        {
          name: 'body',
          layout: 'stacked',
          fields: isLogin
            ? [
                { type: 'email', label: 'Email Address', property: '.EmailAddress' },
                { type: 'password', label: 'Password', property: '.Password' },
              ]
            : isForm
            ? [
                { type: 'text', label: 'Full Name', property: '.FullName' },
                { type: 'email', label: 'Email', property: '.Email' },
              ]
            : [{ type: 'text', label: 'Field 1', property: '.Field1' }],
        },
      ],
      actions: [
        { type: 'button', label: isLogin ? 'Login' : 'Submit', actionType: 'Submit', variant: 'primary' },
      ],
      _meta: {
        generatedBy: 'design-parser',
        parseId: `desc-${Date.now()}`,
        mock: true,
        componentCount: 3,
        confidence: 0.72,
      },
    },
  };

  return { metadata, mock: true };
}

// ─── Schema-Aware AI Functions ─────────────────────────────────────────────────────
import type { DetectedComponent } from '@/services/designParser';import type { SchemaContext, SchemaMapping } from '@/services/schemaContextService';
import { matchComponentToSchema } from '@/services/schemaContextService';

export interface AISchemaAlignResult {
  /** Updated ParsedDesign where each component has a schema-suggested label/type */
  refinedDesign: ParsedDesign;
  /** Schema mappings produced by the AI */
  mappings: Map<string, SchemaMapping>;
  mock: boolean;
}

export interface AIComponentMatchResult {
  schemaType: string;
  schemaLabel: string;
  confidence: number;
  explanation: string;
  alternatives: Array<{ schemaType: string; label: string; confidence: number }>;
  mock: boolean;
}

/**
 * Map an entire ParsedDesign to a SchemaContext using AI.
 * Mock: uses schemaContextService heuristics. Real: would call a vision+LLM pipeline.
 *
 * @param design  The parsed design from the detection stage
 * @param context The loaded schema context to guide mapping
 * @param useAI   When true and NEXT_PUBLIC_AI_API_KEY is set, calls the real endpoint
 */
export async function mapDesignToSchema(
  design: ParsedDesign,
  context: SchemaContext,
  useAI = false
): Promise<AISchemaAlignResult> {
  const hasApiKey = Boolean(
    typeof window !== 'undefined' && process.env.NEXT_PUBLIC_AI_API_KEY
  );

  // Real AI path (stub — expand when API is available)
  if (useAI && hasApiKey) {
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are a schema-aware Pega Constellation mapper.

Given these detected UI components:
${JSON.stringify(design.components.map((c) => ({ id: c.id, type: c.type, label: c.label })), null, 2)}

And this Pega Constellation schema context (component types available):
${context.componentTypes.join(', ')}

For each component id, return the best matching schema type and a 0-1 confidence.
Return JSON array: [{ id, schemaType, confidence, explanation }]`,
        }),
      });

      if (res.ok) {
        // Parse AI response and merge into design — best-effort
        // (real implementation would parse the array response here)
        return buildMockAlignResult(design, context);
      }
    } catch {
      // Fall through to mock
    }
  }

  return buildMockAlignResult(design, context);
}

function buildMockAlignResult(
  design: ParsedDesign,
  context: SchemaContext
): AISchemaAlignResult {
  const mappings = new Map<string, SchemaMapping>();

  const refinedComponents = design.components.map((comp) => {
    const mapping = matchComponentToSchema(comp, context);
    mappings.set(comp.id, mapping);

    // Apply the best schema type back to the component (non-destructive)
    return {
      ...comp,
      type: mapping.schemaType as DetectedComponent['type'],
      label: comp.label || mapping.schemaLabel,
      attributes: {
        ...comp.attributes,
        _schemaType: mapping.schemaType,
        _mappingConfidence: mapping.confidence,
      },
    };
  });

  return {
    refinedDesign: { ...design, components: refinedComponents },
    mappings,
    mock: true,
  };
}

/**
 * Suggest the best schema match for a single detected component.
 * Useful for the "re-map" override UI when the user selects a component.
 */
export async function suggestBestComponentMatch(
  comp: DetectedComponent,
  context: SchemaContext
): Promise<AIComponentMatchResult> {
  // Pure heuristic (mock) — a real implementation would send the cropped
  // bounding-box image + label to a vision model for richer context.
  const mapping = matchComponentToSchema(comp, context);
  return {
    schemaType: mapping.schemaType,
    schemaLabel: mapping.schemaLabel,
    confidence: mapping.confidence,
    explanation: mapping.explanation,
    alternatives: mapping.alternatives,
    mock: true,
  };
}

// ─── Layout & Widget AI Functions ────────────────────────────────────────────

import {
  WIDGET_DETECTION_HINTS,
  LAYOUT_MAPPINGS,
  resolveLayoutCanonicalType,
  detectWidgetFromLabel,
} from '@/config/widgetMapping';

// ── Layout Detection ──────────────────────────────────────────────────────────

export interface AILayoutDetectResult {
  /** Canonical layout type resolved from the image/region heuristics */
  layoutType: CanonicalType;
  /** Category ('layout') */
  category: CanonicalCategory;
  /** Resolved column count */
  columns: number;
  /** Inferred layout config */
  layoutConfig: Partial<LayoutConfig>;
  /** 0–1 confidence */
  confidence: number;
  /** Explanation of why this layout was detected */
  explanation: string;
  mock: boolean;
}

/**
 * Detect the layout structure of an uploaded image.
 * Mock: uses grid-line analysis heuristic; real: sends image to vision model.
 */
export async function detectLayoutStructure(
  _image: File
): Promise<AILayoutDetectResult> {
  // Mock implementation — a real call would send the image to /api/ai/generate
  // with a structured prompt asking for column count, layout type, etc.
  // We return a plausible 2-column result as the default mock.
  return {
    layoutType: 'TwoColumn',
    category: 'layout',
    columns: 2,
    layoutConfig: { layoutType: 'twoColumn', columns: 2, gap: 16 },
    confidence: 0.72,
    explanation: 'Image appears to contain a two-column form layout based on field alignment heuristics.',
    mock: true,
  };
}

// ── Widget Detection ──────────────────────────────────────────────────────────

export interface AIWidgetDetectResult {
  /** Detected canonical widget type */
  widgetType: CanonicalType;
  /** Category ('widget') */
  category: CanonicalCategory;
  /** 0–1 confidence */
  confidence: number;
  /** Explanation */
  explanation: string;
  /** Ordered alternatives */
  alternatives: Array<{ widgetType: CanonicalType; confidence: number }>;
  mock: boolean;
}

/**
 * Detect widget type from a region descriptor (label, child count, visual features).
 * Mock: uses WIDGET_DETECTION_HINTS label matching.
 * Real: would send region bounding-box image to a vision model.
 */
export async function detectWidgetType(
  region: { label?: string; childCount?: number; [key: string]: unknown }
): Promise<AIWidgetDetectResult> {
  const label = String(region.label ?? '');
  const heuristicType = detectWidgetFromLabel(label);
  const matched = WIDGET_DETECTION_HINTS.filter((h) =>
    h.labelKeywords.some((kw) => label.toLowerCase().includes(kw))
  ).sort((a, b) => b.confidence - a.confidence);

  const best = matched[0];
  const widgetType: CanonicalType = heuristicType ?? 'Unknown';

  return {
    widgetType,
    category: 'widget',
    confidence: best?.confidence ?? 0.4,
    explanation: best
      ? `Region label "${label}" matched keyword pattern for ${widgetType}.`
      : `No strong widget signal found in region "${label}".`,
    alternatives: matched.slice(1).map((h) => ({
      widgetType: h.canonicalType,
      confidence: h.confidence,
    })),
    mock: true,
  };
}

// ── Layout Mapping Suggestion ─────────────────────────────────────────────────

export interface AILayoutMapResult {
  /** Suggested canonical layout type */
  canonicalType: CanonicalType;
  /** Intermediate schema representation */
  intermediateLayout: { type: CanonicalType; layoutConfig: Partial<LayoutConfig>; label: string };
  /** Target representation (native) */
  targetLayout: { type: string; columns?: number; gap?: number };
  /** Target representation (A2UI) */
  a2uiLayout: { component: string; props: Record<string, unknown> };
  confidence: number;
  mock: boolean;
}

/**
 * Suggest the best intermediate/target mapping for a Pega layout string.
 * Mock: resolves via resolveLayoutCanonicalType + LAYOUT_MAPPINGS registry.
 */
export async function suggestLayoutMapping(
  pegaLayout: { type?: string; layout?: string; name?: string }
): Promise<AILayoutMapResult> {
  const layoutStr = String(pegaLayout.layout ?? pegaLayout.type ?? 'stacked');
  const canonicalType = resolveLayoutCanonicalType(layoutStr);
  const entry = LAYOUT_MAPPINGS.find((m) => m.canonicalType === canonicalType);

  const layoutConfig: Partial<LayoutConfig> = entry?.defaultLayoutConfig ?? {
    layoutType: 'singleColumn',
    columns: 1,
    gap: 16,
  };

  const cols = (layoutConfig as LayoutConfig).columns ?? 1;

  return {
    canonicalType,
    intermediateLayout: {
      type: canonicalType,
      layoutConfig,
      label: String(pegaLayout.name ?? canonicalType),
    },
    targetLayout: {
      type: 'Container',
      columns: cols > 1 ? cols : undefined,
      gap: (layoutConfig as LayoutConfig).gap,
    },
    a2uiLayout: {
      component: entry?.a2uiType ?? 'FlexContainer',
      props: {
        columns: cols > 1 ? cols : undefined,
        gap: (layoutConfig as LayoutConfig).gap,
      },
    },
    confidence: 0.88,
    mock: true,
  };
}

// ── Widget Mapping Suggestion ─────────────────────────────────────────────────

export interface AIWidgetMapResult {
  /** Suggested canonical widget type */
  canonicalType: CanonicalType;
  /** Pega source type found */
  pegaType: string;
  /** Target native type */
  nativeTargetType: string;
  /** A2UI type */
  a2uiType: string;
  /** Intermediate → Target mapping explanation */
  explanation: string;
  confidence: number;
  mock: boolean;
}

/**
 * Suggest the intermediate and target mappings for a detected Pega widget.
 * Mock: looks up via WIDGET_TYPE_MAP; real: sends widget region to LLM.
 */
export async function suggestWidgetMapping(
  component: { type?: string; label?: string; [key: string]: unknown }
): Promise<AIWidgetMapResult> {
  const { WIDGET_TYPE_MAP } = await import('@/config/widgetMapping');
  const pegaType = String(component.type ?? '');
  const entry = WIDGET_TYPE_MAP.get(pegaType);

  if (entry) {
    return {
      canonicalType: entry.canonicalType,
      pegaType,
      nativeTargetType: entry.nativeTargetType,
      a2uiType: entry.a2uiType,
      explanation: `${pegaType} maps to ${entry.canonicalType} (${entry.description}). Native target: ${entry.nativeTargetType}. A2UI: ${entry.a2uiType}.`,
      confidence: 0.90,
      mock: true,
    };
  }

  // Heuristic fallback from label
  const label = String(component.label ?? pegaType);
  const heuristicType = detectWidgetFromLabel(label);
  return {
    canonicalType: heuristicType ?? 'Unknown',
    pegaType,
    nativeTargetType: 'Text',
    a2uiType: 'TextContent',
    explanation: heuristicType
      ? `No exact Pega type match. Label heuristics suggest ${heuristicType}.`
      : `No mapping found for "${pegaType}". Falling back to Unknown/Text.`,
    confidence: heuristicType ? 0.55 : 0.40,
    mock: true,
  };
}

// ─── Region AI Functions ──────────────────────────────────────────────────────
// These functions extend the AI service for the "Highlight & Map Regions" flow.
// All ship with full mock implementations; swap for real Vision/LLM calls by
// setting NEXT_PUBLIC_AI_API_KEY and replacing the mock bodies.

import type {
  RegionDetectedType,
  RegionMappedSchema,
  RegionAnalysisResult,
  Region,
} from '@/types/region';

export interface RegionSuggestion {
  name: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  detectedType: RegionDetectedType;
  confidence: number;
}

export interface SuggestRegionsResult {
  suggestions: RegionSuggestion[];
  mock: boolean;
}

/**
 * Auto-detect likely UI regions from a full-page design image.
 * Real implementation: calls a Vision LLM to segment the image.
 * Mock: returns region suggestions matching the sample SVG layout.
 */
export async function suggestRegions(
  _imageBase64: string
): Promise<SuggestRegionsResult> {
  // Simulate analysis delay
  await new Promise((r) => setTimeout(r, 900));

  const suggestions: RegionSuggestion[] = [
    { name: 'Header',           boundingBox: { x: 0,     y: 0,     width: 1,     height: 0.08  }, detectedType: 'Header',       confidence: 0.96 },
    { name: 'Case Summary',     boundingBox: { x: 0,     y: 0.08,  width: 1,     height: 0.074 }, detectedType: 'CaseSummary',  confidence: 0.91 },
    { name: 'Process Steps',    boundingBox: { x: 0,     y: 0.154, width: 1,     height: 0.08  }, detectedType: 'Steps',        confidence: 0.94 },
    { name: 'Claimant Details', boundingBox: { x: 0,     y: 0.234, width: 0.645, height: 0.28  }, detectedType: 'FormSection',  confidence: 0.89 },
    { name: 'Incident Details', boundingBox: { x: 0,     y: 0.514, width: 0.645, height: 0.212 }, detectedType: 'FormSection',  confidence: 0.87 },
    { name: 'Attachments',      boundingBox: { x: 0.645, y: 0.234, width: 0.355, height: 0.263 }, detectedType: 'Attachments',  confidence: 0.93 },
    { name: 'Activity Feed',    boundingBox: { x: 0.645, y: 0.497, width: 0.355, height: 0.354 }, detectedType: 'ActivityFeed', confidence: 0.90 },
  ];

  return { suggestions, mock: true };
}

/**
 * Classify the visual type of an already-cropped region image.
 * Real: sends cropped image to a Vision classifier.
 * Mock: keyword-heuristic on the region name.
 */
export async function detectRegionType(
  _regionImageBase64: string,
  regionName: string
): Promise<{ type: RegionDetectedType; confidence: number; reason: string; mock: boolean }> {
  await new Promise((r) => setTimeout(r, 400));

  const name = regionName.toLowerCase();
  const rules: Array<[RegExp, RegionDetectedType, string]> = [
    [/header|title|banner/,           'Header',       'Contains title/banner visual elements'],
    [/attach|file|document|upload/,   'Attachments',  'Shows file listing or upload controls'],
    [/pulse|activity|feed|comment/,   'ActivityFeed', 'Contains threaded messages or activity log'],
    [/step|stage|progress|stepper/,   'Steps',        'Shows a sequential progress indicator'],
    [/grid|table|list|row/,           'DataGrid',     'Contains tabular or list structure'],
    [/summary|case.*info|overview/,   'CaseSummary',  'Displays case metadata summary'],
    [/tab|panel/,                     'Tabs',         'Contains tab navigation elements'],
    [/nav|menu|sidebar/,              'Navigation',   'Contains navigation controls'],
    [/form|field|input|detail/,       'FormSection',  'Contains form input fields'],
    [/footer|action.*bar|button.*bar/, 'Footer',      'Contains action buttons at the bottom'],
    [/card|tile/,                     'Card',         'Card-style component container'],
    [/modal|dialog|popup/,            'Modal',        'Overlay or dialog component'],
  ];

  for (const [pattern, type, reason] of rules) {
    if (pattern.test(name)) {
      return { type, confidence: 0.82 + Math.random() * 0.14, reason, mock: true };
    }
  }

  return { type: 'Unknown', confidence: 0.40, reason: 'No matching visual pattern detected', mock: true };
}

/**
 * Suggest an intermediate schema mapping for a region, based on its detected type.
 * Real: sends region metadata and cropped image to an LLM for grounded suggestions.
 * Mock: lookup table keyed by RegionDetectedType.
 */
export async function suggestRegionSchemaMapping(
  region: Pick<Region, 'name' | 'detectedType'>
): Promise<{ mapping: RegionMappedSchema; confidence: number; reason: string; mock: boolean }> {
  await new Promise((r) => setTimeout(r, 350));

  const mappings: Record<string, RegionMappedSchema> = {
    Header:       { category: 'widget',     canonicalType: 'CaseSummary',       pegaType: 'pxCaseSummary',   label: 'Case Header'       },
    CaseSummary:  { category: 'widget',     canonicalType: 'CaseSummary',       pegaType: 'pxCaseSummary',   label: 'Case Summary'      },
    Steps:        { category: 'widget',     canonicalType: 'StepsWidget',       pegaType: 'pxProcessSteps',  label: 'Process Steps'     },
    FormSection:  { category: 'fieldGroup', canonicalType: 'TwoColumn',         pegaType: 'region',          label: region.name, config: { columns: 2 } },
    Attachments:  { category: 'widget',     canonicalType: 'AttachmentsWidget', pegaType: 'pxAttachContent', label: 'Attachments'       },
    ActivityFeed: { category: 'widget',     canonicalType: 'PulseWidget',       pegaType: 'pxPulse',         label: 'Activity Feed'     },
    DataGrid:     { category: 'widget',     canonicalType: 'DataGrid',          pegaType: 'DataGrid',        label: 'Data Grid'         },
    Navigation:   { category: 'layout',     canonicalType: 'Section',           pegaType: 'region',          label: 'Navigation'        },
    Footer:       { category: 'layout',     canonicalType: 'InlineLayout',      pegaType: 'region',          label: 'Footer Actions'    },
    Card:         { category: 'layout',     canonicalType: 'Section',           pegaType: 'region',          label: 'Card'              },
    Tabs:         { category: 'layout',     canonicalType: 'TabsLayout',        pegaType: 'region',          label: 'Tabs'              },
    Modal:        { category: 'layout',     canonicalType: 'Section',           pegaType: 'region',          label: 'Modal'             },
    Unknown:      { category: 'layout',     canonicalType: 'SingleColumn',      pegaType: 'region',          label: region.name         },
  };

  const key = region.detectedType ?? 'Unknown';
  const mapping = mappings[key] ?? mappings['Unknown'];
  return {
    mapping,
    confidence: key === 'Unknown' ? 0.45 : 0.84,
    reason: key === 'Unknown'
      ? 'Unknown region type — defaulting to single-column layout.'
      : `Detected as "${key}" — mapped to ${mapping.canonicalType} (${mapping.pegaType}).`,
    mock: true,
  };
}

/**
 * Analyse all regions in batch, returning a full analysis result per region.
 */
export async function analyseRegions(
  regions: Array<Pick<Region, 'id' | 'name' | 'detectedType' | 'imageSegment'>>
): Promise<RegionAnalysisResult[]> {
  const results: RegionAnalysisResult[] = [];
  for (const region of regions) {
    const typeResult = await detectRegionType(region.imageSegment, region.name);
    const mapResult  = await suggestRegionSchemaMapping({
      name: region.name,
      detectedType: typeResult.type,
    });
    results.push({
      regionId:         region.id,
      detectedType:     typeResult.type,
      confidence:       (typeResult.confidence + mapResult.confidence) / 2,
      suggestedMapping: mapResult.mapping,
      reason:           `${typeResult.reason} → ${mapResult.reason}`,
      mock:             true,
    });
  }
  return results;
}

// ─── Template Mapping Studio AI Functions ─────────────────────────────────────
// Extend the AI layer with region-mapping-specific capabilities.
// All functions ship with full mock implementations — swap real calls by
// setting NEXT_PUBLIC_AI_API_KEY and pointing to a backend endpoint.

import type { RegionMappingSuggestion, MappingType } from '@/models/RegionMapping';

export interface AISuggestRegionMappingsResult {
  suggestions: RegionMappingSuggestion[];
  autoMappedCount: number;
  unmatchedSourceIds: string[];
  mock: boolean;
}

/**
 * Suggest region mappings between source template regions and user-defined target regions.
 *
 * Strategy (mock): score each (source, target) pair by name similarity and
 * RegionDetectedType ↔ TargetLayoutType affinity. Return the highest-scoring
 * non-conflicting assignment as a greedy match.
 *
 * Real implementation: call a VectorDB or LLM with region descriptions.
 *
 * @param sourceRegions - Source template regions (PegaTemplateRegion shape)
 * @param targetRegions - User-defined target layout regions
 */
export async function suggestRegionMappings(
  sourceRegions: Array<{ id: string; name: string; type: string; description?: string }>,
  targetRegions: Array<{ id: string; name: string; layout?: string }>
): Promise<AISuggestRegionMappingsResult> {
  // Simulate async latency
  await new Promise((r) => setTimeout(r, 600));

  /** Compute a 0-1 name-similarity score between two strings */
  function nameSimilarity(a: string, b: string): number {
    const al = a.toLowerCase().replace(/[^a-z0-9]/g, '');
    const bl = b.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (al === bl) return 1.0;
    if (al.includes(bl) || bl.includes(al)) return 0.75;
    // Count shared bigrams
    const bigrams = (s: string) => Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2));
    const aBi = new Set(bigrams(al));
    const bBi = bigrams(bl);
    const shared = bBi.filter((bg) => aBi.has(bg)).length;
    const denom = aBi.size + bBi.length;
    return denom === 0 ? 0 : (2 * shared) / denom;
  }

  /** Affinity score between source region type and target layout type */
  const TYPE_AFFINITY: Record<string, Record<string, number>> = {
    Header:       { flex: 0.9, grid: 0.4, tabs: 0.2, sections: 0.3, inline: 0.7 },
    FormSection:  { flex: 0.7, grid: 0.95, tabs: 0.5, sections: 0.7, inline: 0.4 },
    Attachments:  { flex: 0.85, grid: 0.3, tabs: 0.4, sections: 0.5, inline: 0.3 },
    ActivityFeed: { flex: 0.85, grid: 0.2, tabs: 0.5, sections: 0.5, inline: 0.2 },
    Steps:        { flex: 0.6, grid: 0.3, tabs: 0.3, sections: 0.5, inline: 0.9 },
    DataGrid:     { flex: 0.6, grid: 0.9, tabs: 0.4, sections: 0.4, inline: 0.2 },
    CaseSummary:  { flex: 0.8, grid: 0.5, tabs: 0.3, sections: 0.6, inline: 0.4 },
    Navigation:   { flex: 0.5, grid: 0.2, tabs: 0.4, sections: 0.2, inline: 0.95 },
    Footer:       { flex: 0.7, grid: 0.2, tabs: 0.2, sections: 0.2, inline: 0.95 },
    Card:         { flex: 0.8, grid: 0.7, tabs: 0.4, sections: 0.7, inline: 0.3 },
    Tabs:         { flex: 0.3, grid: 0.3, tabs: 0.98, sections: 0.5, inline: 0.2 },
    Unknown:      { flex: 0.6, grid: 0.5, tabs: 0.3, sections: 0.5, inline: 0.4 },
  };

  // Build scored candidate matrix
  const usedTargetIds = new Set<string>();
  const suggestions: RegionMappingSuggestion[] = [];
  const unmatchedSourceIds: string[] = [];

  for (const src of sourceRegions) {
    let best: { targetId: string; score: number; layout: string } | null = null;

    for (const tgt of targetRegions) {
      if (usedTargetIds.has(tgt.id)) continue;
      const nameScore = nameSimilarity(src.name, tgt.name);
      const affinityMap = TYPE_AFFINITY[src.type] ?? TYPE_AFFINITY.Unknown;
      const affinity = affinityMap[tgt.layout ?? 'flex'] ?? 0.5;
      const score = 0.5 * nameScore + 0.5 * affinity;
      if (!best || score > best.score) {
        best = { targetId: tgt.id, score, layout: tgt.layout ?? 'flex' };
      }
    }

    if (best && best.score >= 0.35) {
      // Determine cardinality hint from type
      const mappingType: MappingType = 'one-to-one';
      suggestions.push({
        sourceRegionId: src.id,
        targetRegionId: best.targetId,
        mappingType,
        confidence: Math.min(0.97, best.score),
        reason: `Name similarity + type affinity score: ${best.score.toFixed(2)}. "${src.name}" (${src.type}) matched to target layout "${best.layout}".`,
      });
      usedTargetIds.add(best.targetId);
    } else {
      unmatchedSourceIds.push(src.id);
    }
  }

  return {
    suggestions,
    autoMappedCount: suggestions.length,
    unmatchedSourceIds,
    mock: true,
  };
}

// ─── Optimize Layout Mapping ──────────────────────────────────────────────────

export interface AIOptimizeLayoutMappingResult {
  /** Proposed changes with rationale */
  recommendations: Array<{
    mappingId: string;
    suggestion: string;
    autoApply: boolean;
    proposedMappingType?: MappingType;
  }>;
  overallScore: number;
  mock: boolean;
}

/**
 * Analyse an existing set of region mappings for layout quality issues.
 *
 * Mock checks:
 * - Source regions mapped to incompatible target layout types
 * - N:1 mappings that should be split into separate targets
 * - Unmapped regions that might degrade the output
 *
 * @param mappings            - Current mapping rules
 * @param sourceRegionsMeta   - Source region metadata (id, type)
 * @param targetRegionsMeta   - Target region metadata (id, layout)
 */
export async function optimizeLayoutMapping(
  mappings: Array<{ id: string; sourceRegionId: string; targetRegionId: string; mappingType: MappingType }>,
  sourceRegionsMeta: Array<{ id: string; name: string; type: string }>,
  targetRegionsMeta: Array<{ id: string; name: string; layout: string }>
): Promise<AIOptimizeLayoutMappingResult> {
  await new Promise((r) => setTimeout(r, 500));

  const srcMap = new Map(sourceRegionsMeta.map((r) => [r.id, r]));
  const tgtMap = new Map(targetRegionsMeta.map((r) => [r.id, r]));

  const recommendations: AIOptimizeLayoutMappingResult['recommendations'] = [];

  // Count how many sources map to each target
  const targetUsage = new Map<string, number>();
  for (const m of mappings) {
    targetUsage.set(m.targetRegionId, (targetUsage.get(m.targetRegionId) ?? 0) + 1);
  }

  for (const m of mappings) {
    const src = srcMap.get(m.sourceRegionId);
    const tgt = tgtMap.get(m.targetRegionId);
    if (!src || !tgt) continue;

    const usage = targetUsage.get(m.targetRegionId) ?? 1;

    // Warn if many-to-one should be declared explicitly
    if (usage > 1 && m.mappingType === 'one-to-one') {
      recommendations.push({
        mappingId: m.id,
        suggestion: `Target "${tgt.name}" receives ${usage} sources — change mapping type to "many-to-one" for correct merging.`,
        autoApply: true,
        proposedMappingType: 'many-to-one',
      });
    }

    // Suggest layout changes for poor affinity
    const POOR_FITS: Record<string, string[]> = {
      Tabs:    ['grid', 'inline'],
      Steps:   ['grid', 'sections'],
      DataGrid: ['sections', 'tabs', 'inline'],
    };
    if (POOR_FITS[src.type]?.includes(tgt.layout)) {
      recommendations.push({
        mappingId: m.id,
        suggestion: `"${src.name}" (type: ${src.type}) is mapped to a "${tgt.layout}" target. Consider changing target layout to "flex" or "tabs" for better visual fit.`,
        autoApply: false,
      });
    }
  }

  // Score = 1 - (issues / totalMappings), clamped [0,1]
  const issueCount = recommendations.filter((r) => !r.autoApply).length;
  const overallScore = mappings.length === 0 ? 0 : Math.max(0, 1 - issueCount / mappings.length);

  return { recommendations, overallScore, mock: true };
}
