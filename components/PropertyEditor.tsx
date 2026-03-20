'use client';

import React, { memo, useCallback } from 'react';
import { useBuilderStore } from '@/store/builderStore';
import type {
  UIComponent,
  ContainerProps,
  TextInputProps,
  ButtonProps,
  DropdownProps,
  TextProps,
} from '@/types';
import { cn } from '@/utils/cn';
import { Trash2, X } from 'lucide-react';

// ─── Field Primitives ─────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full px-2.5 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors';

const selectClass =
  'w-full px-2.5 py-1.5 text-sm rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-colors cursor-pointer';

// ─── Per-type Property Forms ──────────────────────────────────────────────────

function ContainerEditor({
  props,
  onChange,
}: {
  props: ContainerProps;
  onChange: (p: Partial<ContainerProps>) => void;
}) {
  return (
    <>
      <Field label="Label">
        <input
          className={inputClass}
          value={props.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Field>
      <Field label="Layout">
        <select
          className={selectClass}
          value={props.layout}
          onChange={(e) => onChange({ layout: e.target.value as ContainerProps['layout'] })}
        >
          <option value="vertical">Vertical (Column)</option>
          <option value="horizontal">Horizontal (Row)</option>
        </select>
      </Field>
      <Field label="Gap (px)">
        <input
          type="number"
          className={inputClass}
          value={props.gap ?? 8}
          onChange={(e) => onChange({ gap: Number(e.target.value) })}
        />
      </Field>
      <Field label="Padding (px)">
        <input
          type="number"
          className={inputClass}
          value={props.padding ?? 16}
          onChange={(e) => onChange({ padding: Number(e.target.value) })}
        />
      </Field>
      <Field label="Border Radius (px)">
        <input
          type="number"
          className={inputClass}
          value={props.borderRadius ?? 4}
          onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
        />
      </Field>
      <Field label="Border Color">
        <input
          type="color"
          className="w-full h-8 rounded cursor-pointer border border-slate-200 dark:border-slate-600"
          value={props.borderColor ?? '#e2e8f0'}
          onChange={(e) => onChange({ borderColor: e.target.value })}
        />
      </Field>
      <Field label="Background Color">
        <input
          type="color"
          className="w-full h-8 rounded cursor-pointer border border-slate-200 dark:border-slate-600"
          value={props.backgroundColor === 'transparent' ? '#ffffff' : (props.backgroundColor ?? '#ffffff')}
          onChange={(e) => onChange({ backgroundColor: e.target.value })}
        />
      </Field>
    </>
  );
}

function TextInputEditor({
  props,
  onChange,
}: {
  props: TextInputProps;
  onChange: (p: Partial<TextInputProps>) => void;
}) {
  return (
    <>
      <Field label="Label">
        <input
          className={inputClass}
          value={props.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Field>
      <Field label="Placeholder">
        <input
          className={inputClass}
          value={props.placeholder ?? ''}
          onChange={(e) => onChange({ placeholder: e.target.value })}
        />
      </Field>
      <Field label="Input Type">
        <select
          className={selectClass}
          value={props.type ?? 'text'}
          onChange={(e) => onChange({ type: e.target.value as TextInputProps['type'] })}
        >
          <option value="text">Text</option>
          <option value="email">Email</option>
          <option value="password">Password</option>
          <option value="number">Number</option>
        </select>
      </Field>
      <Field label="Helper Text">
        <input
          className={inputClass}
          value={props.helperText ?? ''}
          onChange={(e) => onChange({ helperText: e.target.value })}
        />
      </Field>
      <Field label="Options">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={props.required ?? false}
              onChange={(e) => onChange({ required: e.target.checked })}
              className="rounded accent-indigo-600"
            />
            Required
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={props.disabled ?? false}
              onChange={(e) => onChange({ disabled: e.target.checked })}
              className="rounded accent-indigo-600"
            />
            Disabled
          </label>
        </div>
      </Field>
    </>
  );
}

function ButtonEditor({
  props,
  onChange,
}: {
  props: ButtonProps;
  onChange: (p: Partial<ButtonProps>) => void;
}) {
  return (
    <>
      <Field label="Label">
        <input
          className={inputClass}
          value={props.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Field>
      <Field label="Variant">
        <select
          className={selectClass}
          value={props.variant ?? 'primary'}
          onChange={(e) => onChange({ variant: e.target.value as ButtonProps['variant'] })}
        >
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="danger">Danger</option>
          <option value="ghost">Ghost</option>
        </select>
      </Field>
      <Field label="Size">
        <select
          className={selectClass}
          value={props.size ?? 'md'}
          onChange={(e) => onChange({ size: e.target.value as ButtonProps['size'] })}
        >
          <option value="sm">Small</option>
          <option value="md">Medium</option>
          <option value="lg">Large</option>
        </select>
      </Field>
      <Field label="Options">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={props.fullWidth ?? false}
              onChange={(e) => onChange({ fullWidth: e.target.checked })}
              className="rounded accent-indigo-600"
            />
            Full Width
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={props.disabled ?? false}
              onChange={(e) => onChange({ disabled: e.target.checked })}
              className="rounded accent-indigo-600"
            />
            Disabled
          </label>
        </div>
      </Field>
    </>
  );
}

function DropdownEditor({
  props,
  onChange,
}: {
  props: DropdownProps;
  onChange: (p: Partial<DropdownProps>) => void;
}) {
  const optionsText = (props.options ?? [])
    .map((o) => `${o.label}:${o.value}`)
    .join('\n');

  const handleOptionsChange = (value: string) => {
    const options = value
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [label, val] = line.split(':');
        return { label: label?.trim() ?? '', value: val?.trim() ?? label?.trim() ?? '' };
      });
    onChange({ options });
  };

  return (
    <>
      <Field label="Label">
        <input
          className={inputClass}
          value={props.label ?? ''}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </Field>
      <Field label="Placeholder">
        <input
          className={inputClass}
          value={props.placeholder ?? ''}
          onChange={(e) => onChange({ placeholder: e.target.value })}
        />
      </Field>
      <Field label="Options (label:value)">
        <textarea
          className={cn(inputClass, 'resize-none font-mono text-xs')}
          rows={5}
          value={optionsText}
          onChange={(e) => handleOptionsChange(e.target.value)}
        />
      </Field>
      <Field label="Options">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={props.required ?? false}
              onChange={(e) => onChange({ required: e.target.checked })}
              className="rounded accent-indigo-600"
            />
            Required
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={props.disabled ?? false}
              onChange={(e) => onChange({ disabled: e.target.checked })}
              className="rounded accent-indigo-600"
            />
            Disabled
          </label>
        </div>
      </Field>
    </>
  );
}

function TextEditor({
  props,
  onChange,
}: {
  props: TextProps;
  onChange: (p: Partial<TextProps>) => void;
}) {
  return (
    <>
      <Field label="Content">
        <textarea
          className={cn(inputClass, 'resize-none')}
          rows={3}
          value={props.content}
          onChange={(e) => onChange({ content: e.target.value })}
        />
      </Field>
      <Field label="Variant">
        <select
          className={selectClass}
          value={props.variant ?? 'body'}
          onChange={(e) => onChange({ variant: e.target.value as TextProps['variant'] })}
        >
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="body">Body</option>
          <option value="caption">Caption</option>
          <option value="label">Label</option>
        </select>
      </Field>
      <Field label="Alignment">
        <select
          className={selectClass}
          value={props.align ?? 'left'}
          onChange={(e) => onChange({ align: e.target.value as TextProps['align'] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
      <Field label="Color">
        <input
          type="color"
          className="w-full h-8 rounded cursor-pointer border border-slate-200 dark:border-slate-600"
          value={props.color ?? '#1e293b'}
          onChange={(e) => onChange({ color: e.target.value })}
        />
      </Field>
      <Field label="Style">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={props.bold ?? false}
              onChange={(e) => onChange({ bold: e.target.checked })}
              className="rounded accent-indigo-600"
            />
            Bold
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={props.italic ?? false}
              onChange={(e) => onChange({ italic: e.target.checked })}
              className="rounded accent-indigo-600"
            />
            Italic
          </label>
        </div>
      </Field>
    </>
  );
}

// ─── Property Editor Panel ────────────────────────────────────────────────────

export const PropertyEditor = memo(function PropertyEditor() {
  const selectedId = useBuilderStore((s) => s.selectedId);
  const getSelected = useBuilderStore((s) => s.getSelectedComponent);
  const updateProps = useBuilderStore((s) => s.updateProps);
  const removeComponent = useBuilderStore((s) => s.removeComponent);
  const selectComponent = useBuilderStore((s) => s.selectComponent);

  const component = getSelected();

  const handleChange = useCallback(
    (partial: Partial<UIComponent['props']>) => {
      if (!selectedId) return;
      updateProps(selectedId, partial);
    },
    [selectedId, updateProps]
  );

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    removeComponent(selectedId);
  }, [selectedId, removeComponent]);

  if (!component) {
    return (
      <aside className="w-64 flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-3xl mb-3">🖱️</div>
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No component selected</p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          Click a component on the canvas to edit its properties.
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Properties
          </h2>
          <p className="text-sm font-semibold text-indigo-600 mt-0.5">{component.type}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDelete}
            title="Delete component"
            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => selectComponent(null)}
            title="Deselect"
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ID display */}
      <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <p className="text-[10px] font-mono text-slate-400 truncate" title={component.id}>
          id: {component.id}
        </p>
      </div>

      {/* Form fields */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {component.type === 'Container' && (
          <ContainerEditor
            props={component.props as ContainerProps}
            onChange={handleChange}
          />
        )}
        {component.type === 'TextInput' && (
          <TextInputEditor
            props={component.props as TextInputProps}
            onChange={handleChange}
          />
        )}
        {component.type === 'Button' && (
          <ButtonEditor
            props={component.props as ButtonProps}
            onChange={handleChange}
          />
        )}
        {component.type === 'Dropdown' && (
          <DropdownEditor
            props={component.props as DropdownProps}
            onChange={handleChange}
          />
        )}
        {component.type === 'Text' && (
          <TextEditor
            props={component.props as TextProps}
            onChange={handleChange}
          />
        )}
      </div>
    </aside>
  );
});
