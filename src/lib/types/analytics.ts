// Analytics Types for Admin Analytics Dashboard

export type EventStatus = 'eight-weeks' | 'four-weeks' | 'two-weeks' | 'event-day' | 'one-week-after' | 'archived';

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
  fixedTotal: number;
  variableTotal: number;
  totalCost: number;
}

export interface EventAnalyticsRow {
  eventId: string;
  eventName: string;           // School name + date for display
  schoolName: string;
  eventDate: string;
  totalRevenue: number;        // Filler data for now (Shopify integration coming)
  aov: number;                 // Average Order Value (totalRevenue / registeredChildren)
  incurredCost: number;        // Calculated from fixed + variable costs
  profit: number;              // totalRevenue - incurredCost
  status: EventStatus;
  registrationPercent: number; // (registeredChildren / totalChildren) * 100
  totalChildren: number;
  registeredChildren: number;
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
