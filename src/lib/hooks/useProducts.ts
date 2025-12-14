'use client';

/**
 * Custom hook for fetching products from Shopify
 */

import { useState, useEffect, useCallback } from 'react';
import { Product } from '../types/airtable';

interface UseProductsOptions {
  tagFilter?: string;
  category?: string;
  initialProducts?: Product[];
}

interface UseProductsResult {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useProducts(options: UseProductsOptions = {}): UseProductsResult {
  const { tagFilter, category, initialProducts } = options;

  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [isLoading, setIsLoading] = useState(!initialProducts);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (tagFilter) params.set('tag', tagFilter);
      if (category) params.set('category', category);

      const url = `/api/shopify/products${params.toString() ? `?${params}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error('Error fetching products:', err);
      setError(err instanceof Error ? err.message : 'Failed to load products');
    } finally {
      setIsLoading(false);
    }
  }, [tagFilter, category]);

  useEffect(() => {
    if (!initialProducts) {
      fetchProducts();
    }
  }, [fetchProducts, initialProducts]);

  return {
    products,
    isLoading,
    error,
    refetch: fetchProducts,
  };
}

/**
 * Hook for fetching a single product by handle
 */
export function useProduct(handle: string | null): {
  product: Product | null;
  isLoading: boolean;
  error: string | null;
} {
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(!!handle);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) {
      setProduct(null);
      setIsLoading(false);
      return;
    }

    const fetchProduct = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/shopify/products/${handle}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Product not found');
          }
          throw new Error('Failed to fetch product');
        }

        const data = await response.json();
        setProduct(data.product);
      } catch (err) {
        console.error('Error fetching product:', err);
        setError(err instanceof Error ? err.message : 'Failed to load product');
        setProduct(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [handle]);

  return {
    product,
    isLoading,
    error,
  };
}

export default useProducts;
