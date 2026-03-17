/**
 * Mock A2UI SDK
 *
 * Simulates the behaviour of the real @a2ui/core SDK.
 * Replace the entire file body with the real SDK import when available:
 *
 *   import { A2UIClient } from '@a2ui/core';
 *   export { A2UIClient };
 *   export type { A2UIConfig, A2UIEvent, A2UIRenderResult, A2UIValidationResult };
 */

import React from 'react';
import type {
  UIComponent,
  ContainerProps,
  TextInputProps,
  ButtonProps,
  DropdownProps,
  TextProps,
} from '@/types';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type A2UITheme = 'light' | 'dark' | 'system';

export interface A2UIEvent {
  type: 'click' | 'change' | 'focus' | 'blur' | 'submit';
  componentId: string;
  componentType: string;
  label?: string;
  value?: unknown;
  timestamp: Date;
}

export interface A2UIConfig {
  theme?: A2UITheme;
  debug?: boolean;
  locale?: string;
  onEvent?: (event: A2UIEvent) => void;
}

export interface A2UIDebugNode {
  id: string;
  type: string;
  label: string;
  depth: number;
  binding?: string;
}

export interface A2UIRenderResult {
  elements: React.ReactElement;
  /** Flat list of all rendered components for the debug panel */
  debugTree: A2UIDebugNode[];
  /** Non-fatal warnings from the SDK (e.g. unknown props) */
  warnings: string[];
  componentCount: number;
}

export interface A2UIValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Theme Token Maps ─────────────────────────────────────────────────────────

const LIGHT = {
  bg: 'bg-white',
  containerBg: 'bg-white',
  border: 'border-gray-200',
  label: 'text-gray-700',
  input: 'border-gray-300 bg-white text-gray-900 focus:ring-blue-500 focus:border-blue-500',
  helper: 'text-gray-400',
  placeholder: 'placeholder-gray-400',
  selectBg: 'bg-white',
};

const DARK = {
  bg: 'bg-gray-900',
  containerBg: 'bg-gray-800',
  border: 'border-gray-700',
  label: 'text-gray-200',
  input: 'border-gray-600 bg-gray-700 text-gray-100 focus:ring-blue-400 focus:border-blue-400',
  helper: 'text-gray-500',
  placeholder: 'placeholder-gray-500',
  selectBg: 'bg-gray-700',
};

function getTheme(cfg: A2UIConfig) {
  if (cfg.theme === 'dark') return DARK;
  return LIGHT;
}

const BUTTON_VARIANTS: Record<string, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
  ghost: 'hover:bg-gray-100 text-blue-600',
};

const TEXT_CLASSES: Record<string, string> = {
  h1: 'text-3xl font-bold',
  h2: 'text-2xl font-semibold',
  h3: 'text-xl font-semibold',
  body: 'text-sm',
  caption: 'text-xs text-gray-500',
  label: 'text-sm font-medium',
};

// ─── Recursive Renderer ───────────────────────────────────────────────────────

function buildDebugNodes(
  nodes: UIComponent[],
  depth = 0,
  out: A2UIDebugNode[] = []
): A2UIDebugNode[] {
  for (const n of nodes) {
    const props = n.props as Record<string, unknown>;
    out.push({
      id: n.id,
      type: n.type,
      label: String(props.label ?? props.content ?? n.type),
      depth,
      binding: typeof props.value === 'string' ? props.value : undefined,
    });
    if (n.children?.length) buildDebugNodes(n.children, depth + 1, out);
  }
  return out;
}

const ce = React.createElement;

function renderNode(
  component: UIComponent,
  cfg: A2UIConfig,
  theme: ReturnType<typeof getTheme>,
  emit: (e: Omit<A2UIEvent, 'timestamp'>) => void,
  debug: boolean
): React.ReactElement {
  const id = component.id;

  const debugBadge = debug
    ? ce('span', {
        key: `badge-${id}`,
        className:
          'absolute -top-3 left-0 text-[9px] font-mono bg-blue-500 text-white px-1 rounded z-10 pointer-events-none',
        title: `id: ${id}`,
      }, component.type)
    : null;

  const wrap = (el: React.ReactElement): React.ReactElement =>
    debug
      ? ce('div', { className: 'relative', key: id }, debugBadge, el)
      : ce(React.Fragment, { key: id }, el);

  switch (component.type) {
    case 'Container': {
      const p = component.props as ContainerProps;
      const isRow = p.layout === 'horizontal';
      const debugInfo = debug
        ? ce('div', { className: 'text-[9px] font-mono text-blue-400 mb-1' },
            `Container · ${p.layout} · ${component.children.length} children`)
        : null;
      return wrap(
        ce('div', {
          key: id,
          style: {
            gap: p.gap ?? 16,
            padding: p.padding ?? 20,
            backgroundColor:
              p.backgroundColor !== 'transparent' ? p.backgroundColor : undefined,
            borderRadius: p.borderRadius ?? 8,
          },
          className: `flex ${isRow ? 'flex-row flex-wrap' : 'flex-col'} border ${theme.border} ${theme.containerBg} shadow-sm`,
        },
          debugInfo,
          ...component.children.map((c) => renderNode(c, cfg, theme, emit, debug))
        )
      );
    }

    case 'TextInput': {
      const p = component.props as TextInputProps;
      const labelEl = p.label
        ? ce('label', { className: `text-sm font-medium ${theme.label}` },
            p.label,
            p.required ? ce('span', { className: 'text-red-500 ml-0.5' }, '*') : null
          )
        : null;
      const helperEl = p.helperText
        ? ce('p', { className: `text-xs ${theme.helper}` }, p.helperText)
        : null;
      return wrap(
        ce('div', { key: id, className: 'flex flex-col gap-1.5' },
          labelEl,
          ce('input', {
            type: p.type ?? 'text',
            placeholder: p.placeholder,
            defaultValue: p.value,
            disabled: p.disabled,
            className: `px-3 py-2 text-sm rounded-md border focus:outline-none focus:ring-2 transition-colors ${theme.input} ${theme.placeholder} disabled:opacity-50 disabled:cursor-not-allowed`,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
              emit({ type: 'change', componentId: id, componentType: 'TextInput', label: p.label, value: e.target.value }),
            onFocus: () =>
              emit({ type: 'focus', componentId: id, componentType: 'TextInput', label: p.label }),
            onBlur: () =>
              emit({ type: 'blur', componentId: id, componentType: 'TextInput', label: p.label }),
          }),
          helperEl
        )
      );
    }

    case 'Button': {
      const p = component.props as ButtonProps;
      const sizeClass =
        p.size === 'lg' ? 'px-6 py-3 text-base' :
        p.size === 'sm' ? 'px-2.5 py-1 text-xs' :
        'px-4 py-2 text-sm';
      return wrap(
        ce('button', {
          key: id,
          disabled: p.disabled,
          onClick: () =>
            emit({ type: 'click', componentId: id, componentType: 'Button', label: p.label }),
          className: `rounded-md font-medium transition-colors ${sizeClass} ${BUTTON_VARIANTS[p.variant ?? 'primary'] ?? BUTTON_VARIANTS.primary} ${p.fullWidth ? 'w-full' : ''} disabled:opacity-50 disabled:cursor-not-allowed`,
        }, p.label)
      );
    }

    case 'Dropdown': {
      const p = component.props as DropdownProps;
      const labelEl = p.label
        ? ce('label', { className: `text-sm font-medium ${theme.label}` },
            p.label,
            p.required ? ce('span', { className: 'text-red-500 ml-0.5' }, '*') : null
          )
        : null;
      const placeholderOpt = p.placeholder
        ? ce('option', { value: '', disabled: true }, p.placeholder)
        : null;
      const optionEls = (p.options ?? []).map((opt) =>
        ce('option', { key: opt.value, value: opt.value }, opt.label)
      );
      return wrap(
        ce('div', { key: id, className: 'flex flex-col gap-1.5' },
          labelEl,
          ce('select', {
            disabled: p.disabled,
            className: `px-3 py-2 text-sm rounded-md border focus:outline-none focus:ring-2 cursor-pointer ${theme.input} ${theme.selectBg} disabled:opacity-50`,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              emit({ type: 'change', componentId: id, componentType: 'Dropdown', label: p.label, value: e.target.value }),
            defaultValue: '',
          },
            placeholderOpt,
            ...optionEls
          )
        )
      );
    }

    case 'Text': {
      const p = component.props as TextProps;
      return wrap(
        ce('p', {
          key: id,
          style: { color: p.color, textAlign: p.align ?? 'left' },
          className: `${TEXT_CLASSES[p.variant ?? 'body'] ?? TEXT_CLASSES.body} ${p.bold ? 'font-bold' : ''} ${p.italic ? 'italic' : ''}`,
        }, p.content)
      );
    }

    default:
      return wrap(
        ce('div', {
          key: id,
          className: 'px-3 py-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-700',
        }, `Unknown component type: ${component.type}`)
      );
  }
}

// ─── SDK Validation ───────────────────────────────────────────────────────────

function validateNode(
  node: unknown,
  path: string,
  errors: string[],
  warnings: string[]
): void {
  if (typeof node !== 'object' || node === null) {
    errors.push(`[${path}] Must be an object`);
    return;
  }
  const n = node as Record<string, unknown>;
  if (!n.id) errors.push(`[${path}] Missing required field "id"`);
  if (!n.type) errors.push(`[${path}] Missing required field "type"`);
  if (!n.props || typeof n.props !== 'object') {
    warnings.push(`[${path}] Missing "props" — using defaults`);
  }
  if (Array.isArray(n.children)) {
    (n.children as unknown[]).forEach((c, i) =>
      validateNode(c, `${path}.children[${i}]`, errors, warnings)
    );
  }
}

// ─── Main SDK Client ──────────────────────────────────────────────────────────

const MOCK_A2UI_VERSION = '1.0.0-mock';

export const MockA2UIClient = {
  version: MOCK_A2UI_VERSION,
  sdkName: 'A2UI',

  /**
   * Render a UIComponent schema into React elements.
   * In the real SDK this would call SDK.init(container, schema, config).
   */
  render(schema: UIComponent[], config: A2UIConfig = {}): A2UIRenderResult {
    const warnings: string[] = [];
    const theme = getTheme(config);
    const debug = config.debug ?? false;

    const emit = (e: Omit<A2UIEvent, 'timestamp'>) => {
      config.onEvent?.({ ...e, timestamp: new Date() });
    };

    if (schema.length === 0) {
      warnings.push('Empty schema — nothing to render');
    }

    const elements = ce('div', {
      className: `min-h-full p-6 space-y-4 ${theme.bg}`,
      'data-a2ui-root': true,
      'data-a2ui-version': MOCK_A2UI_VERSION,
    }, ...schema.map((c) => renderNode(c, config, theme, emit, debug)));

    const debugTree = buildDebugNodes(schema);
    let componentCount = 0;
    const countNodes = (nodes: UIComponent[]) => {
      componentCount += nodes.length;
      nodes.forEach((n) => countNodes(n.children));
    };
    countNodes(schema);

    return { elements, debugTree, warnings, componentCount };
  },

  /**
   * Validate a raw JSON array against A2UI schema requirements.
   */
  validate(schema: unknown): A2UIValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(schema)) {
      return {
        valid: false,
        errors: ['Root schema must be a JSON array'],
        warnings: [],
      };
    }
    schema.forEach((node, i) => validateNode(node, `$[${i}]`, errors, warnings));
    return { valid: errors.length === 0, errors, warnings };
  },
};
