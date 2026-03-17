import { NextRequest, NextResponse } from 'next/server';
import type { CanonicalType } from '@/types/canonical';
import type { ComponentType } from '@/types';
import type { AIMappingSuggestion } from '@/services/aiService';

// ─── Mock Mapping Suggestions ─────────────────────────────────────────────────
// These simulate what a real LLM would return.
// Replace the mock block with an actual API call when NEXT_PUBLIC_AI_API_KEY is set.

const MOCK_SUGGESTIONS: AIMappingSuggestion[] = [
  {
    sourceType: 'Checkbox',
    suggestedCanonicalType: 'Checkbox',
    suggestedTargetType: 'TextInput',
    confidence: 0.91,
    reason: 'Checkbox maps to a boolean TextInput with type="checkbox" in the target system.',
  },
  {
    sourceType: 'RadioButtons',
    suggestedCanonicalType: 'RadioGroup',
    suggestedTargetType: 'Dropdown',
    confidence: 0.87,
    reason: 'Radio button groups are best rendered as a Dropdown for compact layout.',
  },
  {
    sourceType: 'DateTime',
    suggestedCanonicalType: 'DatePicker',
    suggestedTargetType: 'TextInput',
    confidence: 0.82,
    reason: 'Date fields map to TextInput with type="date" until a dedicated DatePicker component is available.',
  },
  {
    sourceType: 'TextArea',
    suggestedCanonicalType: 'TextArea',
    suggestedTargetType: 'TextInput',
    confidence: 0.95,
    reason: 'TextArea maps to TextInput; set multiline=true when the target supports it.',
  },
  {
    sourceType: 'RichText',
    suggestedCanonicalType: 'Label',
    suggestedTargetType: 'Text',
    confidence: 0.74,
    reason: 'Rich text content is flattened to a Text component (formatting is lost).',
  },
];

function collectUnknownTypes(pegaJson: unknown, found = new Set<string>()): Set<string> {
  if (typeof pegaJson !== 'object' || pegaJson === null) return found;
  const obj = pegaJson as Record<string, unknown>;
  if (typeof obj.type === 'string') found.add(obj.type);
  if (Array.isArray(obj.children)) {
    for (const child of obj.children) collectUnknownTypes(child, found);
  }
  return found;
}

export async function POST(req: NextRequest) {
  try {
    const { pegaJson } = await req.json();

    // ── Real AI integration point ─────────────────────────────────────────────
    // const apiKey = process.env.NEXT_PUBLIC_AI_API_KEY;
    // if (apiKey) {
    //   const types = [...collectUnknownTypes(pegaJson)];
    //   const response = await fetch('https://api.openai.com/v1/chat/completions', {
    //     method: 'POST',
    //     headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    //     body: JSON.stringify({
    //       model: 'gpt-4o',
    //       messages: [{
    //         role: 'user',
    //         content: `You are a UI schema expert. For each Pega component type below, suggest the best
    //         canonical type and target component type from our design system.
    //         Types: ${types.join(', ')}
    //         Return a JSON array of { sourceType, suggestedCanonicalType, suggestedTargetType, confidence, reason }.`,
    //       }],
    //     }),
    //   });
    //   const data = await response.json();
    //   const suggestions = JSON.parse(data.choices[0].message.content);
    //   return NextResponse.json({ suggestions, mock: false });
    // }
    // ─────────────────────────────────────────────────────────────────────────

    const foundTypes = [...collectUnknownTypes(pegaJson)];
    const suggestions = MOCK_SUGGESTIONS.filter((s) =>
      foundTypes.includes(s.sourceType)
    );

    // Add generic suggestions for any type we found but have no suggestion for
    for (const t of foundTypes) {
      if (!suggestions.find((s) => s.sourceType === t)) {
        suggestions.push({
          sourceType: t,
          suggestedCanonicalType: 'Unknown' as CanonicalType,
          suggestedTargetType: 'Text' as ComponentType,
          confidence: 0.5,
          reason: `No specific mapping for "${t}" — falling back to Text component.`,
        });
      }
    }

    await new Promise((r) => setTimeout(r, 700)); // simulate latency

    return NextResponse.json({ suggestions, mock: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
