import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import airtableService from '@/lib/services/airtableService';
import { ApiResponse, DashboardStats } from '@/types';

// Middleware to verify admin authentication
async function verifyAdmin(request: NextRequest) {
  const cookieStore = cookies();
  const token = cookieStore.get('admin_token')?.value;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    return decoded;
  } catch (error) {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Skip authentication check for development
    // TODO: Re-enable auth check in production
    const isDev = process.env.NODE_ENV === 'development';

    if (!isDev) {
      // Verify admin authentication
      const admin = await verifyAdmin(request);

      if (!admin) {
        return NextResponse.json<ApiResponse>(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Fetch dashboard statistics
    const stats = await airtableService.getDashboardStats();

    return NextResponse.json<ApiResponse<DashboardStats>>({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = await verifyAdmin(request);

    if (!admin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { eventId } = await request.json();

    if (!eventId) {
      // Return general dashboard stats
      const stats = await airtableService.getDashboardStats();
      return NextResponse.json<ApiResponse>({
        success: true,
        data: stats,
      });
    }

    // Get event-specific analytics
    const eventAnalytics = await airtableService.getEventAnalytics(eventId);

    if (!eventAnalytics) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: eventAnalytics,
    });
  } catch (error) {
    console.error('Error fetching event analytics:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch event analytics' },
      { status: 500 }
    );
  }
}