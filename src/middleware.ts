import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n/config';

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'never', // Don't add locale to URL paths
  localeDetection: false, // We'll handle detection via localStorage + cookies
});

export const config = {
  // Temporarily disabled to test if middleware is causing 404
  matcher: [],
  // matcher: ['/parent-portal/:path*'],
};
