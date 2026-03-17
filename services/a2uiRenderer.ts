/**
 * A2UI Renderer Service
 *
 * Integration layer between the platform and the A2UI SDK.
 * Handles schema preparation, validation, and lifecycle concerns
 * so UI components remain thin.
 */

import type { UIComponent } from '@/types';
import { MockA2UIClient, type A2UIValidationResult } from './mockA2UI';
import { getRenderer, type RendererType } from './rendererFactory';

// ─── Schema Preparation ───────────────────────────────────────────────────────

/**
 * Parse a raw JSON string and return a UIComponent array.
 * Throws on malformed JSON or schema violations.
 */
export function prepareSchema(raw: string): UIComponent[] {
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Schema root must be a JSON array.');
  }
  return parsed as UIComponent[];
}

/**
 * Validate a UIComponent array against A2UI rendering requirements.
 */
export function validateSchemaForA2UI(schema: unknown): A2UIValidationResult {
  return MockA2UIClient.validate(schema);
}

/**
 * Validate a raw JSON string — parses first, then validates schema.
 */
export function validateRawJSON(raw: string): A2UIValidationResult {
  try {
    const parsed = JSON.parse(raw);
    return MockA2UIClient.validate(parsed);
  } catch (e) {
    return {
      valid: false,
      errors: [`JSON parse error: ${(e as Error).message}`],
      warnings: [],
    };
  }
}

// ─── SDK Info ─────────────────────────────────────────────────────────────────

export interface SDKInfo {
  name: string;
  version: string;
  mock: boolean;
  capabilities: string[];
}

export function getSDKInfo(type: RendererType = 'a2ui'): SDKInfo {
  const adapter = getRenderer(type);
  return {
    name: adapter.sdkName,
    version: adapter.sdkVersion,
    mock: adapter.sdkVersion.includes('mock'),
    capabilities: [
      'JSON schema rendering',
      'Light / dark theming',
      'Interactive form elements',
      'Event emission',
      'Debug overlay',
      'Schema validation',
    ],
  };
}

// ─── Schema Hints ─────────────────────────────────────────────────────────────

/**
 * Auto-repair common schema issues before rendering.
 * Returns the repaired schema and a list of changes applied.
 */
export function autoRepairSchema(
  schema: UIComponent[]
): { schema: UIComponent[]; repairs: string[] } {
  const repairs: string[] = [];

  function repairNode(node: UIComponent): UIComponent {
    const fixed = { ...node };

    // Ensure props is always an object
    if (!fixed.props || typeof fixed.props !== 'object') {
      fixed.props = {} as UIComponent['props'];
      repairs.push(`[${node.id}] Added missing props object`);
    }

    // Ensure children is always an array
    if (!Array.isArray(fixed.children)) {
      fixed.children = [];
      repairs.push(`[${node.id}] Added missing children array`);
    } else {
      fixed.children = fixed.children.map(repairNode);
    }

    // Button must have a label
    if (fixed.type === 'Button') {
      const p = fixed.props as Record<string, unknown>;
      if (!p.label) {
        (fixed.props as Record<string, unknown>).label = 'Button';
        repairs.push(`[${node.id}] Added default label for Button`);
      }
    }

    // Text must have content
    if (fixed.type === 'Text') {
      const p = fixed.props as Record<string, unknown>;
      if (!p.content) {
        (fixed.props as Record<string, unknown>).content = '';
        repairs.push(`[${node.id}] Added empty content for Text`);
      }
    }

    return fixed;
  }

  return { schema: schema.map(repairNode), repairs };
}
