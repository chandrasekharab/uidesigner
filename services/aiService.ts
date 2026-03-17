import type { UIComponent } from '@/types';
import type { CanonicalType } from '@/types/canonical';
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

