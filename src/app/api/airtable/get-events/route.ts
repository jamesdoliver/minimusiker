import { NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';

export async function GET() {
  try {
    const events = await airtableService.getSchoolEventSummaries();
    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
