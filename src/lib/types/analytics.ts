// Analytics Types for Admin Analytics Dashboard

export type EventStatus = 'eight-weeks' | 'four-weeks' | 'two-weeks' | 'event-day' | 'one-week-after' | 'archived';

// Product types for revenue tracking
export const PRODUCT_TYPES = [
  'T-Shirt',
  'Hoodie',
  'Mug',
  'Sport Bag',
  'CD',
  'Minicard',
] as const;

export type ProductType = typeof PRODUCT_TYPES[number];

// Clothing sizes (cm-based for children)
export const CLOTHING_SIZES = ['92', '98', '104', '116', '128', '140', '152', '164'] as const;
export type ClothingSize = typeof CLOTHING_SIZES[number];

// Products that have sizes
export const SIZED_PRODUCTS: ProductType[] = ['T-Shirt', 'Hoodie'];

// Revenue by product with size breakdown
export interface ProductSizeRevenue {
  size: string;           // "92cm", "104cm", or "-" for non-sized items
  quantity: number;
  revenue: number;
}

export interface ProductRevenue {
  productType: ProductType;
  sizeBreakdown: ProductSizeRevenue[];
  totalQuantity: number;
  totalRevenue: number;
}

export interface EventRevenue {
  products: ProductRevenue[];
  totalRevenue: number;
}

// Manual cost entry (stored in Airtable per event)
export interface ManualCost {
  id: string;
  eventId: string;
  costName: string;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FixedCosts {
  teamMember: number;      // €350 default
  mixing: number;          // €60 default
  stickers: number;        // €32 default (Stickers & Certificate)
  poster: number;          // €8 default (Initial Poster)
}

export interface VariableCost {
  item: string;            // T-Shirts, Hoodies, Mugs, Sport Bags, CDs, Minicards
  quantity: number;
  unitCost: number;
  total: number;           // quantity * unitCost
}

export interface EventCosts {
  fixed: FixedCosts;
  variable: VariableCost[];
  manual: ManualCost[];      // Manual cost entries
  fixedTotal: number;
  variableTotal: number;
  manualTotal: number;       // Sum of manual costs
  totalCost: number;         // fixed + variable + manual
}

export interface EventAnalyticsRow {
  eventId: string;
  eventName: string;           // School name + date for display
  schoolName: string;
  eventDate: string;
  totalRevenue: number;        // Filler data for now (Shopify integration coming)
  aov: number;                 // Average Order Value (totalRevenue / registeredChildren)
  incurredCost: number;        // Calculated from fixed + variable + manual costs
  profit: number;              // totalRevenue - incurredCost
  status: EventStatus;
  registrationPercent: number; // (registeredChildren / totalChildren) * 100
  totalChildren: number;
  registeredChildren: number;
  revenue: EventRevenue;       // Detailed revenue breakdown by product/size
  costs: EventCosts;
}

// Default fixed costs (same for all events)
export const DEFAULT_FIXED_COSTS: FixedCosts = {
  teamMember: 350,
  mixing: 60,
  stickers: 32,
  poster: 8,
};

// Default variable cost unit prices (filler until Stock database exists)
export const VARIABLE_COST_UNIT_PRICES: Record<string, number> = {
  'T-Shirts': 12,
  'Hoodies': 25,
  'Mugs': 8,
  'Sport Bags': 15,
  'CDs': 5,
  'Minicards': 2,
};

// Variable cost items list
export const VARIABLE_COST_ITEMS = [
  'T-Shirts',
  'Hoodies',
  'Mugs',
  'Sport Bags',
  'CDs',
  'Minicards',
] as const;

export type VariableCostItem = typeof VARIABLE_COST_ITEMS[number];

// Helper to calculate fixed costs total
export function calculateFixedTotal(fixed: FixedCosts): number {
  return fixed.teamMember + fixed.mixing + fixed.stickers + fixed.poster;
}

// Helper to calculate variable costs total
export function calculateVariableTotal(variable: VariableCost[]): number {
  return variable.reduce((sum, item) => sum + item.total, 0);
}

// Helper to generate filler variable costs with random quantities
export function generateFillerVariableCosts(): VariableCost[] {
  return VARIABLE_COST_ITEMS.map((item) => {
    const quantity = Math.floor(Math.random() * 30) + 5; // 5-34 units
    const unitCost = VARIABLE_COST_UNIT_PRICES[item];
    return {
      item,
      quantity,
      unitCost,
      total: quantity * unitCost,
    };
  });
}

// Helper to generate filler revenue (€500-€3000)
export function generateFillerRevenue(): number {
  return Math.floor(Math.random() * 2500) + 500;
}

// Revenue unit prices (what customers pay)
export const REVENUE_UNIT_PRICES: Record<ProductType, number> = {
  'T-Shirt': 15,
  'Hoodie': 35,
  'Mug': 12,
  'Sport Bag': 20,
  'CD': 10,
  'Minicard': 5,
};

// Helper to generate filler revenue breakdown by product/size
export function generateFillerRevenueBreakdown(): EventRevenue {
  const products: ProductRevenue[] = [];

  // T-Shirts with size breakdown
  const tshirtSizes: ProductSizeRevenue[] = CLOTHING_SIZES
    .filter(() => Math.random() > 0.3) // Random subset of sizes
    .map((size) => {
      const quantity = Math.floor(Math.random() * 15) + 1;
      const revenue = quantity * REVENUE_UNIT_PRICES['T-Shirt'];
      return { size: `${size}cm`, quantity, revenue };
    });

  if (tshirtSizes.length > 0) {
    products.push({
      productType: 'T-Shirt',
      sizeBreakdown: tshirtSizes,
      totalQuantity: tshirtSizes.reduce((sum, s) => sum + s.quantity, 0),
      totalRevenue: tshirtSizes.reduce((sum, s) => sum + s.revenue, 0),
    });
  }

  // Hoodies with size breakdown
  const hoodieSizes: ProductSizeRevenue[] = CLOTHING_SIZES
    .filter(() => Math.random() > 0.5)
    .map((size) => {
      const quantity = Math.floor(Math.random() * 8) + 1;
      const revenue = quantity * REVENUE_UNIT_PRICES['Hoodie'];
      return { size: `${size}cm`, quantity, revenue };
    });

  if (hoodieSizes.length > 0) {
    products.push({
      productType: 'Hoodie',
      sizeBreakdown: hoodieSizes,
      totalQuantity: hoodieSizes.reduce((sum, s) => sum + s.quantity, 0),
      totalRevenue: hoodieSizes.reduce((sum, s) => sum + s.revenue, 0),
    });
  }

  // Non-sized items
  const nonSizedItems: Array<{ type: ProductType; minQty: number; maxQty: number }> = [
    { type: 'Mug', minQty: 5, maxQty: 25 },
    { type: 'Sport Bag', minQty: 2, maxQty: 10 },
    { type: 'CD', minQty: 10, maxQty: 40 },
    { type: 'Minicard', minQty: 20, maxQty: 60 },
  ];

  nonSizedItems.forEach((item) => {
    if (Math.random() > 0.4) {
      // 60% chance to include
      const qty = Math.floor(Math.random() * (item.maxQty - item.minQty)) + item.minQty;
      const revenue = qty * REVENUE_UNIT_PRICES[item.type];
      products.push({
        productType: item.type,
        sizeBreakdown: [{ size: '-', quantity: qty, revenue }],
        totalQuantity: qty,
        totalRevenue: revenue,
      });
    }
  });

  return {
    products,
    totalRevenue: products.reduce((sum, p) => sum + p.totalRevenue, 0),
  };
}

// Helper to calculate manual costs total
export function calculateManualTotal(manual: ManualCost[]): number {
  return manual.reduce((sum, item) => sum + item.amount, 0);
}

// Helper to determine event status based on weeks from event date
export function determineEventStatus(eventDate: string): EventStatus {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const event = new Date(eventDate);
  event.setHours(0, 0, 0, 0);

  const diffMs = event.getTime() - today.getTime();
  const diffWeeks = diffMs / (1000 * 60 * 60 * 24 * 7);

  if (diffWeeks >= 8) return 'eight-weeks';      // 8+ weeks before
  if (diffWeeks >= 4) return 'four-weeks';       // 4-8 weeks before
  if (diffWeeks >= 2) return 'two-weeks';        // 2-4 weeks before
  if (diffWeeks >= 0) return 'event-day';        // <2 weeks before or event day
  if (diffWeeks >= -1) return 'one-week-after';  // 0-1 week after
  return 'archived';                              // 1+ weeks after
}
