import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import type { Lead } from '@/lib/types/airtable';

export const dynamic = 'force-dynamic';

export interface LeadWithStaffName extends Lead {
  assignedStaffName?: string;
}

export interface StaffOption {
  id: string;
  name: string;
}

export interface RegionOption {
  id: string;
  name: string;
}

export async function GET(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const airtableService = getAirtableService();

    const [leads, staffList, regionList] = await Promise.all([
      airtableService.getAllLeads(),
      airtableService.getAllStaffMembers(),
      airtableService.getAllRegions(),
    ]);

    // Enrich leads with staff names
    const staffMap = new Map(staffList.map(s => [s.id, s.name]));
    const enrichedLeads: LeadWithStaffName[] = leads.map(lead => ({
      ...lead,
      assignedStaffName: lead.assignedStaffId ? staffMap.get(lead.assignedStaffId) : undefined,
    }));

    return NextResponse.json({
      success: true,
      data: {
        leads: enrichedLeads,
        staffList,
        regionList,
      },
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch leads' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const { schoolName, contactPerson, contactEmail, contactPhone } = body;
    if (!schoolName?.trim() || !contactPerson?.trim()) {
      return NextResponse.json(
        { success: false, error: 'School name and contact person are required' },
        { status: 400 }
      );
    }
    if (!contactEmail?.trim() && !contactPhone?.trim()) {
      return NextResponse.json(
        { success: false, error: 'At least one of email or phone is required' },
        { status: 400 }
      );
    }

    const airtableService = getAirtableService();
    const lead = await airtableService.createLead({
      schoolName: schoolName.trim(),
      contactPerson: contactPerson.trim(),
      contactEmail: contactEmail?.trim() || undefined,
      contactPhone: contactPhone?.trim() || undefined,
      address: body.address?.trim() || undefined,
      postalCode: body.postalCode?.trim() || undefined,
      city: body.city?.trim() || undefined,
      regionId: body.regionId || undefined,
      estimatedChildren: body.estimatedChildren ? Number(body.estimatedChildren) : undefined,
      eventTypeInterest: body.eventTypeInterest || undefined,
      leadSource: body.leadSource || undefined,
      schulsongUpsell: body.schulsongUpsell || false,
      scsFunded: body.scsFunded || false,
      assignedStaffId: body.assignedStaffId || undefined,
      initialNotes: body.initialNotes?.trim() || undefined,
      estimatedDate: body.estimatedDate || undefined,
      estimatedMonth: body.estimatedMonth || undefined,
    });

    return NextResponse.json({ success: true, data: lead });
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create lead' },
      { status: 500 }
    );
  }
}
