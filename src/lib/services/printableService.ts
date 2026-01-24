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
import QRCode from 'qrcode';
import {
  getR2Service,
  type PrintableType,
  type MockupType,
  type TemplateType,
  type FontName,
  R2_PATHS,
} from './r2Service';
import {
  PRINTABLE_CONFIGS,
  MOCKUP_CONFIGS,
  QR_CODE_CONFIGS,
  formatGermanDate,
  printableRequiresLogo,
  printableSupportsQrCode,
  printableIsBack,
  BLEED_MM,
  MM_TO_POINTS,
  PRODUCT_DIMENSIONS,
  PRINTABLE_FONTS,
  type TextPlacement,
  type ImagePlacement,
  type QrCodePlacement,
} from '../config/printableConfig';

// Result type for generation operations
export interface GenerationResult {
  success: boolean;
  type: PrintableType | MockupType;
  key?: string;
  error?: string;
}

// Config for a single text element (Phase 4)
export interface TextElementConfig {
  id: string;
  type: 'headline' | 'subline' | 'calendar' | 'custom';
  text: string;
  x: number;        // PDF coordinates
  y: number;        // PDF coordinates
  width: number;    // PDF points
  height: number;   // PDF points
  fontSize: number; // PDF points
  color: { r: number; g: number; b: number }; // RGB 0-1
}

// Config for each printable item from the editor (Phase 4)
export interface PrintableItemConfig {
  type: string;
  textElements: TextElementConfig[];  // Array of text elements
  qrPosition?: {
    x: number;
    y: number;
    size: number;
  };
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
  private fontCache: Map<FontName, Uint8Array> = new Map();

  // ========================================
  // Custom Font Loading
  // ========================================

  /**
   * Get a custom font from R2, with caching
   * Fonts are loaded once and reused for all subsequent PDF generations
   */
  private async getCustomFont(fontName: FontName): Promise<Uint8Array> {
    // Check cache first
    if (this.fontCache.has(fontName)) {
      return this.fontCache.get(fontName)!;
    }

    // Fetch from R2
    const buffer = await this.r2Service.getFont(fontName);
    if (!buffer) {
      throw new Error(`Font not found in R2: ${fontName}. Please upload the font file.`);
    }

    // Cache for future use
    const uint8Array = new Uint8Array(buffer);
    this.fontCache.set(fontName, uint8Array);

    console.log(`[PrintableService] Loaded and cached font: ${fontName}`);
    return uint8Array;
  }

  /**
   * Clear the font cache (useful for testing or when fonts are updated)
   */
  clearFontCache(): void {
    this.fontCache.clear();
    console.log('[PrintableService] Font cache cleared');
  }

  /**
   * Generate all printables and mockups for an event
   *
   * @param eventId - The event ID
   * @param schoolName - The school name to display
   * @param eventDate - The event date (ISO string)
   * @param logoBuffer - Optional logo image buffer for minicard/cd-jacket
   * @param qrCodeUrl - Optional URL for QR code (e.g., https://minimusiker.app/e/1562)
   */
  async generateAllPrintables(
    eventId: string,
    schoolName: string,
    eventDate: string,
    logoBuffer?: Buffer,
    qrCodeUrl?: string
  ): Promise<BatchGenerationResult> {
    const results: GenerationResult[] = [];
    const errors: string[] = [];

    // Generate QR code buffer if URL is provided
    let qrCodeBuffer: Buffer | undefined;
    if (qrCodeUrl) {
      try {
        qrCodeBuffer = await this.generateQrCodeBuffer(qrCodeUrl);
      } catch (error) {
        console.warn('Failed to generate QR code:', error);
        // Continue without QR code
      }
    }

    // Generate all flyer fronts (with school name, date, and optional QR code)
    const flyerFrontResults = await this.generateFlyers(eventId, schoolName, eventDate, qrCodeBuffer, qrCodeUrl);
    results.push(...flyerFrontResults);

    // Generate all flyer backs (QR code only - no school name/date)
    const flyerBackResults = await this.generateFlyerBacks(eventId, qrCodeBuffer, qrCodeUrl);
    results.push(...flyerBackResults);

    // Generate button (no QR code - circular 38mm)
    const buttonResult = await this.generatePrintable(eventId, 'button', schoolName, eventDate);
    results.push(buttonResult);

    // Generate t-shirt print (no QR code)
    const tshirtResult = await this.generatePrintable(eventId, 'tshirt-print', schoolName, eventDate);
    results.push(tshirtResult);

    // Generate hoodie print (no QR code)
    const hoodieResult = await this.generatePrintable(eventId, 'hoodie-print', schoolName, eventDate);
    results.push(hoodieResult);

    // Generate minicard (requires logo, no QR code)
    const minicardResult = await this.generateMinicard(eventId, schoolName, eventDate, logoBuffer);
    results.push(minicardResult);

    // Generate CD jacket (requires logo, no QR code)
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

    // Success is true if ANY items succeeded (partial success is still success)
    const anySucceeded = results.some(r => r.success);

    return {
      success: anySucceeded,
      eventId,
      results,
      errors,
    };
  }

  /**
   * Generate all printables using custom positions from the editor (Phase 3)
   *
   * @param eventId - The event ID
   * @param schoolName - The school name (used as fallback)
   * @param eventDate - The event date (ISO string)
   * @param itemConfigs - Array of item configs with custom positions from the editor
   * @param logoBuffer - Optional logo image buffer for minicard/cd-jacket
   * @param qrCodeUrl - Optional URL for QR code
   */
  async generateAllPrintablesWithConfigs(
    eventId: string,
    schoolName: string,
    eventDate: string,
    itemConfigs: PrintableItemConfig[],
    logoBuffer?: Buffer,
    qrCodeUrl?: string
  ): Promise<BatchGenerationResult> {
    const results: GenerationResult[] = [];
    const errors: string[] = [];

    // Generate QR code buffer if URL is provided
    let qrCodeBuffer: Buffer | undefined;
    if (qrCodeUrl) {
      try {
        qrCodeBuffer = await this.generateQrCodeBuffer(qrCodeUrl);
      } catch (error) {
        console.warn('Failed to generate QR code:', error);
      }
    }

    // Process each item config
    for (const itemConfig of itemConfigs) {
      const type = itemConfig.type as PrintableType;

      try {
        // Skip back items with missing QR code
        if (printableIsBack(type) && !qrCodeBuffer) {
          console.warn(`[PrintableService] Skipping ${type} - no QR code available`);
          results.push({
            success: false,
            type,
            error: 'No QR code available for back side',
          });
          continue;
        }

        // Fetch the template
        const templateBuffer = await this.r2Service.getTemplate(type);
        if (!templateBuffer) {
          results.push({
            success: false,
            type,
            error: `Template not found: ${type}. Please upload template to R2.`,
          });
          continue;
        }

        // Load the PDF
        const pdfDoc = await PDFDocument.load(templateBuffer);

        // For back items - only add QR code at custom position
        if (printableIsBack(type)) {
          if (qrCodeBuffer && itemConfig.qrPosition) {
            await this.addQrCodeAtPosition(
              pdfDoc,
              qrCodeBuffer,
              itemConfig.qrPosition,
              type,
              qrCodeUrl
            );
          }
        } else {
          // For front items - add all text elements
          for (const textElement of itemConfig.textElements) {
            await this.addTextElementToPdf(pdfDoc, textElement, type);
          }

          // Add QR code if this item has one (front items with QR)
          if (qrCodeBuffer && itemConfig.qrPosition) {
            await this.addQrCodeAtPosition(
              pdfDoc,
              qrCodeBuffer,
              itemConfig.qrPosition,
              type,
              qrCodeUrl
            );
          }
        }

        // Add logo if this type requires it
        if (printableRequiresLogo(type) && logoBuffer) {
          const config = PRINTABLE_CONFIGS[type];
          if (config?.logo) {
            await this.addImageToPdf(pdfDoc, logoBuffer, config.logo);
          }
        }

        // Add bleed margins
        const bleedMm = this.getBleedForType(type);
        const finalDoc = await this.addBleedToDocument(pdfDoc, bleedMm);

        // Save and upload
        const pdfBytes = await finalDoc.save();
        const buffer = Buffer.from(pdfBytes);
        const uploadResult = await this.r2Service.uploadPrintable(eventId, type, buffer);

        if (!uploadResult.success) {
          results.push({
            success: false,
            type,
            error: uploadResult.error || 'Failed to upload printable',
          });
        } else {
          results.push({
            success: true,
            type,
            key: uploadResult.key,
          });
        }
      } catch (error) {
        console.error(`Error generating ${type}:`, error);
        results.push({
          success: false,
          type,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Generate mockups (still use default positions for mockups)
    const mockupResults = await this.generateMockups(eventId, schoolName);
    results.push(...mockupResults);

    // Collect errors
    for (const result of results) {
      if (!result.success && result.error) {
        errors.push(`${result.type}: ${result.error}`);
      }
    }

    // Success is true if ANY items succeeded (partial success is still success)
    const anySucceeded = results.some(r => r.success);

    return {
      success: anySucceeded,
      eventId,
      results,
      errors,
    };
  }

  /**
   * Generate a single printable preview and return the PDF buffer
   * Used by the preview API to let admins download previews before confirming
   *
   * @param eventId - The event ID
   * @param schoolName - The school name (used as fallback)
   * @param eventDate - The event date (ISO string)
   * @param itemConfig - Single item config with custom positions from the editor
   * @param logoBuffer - Optional logo image buffer for minicard/cd-jacket
   * @param qrCodeUrl - Optional URL for QR code
   * @returns Object with success status, PDF buffer, and optional error
   */
  async generateSinglePrintablePreview(
    eventId: string,
    schoolName: string,
    eventDate: string,
    itemConfig: PrintableItemConfig,
    logoBuffer?: Buffer,
    qrCodeUrl?: string
  ): Promise<{ success: boolean; pdfBuffer?: Buffer; error?: string }> {
    const type = itemConfig.type as PrintableType;

    // Generate QR code buffer if URL is provided
    let qrCodeBuffer: Buffer | undefined;
    if (qrCodeUrl) {
      try {
        qrCodeBuffer = await this.generateQrCodeBuffer(qrCodeUrl);
      } catch (error) {
        console.warn('Failed to generate QR code for preview:', error);
      }
    }

    try {
      // Skip back items with missing QR code
      if (printableIsBack(type) && !qrCodeBuffer) {
        return {
          success: false,
          error: 'No QR code available for back side',
        };
      }

      // Fetch the template
      const templateBuffer = await this.r2Service.getTemplate(type);
      if (!templateBuffer) {
        return {
          success: false,
          error: `Template not found: ${type}. Please upload template to R2.`,
        };
      }

      // Load the PDF
      const pdfDoc = await PDFDocument.load(templateBuffer);

      // For back items - only add QR code at custom position
      if (printableIsBack(type)) {
        if (qrCodeBuffer && itemConfig.qrPosition) {
          await this.addQrCodeAtPosition(
            pdfDoc,
            qrCodeBuffer,
            itemConfig.qrPosition,
            type,
            qrCodeUrl
          );
        }
      } else {
        // For front items - add all text elements
        for (const textElement of itemConfig.textElements) {
          await this.addTextElementToPdf(pdfDoc, textElement, type);
        }

        // Add QR code if this item has one (front items with QR)
        if (qrCodeBuffer && itemConfig.qrPosition) {
          await this.addQrCodeAtPosition(
            pdfDoc,
            qrCodeBuffer,
            itemConfig.qrPosition,
            type,
            qrCodeUrl
          );
        }
      }

      // Add logo if this type requires it
      if (printableRequiresLogo(type) && logoBuffer) {
        const config = PRINTABLE_CONFIGS[type];
        if (config?.logo) {
          await this.addImageToPdf(pdfDoc, logoBuffer, config.logo);
        }
      }

      // Add bleed margins
      const bleedMm = this.getBleedForType(type);
      const finalDoc = await this.addBleedToDocument(pdfDoc, bleedMm);

      // Save and return buffer
      const pdfBytes = await finalDoc.save();
      const pdfBuffer = Buffer.from(pdfBytes);

      return {
        success: true,
        pdfBuffer,
      };
    } catch (error) {
      console.error(`Error generating preview for ${type}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Add a single text element to PDF (Phase 4)
   * Used by generateAllPrintablesWithConfigs to render each text element
   * with its specific styling (position, size, color, font)
   */
  private async addTextElementToPdf(
    pdfDoc: PDFDocument,
    element: TextElementConfig,
    printableType: PrintableType
  ): Promise<void> {
    // Skip empty text
    if (!element.text || element.text.trim() === '') {
      return;
    }

    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      throw new Error('PDF has no pages');
    }

    const firstPage = pages[0];

    // Get the appropriate font based on printable type
    let useFont;
    if (PRINTABLE_FONTS[printableType]) {
      try {
        const fontName = PRINTABLE_FONTS[printableType];
        const fontData = await this.getCustomFont(fontName);
        useFont = await pdfDoc.embedFont(fontData);
      } catch (error) {
        console.warn(`Failed to load custom font for ${printableType}, using Helvetica:`, error);
        useFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      }
    } else {
      useFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

    // Use the element's color (already in RGB 0-1 format)
    const color = rgb(element.color.r, element.color.g, element.color.b);

    // Split text into lines for multiline support
    const lines = element.text.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return;

    // Calculate line height based on font size
    const lineHeight = element.fontSize * 1.2;

    // Calculate starting Y position to center text vertically in the box
    const totalTextHeight = lines.length * lineHeight;
    const startY = element.y + element.height / 2 + totalTextHeight / 2 - element.fontSize;

    // Draw each line
    lines.forEach((line, index) => {
      const textWidth = useFont.widthOfTextAtSize(line, element.fontSize);
      // Center each line horizontally within the text box
      const xPos = element.x + (element.width - textWidth) / 2;
      const yPos = startY - (index * lineHeight);

      firstPage.drawText(line, {
        x: xPos,
        y: yPos,
        size: element.fontSize,
        font: useFont,
        color,
      });
    });
  }

  /**
   * Add multiline text to PDF at a custom position (Phase 3)
   * Handles text with line breaks and centers each line
   */
  private async addMultilineTextToPdf(
    pdfDoc: PDFDocument,
    text: string,
    position: { x: number; y: number; width: number; height: number },
    fontSize: number,
    printableType: PrintableType
  ): Promise<void> {
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      throw new Error('PDF has no pages');
    }

    const firstPage = pages[0];

    // Get the appropriate font
    let useFont;
    if (PRINTABLE_FONTS[printableType]) {
      try {
        const fontName = PRINTABLE_FONTS[printableType];
        const fontData = await this.getCustomFont(fontName);
        useFont = await pdfDoc.embedFont(fontData);
      } catch (error) {
        console.warn(`Failed to load custom font for ${printableType}, using Helvetica:`, error);
        useFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      }
    } else {
      useFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

    // Get text color from config
    const config = PRINTABLE_CONFIGS[printableType];
    const colorConfig = config?.schoolName?.color;
    const color = colorConfig
      ? rgb(colorConfig.r, colorConfig.g, colorConfig.b)
      : rgb(0, 0, 0);

    // Split text into lines
    const lines = text.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return;

    // Calculate line height based on font size
    const lineHeight = fontSize * 1.2;

    // Calculate starting Y position to center text vertically in the box
    const totalTextHeight = lines.length * lineHeight;
    const startY = position.y + position.height / 2 + totalTextHeight / 2 - fontSize;

    // Draw each line
    lines.forEach((line, index) => {
      const textWidth = useFont.widthOfTextAtSize(line, fontSize);
      // Center each line horizontally within the text box
      const xPos = position.x + (position.width - textWidth) / 2;
      const yPos = startY - (index * lineHeight);

      firstPage.drawText(line, {
        x: xPos,
        y: yPos,
        size: fontSize,
        font: useFont,
        color,
      });
    });
  }

  /**
   * Add QR code at a custom position (Phase 3)
   */
  private async addQrCodeAtPosition(
    pdfDoc: PDFDocument,
    qrCodeBuffer: Buffer,
    position: { x: number; y: number; size: number },
    type: PrintableType,
    qrCodeUrl?: string
  ): Promise<void> {
    try {
      const qrImage = await pdfDoc.embedPng(qrCodeBuffer);
      const pages = pdfDoc.getPages();
      if (pages.length === 0) return;

      const page = pages[0];

      // Draw QR code at custom position
      page.drawImage(qrImage, {
        x: position.x,
        y: position.y,
        width: position.size,
        height: position.size,
      });

      // Add URL text below QR code if this is a back item
      if (printableIsBack(type) && qrCodeUrl) {
        const shortUrl = qrCodeUrl.replace('https://', '');
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const urlFontSize = Math.max(8, position.size / 12);
        const textWidth = font.widthOfTextAtSize(shortUrl, urlFontSize);

        page.drawText(shortUrl, {
          x: position.x + (position.size - textWidth) / 2,
          y: position.y - urlFontSize - 5,
          size: urlFontSize,
          font,
          color: rgb(0, 0, 0),
        });
      }
    } catch (error) {
      console.error('Error adding QR code at position:', error);
    }
  }

  /**
   * Generate a QR code as a PNG buffer
   */
  private async generateQrCodeBuffer(url: string): Promise<Buffer> {
    const qrCodeDataUrl = await QRCode.toDataURL(url, {
      width: 400,  // High resolution for print
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    // Convert data URL to buffer
    const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
    return Buffer.from(base64Data, 'base64');
  }

  /**
   * Generate all three flyer variants (front sides)
   */
  async generateFlyers(
    eventId: string,
    schoolName: string,
    eventDate: string,
    qrCodeBuffer?: Buffer,
    qrCodeUrl?: string
  ): Promise<GenerationResult[]> {
    const flyerTypes: PrintableType[] = ['flyer1', 'flyer2', 'flyer3'];
    const results: GenerationResult[] = [];

    for (const type of flyerTypes) {
      const result = await this.generatePrintable(eventId, type, schoolName, eventDate, qrCodeBuffer, qrCodeUrl);
      results.push(result);
    }

    return results;
  }

  /**
   * Generate all three flyer back sides
   * Backs only contain QR code and URL text - no school name or event date
   */
  async generateFlyerBacks(
    eventId: string,
    qrCodeBuffer?: Buffer,
    qrCodeUrl?: string
  ): Promise<GenerationResult[]> {
    const backTypes: PrintableType[] = ['flyer1-back', 'flyer2-back', 'flyer3-back'];
    const results: GenerationResult[] = [];

    for (const type of backTypes) {
      const result = await this.generateFlyerBack(eventId, type, qrCodeBuffer, qrCodeUrl);
      results.push(result);
    }

    return results;
  }

  /**
   * Generate a single flyer back
   * Backs only have QR code (centered, larger than front) - no text input from admin
   */
  private async generateFlyerBack(
    eventId: string,
    type: PrintableType,
    qrCodeBuffer?: Buffer,
    qrCodeUrl?: string
  ): Promise<GenerationResult> {
    try {
      // Verify this is a back type
      if (!printableIsBack(type)) {
        return {
          success: false,
          type,
          error: `${type} is not a back type. Use generatePrintable for front sides.`,
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

      // Add QR code if provided (backs always support QR codes)
      if (qrCodeBuffer) {
        await this.addQrCodeToPdf(pdfDoc, qrCodeBuffer, type, qrCodeUrl);
      } else {
        console.warn(`[PrintableService] No QR code provided for ${type}, generating without QR code`);
      }

      // Add bleed margins for print production
      const bleedMm = this.getBleedForType(type);
      const finalDoc = await this.addBleedToDocument(pdfDoc, bleedMm);

      // Save the modified PDF
      const pdfBytes = await finalDoc.save();
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
   * Generate a single printable (without logo)
   */
  async generatePrintable(
    eventId: string,
    type: PrintableType,
    schoolName: string,
    eventDate: string,
    qrCodeBuffer?: Buffer,
    qrCodeUrl?: string
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

      // Add school name and event date (using custom font for this printable type)
      await this.addTextToPdf(pdfDoc, schoolName, config.schoolName, type);
      await this.addTextToPdf(pdfDoc, formatGermanDate(eventDate), config.eventDate, type);

      // Add QR code if provided and this type supports it
      if (qrCodeBuffer && printableSupportsQrCode(type)) {
        await this.addQrCodeToPdf(pdfDoc, qrCodeBuffer, type, qrCodeUrl);
      }

      // Add bleed margins for print production
      const bleedMm = this.getBleedForType(type);
      const finalDoc = await this.addBleedToDocument(pdfDoc, bleedMm);

      // Save the modified PDF
      const pdfBytes = await finalDoc.save();
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
   * Add a QR code to a PDF document
   * Also adds URL text below the QR code if configured (for parents who can't scan)
   */
  private async addQrCodeToPdf(
    pdfDoc: PDFDocument,
    qrCodeBuffer: Buffer,
    type: PrintableType,
    qrCodeUrl?: string
  ): Promise<void> {
    const qrConfig = QR_CODE_CONFIGS[type];
    if (!qrConfig) {
      console.warn(`No QR code config for type: ${type}`);
      return;
    }

    try {
      // Embed the QR code image
      const qrImage = await pdfDoc.embedPng(qrCodeBuffer);

      // Get the first page
      const pages = pdfDoc.getPages();
      if (pages.length === 0) {
        console.warn('PDF has no pages');
        return;
      }

      const page = pages[0];

      // Draw the QR code
      page.drawImage(qrImage, {
        x: qrConfig.x,
        y: qrConfig.y,
        width: qrConfig.size,
        height: qrConfig.size,
      });

      // Add URL text below QR code if configured (for parents who can't scan)
      if (qrConfig.urlText && qrCodeUrl) {
        const shortUrl = qrCodeUrl.replace('https://', '');  // "minimusiker.app/e/1562"
        await this.addTextToPdf(pdfDoc, shortUrl, {
          x: qrConfig.urlText.x,
          y: qrConfig.urlText.y,
          fontSize: qrConfig.urlText.fontSize,
          color: qrConfig.urlText.color,
          align: qrConfig.urlText.align || 'center',
        }, type);  // Pass type to use custom font
      }
    } catch (error) {
      console.error('Error adding QR code to PDF:', error);
      // Don't throw - continue without QR code
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

      // Add school name and event date (using custom font for this printable type)
      await this.addTextToPdf(pdfDoc, schoolName, config.schoolName, type);
      await this.addTextToPdf(pdfDoc, formatGermanDate(eventDate), config.eventDate, type);

      // Add logo if provided and config has logo placement
      if (logoBuffer && config.logo) {
        await this.addImageToPdf(pdfDoc, logoBuffer, config.logo);
      } else if (!logoBuffer) {
        console.warn(`No logo provided for ${type}, generating without logo`);
      }

      // Add bleed margins for print production
      const bleedMm = this.getBleedForType(type);
      const finalDoc = await this.addBleedToDocument(pdfDoc, bleedMm);

      // Save the modified PDF
      const pdfBytes = await finalDoc.save();
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

      // Map mockup type to corresponding printable type for font lookup
      const printableTypeForFont: PrintableType = type === 'mock-tshirt' ? 'tshirt-print' : 'hoodie-print';

      // Add school name only (mockups don't have dates, but use same font as prints)
      await this.addTextToPdf(pdfDoc, schoolName, config.schoolName, printableTypeForFont);

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
   *
   * @param pdfDoc - The PDF document
   * @param text - The text to add
   * @param placement - Text placement configuration
   * @param printableType - Optional printable type to determine which custom font to use
   *                        If not provided, falls back to standard Helvetica font
   */
  private async addTextToPdf(
    pdfDoc: PDFDocument,
    text: string,
    placement: TextPlacement,
    printableType?: PrintableType
  ): Promise<void> {
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      throw new Error('PDF has no pages');
    }

    const firstPage = pages[0];

    // Get the appropriate font
    let useFont;
    if (printableType && PRINTABLE_FONTS[printableType]) {
      try {
        // Use custom font for this printable type
        const fontName = PRINTABLE_FONTS[printableType];
        const fontData = await this.getCustomFont(fontName);
        useFont = await pdfDoc.embedFont(fontData);
      } catch (error) {
        console.warn(`[PrintableService] Failed to load custom font for ${printableType}, falling back to Helvetica:`, error);
        // Fall back to standard font
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        useFont = placement.fontSize >= 20 ? boldFont : font;
      }
    } else {
      // No printable type specified - use standard fonts
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      useFont = placement.fontSize >= 20 ? boldFont : font;
    }

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

  // ========================================
  // Bleed Generation
  // ========================================

  /**
   * Add bleed margins to a PDF document
   * Creates a new PDF with expanded canvas and centers the original content
   *
   * @param pdfDoc - The original PDF document
   * @param bleedMm - Bleed margin in millimeters (default 3mm)
   * @returns New PDF document with bleed margins
   */
  private async addBleedToDocument(
    pdfDoc: PDFDocument,
    bleedMm: number = BLEED_MM
  ): Promise<PDFDocument> {
    if (bleedMm <= 0) {
      return pdfDoc;  // No bleed needed
    }

    const bleedPts = bleedMm * MM_TO_POINTS;
    const pages = pdfDoc.getPages();

    if (pages.length === 0) {
      return pdfDoc;
    }

    const originalPage = pages[0];
    const { width: origWidth, height: origHeight } = originalPage.getSize();

    // Create new document with expanded dimensions
    const newDoc = await PDFDocument.create();
    const newWidth = origWidth + (bleedPts * 2);
    const newHeight = origHeight + (bleedPts * 2);

    // Add new page with bleed dimensions
    const newPage = newDoc.addPage([newWidth, newHeight]);

    // Embed the original page as a form XObject
    const [embeddedPage] = await newDoc.embedPdf(pdfDoc, [0]);

    // Draw the original page centered (offset by bleed amount)
    newPage.drawPage(embeddedPage, {
      x: bleedPts,
      y: bleedPts,
      width: origWidth,
      height: origHeight,
    });

    return newDoc;
  }

  /**
   * Get the bleed amount for a printable type
   * Returns 0 for types that have bleed built-in (like button)
   */
  private getBleedForType(type: PrintableType): number {
    // Map printable types to their dimension keys
    const typeMapping: Record<PrintableType, keyof typeof PRODUCT_DIMENSIONS | null> = {
      'flyer1': 'flyer1',
      'flyer1-back': 'flyer1',  // Back uses same dimensions as front
      'flyer2': 'flyer2',
      'flyer2-back': 'flyer2',
      'flyer3': 'flyer3',
      'flyer3-back': 'flyer3',
      'button': 'button',
      'tshirt-print': 'tshirt',
      'hoodie-print': 'hoodie',
      'minicard': 'minicard',
      'cd-jacket': 'cd-jacket',
    };

    const dimensionKey = typeMapping[type];
    if (dimensionKey && PRODUCT_DIMENSIONS[dimensionKey]) {
      return PRODUCT_DIMENSIONS[dimensionKey].bleedMm;
    }

    return BLEED_MM;  // Default to standard bleed
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
