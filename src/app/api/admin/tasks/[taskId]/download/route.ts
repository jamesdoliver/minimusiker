import { NextRequest, NextResponse } from 'next/server';
import { getTaskService } from '@/lib/services/taskService';
import { getMasterCdService } from '@/lib/services/masterCdService';
import { requireAdmin } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/tasks/[taskId]/download
 * Returns signed R2 download URLs for all ready tracks on the Master CD.
 * The task must use the audio_master_cd template.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const [, authError] = requireAdmin(request);
    if (authError) return authError;

    const { taskId } = await params;
    const taskService = getTaskService();
    const task = await taskService.getTaskById(taskId);

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'Task not found' },
        { status: 404 }
      );
    }

    if (task.template_id !== 'audio_master_cd') {
      return NextResponse.json(
        { success: false, error: 'Task is not an audio_master_cd task' },
        { status: 400 }
      );
    }

    if (!task.event_id) {
      return NextResponse.json(
        { success: false, error: 'Task has no linked event' },
        { status: 400 }
      );
    }

    // Resolve the canonical event_id string from the Airtable record ID
    const airtable = getAirtableService();
    const event = await airtable.getEventById(task.event_id);
    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Linked event not found' },
        { status: 404 }
      );
    }

    const masterCdService = getMasterCdService();
    const tracks = await masterCdService.getDownloadUrls(event.event_id);

    return NextResponse.json({ success: true, data: { tracks } });
  } catch (error) {
    console.error('Error fetching download URLs:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch download URLs' },
      { status: 500 }
    );
  }
}
