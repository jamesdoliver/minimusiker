import { NextResponse } from 'next/server';
import { getAirtableService } from '@/lib/services/airtableService';
import { toDropboxDirectDownload } from '@/lib/types/teacher-resources';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/resources
 * Fetch all teacher resources with Dropbox download URLs
 */
export async function GET() {
  try {
    const airtableService = getAirtableService();
    const resources = await airtableService.getTeacherResources();

    // Transform Dropbox URLs to direct download links
    const transformedResources = resources.map((resource) => ({
      ...resource,
      pdfUrl: toDropboxDirectDownload(resource.pdfUrl),
    }));

    return NextResponse.json({
      success: true,
      resources: transformedResources,
    });
  } catch (error) {
    console.error('Error fetching teacher resources:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch resources' },
      { status: 500 }
    );
  }
}
