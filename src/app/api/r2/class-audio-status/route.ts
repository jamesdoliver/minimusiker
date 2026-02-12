import { NextRequest, NextResponse } from 'next/server';
import { ApiResponse } from '@/lib/types';
import { getR2Service, R2_PATHS } from '@/lib/services/r2Service';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

interface AudioStatusResponse {
  hasAudio: boolean;
  audioUrl?: string;
  schoolLogoUrl?: string;
  expiresAt?: string;
  notYetVisible?: boolean;
  visibleAfter?: string;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('eventId');
    const classId = searchParams.get('classId');
    const schoolId = searchParams.get('schoolId');

    if (!eventId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Event ID is required' },
        { status: 400 }
      );
    }

    if (!classId) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: 'Class ID is required' },
        { status: 400 }
      );
    }

    const r2Service = getR2Service();
    const airtableService = getAirtableService();
    const isR2Enabled = process.env.ENABLE_DIGITAL_DELIVERY === 'true';

    // Fetch event to check event date for time-based release
    const event = await airtableService.getEventByEventId(eventId);

    // Check if 7 days have passed since the event date (purely time-based)
    const eventDate = event?.event_date ? new Date(event.event_date) : null;
    const sevenDaysAfter = eventDate ? new Date(eventDate) : null;
    if (sevenDaysAfter) {
      sevenDaysAfter.setDate(sevenDaysAfter.getDate() + 7);
    }
    const hasWaitingPeriodPassed = sevenDaysAfter ? new Date() >= sevenDaysAfter : false;

    // Audio is visible when 7 days have passed since the event (time-based, no admin approval needed)
    const isVisible = hasWaitingPeriodPassed;

    // Check for final audio in the new structure
    // Path: events/{eventId}/classes/{classId}/final/final.mp3
    const finalAudioKey = `${R2_PATHS.CLASS_FINAL(eventId, classId)}/final.mp3`;

    let hasAudioFile = false;
    let audioUrl: string | undefined;

    if (isR2Enabled) {
      // Primary: check minimusiker bucket (where engineer uploads land)
      const recordingsKey = `recordings/${eventId}/${classId}/final.mp3`;
      if (await r2Service.fileExists(recordingsKey)) {
        hasAudioFile = true;
        audioUrl = await r2Service.generateSignedUrl(recordingsKey, 3600);
      } else {
        // Legacy fallback: assets bucket structured path
        if (await r2Service.fileExistsInAssetsBucket(finalAudioKey)) {
          hasAudioFile = true;
          audioUrl = await r2Service.generateSignedUrlForAssetsBucket(finalAudioKey, 3600);
        } else {
          // Legacy fallback: events/{eventId}/{classId}/full.mp3
          const legacyKey = `events/${eventId}/${classId}/full.mp3`;
          if (await r2Service.fileExists(legacyKey)) {
            hasAudioFile = true;
            audioUrl = await r2Service.generateSignedUrl(legacyKey, 3600);
          }
        }
      }
    }

    // Audio is only available if file exists AND visibility conditions are met
    const hasAudio = hasAudioFile && isVisible;

    // Clear audioUrl if not visible (don't expose URL to non-visible audio)
    if (!isVisible) {
      audioUrl = undefined;
    }

    // If no audio, get school logo URL
    let schoolLogoUrl: string | undefined;
    if (!hasAudio) {
      // Try to get logo from R2 event folder first
      const logoExtensions = ['png', 'jpg', 'jpeg', 'webp'];
      for (const ext of logoExtensions) {
        const logoKey = `${R2_PATHS.EVENT_LOGO(eventId)}/logo.${ext}`;
        if (await r2Service.fileExistsInAssetsBucket(logoKey)) {
          schoolLogoUrl = await r2Service.generateSignedUrlForAssetsBucket(logoKey, 3600);
          break;
        }
      }

      // Fallback: try to get from Airtable Einrichtung if schoolId provided
      if (!schoolLogoUrl && schoolId) {
        try {
          const airtableLogoUrl = await airtableService.getEinrichtungLogoUrl(schoolId);
          if (airtableLogoUrl) {
            schoolLogoUrl = airtableLogoUrl;
          }
        } catch (error) {
          console.error('Error fetching school logo from Airtable:', error);
        }
      }
    }

    const response: AudioStatusResponse = {
      hasAudio,
      audioUrl,
      schoolLogoUrl,
      expiresAt: hasAudio ? new Date(Date.now() + 3600 * 1000).toISOString() : undefined,
      // If audio file exists but not visible yet, indicate when it will be visible
      notYetVisible: hasAudioFile && !isVisible,
      visibleAfter: hasAudioFile && !isVisible && sevenDaysAfter
        ? sevenDaysAfter.toISOString()
        : undefined,
    };

    return NextResponse.json<ApiResponse<AudioStatusResponse>>({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error('Error checking class audio status:', error);
    return NextResponse.json<ApiResponse>(
      { success: false, error: 'Failed to check audio status' },
      { status: 500 }
    );
  }
}
