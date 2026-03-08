import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { customerName, plz, ort, type } = body;
    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
      return NextResponse.json({ success: false, error: 'customerName is required' }, { status: 400 });
    }

    const airtableService = getAirtableService();
    const result = await airtableService.createEinrichtungMinimal({
      customerName: customerName.trim(),
      plz: plz?.trim() || undefined,
      ort: ort?.trim() || undefined,
      type: type?.trim() || undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating einrichtung:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Creation failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const q = request.nextUrl.searchParams.get('q') || '';
    if (q.length < 2) {
      return NextResponse.json({ success: true, data: [] });
    }

    const airtableService = getAirtableService();
    const results = await airtableService.searchEinrichtungen(q);

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('Error searching einrichtungen:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
