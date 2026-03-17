/**
 * Renderer Factory
 *
 * Pluggable adapter pattern for rendering UIComponent schemas.
 * Add new renderers here without touching any UI component.
 *
 * Future adapters: Storybook, Material UI, Ant Design, custom DSL
 */

import type { UIComponent } from '@/types';
import {
  MockA2UIClient,
  type A2UIConfig,
  type A2UIRenderResult,
  type A2UIValidationResult,
} from './mockA2UI';

// ─── Shared Types ─────────────────────────────────────────────────────────────

export type RendererType = 'a2ui' | 'native';

export interface RendererConfig extends A2UIConfig {
  rendererType?: RendererType;
}

export interface RendererAdapter {
  id: RendererType;
  label: string;
  description: string;
  badgeColor: string;
  sdkName: string;
  sdkVersion: string;
  render(schema: UIComponent[], config: RendererConfig): A2UIRenderResult;
  validate(schema: unknown): A2UIValidationResult;
}

// ─── A2UI Adapter ─────────────────────────────────────────────────────────────

const a2uiAdapter: RendererAdapter = {
  id: 'a2ui',
  label: 'A2UI SDK',
  description: 'Renders via the A2UI runtime SDK (mock). Production-ready output.',
  badgeColor: 'bg-blue-600',
  sdkName: MockA2UIClient.sdkName,
  sdkVersion: MockA2UIClient.version,
  render: (schema, config) => MockA2UIClient.render(schema, config),
  validate: (schema) => MockA2UIClient.validate(schema),
};

// ─── Native Adapter ───────────────────────────────────────────────────────────
// Same visual output as the canvas builder — useful for side-by-side comparison.

const nativeAdapter: RendererAdapter = {
  id: 'native',
  label: 'Native (Builder)',
  description: 'Renders via the built-in canvas renderer — ideal for quick comparison.',
  badgeColor: 'bg-indigo-600',
  sdkName: 'UIBuilder Native',
  sdkVersion: '1.0.0',
  render: (schema, config) => MockA2UIClient.render(schema, config), // shares mock impl
  validate: (schema) => MockA2UIClient.validate(schema),
};

// ─── Registry ────────────────────────────────────────────────────────────────

const RENDERER_REGISTRY: Record<RendererType, RendererAdapter> = {
  a2ui: a2uiAdapter,
  native: nativeAdapter,
};

/**
 * Get a registered renderer adapter by type.
 */
export function getRenderer(type: RendererType): RendererAdapter {
  return RENDERER_REGISTRY[type] ?? a2uiAdapter;
}

/**
 * Return all registered adapters for selection UI.
 */
export function getAllRenderers(): RendererAdapter[] {
  return Object.values(RENDERER_REGISTRY);
}
