import { NextRequest, NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { ApiResponse, DashboardStats } from '@/lib/types';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';

export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch dashboard statistics
    const stats = await getAirtableService().getDashboardStats();

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
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { eventId } = await request.json();

    if (!eventId) {
      // Return general dashboard stats
      const stats = await getAirtableService().getDashboardStats();
      return NextResponse.json<ApiResponse>({
        success: true,
        data: stats,
      });
    }

    // Get event-specific analytics
    const eventAnalytics = await getAirtableService().getEventAnalytics(eventId);

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