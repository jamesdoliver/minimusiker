import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { verifyEngineerSession } from '@/lib/auth/verifyEngineerSession';
import airtableService from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';
import { getR2Service } from '@/lib/services/r2Service';

/**
 * GET /api/engineer/events/[eventId]/download-zip
 * Download all raw audio files as a ZIP
 * Optional query param: classId - filter to specific class
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
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');

    // Verify engineer is assigned to this event
    const isAssigned = await airtableService.isEngineerAssignedToEvent(
      session.engineerId,
      eventId
    );

    if (!isAssigned) {
      return NextResponse.json(
        { error: 'You are not assigned to this event' },
        { status: 403 }
      );
    }

    // Get event details for filename
    const eventDetail = await airtableService.getSchoolEventDetail(eventId);
    if (!eventDetail) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Get audio files
    const teacherService = getTeacherService();
    let audioFiles = await teacherService.getAudioFilesByEventId(eventId);

    // Filter to raw files only
    audioFiles = audioFiles.filter((f) => f.type === 'raw');

    // Filter by class if specified
    if (classId) {
      audioFiles = audioFiles.filter((f) => f.classId === classId);
    }

    if (audioFiles.length === 0) {
      return NextResponse.json(
        { error: 'No raw audio files found' },
        { status: 404 }
      );
    }

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 5 }, // Balanced compression
    });

    // Create a readable stream from the archive
    const chunks: Uint8Array[] = [];

    archive.on('data', (chunk) => {
      chunks.push(chunk);
    });

    // Get R2 service
    const r2Service = getR2Service();

    // Get class info for folder structure
    const classMap = new Map<string, string>();
    eventDetail.classes.forEach((cls) => {
      classMap.set(cls.classId, cls.className);
    });

    // Add files to archive
    for (const file of audioFiles) {
      try {
        const buffer = await r2Service.getFileBuffer(file.r2Key);
        if (buffer) {
          // Create path: ClassName/filename
          const className = classMap.get(file.classId) || file.classId;
          const safeName = className
            .replace(/[^a-zA-Z0-9-_\s]/g, '')
            .replace(/\s+/g, '_');
          const filePath = `${safeName}/${file.filename}`;
          archive.append(buffer, { name: filePath });
        }
      } catch (err) {
        console.error(`Error adding file ${file.r2Key} to ZIP:`, err);
        // Continue with other files
      }
    }

    // Finalize the archive
    await archive.finalize();

    // Wait for all data to be collected
    await new Promise<void>((resolve, reject) => {
      archive.on('end', resolve);
      archive.on('error', reject);
    });

    // Combine chunks into a single buffer
    const zipBuffer = Buffer.concat(chunks);

    // Generate filename
    const schoolSlug = eventDetail.schoolName
      .replace(/[^a-zA-Z0-9-_\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 30);
    const dateStr = eventDetail.eventDate || 'no-date';
    const filename = classId
      ? `${schoolSlug}_${classId}_raw_audio.zip`
      : `${schoolSlug}_${dateStr}_raw_audio.zip`;

    // Return ZIP file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error generating ZIP:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate ZIP',
      },
      { status: 500 }
    );
  }
}
