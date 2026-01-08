/**
 * Printable Generation Service
 *
 * Generates customized printables (flyers, posters, etc.) for each school event
 * by overlaying school name, event date, and logo onto base PDF templates.
 *
 * Dependencies:
 * - pdf-lib: PDF manipulation library
 * - r2Service: For fetching templates and uploading generated files
 *
 * Usage:
 * ```typescript
 * const printableService = getPrintableService();
 * await printableService.generateAllPrintables(eventId, schoolName, eventDate, logoBuffer);
 * ```
 */

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import {
  getR2Service,
  type PrintableType,
  type MockupType,
  type TemplateType,
  R2_PATHS,
} from './r2Service';
import {
  PRINTABLE_CONFIGS,
  MOCKUP_CONFIGS,
  formatGermanDate,
  printableRequiresLogo,
  type TextPlacement,
  type ImagePlacement,
} from '../config/printableConfig';

// Result type for generation operations
export interface GenerationResult {
  success: boolean;
  type: PrintableType | MockupType;
  key?: string;
  error?: string;
}

// Result type for batch generation
export interface BatchGenerationResult {
  success: boolean;
  eventId: string;
  results: GenerationResult[];
  errors: string[];
}

class PrintableService {
  private r2Service = getR2Service();

  /**
   * Generate all printables and mockups for an event
   *
   * @param eventId - The event ID
   * @param schoolName - The school name to display
   * @param eventDate - The event date (ISO string)
   * @param logoBuffer - Optional logo image buffer for minicard/cd-jacket
   */
  async generateAllPrintables(
    eventId: string,
    schoolName: string,
    eventDate: string,
    logoBuffer?: Buffer
  ): Promise<BatchGenerationResult> {
    const results: GenerationResult[] = [];
    const errors: string[] = [];

    // Generate all flyers
    const flyerResults = await this.generateFlyers(eventId, schoolName, eventDate);
    results.push(...flyerResults);

    // Generate poster
    const posterResult = await this.generatePrintable(eventId, 'poster', schoolName, eventDate);
    results.push(posterResult);

    // Generate t-shirt print
    const tshirtResult = await this.generatePrintable(eventId, 'tshirt-print', schoolName, eventDate);
    results.push(tshirtResult);

    // Generate hoodie print
    const hoodieResult = await this.generatePrintable(eventId, 'hoodie-print', schoolName, eventDate);
    results.push(hoodieResult);

    // Generate minicard (requires logo)
    const minicardResult = await this.generateMinicard(eventId, schoolName, eventDate, logoBuffer);
    results.push(minicardResult);

    // Generate CD jacket (requires logo)
    const cdJacketResult = await this.generateCdJacket(eventId, schoolName, eventDate, logoBuffer);
    results.push(cdJacketResult);

    // Generate mockups
    const mockupResults = await this.generateMockups(eventId, schoolName);
    results.push(...mockupResults);

    // Collect errors
    for (const result of results) {
      if (!result.success && result.error) {
        errors.push(`${result.type}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      eventId,
      results,
      errors,
    };
  }

  /**
   * Generate all three flyer variants
   */
  async generateFlyers(
    eventId: string,
    schoolName: string,
    eventDate: string
  ): Promise<GenerationResult[]> {
    const flyerTypes: PrintableType[] = ['flyer1', 'flyer2', 'flyer3'];
    const results: GenerationResult[] = [];

    for (const type of flyerTypes) {
      const result = await this.generatePrintable(eventId, type, schoolName, eventDate);
      results.push(result);
    }

    return results;
  }

  /**
   * Generate a single printable (without logo)
   */
  async generatePrintable(
    eventId: string,
    type: PrintableType,
    schoolName: string,
    eventDate: string
  ): Promise<GenerationResult> {
    try {
      // Check if this type requires a logo
      if (printableRequiresLogo(type)) {
        return {
          success: false,
          type,
          error: `${type} requires a logo. Use generateMinicard or generateCdJacket instead.`,
        };
      }

      // Fetch the template
      const templateBuffer = await this.r2Service.getTemplate(type);
      if (!templateBuffer) {
        return {
          success: false,
          type,
          error: `Template not found: ${type}. Please upload template to R2.`,
        };
      }

      // Load the PDF
      const pdfDoc = await PDFDocument.load(templateBuffer);
      const config = PRINTABLE_CONFIGS[type];

      // Add school name and event date
      await this.addTextToPdf(pdfDoc, schoolName, config.schoolName);
      await this.addTextToPdf(pdfDoc, formatGermanDate(eventDate), config.eventDate);

      // Save the modified PDF
      const pdfBytes = await pdfDoc.save();
      const buffer = Buffer.from(pdfBytes);

      // Upload to R2
      const uploadResult = await this.r2Service.uploadPrintable(eventId, type, buffer);

      if (!uploadResult.success) {
        return {
          success: false,
          type,
          error: uploadResult.error || 'Failed to upload printable',
        };
      }

      return {
        success: true,
        type,
        key: uploadResult.key,
      };
    } catch (error) {
      console.error(`Error generating ${type}:`, error);
      return {
        success: false,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate minicard (includes logo)
   */
  async generateMinicard(
    eventId: string,
    schoolName: string,
    eventDate: string,
    logoBuffer?: Buffer
  ): Promise<GenerationResult> {
    return this.generatePrintableWithLogo(eventId, 'minicard', schoolName, eventDate, logoBuffer);
  }

  /**
   * Generate CD jacket (includes logo)
   */
  async generateCdJacket(
    eventId: string,
    schoolName: string,
    eventDate: string,
    logoBuffer?: Buffer
  ): Promise<GenerationResult> {
    return this.generatePrintableWithLogo(eventId, 'cd-jacket', schoolName, eventDate, logoBuffer);
  }

  /**
   * Generate a printable that includes a logo
   */
  private async generatePrintableWithLogo(
    eventId: string,
    type: 'minicard' | 'cd-jacket',
    schoolName: string,
    eventDate: string,
    logoBuffer?: Buffer
  ): Promise<GenerationResult> {
    try {
      // Fetch the template
      const templateBuffer = await this.r2Service.getTemplate(type);
      if (!templateBuffer) {
        return {
          success: false,
          type,
          error: `Template not found: ${type}. Please upload template to R2.`,
        };
      }

      // Load the PDF
      const pdfDoc = await PDFDocument.load(templateBuffer);
      const config = PRINTABLE_CONFIGS[type];

      // Add school name and event date
      await this.addTextToPdf(pdfDoc, schoolName, config.schoolName);
      await this.addTextToPdf(pdfDoc, formatGermanDate(eventDate), config.eventDate);

      // Add logo if provided and config has logo placement
      if (logoBuffer && config.logo) {
        await this.addImageToPdf(pdfDoc, logoBuffer, config.logo);
      } else if (!logoBuffer) {
        console.warn(`No logo provided for ${type}, generating without logo`);
      }

      // Save the modified PDF
      const pdfBytes = await pdfDoc.save();
      const buffer = Buffer.from(pdfBytes);

      // Upload to R2
      const uploadResult = await this.r2Service.uploadPrintable(eventId, type, buffer);

      if (!uploadResult.success) {
        return {
          success: false,
          type,
          error: uploadResult.error || 'Failed to upload printable',
        };
      }

      return {
        success: true,
        type,
        key: uploadResult.key,
      };
    } catch (error) {
      console.error(`Error generating ${type}:`, error);
      return {
        success: false,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate both mockups (t-shirt and hoodie previews)
   */
  async generateMockups(
    eventId: string,
    schoolName: string
  ): Promise<GenerationResult[]> {
    const mockupTypes: MockupType[] = ['mock-tshirt', 'mock-hoodie'];
    const results: GenerationResult[] = [];

    for (const type of mockupTypes) {
      const result = await this.generateMockup(eventId, type, schoolName);
      results.push(result);
    }

    return results;
  }

  /**
   * Generate a single mockup
   */
  async generateMockup(
    eventId: string,
    type: MockupType,
    schoolName: string
  ): Promise<GenerationResult> {
    try {
      // Fetch the template
      const templateBuffer = await this.r2Service.getTemplate(type);
      if (!templateBuffer) {
        return {
          success: false,
          type,
          error: `Template not found: ${type}. Please upload template to R2.`,
        };
      }

      // Load the PDF
      const pdfDoc = await PDFDocument.load(templateBuffer);
      const config = MOCKUP_CONFIGS[type];

      // Add school name only (mockups don't have dates)
      await this.addTextToPdf(pdfDoc, schoolName, config.schoolName);

      // Save the modified PDF
      const pdfBytes = await pdfDoc.save();
      const buffer = Buffer.from(pdfBytes);

      // Upload to R2
      const uploadResult = await this.r2Service.uploadMockup(eventId, type, buffer);

      if (!uploadResult.success) {
        return {
          success: false,
          type,
          error: uploadResult.error || 'Failed to upload mockup',
        };
      }

      return {
        success: true,
        type,
        key: uploadResult.key,
      };
    } catch (error) {
      console.error(`Error generating mockup ${type}:`, error);
      return {
        success: false,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Regenerate all printables for an event
   * Fetches current data from the event and regenerates everything
   *
   * @param eventId - The event ID
   * @param schoolName - The school name
   * @param eventDate - The event date
   * @param logoBuffer - Optional logo buffer
   */
  async regeneratePrintables(
    eventId: string,
    schoolName: string,
    eventDate: string,
    logoBuffer?: Buffer
  ): Promise<BatchGenerationResult> {
    // Simply call generateAllPrintables - it will overwrite existing files
    return this.generateAllPrintables(eventId, schoolName, eventDate, logoBuffer);
  }

  /**
   * Regenerate only printables that include a logo (minicard, cd-jacket)
   * Used when school logo changes
   */
  async regenerateLogoPrintables(
    eventId: string,
    schoolName: string,
    eventDate: string,
    logoBuffer: Buffer
  ): Promise<GenerationResult[]> {
    const results: GenerationResult[] = [];

    const minicardResult = await this.generateMinicard(eventId, schoolName, eventDate, logoBuffer);
    results.push(minicardResult);

    const cdJacketResult = await this.generateCdJacket(eventId, schoolName, eventDate, logoBuffer);
    results.push(cdJacketResult);

    return results;
  }

  // ========================================
  // PDF Manipulation Helpers
  // ========================================

  /**
   * Add text to a PDF at the specified position
   */
  private async addTextToPdf(
    pdfDoc: PDFDocument,
    text: string,
    placement: TextPlacement
  ): Promise<void> {
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      throw new Error('PDF has no pages');
    }

    const firstPage = pages[0];

    // Embed a standard font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Use bold font for larger text (likely titles)
    const useFont = placement.fontSize >= 20 ? boldFont : font;

    // Calculate text width for alignment
    const textWidth = useFont.widthOfTextAtSize(text, placement.fontSize);

    // Calculate x position based on alignment
    let xPos = placement.x;
    if (placement.align === 'center') {
      xPos = placement.x - textWidth / 2;
    } else if (placement.align === 'right') {
      xPos = placement.x - textWidth;
    }

    // Get color (default to black)
    const color = placement.color
      ? rgb(placement.color.r, placement.color.g, placement.color.b)
      : rgb(0, 0, 0);

    // Draw the text
    firstPage.drawText(text, {
      x: xPos,
      y: placement.y,
      size: placement.fontSize,
      font: useFont,
      color,
    });
  }

  /**
   * Add an image to a PDF at the specified position
   */
  private async addImageToPdf(
    pdfDoc: PDFDocument,
    imageBuffer: Buffer,
    placement: ImagePlacement
  ): Promise<void> {
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      throw new Error('PDF has no pages');
    }

    const firstPage = pages[0];

    // Try to detect image type and embed accordingly
    let image;
    try {
      // Try PNG first
      image = await pdfDoc.embedPng(imageBuffer);
    } catch {
      try {
        // Fall back to JPG
        image = await pdfDoc.embedJpg(imageBuffer);
      } catch {
        console.error('Could not embed image - unsupported format');
        return;
      }
    }

    // Calculate dimensions based on fit mode
    let drawWidth = placement.width;
    let drawHeight = placement.height;

    if (placement.fit === 'contain') {
      // Scale to fit within bounds while maintaining aspect ratio
      const imageAspect = image.width / image.height;
      const boxAspect = placement.width / placement.height;

      if (imageAspect > boxAspect) {
        // Image is wider than box - fit to width
        drawWidth = placement.width;
        drawHeight = placement.width / imageAspect;
      } else {
        // Image is taller than box - fit to height
        drawHeight = placement.height;
        drawWidth = placement.height * imageAspect;
      }
    }

    // Draw the image
    firstPage.drawImage(image, {
      x: placement.x,
      y: placement.y,
      width: drawWidth,
      height: drawHeight,
    });
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Check if all required templates exist
   * Returns list of missing templates
   */
  async checkTemplatesAvailability(): Promise<{
    available: TemplateType[];
    missing: TemplateType[];
  }> {
    const status = await this.r2Service.getTemplatesStatus();

    const available: TemplateType[] = [];
    const missing: TemplateType[] = [];

    for (const [type, exists] of Object.entries(status)) {
      if (exists) {
        available.push(type as TemplateType);
      } else {
        missing.push(type as TemplateType);
      }
    }

    return { available, missing };
  }

  /**
   * Get logo buffer from event folder
   * Tries to fetch from events/{eventId}/printables/logo/
   */
  async getEventLogo(eventId: string): Promise<Buffer | null> {
    const extensions = ['png', 'jpg', 'jpeg', 'webp'];

    for (const ext of extensions) {
      const key = `${R2_PATHS.EVENT_PRINTABLES_LOGO(eventId)}/logo.${ext}`;
      const exists = await this.r2Service.fileExistsInAssetsBucket(key);

      if (exists) {
        return this.r2Service.getFileBufferFromAssetsBucket(key);
      }
    }

    return null;
  }
}

// Export singleton instance
let printableServiceInstance: PrintableService | null = null;

export function getPrintableService(): PrintableService {
  if (!printableServiceInstance) {
    printableServiceInstance = new PrintableService();
  }
  return printableServiceInstance;
}

export default PrintableService;
