// ─── Core Component Schema ────────────────────────────────────────────────────

export type ComponentType =
  | 'Container'
  | 'TextInput'
  | 'Button'
  | 'Dropdown'
  | 'Text';

export interface ContainerProps {
  layout: 'vertical' | 'horizontal';
  gap?: number;
  padding?: number;
  backgroundColor?: string;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;
  label?: string;
}

export interface TextInputProps {
  label?: string;
  placeholder?: string;
  value?: string;
  required?: boolean;
  disabled?: boolean;
  type?: 'text' | 'email' | 'password' | 'number';
  helperText?: string;
}

export interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  fullWidth?: boolean;
}

export interface DropdownProps {
  label?: string;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>;
  required?: boolean;
  disabled?: boolean;
}

export interface TextProps {
  content: string;
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'label';
  color?: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
}

export type ComponentProps =
  | ContainerProps
  | TextInputProps
  | ButtonProps
  | DropdownProps
  | TextProps;

// ─── Universal Component Node ─────────────────────────────────────────────────

export interface UIComponent {
  id: string;
  type: ComponentType;
  props: ComponentProps;
  children: UIComponent[];
}

// ─── Canvas / Builder State ───────────────────────────────────────────────────

export interface BuilderState {
  components: UIComponent[];
  selectedId: string | null;
  past: UIComponent[][];
  future: UIComponent[][];
  previewMode: boolean;
}

// ─── Palette Item ─────────────────────────────────────────────────────────────

export interface PaletteItem {
  type: ComponentType;
  label: string;
  icon: string;
  defaultProps: ComponentProps;
}

// ─── Drag Data ────────────────────────────────────────────────────────────────

export interface DragData {
  source: 'palette' | 'canvas';
  type?: ComponentType;
  id?: string;
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface SaveUIRequest {
  components: UIComponent[];
  name?: string;
}

export interface SaveUIResponse {
  success: boolean;
  id: string;
  savedAt: string;
}

export interface LoadUIResponse {
  id: string;
  components: UIComponent[];
  name: string;
  savedAt: string;
}
