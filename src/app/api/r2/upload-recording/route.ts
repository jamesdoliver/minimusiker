import { NextRequest, NextResponse } from 'next/server';
import { getR2Service } from '@/lib/services/r2Service';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for large file uploads

export async function POST(request: NextRequest) {
  try {
    // Check if digital delivery is enabled
    if (process.env.ENABLE_DIGITAL_DELIVERY !== 'true') {
      return NextResponse.json(
        { success: false, error: 'Digital delivery is not enabled' },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const eventId = formData.get('eventId') as string | null;
    const recordingType = formData.get('type') as 'preview' | 'full' | null;
    const classId = formData.get('classId') as string | null;
    const className = formData.get('className') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    if (!recordingType || !['preview', 'full'].includes(recordingType)) {
      return NextResponse.json(
        { success: false, error: 'Recording type must be "preview" or "full"' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Invalid file type: ${file.type}. Must be an audio file.` },
        { status: 400 }
      );
    }

    // Validate file size (max 500MB)
    const maxSize = 500 * 1024 * 1024; // 500MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 500MB limit' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Determine content type
    const contentType = file.type === 'audio/wav' || file.type === 'audio/x-wav' ? 'audio/wav' : 'audio/mpeg';

    // Upload to R2
    const r2Service = getR2Service();
    let result;

    // Use new method with class_id if available, otherwise fall back to legacy method
    if (classId) {
      // NEW: Use class_id-based upload
      result = await r2Service.uploadRecordingWithClassId(
        eventId,
        classId,
        buffer,
        recordingType,
        contentType,
        {
          ...(className && { className: className }),
          originalFileName: file.name,
        }
      );
    } else {
      // LEGACY: Use className-based upload for backward compatibility
      result = await r2Service.uploadRecording(
        eventId,
        buffer,
        recordingType,
        contentType,
        className || undefined
      );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Upload failed' },
        { status: 500 }
      );
    }

    // Return success with file details
    return NextResponse.json({
      success: true,
      data: {
        key: result.key,
        eventId: eventId,
        classId: classId || undefined,
        className: className || undefined,
        type: recordingType,
        fileName: file.name,
        fileSize: file.size,
        contentType: file.type,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
