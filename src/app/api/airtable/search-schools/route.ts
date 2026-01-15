import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';

/**
 * GET /api/airtable/search-schools
 *
 * Query params:
 * - q: Search query (minimum 2 characters)
 *
 * Returns schools with upcoming events matching the search query.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json({
      success: true,
      data: [],
    });
  }

  try {
    const airtableService = getAirtableService();
    const results = await airtableService.searchActiveSchools(query);

    return NextResponse.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Error searching schools:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to search schools' },
      { status: 500 }
    );
  }
}
