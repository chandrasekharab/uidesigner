import type { UIComponent } from '@/types';

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
