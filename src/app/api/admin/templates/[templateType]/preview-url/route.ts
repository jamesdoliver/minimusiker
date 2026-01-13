import { NextRequest, NextResponse } from 'next/server';
import { getR2Service, TemplateType, TEMPLATE_FILENAMES } from '@/lib/services/r2Service';
import { getPrintableConfig, PrintableItemType } from '@/lib/config/printableTextConfig';

/**
 * GET /api/admin/templates/[templateType]/preview-url
 *
 * Returns a signed URL for fetching a template PDF from R2
 * Used by the browser-side PDF.js renderer in the printables editor
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateType: string }> }
) {
  const resolvedParams = await params;
  const { templateType } = resolvedParams;

  // Map PrintableItemType to TemplateType
  // PrintableItemType uses 'tshirt' but TemplateType uses 'tshirt-print'
  const templateTypeMap: Record<PrintableItemType, TemplateType> = {
    'tshirt': 'tshirt-print',
    'hoodie': 'hoodie-print',
    'flyer1': 'flyer1',
    'flyer1-back': 'flyer1-back',
    'flyer2': 'flyer2',
    'flyer2-back': 'flyer2-back',
    'flyer3': 'flyer3',
    'flyer3-back': 'flyer3-back',
    'button': 'button',
    'minicard': 'minicard',
    'cd-jacket': 'cd-jacket',
  };

  // Check if this is a valid printable item type
  const printableConfig = getPrintableConfig(templateType as PrintableItemType);
  if (!printableConfig) {
    return NextResponse.json(
      { success: false, error: `Invalid template type: ${templateType}` },
      { status: 400 }
    );
  }

  // Get the corresponding R2 template type
  const r2TemplateType = templateTypeMap[templateType as PrintableItemType];
  if (!r2TemplateType || !TEMPLATE_FILENAMES[r2TemplateType]) {
    return NextResponse.json(
      { success: false, error: `Unknown template type: ${templateType}` },
      { status: 400 }
    );
  }

  try {
    const r2Service = getR2Service();

    // Get signed URL for the template
    const { url, exists } = await r2Service.getTemplateSignedUrl(r2TemplateType);

    return NextResponse.json({
      success: true,
      url,
      exists,
      templateType: r2TemplateType,
      dimensions: printableConfig.pdfDimensions,
    });
  } catch (error) {
    console.error('Error getting template preview URL:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
