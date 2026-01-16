import {
  SimplybookBooking,
  SimplybookJsonRpcRequest,
  SimplybookJsonRpcResponse,
  SimplybookTokenResponse,
  MappedBookingData,
} from '@/lib/types/simplybook';
import {
  PERSONEN_TABLE_ID,
  PERSONEN_FIELD_IDS,
  EINRICHTUNGEN_TABLE_ID,
  EINRICHTUNGEN_FIELD_IDS,
  TEAMS_REGIONEN_TABLE_ID,
} from '@/lib/types/airtable';
import Airtable from 'airtable';

/**
 * SimplyBook API Service
 * Handles authentication and API calls to SimplyBook
 *
 * Authentication:
 * - getToken (API key): For public API methods (booking lookups)
 * - getUserToken (user credentials): For admin API methods (getBookings, etc.)
 */
class SimplybookService {
  private apiKey: string;
  private secretKey: string;
  private companyLogin: string;
  private userLogin: string;
  private userPassword: string;
  private jsonRpcEndpoint: string;
  private restApiEndpoint: string;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;
  private adminToken: string | null = null;
  private adminTokenExpiry: Date | null = null;
  private airtable: Airtable.Base;

  constructor() {
    this.apiKey = process.env.SIMPLYBOOK_API_KEY || '';
    this.secretKey = process.env.SIMPLYBOOK_API_SECRET || '';
    this.companyLogin = process.env.SIMPLY_BOOK_ACCOUNT_NAME || '';
    this.userLogin = process.env.SIMPLYBOOK_USER_LOGIN || '';
    this.userPassword = process.env.SIMPLYBOOK_USER_PASSWORD || '';
    this.jsonRpcEndpoint = process.env.SIMPLYBOOK_JSON_RCP_API_ENDPOINT || 'https://user-api.simplybook.it/';
    this.restApiEndpoint = process.env.SIMPLYBOOK_RESP_API_ENDPOINT || 'https://user-api-v2.simplybook.it/';

    // Initialize Airtable
    const airtableApiKey = process.env.AIRTABLE_API_KEY || '';
    const airtableBaseId = process.env.AIRTABLE_BASE_ID || '';
    this.airtable = new Airtable({ apiKey: airtableApiKey }).base(airtableBaseId);
  }

  /**
   * Get authentication token from SimplyBook API
   * Uses JSON-RPC protocol
   */
  async getToken(): Promise<string> {
    // Return cached token if still valid (tokens expire after ~1 hour)
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    const request: SimplybookJsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'getToken',
      params: [this.companyLogin, this.apiKey],
      id: 1,
    };

    try {
      const response = await fetch(`${this.jsonRpcEndpoint}login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`SimplyBook auth failed: ${response.status}`);
      }

      const data: SimplybookJsonRpcResponse<string> = await response.json();

      if (data.error) {
        throw new Error(`SimplyBook auth error: ${data.error.message}`);
      }

      if (!data.result) {
        throw new Error('SimplyBook auth: No token returned');
      }

      this.token = data.result;
      // Set expiry to 50 minutes from now (tokens last ~1 hour)
      this.tokenExpiry = new Date(Date.now() + 50 * 60 * 1000);

      return this.token;
    } catch (error) {
      console.error('SimplyBook getToken error:', error);
      throw error;
    }
  }

  /**
   * Get admin authentication token from SimplyBook API
   * Uses getUserToken method which requires user login/password
   * Required for admin API methods like getBookings
   */
  async getAdminToken(): Promise<string> {
    // Return cached token if still valid
    if (this.adminToken && this.adminTokenExpiry && new Date() < this.adminTokenExpiry) {
      return this.adminToken;
    }

    if (!this.userLogin || !this.userPassword) {
      throw new Error('SimplyBook admin credentials not configured. Set SIMPLYBOOK_USER_LOGIN and SIMPLYBOOK_USER_PASSWORD.');
    }

    const request: SimplybookJsonRpcRequest = {
      jsonrpc: '2.0',
      method: 'getUserToken',
      params: [this.companyLogin, this.userLogin, this.userPassword],
      id: 1,
    };

    try {
      const response = await fetch(`${this.jsonRpcEndpoint}login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`SimplyBook admin auth failed: ${response.status}`);
      }

      const data: SimplybookJsonRpcResponse<string> = await response.json();

      if (data.error) {
        throw new Error(`SimplyBook admin auth error: ${data.error.message}`);
      }

      if (!data.result) {
        throw new Error('SimplyBook admin auth: No token returned');
      }

      this.adminToken = data.result;
      // Set expiry to 50 minutes from now
      this.adminTokenExpiry = new Date(Date.now() + 50 * 60 * 1000);

      return this.adminToken;
    } catch (error) {
      console.error('SimplyBook getAdminToken error:', error);
      throw error;
    }
  }

  /**
   * Make an authenticated JSON-RPC call to SimplyBook
   * @param useAdminAuth - If true, uses admin token (getUserToken) instead of API key token
   */
  private async jsonRpcCall<T>(method: string, params: unknown[], useAdminAuth = false): Promise<T> {
    const token = useAdminAuth ? await this.getAdminToken() : await this.getToken();

    const request: SimplybookJsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now(),
    };

    // Use X-User-Token header for admin auth, X-Token for regular auth
    const tokenHeader = useAdminAuth ? 'X-User-Token' : 'X-Token';

    const response = await fetch(`${this.jsonRpcEndpoint}admin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Company-Login': this.companyLogin,
        [tokenHeader]: token,
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`SimplyBook API error: ${response.status}`);
    }

    const data: SimplybookJsonRpcResponse<T> = await response.json();

    if (data.error) {
      throw new Error(`SimplyBook API error: ${data.error.message}`);
    }

    return data.result as T;
  }

  /**
   * Fetch full booking details by booking ID
   * Requires admin authentication (getUserToken)
   */
  async getBookingDetails(bookingId: string): Promise<SimplybookBooking> {
    try {
      // Use the getBookingDetails method from SimplyBook API with admin auth
      const booking = await this.jsonRpcCall<SimplybookBooking>('getBookingDetails', [bookingId], true);
      return booking;
    } catch (error) {
      console.error('Error fetching booking details:', error);
      throw error;
    }
  }

  /**
   * Fetch multiple bookings with optional filters
   * Uses the SimplyBook getBookings API method
   * Requires admin authentication (getUserToken)
   */
  async getBookings(filters?: {
    dateFrom?: string;
    dateTo?: string;
    isConfirmed?: boolean;
    bookingType?: 'cancelled' | 'approved' | 'pending';
  }): Promise<SimplybookBooking[]> {
    try {
      const params: Record<string, unknown> = {};

      if (filters?.dateFrom) params.date_from = filters.dateFrom;
      if (filters?.dateTo) params.date_to = filters.dateTo;
      if (filters?.isConfirmed !== undefined) {
        params.is_confirmed = filters.isConfirmed ? 1 : 0;
      }
      if (filters?.bookingType) params.booking_type = filters.bookingType;

      // Sort by booking date descending (most recent first)
      params.order = 'date_start';

      // Use admin auth for getBookings (requires getUserToken)
      const bookings = await this.jsonRpcCall<SimplybookBooking[]>('getBookings', [params], true);
      return bookings || [];
    } catch (error) {
      console.error('Error fetching bookings:', error);
      throw error;
    }
  }

  /**
   * Map SimplyBook intake form fields to our internal schema
   * Field names are in German, need to map appropriately
   * Note: SimplyBook API returns additional_fields as an array with field_title property
   */
  mapIntakeFields(booking: SimplybookBooking): MappedBookingData {
    const rawFields = booking.additional_fields || [];

    // Normalize fields to array format (handle both array and object responses)
    const fieldsArray = Array.isArray(rawFields)
      ? rawFields
      : Object.values(rawFields);

    // Helper to find field by partial title match (case-insensitive)
    const findField = (keywords: string[]): string => {
      for (const field of fieldsArray) {
        // Skip if field is undefined
        if (!field) continue;
        // Check both field_title (actual API) and title (legacy/backward compat)
        const title = field.field_title || field.title || '';
        if (!title) continue;
        const titleLower = title.toLowerCase();
        if (keywords.some(kw => titleLower.includes(kw.toLowerCase()))) {
          return field.value || '';
        }
      }
      return '';
    };

    // Parse number of children from string
    const childrenStr = findField(['kinder', 'children', 'anzahl']);
    const numberOfChildren = parseInt(childrenStr, 10) || 0;

    // Determine cost category based on number of children
    const costCategory: '>150 children' | '<150 children' =
      numberOfChildren > 150 ? '>150 children' : '<150 children';

    // Extract booking date from start_date_time or start_date
    const bookingDate = booking.start_date || booking.start_date_time?.split(' ')[0] || '';

    // School name: prefer 'client' field (where SimplyBook stores it), then additional_fields, then client_name
    const schoolNameFromFields = findField(['name', 'schule', 'school', 'einrichtung']);
    const schoolName = booking.client || schoolNameFromFields || booking.client_name || '';

    // Extract region from unit_name (e.g., "Minimusiker Köln/Bonn" -> "Köln/Bonn")
    let region: string | undefined;
    if (booking.unit_name) {
      // Strip "Minimusiker " prefix if present
      region = booking.unit_name.replace(/^Minimusiker\s+/i, '').trim() || undefined;
    }

    // City: prefer client_city, then "Ort" from intake form
    const city = booking.client_city || findField(['ort', 'stadt', 'city']) || undefined;

    return {
      schoolName,
      contactPerson: findField(['ansprechpartner', 'ansprechperson', 'contact person', 'contact', 'kontakt']) || booking.client_name || '',
      contactEmail: booking.client_email || findField(['email', 'e-mail']) || '',
      phone: booking.client_phone || findField(['telefon', 'phone', 'tel']) || undefined,
      address: findField(['adresse', 'address', 'strasse', 'street']) || booking.client_address1 || undefined,
      postalCode: findField(['plz', 'postal', 'postleitzahl', 'postcode']) || booking.client_zip || undefined,
      region,
      city,
      numberOfChildren,
      costCategory,
      bookingDate,
    };
  }

  /**
   * Find staff member by region in Personen table
   * Matches against the Teams/Regionen field
   */
  async findStaffByRegion(region: string | undefined): Promise<string | null> {
    if (!region) return null;

    try {
      const records = await this.airtable
        .table(PERSONEN_TABLE_ID)
        .select({
          filterByFormula: `FIND("${region}", {Teams/Regionen})`,
          maxRecords: 1,
        })
        .firstPage();

      return records[0]?.id || null;
    } catch (error) {
      console.error('Error finding staff by region:', error);
      return null;
    }
  }

  /**
   * Normalize region name for matching
   * Converts separators (/, -, space) to common format and lowercases
   * This handles mismatches like "Rhein-Main-Neckar" vs "Rhein/Main/Neckar"
   */
  private normalizeRegionName(name: string): string {
    if (!name) return '';
    // Replace all separators (dash, space) with forward slash
    // Then lowercase for case-insensitive matching
    return name
      .replace(/[-\s]+/g, '/')
      .toLowerCase()
      .trim();
  }

  /**
   * Find Teams/Regionen record ID by region name
   * Uses normalized substring matching to handle:
   * - Separator differences (e.g., "Rhein-Main-Neckar" matches "Rhein/Main/Neckar")
   * - Partial names (e.g., "Osnabrück/OWL/Paderborn" matches "Osnabrück")
   * Returns the record ID for linking, or null if not found
   */
  async findTeamsRegionenByName(regionName: string | undefined): Promise<string | null> {
    if (!regionName) return null;

    const normalizedInput = this.normalizeRegionName(regionName);
    if (!normalizedInput) return null;

    try {
      const records = await this.airtable
        .table(TEAMS_REGIONEN_TABLE_ID)
        .select({ fields: ['Name'] })
        .firstPage();

      // Find best match using substring matching
      // Prefer exact matches, then longest substring match
      let bestMatch: { id: string; name: string; length: number } | null = null;

      for (const record of records) {
        const name = record.get('Name') as string;
        if (!name) continue;

        const normalizedName = this.normalizeRegionName(name);

        // Exact match - return immediately
        if (normalizedName === normalizedInput) {
          return record.id;
        }

        // Check if Airtable name is contained in SimplyBook input
        // e.g., "osnabrück" is in "osnabrück/owl/paderborn"
        if (normalizedInput.includes(normalizedName)) {
          if (!bestMatch || normalizedName.length > bestMatch.length) {
            bestMatch = { id: record.id, name, length: normalizedName.length };
          }
        }
      }

      return bestMatch?.id || null;
    } catch (error) {
      console.error('Error finding Teams/Regionen by name:', error);
      return null;
    }
  }

  /**
   * Find existing Einrichtung (school) by name and optionally postal code
   */
  async findEinrichtungByName(schoolName: string, postalCode?: string): Promise<string | null> {
    if (!schoolName) return null;

    try {
      // Escape special characters for Airtable formula
      const escapedName = schoolName.replace(/"/g, '\\"');

      // Try exact name match first
      let records = await this.airtable
        .table(EINRICHTUNGEN_TABLE_ID)
        .select({
          filterByFormula: `LOWER({customer_name}) = LOWER("${escapedName}")`,
          maxRecords: 1,
        })
        .firstPage();

      if (records.length > 0) {
        return records[0].id;
      }

      // If no exact match, try partial match with postal code
      if (postalCode) {
        records = await this.airtable
          .table(EINRICHTUNGEN_TABLE_ID)
          .select({
            filterByFormula: `AND(FIND(LOWER("${escapedName}"), LOWER({customer_name})), {plz} = "${postalCode}")`,
            maxRecords: 1,
          })
          .firstPage();

        if (records.length > 0) {
          return records[0].id;
        }
      }

      // Try partial name match as last resort
      records = await this.airtable
        .table(EINRICHTUNGEN_TABLE_ID)
        .select({
          filterByFormula: `FIND(LOWER("${escapedName}"), LOWER({customer_name}))`,
          maxRecords: 1,
        })
        .firstPage();

      return records[0]?.id || null;
    } catch (error) {
      console.error('Error finding Einrichtung by name:', error);
      return null;
    }
  }
}

// Export singleton instance
export const simplybookService = new SimplybookService();
export default simplybookService;
