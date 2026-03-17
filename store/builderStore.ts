import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { v4 as uuidv4 } from 'uuid';
import type { UIComponent, ComponentType, ComponentProps } from '@/types';
import { getDefaultProps } from '@/utils/componentDefaults';

// ─── Store Interface ──────────────────────────────────────────────────────────

interface BuilderStore {
  // State
  components: UIComponent[];
  selectedId: string | null;
  past: UIComponent[][];
  future: UIComponent[][];
  previewMode: boolean;

  // Selection
  selectComponent: (id: string | null) => void;
  getSelectedComponent: () => UIComponent | null;

  // Component CRUD
  addComponent: (type: ComponentType, parentId?: string | null, index?: number) => string;
  removeComponent: (id: string) => void;
  updateProps: (id: string, props: Partial<ComponentProps>) => void;
  moveComponent: (activeId: string, overId: string | null, parentId?: string | null) => void;

  // JSON Import / Export
  setComponents: (components: UIComponent[]) => void;

  // Undo / Redo
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Preview
  togglePreview: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deep-clone via JSON (fast enough for typical UI trees) */
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Find a component by id anywhere in the tree */
export function findComponent(
  nodes: UIComponent[],
  id: string
): UIComponent | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findComponent(node.children, id);
    if (found) return found;
  }
  return null;
}

/** Remove a component from the tree, returns new tree */
function removeFromTree(nodes: UIComponent[], id: string): UIComponent[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => ({ ...n, children: removeFromTree(n.children, id) }));
}

/** Insert a component into a parent's children at index */
function insertIntoParent(
  nodes: UIComponent[],
  parentId: string,
  component: UIComponent,
  index: number
): UIComponent[] {
  return nodes.map((n) => {
    if (n.id === parentId) {
      const children = [...n.children];
      children.splice(index, 0, component);
      return { ...n, children };
    }
    return { ...n, children: insertIntoParent(n.children, parentId, component, index) };
  });
}

/** Snapshot current state for undo history */
function snapshot(
  past: UIComponent[][],
  current: UIComponent[]
): UIComponent[][] {
  const next = [...past, clone(current)];
  if (next.length > 50) next.shift(); // limit history to 50 steps
  return next;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBuilderStore = create<BuilderStore>()(
  persist(
  immer((set, get) => ({
    components: [],
    selectedId: null,
    past: [],
    future: [],
    previewMode: false,

    // ── Selection ──────────────────────────────────────────────────────────
    selectComponent: (id) =>
      set((s) => {
        s.selectedId = id;
      }),

    getSelectedComponent: () => {
      const { components, selectedId } = get();
      if (!selectedId) return null;
      return findComponent(components, selectedId);
    },

    // ── Add ────────────────────────────────────────────────────────────────
    addComponent: (type, parentId = null, index) => {
      const id = uuidv4();
      const component: UIComponent = {
        id,
        type,
        props: getDefaultProps(type),
        children: [],
      };

      set((s) => {
        s.past = snapshot(s.past, s.components);
        s.future = [];

        if (!parentId) {
          const insertAt = index ?? s.components.length;
          s.components.splice(insertAt, 0, component);
        } else {
          const parent = findComponent(s.components, parentId);
          if (parent) {
            const insertAt = index ?? parent.children.length;
            parent.children.splice(insertAt, 0, component);
          }
        }
        s.selectedId = id;
      });

      return id;
    },

    // ── Remove ─────────────────────────────────────────────────────────────
    removeComponent: (id) =>
      set((s) => {
        s.past = snapshot(s.past, s.components);
        s.future = [];
        s.components = removeFromTree(s.components, id) as typeof s.components;
        if (s.selectedId === id) s.selectedId = null;
      }),

    // ── Update Props ───────────────────────────────────────────────────────
    updateProps: (id, props) =>
      set((s) => {
        s.past = snapshot(s.past, s.components);
        s.future = [];
        const node = findComponent(s.components, id);
        if (node) {
          Object.assign(node.props, props);
        }
      }),

    // ── Move (drag from canvas to canvas) ──────────────────────────────────
    moveComponent: (activeId, overId, parentId = null) =>
      set((s) => {
        if (activeId === overId) return;
        s.past = snapshot(s.past, s.components);
        s.future = [];

        const active = findComponent(s.components, activeId);
        if (!active) return;

        const cloned = clone(active);
        s.components = removeFromTree(s.components, activeId) as typeof s.components;

        if (!parentId && !overId) {
          // Drop at root level end
          s.components.push(cloned);
          return;
        }

        if (parentId) {
          const parent = findComponent(s.components, parentId);
          if (parent) {
            if (overId) {
              const idx = parent.children.findIndex((c) => c.id === overId);
              parent.children.splice(idx >= 0 ? idx : parent.children.length, 0, cloned);
            } else {
              parent.children.push(cloned);
            }
          }
          return;
        }

        // Reorder at root level
        if (overId) {
          const idx = s.components.findIndex((c) => c.id === overId);
          s.components.splice(idx >= 0 ? idx : s.components.length, 0, cloned);
        }
      }),

    // ── JSON Import ────────────────────────────────────────────────────────
    setComponents: (components) =>
      set((s) => {
        s.past = snapshot(s.past, s.components);
        s.future = [];
        s.components = components as typeof s.components;
        s.selectedId = null;
      }),

    // ── Undo ───────────────────────────────────────────────────────────────
    undo: () =>
      set((s) => {
        if (s.past.length === 0) return;
        const previous = s.past[s.past.length - 1];
        s.future = [clone(s.components), ...s.future];
        s.past = s.past.slice(0, -1);
        s.components = previous as typeof s.components;
        s.selectedId = null;
      }),

    redo: () =>
      set((s) => {
        if (s.future.length === 0) return;
        const next = s.future[0];
        s.past = snapshot(s.past, s.components);
        s.future = s.future.slice(1);
        s.components = next as typeof s.components;
        s.selectedId = null;
      }),

    canUndo: () => get().past.length > 0,
    canRedo: () => get().future.length > 0,

    // ── Preview ────────────────────────────────────────────────────────────
    togglePreview: () =>
      set((s) => {
        s.previewMode = !s.previewMode;
      }),
  })),
  {
    name: 'ui-builder-state',
    storage: createJSONStorage(() =>
      typeof window !== 'undefined' ? localStorage : (undefined as never)
    ),
    // Only persist the component tree — skip history and UI-only state
    partialize: (s) => ({ components: s.components }),
  }
  )
);
