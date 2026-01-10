import { NextRequest, NextResponse } from 'next/server';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { calculateVideoFolder, getFolderLabel, type VideoFolder } from '@/lib/utils/weekCalculator';
import { parseVideoFilename, type TeacherVideo, type VideoFolderResponse } from '@/lib/types/teacher-videos';

export const dynamic = 'force-dynamic';

// Initialize S3 client for R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const ASSETS_BUCKET = process.env.R2_ASSETS_BUCKET_NAME || 'minimusiker-assets';
const VIDEOS_PREFIX = 'teacher-videos';

/**
 * GET /api/teacher/videos
 * List videos for a specific week or the current week based on event date
 *
 * Query params:
 * - eventDate: ISO date string of the event (required)
 * - folder: Optional explicit folder name (e.g., 'Week4', 'EventDay')
 *           If provided, fetches videos from that folder instead of calculating from eventDate
 */
export async function GET(request: NextRequest) {
  try {
    // Verify teacher session
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const eventDate = searchParams.get('eventDate');
    const folderParam = searchParams.get('folder') as VideoFolder | null;

    if (!eventDate) {
      return NextResponse.json(
        { success: false, error: 'eventDate is required' },
        { status: 400 }
      );
    }

    // Use explicit folder if provided, otherwise calculate from date
    let weekInfo;
    if (folderParam) {
      // Build weekInfo for explicit folder
      const weekNumber = folderParam.startsWith('Week')
        ? parseInt(folderParam.replace('Week', ''), 10)
        : null;
      weekInfo = {
        folder: folderParam,
        daysRemaining: 0, // Not relevant for explicit folder fetches
        weekNumber,
        label: getFolderLabel(folderParam),
      };
    } else {
      weekInfo = calculateVideoFolder(eventDate);
    }

    const folderPath = `${VIDEOS_PREFIX}/${weekInfo.folder}/`;

    // List objects in the folder
    const listCommand = new ListObjectsV2Command({
      Bucket: ASSETS_BUCKET,
      Prefix: folderPath,
    });

    const listResponse = await s3Client.send(listCommand);
    const objects = listResponse.Contents || [];

    // Filter for .mp4 files and generate signed URLs
    const videos: TeacherVideo[] = [];

    for (const obj of objects) {
      if (!obj.Key || !obj.Key.toLowerCase().endsWith('.mp4')) continue;

      const filename = obj.Key.split('/').pop() || '';
      const parsed = parseVideoFilename(filename, weekInfo.folder);

      // Generate signed URL (1 hour expiry)
      const getCommand = new GetObjectCommand({
        Bucket: ASSETS_BUCKET,
        Key: obj.Key,
      });
      const signedUrl = await getSignedUrl(s3Client, getCommand, {
        expiresIn: 3600,
      });

      videos.push({
        key: obj.Key,
        filename,
        url: signedUrl,
        title: parsed.title,
        description: parsed.description,
        isIntro: parsed.isIntro,
        order: parsed.order,
      });
    }

    // Sort videos: intro first, then by order number
    videos.sort((a, b) => {
      if (a.isIntro && !b.isIntro) return -1;
      if (!a.isIntro && b.isIntro) return 1;
      return a.order - b.order;
    });

    const response: VideoFolderResponse = {
      success: true,
      folder: weekInfo.folder,
      weekInfo,
      videos,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching teacher videos:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch videos',
        folder: '',
        weekInfo: null,
        videos: [],
      },
      { status: 500 }
    );
  }
}
