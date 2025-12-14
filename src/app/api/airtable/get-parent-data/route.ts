import { NextRequest, NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';
import { ApiResponse, ParentPortalData } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const accessToken = searchParams.get('accessToken');

    if (!accessToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Access token is required' },
        { status: 400 }
      );
    }

    const portalData = await airtableService.getParentPortalData(accessToken);

    if (!portalData) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid access token or no data found' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse<ParentPortalData>>({
      success: true,
      data: portalData,
    });
  } catch (error) {
    console.error('Error fetching parent data:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch parent data'
      },
      { status: 500 }
    );
  }
}