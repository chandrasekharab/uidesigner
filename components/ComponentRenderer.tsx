'use client';

import React, { memo } from 'react';
import type { UIComponent, ContainerProps, TextInputProps, ButtonProps, DropdownProps, TextProps } from '@/types';
import { cn } from '@/utils/cn';

// ─── Button Variant Styles ────────────────────────────────────────────────────

const BUTTON_VARIANTS: Record<string, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  secondary: 'bg-slate-100 text-slate-800 border border-slate-300 hover:bg-slate-200',
  danger: 'bg-red-500 text-white hover:bg-red-600',
  ghost: 'text-indigo-600 hover:bg-indigo-50',
};

const BUTTON_SIZES: Record<string, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

const TEXT_VARIANTS: Record<string, string> = {
  h1: 'text-3xl font-bold',
  h2: 'text-2xl font-bold',
  h3: 'text-xl font-semibold',
  body: 'text-sm',
  caption: 'text-xs text-slate-500',
  label: 'text-sm font-medium',
};

// ─── Individual Renderers ─────────────────────────────────────────────────────

function renderContainer(component: UIComponent, isSelected: boolean, onSelect: (id: string) => void, previewMode: boolean) {
  const props = component.props as ContainerProps;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: props.layout === 'horizontal' ? 'row' : 'column',
        gap: props.gap ?? 8,
        padding: props.padding ?? 16,
        backgroundColor: props.backgroundColor === 'transparent' ? undefined : props.backgroundColor,
        borderRadius: props.borderRadius ?? 4,
        border: !previewMode ? `${props.borderWidth ?? 1}px dashed ${props.borderColor ?? '#e2e8f0'}` : 'none',
        minHeight: 60,
        position: 'relative',
      }}
      className={cn(
        'transition-all',
        !previewMode && 'hover:border-indigo-300',
        isSelected && !previewMode && '!border-indigo-500 !border-solid ring-2 ring-indigo-200'
      )}
    >
      {!previewMode && component.children.length === 0 && (
        <div className="flex items-center justify-center h-12 text-xs text-slate-400 border border-dashed border-slate-300 rounded-md w-full">
          Drop components here
        </div>
      )}
      {component.children.map((child) => (
        <ComponentRenderer
          key={child.id}
          component={child}
          onSelect={onSelect}
          previewMode={previewMode}
        />
      ))}
    </div>
  );
}

function renderTextInput(props: TextInputProps) {
  return (
    <div className="flex flex-col gap-1">
      {props.label && (
        <label className="text-xs font-medium text-slate-700">
          {props.label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        type={props.type ?? 'text'}
        placeholder={props.placeholder}
        disabled={props.disabled}
        readOnly
        className={cn(
          'px-3 py-2 text-sm rounded-md border border-slate-300 bg-white',
          'focus:outline-none focus:ring-2 focus:ring-indigo-300',
          props.disabled && 'opacity-50 cursor-not-allowed bg-slate-50'
        )}
      />
      {props.helperText && (
        <span className="text-xs text-slate-400">{props.helperText}</span>
      )}
    </div>
  );
}

function renderButton(props: ButtonProps) {
  return (
    <button
      disabled={props.disabled}
      className={cn(
        'rounded-md font-medium transition-colors',
        BUTTON_VARIANTS[props.variant ?? 'primary'],
        BUTTON_SIZES[props.size ?? 'md'],
        props.fullWidth && 'w-full',
        props.disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {props.label}
    </button>
  );
}

function renderDropdown(props: DropdownProps) {
  return (
    <div className="flex flex-col gap-1">
      {props.label && (
        <label className="text-xs font-medium text-slate-700">
          {props.label}
          {props.required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        disabled={props.disabled}
        className={cn(
          'px-3 py-2 text-sm rounded-md border border-slate-300 bg-white',
          'focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer',
          props.disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {props.placeholder && (
          <option value="" disabled selected>
            {props.placeholder}
          </option>
        )}
        {props.options?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function renderText(props: TextProps) {
  return (
    <p
      style={{ color: props.color ?? '#1e293b', textAlign: props.align ?? 'left' }}
      className={cn(
        TEXT_VARIANTS[props.variant ?? 'body'],
        props.bold && 'font-bold',
        props.italic && 'italic'
      )}
    >
      {props.content}
    </p>
  );
}

// ─── Main Component Renderer ──────────────────────────────────────────────────

interface ComponentRendererProps {
  component: UIComponent;
  onSelect: (id: string) => void;
  previewMode: boolean;
  isSelected?: boolean;
}

export const ComponentRenderer = memo(function ComponentRenderer({
  component,
  onSelect,
  previewMode,
  isSelected = false,
}: ComponentRendererProps) {
  const handleClick = (e: React.MouseEvent) => {
    if (!previewMode) {
      e.stopPropagation();
      onSelect(component.id);
    }
  };

  const wrapperClass = cn(
    'relative group',
    !previewMode && 'cursor-pointer',
    isSelected && !previewMode && 'z-10'
  );

  return (
    <div className={wrapperClass} onClick={handleClick} data-id={component.id}>
      {!previewMode && (
        <div className={cn(
          'absolute -top-4 left-0 text-[9px] font-mono px-1 rounded',
          'opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20',
          isSelected ? 'bg-indigo-500 text-white opacity-100' : 'bg-slate-600 text-white'
        )}>
          {component.type}
        </div>
      )}

      {component.type === 'Container'
        ? renderContainer(component, isSelected, onSelect, previewMode)
        : component.type === 'TextInput'
        ? renderTextInput(component.props as TextInputProps)
        : component.type === 'Button'
        ? renderButton(component.props as ButtonProps)
        : component.type === 'Dropdown'
        ? renderDropdown(component.props as DropdownProps)
        : component.type === 'Text'
        ? renderText(component.props as TextProps)
        : null}
    </div>
  );
});
