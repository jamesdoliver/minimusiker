// Teacher Resources Type Definitions
// Resources shown to teachers in the "Liedvorschläge & Material" section

// =============================================================================
// AIRTABLE TABLE IDs
// =============================================================================

export const TEACHER_RESOURCES_TABLE_ID = 'tblaRsMdEW1gmGh1X';

// =============================================================================
// AIRTABLE FIELD NAMES
// =============================================================================

// Note: Using field names instead of IDs since Airtable returns names by default
export const TEACHER_RESOURCES_FIELD_NAMES = {
  resource_key: 'resource_key', // Single line text (Primary) - e.g., "resource1", "resource2", "resource3"
  pdf_url: 'pdf_url', // Single line text - URL for PDF download
  display_title: 'display_title', // Single line text - Display name
} as const;

// Keep field IDs for reference (if needed with returnFieldsByFieldId option)
export const TEACHER_RESOURCES_FIELD_IDS = {
  resource_key: 'fldv29iEAXPvtw1UJ',
  pdf_url: 'fld0IHtOhSXMZuIiQ',
  display_title: 'fld6SquD5v8vs9J8K',
} as const;

// =============================================================================
// INTERFACES
// =============================================================================

/**
 * TeacherResource - A downloadable resource for teachers
 */
export interface TeacherResource {
  id: string; // Airtable record ID
  resourceKey: string; // Identifier (resource1, resource2, resource3)
  pdfUrl: string; // Dropbox URL for download
  displayTitle: string; // Display name shown to users
}

// =============================================================================
// API RESPONSE TYPES
// =============================================================================

/**
 * Response for GET /api/teacher/resources
 */
export interface TeacherResourcesResponse {
  resources: TeacherResource[];
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Transform Dropbox sharing URL to direct download URL
 * Changes ?dl=0 to ?dl=1 for direct download
 */
export function toDropboxDirectDownload(url: string): string {
  if (!url) return url;

  // Handle various Dropbox URL formats
  if (url.includes('dropbox.com')) {
    // Replace dl=0 with dl=1
    if (url.includes('?dl=0')) {
      return url.replace('?dl=0', '?dl=1');
    }
    // Add dl=1 if no dl parameter
    if (!url.includes('dl=')) {
      return url + (url.includes('?') ? '&dl=1' : '?dl=1');
    }
  }

  return url;
}
