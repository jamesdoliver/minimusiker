import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string to a readable format
 */
export function formatDate(date: string | Date | undefined | null, options?: Intl.DateTimeFormatOptions) {
  // Handle null/undefined dates
  if (!date) {
    return 'No date';
  }

  const d = typeof date === 'string' ? new Date(date) : date;

  // Check if date is valid
  if (isNaN(d.getTime())) {
    return 'Invalid date';
  }

  return d.toLocaleDateString('en-US', options || {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format a price in cents to a currency string
 */
export function formatPrice(cents: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

/**
 * Generate a random string for tokens
 */
export function generateToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncate(str: string, maxLength: number) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Debounce function to limit function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function (this: any, ...args: Parameters<T>) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const context = this;

    if (timeout) clearTimeout(timeout);

    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Check if we're running on the server or client
 */
export const isServer = typeof window === 'undefined';

/**
 * Get initials from a name
 */
export function getInitials(name: string) {
  const parts = name.trim().split(' ');
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Sleep function for delays
 */
export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}