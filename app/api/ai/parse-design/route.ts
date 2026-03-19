import { NextRequest, NextResponse } from 'next/server';
import { MOCK_DETECTION_SCENARIOS } from '@/data/mockDesignSamples';
import type { ParsedDesign, DetectedComponent } from '@/services/designParser';

// ─── Route: POST /api/ai/parse-design ────────────────────────────────────────
// Accepts a multipart/form-data request containing an "image" file.
// When NEXT_PUBLIC_AI_API_KEY (or AI_API_KEY) is set, this route would proxy
// to a real vision API (e.g. OpenAI GPT-4o, Google Vision).
// Otherwise it returns a credible mock response.

export const runtime = 'nodejs'; // needed for FormData / Buffer handling

export async function POST(req: NextRequest) {
  try {
    const hasAI = Boolean(
      process.env.AI_API_KEY || process.env.NEXT_PUBLIC_AI_API_KEY
    );

    if (hasAI) {
      return await callRealVisionAPI(req);
    }

    return mockParseResponse(req);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── Mock Path ────────────────────────────────────────────────────────────────

async function mockParseResponse(req: NextRequest): Promise<NextResponse> {
  // Read filename hint from form data to pick best scenario
  let scenario: keyof typeof MOCK_DETECTION_SCENARIOS = 'form';

  try {
    const form = await req.formData();
    const file = form.get('image');
    if (file && typeof (file as File).name === 'string') {
      const name = (file as File).name.toLowerCase();
      if (name.includes('login') || name.includes('signin')) scenario = 'login';
      else if (name.includes('dash')) scenario = 'dashboard';
      else if (name.includes('register') || name.includes('signup')) scenario = 'registration';
    }
  } catch {
    // FormData parsing can fail in edge cases — fall back to 'form'
  }

  const s = MOCK_DETECTION_SCENARIOS[scenario];
  let counter = 0;

  const components: DetectedComponent[] = s.components.map((c) => ({
    ...c,
    id: `api-det-${++counter}-${Date.now()}`,
    children: [],
    attributes: c.attributes ?? {},
  }));

  const result: ParsedDesign = {
    parseId: `api-${Date.now()}`,
    screenType: s.screenType,
    title: s.title,
    components,
    layout: [],
    ocrLines: [...s.ocrLines],
    mock: true,
  };

  return NextResponse.json(result);
}

// ─── Real AI Path (stub — wire up your provider here) ─────────────────────────

async function callRealVisionAPI(req: NextRequest): Promise<NextResponse> {
  // ------------------------------------------------------------------
  // 1. Read the image from the multipart form
  // ------------------------------------------------------------------
  const form = await req.formData();
  const file = form.get('image') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');
  const mimeType = file.type || 'image/png';

  // ------------------------------------------------------------------
  // 2. Build a structured prompt for the vision model
  // ------------------------------------------------------------------
  const systemPrompt = `You are a UI component detection AI. Analyse the provided UI screenshot and return a JSON object matching this TypeScript interface:

interface ParsedDesign {
  parseId: string;
  screenType: "form" | "dashboard" | "list" | "detail" | "modal" | "unknown";
  title: string;
  components: DetectedComponent[];
  layout: LayoutSection[];
  ocrLines: string[];
  mock: false;
}

For DetectedComponent, use types: input | password | button | dropdown | checkbox | radio | label | heading | text | image | container | section | card | table | link | unknown.
BoundingBox coordinates must be normalised 0-1 relative to image dimensions.
Return ONLY the JSON object, no additional text.`;

  const apiKey = process.env.AI_API_KEY || process.env.NEXT_PUBLIC_AI_API_KEY;

  // ------------------------------------------------------------------
  // 3. Call OpenAI GPT-4o (adapt for your chosen provider)
  // ------------------------------------------------------------------
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64}`, detail: 'high' },
            },
            { type: 'text', text: 'Detect all UI components in this screenshot and return the ParsedDesign JSON.' },
          ],
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!openaiRes.ok) {
    const err = await openaiRes.json().catch(() => ({}));
    throw new Error(`Vision API error: ${openaiRes.status} — ${JSON.stringify(err)}`);
  }

  const openaiData = await openaiRes.json();
  const content = openaiData.choices?.[0]?.message?.content ?? '{}';

  const parsed: ParsedDesign = JSON.parse(content);
  return NextResponse.json(parsed);
}
