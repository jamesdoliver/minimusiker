import { NextRequest, NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';
import { ApiResponse, Event } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    const event = await airtableService.getEventById(eventId);

    if (!event) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Get additional event details
    const [classes, products] = await Promise.all([
      airtableService.getClassesByEventId(eventId),
      airtableService.getProductsByEventId(eventId),
    ]);

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        event,
        classes,
        products,
      },
    });
  } catch (error) {
    console.error('Error fetching event details:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to fetch event details' },
      { status: 500 }
    );
  }
}