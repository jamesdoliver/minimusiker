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

    // Check if event has schulsong feature enabled
    const isSchulsong = await getAirtableService().getEventIsSchulsong(eventId);

    // Auto-create schulsong class if event has schulsong enabled
    let schulsongClassView: EngineerClassView | undefined;
    if (isSchulsong) {
      const schulsongClass = await teacherService.ensureSchulsongClass({
        eventId,
        schoolName: eventDetail.schoolName,
        bookingDate: eventDetail.eventDate,
      });
      if (schulsongClass) {
        const schulsongAudioFiles = audioFilesWithUrls.filter(
          (f) => f.classId === schulsongClass.classId
        );
        schulsongClassView = {
          classId: schulsongClass.classId,
          className: 'Schulsong',
          rawFiles: schulsongAudioFiles.filter((f) => f.type === 'raw'),
          previewFile: schulsongAudioFiles.find((f) => f.type === 'preview'),
          finalMp3File: schulsongAudioFiles.find(
            (f) => f.type === 'final' && f.r2Key.endsWith('.mp3')
          ),
          finalWavFile: schulsongAudioFiles.find(
            (f) => f.type === 'final' && f.r2Key.endsWith('.wav')
          ),
        };
      }
    }

    // Group audio files by class (excluding schulsong class from regular classes)
    // Micha only handles schulsong — skip regular classes entirely for him
    const isMichaEngineer = ENGINEER_IDS.MICHA && session.engineerId === ENGINEER_IDS.MICHA;
    const classesWithAudio: EngineerClassView[] = isMichaEngineer ? [] : eventDetail.classes
      .filter((classDetail) => !schulsongClassView || classDetail.classId !== schulsongClassView.classId)
      .map((classDetail) => {
        const classAudioFiles = audioFilesWithUrls.filter(
          (f) => f.classId === classDetail.classId
        );

        const rawFiles = classAudioFiles.filter((f) => f.type === 'raw');
        const previewFile = classAudioFiles.find((f) => f.type === 'preview');
        const finalMp3File = classAudioFiles.find(
          (f) => f.type === 'final' && f.r2Key.endsWith('.mp3')
        );
        const finalWavFile = classAudioFiles.find(
          (f) => f.type === 'final' && f.r2Key.endsWith('.wav')
        );

        return {
          classId: classDetail.classId,
          className: classDetail.className,
          rawFiles,
          previewFile,
          finalMp3File,
          finalWavFile,
        };
      });

    // Determine overall mixing status
    const hasAnyRaw = classesWithAudio.some((c) => c.rawFiles.length > 0);
    const allHavePreview = classesWithAudio.every((c) => c.previewFile);
    const allHaveFinal = classesWithAudio.every((c) => c.finalMp3File || c.finalWavFile);
    const someHavePreview = classesWithAudio.some((c) => c.previewFile);

    let mixingStatus: EngineerMixingStatus = 'pending';
    if (allHavePreview && allHaveFinal && classesWithAudio.length > 0) {
      mixingStatus = 'completed';
    } else if (someHavePreview || (hasAnyRaw && classesWithAudio.some((c) => c.finalMp3File || c.finalWavFile))) {
      mixingStatus = 'in-progress';
    }

    // Schulsong-only override: if there are no regular classes, derive status from schulsong
    if (schulsongClassView && classesWithAudio.length === 0) {
      const hasSchulsongFinal = !!(schulsongClassView.finalMp3File || schulsongClassView.finalWavFile);
      if (hasSchulsongFinal) {
        mixingStatus = 'completed';
      } else if (schulsongClassView.rawFiles.length > 0) {
        mixingStatus = 'in-progress';
      }
    }

    // Fetch audio_pipeline_stage from the event record
    const eventRecord = await getAirtableService().getEventByEventId(eventId);
    const audioPipelineStage = eventRecord?.audio_pipeline_stage;

    const response: EngineerEventDetail = {
      eventId: eventDetail.eventId,
      schoolName: eventDetail.schoolName,
      eventDate: eventDetail.eventDate,
      eventType: eventDetail.eventType,
      classes: classesWithAudio,
      mixingStatus,
      isSchulsong,
      schulsongClass: schulsongClassView,
      audioPipelineStage,
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
