# Architecture

A deep-dive into the design decisions, data flow, and extension points of the Low-Code UI Builder.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Client)                            │
│                                                                     │
│  ┌──────────┐   drag   ┌──────────────────────────────────────────┐ │
│  │ Palette  │ ───────► │           DndContext (BuilderLayout)     │ │
│  └──────────┘          │                                          │ │
│                        │  ┌─────────────────────────────────────┐ │ │
│                        │  │             Canvas                  │ │ │
│                        │  │  useDroppable + useSortable hooks   │ │ │
│                        │  └─────────────────────────────────────┘ │ │
│                        └──────────────────────────────────────────┘ │
│                                      │ dispatch                      │
│                        ┌─────────────▼──────────────────────────┐   │
│                        │         Zustand Store                  │   │
│                        │  components[] · selectedId · history   │   │
│                        └───────────┬──────────────┬─────────────┘   │
│                                    │              │                  │
│               ┌────────────────────▼──┐    ┌──────▼─────────────┐   │
│               │   ComponentRenderer   │    │    JSON Panel      │   │
│               │  (live canvas render) │    │  (CodeMirror sync) │   │
│               └───────────────────────┘    └────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                               │ fetch
               ┌───────────────▼───────────────────────────────────┐
               │            Next.js API Routes (Serverless)        │
               │   /api/ui (GET + POST)   /api/ai/generate (POST)  │
               └───────────────────────────────────────────────────┘
```

---

## Data Model

### UIComponent — the atomic unit

```typescript
interface UIComponent {
  id: string;           // UUID (generated on add)
  type: ComponentType;  // discriminated union key
  props: ComponentProps; // type-specific props (see types/index.ts)
  children: UIComponent[]; // recursive — Containers nest children
}
```

The entire canvas state is `UIComponent[]` — a flat array of root nodes, each of which may contain a tree of children. There is no separate "layout tree" vs "data tree"; the tree itself encodes layout through Container nesting.

### ComponentProps — per-type props

Each component type has its own props interface (`ContainerProps`, `TextInputProps`, etc.) declared in `types/index.ts`. They are unified under the `ComponentProps` union type. Default values are provided by `utils/componentDefaults.ts`.

---

## State Management

All mutable state lives in a single **Zustand** store (`store/builderStore.ts`), augmented by **Immer** for structural sharing.

```
BuilderStore {
  components: UIComponent[]    ← the canvas tree
  selectedId: string | null    ← clicked component
  past: UIComponent[][]        ← undo stack (≤50)
  future: UIComponent[][]      ← redo stack
  previewMode: boolean
}
```

### Mutations

Every write operation follows the same pattern:

1. **Snapshot** — `past.push(clone(current))`, `future = []`
2. **Mutate** — Immer draft mutation (safe deep update without spread hell)
3. Zustand notifies all subscribers

### Tree traversal

All tree operations (`findComponent`, `removeFromTree`, `insertIntoParent`) are pure recursive functions defined at module scope in `builderStore.ts`. They do not mutate and are independently testable.

### Undo / Redo

```
undo():  future.unshift(current)  ←  current = past.pop()
redo():  past.push(current)       →  current = future.shift()
```

History is capped at 50 snapshots. Each snapshot is a deep JSON clone, so nested mutations are fully reversible.

---

## Drag and Drop Architecture

dnd-kit is used instead of react-dnd for its:
- Accessibility-first design (keyboard + pointer sensors)
- Headless architecture (no injected DOM)
- Fine-grained activation constraints (avoids click/drag conflicts)

### Context placement

`DndContext` lives at the **`BuilderLayout`** level — the parent of both `Palette` and `Canvas`. This is critical: all `useDraggable` (in Palette) and `useDroppable`/`useSortable` (in Canvas) hooks must share the same context instance.

```
BuilderLayout
  └── DndContext          ← single owner
        ├── Palette       ← useDraggable per card
        └── Canvas
              └── DroppableCanvas  ← useDroppable (canvas-root)
                    └── SortableItem[]  ← useSortable per component
```

### Drag data protocol

Every draggable carries a typed `DragData` payload:

```typescript
type DragData =
  | { source: 'palette'; type: ComponentType }   // new component from palette
  | { source: 'canvas'; id: string }             // existing component on canvas
```

`BuilderLayout.handleDragEnd` reads this to decide:
- **palette → canvas**: call `addComponent(type, optionalParentId)`
- **canvas → canvas**: call `moveComponent(activeId, overId)`

---

## JSON Engine

`utils/jsonEngine.ts` provides a clean serialization boundary:

| Function | Direction | Description |
|---|---|---|
| `treeToJSON(components)` | Tree → string | Serializes to pretty-printed JSON |
| `jsonToTree(string)` | string → Tree | Parses + validates schema |
| `serializeTree(components)` | Tree → object[] | Raw object form (used by API) |
| `deserializeTree(unknown)` | unknown → Tree | Type-safe recursive parser |

### Two-way sync in JSONPanel

```
Canvas changes
  → Zustand store update
    → JSONPanel reads `components` via selector
      → `treeToJSON()` → CodeMirror value

User types in CodeMirror
  → onChange fires
    → `jsonToTree()` (try/catch)
      → valid: `setComponents()` → Zustand → canvas re-renders
      → invalid: show error banner, do NOT update store
```

The `isEditing` flag prevents the panel from overwriting the user's cursor position while they type.

---

## Component Rendering

`ComponentRenderer` is a pure presentational component. It:

1. Receives a `UIComponent` node
2. Dispatches to a per-type render function based on `component.type`
3. Recursively renders `component.children` (for Containers)
4. In edit mode, wraps each node in a click handler that calls `onSelect(id)`

No store access — all data is passed as props. This makes it usable in both the builder and a hypothetical standalone preview renderer.

---

## API Routes

Both routes are **Next.js Route Handlers** (App Router) — they compile to Vercel Serverless Functions automatically.

### `/api/ui` — Persistence

```
GET  /api/ui  →  returns { id, name, components, savedAt }
POST /api/ui  →  accepts { name, components }, returns { success, id, savedAt }
```

Currently backed by an in-memory variable. To add real persistence, replace the `store` object with a database call:

```typescript
// Example: Supabase
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);

// In GET:
const { data } = await supabase.from('ui_schemas').select('*').eq('id', 'default').single();

// In POST:
await supabase.from('ui_schemas').upsert({ id: 'default', components, name, savedAt });
```

### `/api/ai/generate` — AI Generation

```
POST /api/ai/generate  →  accepts { prompt }, returns { components, mock }
```

The real integration block is commented out with clear markers. Swap in any LLM:

```typescript
// OpenAI example (already stubbed in route.ts):
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_AI_API_KEY}` },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: `Generate UI JSON for: ${prompt}` }],
  }),
});
```

---

## Service Layer

`services/` provides a clean boundary between the React components and external I/O.

```
components/Toolbar.tsx
  → services/uiService.ts   → fetch('/api/ui')
  → services/aiService.ts   → fetch('/api/ai/generate')
```

Components never call `fetch` directly. This makes it easy to:
- Swap the backend (mock → real DB) without touching components
- Add request caching, retries, or auth headers in one place
- Unit-test services independently

---

## Performance Design

| Technique | Where |
|---|---|
| `memo()` on all panel components | Palette, Canvas, JSONPanel, PropertyEditor, Toolbar |
| Zustand selectors (per-field) | Every `useBuilderStore(s => s.field)` call |
| `useCallback` on all event handlers | handleDragEnd, handleSelect, etc. |
| Dynamic import of CodeMirror | `JSONPanel` uses `next/dynamic` with `ssr: false` |
| Immer structural sharing | Unchanged subtrees reuse the same object references |
| JSON clone capped at 50 history entries | undo/redo stack never grows unboundedly |

Zustand's default shallow equality means only components that read a changed slice of state re-render — adding a component to the canvas does not re-render the Toolbar.

---

## Extending the Platform

### Adding a New Component Type

1. **Add the type** to `ComponentType` in `types/index.ts`
2. **Define props interface** in `types/index.ts`
3. **Add default props** in `utils/componentDefaults.ts` → `getDefaultProps()`
4. **Add palette entry** in `utils/componentDefaults.ts` → `PALETTE_ITEMS`
5. **Add renderer** in `components/ComponentRenderer.tsx`
6. **Add property form** in `components/PropertyEditor.tsx`

No changes needed to the store, JSON engine, or drag-and-drop layer.

### Adding Real Database Persistence

Replace the in-memory `store` object in `app/api/ui/route.ts` with any database client. The request/response contract is unchanged.

### Adding Authentication

Add a middleware file at `middleware.ts` using NextAuth or Clerk:

```typescript
export { auth as middleware } from './auth';
export const config = { matcher: ['/((?!api/public|_next).*)'] };
```

### Adding Real AI

Uncomment the OpenAI block in `app/api/ai/generate/route.ts` and provide the API key environment variable.

### Adding Multi-screen / Pages

Extend the Zustand store with a `pages: Record<string, UIComponent[]>` map and a `currentPage: string` selector. The rest of the UI composes unchanged.
