import { NextRequest, NextResponse } from 'next/server';
import { getR2Service } from '@/lib/services/r2Service';
import { FontName, FONT_FILENAMES } from '@/lib/services/r2Service';

// Map URL-friendly names to FontName type
const FONT_NAME_MAP: Record<string, FontName> = {
  'fredoka': 'fredoka',
  'springwood-display': 'springwood-display',
};

// Content types for font formats
const FONT_CONTENT_TYPES: Record<string, string> = {
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * GET /api/admin/fonts/[fontName]
 *
 * Serves font files from R2 storage for use in the editor preview.
 * The font files are cached by the browser for subsequent requests.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { fontName: string } }
) {
  try {
    const fontNameParam = params.fontName.toLowerCase();
    const fontName = FONT_NAME_MAP[fontNameParam];

    if (!fontName) {
      return NextResponse.json(
        { success: false, error: `Unknown font: ${fontNameParam}` },
        { status: 404 }
      );
    }

    const r2Service = getR2Service();
    const fontBuffer = await r2Service.getFont(fontName);

    if (!fontBuffer) {
      return NextResponse.json(
        { success: false, error: `Font not found in R2: ${fontName}` },
        { status: 404 }
      );
    }

    // Determine content type from filename
    const filename = FONT_FILENAMES[fontName];
    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
    const contentType = FONT_CONTENT_TYPES[ext] || 'application/octet-stream';

    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(fontBuffer);

    // Return the font file with appropriate headers
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable', // Cache for 1 year
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Error serving font:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to serve font',
      },
      { status: 500 }
    );
  }
}
