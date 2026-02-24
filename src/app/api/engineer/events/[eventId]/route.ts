import { NextRequest, NextResponse } from 'next/server';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';
import { ENGINEER_IDS } from '@/lib/config/engineers';
import {
  EngineerEventDetail,
  EngineerClassView,
  EngineerSongView,
  AudioFileWithUrl,
  EngineerMixingStatus,
  LogicProjectInfo,
} from '@/lib/types/engineer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/engineer/events/[eventId]
 * Get event detail with classes and audio files for engineer.
 *
 * Optimized: Single event fetch (includes assignment check, is_schulsong, pipeline stage),
 * batch class fetch, parallel songs + audio loading.
 * ~5-7 Airtable calls total (down from ~21+).
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
    const teacherService = getTeacherService();

    // Single optimized fetch: event record + assignment check + class records (2-3 calls)
    const result = await getAirtableService().getEngineerEventDetailOptimized(
      eventId,
      session.engineerId
    );

    if (!result) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!result.isAssigned) {
      return NextResponse.json(
        { error: 'You are not assigned to this event' },
        { status: 403 }
      );
    }

    const { event } = result;

    // Parallel fetch: songs + audio files (2 calls)
    const [allSongs, allAudioFiles] = await Promise.all([
      teacherService.getSongsByEventId(eventId),
      teacherService.getAudioFilesByEventId(eventId),
    ]);

    // Separate logic project files (event-level, visible to all engineers)
    // before applying role-based filtering to regular audio files
    let audioFiles = allAudioFiles.filter(
      f => f.type !== 'logic-project-schulsong' && f.type !== 'logic-project-minimusiker'
    );

    // Filter audio files based on engineer role (Micha=schulsong, Jakob=regular)
    if (ENGINEER_IDS.MICHA && ENGINEER_IDS.JAKOB) {
      if (session.engineerId === ENGINEER_IDS.MICHA) {
        audioFiles = audioFiles.filter(f => f.isSchulsong === true);
      } else if (session.engineerId === ENGINEER_IDS.JAKOB) {
        audioFiles = audioFiles.filter(f => !f.isSchulsong);
      }
    }

    // Generate signed URLs for regular audio files
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

    // Auto-create schulsong class if event has schulsong enabled
    let schulsongClassView: EngineerClassView | undefined;
    if (event.isSchulsong) {
      const schulsongClass = await teacherService.ensureSchulsongClass({
        eventId,
        schoolName: event.schoolName,
        bookingDate: event.eventDate,
      });
      if (schulsongClass) {
        const schulsongAudioFiles = audioFilesWithUrls.filter(
          (f) => f.classId === schulsongClass.classId
        );
        schulsongClassView = {
          classId: schulsongClass.classId,
          className: 'Schulsong',
          songs: [],
          rawFiles: schulsongAudioFiles.filter((f) => f.type === 'raw'),
          previewFile: schulsongAudioFiles.find((f) => f.type === 'preview')
            || schulsongAudioFiles.find((f) => f.type === 'final' && f.previewR2Key),
          finalMp3File: schulsongAudioFiles.find(
            (f) => f.type === 'final' && f.r2Key.endsWith('.mp3')
          ) || schulsongAudioFiles.find((f) => f.type === 'final' && f.mp3R2Key),
          finalWavFile: schulsongAudioFiles.find(
            (f) => f.type === 'final' && f.r2Key.endsWith('.wav')
          ),
        };
      }
    }

    // Group audio files by class (excluding schulsong class from regular classes)
    const isMichaEngineer = ENGINEER_IDS.MICHA && session.engineerId === ENGINEER_IDS.MICHA;
    const classesWithAudio: EngineerClassView[] = isMichaEngineer ? [] : event.classes
      .filter((classDetail) => !schulsongClassView || classDetail.classId !== schulsongClassView.classId)
      .map((classDetail) => {
        const classAudioFiles = audioFilesWithUrls.filter(
          (f) => f.classId === classDetail.classId
        );
        const classSongs = allSongs.filter(s => s.classId === classDetail.classId);

        const songs: EngineerSongView[] = classSongs.map(song => {
          const songFiles = classAudioFiles.filter(f => f.songId === song.id);
          return {
            songId: song.id,
            songTitle: song.title,
            artist: song.artist,
            order: song.order,
            previewFile: songFiles.find(f => f.type === 'preview')
              || songFiles.find(f => f.type === 'final' && f.previewR2Key),
            finalMp3File: songFiles.find(f => f.type === 'final' && f.r2Key.endsWith('.mp3'))
              || songFiles.find(f => f.type === 'final' && f.mp3R2Key),
            finalWavFile: songFiles.find(f => f.type === 'final' && f.r2Key.endsWith('.wav')),
          };
        });

        // Legacy files without songId
        const rawFiles = classAudioFiles.filter(f => !f.songId && f.type === 'raw');

        return {
          classId: classDetail.classId,
          className: classDetail.className,
          songs,
          rawFiles,
        };
      });

    // Determine overall mixing status (song-based)
    const allSongViews = classesWithAudio.flatMap(c => c.songs);
    const songsWithFinal = allSongViews.filter(s => s.finalMp3File || s.finalWavFile).length;

    let mixingStatus: EngineerMixingStatus = 'pending';
    if (allSongViews.length > 0 && songsWithFinal === allSongViews.length) {
      mixingStatus = 'completed';
    } else if (songsWithFinal > 0) {
      mixingStatus = 'in-progress';
    }

    // Schulsong-only override
    if (schulsongClassView && classesWithAudio.length === 0) {
      const hasSchulsongFinal = !!(schulsongClassView.finalMp3File || schulsongClassView.finalWavFile);
      if (hasSchulsongFinal) {
        mixingStatus = 'completed';
      } else if (schulsongClassView.rawFiles.length > 0) {
        mixingStatus = 'in-progress';
      }
    }

    // Extract logic project files from the unfiltered list (visible to all engineers)
    const logicProjects: LogicProjectInfo[] = allAudioFiles
      .filter(f => f.type === 'logic-project-schulsong' || f.type === 'logic-project-minimusiker')
      .map(f => ({
        projectType: f.type === 'logic-project-schulsong' ? 'schulsong' as const : 'minimusiker' as const,
        filename: f.filename,
        fileSizeBytes: f.fileSizeBytes,
        uploadedAt: f.uploadedAt,
      }));

    const response: EngineerEventDetail = {
      eventId: event.eventId,
      schoolName: event.schoolName,
      eventDate: event.eventDate,
      eventType: event.eventType,
      classes: classesWithAudio,
      mixingStatus,
      isSchulsong: event.isSchulsong,
      schulsongClass: schulsongClassView,
      audioPipelineStage: event.audioPipelineStage as EngineerEventDetail['audioPipelineStage'],
      logicProjects: logicProjects.length > 0 ? logicProjects : undefined,
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
