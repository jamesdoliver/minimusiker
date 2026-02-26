/**
 * Configuration for the Confirm Printables feature
 * Defines text and QR code positioning defaults for each printable item type
 *
 * Phase 3: Interactive editor with draggable/resizable elements
 * Phase 4: Multiple text elements with per-element styling
 *
 * NOTE: Editor state stores CSS coordinates during editing.
 * Conversion to PDF coordinates happens only at generation time.
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

export type TextElementType = 'headline' | 'subline' | 'calendar' | 'custom';

/**
 * Font family options for text elements
 */
export type FontFamily = 'fredoka' | 'springwood-display';

/**
 * A single text element in the editor
 * All position/size values are in CSS pixels during editing
 */
export interface TextElement {
  id: string;           // Unique ID for React keys
  type: TextElementType;
  text: string;
  position: { x: number; y: number };   // CSS pixels
  size: { width: number; height: number }; // CSS pixels
  fontSize: number;     // CSS pixels
  color: string;        // Hex color e.g. "#f7f6f6"
  fontFamily?: FontFamily;  // Optional - defaults to 'springwood-display'
}

/**
 * Style preset for a text element type
 */
export interface TextElementStyle {
  fontSize: number;  // Default font size (will be scaled to CSS)
  color: string;     // Hex color
}

/**
 * Default position and size for a text block (single block with line breaks)
 * All values in PDF points (1 point = 1/72 inch)
 * Used for backwards compatibility and initial defaults
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
  /** Preview image path for the editor (PNG at 2x resolution) */
  previewImage: string;
  /** Preview image dimensions (2x PDF dimensions for retina) */
  previewDimensions: {
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
 *
 * All position/size values are in CSS pixels during editing.
 * The canvasScale is stored to enable conversion to PDF at generation time.
 */
export interface PrintableEditorState {
  textElements: TextElement[];  // Array of text elements (can be empty)
  qrPosition?: {
    x: number;      // CSS pixels
    y: number;      // CSS pixels
    size: number;   // CSS pixels
  };
  canvasScale?: number;  // Scale factor used during editing (CSS pixels per PDF point)
}

// Default text color (black)
const DEFAULT_TEXT_COLOR = { r: 0, g: 0, b: 0 };

// Text color matching mockups (dark teal)
const TEAL_TEXT_COLOR = { r: 0.24, g: 0.48, b: 0.48 }; // #3D7A7A

/**
 * Text element style presets per template type
 * When admin adds a new text element, these defaults are applied
 * Note: All types now default to Springwood Display font (can be changed per-element)
 */
export const TEXT_ELEMENT_STYLES: Record<PrintableItemType, Record<TextElementType, TextElementStyle>> = {
  // Flyers default to Springwood Display (can be changed per-element)
  flyer1: {
    headline: { fontSize: 35, color: '#f7f6f6' },
    subline: { fontSize: 18, color: '#b93656' },
    calendar: { fontSize: 18, color: '#252014' },
    custom: { fontSize: 18, color: '#000000' },
  },
  'flyer1-back': {
    headline: { fontSize: 20, color: '#000000' },
    subline: { fontSize: 14, color: '#000000' },
    calendar: { fontSize: 14, color: '#000000' },
    custom: { fontSize: 14, color: '#000000' },
  },
  flyer2: {
    headline: { fontSize: 35, color: '#f7f6f6' },
    subline: { fontSize: 18, color: '#b93656' },
    calendar: { fontSize: 18, color: '#252014' },
    custom: { fontSize: 18, color: '#000000' },
  },
  'flyer2-back': {
    headline: { fontSize: 20, color: '#000000' },
    subline: { fontSize: 14, color: '#000000' },
    calendar: { fontSize: 14, color: '#000000' },
    custom: { fontSize: 14, color: '#000000' },
  },
  flyer3: {
    headline: { fontSize: 35, color: '#f7f6f6' },
    subline: { fontSize: 18, color: '#b93656' },
    calendar: { fontSize: 18, color: '#252014' },
    custom: { fontSize: 18, color: '#000000' },
  },
  'flyer3-back': {
    headline: { fontSize: 22, color: '#000000' },
    subline: { fontSize: 14, color: '#000000' },
    calendar: { fontSize: 14, color: '#000000' },
    custom: { fontSize: 14, color: '#000000' },
  },
  // T-Shirt and Hoodie use Springwood font with teal color
  tshirt: {
    headline: { fontSize: 36, color: '#3D7A7A' },
    subline: { fontSize: 24, color: '#3D7A7A' },
    calendar: { fontSize: 20, color: '#3D7A7A' },
    custom: { fontSize: 24, color: '#3D7A7A' },
  },
  hoodie: {
    headline: { fontSize: 36, color: '#3D7A7A' },
    subline: { fontSize: 24, color: '#3D7A7A' },
    calendar: { fontSize: 20, color: '#3D7A7A' },
    custom: { fontSize: 24, color: '#3D7A7A' },
  },
  // Button, Minicard, CD Jacket use Fredoka with black
  button: {
    headline: { fontSize: 10, color: '#000000' },
    subline: { fontSize: 8, color: '#000000' },
    calendar: { fontSize: 8, color: '#000000' },
    custom: { fontSize: 8, color: '#000000' },
  },
  minicard: {
    headline: { fontSize: 16, color: '#000000' },
    subline: { fontSize: 12, color: '#000000' },
    calendar: { fontSize: 12, color: '#000000' },
    custom: { fontSize: 12, color: '#000000' },
  },
  'cd-jacket': {
    headline: { fontSize: 14, color: '#000000' },
    subline: { fontSize: 10, color: '#000000' },
    calendar: { fontSize: 10, color: '#000000' },
    custom: { fontSize: 10, color: '#000000' },
  },
};

/**
 * Get the default font family for a template type
 * All types now default to Springwood Display
 */
export function getFontFamilyForType(type: PrintableItemType): string {
  // All types now default to Springwood Display
  return 'Springwood Display, cursive';
}

/**
 * Convert a FontFamily value to its CSS font-family string
 */
export function fontFamilyToCss(fontFamily?: FontFamily): string {
  if (fontFamily === 'fredoka') {
    return 'Fredoka, sans-serif';
  }
  return 'Springwood Display, cursive';
}

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
    previewImage: '/images/printable_blank_logo/printable_logo_blank.png',
    previewDimensions: { width: 1414, height: 2000 }, // Matches LOGO_CANVAS_DIMENSIONS
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
    previewImage: '/images/printable_blank_logo/printable_logo_blank.png',
    previewDimensions: { width: 1414, height: 2000 }, // Matches LOGO_CANVAS_DIMENSIONS
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
    previewImage: '/images/printable_previews/flyer1-preview.png',
    previewDimensions: { width: 1190, height: 596 }, // 2x PDF dims
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
    previewImage: '/images/printable_previews/flyer1-back-preview.png',
    previewDimensions: { width: 1190, height: 596 }, // 2x PDF dims
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
    previewImage: '/images/printable_previews/flyer2-preview.png',
    previewDimensions: { width: 1190, height: 596 }, // 2x PDF dims
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
    previewImage: '/images/printable_previews/flyer2-back-preview.png',
    previewDimensions: { width: 1190, height: 596 }, // 2x PDF dims
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
    previewImage: '/images/printable_previews/flyer3-preview.png',
    previewDimensions: { width: 840, height: 1190 }, // 2x PDF dims
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
    previewImage: '/images/printable_previews/flyer3-back-preview.png',
    previewDimensions: { width: 840, height: 1190 }, // 2x PDF dims
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
    previewImage: '/images/printable_previews/button-preview.png',
    previewDimensions: { width: 284, height: 284 }, // 2x PDF dims
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
    previewImage: '/images/printable_previews/minicard-preview.png',
    previewDimensions: { width: 1190, height: 596 }, // 2x PDF dims
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
    previewImage: '/images/printable_previews/cd-jacket-preview.png',
    previewDimensions: { width: 680, height: 680 }, // 2x PDF dims
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
 * Generate a unique ID for text elements
 */
export function generateTextElementId(): string {
  return `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create a new text element with default styling for the given type
 * Position values are in CSS pixels
 */
export function createTextElement(
  templateType: PrintableItemType,
  elementType: TextElementType,
  canvasWidth: number,
  canvasHeight: number,
  scale: number = 1
): TextElement {
  const styles = TEXT_ELEMENT_STYLES[templateType][elementType];

  // Default position at center-top of canvas
  const defaultWidth = 200 * scale;
  const defaultHeight = 60 * scale;

  return {
    id: generateTextElementId(),
    type: elementType,
    text: '',
    position: {
      x: (canvasWidth - defaultWidth) / 2,
      y: canvasHeight * 0.2, // 20% from top
    },
    size: {
      width: defaultWidth,
      height: defaultHeight,
    },
    fontSize: styles.fontSize * scale,
    color: styles.color,
  };
}

/**
 * Initialize editor state for a given item type
 * For t-shirt/hoodie: pre-populates with school name text element
 * For flyer fronts: pre-populates with headline, subline, and calendar text elements
 * For other types: starts empty - admin adds text elements as needed
 */
export function initializeEditorState(
  type: PrintableItemType,
  schoolName: string,
  scale: number = 1,
  eventDate?: string
): PrintableEditorState {
  const config = getPrintableConfig(type);
  if (!config) {
    throw new Error(`Unknown printable type: ${type}`);
  }

  const result: PrintableEditorState = {
    textElements: [],
    canvasScale: scale,
  };

  // For t-shirt/hoodie, pre-create the school name text element
  if (type === 'tshirt' || type === 'hoodie') {
    result.textElements = [{
      id: generateTextElementId(),
      type: 'headline',
      text: schoolName,
      position: {
        x: TSHIRT_HOODIE_TEXT_DEFAULTS.position.x * scale,
        y: TSHIRT_HOODIE_TEXT_DEFAULTS.position.y * scale,
      },
      size: {
        width: TSHIRT_HOODIE_TEXT_DEFAULTS.size.width * scale,
        height: TSHIRT_HOODIE_TEXT_DEFAULTS.size.height * scale,
      },
      fontSize: TSHIRT_HOODIE_TEXT_DEFAULTS.fontSize * scale,
      color: TSHIRT_HOODIE_TEXT_DEFAULTS.color,
    }];
  }

  // For flyer fronts, pre-create headline, subline, and calendar text elements
  if (isFlyerFront(type)) {
    const flyerDefaults = FLYER_TEXT_DEFAULTS[type];
    const styles = TEXT_ELEMENT_STYLES[type];
    const elementTypes: ('headline' | 'subline' | 'calendar')[] = ['headline', 'subline', 'calendar'];

    result.textElements = elementTypes.map((elType) => {
      const def = flyerDefaults[elType];
      return {
        id: generateTextElementId(),
        type: elType as TextElementType,
        text: def.defaultText(schoolName, eventDate),
        position: {
          x: def.position.x * scale,
          y: def.position.y * scale,
        },
        size: {
          width: def.size.width * scale,
          height: def.size.height * scale,
        },
        fontSize: def.fontSize * scale,
        color: styles[elType].color,
      };
    });
  }

  // For back items with QR codes, set up QR position (in CSS pixels)
  if (config.qrDefaults) {
    result.qrPosition = {
      x: config.qrDefaults.x * scale,
      y: (config.pdfDimensions.height - config.qrDefaults.y - config.qrDefaults.size) * scale, // Convert from PDF to CSS Y
      size: config.qrDefaults.size * scale,
    };
  }

  return result;
}

/**
 * Convert hex color to RGB object (0-1 range for PDF)
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    return { r: 0, g: 0, b: 0 }; // Default to black
  }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  };
}

/**
 * Convert CSS coordinates to PDF coordinates
 * CSS: origin top-left, Y increases downward
 * PDF: origin bottom-left, Y increases upward
 */
export function cssToPdfPosition(
  cssX: number,
  cssY: number,
  pdfHeight: number,
  scale: number
): { x: number; y: number } {
  return {
    x: cssX / scale,
    y: pdfHeight - (cssY / scale), // Flip Y axis
  };
}

/**
 * Convert CSS size to PDF size
 */
export function cssToPdfSize(
  cssWidth: number,
  cssHeight: number,
  scale: number
): { width: number; height: number } {
  return {
    width: cssWidth / scale,
    height: cssHeight / scale,
  };
}

/**
 * Flyer front text element defaults (position/size in PDF points)
 * Pre-populated when the editor initializes for flyer front types
 */
export type FlyerFrontType = 'flyer1' | 'flyer2' | 'flyer3';

interface FlyerTextElementDefault {
  position: { x: number; y: number }; // PDF points (CSS top-left origin)
  size: { width: number; height: number }; // PDF points
  fontSize: number; // PDF points
  defaultText: (schoolName: string, eventDate?: string) => string;
}

export const FLYER_TEXT_DEFAULTS: Record<FlyerFrontType, Record<'headline' | 'subline' | 'calendar', FlyerTextElementDefault>> = {
  flyer1: {
    headline: { position: { x: 300, y: 30 }, size: { width: 260, height: 50 }, fontSize: 35, defaultText: (schoolName) => schoolName },
    subline:  { position: { x: 300, y: 90 }, size: { width: 260, height: 35 }, fontSize: 18, defaultText: () => 'Minimusikertag' },
    calendar: { position: { x: 300, y: 135 }, size: { width: 260, height: 35 }, fontSize: 18, defaultText: (_, eventDate) => eventDate || '' },
  },
  flyer2: {
    headline: { position: { x: 300, y: 30 }, size: { width: 260, height: 50 }, fontSize: 35, defaultText: (schoolName) => schoolName },
    subline:  { position: { x: 300, y: 90 }, size: { width: 260, height: 35 }, fontSize: 18, defaultText: () => 'Minimusikertag' },
    calendar: { position: { x: 300, y: 135 }, size: { width: 260, height: 35 }, fontSize: 18, defaultText: (_, eventDate) => eventDate || '' },
  },
  flyer3: {
    headline: { position: { x: 60, y: 50 }, size: { width: 300, height: 60 }, fontSize: 35, defaultText: (schoolName) => schoolName },
    subline:  { position: { x: 60, y: 120 }, size: { width: 300, height: 40 }, fontSize: 18, defaultText: () => 'Minimusikertag' },
    calendar: { position: { x: 60, y: 170 }, size: { width: 300, height: 40 }, fontSize: 18, defaultText: (_, eventDate) => eventDate || '' },
  },
};

const FLYER_FRONT_TYPES: FlyerFrontType[] = ['flyer1', 'flyer2', 'flyer3'];

function isFlyerFront(type: PrintableItemType): type is FlyerFrontType {
  return FLYER_FRONT_TYPES.includes(type as FlyerFrontType);
}

/**
 * T-Shirt/Hoodie logo canvas dimensions (PNG source image)
 * These are used for the visual editor, not the PDF output
 */
export const LOGO_CANVAS_DIMENSIONS = {
  width: 1414,
  height: 2000,
};

/**
 * Default text element position for t-shirt/hoodie
 * Values in CSS pixels relative to the 1414x2000 canvas
 */
export const TSHIRT_HOODIE_TEXT_DEFAULTS = {
  position: { x: 141, y: 100 },
  size: { width: 1131, height: 200 },
  fontSize: 64,
  color: '#3D7A7A',
};
