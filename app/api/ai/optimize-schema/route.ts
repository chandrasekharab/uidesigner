import { NextResponse } from 'next/server';
import type { UIComponent } from '@/types';

/**
 * POST /api/ai/optimize-schema
 *
 * Accepts a UIComponent[] and returns an optimized version along with
 * a changelog. In production, forward to an LLM endpoint.
 * Currently returns a deterministic mock.
 */
export async function POST(req: Request) {
  try {
    const { schema } = (await req.json()) as { schema: UIComponent[] };

    if (!Array.isArray(schema)) {
      return NextResponse.json({ error: 'schema must be an array' }, { status: 400 });
    }

    const changes: string[] = [];

    function optimizeNode(node: UIComponent): UIComponent {
      const optimized = { ...node, props: { ...node.props } };
      const p = optimized.props as Record<string, unknown>;

      // Ensure buttons have non-empty labels
      if (node.type === 'Button' && (!p.label || p.label === '')) {
        (optimized.props as Record<string, unknown>).label = 'Submit';
        changes.push(`[${node.id}] Button: set default label to "Submit"`);
      }

      // Add aria placeholder hints to text inputs that lack placeholder
      if (node.type === 'TextInput' && !p.placeholder) {
        (optimized.props as Record<string, unknown>).placeholder = `Enter ${p.label ?? 'value'}…`;
        changes.push(`[${node.id}] TextInput: added placeholder`);
      }

      // Ensure containers have sensible gap
      if (node.type === 'Container') {
        if (typeof p.gap !== 'number' || (p.gap as number) < 8) {
          (optimized.props as Record<string, unknown>).gap = 16;
          changes.push(`[${node.id}] Container: set gap to 16px`);
        }
      }

      optimized.children = (node.children ?? []).map(optimizeNode);
      return optimized;
    }

    const optimized = schema.map(optimizeNode);

    if (changes.length === 0) {
      changes.push('Schema is already well-optimized for A2UI rendering.');
    }

    return NextResponse.json({ optimized, changes, mock: true });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message ?? 'Optimization failed' },
      { status: 500 }
    );
  }
}
