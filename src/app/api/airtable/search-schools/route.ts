import { NextRequest, NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';

/**
 * GET /api/airtable/search-schools
 * Search for schools with active upcoming events
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    if (query.length < 2) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Query too short',
      });
    }

    const schools = await airtableService.searchActiveSchools(query);

    return NextResponse.json({
      success: true,
      data: schools,
    });
  } catch (error) {
    console.error('Error searching schools:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search schools',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
