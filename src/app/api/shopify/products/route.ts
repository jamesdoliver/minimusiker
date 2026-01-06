import { NextRequest, NextResponse } from 'next/server';
import shopifyService from '@/lib/services/shopifyService';
import { Product } from '@/lib/types/airtable';

export const dynamic = 'force-dynamic';

// Mock products with local images for development
const MOCK_PRODUCTS: Product[] = [
  {
    id: 'mock-baseball-cap',
    title: 'MiniMusiker Baseball Cap',
    description: 'Show your school spirit with this premium embroidered baseball cap. Perfect for outdoor events and everyday wear.',
    productType: 'Accessories',
    handle: 'minimusiker-baseball-cap',
    tags: ['minimusiker-shop', 'accessories', 'headwear'],
    availableForSale: true,
    images: [
      {
        id: 'cap-img-1',
        url: '/images/products/cap.jpeg',
        altText: 'MiniMusiker Baseball Cap',
      },
    ],
    priceRange: {
      minVariantPrice: { amount: '24.99', currencyCode: 'USD' },
      maxVariantPrice: { amount: '24.99', currencyCode: 'USD' },
    },
    variants: [
      {
        id: 'cap-one-size',
        title: 'One Size',
        availableForSale: true,
        price: { amount: '24.99', currencyCode: 'USD' },
        selectedOptions: [{ name: 'Size', value: 'One Size' }],
      },
    ],
  },
  {
    id: 'mock-hoodie',
    title: 'MiniMusiker Hoodie',
    description: 'Stay cozy with our premium quality hoodie featuring the MiniMusiker logo. Soft fleece interior, perfect for cool days.',
    productType: 'Apparel',
    handle: 'minimusiker-hoodie',
    tags: ['minimusiker-shop', 'apparel', 'outerwear'],
    availableForSale: true,
    images: [
      {
        id: 'hoodie-img-1',
        url: '/images/products/hoodie.jpeg',
        altText: 'MiniMusiker Hoodie',
      },
    ],
    priceRange: {
      minVariantPrice: { amount: '49.99', currencyCode: 'USD' },
      maxVariantPrice: { amount: '49.99', currencyCode: 'USD' },
    },
    compareAtPriceRange: {
      minVariantPrice: { amount: '59.99', currencyCode: 'USD' },
    },
    variants: [
      {
        id: 'hoodie-s',
        title: 'S',
        availableForSale: true,
        price: { amount: '49.99', currencyCode: 'USD' },
        compareAtPrice: { amount: '59.99', currencyCode: 'USD' },
        selectedOptions: [{ name: 'Size', value: 'S' }],
      },
      {
        id: 'hoodie-m',
        title: 'M',
        availableForSale: true,
        price: { amount: '49.99', currencyCode: 'USD' },
        compareAtPrice: { amount: '59.99', currencyCode: 'USD' },
        selectedOptions: [{ name: 'Size', value: 'M' }],
      },
      {
        id: 'hoodie-l',
        title: 'L',
        availableForSale: true,
        price: { amount: '49.99', currencyCode: 'USD' },
        compareAtPrice: { amount: '59.99', currencyCode: 'USD' },
        selectedOptions: [{ name: 'Size', value: 'L' }],
      },
      {
        id: 'hoodie-xl',
        title: 'XL',
        availableForSale: true,
        price: { amount: '49.99', currencyCode: 'USD' },
        compareAtPrice: { amount: '59.99', currencyCode: 'USD' },
        selectedOptions: [{ name: 'Size', value: 'XL' }],
      },
    ],
  },
  {
    id: 'mock-tshirt',
    title: 'MiniMusiker T-Shirt',
    description: 'Classic comfort meets school pride. This soft cotton t-shirt features the MiniMusiker logo and is perfect for any occasion.',
    productType: 'Apparel',
    handle: 'minimusiker-tshirt',
    tags: ['minimusiker-shop', 'apparel', 'tops'],
    availableForSale: true,
    images: [
      {
        id: 'tshirt-img-1',
        url: '/images/products/tshirt.jpeg',
        altText: 'MiniMusiker T-Shirt',
      },
    ],
    priceRange: {
      minVariantPrice: { amount: '19.99', currencyCode: 'USD' },
      maxVariantPrice: { amount: '19.99', currencyCode: 'USD' },
    },
    variants: [
      {
        id: 'tshirt-xs',
        title: 'XS',
        availableForSale: true,
        price: { amount: '19.99', currencyCode: 'USD' },
        selectedOptions: [{ name: 'Size', value: 'XS' }],
      },
      {
        id: 'tshirt-s',
        title: 'S',
        availableForSale: true,
        price: { amount: '19.99', currencyCode: 'USD' },
        selectedOptions: [{ name: 'Size', value: 'S' }],
      },
      {
        id: 'tshirt-m',
        title: 'M',
        availableForSale: true,
        price: { amount: '19.99', currencyCode: 'USD' },
        selectedOptions: [{ name: 'Size', value: 'M' }],
      },
      {
        id: 'tshirt-l',
        title: 'L',
        availableForSale: true,
        price: { amount: '19.99', currencyCode: 'USD' },
        selectedOptions: [{ name: 'Size', value: 'L' }],
      },
      {
        id: 'tshirt-xl',
        title: 'XL',
        availableForSale: true,
        price: { amount: '19.99', currencyCode: 'USD' },
        selectedOptions: [{ name: 'Size', value: 'XL' }],
      },
      {
        id: 'tshirt-xxl',
        title: 'XXL',
        availableForSale: true,
        price: { amount: '19.99', currencyCode: 'USD' },
        selectedOptions: [{ name: 'Size', value: 'XXL' }],
      },
    ],
  },
  {
    id: 'mock-tote-bag',
    title: 'MiniMusiker Tote Bag',
    description: 'Carry your essentials in style with our durable canvas tote bag. Great for school, shopping, or everyday use.',
    productType: 'Accessories',
    handle: 'minimusiker-tote-bag',
    tags: ['minimusiker-shop', 'accessories', 'bags'],
    availableForSale: true,
    images: [
      {
        id: 'tote-img-1',
        url: '/images/products/tote_bag.jpeg',
        altText: 'MiniMusiker Tote Bag',
      },
    ],
    priceRange: {
      minVariantPrice: { amount: '14.99', currencyCode: 'USD' },
      maxVariantPrice: { amount: '14.99', currencyCode: 'USD' },
    },
    variants: [
      {
        id: 'tote-one-size',
        title: 'One Size',
        availableForSale: true,
        price: { amount: '14.99', currencyCode: 'USD' },
        selectedOptions: [{ name: 'Size', value: 'One Size' }],
      },
    ],
  },
  {
    id: 'mock-sport-bag',
    title: 'MiniMusiker Sport Bag',
    description: 'Perfect for musicians on the go! This spacious sport bag has room for instruments, sheet music, and all your gear.',
    productType: 'Accessories',
    handle: 'minimusiker-sport-bag',
    tags: ['minimusiker-shop', 'accessories', 'bags'],
    availableForSale: true,
    images: [
      {
        id: 'sport-bag-img-1',
        url: '/images/products/sport_bag.jpeg',
        altText: 'MiniMusiker Sport Bag',
      },
    ],
    priceRange: {
      minVariantPrice: { amount: '34.99', currencyCode: 'USD' },
      maxVariantPrice: { amount: '34.99', currencyCode: 'USD' },
    },
    variants: [
      {
        id: 'sport-bag-one-size',
        title: 'One Size',
        availableForSale: true,
        price: { amount: '34.99', currencyCode: 'USD' },
        selectedOptions: [{ name: 'Size', value: 'One Size' }],
      },
    ],
  },
];

/**
 * GET /api/shopify/products
 * Fetches products from Shopify, or returns mock data for development
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');
    const category = searchParams.get('category');

    // Check if Shopify integration is enabled
    const isShopifyEnabled = process.env.ENABLE_SHOPIFY_INTEGRATION === 'true';

    let products: Product[];

    if (isShopifyEnabled) {
      // Fetch from Shopify
      const tagFilter = tag || 'minimusiker-shop';
      products = await shopifyService.getProducts(tagFilter);
    } else {
      // Use mock products for development
      products = MOCK_PRODUCTS;
    }

    // Filter by category (productType) if specified
    if (category) {
      products = products.filter(
        (product) => product.productType.toLowerCase() === category.toLowerCase()
      );
    }

    // Filter out unavailable products
    products = products.filter((product) => product.availableForSale);

    return NextResponse.json({
      products,
      count: products.length,
    });
  } catch (error) {
    console.error('Error fetching products:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch products',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
