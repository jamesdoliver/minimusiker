import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getTeacherRepresentative } from '@/lib/services/representativeService';

export const dynamic = 'force-dynamic';

/**
 * GET /api/teacher/representative
 * Get the assigned Minimusiker representative for the authenticated teacher
 *
 * Assignment logic:
 * - Match teacher's region with Personen.teams_regionen
 * - Filter Personen by "team" role
 * - Return first matching active team member
 * - If no match, return default "Minimusiker Team" profile
 */
export async function GET(request: NextRequest) {
  try {
    // Verify teacher session
    const session = verifyTeacherSession(request);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get teacher's assigned representative
    const representative = await getTeacherRepresentative(session.email);

    if (!representative) {
      // Return default representative if no match found
      return NextResponse.json({
        success: true,
        representative: {
          id: 'default',
          name: 'Minimusiker Team',
          email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'info@minimusiker.de',
          phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+49 XXX XXXXXXX',
          bio: 'Hallo! Wir freuen uns sehr auf den Minimusikertag bei euch. Das Minimusiker-Team steht euch jederzeit mit Rat und Tat zur Seite.',
          profilePhotoUrl: null,
          region: 'Default',
        },
      });
    }

    return NextResponse.json({
      success: true,
      representative,
    });
  } catch (error) {
    console.error('Error fetching teacher representative:', error);

    // Return default representative on error to avoid breaking the UI
    return NextResponse.json({
      success: true,
      representative: {
        id: 'default',
        name: 'Minimusiker Team',
        email: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'info@minimusiker.de',
        phone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || '+49 XXX XXXXXXX',
        bio: 'Hallo! Wir freuen uns sehr auf den Minimusikertag bei euch. Das Minimusiker-Team steht euch jederzeit mit Rat und Tat zur Seite.',
        profilePhotoUrl: null,
        region: 'Default',
      },
    });
  }
}
