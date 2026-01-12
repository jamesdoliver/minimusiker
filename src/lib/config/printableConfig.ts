/**
 * Printable Configuration
 *
 * This file defines the text placement coordinates and styling for each printable template.
 * These values need to be configured after uploading the base PDF templates.
 *
 * Coordinate System:
 * - PDF coordinates start from bottom-left (0, 0)
 * - x increases to the right
 * - y increases upward
 * - Units are in PDF points (1 point = 1/72 inch)
 *
 * To find coordinates:
 * 1. Open the template PDF in a PDF editor
 * 2. Identify where text should be placed
 * 3. Note the x, y position from bottom-left
 * 4. Update the values below
 *
 * IMPORTANT: These are placeholder values. Update after receiving actual templates from client.
 */

import type { PrintableType, MockupType } from '../services/r2Service';

// Text placement configuration for a single text element
export interface TextPlacement {
  x: number;           // X coordinate from left edge (in PDF points)
  y: number;           // Y coordinate from bottom edge (in PDF points)
  fontSize: number;    // Font size in points
  maxWidth?: number;   // Optional max width for text wrapping
  color?: {            // Optional color (defaults to black)
    r: number;         // Red (0-1)
    g: number;         // Green (0-1)
    b: number;         // Blue (0-1)
  };
  align?: 'left' | 'center' | 'right';  // Text alignment
}

// Image/logo placement configuration
export interface ImagePlacement {
  x: number;           // X coordinate from left edge
  y: number;           // Y coordinate from bottom edge
  width: number;       // Width to scale image to
  height: number;      // Height to scale image to
  fit?: 'contain' | 'cover' | 'stretch';  // How to fit the image
}

// QR code placement configuration
export interface QrCodePlacement {
  x: number;           // X coordinate from left edge
  y: number;           // Y coordinate from bottom edge
  size: number;        // QR code size (width and height)
  urlText?: {          // Optional URL text below QR code (for parents who can't scan)
    x: number;
    y: number;
    fontSize: number;
    color?: { r: number; g: number; b: number };
    align?: 'left' | 'center' | 'right';
  };
}

// Configuration for a single printable template
export interface PrintableTemplateConfig {
  schoolName: TextPlacement;
  eventDate: TextPlacement;
  logo?: ImagePlacement;  // Only for minicard and cd-jacket
}

// Configuration for mockup templates (only school name, no date)
export interface MockupTemplateConfig {
  schoolName: TextPlacement;
}

// German date formatting
export function formatGermanDate(dateString: string): string {
  const date = new Date(dateString);
  const day = date.getDate();
  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}. ${month} ${year}`;
}

// Default text color (black)
const DEFAULT_COLOR = { r: 0, g: 0, b: 0 };

// MiniMusiker brand color (coral/accent)
const BRAND_COLOR = { r: 0.91, g: 0.45, b: 0.32 }; // #E87452

/**
 * PLACEHOLDER CONFIGURATIONS
 *
 * These values are placeholders and MUST be updated after receiving
 * the actual PDF templates from the client.
 *
 * The coordinates assume a standard A4 page (595 x 842 points)
 * Adjust based on actual template dimensions and design.
 */

export const PRINTABLE_CONFIGS: Record<PrintableType, PrintableTemplateConfig> = {
  // Flyer 1 - Marketing flyer variant 1
  flyer1: {
    schoolName: {
      x: 297.5,  // Center of A4 page
      y: 700,
      fontSize: 28,
      maxWidth: 400,
      color: BRAND_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 297.5,
      y: 660,
      fontSize: 18,
      maxWidth: 300,
      color: DEFAULT_COLOR,
      align: 'center',
    },
  },

  // Flyer 2 - Marketing flyer variant 2
  flyer2: {
    schoolName: {
      x: 297.5,
      y: 700,
      fontSize: 28,
      maxWidth: 400,
      color: BRAND_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 297.5,
      y: 660,
      fontSize: 18,
      maxWidth: 300,
      color: DEFAULT_COLOR,
      align: 'center',
    },
  },

  // Flyer 3 - Marketing flyer variant 3
  flyer3: {
    schoolName: {
      x: 297.5,
      y: 700,
      fontSize: 28,
      maxWidth: 400,
      color: BRAND_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 297.5,
      y: 660,
      fontSize: 18,
      maxWidth: 300,
      color: DEFAULT_COLOR,
      align: 'center',
    },
  },

  // Poster - Event poster
  poster: {
    schoolName: {
      x: 297.5,
      y: 750,
      fontSize: 36,
      maxWidth: 500,
      color: BRAND_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 297.5,
      y: 700,
      fontSize: 24,
      maxWidth: 400,
      color: DEFAULT_COLOR,
      align: 'center',
    },
  },

  // T-Shirt Print - Print-ready file for t-shirts
  'tshirt-print': {
    schoolName: {
      x: 297.5,
      y: 500,
      fontSize: 24,
      maxWidth: 350,
      color: DEFAULT_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 297.5,
      y: 460,
      fontSize: 16,
      maxWidth: 300,
      color: DEFAULT_COLOR,
      align: 'center',
    },
  },

  // Hoodie Print - Print-ready file for hoodies
  'hoodie-print': {
    schoolName: {
      x: 297.5,
      y: 500,
      fontSize: 24,
      maxWidth: 350,
      color: DEFAULT_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 297.5,
      y: 460,
      fontSize: 16,
      maxWidth: 300,
      color: DEFAULT_COLOR,
      align: 'center',
    },
  },

  // Minicard - Product insert card (includes logo)
  minicard: {
    schoolName: {
      x: 150,
      y: 200,
      fontSize: 14,
      maxWidth: 200,
      color: DEFAULT_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 150,
      y: 180,
      fontSize: 12,
      maxWidth: 180,
      color: DEFAULT_COLOR,
      align: 'center',
    },
    logo: {
      x: 100,
      y: 220,
      width: 100,
      height: 100,
      fit: 'contain',
    },
  },

  // CD Jacket - CD case insert (includes logo)
  'cd-jacket': {
    schoolName: {
      x: 60,
      y: 100,
      fontSize: 12,
      maxWidth: 100,
      color: DEFAULT_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 60,
      y: 85,
      fontSize: 10,
      maxWidth: 100,
      color: DEFAULT_COLOR,
      align: 'center',
    },
    logo: {
      x: 35,
      y: 110,
      width: 50,
      height: 50,
      fit: 'contain',
    },
  },
};

export const MOCKUP_CONFIGS: Record<MockupType, MockupTemplateConfig> = {
  // Mock T-Shirt - Customer preview of t-shirt
  'mock-tshirt': {
    schoolName: {
      x: 297.5,
      y: 450,
      fontSize: 20,
      maxWidth: 250,
      color: DEFAULT_COLOR,
      align: 'center',
    },
  },

  // Mock Hoodie - Customer preview of hoodie
  'mock-hoodie': {
    schoolName: {
      x: 297.5,
      y: 450,
      fontSize: 20,
      maxWidth: 250,
      color: DEFAULT_COLOR,
      align: 'center',
    },
  },
};

/**
 * Get configuration for a printable type
 */
export function getPrintableConfig(type: PrintableType): PrintableTemplateConfig {
  return PRINTABLE_CONFIGS[type];
}

/**
 * Get configuration for a mockup type
 */
export function getMockupConfig(type: MockupType): MockupTemplateConfig {
  return MOCKUP_CONFIGS[type];
}

/**
 * Check if a printable type requires a logo
 */
export function printableRequiresLogo(type: PrintableType): boolean {
  return type === 'minicard' || type === 'cd-jacket';
}

/**
 * Check if a printable type supports QR code embedding
 */
export function printableSupportsQrCode(type: PrintableType): boolean {
  return type === 'flyer1' || type === 'flyer2' || type === 'flyer3' || type === 'poster';
}

/**
 * QR Code Placement Configurations
 *
 * These define where QR codes should be placed on printables that support them.
 * QR codes link to the short URL for easy parent registration (e.g., minimusiker.app/e/1562)
 *
 * IMPORTANT: These are placeholder values. Update after receiving actual templates.
 */
export const QR_CODE_CONFIGS: Partial<Record<PrintableType, QrCodePlacement>> = {
  // Flyer 1 - QR code in bottom right corner
  flyer1: {
    x: 480,    // Near right edge of A4
    y: 50,     // Near bottom edge
    size: 80,  // 80 points = ~28mm
    urlText: {
      x: 520,  // Center under QR (480 + 40)
      y: 35,   // Below QR code
      fontSize: 8,
      color: { r: 0, g: 0, b: 0 },
      align: 'center',
    },
  },

  // Flyer 2 - QR code in bottom right corner
  flyer2: {
    x: 480,
    y: 50,
    size: 80,
    urlText: {
      x: 520,
      y: 35,
      fontSize: 8,
      color: { r: 0, g: 0, b: 0 },
      align: 'center',
    },
  },

  // Flyer 3 - QR code in bottom right corner
  flyer3: {
    x: 480,
    y: 50,
    size: 80,
    urlText: {
      x: 520,
      y: 35,
      fontSize: 8,
      color: { r: 0, g: 0, b: 0 },
      align: 'center',
    },
  },

  // Poster - Larger QR code for easier scanning
  poster: {
    x: 460,
    y: 50,
    size: 100,  // Larger for poster
    urlText: {
      x: 510,  // Center under QR (460 + 50)
      y: 32,   // Below QR code
      fontSize: 10,  // Slightly larger for poster
      color: { r: 0, g: 0, b: 0 },
      align: 'center',
    },
  },
};
