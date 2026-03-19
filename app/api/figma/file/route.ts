/**
 * /api/figma/file
 * ────────────────
 * Proxy endpoint for the Figma REST API.
 *
 * Usage:
 *   GET /api/figma/file?fileId=FILE_ID
 *   Header: x-figma-token: <personal-access-token>
 *
 * The token is NOT stored — it is forwarded to the Figma API for this
 * single request only. Never include the token in the query string.
 *
 * Response: raw Figma file JSON  (same shape as GET /v1/files/:file_key)
 *
 * Vercel compatible: serverless function, no external SDK required.
 */

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const FIGMA_API_BASE = 'https://api.figma.com/v1';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fileId = searchParams.get('fileId');

  if (!fileId) {
    return NextResponse.json(
      { error: 'Missing required query parameter: fileId' },
      { status: 400 }
    );
  }

  // Validate fileId format (alphanumeric, no path injection)
  if (!/^[A-Za-z0-9]+$/.test(fileId)) {
    return NextResponse.json(
      { error: 'Invalid fileId format. Expected alphanumeric string.' },
      { status: 400 }
    );
  }

  // Extract token from header
  const token = request.headers.get('x-figma-token');
  if (!token) {
    return NextResponse.json(
      { error: 'Missing required header: x-figma-token. Provide your Figma personal access token.' },
      { status: 401 }
    );
  }

  // Optional: limit node depth via query param to keep response size manageable
  const depth = Math.min(Number(searchParams.get('depth') ?? 5), 10);

  const figmaUrl = `${FIGMA_API_BASE}/files/${fileId}?depth=${depth}`;

  try {
    const figmaResponse = await fetch(figmaUrl, {
      headers: {
        'X-FIGMA-TOKEN': token,
        'Accept': 'application/json',
      },
      // Do NOT follow redirects automatically — surface any unexpected redirect
      redirect: 'error',
    });

    if (!figmaResponse.ok) {
      const errBody = await figmaResponse.text().catch(() => '');
      const status = figmaResponse.status;

      if (status === 403) {
        return NextResponse.json(
          { error: 'Figma returned 403 Forbidden. Check your personal access token and file permissions.' },
          { status: 403 }
        );
      }
      if (status === 404) {
        return NextResponse.json(
          { error: `Figma file "${fileId}" not found. Verify the file ID is correct and accessible.` },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: `Figma API error ${status}: ${errBody.substring(0, 200)}` },
        { status: status >= 400 && status < 600 ? status : 502 }
      );
    }

    const data = await figmaResponse.json();
    return NextResponse.json(data, {
      headers: {
        // Cache for 5 minutes to avoid hammering the Figma API
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to contact Figma API: ${message}` },
      { status: 502 }
    );
  }
}
