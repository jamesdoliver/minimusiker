import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/types';
import { getR2Service } from '@/lib/services/r2Service';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('eventId');
    const classId = searchParams.get('classId');
    const className = searchParams.get('className');

    if (!eventId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    // Check if R2 integration is enabled
    const isR2Enabled = process.env.ENABLE_DIGITAL_DELIVERY === 'true';

    if (!isR2Enabled) {
      // Return a placeholder audio URL for development
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          url: '/audio/sample-preview.mp3', // Placeholder audio file
          expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), // 30 minutes
          message: 'R2 integration is disabled. Using placeholder audio.',
        },
      });
    }

    // Generate actual R2 presigned URL
    const r2Service = getR2Service();

    // Use fallback method to support both class_id and className
    const previewUrl = await r2Service.getRecordingUrlWithFallback(
      eventId,
      'preview',
      classId || undefined,
      className || undefined
    );

    if (!previewUrl) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: 'Preview recording not found for this event',
      }, { status: 404 });
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 minutes

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        url: previewUrl,
        expiresAt: expiresAt,
        eventId: eventId,
        classId: classId || undefined,
        className: className || undefined,
      },
    });
  } catch (error) {
    console.error('Error generating preview URL:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to generate preview URL' },
      { status: 500 }
    );
  }
}