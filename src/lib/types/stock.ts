// Stock Management Types

// Available stock items
export const STOCK_ITEMS = [
  'T-Shirt',
  'Hoodie',
  'Mug',
  'Sport Bag',
  'CD',
  'Minicard',
] as const;

export type StockItemType = (typeof STOCK_ITEMS)[number];

// Items that have size variants
export const SIZED_ITEMS: StockItemType[] = ['T-Shirt', 'Hoodie'];

// Available sizes (in cm) for T-Shirts and Hoodies - legacy format for stock management
export const CLOTHING_SIZES = ['92', '98', '104', '116', '128', '140', '152', '164'] as const;

export type ClothingSize = (typeof CLOTHING_SIZES)[number];

// T-Shirt sizes matching Shopify variants for "T-Shirt (Personalisiert)"
export const TSHIRT_SIZES = [
  '98/104 (3-4J)',
  '110/116 (5-6J)',
  '122/128 (7-8J)',
  '134/146 (9-11J)',
  '152/164 (12-14J)',
] as const;

export type TshirtSize = (typeof TSHIRT_SIZES)[number];

// Hoodie sizes matching Shopify variants for "Hoodie (Personalisiert)"
export const HOODIE_SIZES = [
  '116 (5-6 J)',
  '128 (7-8 J)',
  '140 (9-11 J)',
  '152 (12-13 J)',
  '164 (14-15 J)',
] as const;

export type HoodieSize = (typeof HOODIE_SIZES)[number];

// Stock inventory item
export interface StockItem {
  id: string;
  item: StockItemType;
  size?: ClothingSize; // Only for T-Shirt and Hoodie
  inStock: number;
  costPerUnit: number; // Current effective cost (API price or override)
  baseCost: number; // Original cost from API
  costOverride?: number; // Admin override (null = use API price)
  lastUpdated: string; // ISO timestamp
}

// Order status
export type OrderStatus = 'pending' | 'placed' | 'completed' | 'failed';

// Line item in a stock order
export interface OrderLineItem {
  id: string;
  item: StockItemType;
  size?: ClothingSize;
  quantity: number;
  unitCost: number;
  totalCost: number;
  shopifyOrderIds: string[];
  eventCodes: string[];
}

// Stock order (weekly batch from Flyeralarm)
export interface StockOrder {
  id: string;
  orderDate: string; // ISO date
  status: OrderStatus;
  totalItems: number; // Count of unique line items
  totalQuantity: number; // Sum of all quantities
  totalCost: number;
  costChangePercent: number; // vs previous week (negative = cheaper)
  lineItems: OrderLineItem[];
}

// Tab state for stock page
export type StockTab = 'inventory' | 'orders';

// Helper to check if an item has sizes
export function hasSizes(item: StockItemType): boolean {
  return SIZED_ITEMS.includes(item);
}

// Helper to format currency
export function formatStockCurrency(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

// Helper to format date for display
export function formatStockDate(dateString: string): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// Helper to format datetime for "Last Updated" column
export function formatLastUpdated(dateString: string): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Generate mock inventory data
export function generateMockInventory(): StockItem[] {
  const inventory: StockItem[] = [];
  let id = 1;

  // T-Shirts with all sizes
  for (const size of CLOTHING_SIZES) {
    inventory.push({
      id: String(id++),
      item: 'T-Shirt',
      size,
      inStock: Math.floor(Math.random() * 20) + 5,
      costPerUnit: 8.5,
      baseCost: 8.5,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Hoodies with all sizes
  for (const size of CLOTHING_SIZES) {
    inventory.push({
      id: String(id++),
      item: 'Hoodie',
      size,
      inStock: Math.floor(Math.random() * 10) + 2,
      costPerUnit: 18.0,
      baseCost: 18.0,
      lastUpdated: new Date().toISOString(),
    });
  }

  // Other items without sizes
  inventory.push({
    id: String(id++),
    item: 'Mug',
    inStock: Math.floor(Math.random() * 30) + 10,
    costPerUnit: 6.5,
    baseCost: 6.5,
    lastUpdated: new Date().toISOString(),
  });

  inventory.push({
    id: String(id++),
    item: 'Sport Bag',
    inStock: Math.floor(Math.random() * 20) + 5,
    costPerUnit: 12.0,
    baseCost: 12.0,
    lastUpdated: new Date().toISOString(),
  });

  inventory.push({
    id: String(id++),
    item: 'CD',
    inStock: Math.floor(Math.random() * 50) + 20,
    costPerUnit: 3.5,
    baseCost: 3.5,
    lastUpdated: new Date().toISOString(),
  });

  inventory.push({
    id: String(id++),
    item: 'Minicard',
    inStock: Math.floor(Math.random() * 100) + 50,
    costPerUnit: 1.5,
    baseCost: 1.5,
    lastUpdated: new Date().toISOString(),
  });

  return inventory;
}

// Generate mock orders data
export function generateMockOrders(): StockOrder[] {
  const orders: StockOrder[] = [];

  // Generate 6 weeks of orders
  for (let i = 0; i < 6; i++) {
    const orderDate = new Date();
    orderDate.setDate(orderDate.getDate() - i * 7);
    // Set to Monday
    orderDate.setDate(orderDate.getDate() - orderDate.getDay() + 1);

    const lineItems: OrderLineItem[] = [];
    let itemId = 1;

    // Random selection of items for this order
    const numItems = Math.floor(Math.random() * 5) + 3;
    const selectedSizes = CLOTHING_SIZES.slice(0, numItems);

    for (const size of selectedSizes) {
      const qty = Math.floor(Math.random() * 15) + 5;
      lineItems.push({
        id: `li-${i}-${itemId++}`,
        item: 'T-Shirt',
        size,
        quantity: qty,
        unitCost: 8.5,
        totalCost: qty * 8.5,
        shopifyOrderIds: [`#${1000 + i * 10 + itemId}`],
        eventCodes: [`EVT-${String(100 + i).padStart(3, '0')}`],
      });
    }

    // Add some hoodies
    const hoodieQty = Math.floor(Math.random() * 8) + 2;
    lineItems.push({
      id: `li-${i}-${itemId++}`,
      item: 'Hoodie',
      size: '128',
      quantity: hoodieQty,
      unitCost: 18.0,
      totalCost: hoodieQty * 18.0,
      shopifyOrderIds: [`#${1000 + i * 10 + itemId}`],
      eventCodes: [`EVT-${String(100 + i).padStart(3, '0')}`],
    });

    // Add mugs
    const mugQty = Math.floor(Math.random() * 20) + 10;
    lineItems.push({
      id: `li-${i}-${itemId++}`,
      item: 'Mug',
      quantity: mugQty,
      unitCost: 6.5,
      totalCost: mugQty * 6.5,
      shopifyOrderIds: [`#${1000 + i * 10 + itemId}`],
      eventCodes: [`EVT-${String(100 + i).padStart(3, '0')}`],
    });

    const totalQuantity = lineItems.reduce((sum, li) => sum + li.quantity, 0);
    const totalCost = lineItems.reduce((sum, li) => sum + li.totalCost, 0);

    // Determine status based on date
    let status: OrderStatus;
    if (i === 0) {
      status = 'pending';
    } else if (i === 1) {
      status = 'placed';
    } else {
      status = 'completed';
    }

    // Random cost change percent (-5% to +5%)
    const costChangePercent = (Math.random() * 10 - 5).toFixed(1);

    orders.push({
      id: `ord-${String(i + 1).padStart(3, '0')}`,
      orderDate: orderDate.toISOString().split('T')[0],
      status,
      totalItems: lineItems.length,
      totalQuantity,
      totalCost,
      costChangePercent: parseFloat(costChangePercent),
      lineItems,
    });
  }

  return orders;
}
