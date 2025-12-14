import { NextResponse } from 'next/server';
import airtableService from '@/lib/services/airtableService';

export async function GET() {
  try {
    // Test the connection
    const connectionTest = await airtableService.testConnection();

    if (!connectionTest.success) {
      return NextResponse.json(connectionTest, { status: 500 });
    }

    // Try to fetch a few records to see the data structure
    const sampleRecords = await airtableService.getAllRecords();

    // Get some statistics
    const emailOptIns = await airtableService.getEmailCampaignOptIns();
    const parentsWithOrders = await airtableService.getParentsWithOrders();

    return NextResponse.json({
      success: true,
      message: 'Airtable connection successful!',
      connectionDetails: connectionTest.data,
      statistics: {
        totalRecords: sampleRecords.records.length,
        emailOptIns: emailOptIns.length,
        parentsWithOrders: parentsWithOrders.length,
      },
      sampleData: {
        firstThreeRecords: sampleRecords.records.slice(0, 3).map((record) => ({
          id: record.id,
          bookingId: record.booking_id,
          parentName: record.parent_first_name,
          email: record.parent_email,
          school: record.school_name,
          child: record.registered_child,
          eventType: record.event_type,
        })),
        availableSchools: [...new Set(sampleRecords.records.map(r => r.school_name))].slice(0, 5),
        availableEventTypes: [...new Set(sampleRecords.records.map(r => r.event_type))].slice(0, 5),
      },
      tableInfo: {
        tableName: 'parent_journey_table',
        baseId: process.env.AIRTABLE_BASE_ID,
        fieldsConfigured: {
          booking_id: 'fldUB8dAiQd61VncB',
          school_name: 'fld2Rd4S9aWGOjkJI',
          teacher_name: 'fldPscsXvYRwfvZwY',
          class: 'fldJMcFElbkkPGhSe',
          registered_child: 'flddZJuHdOqeighMf',
          parent_first_name: 'fldTeWfHG1TQJbzgr',
          parent_email: 'fldwiX1CSfJZS0AIz',
          parent_telephone: 'fldYljDGY0MPzgzDx',
          email_campaigns: 'fldSTM8ogsqM357h1',
          order_number: 'fldeYzYUhAWIZxFX3',
          school_recording: 'fldDuUntIy3yUN0Am',
          event_type: 'fldOZ20fduUR0mboV',
          parent_id: 'fld4mmx0n71PSr1JM',
        },
      },
    });
  } catch (error) {
    console.error('Airtable test error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to connect to Airtable',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        baseId: process.env.AIRTABLE_BASE_ID,
        hasApiKey: !!process.env.AIRTABLE_API_KEY,
      },
    }, { status: 500 });
  }
}

// Test parent login by email
export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({
        success: false,
        message: 'Email is required',
      }, { status: 400 });
    }

    const parentJourney = await airtableService.getParentByEmail(email);

    if (!parentJourney) {
      return NextResponse.json({
        success: false,
        message: `No parent found with email: ${email}`,
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Parent found!',
      data: {
        id: parentJourney.id,
        bookingId: parentJourney.booking_id,
        parentName: parentJourney.parent_first_name,
        email: parentJourney.parent_email,
        phone: parentJourney.parent_telephone,
        school: parentJourney.school_name,
        teacher: parentJourney.teacher_name,
        class: parentJourney.class,
        child: parentJourney.registered_child,
        eventType: parentJourney.event_type,
        hasOrder: !!parentJourney.order_number,
        emailCampaigns: parentJourney.email_campaigns,
        parentId: parentJourney.parent_id,
      },
    });
  } catch (error) {
    console.error('Email lookup error:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to lookup parent by email',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}