import type {
  ComponentType,
  ComponentProps,
  ContainerProps,
  TextInputProps,
  ButtonProps,
  DropdownProps,
  TextProps,
  PaletteItem,
} from '@/types';

// ─── Default Props per Type ───────────────────────────────────────────────────

export function getDefaultProps(type: ComponentType): ComponentProps {
  switch (type) {
    case 'Container':
      return {
        layout: 'vertical',
        gap: 8,
        padding: 16,
        backgroundColor: 'transparent',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        label: 'Container',
      } satisfies ContainerProps;

    case 'TextInput':
      return {
        label: 'Label',
        placeholder: 'Enter text...',
        value: '',
        required: false,
        disabled: false,
        type: 'text',
        helperText: '',
      } satisfies TextInputProps;

    case 'Button':
      return {
        label: 'Click Me',
        variant: 'primary',
        size: 'md',
        disabled: false,
        fullWidth: false,
      } satisfies ButtonProps;

    case 'Dropdown':
      return {
        label: 'Select',
        placeholder: 'Choose an option...',
        options: [
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
          { label: 'Option 3', value: 'option3' },
        ],
        required: false,
        disabled: false,
      } satisfies DropdownProps;

    case 'Text':
      return {
        content: 'Your text here',
        variant: 'body',
        color: '#1e293b',
        align: 'left',
        bold: false,
        italic: false,
      } satisfies TextProps;
  }
}

// ─── Palette Definition ───────────────────────────────────────────────────────

export const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'Container',
    label: 'Container',
    icon: 'layout',
    defaultProps: getDefaultProps('Container'),
  },
  {
    type: 'TextInput',
    label: 'Text Input',
    icon: 'text-cursor-input',
    defaultProps: getDefaultProps('TextInput'),
  },
  {
    type: 'Button',
    label: 'Button',
    icon: 'mouse-pointer-click',
    defaultProps: getDefaultProps('Button'),
  },
  {
    type: 'Dropdown',
    label: 'Dropdown',
    icon: 'chevrons-up-down',
    defaultProps: getDefaultProps('Dropdown'),
  },
  {
    type: 'Text',
    label: 'Text / Label',
    icon: 'type',
    defaultProps: getDefaultProps('Text'),
  },
];
