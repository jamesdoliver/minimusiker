// src/app/api/admin/tasks/[taskId]/invoice/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getR2Service } from '@/lib/services/r2Service';
import {
  TASKS_TABLE_ID,
  TASKS_FIELD_IDS,
} from '@/lib/types/airtable';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/[taskId]/invoice
 * Get signed URL for invoice download
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      );
    }

    const airtable = getAirtableService();
    const base = airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    const record = await table.find(taskId);
    const completionDataStr = record.get(TASKS_FIELD_IDS.completion_data) as string;

    if (!completionDataStr) {
      return NextResponse.json(
        { success: false, error: 'No completion data found' },
        { status: 404 }
      );
    }

    const completionData = JSON.parse(completionDataStr);

    if (!completionData.invoice_r2_key) {
      return NextResponse.json(
        { success: false, error: 'No invoice uploaded' },
        { status: 404 }
      );
    }

    const r2 = getR2Service();
    const url = await r2.generateSignedUrlForAssetsBucket(completionData.invoice_r2_key, 3600);

    return NextResponse.json({
      success: true,
      data: { url },
    });
  } catch (error) {
    console.error('Error getting invoice URL:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get invoice URL' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/tasks/[taskId]/invoice
 * Upload invoice to R2
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;

    if (!taskId) {
      return NextResponse.json(
        { success: false, error: 'Task ID is required' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: PDF, PNG, JPG' },
        { status: 400 }
      );
    }

    // Get file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate R2 key
    const ext = file.name.split('.').pop() || 'pdf';
    const r2Key = `invoices/${taskId}/${Date.now()}.${ext}`;

    // Upload to R2
    const r2 = getR2Service();
    await r2.uploadToAssetsBucket(r2Key, buffer, file.type);

    // Update task completion_data with invoice_r2_key
    const airtable = getAirtableService();
    const base = airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    const record = await table.find(taskId);
    const existingData = record.get(TASKS_FIELD_IDS.completion_data) as string;

    let completionData = {};
    if (existingData) {
      try {
        completionData = JSON.parse(existingData);
      } catch {
        // Ignore parse errors
      }
    }

    const updatedData = {
      ...completionData,
      invoice_r2_key: r2Key,
    };

    await table.update(taskId, {
      [TASKS_FIELD_IDS.completion_data]: JSON.stringify(updatedData),
    });

    return NextResponse.json({
      success: true,
      data: { invoice_url: r2Key },
    });
  } catch (error) {
    console.error('Error uploading invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to upload invoice' },
      { status: 500 }
    );
  }
}
