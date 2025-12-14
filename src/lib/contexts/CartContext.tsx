'use client';

/**
 * Cart Context for MiniMusiker Shop
 * Provides global cart state management with localStorage persistence
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Product, ProductVariant } from '../types/airtable';
import { Cart, CartItem } from '../types/shop';

interface CartContextType {
  cart: Cart;
  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  isLoading: boolean;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Storage key for cart persistence
const CART_STORAGE_KEY = 'minimusiker-cart';

// Helper to calculate cart totals
const calculateCartTotals = (items: CartItem[]): { subtotal: number; itemCount: number } => {
  const subtotal = items.reduce((total, item) => {
    const price = parseFloat(item.variant.price.amount);
    return total + price * item.quantity;
  }, 0);

  const itemCount = items.reduce((count, item) => count + item.quantity, 0);

  return { subtotal, itemCount };
};

// Helper to get selected options as a record
const getSelectedOptionsRecord = (variant: ProductVariant): Record<string, string> => {
  return variant.selectedOptions.reduce(
    (acc, option) => ({
      ...acc,
      [option.name]: option.value,
    }),
    {}
  );
};

interface CartProviderProps {
  children: ReactNode;
}

export function CartProvider({ children }: CartProviderProps) {
  const [cart, setCart] = useState<Cart>({
    items: [],
    subtotal: 0,
    itemCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        const { subtotal, itemCount } = calculateCartTotals(parsed.items || []);
        setCart({
          items: parsed.items || [],
          subtotal,
          itemCount,
        });
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } catch (error) {
        console.error('Error saving cart to localStorage:', error);
      }
    }
  }, [cart, isLoading]);

  // Listen for storage events (sync across tabs)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          const { subtotal, itemCount } = calculateCartTotals(parsed.items || []);
          setCart({
            items: parsed.items || [],
            subtotal,
            itemCount,
          });
        } catch (error) {
          console.error('Error syncing cart from storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Add item to cart
  const addItem = useCallback(
    (product: Product, variant: ProductVariant, quantity: number = 1) => {
      setCart((prevCart) => {
        // Check if item with same variant already exists
        const existingItemIndex = prevCart.items.findIndex(
          (item) => item.variant.id === variant.id
        );

        let newItems: CartItem[];

        if (existingItemIndex >= 0) {
          // Update quantity of existing item
          newItems = prevCart.items.map((item, index) =>
            index === existingItemIndex
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        } else {
          // Add new item
          const newItem: CartItem = {
            product,
            variant,
            quantity,
            selectedOptions: getSelectedOptionsRecord(variant),
          };
          newItems = [...prevCart.items, newItem];
        }

        const { subtotal, itemCount } = calculateCartTotals(newItems);

        return {
          items: newItems,
          subtotal,
          itemCount,
        };
      });

      // Open cart drawer when item is added
      setIsCartOpen(true);
    },
    []
  );

  // Remove item from cart
  const removeItem = useCallback((variantId: string) => {
    setCart((prevCart) => {
      const newItems = prevCart.items.filter((item) => item.variant.id !== variantId);
      const { subtotal, itemCount } = calculateCartTotals(newItems);

      return {
        items: newItems,
        subtotal,
        itemCount,
      };
    });
  }, []);

  // Update quantity of an item
  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    if (quantity < 1) {
      // Remove item if quantity is less than 1
      removeItem(variantId);
      return;
    }

    setCart((prevCart) => {
      const newItems = prevCart.items.map((item) =>
        item.variant.id === variantId ? { ...item, quantity } : item
      );
      const { subtotal, itemCount } = calculateCartTotals(newItems);

      return {
        items: newItems,
        subtotal,
        itemCount,
      };
    });
  }, [removeItem]);

  // Clear entire cart
  const clearCart = useCallback(() => {
    setCart({
      items: [],
      subtotal: 0,
      itemCount: 0,
    });
  }, []);

  const value: CartContextType = {
    cart,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    isLoading,
    isCartOpen,
    setIsCartOpen,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// Custom hook to use cart context
export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export default CartContext;
