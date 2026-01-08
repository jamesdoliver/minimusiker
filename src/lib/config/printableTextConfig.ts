/**
 * Configuration for the Confirm Printables feature
 * Defines text positioning for each printable item type
 */

export type PrintableItemType =
  | 'tshirt'
  | 'hoodie'
  | 'flyer1'
  | 'flyer2'
  | 'flyer3'
  | 'minicard'
  | 'cd-jacket';

export interface TextLineConfig {
  x: number; // X position (PDF points from left)
  y: number; // Y position (PDF points from bottom)
  fontSize: number;
  maxWidth?: number;
  color?: { r: number; g: number; b: number };
  align?: 'left' | 'center' | 'right';
}

export interface TextLines {
  line1: string;
  line2: string;
  line3: string;
}

export interface PrintableTextConfig {
  type: PrintableItemType;
  name: string; // Display name (e.g., "T-Shirt")
  description: string; // Brief description for UI
  mockupImagePath: string; // Path to mockup image in R2 or public
  pdfDimensions: {
    width: number; // PDF width in points (1 point = 1/72 inch)
    height: number; // PDF height in points
  };
  textLines: {
    line1: TextLineConfig;
    line2: TextLineConfig;
    line3: TextLineConfig;
  };
}

// Default text color (black)
const DEFAULT_TEXT_COLOR = { r: 0, g: 0, b: 0 };

// Placeholder configurations - to be updated with actual coordinates
// once mockup images and print specs are provided
export const PRINTABLE_ITEMS: PrintableTextConfig[] = [
  {
    type: 'tshirt',
    name: 'T-Shirt',
    description: 'Front print with school name',
    mockupImagePath: '/images/printables/mockup-tshirt.png', // Placeholder
    pdfDimensions: { width: 595, height: 842 }, // A4 placeholder
    textLines: {
      line1: { x: 297, y: 600, fontSize: 24, align: 'center', color: DEFAULT_TEXT_COLOR },
      line2: { x: 297, y: 570, fontSize: 24, align: 'center', color: DEFAULT_TEXT_COLOR },
      line3: { x: 297, y: 540, fontSize: 24, align: 'center', color: DEFAULT_TEXT_COLOR },
    },
  },
  {
    type: 'hoodie',
    name: 'Hoodie',
    description: 'Front print with school name',
    mockupImagePath: '/images/printables/mockup-hoodie.png', // Placeholder
    pdfDimensions: { width: 595, height: 842 }, // A4 placeholder
    textLines: {
      line1: { x: 297, y: 600, fontSize: 24, align: 'center', color: DEFAULT_TEXT_COLOR },
      line2: { x: 297, y: 570, fontSize: 24, align: 'center', color: DEFAULT_TEXT_COLOR },
      line3: { x: 297, y: 540, fontSize: 24, align: 'center', color: DEFAULT_TEXT_COLOR },
    },
  },
  {
    type: 'flyer1',
    name: 'Flyer 1',
    description: 'Event flyer design 1',
    mockupImagePath: '/images/printables/mockup-flyer1.png', // Placeholder
    pdfDimensions: { width: 595, height: 842 }, // A4 placeholder
    textLines: {
      line1: { x: 297, y: 750, fontSize: 28, align: 'center', color: DEFAULT_TEXT_COLOR },
      line2: { x: 297, y: 715, fontSize: 28, align: 'center', color: DEFAULT_TEXT_COLOR },
      line3: { x: 297, y: 680, fontSize: 28, align: 'center', color: DEFAULT_TEXT_COLOR },
    },
  },
  {
    type: 'flyer2',
    name: 'Flyer 2',
    description: 'Event flyer design 2',
    mockupImagePath: '/images/printables/mockup-flyer2.png', // Placeholder
    pdfDimensions: { width: 595, height: 842 }, // A4 placeholder
    textLines: {
      line1: { x: 297, y: 750, fontSize: 28, align: 'center', color: DEFAULT_TEXT_COLOR },
      line2: { x: 297, y: 715, fontSize: 28, align: 'center', color: DEFAULT_TEXT_COLOR },
      line3: { x: 297, y: 680, fontSize: 28, align: 'center', color: DEFAULT_TEXT_COLOR },
    },
  },
  {
    type: 'flyer3',
    name: 'Flyer 3',
    description: 'Event flyer design 3',
    mockupImagePath: '/images/printables/mockup-flyer3.png', // Placeholder
    pdfDimensions: { width: 595, height: 842 }, // A4 placeholder
    textLines: {
      line1: { x: 297, y: 750, fontSize: 28, align: 'center', color: DEFAULT_TEXT_COLOR },
      line2: { x: 297, y: 715, fontSize: 28, align: 'center', color: DEFAULT_TEXT_COLOR },
      line3: { x: 297, y: 680, fontSize: 28, align: 'center', color: DEFAULT_TEXT_COLOR },
    },
  },
  {
    type: 'minicard',
    name: 'Minicard',
    description: 'Small card with school info',
    mockupImagePath: '/images/printables/mockup-minicard.png', // Placeholder
    pdfDimensions: { width: 252, height: 144 }, // 85x51mm business card size
    textLines: {
      line1: { x: 126, y: 100, fontSize: 12, align: 'center', color: DEFAULT_TEXT_COLOR },
      line2: { x: 126, y: 85, fontSize: 12, align: 'center', color: DEFAULT_TEXT_COLOR },
      line3: { x: 126, y: 70, fontSize: 12, align: 'center', color: DEFAULT_TEXT_COLOR },
    },
  },
  {
    type: 'cd-jacket',
    name: 'CD Jacket',
    description: 'CD case insert with school name',
    mockupImagePath: '/images/printables/mockup-cd-jacket.png', // Placeholder
    pdfDimensions: { width: 340, height: 340 }, // Standard CD jacket
    textLines: {
      line1: { x: 170, y: 280, fontSize: 14, align: 'center', color: DEFAULT_TEXT_COLOR },
      line2: { x: 170, y: 262, fontSize: 14, align: 'center', color: DEFAULT_TEXT_COLOR },
      line3: { x: 170, y: 244, fontSize: 14, align: 'center', color: DEFAULT_TEXT_COLOR },
    },
  },
];

// Helper to get config by type
export function getPrintableConfig(type: PrintableItemType): PrintableTextConfig | undefined {
  return PRINTABLE_ITEMS.find((item) => item.type === type);
}

// Get all item types in order
export function getPrintableItemTypes(): PrintableItemType[] {
  return PRINTABLE_ITEMS.map((item) => item.type);
}

// Get total number of items
export const TOTAL_PRINTABLE_ITEMS = PRINTABLE_ITEMS.length;
