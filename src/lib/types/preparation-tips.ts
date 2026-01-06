// Preparation Tips Type Definitions
// Tips shown to teachers on dashboard

// =============================================================================
// AIRTABLE TABLE IDs
// =============================================================================

export const PREPARATION_TIPS_TABLE_ID = 'tblK7bBTL4dtv4zqm';

// =============================================================================
// AIRTABLE FIELD IDs
// =============================================================================

export const PREPARATION_TIPS_FIELD_IDS = {
  title: 'fld9pFKaGaLGW0jWw', // Single line text - Tip title
  content: 'fldQV6xCSnhytK2Gk', // Long text - Full tip description
  order: 'fldrO5NYAABHGYrsr', // Number - Display order (1, 2, 3...)
  active: 'fldC1i1Y6cLJm29kY', // Checkbox - Show/hide this tip
  icon_name: 'fldf4QqiYOrtVGv8z', // Single line text - Optional icon identifier
} as const;

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * PreparationTip - Helpful tip for teachers preparing for event
 */
export interface PreparationTip {
  id: string; // Airtable record ID
  title: string; // Tip title (e.g., "Weniger ist mehr")
  content: string; // Full tip description/explanation
  order: number; // Display order (1, 2, 3...)
  active: boolean; // Whether this tip is shown to teachers
  iconName?: string; // Optional icon identifier
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Response for GET /api/teacher/tips
 */
export interface PreparationTipsResponse {
  tips: PreparationTip[];
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Airtable record wrapper for PreparationTip
 */
export interface AirtablePreparationTipRecord {
  id: string;
  fields: {
    [key: string]: string | number | boolean | null | undefined;
  };
  createdTime?: string;
}

/**
 * Airtable list response for PreparationTips
 */
export interface AirtablePreparationTipsListResponse {
  records: AirtablePreparationTipRecord[];
  offset?: string;
}
