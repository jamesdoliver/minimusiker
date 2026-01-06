import { NextRequest, NextResponse } from 'next/server';
import { verifyTeacherSession } from '@/lib/auth/verifyTeacherSession';
import { getR2Service } from '@/lib/services/r2Service';
import { getAirtableService } from '@/lib/services/airtableService';

// Allowed MIME types for logo upload
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * GET /api/teacher/school/logo
 * Get the current school logo URL for the authenticated teacher
 */
export async function GET(request: NextRequest) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Find Einrichtung for this teacher
    const einrichtung = await getAirtableService().getEinrichtungForTeacher(
      session.email,
      session.schoolName
    );

    if (!einrichtung) {
      return NextResponse.json({
        success: true,
        logoUrl: null,
        einrichtungId: null,
        schoolName: session.schoolName,
        message: 'Keine Einrichtung gefunden',
      });
    }

    // If we have a stored logo URL in Airtable, generate a fresh signed URL
    let logoUrl = null;
    if (einrichtung.logoUrl) {
      // Try to get a fresh signed URL from R2
      const r2Service = getR2Service();
      logoUrl = await r2Service.getLogoUrl(einrichtung.id);
    }

    return NextResponse.json({
      success: true,
      logoUrl,
      einrichtungId: einrichtung.id,
      schoolName: einrichtung.customerName,
    });
  } catch (error) {
    console.error('Error fetching school logo:', error);
    return NextResponse.json(
      { error: 'Fehler beim Laden des Logos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teacher/school/logo
 * Generate presigned URL for uploading a school logo
 *
 * Request body: { filename: string, contentType: string, fileSize: number }
 * Response: { uploadUrl: string, r2Key: string, einrichtungId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { filename, contentType, fileSize } = await request.json();

    // Validate request
    if (!filename || !contentType) {
      return NextResponse.json(
        { error: 'Dateiname und Dateityp sind erforderlich' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(contentType.toLowerCase())) {
      return NextResponse.json(
        { error: 'Nur PNG, JPG und WebP Bilder sind erlaubt' },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Die Datei darf maximal 5MB groß sein' },
        { status: 400 }
      );
    }

    // Find or create Einrichtung for this teacher
    const einrichtung = await getAirtableService().findOrCreateEinrichtung(
      session.schoolName,
      session.email
    );

    // Generate presigned upload URL
    const r2Service = getR2Service();
    const { uploadUrl, key } = await r2Service.generateLogoUploadUrl(
      einrichtung.id,
      filename,
      contentType
    );

    return NextResponse.json({
      success: true,
      uploadUrl,
      r2Key: key,
      einrichtungId: einrichtung.id,
    });
  } catch (error) {
    console.error('Error generating logo upload URL:', error);
    return NextResponse.json(
      { error: 'Fehler beim Erstellen der Upload-URL' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/teacher/school/logo
 * Confirm logo upload and update Airtable record
 *
 * Request body: { r2Key: string, einrichtungId: string }
 * Response: { success: boolean, logoUrl: string }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    const { r2Key, einrichtungId } = await request.json();

    if (!r2Key || !einrichtungId) {
      return NextResponse.json(
        { error: 'r2Key und einrichtungId sind erforderlich' },
        { status: 400 }
      );
    }

    // Verify the file was uploaded to R2
    const r2Service = getR2Service();
    const fileExists = await r2Service.fileExists(r2Key);
    if (!fileExists) {
      return NextResponse.json(
        { error: 'Datei nicht gefunden. Der Upload ist möglicherweise fehlgeschlagen.' },
        { status: 400 }
      );
    }

    // Get signed URL for the logo
    const logoUrl = await r2Service.getLogoUrlByKey(r2Key);
    if (!logoUrl) {
      return NextResponse.json(
        { error: 'Fehler beim Generieren der Logo-URL' },
        { status: 500 }
      );
    }

    // Update Einrichtung record with logo URL
    // Store the R2 key as the URL (we'll generate fresh signed URLs when displaying)
    await getAirtableService().updateEinrichtungLogo(
      einrichtungId,
      r2Key, // Store key, not signed URL
      session.email
    );

    return NextResponse.json({
      success: true,
      logoUrl,
      message: 'Logo erfolgreich hochgeladen',
    });
  } catch (error) {
    console.error('Error confirming logo upload:', error);
    return NextResponse.json(
      { error: 'Fehler beim Speichern des Logos' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teacher/school/logo
 * Remove the school logo
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = verifyTeacherSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Nicht autorisiert' }, { status: 401 });
    }

    // Find Einrichtung for this teacher
    const einrichtung = await getAirtableService().getEinrichtungForTeacher(
      session.email,
      session.schoolName
    );

    if (!einrichtung) {
      return NextResponse.json(
        { error: 'Keine Einrichtung gefunden' },
        { status: 404 }
      );
    }

    // Delete logo from R2
    const r2Service = getR2Service();
    await r2Service.deleteLogo(einrichtung.id);

    // Clear logo URL in Airtable
    await getAirtableService().clearEinrichtungLogo(einrichtung.id);

    return NextResponse.json({
      success: true,
      message: 'Logo erfolgreich gelöscht',
    });
  } catch (error) {
    console.error('Error deleting school logo:', error);
    return NextResponse.json(
      { error: 'Fehler beim Löschen des Logos' },
      { status: 500 }
    );
  }
}
