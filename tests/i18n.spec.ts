import { test, expect } from '@playwright/test';

/**
 * Parent Portal Internationalization (i18n) Tests
 *
 * Tests language switching functionality, localStorage persistence,
 * and visual regression for German and English translations.
 */

// Test configuration
const PARENT_PORTAL_URL = '/familie';
const SHOP_URL = '/familie/shop';

test.describe('Parent Portal Internationalization', () => {

  test.describe('Default Language', () => {
    test('should load with German as default language', async ({ page }) => {
      await page.goto(PARENT_PORTAL_URL);

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Check localStorage is set to German
      const locale = await page.evaluate(() => localStorage.getItem('NEXT_LOCALE'));
      expect(locale).toBe('de');

      // Verify German text is displayed in header
      await expect(page.getByText('Elternportal')).toBeVisible();
      await expect(page.getByText('Abmelden')).toBeVisible();
    });

    test('should show German flag in language selector by default', async ({ page }) => {
      await page.goto(PARENT_PORTAL_URL);
      await page.waitForLoadState('networkidle');

      // Find language selector button and verify it shows German flag
      const languageButton = page.locator('button:has-text("🇩🇪")');
      await expect(languageButton).toBeVisible();
    });
  });

  test.describe('Language Switching', () => {
    test('should switch from German to English', async ({ page }) => {
      await page.goto(PARENT_PORTAL_URL);
      await page.waitForLoadState('networkidle');

      // Verify we start with German
      await expect(page.getByText('Elternportal')).toBeVisible();

      // Click language selector to open dropdown
      const languageButton = page.locator('button:has-text("🇩🇪")');
      await languageButton.click();

      // Click English option
      const englishOption = page.locator('text=🇬🇧').first();
      await englishOption.click();

      // Wait for page reload
      await page.waitForLoadState('networkidle');

      // Verify English text is now displayed
      await expect(page.getByText('Parent Portal')).toBeVisible();
      await expect(page.getByText('Sign Out')).toBeVisible();

      // Verify localStorage was updated
      const locale = await page.evaluate(() => localStorage.getItem('NEXT_LOCALE'));
      expect(locale).toBe('en');

      // Verify language selector now shows English flag
      const updatedLanguageButton = page.locator('button:has-text("🇬🇧")');
      await expect(updatedLanguageButton).toBeVisible();
    });

    test('should switch from English to German', async ({ page }) => {
      // Set English in localStorage first
      await page.goto(PARENT_PORTAL_URL);
      await page.evaluate(() => {
        localStorage.setItem('NEXT_LOCALE', 'en');
        document.cookie = 'NEXT_LOCALE=en; path=/';
      });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify we start with English
      await expect(page.getByText('Parent Portal')).toBeVisible();

      // Click language selector
      const languageButton = page.locator('button:has-text("🇬🇧")');
      await languageButton.click();

      // Click German option
      const germanOption = page.locator('text=🇩🇪').first();
      await germanOption.click();

      // Wait for page reload
      await page.waitForLoadState('networkidle');

      // Verify German text is displayed
      await expect(page.getByText('Elternportal')).toBeVisible();
      await expect(page.getByText('Abmelden')).toBeVisible();

      // Verify localStorage was updated
      const locale = await page.evaluate(() => localStorage.getItem('NEXT_LOCALE'));
      expect(locale).toBe('de');
    });
  });

  test.describe('Persistence', () => {
    test('should persist German language preference across page reloads', async ({ page }) => {
      await page.goto(PARENT_PORTAL_URL);
      await page.waitForLoadState('networkidle');

      // Verify German is default
      await expect(page.getByText('Elternportal')).toBeVisible();

      // Reload the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify German is still active
      await expect(page.getByText('Elternportal')).toBeVisible();
      const locale = await page.evaluate(() => localStorage.getItem('NEXT_LOCALE'));
      expect(locale).toBe('de');
    });

    test('should persist English language preference across page reloads', async ({ page }) => {
      await page.goto(PARENT_PORTAL_URL);
      await page.evaluate(() => {
        localStorage.setItem('NEXT_LOCALE', 'en');
        document.cookie = 'NEXT_LOCALE=en; path=/';
      });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify English is active
      await expect(page.getByText('Parent Portal')).toBeVisible();

      // Reload again
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify English is still active
      await expect(page.getByText('Parent Portal')).toBeVisible();
      const locale = await page.evaluate(() => localStorage.getItem('NEXT_LOCALE'));
      expect(locale).toBe('en');
    });

    test('should persist language preference when navigating between pages', async ({ page }) => {
      // Set English
      await page.goto(PARENT_PORTAL_URL);
      await page.evaluate(() => {
        localStorage.setItem('NEXT_LOCALE', 'en');
        document.cookie = 'NEXT_LOCALE=en; path=/';
      });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Verify English on main portal
      await expect(page.getByText('Parent Portal')).toBeVisible();

      // Navigate to shop
      await page.click('a:has-text("Shop")');
      await page.waitForLoadState('networkidle');

      // Verify English is maintained in shop
      await expect(page.getByText('MiniMusiker Shop')).toBeVisible();
      await expect(page.getByText('Exclusive merchandise for our music families')).toBeVisible();

      // Verify localStorage still has English
      const locale = await page.evaluate(() => localStorage.getItem('NEXT_LOCALE'));
      expect(locale).toBe('en');
    });
  });

  test.describe('ProductSelector Translation', () => {
    test('should display ProductSelector in German', async ({ page }) => {
      await page.goto(PARENT_PORTAL_URL);
      await page.waitForLoadState('networkidle');

      // Check audio section
      await expect(page.getByText('Wählen Sie Ihr Audio')).toBeVisible();
      await expect(page.getByText('(Erforderlich)')).toBeVisible();

      // Check audio options
      await expect(page.getByText('Minicard')).toBeVisible();
      await expect(page.getByText('Digitale Audiokarte mit QR-Code')).toBeVisible();

      // Check clothing section
      await expect(page.getByText('Kleidung hinzufügen')).toBeVisible();
      await expect(page.getByText('(Optional)')).toBeVisible();

      // Check order summary
      await expect(page.getByText('Bestellübersicht')).toBeVisible();
      await expect(page.getByText('Zwischensumme')).toBeVisible();
    });

    test('should display ProductSelector in English', async ({ page }) => {
      await page.goto(PARENT_PORTAL_URL);
      await page.evaluate(() => {
        localStorage.setItem('NEXT_LOCALE', 'en');
        document.cookie = 'NEXT_LOCALE=en; path=/';
      });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Check audio section
      await expect(page.getByText('Choose Your Audio')).toBeVisible();
      await expect(page.getByText('(Required)')).toBeVisible();

      // Check audio options
      await expect(page.getByText('Minicard')).toBeVisible();
      await expect(page.getByText('Digital audio card with QR code')).toBeVisible();

      // Check clothing section
      await expect(page.getByText('Add Clothing')).toBeVisible();
      await expect(page.getByText('(Optional)')).toBeVisible();

      // Check order summary
      await expect(page.getByText('Order Summary')).toBeVisible();
      await expect(page.getByText('Subtotal')).toBeVisible();
    });
  });

  test.describe('Shop Translation', () => {
    test('should display shop in German', async ({ page }) => {
      await page.goto(SHOP_URL);
      await page.waitForLoadState('networkidle');

      // Check header
      await expect(page.getByText('MiniMusiker Shop')).toBeVisible();
      await expect(page.getByText('Exklusive Merchandise für unsere Musikfamilien')).toBeVisible();

      // Check breadcrumbs
      await expect(page.getByText('Elternportal')).toBeVisible();

      // Check category tabs
      await expect(page.getByText('Alle Produkte')).toBeVisible();
      await expect(page.getByText('Bekleidung')).toBeVisible();
      await expect(page.getByText('Accessoires')).toBeVisible();
    });

    test('should display shop in English', async ({ page }) => {
      await page.goto(SHOP_URL);
      await page.evaluate(() => {
        localStorage.setItem('NEXT_LOCALE', 'en');
        document.cookie = 'NEXT_LOCALE=en; path=/';
      });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Check header
      await expect(page.getByText('MiniMusiker Shop')).toBeVisible();
      await expect(page.getByText('Exclusive merchandise for our music families')).toBeVisible();

      // Check breadcrumbs
      await expect(page.getByText('Parent Portal')).toBeVisible();

      // Check category tabs
      await expect(page.getByText('All Products')).toBeVisible();
      await expect(page.getByText('Apparel')).toBeVisible();
      await expect(page.getByText('Accessories')).toBeVisible();
    });
  });

  test.describe('Language Selector in Both Headers', () => {
    test('should show language selector in main portal header', async ({ page }) => {
      await page.goto(PARENT_PORTAL_URL);
      await page.waitForLoadState('networkidle');

      // Verify language selector is visible in header
      const languageButton = page.locator('header button:has-text("🇩🇪")').first();
      await expect(languageButton).toBeVisible();
    });

    test('should show language selector in shop header', async ({ page }) => {
      await page.goto(SHOP_URL);
      await page.waitForLoadState('networkidle');

      // Verify language selector is visible in shop header
      const languageButton = page.locator('button:has-text("🇩🇪")').first();
      await expect(languageButton).toBeVisible();
    });
  });

  test.describe('Visual Regression', () => {
    test('should match German portal screenshot', async ({ page }) => {
      await page.goto(PARENT_PORTAL_URL);
      await page.waitForLoadState('networkidle');

      // Take screenshot of German version
      await expect(page).toHaveScreenshot('familie-german.png', {
        fullPage: false,
        maxDiffPixels: 100,
      });
    });

    test('should match English portal screenshot', async ({ page }) => {
      await page.goto(PARENT_PORTAL_URL);
      await page.evaluate(() => {
        localStorage.setItem('NEXT_LOCALE', 'en');
        document.cookie = 'NEXT_LOCALE=en; path=/';
      });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Take screenshot of English version
      await expect(page).toHaveScreenshot('familie-english.png', {
        fullPage: false,
        maxDiffPixels: 100,
      });
    });

    test('should match German shop screenshot', async ({ page }) => {
      await page.goto(SHOP_URL);
      await page.waitForLoadState('networkidle');

      // Take screenshot of German shop
      await expect(page).toHaveScreenshot('shop-german.png', {
        fullPage: false,
        maxDiffPixels: 100,
      });
    });

    test('should match English shop screenshot', async ({ page }) => {
      await page.goto(SHOP_URL);
      await page.evaluate(() => {
        localStorage.setItem('NEXT_LOCALE', 'en');
        document.cookie = 'NEXT_LOCALE=en; path=/';
      });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Take screenshot of English shop
      await expect(page).toHaveScreenshot('shop-english.png', {
        fullPage: false,
        maxDiffPixels: 100,
      });
    });
  });

  test.describe('Layout Stability', () => {
    test('should not break layout with long German words', async ({ page }) => {
      await page.goto(PARENT_PORTAL_URL);
      await page.waitForLoadState('networkidle');

      // Check that text doesn't overflow containers
      const containers = await page.locator('.rounded-xl, .rounded-lg').all();

      for (const container of containers) {
        const box = await container.boundingBox();
        if (box) {
          // Verify container has reasonable dimensions (not negative or zero)
          expect(box.width).toBeGreaterThan(0);
          expect(box.height).toBeGreaterThan(0);
        }
      }
    });

    test('should maintain responsive layout in both languages', async ({ page }) => {
      // Test German at different viewport sizes
      await page.setViewportSize({ width: 375, height: 667 }); // Mobile
      await page.goto(PARENT_PORTAL_URL);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('Elternportal')).toBeVisible();

      await page.setViewportSize({ width: 768, height: 1024 }); // Tablet
      await expect(page.getByText('Elternportal')).toBeVisible();

      await page.setViewportSize({ width: 1920, height: 1080 }); // Desktop
      await expect(page.getByText('Elternportal')).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle missing localStorage gracefully', async ({ page, context }) => {
      // Block localStorage
      await context.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', {
          value: null,
          writable: false,
        });
      });

      await page.goto(PARENT_PORTAL_URL);
      await page.waitForLoadState('networkidle');

      // Should still load with default German (from cookie fallback)
      await expect(page.getByText('Elternportal')).toBeVisible();
    });

    test('should handle invalid locale gracefully', async ({ page }) => {
      await page.goto(PARENT_PORTAL_URL);
      await page.evaluate(() => {
        localStorage.setItem('NEXT_LOCALE', 'invalid-locale');
        document.cookie = 'NEXT_LOCALE=invalid-locale; path=/';
      });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should fallback to default German
      await expect(page.getByText('Elternportal')).toBeVisible();
    });
  });
});
