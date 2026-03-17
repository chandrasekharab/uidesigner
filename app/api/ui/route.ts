import { NextRequest, NextResponse } from 'next/server';
import type { UIComponent } from '@/types';

// In-memory store for serverless (resets on cold start).
// For production, replace with a database (Supabase, PlanetScale, etc.)
const store: { id: string; name: string; components: UIComponent[]; savedAt: string } = {
  id: 'default',
  name: 'Untitled UI',
  components: [],
  savedAt: new Date().toISOString(),
};

export async function GET() {
  return NextResponse.json(store);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!Array.isArray(body.components)) {
      return NextResponse.json(
        { success: false, error: 'components must be an array' },
        { status: 400 }
      );
    }

    store.components = body.components;
    store.name = body.name ?? 'Untitled UI';
    store.savedAt = new Date().toISOString();

    return NextResponse.json({
      success: true,
      id: store.id,
      savedAt: store.savedAt,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON' },
      { status: 400 }
    );
  }
}
