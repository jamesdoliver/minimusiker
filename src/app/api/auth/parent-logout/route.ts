import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Create response
    const response = NextResponse.json<ApiResponse>({
      success: true,
      message: 'You have been successfully logged out.',
    });

    // Clear the parent session cookie
    response.cookies.set('parent_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error during parent logout:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'Failed to log out. Please try again.'
      },
      { status: 500 }
    );
  }
}

// Support DELETE method as well for RESTful design
export async function DELETE(request: NextRequest) {
  return POST(request);
}