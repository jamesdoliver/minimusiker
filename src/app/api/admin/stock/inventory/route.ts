import { NextRequest, NextResponse } from 'next/server';
import { generateMockInventory, StockItem } from '@/lib/types/stock';

// In-memory storage for development (will be replaced with Airtable)
let inventoryCache: StockItem[] | null = null;

export async function GET() {
  try {
    // Use cached data or generate new mock data
    if (!inventoryCache) {
      inventoryCache = generateMockInventory();
    }

    return NextResponse.json({
      success: true,
      inventory: inventoryCache,
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, costOverride } = body;

    if (!id || typeof costOverride !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Invalid request: id and costOverride required' },
        { status: 400 }
      );
    }

    // Update the inventory cache
    if (!inventoryCache) {
      inventoryCache = generateMockInventory();
    }

    const itemIndex = inventoryCache.findIndex((item) => item.id === id);
    if (itemIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'Item not found' },
        { status: 404 }
      );
    }

    // Update the item
    inventoryCache[itemIndex] = {
      ...inventoryCache[itemIndex],
      costPerUnit: costOverride,
      costOverride: costOverride,
      lastUpdated: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      item: inventoryCache[itemIndex],
    });
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update inventory' },
      { status: 500 }
    );
  }
}
