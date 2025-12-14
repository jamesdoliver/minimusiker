import { NextRequest, NextResponse } from 'next/server';
import { airtableService } from '@/lib/services/airtableService';
import { ApiResponse } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Access token is required' },
        { status: 400 }
      );
    }

    const parent = await airtableService.getParentByAccessToken(accessToken);

    if (!parent) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid access token' },
        { status: 401 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        parentId: parent.parent_id,
        email: parent.email,
        firstName: parent.first_name,
        lastName: parent.last_name,
      },
    });
  } catch (error) {
    console.error('Error verifying parent:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to verify parent' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Token is required' },
      { status: 400 }
    );
  }

  try {
    const parent = await airtableService.getParentByAccessToken(token);

    if (!parent) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { valid: true },
    });
  } catch (error) {
    console.error('Error checking token:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to check token' },
      { status: 500 }
    );
  }
}