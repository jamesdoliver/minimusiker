import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const airtableService = getAirtableService();
    const schulsong = await airtableService.getSchulsongById(id);

    if (!schulsong) {
      return NextResponse.json({ success: false, error: 'Schulsong not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: schulsong });
  } catch (error) {
    console.error('Error fetching schulsong:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch schulsong' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const airtableService = getAirtableService();
    const schulsong = await airtableService.updateSchulsong(id, body);

    return NextResponse.json({ success: true, data: schulsong });
  } catch (error) {
    console.error('Error updating schulsong:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to update schulsong' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const airtableService = getAirtableService();
    await airtableService.deleteSchulsong(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting schulsong:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to delete schulsong' },
      { status: 500 }
    );
  }
}
