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

import type { PrintableType, MockupType, FontName } from '../services/r2Service';

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

// Text color matching mockups (dark teal)
const TEAL_COLOR = { r: 0.24, g: 0.48, b: 0.48 }; // #3D7A7A

// Bleed constant in mm (used for print production)
export const BLEED_MM = 3;

// Convert mm to PDF points (1 point = 1/72 inch, 1 inch = 25.4mm)
export const MM_TO_POINTS = 2.834645669;

/**
 * Product dimension constants (in mm)
 * Used for generating correctly-sized printables matching supplier specs
 */
export const PRODUCT_DIMENSIONS = {
  tshirt: { widthMm: 297, heightMm: 420, bleedMm: 3 },      // A3
  hoodie: { widthMm: 297, heightMm: 420, bleedMm: 3 },      // A3
  button: { widthMm: 50, heightMm: 50, bleedMm: 0 },        // 12mm bleed built into 50mm
  flyer1: { widthMm: 210, heightMm: 105, bleedMm: 3 },      // DIN Long landscape
  flyer2: { widthMm: 210, heightMm: 105, bleedMm: 3 },      // DIN Long landscape
  flyer3: { widthMm: 148, heightMm: 210, bleedMm: 3 },      // A5 portrait
  minicard: { widthMm: 210, heightMm: 105, bleedMm: 3 },    // DIN Long landscape
  'cd-jacket': { widthMm: 120, heightMm: 120, bleedMm: 3 }, // Standard CD size
} as const;

/**
 * Font mapping per printable type
 * - Fredoka: Flyers, Button, Minicard, CD Jacket
 * - Springwood Display: T-Shirt & Hoodie
 */
export const PRINTABLE_FONTS: Record<PrintableType, FontName> = {
  'flyer1': 'fredoka',
  'flyer1-back': 'fredoka',
  'flyer2': 'fredoka',
  'flyer2-back': 'fredoka',
  'flyer3': 'fredoka',
  'flyer3-back': 'fredoka',
  'button': 'fredoka',
  'minicard': 'fredoka',
  'cd-jacket': 'fredoka',
  'tshirt-print': 'springwood-display',
  'hoodie-print': 'springwood-display',
};

/**
 * PRINTABLE CONFIGURATIONS
 *
 * Coordinates updated for supplier-specified dimensions:
 * - T-Shirt/Hoodie: 842 × 1191 pts (297 × 420mm A3)
 * - Flyer 1 & 2: 595 × 298 pts (210 × 105mm DIN Long landscape)
 * - Flyer 3: 420 × 595 pts (148 × 210mm A5 portrait)
 * - Button: 142 × 142 pts (50 × 50mm with 12mm bleed)
 * - Minicard: 595 × 298 pts (210 × 105mm DIN Long)
 * - CD Jacket: 340 × 340 pts (120 × 120mm)
 *
 * Text positions will be calibrated after blank templates are received.
 */

export const PRINTABLE_CONFIGS: Record<PrintableType, PrintableTemplateConfig> = {
  // Flyer 1 - DIN Long landscape (595 × 298 pts = 210 × 105mm)
  flyer1: {
    schoolName: {
      x: 298,  // Center of DIN Long
      y: 250,
      fontSize: 20,
      maxWidth: 500,
      color: BRAND_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 298,
      y: 220,
      fontSize: 14,
      maxWidth: 400,
      color: DEFAULT_COLOR,
      align: 'center',
    },
  },

  // Flyer 2 - DIN Long landscape (595 × 298 pts = 210 × 105mm)
  flyer2: {
    schoolName: {
      x: 298,
      y: 250,
      fontSize: 20,
      maxWidth: 500,
      color: BRAND_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 298,
      y: 220,
      fontSize: 14,
      maxWidth: 400,
      color: DEFAULT_COLOR,
      align: 'center',
    },
  },

  // Flyer 3 - A5 portrait (420 × 595 pts = 148 × 210mm)
  flyer3: {
    schoolName: {
      x: 210,  // Center of A5
      y: 550,
      fontSize: 22,
      maxWidth: 380,
      color: BRAND_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 210,
      y: 515,
      fontSize: 16,
      maxWidth: 300,
      color: DEFAULT_COLOR,
      align: 'center',
    },
  },

  // Flyer 1 Back - DIN Long landscape (595 × 298 pts) - QR code only, no text
  'flyer1-back': {
    schoolName: { x: 0, y: 0, fontSize: 0 },  // Not used - back has QR only
    eventDate: { x: 0, y: 0, fontSize: 0 },   // Not used - back has QR only
  },

  // Flyer 2 Back - DIN Long landscape (595 × 298 pts) - QR code only, no text
  'flyer2-back': {
    schoolName: { x: 0, y: 0, fontSize: 0 },  // Not used - back has QR only
    eventDate: { x: 0, y: 0, fontSize: 0 },   // Not used - back has QR only
  },

  // Flyer 3 Back - A5 portrait (420 × 595 pts) - QR code only, no text
  'flyer3-back': {
    schoolName: { x: 0, y: 0, fontSize: 0 },  // Not used - back has QR only
    eventDate: { x: 0, y: 0, fontSize: 0 },   // Not used - back has QR only
  },

  // Button - Circular 38mm (142 × 142 pts = 50 × 50mm with 12mm bleed)
  button: {
    schoolName: {
      x: 71,  // Center of button
      y: 85,
      fontSize: 10,
      maxWidth: 90,
      color: DEFAULT_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 71,
      y: 57,
      fontSize: 8,
      maxWidth: 80,
      color: DEFAULT_COLOR,
      align: 'center',
    },
  },

  // T-Shirt Print - A3 (842 × 1191 pts = 297 × 420mm)
  'tshirt-print': {
    schoolName: {
      x: 421,  // Center of A3
      y: 950,  // Upper third, above logo
      fontSize: 36,
      maxWidth: 700,
      color: TEAL_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 421,
      y: 900,
      fontSize: 24,
      maxWidth: 500,
      color: TEAL_COLOR,
      align: 'center',
    },
  },

  // Hoodie Print - A3 (842 × 1191 pts = 297 × 420mm)
  'hoodie-print': {
    schoolName: {
      x: 421,  // Center of A3
      y: 950,  // Upper third, above logo
      fontSize: 36,
      maxWidth: 700,
      color: TEAL_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 421,
      y: 900,
      fontSize: 24,
      maxWidth: 500,
      color: TEAL_COLOR,
      align: 'center',
    },
  },

  // Minicard - DIN Long landscape (595 × 298 pts = 210 × 105mm)
  minicard: {
    schoolName: {
      x: 298,  // Center
      y: 200,
      fontSize: 16,
      maxWidth: 450,
      color: DEFAULT_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 298,
      y: 175,
      fontSize: 12,
      maxWidth: 400,
      color: DEFAULT_COLOR,
      align: 'center',
    },
    logo: {
      x: 248,  // Centered logo
      y: 220,
      width: 100,
      height: 60,
      fit: 'contain',
    },
  },

  // CD Jacket - Square (340 × 340 pts = 120 × 120mm)
  'cd-jacket': {
    schoolName: {
      x: 170,  // Center of CD jacket
      y: 280,
      fontSize: 14,
      maxWidth: 280,
      color: DEFAULT_COLOR,
      align: 'center',
    },
    eventDate: {
      x: 170,
      y: 258,
      fontSize: 12,
      maxWidth: 240,
      color: DEFAULT_COLOR,
      align: 'center',
    },
    logo: {
      x: 120,
      y: 150,
      width: 100,
      height: 100,
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
  return type === 'flyer1' || type === 'flyer2' || type === 'flyer3'
    || type === 'flyer1-back' || type === 'flyer2-back' || type === 'flyer3-back';
}

/**
 * Check if a printable type is a back side (QR only, no text)
 */
export function printableIsBack(type: PrintableType): boolean {
  return type === 'flyer1-back' || type === 'flyer2-back' || type === 'flyer3-back';
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
  // Flyer 1 - DIN Long landscape (595 × 298 pts), QR in bottom right
  flyer1: {
    x: 490,    // Near right edge of DIN Long (595 wide)
    y: 30,     // Near bottom edge (298 tall)
    size: 70,  // 70 points = ~25mm, sized for smaller format
    urlText: {
      x: 525,  // Center under QR (490 + 35)
      y: 15,   // Below QR code
      fontSize: 7,
      color: { r: 0, g: 0, b: 0 },
      align: 'center',
    },
  },

  // Flyer 2 - DIN Long landscape (595 × 298 pts), QR in bottom right
  flyer2: {
    x: 490,
    y: 30,
    size: 70,
    urlText: {
      x: 525,
      y: 15,
      fontSize: 7,
      color: { r: 0, g: 0, b: 0 },
      align: 'center',
    },
  },

  // Flyer 3 - A5 portrait (420 × 595 pts), QR in bottom right
  flyer3: {
    x: 320,    // Near right edge of A5 (420 wide)
    y: 30,     // Near bottom edge
    size: 80,  // Slightly larger for A5
    urlText: {
      x: 360,  // Center under QR (320 + 40)
      y: 15,   // Below QR code
      fontSize: 8,
      color: { r: 0, g: 0, b: 0 },
      align: 'center',
    },
  },

  // Flyer 1 Back - DIN Long landscape (595 × 298 pts), QR centered
  'flyer1-back': {
    x: 262,    // Center of DIN Long (595/2 - 35)
    y: 114,    // Center of height (298/2 - 35)
    size: 100, // Larger for back (more prominent)
    urlText: {
      x: 312,  // Center under QR
      y: 95,   // Below QR code
      fontSize: 10,
      color: { r: 0, g: 0, b: 0 },
      align: 'center',
    },
  },

  // Flyer 2 Back - DIN Long landscape (595 × 298 pts), QR centered
  'flyer2-back': {
    x: 262,
    y: 114,
    size: 100,
    urlText: {
      x: 312,
      y: 95,
      fontSize: 10,
      color: { r: 0, g: 0, b: 0 },
      align: 'center',
    },
  },

  // Flyer 3 Back - A5 portrait (420 × 595 pts), QR centered
  'flyer3-back': {
    x: 160,    // Center of A5 (420/2 - 50)
    y: 247,    // Center of height (595/2 - 50)
    size: 120, // Larger for back
    urlText: {
      x: 220,  // Center under QR
      y: 225,  // Below QR code
      fontSize: 10,
      color: { r: 0, g: 0, b: 0 },
      align: 'center',
    },
  },
};
