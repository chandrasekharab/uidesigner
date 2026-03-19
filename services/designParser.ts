// ─── Design Parser Service ────────────────────────────────────────────────────
// Converts design inputs (image screenshots or Figma JSON) into structured
// component detection results that feed into the Pega metadata generator.
//
// Currently ships with a full mock implementation.
// Swap individual functions for real AI/vision calls by:
//   1. Setting NEXT_PUBLIC_AI_API_KEY in your environment.
//   2. Replacing the mock bodies with calls to /api/ai/parse-design.

import { MOCK_DETECTION_SCENARIOS } from '@/data/mockDesignSamples';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DetectedComponentType =
  | 'input'
  | 'password'
  | 'button'
  | 'dropdown'
  | 'checkbox'
  | 'radio'
  | 'label'
  | 'heading'
  | 'text'
  | 'image'
  | 'container'
  | 'section'
  | 'card'
  | 'table'
  | 'link'
  | 'unknown';

export interface BoundingBox {
  /** Normalised coordinates (0–1) relative to the image dimensions */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DetectedComponent {
  id: string;
  type: DetectedComponentType;
  /** Raw label extracted from OCR or inferred from context */
  label: string;
  /** Placeholder text found inside the component, if any */
  placeholder?: string;
  /** Confidence score for the detection (0–1) */
  confidence: number;
  boundingBox: BoundingBox;
  /** Detected children for container-like components */
  children: DetectedComponent[];
  /** Extra arbitrary attributes (e.g. required, disabled hints) */
  attributes: Record<string, unknown>;
}

export interface LayoutSection {
  id: string;
  label: string;
  /** Row-based grouping index within the detected layout grid */
  row: number;
  column: number;
  componentIds: string[];
}

export interface ParsedDesign {
  /** Unique parse run identifier */
  parseId: string;
  /** Detected overall form/screen type */
  screenType: 'form' | 'dashboard' | 'list' | 'detail' | 'modal' | 'unknown';
  /** Extracted page/form title */
  title: string;
  /** Flat list of all detected components */
  components: DetectedComponent[];
  /** Higher-level layout sections grouping the components */
  layout: LayoutSection[];
  /** Raw OCR text, line-by-line */
  ocrLines: string[];
  /** True when this result came from a mock rather than real AI */
  mock: boolean;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

let _counter = 0;
function uid(prefix = 'det') {
  return `${prefix}-${Date.now()}-${++_counter}`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Core API ─────────────────────────────────────────────────────────────────

/**
 * Primary entry point. Accepts a File (PNG/JPG) or a Figma JSON object.
 * Returns a fully parsed design with detected components and layout.
 */
export async function parseDesignInput(
  input: File | FigmaDesignInput
): Promise<ParsedDesign> {
  if (input instanceof File) {
    return parseImageToComponents(input);
  }
  return parseFigmaToComponents(input);
}

/**
 * Parse a raster image (screenshot) into a structured component tree.
 * When NEXT_PUBLIC_AI_API_KEY is set the real /api/ai/parse-design endpoint is
 * called; otherwise a deterministic mock result is returned.
 */
export async function parseImageToComponents(file: File): Promise<ParsedDesign> {
  const hasAI = Boolean(
    typeof window !== 'undefined' && process.env.NEXT_PUBLIC_AI_API_KEY
  );

  if (hasAI) {
    return callParseDesignAPI(file);
  }

  // Mock path: choose scenario based on filename hint
  return mockDetectFromImage(file);
}

/**
 * Extract an approximate grid-based layout from an already-parsed design.
 * Groups flat components into rows/columns via their bounding boxes.
 */
export function extractLayoutStructure(design: ParsedDesign): LayoutSection[] {
  const ROW_THRESHOLD = 0.06; // 6% of image height = same row
  const sorted = [...design.components].sort(
    (a, b) => a.boundingBox.y - b.boundingBox.y
  );

  const rows: DetectedComponent[][] = [];
  for (const comp of sorted) {
    const lastRow = rows[rows.length - 1];
    if (
      lastRow &&
      Math.abs(comp.boundingBox.y - lastRow[0].boundingBox.y) < ROW_THRESHOLD
    ) {
      lastRow.push(comp);
    } else {
      rows.push([comp]);
    }
  }

  return rows.map((row, rowIdx) =>
    row.map((comp, colIdx) => ({
      id: uid('section'),
      label: comp.label || `Section ${rowIdx + 1}`,
      row: rowIdx,
      column: colIdx,
      componentIds: [comp.id],
    }))
  ).flat();
}

/**
 * Focused component-type classifier — runs on a set of already-detected blobs.
 * This is where a real CV model call would be substituted.
 */
export function detectUIComponents(
  image: File
): Promise<DetectedComponent[]> {
  void image; // image param kept for API compatibility with real implementation
  return Promise.resolve(buildMockComponents('form'));
}

/**
 * OCR text extraction stub. Returns line-by-line text from the design.
 * Replace with a real OCR library (e.g. Tesseract.js) or a Vision API call.
 */
export async function extractTextUsingOCR(image: File): Promise<string[]> {
  await delay(200);
  void image;
  return [
    'Sign In',
    'Email Address',
    'Password',
    'Forgot Password?',
    'Login',
    'Don\'t have an account? Sign Up',
  ];
}

// ─── Figma ────────────────────────────────────────────────────────────────────

export interface FigmaDesignInput {
  /** Figma file URL, e.g. https://www.figma.com/file/XXX/Name */
  fileUrl?: string;
  /** Figma node JSON export (from Figma REST API or Figma plugin) */
  nodeJson?: FigmaNode;
}

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  characters?: string;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
}

export async function parseFigmaToComponents(
  input: FigmaDesignInput
): Promise<ParsedDesign> {
  await delay(400);

  if (input.nodeJson) {
    return parseFigmaNode(input.nodeJson);
  }

  // URL-only path: would need a Figma Access Token to fetch. Return mock.
  return buildMockScenario('form', 'Figma Design');
}

function parseFigmaNode(root: FigmaNode): ParsedDesign {
  const components: DetectedComponent[] = [];

  function traverse(node: FigmaNode, depth = 0) {
    const type = mapFigmaTypeToDetected(node.type, node.name);
    const bbox = node.absoluteBoundingBox;
    components.push({
      id: uid('figma'),
      type,
      label: node.characters ?? node.name ?? '',
      confidence: 0.85,
      boundingBox: bbox
        ? {
            x: bbox.x / 1440,
            y: bbox.y / 900,
            width: bbox.width / 1440,
            height: bbox.height / 900,
          }
        : { x: 0, y: depth * 0.08, width: 0.8, height: 0.06 },
      children: [],
      attributes: { figmaType: node.type },
    });
    node.children?.forEach((child) => traverse(child, depth + 1));
  }

  traverse(root);

  return {
    parseId: uid('parse'),
    screenType: 'form',
    title: root.name,
    components,
    layout: [],
    ocrLines: components.map((c) => c.label).filter(Boolean),
    mock: false,
  };
}

function mapFigmaTypeToDetected(figmaType: string, name: string): DetectedComponentType {
  const t = figmaType.toUpperCase();
  const n = name.toLowerCase();
  if (t === 'TEXT') {
    if (n.includes('button') || n.includes('btn')) return 'button';
    if (n.includes('label') || n.includes('title')) return 'label';
    return 'text';
  }
  if (t === 'FRAME' || t === 'GROUP') {
    if (n.includes('card')) return 'card';
    if (n.includes('section')) return 'section';
    return 'container';
  }
  if (t === 'INSTANCE') {
    if (n.includes('input') || n.includes('field')) return 'input';
    if (n.includes('dropdown') || n.includes('select')) return 'dropdown';
    if (n.includes('checkbox')) return 'checkbox';
    if (n.includes('button') || n.includes('btn')) return 'button';
  }
  return 'unknown';
}

// ─── Real AI API Call ─────────────────────────────────────────────────────────

async function callParseDesignAPI(file: File): Promise<ParsedDesign> {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch('/api/ai/parse-design', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? 'Design parse failed');
  }
  return res.json();
}

// ─── Mock Implementation ──────────────────────────────────────────────────────

async function mockDetectFromImage(file: File): Promise<ParsedDesign> {
  // Give the user a brief "thinking" delay for realism
  await delay(600 + Math.random() * 400);

  const name = file.name.toLowerCase();
  let scenario: keyof typeof MOCK_DETECTION_SCENARIOS = 'form';

  if (name.includes('login') || name.includes('signin') || name.includes('auth')) {
    scenario = 'login';
  } else if (name.includes('dash') || name.includes('overview')) {
    scenario = 'dashboard';
  } else if (name.includes('register') || name.includes('signup')) {
    scenario = 'registration';
  }

  return buildMockScenario(scenario, file.name);
}

function buildMockScenario(
  scenario: keyof typeof MOCK_DETECTION_SCENARIOS,
  sourceName: string
): ParsedDesign {
  const { components, screenType, title, ocrLines } =
    MOCK_DETECTION_SCENARIOS[scenario] ?? MOCK_DETECTION_SCENARIOS.form;

  const parsedComponents = components.map((c) => ({
    ...c,
    id: uid('det'),
  }));

  return {
    parseId: uid('parse'),
    screenType,
    title: title ?? sourceName,
    components: parsedComponents,
    layout: groupComponentsIntoSections(parsedComponents),
    ocrLines: [...ocrLines],
    mock: true,
  };
}

function buildMockComponents(
  scenario: keyof typeof MOCK_DETECTION_SCENARIOS
): DetectedComponent[] {
  return (MOCK_DETECTION_SCENARIOS[scenario]?.components ?? []).map((c) => ({
    ...c,
    id: uid('det'),
  }));
}

function groupComponentsIntoSections(
  components: DetectedComponent[]
): LayoutSection[] {
  // Simple row grouping by Y proximity
  const ROW_GAP = 0.08;
  const rows: DetectedComponent[][] = [];

  const sorted = [...components].sort((a, b) => a.boundingBox.y - b.boundingBox.y);
  for (const comp of sorted) {
    const lastRow = rows[rows.length - 1];
    if (
      lastRow &&
      Math.abs(comp.boundingBox.y - lastRow[0].boundingBox.y) < ROW_GAP
    ) {
      lastRow.push(comp);
    } else {
      rows.push([comp]);
    }
  }

  const sections: LayoutSection[] = [];
  rows.forEach((row, rIdx) => {
    // Each non-trivial row becomes a section
    if (row.length === 0) return;
    sections.push({
      id: uid('section'),
      label: row.find((c) => c.type === 'section' || c.type === 'container')?.label
        ?? `Row ${rIdx + 1}`,
      row: rIdx,
      column: 0,
      componentIds: row.map((c) => c.id),
    });
  });

  return sections;
}
