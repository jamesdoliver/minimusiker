import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';
import { ENGINEER_IDS } from '@/lib/config/engineers';
import {
  EngineerEventDetail,
  EngineerClassView,
  AudioFileWithUrl,
  EngineerMixingStatus,
} from '@/lib/types/engineer';

/**
 * GET /api/engineer/events/[eventId]
 * Get event detail with classes and audio files for engineer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyEngineerSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);

    // Verify engineer is assigned to this event
    const isAssigned = await getAirtableService().isEngineerAssignedToEvent(
      session.engineerId,
      eventId
    );

    if (!isAssigned) {
      return NextResponse.json(
        { error: 'You are not assigned to this event' },
        { status: 403 }
      );
    }

    // Get event details
    const eventDetail = await getAirtableService().getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get audio files for this event
    const teacherService = getTeacherService();
    let audioFiles = await teacherService.getAudioFilesByEventId(eventId);

    // Filter audio files based on engineer role (Micha=schulsong, Jakob=regular)
    // Only filter if engineer IDs are configured
    if (ENGINEER_IDS.MICHA && ENGINEER_IDS.JAKOB) {
      if (session.engineerId === ENGINEER_IDS.MICHA) {
        // Micha only sees schulsong tracks
        audioFiles = audioFiles.filter(f => f.isSchulsong === true);
      } else if (session.engineerId === ENGINEER_IDS.JAKOB) {
        // Jakob only sees non-schulsong (regular) tracks
        audioFiles = audioFiles.filter(f => !f.isSchulsong);
      }
      // If engineer is neither Micha nor Jakob, show all files (admin/fallback case)
    }

    // Generate signed URLs for all audio files
    const r2Service = getR2Service();
    const audioFilesWithUrls: AudioFileWithUrl[] = await Promise.all(
      audioFiles.map(async (file) => {
        let signedUrl: string | null = null;
        try {
          if (await r2Service.fileExists(file.r2Key)) {
            signedUrl = await r2Service.getRawAudioUrl(file.r2Key);
          }
        } catch (err) {
          console.error(`Error generating URL for ${file.r2Key}:`, err);
        }
        return {
          ...file,
          signedUrl,
        };
      })
    );

    // Group audio files by class
    const classesWithAudio: EngineerClassView[] = eventDetail.classes.map(
      (classDetail) => {
        const classAudioFiles = audioFilesWithUrls.filter(
          (f) => f.classId === classDetail.classId
        );

        const rawFiles = classAudioFiles.filter((f) => f.type === 'raw');
        const previewFile = classAudioFiles.find((f) => f.type === 'preview');
        const finalFile = classAudioFiles.find((f) => f.type === 'final');

        return {
          classId: classDetail.classId,
          className: classDetail.className,
          rawFiles,
          previewFile,
          finalFile,
        };
      }
    );

    // Determine overall mixing status
    const hasAnyRaw = classesWithAudio.some((c) => c.rawFiles.length > 0);
    const allHavePreview = classesWithAudio.every((c) => c.previewFile);
    const allHaveFinal = classesWithAudio.every((c) => c.finalFile);
    const someHavePreview = classesWithAudio.some((c) => c.previewFile);

    let mixingStatus: EngineerMixingStatus = 'pending';
    if (allHavePreview && allHaveFinal && classesWithAudio.length > 0) {
      mixingStatus = 'completed';
    } else if (someHavePreview || (hasAnyRaw && classesWithAudio.some((c) => c.finalFile))) {
      mixingStatus = 'in-progress';
    }

    // Check if event has schulsong feature enabled
    const isSchulsong = await getAirtableService().getEventIsSchulsong(eventId);

    const response: EngineerEventDetail = {
      eventId: eventDetail.eventId,
      schoolName: eventDetail.schoolName,
      eventDate: eventDetail.eventDate,
      eventType: eventDetail.eventType,
      classes: classesWithAudio,
      mixingStatus,
      isSchulsong,
    };

    return NextResponse.json({
      success: true,
      event: response,
    });
  } catch (error) {
    console.error('Error fetching engineer event detail:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch event',
      },
      { status: 500 }
    );
  }
}
