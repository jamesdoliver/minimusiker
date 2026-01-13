/**
 * Configuration for the Confirm Printables feature
 * Defines text and QR code positioning defaults for each printable item type
 *
 * Phase 3: Interactive editor with draggable/resizable elements
 */

export type PrintableItemType =
  | 'tshirt'
  | 'hoodie'
  | 'flyer1'
  | 'flyer1-back'
  | 'flyer2'
  | 'flyer2-back'
  | 'flyer3'
  | 'flyer3-back'
  | 'button'
  | 'minicard'
  | 'cd-jacket';

/**
 * Default position and size for a text block (single block with line breaks)
 * All values in PDF points (1 point = 1/72 inch)
 */
export interface TextBlockDefaults {
  x: number;       // X position from left
  y: number;       // Y position from bottom (PDF coordinate system)
  width: number;   // Text box width
  height: number;  // Text box height
  fontSize: number;
  color?: { r: number; g: number; b: number };
  align?: 'left' | 'center' | 'right';
}

/**
 * Default position and size for QR code
 * All values in PDF points
 */
export interface QrCodeDefaults {
  x: number;     // X position from left
  y: number;     // Y position from bottom
  size: number;  // QR code dimension (square)
}

/**
 * Configuration for each printable item type
 */
export interface PrintableTextConfig {
  type: PrintableItemType;
  name: string;
  description: string;
  pdfDimensions: {
    width: number;
    height: number;
  };
  /** R2 template filename (without path) */
  templateFilename: string;
  /** Default text block position/size - null for back items that have no text */
  textDefaults: TextBlockDefaults | null;
  /** Default QR code position/size - null for items without QR */
  qrDefaults: QrCodeDefaults | null;
  /** True for flyer backs - no text input needed */
  isBack?: boolean;
}

/**
 * Editor state for a single printable item
 * This is what gets passed to the generation API
 */
export interface PrintableEditorState {
  text: string;  // School name with optional line breaks
  textPosition: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  fontSize: number;
  qrPosition?: {
    x: number;
    y: number;
    size: number;
  };
}

// Default text color (black)
const DEFAULT_TEXT_COLOR = { r: 0, g: 0, b: 0 };

// Text color matching mockups (dark teal)
const TEAL_TEXT_COLOR = { r: 0.24, g: 0.48, b: 0.48 }; // #3D7A7A

/**
 * Printable configurations with supplier-specified dimensions
 *
 * Dimensions (in PDF points, 1 point = 1/72 inch):
 * - T-Shirt/Hoodie: 842 × 1191 pts (297 × 420mm A3)
 * - Flyer 1 & 2: 595 × 298 pts (210 × 105mm DIN Long landscape)
 * - Flyer 3: 420 × 595 pts (148 × 210mm A5 portrait)
 * - Button: 142 × 142 pts (50 × 50mm with 12mm bleed built-in)
 * - Minicard: 595 × 298 pts (210 × 105mm same as DIN Long)
 * - CD Jacket: 340 × 340 pts (120 × 120mm)
 */
export const PRINTABLE_ITEMS: PrintableTextConfig[] = [
  {
    type: 'tshirt',
    name: 'T-Shirt',
    description: 'A3 print (297×420mm) - text above logo',
    templateFilename: 'tshirt-print-template.pdf',
    pdfDimensions: { width: 842, height: 1191 },
    textDefaults: {
      x: 221,        // Centered (421 - 200/2)
      y: 850,        // Upper third of page
      width: 400,    // Wide text box
      height: 150,   // Tall enough for 3 lines
      fontSize: 36,
      color: TEAL_TEXT_COLOR,
      align: 'center',
    },
    qrDefaults: null, // T-shirts don't have QR codes
  },
  {
    type: 'hoodie',
    name: 'Hoodie',
    description: 'A3 print (297×420mm) - text above logo',
    templateFilename: 'hoodie-print-template.pdf',
    pdfDimensions: { width: 842, height: 1191 },
    textDefaults: {
      x: 221,
      y: 850,
      width: 400,
      height: 150,
      fontSize: 36,
      color: TEAL_TEXT_COLOR,
      align: 'center',
    },
    qrDefaults: null,
  },
  {
    type: 'flyer1',
    name: 'Flyer 1 (Front)',
    description: 'DIN Long landscape (210×105mm)',
    templateFilename: 'flyer1-template.pdf',
    pdfDimensions: { width: 595, height: 298 },
    textDefaults: {
      x: 148,        // Centered (298 - 300/2)
      y: 200,        // Upper area
      width: 300,
      height: 80,
      fontSize: 20,
      color: DEFAULT_TEXT_COLOR,
      align: 'center',
    },
    qrDefaults: null, // Front doesn't have QR - that's on the back
  },
  {
    type: 'flyer1-back',
    name: 'Flyer 1 (Back)',
    description: 'DIN Long landscape - QR code side',
    templateFilename: 'flyer1-back-template.pdf',
    pdfDimensions: { width: 595, height: 298 },
    isBack: true,
    textDefaults: null, // Backs don't have text
    qrDefaults: {
      x: 247,       // Centered (595/2 - 100/2)
      y: 99,        // Centered (298/2 - 100/2)
      size: 100,
    },
  },
  {
    type: 'flyer2',
    name: 'Flyer 2 (Front)',
    description: 'DIN Long landscape (210×105mm)',
    templateFilename: 'flyer2-template.pdf',
    pdfDimensions: { width: 595, height: 298 },
    textDefaults: {
      x: 148,
      y: 200,
      width: 300,
      height: 80,
      fontSize: 20,
      color: DEFAULT_TEXT_COLOR,
      align: 'center',
    },
    qrDefaults: null,
  },
  {
    type: 'flyer2-back',
    name: 'Flyer 2 (Back)',
    description: 'DIN Long landscape - QR code side',
    templateFilename: 'flyer2-back-template.pdf',
    pdfDimensions: { width: 595, height: 298 },
    isBack: true,
    textDefaults: null,
    qrDefaults: {
      x: 247,
      y: 99,
      size: 100,
    },
  },
  {
    type: 'flyer3',
    name: 'Flyer 3 (Front)',
    description: 'A5 portrait (148×210mm)',
    templateFilename: 'flyer3-template.pdf',
    pdfDimensions: { width: 420, height: 595 },
    textDefaults: {
      x: 60,         // Centered (210 - 300/2)
      y: 480,        // Upper area
      width: 300,
      height: 100,
      fontSize: 22,
      color: DEFAULT_TEXT_COLOR,
      align: 'center',
    },
    qrDefaults: null,
  },
  {
    type: 'flyer3-back',
    name: 'Flyer 3 (Back)',
    description: 'A5 portrait - QR code side',
    templateFilename: 'flyer3-back-template.pdf',
    pdfDimensions: { width: 420, height: 595 },
    isBack: true,
    textDefaults: null,
    qrDefaults: {
      x: 135,        // Centered (420/2 - 150/2)
      y: 222,        // Centered (595/2 - 150/2)
      size: 150,
    },
  },
  {
    type: 'button',
    name: 'Button',
    description: '38mm circular button (50×50mm with bleed)',
    templateFilename: 'button-template.pdf',
    pdfDimensions: { width: 142, height: 142 },
    textDefaults: {
      x: 21,         // Safe zone centered
      y: 55,
      width: 100,
      height: 50,
      fontSize: 10,
      color: DEFAULT_TEXT_COLOR,
      align: 'center',
    },
    qrDefaults: null,
  },
  {
    type: 'minicard',
    name: 'Minicard',
    description: 'DIN Long landscape (210×105mm)',
    templateFilename: 'minicard-template.pdf',
    pdfDimensions: { width: 595, height: 298 },
    textDefaults: {
      x: 148,
      y: 140,
      width: 300,
      height: 80,
      fontSize: 16,
      color: DEFAULT_TEXT_COLOR,
      align: 'center',
    },
    qrDefaults: null,
  },
  {
    type: 'cd-jacket',
    name: 'CD Jacket',
    description: 'Standard CD jacket (120×120mm)',
    templateFilename: 'cd-jacket-template.pdf',
    pdfDimensions: { width: 340, height: 340 },
    textDefaults: {
      x: 70,
      y: 230,
      width: 200,
      height: 80,
      fontSize: 14,
      color: DEFAULT_TEXT_COLOR,
      align: 'center',
    },
    qrDefaults: null,
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

/**
 * Initialize editor state from config defaults for a given item type
 */
export function initializeEditorState(
  type: PrintableItemType,
  schoolName: string
): PrintableEditorState {
  const config = getPrintableConfig(type);
  if (!config) {
    throw new Error(`Unknown printable type: ${type}`);
  }

  const textDefaults = config.textDefaults || {
    x: config.pdfDimensions.width / 2 - 100,
    y: config.pdfDimensions.height / 2,
    width: 200,
    height: 80,
    fontSize: 16,
  };

  const result: PrintableEditorState = {
    text: schoolName,
    textPosition: {
      x: textDefaults.x,
      y: textDefaults.y,
      width: textDefaults.width,
      height: textDefaults.height,
    },
    fontSize: textDefaults.fontSize,
  };

  if (config.qrDefaults) {
    result.qrPosition = { ...config.qrDefaults };
  }

  return result;
}
