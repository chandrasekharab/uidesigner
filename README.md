# Low-Code UI Builder

A production-ready, low-code UI builder platform built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, **dnd-kit**, and **Zustand**. Design UI screens by dragging and dropping components, edit their properties live, and get a real-time JSON representation inspired by the **Pega Constellation View JSON** schema.

Deploy to **Vercel** in one click — zero configuration required.

---

## Screenshots

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Toolbar  [Undo] [Redo] [Save] [Load] [Clear] [Preview]       [AI Generate] │
├────────────┬──────────────────────────────────┬──────────┬────────────────── │
│  Palette   │           Canvas                 │ Props    │  JSON Panel       │
│            │                                  │ Editor   │                   │
│ Container  │  ┌──────────────────────────┐    │          │  [{               │
│ TextInput  │  │ Container (dashed)       │    │ Label    │    "type":        │
│ Button     │  │  - TextInput             │    │ Layout   │    "Container",   │
│ Dropdown   │  │  - Button                │    │ Gap      │    "children":[]  │
│ Text       │  └──────────────────────────┘    │ ...      │  }]               │
└────────────┴──────────────────────────────────┴──────────┴───────────────────┘
```

---

## Features

| Feature | Detail |
|---|---|
| **Drag & Drop** | Drag from palette onto canvas; reorder with grip handle |
| **5 Components** | Container, TextInput, Button, Dropdown, Text/Label |
| **Nesting** | Drop components inside a Container to nest them |
| **Property Editor** | Click any component → edit props in real time |
| **Live JSON** | Canvas changes reflect instantly in the JSON panel |
| **Two-way Sync** | Edit JSON directly → canvas updates |
| **Export / Import** | Download JSON file or upload one to restore a UI |
| **Undo / Redo** | 50-step history via Zustand + Immer |
| **Preview Mode** | Toggle a clean render with no editor chrome |
| **Save / Load** | Persist UI to in-memory API route; swap for a DB |
| **AI Generate** | Prompt-based UI generation (mock + OpenAI stub) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 3 |
| Drag & Drop | dnd-kit (core + sortable) |
| State | Zustand 4 + Immer |
| JSON Editor | CodeMirror 6 (via @uiw/react-codemirror) |
| Icons | Lucide React |
| Deployment | Vercel (serverless) |

---

## Quick Start

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### Install & Run

```bash
# Clone the repo
git clone https://github.com/YOUR_USER/low-code-ui-builder.git
cd low-code-ui-builder

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local

# Start dev server
npm run dev
```

Open **http://localhost:3010** in your browser.

### Available Scripts

```bash
npm run dev        # Start dev server on port 3010
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint
npm run type-check # TypeScript type-check only
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_AI_API_KEY` | No | OpenAI (or other) API key for real AI generation |
| `NEXT_PUBLIC_APP_URL` | No | App base URL (defaults to `http://localhost:3010`) |

Create a `.env.local` file (never commit it):

```env
NEXT_PUBLIC_AI_API_KEY=sk-...
NEXT_PUBLIC_APP_URL=http://localhost:3010
```

---

## Deploy to Vercel

### Step 1 — Push to GitHub

```bash
git init
git add .
git commit -m "init: low-code ui builder"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

### Step 2 — Import on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** next to your GitHub repo
3. Framework preset: **Next.js** (auto-detected)
4. Click **Deploy**

No build configuration needed — Vercel reads `package.json` automatically.

### Step 3 — Add Environment Variables (optional)

For real AI generation:

1. Vercel Dashboard → Project → **Settings** → **Environment Variables**
2. Add `NEXT_PUBLIC_AI_API_KEY` = your API key
3. **Redeploy**

### Live URL

```
https://your-repo-name.vercel.app
```

---

## Project Structure

```
.
├── app/
│   ├── api/
│   │   ├── ui/route.ts             # GET + POST /api/ui  (save/load)
│   │   └── ai/generate/route.ts    # POST /api/ai/generate
│   ├── globals.css                 # Tailwind base + custom scrollbar
│   ├── layout.tsx                  # HTML shell + metadata
│   └── page.tsx                    # Root page (Toolbar + BuilderLayout)
│
├── components/
│   ├── BuilderLayout.tsx           # DndContext owner; three-panel layout
│   ├── Canvas.tsx                  # Droppable + sortable canvas
│   ├── CodeMirrorEditor.tsx        # Lazy-loaded JSON code editor
│   ├── ComponentRenderer.tsx       # Renders any UIComponent node
│   ├── JSONPanel.tsx               # Right panel: live editor + export
│   ├── Palette.tsx                 # Left panel: draggable component cards
│   ├── PropertyEditor.tsx          # Right panel: per-type property forms
│   └── Toolbar.tsx                 # Top bar: history, save, preview, AI
│
├── services/
│   ├── aiService.ts                # generateUIFromPrompt, validateJSON
│   └── uiService.ts                # saveUI, loadUI (calls API routes)
│
├── store/
│   └── builderStore.ts             # Zustand store – single source of truth
│
├── types/
│   └── index.ts                    # All TypeScript interfaces & types
│
└── utils/
    ├── cn.ts                       # clsx + tailwind-merge helper
    ├── componentDefaults.ts        # Default props + palette definition
    └── jsonEngine.ts               # Serialize / deserialize component tree
```

---

## Component Schema

Every UI component in the builder follows this schema:

```typescript
interface UIComponent {
  id: string;         // UUID
  type: ComponentType; // 'Container' | 'TextInput' | 'Button' | 'Dropdown' | 'Text'
  props: ComponentProps; // type-specific props object
  children: UIComponent[]; // nested components (Containers only)
}
```

### Example JSON output

```json
[
  {
    "id": "c1a2b3",
    "type": "Container",
    "props": {
      "layout": "vertical",
      "gap": 16,
      "padding": 24,
      "borderRadius": 8,
      "borderWidth": 1,
      "borderColor": "#e2e8f0",
      "backgroundColor": "#ffffff",
      "label": "Login Form"
    },
    "children": [
      {
        "id": "d4e5f6",
        "type": "Text",
        "props": {
          "content": "Sign In",
          "variant": "h2",
          "color": "#1e293b",
          "align": "center",
          "bold": true,
          "italic": false
        },
        "children": []
      },
      {
        "id": "g7h8i9",
        "type": "TextInput",
        "props": {
          "label": "Email",
          "placeholder": "you@example.com",
          "type": "email",
          "required": true,
          "disabled": false,
          "helperText": "",
          "value": ""
        },
        "children": []
      },
      {
        "id": "j0k1l2",
        "type": "Button",
        "props": {
          "label": "Sign In",
          "variant": "primary",
          "size": "md",
          "disabled": false,
          "fullWidth": true
        },
        "children": []
      }
    ]
  }
]
```

---

## API Reference

### `GET /api/ui`

Returns the last saved UI.

**Response**
```json
{
  "id": "default",
  "name": "Untitled UI",
  "components": [...],
  "savedAt": "2026-03-17T10:00:00.000Z"
}
```

---

### `POST /api/ui`

Saves a component tree.

**Request body**
```json
{
  "name": "My Form",
  "components": [...]
}
```

**Response**
```json
{
  "success": true,
  "id": "default",
  "savedAt": "2026-03-17T10:01:00.000Z"
}
```

---

### `POST /api/ai/generate`

Generates a component tree from a natural-language prompt.

**Request body**
```json
{ "prompt": "login form" }
```

**Response**
```json
{
  "components": [...],
  "mock": true
}
```

> `mock: true` indicates the response came from a template, not a real AI model. Set `NEXT_PUBLIC_AI_API_KEY` and uncomment the OpenAI integration in `app/api/ai/generate/route.ts` for real generation.

---

## AI Integration

The AI layer is fully stubbed and ready to connect to any LLM provider.

### Enable OpenAI

1. Open [`app/api/ai/generate/route.ts`](app/api/ai/generate/route.ts)
2. Uncomment the block marked `── Real AI integration point ──`
3. Add your key to `.env.local`:
   ```env
   NEXT_PUBLIC_AI_API_KEY=sk-...
   ```

The mock templates (`login form`, `contact form`) remain as fallbacks when no key is set.

### Client-side service

```typescript
import { generateUIFromPrompt, validateJSON } from '@/services/aiService';

// Generate a UI from a prompt
const { components } = await generateUIFromPrompt('registration form');

// Validate a schema
const { valid, errors } = await validateJSON(mySchema);
```
