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
  /** Controls which visual design system is used when rendering */
  renderStyle?: 'a2ui' | 'native';
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

// ─── Native Theme Token Maps ──────────────────────────────────────────────────

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

// ─── Material Design 3 (A2UI SDK) Theme Tokens ────────────────────────────────
// Follows the M3 color system: https://m3.material.io/styles/color/the-color-system

const M3_LIGHT = {
  // Surfaces
  surface: 'bg-[#FFFBFE]',
  surfaceVariant: 'bg-[#E7E0EC]',
  containerBg: 'bg-white',
  // Primary
  primary: '#6750A4',
  primaryHover: '#4F378B',
  onPrimary: 'text-white',
  primaryContainer: 'bg-[#EADDFF]',
  onPrimaryContainer: 'text-[#21005D]',
  // Outlines
  outline: 'border-[#79747E]',
  outlineFocus: 'border-[#6750A4]',
  // Text
  onSurface: 'text-[#1C1B1F]',
  onSurfaceVariant: 'text-[#49454F]',
  error: 'text-[#B3261E]',
  errorBorder: 'border-[#B3261E]',
  // State layers
  stateHover: 'hover:bg-[#6750A4]/[0.08]',
  // Input fill
  inputFill: 'bg-[#E7E0EC]',
  inputFillDark: 'bg-[#CCC2DC]',
  // Select
  selectBg: 'bg-[#E7E0EC]',
};

const M3_DARK = {
  surface: 'bg-[#1C1B1F]',
  surfaceVariant: 'bg-[#49454F]',
  containerBg: 'bg-[#1C1B1F]',
  primary: '#D0BCFF',
  primaryHover: '#E8DEF8',
  onPrimary: 'text-[#371E73]',
  primaryContainer: 'bg-[#4F378B]',
  onPrimaryContainer: 'text-[#EADDFF]',
  outline: 'border-[#938F99]',
  outlineFocus: 'border-[#D0BCFF]',
  onSurface: 'text-[#E6E1E5]',
  onSurfaceVariant: 'text-[#CAC4D0]',
  error: 'text-[#F2B8B5]',
  errorBorder: 'border-[#F2B8B5]',
  stateHover: 'hover:bg-[#D0BCFF]/[0.08]',
  inputFill: 'bg-[#49454F]',
  inputFillDark: 'bg-[#625B71]',
  selectBg: 'bg-[#49454F]',
};

function getM3Theme(cfg: A2UIConfig) {
  return cfg.theme === 'dark' ? M3_DARK : M3_LIGHT;
}

const M3_TYPE_SCALE: Record<string, string> = {
  h1: 'text-[57px] leading-[64px] font-normal tracking-[-0.25px]',
  h2: 'text-[45px] leading-[52px] font-normal',
  h3: 'text-[36px] leading-[44px] font-normal',
  body: 'text-[14px] leading-[20px] font-normal tracking-[0.25px]',
  caption: 'text-[11px] leading-[16px] font-normal tracking-[0.5px]',
  label: 'text-[12px] leading-[16px] font-medium tracking-[0.5px]',
};

// ─── Shared Utilities ─────────────────────────────────────────────────────────

const ce = React.createElement;

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

// ─── Native Render Path ───────────────────────────────────────────────────────

function renderNodeNative(
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
            backgroundColor: p.backgroundColor !== 'transparent' ? p.backgroundColor : undefined,
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
            p.required ? ce('span', { className: 'text-red-500 ml-0.5' }, '*') : null)
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
            onFocus: () => emit({ type: 'focus', componentId: id, componentType: 'TextInput', label: p.label }),
            onBlur: () => emit({ type: 'blur', componentId: id, componentType: 'TextInput', label: p.label }),
          }),
          helperEl
        )
      );
    }
    case 'Button': {
      const p = component.props as ButtonProps;
      const sizeClass = p.size === 'lg' ? 'px-6 py-3 text-base' : p.size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-4 py-2 text-sm';
      const VARIANTS: Record<string, string> = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white',
        secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300',
        danger: 'bg-red-500 hover:bg-red-600 text-white',
        ghost: 'hover:bg-gray-100 text-blue-600',
      };
      return wrap(
        ce('button', {
          key: id, disabled: p.disabled,
          onClick: () => emit({ type: 'click', componentId: id, componentType: 'Button', label: p.label }),
          className: `rounded-md font-medium transition-colors ${sizeClass} ${VARIANTS[p.variant ?? 'primary'] ?? VARIANTS.primary} ${p.fullWidth ? 'w-full' : ''} disabled:opacity-50 disabled:cursor-not-allowed`,
        }, p.label)
      );
    }
    case 'Dropdown': {
      const p = component.props as DropdownProps;
      const labelEl = p.label
        ? ce('label', { className: `text-sm font-medium ${theme.label}` },
            p.label,
            p.required ? ce('span', { className: 'text-red-500 ml-0.5' }, '*') : null)
        : null;
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
            p.placeholder ? ce('option', { value: '', disabled: true }, p.placeholder) : null,
            ...(p.options ?? []).map((opt) => ce('option', { key: opt.value, value: opt.value }, opt.label))
          )
        )
      );
    }
    case 'Text': {
      const p = component.props as TextProps;
      const CLASSES: Record<string, string> = {
        h1: 'text-3xl font-bold', h2: 'text-2xl font-semibold', h3: 'text-xl font-semibold',
        body: 'text-sm', caption: 'text-xs text-gray-500', label: 'text-sm font-medium',
      };
      return wrap(
        ce('p', {
          key: id,
          style: { color: p.color, textAlign: p.align ?? 'left' },
          className: `${CLASSES[p.variant ?? 'body'] ?? CLASSES.body} ${p.bold ? 'font-bold' : ''} ${p.italic ? 'italic' : ''}`,
        }, p.content)
      );
    }
    default:
      return wrap(
        ce('div', { key: id, className: 'px-3 py-2 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-700' },
          `Unknown component type: ${component.type}`)
      );
  }
}

// ─── Material Design 3 / A2UI SDK Render Path ─────────────────────────────────

function renderNodeA2UI(
  component: UIComponent,
  cfg: A2UIConfig,
  m3: ReturnType<typeof getM3Theme>,
  emit: (e: Omit<A2UIEvent, 'timestamp'>) => void,
  debug: boolean
): React.ReactElement {
  const id = component.id;
  const isDark = cfg.theme === 'dark';

  const debugBadge = debug
    ? ce('span', {
        key: `badge-${id}`,
        className: 'absolute -top-3 left-0 text-[9px] font-mono bg-purple-600 text-white px-1.5 rounded-sm z-10 pointer-events-none tracking-wider',
        title: `A2UI·${id}`,
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
      // M3 Card style — rounded-2xl, subtle elevation
      const debugInfo = debug
        ? ce('div', { className: `text-[9px] font-mono mb-2 ${m3.onSurfaceVariant}` },
            `M3 Card · ${p.layout} · ${component.children.length} children`)
        : null;
      return wrap(
        ce('div', {
          key: id,
          style: {
            gap: p.gap ?? 16,
            padding: p.padding ?? 24,
            backgroundColor: p.backgroundColor !== 'transparent' ? p.backgroundColor : undefined,
          },
          className: `flex ${isRow ? 'flex-row flex-wrap' : 'flex-col'} rounded-2xl shadow-md ${isDark ? 'bg-[#2B2930]' : 'bg-white'} border ${isDark ? 'border-[#49454F]' : 'border-[#E7E0EC]'}`,
        },
          debugInfo,
          ...component.children.map((c) => renderNodeA2UI(c, cfg, m3, emit, debug))
        )
      );
    }

    case 'TextInput': {
      const p = component.props as TextInputProps;
      // M3 Filled text field: colored fill + bottom border emphasis + floating label style
      const fillClass = isDark ? 'bg-[#49454F]' : 'bg-[#E7E0EC]';
      const borderBase = `border-b-2 ${isDark ? 'border-[#CAC4D0]' : 'border-[#79747E]'}`;
      const borderFocus = isDark ? 'focus:border-[#D0BCFF]' : 'focus:border-[#6750A4]';
      const textClass = isDark ? 'text-[#E6E1E5]' : 'text-[#1C1B1F]';
      const caretClass = isDark ? 'caret-[#D0BCFF]' : 'caret-[#6750A4]';
      const labelColor = isDark ? 'text-[#CAC4D0]' : 'text-[#49454F]';
      const requiredColor = isDark ? 'text-[#F2B8B5]' : 'text-[#B3261E]';

      const labelEl = p.label
        ? ce('label', {
            className: `text-xs font-medium tracking-[0.4px] ${isDark ? 'text-[#D0BCFF]' : 'text-[#6750A4]'}`,
          },
            p.label,
            p.required ? ce('span', { className: requiredColor + ' ml-0.5' }, ' *') : null)
        : null;

      const helperEl = p.helperText
        ? ce('p', { className: `text-[11px] tracking-[0.4px] mt-1 ${labelColor}` }, p.helperText)
        : null;

      return wrap(
        ce('div', { key: id, className: 'flex flex-col' },
          ce('div', { className: `${fillClass} rounded-t-[4px] px-3 pt-2 pb-0` },
            labelEl,
            ce('input', {
              type: p.type ?? 'text',
              placeholder: p.label ? '' : (p.placeholder ?? ''),
              defaultValue: p.value,
              disabled: p.disabled,
              className: `w-full bg-transparent outline-none py-2 text-[16px] ${textClass} ${caretClass} ${borderBase} ${borderFocus} disabled:opacity-38 placeholder-[#938F99]`,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                emit({ type: 'change', componentId: id, componentType: 'TextInput', label: p.label, value: e.target.value }),
              onFocus: () => emit({ type: 'focus', componentId: id, componentType: 'TextInput', label: p.label }),
              onBlur: () => emit({ type: 'blur', componentId: id, componentType: 'TextInput', label: p.label }),
            })
          ),
          helperEl
        )
      );
    }

    case 'Button': {
      const p = component.props as ButtonProps;
      // M3 button spec: filled = rounded-full, tonal, outlined, text
      const variant = p.variant ?? 'primary';
      const sizeClass = p.size === 'lg'
        ? 'h-12 px-8 text-[15px]'
        : p.size === 'sm'
        ? 'h-8 px-4 text-[13px]'
        : 'h-10 px-6 text-[14px]';

      const M3_VARIANTS: Record<string, string> = {
        // Filled — M3 primary container
        primary: isDark
          ? 'bg-[#D0BCFF] text-[#371E73] hover:bg-[#E8DEF8] active:bg-[#C9B8FF] shadow-sm hover:shadow-md'
          : 'bg-[#6750A4] text-white hover:bg-[#4F378B] active:bg-[#4F378B] shadow-sm hover:shadow-md',
        // Filled Tonal — secondary container
        secondary: isDark
          ? 'bg-[#4A4458] text-[#CCC2DC] hover:bg-[#524E61]'
          : 'bg-[#E8DEF8] text-[#1D192B] hover:bg-[#DDD5F0]',
        // Outlined
        danger: isDark
          ? 'bg-[#8C1D18] text-[#F2B8B5] hover:bg-[#A22018] border border-[#8C1D18]'
          : 'bg-[#B3261E] text-white hover:bg-[#8C1D18] shadow-sm',
        // Text / Ghost
        ghost: isDark
          ? `bg-transparent text-[#D0BCFF] hover:bg-[#D0BCFF]/[0.08]`
          : `bg-transparent text-[#6750A4] hover:bg-[#6750A4]/[0.08]`,
      };

      return wrap(
        ce('button', {
          key: id,
          disabled: p.disabled,
          onClick: () => emit({ type: 'click', componentId: id, componentType: 'Button', label: p.label }),
          className: `rounded-full font-medium tracking-[0.1px] transition-all duration-200 ${sizeClass} ${M3_VARIANTS[variant] ?? M3_VARIANTS.primary} ${p.fullWidth ? 'w-full' : ''} disabled:opacity-38 disabled:cursor-not-allowed disabled:shadow-none`,
        }, p.label)
      );
    }

    case 'Dropdown': {
      const p = component.props as DropdownProps;
      const fillClass = isDark ? 'bg-[#49454F]' : 'bg-[#E7E0EC]';
      const borderBase = `border-b-2 ${isDark ? 'border-[#CAC4D0]' : 'border-[#79747E]'}`;
      const borderFocus = isDark ? 'focus:border-[#D0BCFF]' : 'focus:border-[#6750A4]';
      const textClass = isDark ? 'text-[#E6E1E5]' : 'text-[#1C1B1F]';
      const requiredColor = isDark ? 'text-[#F2B8B5]' : 'text-[#B3261E]';

      const labelEl = p.label
        ? ce('label', {
            className: `text-xs font-medium tracking-[0.4px] ${isDark ? 'text-[#D0BCFF]' : 'text-[#6750A4]'}`,
          },
            p.label,
            p.required ? ce('span', { className: requiredColor + ' ml-0.5' }, ' *') : null)
        : null;

      return wrap(
        ce('div', { key: id, className: `${fillClass} rounded-t-[4px] px-3 pt-2 pb-0 flex flex-col` },
          labelEl,
          ce('select', {
            disabled: p.disabled,
            className: `w-full bg-transparent outline-none py-2 text-[16px] ${textClass} ${borderBase} ${borderFocus} cursor-pointer disabled:opacity-38 appearance-none`,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
              emit({ type: 'change', componentId: id, componentType: 'Dropdown', label: p.label, value: e.target.value }),
            defaultValue: '',
          },
            p.placeholder ? ce('option', { value: '', disabled: true }, p.placeholder) : null,
            ...(p.options ?? []).map((opt) => ce('option', { key: opt.value, value: opt.value }, opt.label))
          )
        )
      );
    }

    case 'Text': {
      const p = component.props as TextProps;
      const textColor = p.color ?? (isDark ? '#E6E1E5' : '#1C1B1F');
      const typeClass = M3_TYPE_SCALE[p.variant ?? 'body'] ?? M3_TYPE_SCALE.body;
      return wrap(
        ce('p', {
          key: id,
          style: { color: textColor, textAlign: p.align ?? 'left' },
          className: `font-['Google_Sans',_'Roboto',_sans-serif] ${typeClass} ${p.bold ? 'font-bold' : ''} ${p.italic ? 'italic' : ''}`,
        }, p.content)
      );
    }

    default:
      return wrap(
        ce('div', {
          key: id,
          style: { backgroundColor: isDark ? '#49454F' : '#E7E0EC', borderRadius: 12 },
          className: `px-4 py-3 text-xs ${m3.onSurfaceVariant}`,
        }, `Unknown component: ${component.type}`)
      );
  }
}

// ─── Unified Dispatcher ───────────────────────────────────────────────────────

function renderNode(
  component: UIComponent,
  cfg: A2UIConfig,
  theme: ReturnType<typeof getTheme>,
  emit: (e: Omit<A2UIEvent, 'timestamp'>) => void,
  debug: boolean
): React.ReactElement {
  if (cfg.renderStyle === 'a2ui') {
    return renderNodeA2UI(component, cfg, getM3Theme(cfg), emit, debug);
  }
  return renderNodeNative(component, cfg, theme, emit, debug);
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
    const isA2UIStyle = config.renderStyle === 'a2ui';
    const isDark = config.theme === 'dark';

    const emit = (e: Omit<A2UIEvent, 'timestamp'>) => {
      config.onEvent?.({ ...e, timestamp: new Date() });
    };

    if (schema.length === 0) {
      warnings.push('Empty schema — nothing to render');
    }

    // Root wrapper uses M3 surface color for A2UI style, plain bg for native
    const rootBg = isA2UIStyle
      ? isDark ? 'bg-[#141218]' : 'bg-[#FEF7FF]'
      : theme.bg;

    const elements = ce('div', {
      className: `min-h-full p-6 space-y-4 ${rootBg}`,
      'data-a2ui-root': true,
      'data-a2ui-version': MOCK_A2UI_VERSION,
      'data-render-style': config.renderStyle ?? 'native',
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
