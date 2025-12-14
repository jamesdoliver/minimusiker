import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { ApiResponse, ParentSession } from '@/lib/types';

const PARENT_JWT_SECRET = process.env.PARENT_JWT_SECRET || process.env.JWT_SECRET || 'parent-secret-key';

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('parent_session')?.value;

    if (!token) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'No session found. Please log in.'
        },
        { status: 401 }
      );
    }

    try {
      // Verify and decode the JWT token
      const decoded = jwt.verify(token, PARENT_JWT_SECRET) as ParentSession & { exp: number; iat: number };

      // Check if token is expired (redundant but good for clarity)
      if (decoded.exp && decoded.exp * 1000 < Date.now()) {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: 'Session has expired. Please log in again.'
          },
          { status: 401 }
        );
      }

      // Return the session data
      return NextResponse.json<ApiResponse<ParentSession>>({
        success: true,
        data: {
          parentId: decoded.parentId,
          email: decoded.email,
          firstName: decoded.firstName,
          bookingId: decoded.bookingId,
          schoolName: decoded.schoolName,
          eventType: decoded.eventType,
          childName: decoded.childName,
          loginTimestamp: decoded.loginTimestamp,
        },
      });
    } catch (jwtError: any) {
      console.error('JWT verification error:', jwtError);

      // Handle specific JWT errors
      if (jwtError.name === 'TokenExpiredError') {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: 'Session has expired. Please log in again.'
          },
          { status: 401 }
        );
      }

      if (jwtError.name === 'JsonWebTokenError') {
        return NextResponse.json<ApiResponse>(
          {
            success: false,
            error: 'Invalid session. Please log in again.'
          },
          { status: 401 }
        );
      }

      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: 'Failed to verify session.'
        },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error verifying parent session:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: 'An error occurred while verifying your session.'
      },
      { status: 500 }
    );
  }
}