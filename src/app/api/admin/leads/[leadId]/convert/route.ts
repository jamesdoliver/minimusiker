import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { leadId } = await params;
    const airtableService = getAirtableService();

    // Update lead stage to Won
    const lead = await airtableService.updateLead(leadId, { stage: 'Won' });

    // Return pre-fill data for CreateBookingModal
    const prefillData = {
      leadId: lead.id,
      schoolName: lead.schoolName,
      contactName: lead.contactPerson,
      contactEmail: lead.contactEmail || '',
      phone: lead.contactPhone || '',
      address: lead.address || '',
      postalCode: lead.postalCode || '',
      city: lead.city || '',
      regionId: lead.regionId || '',
      estimatedChildren: lead.estimatedChildren?.toString() || '',
      eventDate: lead.estimatedDate || '',
      callNotes: lead.callNotes,
      schulsongUpsell: lead.schulsongUpsell || false,
      scsFunded: lead.scsFunded || false,
    };

    return NextResponse.json({ success: true, data: prefillData });
  } catch (error) {
    console.error('Error converting lead:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to convert lead' },
      { status: 500 }
    );
  }
}
