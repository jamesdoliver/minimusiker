import { NextRequest, NextResponse } from 'next/server';
import { verifyParentSession } from '@/lib/auth/verifyParentSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';

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
    const allTracksApproved = event?.all_tracks_approved === true;

    // Check if 7 days have passed since the event date
    const eventDate = event?.event_date ? new Date(event.event_date) : null;
    const sevenDaysAfter = eventDate ? new Date(eventDate) : null;
    if (sevenDaysAfter) {
      sevenDaysAfter.setDate(sevenDaysAfter.getDate() + 7);
    }
    const hasWaitingPeriodPassed = sevenDaysAfter ? new Date() >= sevenDaysAfter : false;

    if (!isSchulsong) {
      return NextResponse.json({
        success: true,
        isSchulsong: false,
        isMinimusikertag,
        isPlus,
      });
    }

    // Find the schulsong audio file (is_schulsong=true, type=final, status=ready)
    const schulsongFile = await teacherService.getSchulsongAudioFile(eventId);

    // Check teacher approval status
    const teacherApproved = !!schulsongFile?.teacherApprovedAt;

    // Audio is visible only when:
    // 1. Admin approved ALL tracks AND
    // 2. Teacher approved the schulsong AND
    // 3. 7 days have passed since event date
    const isVisible = allTracksApproved && teacherApproved && hasWaitingPeriodPassed;

    if (!schulsongFile) {
      return NextResponse.json({
        success: true,
        isSchulsong: true,
        isMinimusikertag,
        isPlus,
        hasAudio: false,
      });
    }

    // Generate signed URLs
    const r2Service = getR2Service();
    let audioUrl: string | null = null;
    let downloadUrl: string | null = null;

    try {
      if (await r2Service.fileExists(schulsongFile.r2Key)) {
        // 1 hour for playback
        audioUrl = await r2Service.generateSignedUrl(schulsongFile.r2Key, 3600);
        // 24 hours for download
        downloadUrl = await r2Service.generateSignedUrl(schulsongFile.r2Key, 86400);
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
        hasAudio: false,
        notYetVisible: true,
        visibleAfter: sevenDaysAfter?.toISOString(),
      });
    }

    const extension = schulsongFile.r2Key.endsWith('.wav') ? 'wav' : 'mp3';

    return NextResponse.json({
      success: true,
      isSchulsong: true,
      isMinimusikertag,
      isPlus,
      hasAudio: true,
      audioUrl,
      downloadUrl,
      filename: `schulsong.${extension}`,
    });
  } catch (error) {
    console.error('Error fetching schulsong status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch schulsong status' },
      { status: 500 }
    );
  }
}
