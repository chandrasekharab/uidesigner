# Usage Guide

A step-by-step walkthrough of every feature in the Low-Code UI Builder.

---

## 1. Building a UI

### Adding Components

1. Locate the **Component Palette** on the left panel.
2. Click and **drag** any component card onto the canvas.
3. Release over the canvas drop zone — the component appears immediately.

Available components:

| Component | Icon | Purpose |
|---|---|---|
| **Container** | Layout | Wraps other components in a row or column |
| **Text Input** | TextCursorInput | Single-line or typed input field |
| **Button** | MousePointerClick | Clickable action button |
| **Dropdown** | ChevronsUpDown | Select menu with options |
| **Text / Label** | Type | Static text: headings, labels, captions |

---

### Nesting Components

Containers can hold other components:

1. Add a **Container** to the canvas.
2. Drag another component (e.g. TextInput) and drop it **on top of** the Container.
3. The component becomes a child of that Container.
4. Containers can be nested inside other Containers for complex layouts.

---

### Reordering Components

Each canvas item has a **grip handle** (⠿) on its left edge:

1. Hover over a component to reveal the grip.
2. Click and drag by the grip to reorder it among siblings.

---

### Selecting a Component

Click any component on the canvas to select it. The selected component:
- Shows a blue border + ring
- Displays its type badge above it
- Opens the **Property Editor** in the right panel

Click the canvas background to deselect.

---

## 2. Editing Properties

When a component is selected, the **Property Editor** (far right panel) shows its editable fields.

### Container Properties

| Field | Description |
|---|---|
| Label | Internal label (build-time only) |
| Layout | `vertical` (column) or `horizontal` (row) |
| Gap | Spacing between children in px |
| Padding | Inner padding in px |
| Border Radius | Corner rounding in px |
| Border Color | Color picker for the dashed border |
| Background Color | Fill color of the container |

### Text Input Properties

| Field | Description |
|---|---|
| Label | Field label displayed above the input |
| Placeholder | Ghost text inside the input |
| Input Type | `text`, `email`, `password`, `number` |
| Helper Text | Small text shown below the input |
| Required | Marks field as required (adds red asterisk) |
| Disabled | Renders field as non-editable |

### Button Properties

| Field | Description |
|---|---|
| Label | Button text |
| Variant | `primary`, `secondary`, `danger`, `ghost` |
| Size | `sm`, `md`, `lg` |
| Full Width | Stretches button to fill its container |
| Disabled | Renders button as non-clickable |

### Dropdown Properties

| Field | Description |
|---|---|
| Label | Field label |
| Placeholder | Default "choose" text |
| Options | `label:value` pairs, one per line |
| Required / Disabled | Same as TextInput |

### Text / Label Properties

| Field | Description |
|---|---|
| Content | The text to display |
| Variant | `h1`, `h2`, `h3`, `body`, `caption`, `label` |
| Alignment | `left`, `center`, `right` |
| Color | Text color picker |
| Bold / Italic | Style toggles |

> All property changes are applied **instantly** — both the canvas and the JSON panel update in real time.

---

### Deleting a Component

With a component selected, click the 🗑 **trash icon** in the Property Editor header.

---

## 3. Working with JSON

### Live JSON Panel

The right-most panel shows the current component tree as formatted JSON. It updates with every change on the canvas.

### Editing JSON Directly

The JSON panel is a full CodeMirror editor:
- Edit the JSON directly to modify the UI.
- The canvas re-renders on every valid keystroke.
- An **Invalid** badge and red error message appear for syntax or schema errors.

### Copy JSON

Click the **Copy** icon (clipboard) to copy the full JSON to your clipboard.

### Export JSON

Click the **Download** icon to save the current schema as `ui-schema.json`.

### Import JSON

Click the **Upload** icon to open a file picker. Select any `.json` file that matches the component schema — the canvas will reload with the imported components.

---

## 4. Toolbar Actions

| Button | Keyboard | Action |
|---|---|---|
| **Undo** | — | Step back one change (up to 50 steps) |
| **Redo** | — | Step forward one change |
| **Save** | — | POST current tree to `/api/ui` |
| **Load** | — | GET last saved tree from `/api/ui` |
| **Clear** | — | Remove all components (with confirmation) |
| **Preview** | — | Toggle preview mode |
| **AI Generate** | — | Open the AI prompt popover |

---

## 5. Preview Mode

Click **Preview** in the toolbar to enter read-only render mode:
- All editor chrome is hidden (palette, property editor, grip handles, type badges).
- Components render as they would in production.
- A blue banner at the top of the canvas reminds you you're in preview.

Click **Edit Mode** to return to the builder.

---

## 6. AI UI Generation

Click **AI Generate** in the toolbar to open the prompt popover.

1. Type a description, e.g. `login form` or `contact form`.
2. Press **Enter** or click **Go**.
3. The canvas reloads with a generated component tree.

> The label **Mock** indicates no AI key is configured — the response comes from a built-in template. See [README.md](README.md#ai-integration) to connect a real LLM.

**Built-in templates:**
- `login form` → Sign-in form with email, password, and submit button
- `contact form` → Contact form with name, email, topic dropdown
- (anything else) → Generic placeholder with a text and button

---

## 7. Save & Load

The builder includes a lightweight persistence layer backed by Next.js API routes.

- **Save** — Sends the current tree to `POST /api/ui`. The latest save is kept in memory on the server.
- **Load** — Fetches from `GET /api/ui` and restores the tree on the canvas.

> **Note:** The in-memory store resets on server restart. For production persistence, replace the store in `app/api/ui/route.ts` with a database (Supabase, PlanetScale, Redis, etc.).

---

## 8. Keyboard & UX Tips

- **Click canvas background** to deselect the active component.
- **Drag distance threshold** is 5 px — a small intentional move avoids accidental drags on click.
- **Type badge** (`Container`, `TextInput`, etc.) appears on hover above each component in edit mode.
- **Empty container placeholder** shows a grey dashed box with "Drop components here" so you always have a target.
