/**
 * Shopify Token Manager
 *
 * Handles OAuth 2.0 Client Credentials Grant for Shopify Admin API access.
 * The new Shopify Dev Dashboard (2025) uses short-lived tokens (24 hours)
 * instead of static Admin API tokens.
 *
 * Usage:
 *   const token = await tokenManager.getAccessToken();
 *   // Use token for Admin API requests
 */

interface TokenResponse {
  access_token: string;
  scope: string;
  expires_in: number; // seconds (86399 = 24 hours)
}

interface CachedToken {
  token: string;
  expiresAt: Date;
}

class ShopifyTokenManager {
  private cachedToken: CachedToken | null = null;

  // Buffer time before expiry to refresh (5 minutes)
  private readonly REFRESH_BUFFER_MS = 5 * 60 * 1000;

  /**
   * Get a valid access token, fetching a new one if necessary
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid (with buffer for safety)
    if (this.isTokenValid()) {
      return this.cachedToken!.token;
    }

    // Request new token via Client Credentials Grant
    return this.refreshToken();
  }

  /**
   * Check if we have a cached token that's still valid
   */
  private isTokenValid(): boolean {
    if (!this.cachedToken) return false;

    const now = new Date();
    const expiryWithBuffer = new Date(
      this.cachedToken.expiresAt.getTime() - this.REFRESH_BUFFER_MS
    );

    return now < expiryWithBuffer;
  }

  /**
   * Request a new token from Shopify using Client Credentials Grant
   */
  private async refreshToken(): Promise<string> {
    // Support both naming conventions
    const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
    const clientId = process.env.SHOPIFY_CLIENT_ID;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_SECRET;

    if (!storeDomain || !clientId || !clientSecret) {
      throw new Error(
        'Missing Shopify credentials. Please set SHOPIFY_STORE_DOMAIN (or NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN), ' +
        'SHOPIFY_CLIENT_ID, and SHOPIFY_CLIENT_SECRET (or SHOPIFY_SECRET) environment variables.'
      );
    }

    const tokenUrl = `https://${storeDomain}/admin/oauth/access_token`;

    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Shopify token request failed:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(
          `Failed to obtain Shopify access token: ${response.status} ${response.statusText}`
        );
      }

      const data: TokenResponse = await response.json();

      // Cache the token with expiry time
      this.cachedToken = {
        token: data.access_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
      };

      console.log(
        `[ShopifyTokenManager] New token obtained, expires at ${this.cachedToken.expiresAt.toISOString()}`
      );

      return data.access_token;
    } catch (error) {
      console.error('[ShopifyTokenManager] Token refresh failed:', error);
      throw error;
    }
  }

  /**
   * Clear the cached token (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cachedToken = null;
  }

  /**
   * Get token expiry time (for debugging/monitoring)
   */
  getTokenExpiry(): Date | null {
    return this.cachedToken?.expiresAt ?? null;
  }

  /**
   * Check if token manager is properly configured
   */
  isConfigured(): boolean {
    const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN;
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_SECRET;
    return !!(storeDomain && process.env.SHOPIFY_CLIENT_ID && clientSecret);
  }
}

// Export singleton instance
export const tokenManager = new ShopifyTokenManager();

// Export class for testing
export { ShopifyTokenManager };
