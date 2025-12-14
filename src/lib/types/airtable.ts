// Airtable Table Type Definitions for parent_journey_table

// Field ID mapping for type-safe access
export const AIRTABLE_FIELD_IDS = {
  booking_id: 'fldUB8dAiQd61VncB',      // Primary field (event-level identifier)
  school_name: 'fld2Rd4S9aWGOjkJI',
  main_teacher: 'fldPscsXvYRwfvZwY',    // Primary teacher for the class
  other_teachers: 'fldZob7MwrY1QPobP',  // Additional teachers (multi-line text)
  class: 'fldJMcFElbkkPGhSe',
  class_id: 'fldtiPDposZlSD2lm',        // Class-level identifier (unique per class within event)
  registered_child: 'flddZJuHdOqeighMf',
  parent_first_name: 'fldTeWfHG1TQJbzgr',
  parent_email: 'fldwiX1CSfJZS0AIz',
  parent_telephone: 'fldYljDGY0MPzgzDx',
  email_campaigns: 'fldSTM8ogsqM357h1',
  order_number: 'fldeYzYUhAWIZxFX3',
  school_recording: 'fldDuUntIy3yUN0Am',  // Attachment field (being phased out for R2)
  event_type: 'fldOZ20fduUR0mboV',
  parent_id: 'fld4mmx0n71PSr1JM',
  booking_date: 'fldZx9CQHCvoqjJ71',    // Event date field
  child_id: 'fldGSeyNR9R1OzifJ',        // Child identifier
  registered_complete: 'fldVRM60HDfNzO12o', // Registration completion status
  total_children: 'fldonCg4373zaXQfM',   // Total number of children in class
  assigned_staff: 'fldf0OQES4ZPn6HAv',   // Linked record to Personen table
  assigned_engineer: 'fldrpMpQXkeJcGkg5',
} as const;

// Personen table field IDs
export const PERSONEN_FIELD_IDS = {
  staff_name: 'fldEBMBVfGSWpywKU',
  email: 'fldKCmnASEo1RhvLu',
  telefon: 'fld8SFo4WPV5qqk9p',
  rollen: 'fldoyimmjNZY3sBLa',
  id: 'fld72aa8nR2Nizq1v',
  teams_regionen: 'fldsd73JGjVM7BpYW',
} as const;

// SchoolBookings table (SimplyBook integration)
export const SCHOOL_BOOKINGS_TABLE_ID = 'tblrktl5eLJEWE4M6';

export const SCHOOL_BOOKINGS_FIELD_IDS = {
  simplybook_id: 'fldb5FI6ij00eICaT',
  simplybook_hash: 'fldCPoXaoI4MRrHm7',
  school_contact_name: 'fldlRful9AwfzUrOc',
  school_contact_email: 'fldv4f6768hTNZYWT',
  school_phone: 'fldWWvCFJgrjScr8R',
  school_address: 'fld9ADLgRgjBeuLCH',
  school_postal_code: 'fld1wXHFUtt2nX2Ia',
  region: 'fldWhJSIkeC3V5Dmz',
  estimated_children: 'fldqt0l7tq9ozOewd',
  school_size_category: 'fldJKJAVFZrpEH1B6',
  simplybook_status: 'fldvIdc6ABkZKCUC3',
  parent_journey_bookings: 'fldkiWoQGMFOKrBQN',
  einrichtung: 'fldtGjQmGQPQbISgy',
  main_contact_person: 'fld6LACjaOrrjZMNl',
  created_at: 'flde6vgztwk3ApqfG',
  last_modified: 'fldIpyKwOf0mQ9x35',
  // Booking date/time fields
  start_date: 'fldbCBy0CxsivACiZ',
  end_date: 'fldqQWgLRsYPoOY78',
  start_time: 'fldND0Ro5P5s0rFpv',
  end_time: 'fldPx3YI7eolApQeU',
  // Portal status for teacher portal integration
  portal_status: 'fldaIkfXwwh3XA6Qa',
  // Staff assignment for events without class data
  assigned_staff: 'fldDz8ap9nevnAzp2',
  // City field for location data
  city: 'fldiVb8duhKGIzDkD',
} as const;

// Einrichtungen (Schools) table
export const EINRICHTUNGEN_TABLE_ID = 'tblLPUjLnHZ0Y4mdB';

export const EINRICHTUNGEN_FIELD_IDS = {
  customer_name: 'fldd5jN9XxKsgXI5z',
  type: 'fldsxUs7ILiG7Dzca',
  address: 'fldtfFQS8y9l70Qq5',
  plz: 'fld8nWl4AejMioWLB',
  ort: 'fldhU7hX76qdPb6Om',
  bundesland: 'fldUyvCo3ZznMr0iE',
  number_of_children: 'fldthbM00qNoymroA',
  email: 'fldkD4t6707jjACe5',
  telephone_number: 'flddwfd9WJJkQF4cu',
  team_region: 'fldcWyWhkriPVjKBy',
  main_contact: 'fldIUTtXezxHitUgh',
  status: 'fld8z1h7gqZmyNRoB',
  // Logo fields - TODO: Replace with actual field IDs after adding fields in Airtable
  logo_url: 'fldLOGO_URL_PLACEHOLDER',
  logo_uploaded_at: 'fldLOGO_UPLOADED_AT_PLACEHOLDER',
  logo_uploaded_by: 'fldLOGO_UPLOADED_BY_PLACEHOLDER',
} as const;

// Personen table ID
export const PERSONEN_TABLE_ID = 'tblu8iWectQaQGTto';

// Rollen record IDs
export const ROLLEN_IDS = {
  team: 'rec4nmwoqYehpGOC5',
  admin: 'recJUzOStc4z6KkOV',
  lehrkraft: 'rec9gjMmYekxPcxkb',
  engineer: 'recNDcPVyANl5sDCG',
} as const;

/**
 * Main table interface - matches actual Airtable structure
 *
 * IMPORTANT: This table uses a FLAT/DENORMALIZED structure where each row represents
 * a single parent-child-event registration. Child records are NOT separate entities;
 * they are created when a parent registers (as a row in this table).
 *
 * - The `id` field (Airtable record ID) serves as the unique identifier for each registration
 * - The `registered_child` field stores the child's name as text (not a linked record)
 * - Same parent can have multiple rows (one per child per event)
 * - Same child can appear in multiple rows (one per event they participate in)
 *
 * WORKFLOW:
 * 1. Staff creates event → generates booking_id and class_id values (no children created)
 * 2. Parent registers → creates a new row in this table (child "created" here)
 * 3. Recording uploaded → organized by class_id in R2 bucket
 * 4. Parent accesses portal → queries all rows by parent_email
 */
export interface ParentJourney {
  id: string;                              // Airtable record ID (serves as unique registration ID)
  booking_id: string;                      // Event-level identifier (school + date)
  class_id?: string;                       // Class-level identifier (unique per class within event)
  school_name: string;
  main_teacher?: string;                   // Primary teacher for the class
  other_teachers?: string;                 // Additional teachers (comma-separated or multi-line)
  class: string;                           // Class name (e.g., "Year 3", "3rd Grade")
  registered_child: string;                // Child's full name (created when parent registers)
  parent_first_name: string;
  parent_email: string;
  parent_telephone: string;
  email_campaigns?: string;                // Email campaign preferences
  order_number?: string;                   // Shopify order reference
  school_recording?: AirtableAttachment[]; // Recording attachments (being phased out for R2)
  event_type: string;                      // 'concert' | 'recital' | 'competition' | 'showcase'
  parent_id: string;                       // Unique parent identifier
  booking_date?: string;                   // Event date from Airtable (ISO date string)
  child_id?: string;                       // Child identifier
  registered_complete?: boolean;           // Registration completion status
  total_children?: number;                 // Total number of children in class
  assigned_staff?: string[];               // Linked record IDs to Personen table
  assigned_engineer?: string[];            // Linked record IDs to Personen (engineers)
}

// Airtable attachment structure
export interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size?: number;
  type?: string;
  thumbnails?: {
    small?: {
      url: string;
      width: number;
      height: number;
    };
    large?: {
      url: string;
      width: number;
      height: number;
    };
  };
}

// Utility types for API responses
export interface AirtableRecord<T> {
  id: string;
  fields: T;
  createdTime?: string;
}

export interface AirtableListResponse<T> {
  records: AirtableRecord<T>[];
  offset?: string;
}

// Filter types for queries
export interface QueryFilter {
  filterByFormula?: string;
  sort?: Array<{ field: string; direction?: 'asc' | 'desc' }>;
  maxRecords?: number;
  pageSize?: number;
  offset?: string;
  returnFieldsByFieldId?: boolean;
}

// Simplified portal data structure for the flat table
export interface ParentPortalData {
  parentJourney: ParentJourney;
  // Additional computed or related data can go here
  schoolRecordingUrl?: string;  // From R2 instead of Airtable
  hasActiveBundle?: boolean;
  bundleProducts?: BundleProduct[];
}

// Product types (stored separately, potentially in Shopify)
export interface BundleProduct {
  id: string;
  name: string;
  type: 'tshirt' | 'recording' | 'bundle';
  price: number;
  sizes?: string[];
  description?: string;
  image_url?: string;
}

// Order tracking (could be Shopify or separate tracking)
export interface Order {
  id: string;
  order_id: string;
  parent_id: string;
  booking_id: string;  // Links to ParentJourney
  shopify_order_id?: string;
  order_date: string;
  products: OrderProduct[];
  subtotal: number;
  tax: number;
  shipping?: number;
  total_amount: number;
  fulfillment_status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  digital_delivered: boolean;
  tracking_number?: string;
  notes?: string;
}

export interface OrderProduct {
  product_id: string;
  quantity: number;
  size?: string;
  price: number;
  variant_id?: string;
}

// Session types (for authentication)
export interface ParentSessionChild {
  childName: string;
  bookingId: string;           // Event-level identifier
  classId?: string;            // Class-level identifier
  class: string;               // Class name (human-readable)
  eventId: string;
  schoolName: string;
  eventType: string;
  bookingDate?: string;
}

export interface ParentSession {
  parentId: string;
  email: string;
  firstName: string;
  // Legacy single-child fields (kept for backward compatibility)
  bookingId: string;
  schoolName: string;
  schoolId?: string;     // Generated school identifier
  eventType: string;
  eventId?: string;      // Generated unique event identifier
  childName: string;
  bookingDate?: string;  // Event date from Airtable
  // Multi-child support
  children: ParentSessionChild[];
  loginTimestamp: number;
}

// Event and class details for registration
export interface EventClassDetails {
  schoolName: string;
  eventType: string;
  bookingDate?: string;
  className: string;
  teacherName: string;
  otherTeachers?: string;
  bookingId: string;
}

// Helper type to extract field names from field IDs
export type FieldIdToName<T extends keyof typeof AIRTABLE_FIELD_IDS> = T;

// Type-safe field mapping
export type AirtableFieldMap = {
  [K in keyof typeof AIRTABLE_FIELD_IDS]: typeof AIRTABLE_FIELD_IDS[K];
};

// Shopify Product Types (for shop feature)
export interface ProductVariant {
  id: string;
  title: string;
  price: {
    amount: string;
    currencyCode: string;
  };
  compareAtPrice?: {
    amount: string;
    currencyCode: string;
  };
  availableForSale: boolean;
  quantityAvailable?: number;
  image?: {
    url: string;
    altText?: string;
  };
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  productType: string;
  handle: string;
  images: Array<{
    id: string;
    url: string;
    altText?: string;
  }>;
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
    maxVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  compareAtPriceRange?: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  variants: ProductVariant[];
  tags: string[];
  availableForSale: boolean;
}

// Dashboard statistics for admin panel
export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalParents: number;
  emailsSent: number;
  emailOpenRate: number;
  conversionRate: number;
  activeEvents: number;
}

// Event analytics for admin panel
export interface EventAnalytics {
  eventId: string;
  eventName: string;
  totalRegistrations: number;
  totalRevenue: number;
  conversionRate: number;
}

// School-level event summary for admin cards view
// Groups all classes for a school on a given date
export interface SchoolEventSummary {
  eventId: string;           // booking_id
  schoolName: string;
  eventDate: string;
  eventType: string;
  mainTeacher: string;
  classCount: number;
  totalChildren: number;
  totalParents: number;
  assignedStaffId?: string;   // Personen record ID
  assignedStaffName?: string; // Staff name for display
}

// Team staff member from Personen table
export interface TeamStaffMember {
  id: string;        // Airtable record ID
  name: string;      // staff_name field
  email: string;     // E-Mail field
  numericId?: number; // ID autonumber field (used for login password)
}

// Class detail within an event for the detail page
export interface EventClassDetail {
  classId: string;
  className: string;
  mainTeacher?: string;
  totalChildren: number;
  registeredParents: number;
  registrationRate: number;  // percentage
}

// Full event detail for the [eventId] detail page
export interface SchoolEventDetail extends SchoolEventSummary {
  classes: EventClassDetail[];
  overallRegistrationRate: number;
}

// Staff member for staff portal authentication
export interface StaffMember {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  active: boolean;
  createdAt?: string;
}

// Staff session for authentication
export interface StaffSession {
  staffId: string;
  email: string;
  name: string;
  loginTimestamp: number;
}

// SchoolBooking from SimplyBook integration
export interface SchoolBooking {
  id: string;
  simplybookId: string;
  simplybookHash?: string;
  schoolContactName: string;
  schoolContactEmail: string;
  schoolPhone?: string;
  schoolAddress?: string;
  schoolPostalCode?: string;
  region?: string;
  city?: string;
  estimatedChildren?: number;
  schoolSizeCategory?: '>150 children' | '<150 children';
  simplybookStatus: 'confirmed' | 'hold' | 'no_region';
  parentJourneyBookings?: string[];  // Linked record IDs
  einrichtung?: string[];            // Linked record IDs
  mainContactPerson?: string[];      // Linked record IDs (Personen/Staff)
  createdAt?: string;
  lastModified?: string;
  // Booking date/time fields
  startDate?: string;                // YYYY-MM-DD format
  endDate?: string;                  // YYYY-MM-DD format
  startTime?: string;                // HH:mm:ss format
  endTime?: string;                  // HH:mm:ss format
  // Portal status for teacher portal
  portalStatus?: 'pending_setup' | 'classes_added' | 'ready';
  // Assigned staff for events without class data
  assignedStaff?: string[];           // Linked record IDs (Personen/Staff)
}

// Type for portal status values
export type PortalStatus = 'pending_setup' | 'classes_added' | 'ready';

// Einrichtung (School/Institution) record
export interface Einrichtung {
  id: string;
  customerName: string;
  type?: string;
  address?: string;
  plz?: string;
  ort?: string;
  bundesland?: string;
  numberOfChildren?: number;
  email?: string;
  telephoneNumber?: string;
  teamRegion?: string[];  // Linked record IDs
  mainContact?: string[]; // Linked record IDs (Personen)
  status?: string;
  // Logo fields
  logoUrl?: string;
  logoUploadedAt?: string;
  logoUploadedBy?: string;
}