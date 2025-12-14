import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');

    // Check for the main heading
    await expect(page.locator('h1')).toContainText('Welcome to MiniMusiker');

    // Check for the tagline
    await expect(page.locator('text=School Music Event Management Platform')).toBeVisible();
  });

  test('should have admin portal link', async ({ page }) => {
    await page.goto('/');

    // Find and check admin portal link
    const adminLink = page.locator('text=Admin Portal');
    await expect(adminLink).toBeVisible();

    // Click on admin link
    await adminLink.click();

    // Should navigate to admin login
    await expect(page).toHaveURL(/.*admin.*/);
  });

  test('should display parent portal information', async ({ page }) => {
    await page.goto('/');

    // Check for parent portal section
    const parentSection = page.locator('text=Parent Portal');
    await expect(parentSection).toBeVisible();

    // Check for instruction text
    await expect(page.locator('text=Check your email for your personalized access link')).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    await page.goto('/');

    // Test desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('h1')).toBeVisible();

    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('h1')).toBeVisible();

    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('h1')).toBeVisible();
  });
});