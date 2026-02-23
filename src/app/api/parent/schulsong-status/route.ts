import { NextRequest, NextResponse } from 'next/server';
import { verifyParentSession } from '@/lib/auth/verifyParentSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/parent/schulsong-status?eventId={eventId}
 * Check if event has a schulsong and return signed URLs for playback/download
 *
 * The schulsong is a free gift — no purchase check required.
 *
 * Response:
 *   { isSchulsong: false } — event doesn't have schulsong feature
 *   { isSchulsong: true, hasAudio: false } — schulsong enabled but no audio yet
 *   { isSchulsong: true, hasAudio: true, audioUrl, downloadUrl } — ready to play
 */
export async function GET(request: NextRequest) {
  try {
    const session = verifyParentSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json(
        { error: 'eventId is required' },
        { status: 400 }
      );
    }

    // Verify parent has access to this event
    const hasAccess = session.children?.some(c => c.eventId === eventId)
      || session.eventId === eventId;
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this event' },
        { status: 403 }
      );
    }

    // Fetch the full event to get both is_schulsong and is_minimusikertag
    const airtableService = getAirtableService();
    const teacherService = getTeacherService();
    const event = await airtableService.getEventByEventId(eventId);
    const isSchulsong = event?.is_schulsong === true;
    const isMinimusikertag = event?.is_minimusikertag === true;
    const isPlus = event?.is_plus === true;
    const eventDate = event?.event_date || null;
    const timelineOverrides = event?.timeline_overrides || null;
    // Deal Builder data for shop profile resolution
    const dealBuilderEnabled = event?.deal_builder_enabled === true;
    const dealType = event?.deal_type || null;
    const dealConfig = event?.deal_config || null;

    // Schulsong visibility is controlled by schulsong_released_at (set when admin approves)
    const releasedAt = event?.schulsong_released_at ? new Date(event.schulsong_released_at) : null;
    const isVisible = releasedAt !== null && new Date() >= releasedAt;

    if (!isSchulsong) {
      return NextResponse.json({
        success: true,
        isSchulsong: false,
        isMinimusikertag,
        isPlus,
        eventDate,
        timelineOverrides,
        dealBuilderEnabled,
        dealType,
        dealConfig,
      });
    }

    // Find the schulsong audio file (is_schulsong=true, type=final, status=ready)
    const schulsongFile = await teacherService.getSchulsongAudioFile(eventId);

    if (!schulsongFile) {
      return NextResponse.json({
        success: true,
        isSchulsong: true,
        isMinimusikertag,
        isPlus,
        eventDate,
        timelineOverrides,
        dealBuilderEnabled,
        dealType,
        dealConfig,
        hasAudio: false,
      });
    }

    // Build a friendly download filename: "Schulsong_Grundschule am Mühlberg.mp3"
    const ext = schulsongFile.r2Key.endsWith('.wav') ? 'wav' : 'mp3';
    const schoolName = event?.school_name || '';
    const downloadFilename = schoolName
      ? `Schulsong_${schoolName}.${ext}`
      : `schulsong.${ext}`;

    // Generate signed URLs
    const r2Service = getR2Service();
    let audioUrl: string | null = null;
    let downloadUrl: string | null = null;

    try {
      if (await r2Service.fileExists(schulsongFile.r2Key)) {
        audioUrl = await r2Service.generateSignedUrl(schulsongFile.r2Key, 3600);
        downloadUrl = await r2Service.generateSignedUrl(schulsongFile.r2Key, 86400, downloadFilename);
      }
    } catch (err) {
      console.error('Error generating schulsong signed URLs:', err);
    }

    if (!audioUrl) {
      return NextResponse.json({
        success: true,
        isSchulsong: true,
        isMinimusikertag,
        isPlus,
        eventDate,
        timelineOverrides,
        dealBuilderEnabled,
        dealType,
        dealConfig,
        hasAudio: false,
      });
    }

    // If audio exists but visibility conditions not met, indicate not yet visible
    if (!isVisible) {
      return NextResponse.json({
        success: true,
        isSchulsong: true,
        isMinimusikertag,
        isPlus,
        eventDate,
        timelineOverrides,
        dealBuilderEnabled,
        dealType,
        dealConfig,
        hasAudio: false,
        notYetVisible: true,
        visibleAfter: releasedAt?.toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      isSchulsong: true,
      isMinimusikertag,
      isPlus,
      eventDate,
      timelineOverrides,
      dealBuilderEnabled,
      dealType,
      dealConfig,
      hasAudio: true,
      audioUrl,
      downloadUrl,
      filename: downloadFilename,
    });
  } catch (error) {
    console.error('Error fetching schulsong status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch schulsong status' },
      { status: 500 }
    );
  }
}
