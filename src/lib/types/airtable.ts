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
  // New fields for teacher portal representative cards
  bio: 'fldTKYnqcGgBZrKK9', // Long text - Personal introduction shown to teachers
  profile_photo: 'fldcSWJFKy1DW8pXA', // Attachment - Profile photo for representative card
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
  // School name field (actual institution name, not contact person)
  school_name: 'fldVgEyfHufAuNovP',
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
  assignedEngineerId?: string; // Personen record ID for engineer
}

// Team staff member from Personen table
export interface TeamStaffMember {
  id: string;        // Airtable record ID
  name: string;      // staff_name field
  email: string;     // E-Mail field
  numericId?: number; // ID autonumber field (used for login password)
}

// Minimusiker representative for teacher portal (from Personen table)
export interface MinimusikanRepresentative {
  id: string;              // Airtable record ID
  name: string;            // staff_name field
  email: string;           // Email field
  phone?: string;          // telefon field
  bio?: string;            // Personal introduction shown to teachers
  profilePhotoUrl?: string; // URL from profile_photo attachment
  region?: string;         // Region assignment (from teams_regionen linked record)
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
  schoolName?: string;                // Actual school/institution name
  schoolContactName: string;          // Contact person's name
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

// ======================================================================
// NEW NORMALIZED TABLE STRUCTURE - Migration to Linked Records
// ======================================================================

// Events Table - 1 row per school event
export const EVENTS_TABLE_ID = 'tblVWx1RrsGRjsNn5';

export const EVENTS_FIELD_IDS = {
  event_id: 'fldcNaHZyr6E5khDe',        // Primary field
  school_name: 'fld5QcpEsDFrLun6w',
  event_date: 'fld7pswBblm9jlOsS',
  event_type: 'fldnWvlgaik73WwsE',
  assigned_staff: 'fldKFG7lVsO1w9Td3',  // Linked record → Personen
  assigned_engineer: 'fldHK6sQA3jrU6O2H',  // Linked record → Personen
  created_at: 'fldnOuSFihr3HrJkF',
  legacy_booking_id: 'fldYrZSh7tdkwuWp4',  // Original booking_id from parent_journey_table
  simplybook_booking: 'fldK7vyxLd9MxgmES',  // Linked record → SchoolBookings
} as const;

// Classes Table - 1 row per class
export const CLASSES_TABLE_ID = 'tbl17SVI5gacwOP0n';

export const CLASSES_FIELD_IDS = {
  class_id: 'fld1dXGae9I7xldun',        // Primary field
  event_id: 'fldSSaeBuQDkOhOIT',        // Linked record → Events
  class_name: 'fld1kaSb8my7q5mHt',
  main_teacher: 'fldsODu2rjT8ZMqLl',
  other_teachers: 'fldXGPDDeLPW3Zoli',
  total_children: 'flddABwj9UilV2OtG',
  created_at: 'fld3q0jZPIAlsx8FD',
  legacy_booking_id: 'fldXGF3yXrHeI4vWn',  // Original booking_id from parent_journey_table
} as const;

// Parents Table - 1 row per unique parent (deduplicated by email)
export const PARENTS_TABLE_ID = 'tblaMYOUj93yp7jHE';

export const PARENTS_FIELD_IDS = {
  parents_id: 'fldFkUhGlISNXCOZw',       // Primary field (Airtable's autonumber)
  parent_id: 'fldnnzCB0aesXJdxu',       // Our custom parent identifier
  parent_email: 'fldd3LuRL0TmzVESR',
  parent_first_name: 'fldtaXHWE5RP0nrw5',
  parent_telephone: 'fldG9NgGysXmZcQcu',
  email_campaigns: 'flddJfUYApbFbXbjy',
  created_at: 'fld3lXrbHzVyyomC5',
} as const;

// Registrations Table - 1 row per child registration
export const REGISTRATIONS_TABLE_ID = 'tblXsmPuZcePcre5u';

export const REGISTRATIONS_FIELD_IDS = {
  Id: 'fldBFsyhX7BFAmNLV',              // Autonumber, Primary
  event_id: 'fld4U9Wq5Skqf2Poq',        // Linked record → Events
  parent_id: 'fldqfoJhaXH0Oj32J',       // Linked record → Parents
  class_id: 'fldfZeZiOGFg5UD0I',        // Linked record → Classes
  registered_child: 'fldkdMkuuJ21sIjOQ',
  child_id: 'fldjejm0H9GoBIg5h',
  registered_complete: 'fld9j3Y4ez5eYqFtU',
  order_number: 'fldxoKh20d5WuW4vt',
  legacy_record: 'fldphliFEPY9WlIFJ',   // Original record ID from parent_journey_table
  registration_date: 'fldXlB5zyf1FXwxo9',
  registration_status: 'fldFx38yx2wrlvUeG',
  notes: 'fldVF6VpiV5cCxUnK',
} as const;

// Songs Table - New linked record fields (existing table)
export const SONGS_LINKED_FIELD_IDS = {
  class_link: 'fldMPAHLnyNralsLS',      // Linked record → Classes
  event_link: 'fldygKERszsLFRBaS',      // Linked record → Events
} as const;

// AudioFiles Table - New linked record fields (existing table)
export const AUDIO_FILES_LINKED_FIELD_IDS = {
  class_link: 'fld04rZUWLKCv15s2',      // Linked record → Classes
  event_link: 'fldTFdrvuzIWd9WbK',      // Linked record → Events
  song_link: 'fld4E2dFKJqkB0CuA',       // Linked record → Songs
} as const;

// Orders Table - Shopify order tracking
export const ORDERS_TABLE_ID = 'tblu9AGaLSoEVwqq7';

export const ORDERS_FIELD_IDS = {
  order_id: 'fldPfSw1zCFI7gqXo',           // Primary field - Shopify order ID
  order_number: 'fldKVJtsO24WemkgA',       // Display order number (#1001)
  parent_id: 'fldLbmO6NwPAfcqMX',          // Link to Parents table
  event_id: 'fldxJwmQCsx533oe0',           // Link to Events table
  class_id: 'fldvwFX0XhPPZ9XBd',           // Link to Classes table
  booking_id: 'fldF4eBUFu5NcRYjd',         // Booking ID from custom attributes
  school_name: 'fld0oMH0XTGHi7fV0',        // Denormalized for reporting
  order_date: 'fldpQj3Pba3Y2D6wo',         // When order was placed
  total_amount: 'fldp5IVjGhtfnBKlR',       // Total order value (EUR)
  subtotal: 'fld0BuoKBTewHyoM3',           // Before tax/shipping
  tax_amount: 'fldbImGVnC7SvMPyn',         // Tax charged
  shipping_amount: 'fldRENpTADdrTSf2p',    // Shipping charged
  line_items: 'fld9iRwg7rV6nMWrN',         // JSON array of products
  fulfillment_status: 'fldAipl3jqPM46q5y', // pending, fulfilled, partial, restocked
  payment_status: 'fld1zfZ9ouEPJv8ju',     // pending, paid, refunded, voided
  digital_delivered: 'fldj92CkKEXZutMsS',  // Has digital content been delivered?
  created_at: 'fldfmBl2c5pJ6zxL4',         // Record creation timestamp
  updated_at: 'fldXyxRPkMSztS8Ff',         // Last update timestamp
} as const;

// ======================================================================
// Normalized Table Interfaces
// ======================================================================

/**
 * Event record - One row per school event
 */
export interface Event {
  id: string;                           // Airtable record ID
  event_id: string;                     // Our event identifier (was booking_id)
  school_name: string;
  event_date: string;                   // ISO date string
  event_type: 'concert' | 'recital' | 'competition' | 'showcase';
  assigned_staff?: string[];            // Linked record IDs → Personen
  assigned_engineer?: string[];         // Linked record IDs → Personen
  created_at: string;
  legacy_booking_id?: string;           // Original booking_id from parent_journey_table
  simplybook_booking?: string[];        // Linked record IDs → SchoolBookings
  // R2 Storage fields (populated after printable generation)
  r2_event_folder?: string;             // R2 path: events/{event_id}/
  printables_generated?: boolean;       // Flag indicating printables have been generated
  printables_generated_at?: string;     // ISO timestamp of last generation
}

/**
 * Class record - One row per class within an event
 */
export interface Class {
  id: string;                           // Airtable record ID
  class_id: string;                     // Our class identifier
  event_id: string[];                   // Linked record IDs → Events
  class_name: string;
  main_teacher?: string;
  other_teachers?: string;
  total_children: number;
  created_at: string;
  legacy_booking_id?: string;           // Original booking_id from parent_journey_table
}

/**
 * Parent record - One row per unique parent (deduplicated by email)
 */
export interface Parent {
  id: string;                           // Airtable record ID
  parents_id: string;                   // Airtable autonumber primary field
  parent_id: string;                    // Our custom parent identifier
  parent_email: string;
  parent_first_name: string;
  parent_telephone: string;
  email_campaigns?: 'yes' | 'no';
  created_at: string;
}

/**
 * Registration record - One row per child registration
 */
export interface Registration {
  id: string;                           // Airtable record ID
  Id: number;                           // Autonumber primary field
  event_id: string[];                   // Linked record IDs → Events
  parent_id: string[];                  // Linked record IDs → Parents
  class_id: string[];                   // Linked record IDs → Classes
  registered_child: string;
  child_id?: string;
  registered_complete: boolean;
  order_number?: string;
  legacy_record?: string;               // Original record ID from parent_journey_table
  registration_date?: string;           // ISO date string
  registration_status?: string;
  notes?: string;
}

// ======================================================================
// Shopify Order Types
// ======================================================================

/**
 * Line item within a Shopify order
 */
export interface ShopifyOrderLineItem {
  variant_id: string;
  product_title: string;
  variant_title?: string;
  quantity: number;
  price: number;
  total: number;
}

/**
 * Shopify order record stored in Airtable
 */
export interface ShopifyOrder {
  id: string;                                    // Airtable record ID
  order_id: string;                              // Shopify order ID (gid://shopify/Order/...)
  order_number: string;                          // Display order number (#1001)
  parent_id?: string[];                          // Linked record IDs → Parents
  event_id?: string[];                           // Linked record IDs → Events
  booking_id?: string;                           // Booking ID from custom attributes
  school_name?: string;                          // Denormalized for reporting
  order_date: string;                            // ISO datetime string
  total_amount: number;                          // Total order value (EUR)
  subtotal: number;                              // Before tax/shipping
  tax_amount: number;                            // Tax charged
  shipping_amount?: number;                      // Shipping charged
  line_items: ShopifyOrderLineItem[];            // Parsed JSON array
  fulfillment_status: 'pending' | 'fulfilled' | 'partial' | 'restocked';
  payment_status: 'pending' | 'paid' | 'refunded' | 'voided';
  digital_delivered: boolean;                    // Has digital content been delivered?
  created_at: string;                            // Record creation timestamp
  updated_at: string;                            // Last update timestamp
}

/**
 * Data for creating a new Shopify order in Airtable
 */
export interface CreateShopifyOrderInput {
  order_id: string;
  order_number: string;
  parent_id?: string[];
  event_id?: string[];
  booking_id?: string;
  school_name?: string;
  order_date: string;
  total_amount: number;
  subtotal: number;
  tax_amount: number;
  shipping_amount?: number;
  line_items: ShopifyOrderLineItem[];
  fulfillment_status: 'pending' | 'fulfilled' | 'partial' | 'restocked';
  payment_status: 'pending' | 'paid' | 'refunded' | 'voided';
  digital_delivered?: boolean;
}

// ======================================================================
// TASKS TABLE - Manual task management for admin portal
// ======================================================================

export const TASKS_TABLE_ID = 'tblf59JyawJjgDqPJ';

export const TASKS_FIELD_IDS = {
  task_id: 'fldYwXmqYLHXmCd1B',              // Autonumber primary field
  template_id: 'fldVXRwHmCbmRwAoe',          // Single line text - reference to hardcoded template
  event_id: 'fldsyDbcBy1yzjbdI',             // Linked record → Events
  task_type: 'fld1BhaWmhl0opQBU',            // Single select: paper_order, clothing_order, etc.
  task_name: 'fldKx1kQZX571SlUG',            // Single line text
  description: 'fldOBfsp7Ahso72rJ',          // Long text
  completion_type: 'fldLgArrpofS6dlHk',      // Single select: monetary, checkbox, submit_only
  timeline_offset: 'flddNjbhxVtoKvzeE',      // Number (days)
  deadline: 'fld3KdpL5s6HKYm6t',             // Date
  status: 'fldTlA0kywaIji0BL',               // Single select: pending, completed
  completed_at: 'fldMPIc4fgagb9YTx',         // Date
  completed_by: 'fldF1iEru5pHcNupv',         // Single line text (admin email)
  completion_data: 'fldHeL68HQXjcHGQk',      // Long text (JSON)
  go_id: 'fld4zyH5ApLKQNq5V',                 // Linked record → GuesstimateOrders
  order_ids: 'fldqilVgYKVAQsTpr',            // Long text (comma-separated)
  parent_task_id: 'fldN73QVTWRGYbaVJ',       // Linked record → Tasks (for shipping tasks)
  created_at: 'fldt32Ff4DXY8ax47',           // Date
} as const;

// ======================================================================
// GUESSTIMATE ORDERS TABLE - Internal supplier order tracking (go_id)
// ======================================================================

export const GUESSTIMATE_ORDERS_TABLE_ID = 'tblvNKyWN47i4blkr';

export const GUESSTIMATE_ORDERS_FIELD_IDS = {
  go_id: 'fld9vRXqlbfMD1jdN',                // Autonumber primary field (GO-0001)
  event_id: 'fldGNOCRcZmcCj7oe',             // Linked record → Events
  order_ids: 'fldNTkJTH919G9UE7',            // Long text (comma-separated Shopify order IDs)
  order_date: 'fld36vRN0TZTnp5fO',           // Date
  order_amount: 'fldF8YMv8SoHjZMiN',         // Number (Currency EUR)
  contains: 'fldue3s3KdcR5ho6L',             // Long text (JSON)
  date_completed: 'fldjkx4tuq21ni7Xf',       // Date
  created_at: 'fldNyOb6nXRoJ7CsX',           // Date
} as const;

// ======================================================================
// EVENT MANUAL COSTS TABLE - Manual cost entries for Analytics
// ======================================================================

export const EVENT_MANUAL_COSTS_TABLE_ID = 'tblXnNvWlUFZrJpXa';

export const EVENT_MANUAL_COSTS_FIELD_IDS = {
  cost_name: 'fldJnFRQa18HcZoue',             // Single line text (Primary)
  event_id: 'fldthq8q1yWSG8bJR',              // Linked record → Events
  amount: 'fldRsfIVJz96h9TRa',                // Number (Currency EUR)
  created_at: 'fldOurLdL7eVIe4ZO',            // Date (Formula)
  updated_at: 'fldnc246NP2N32rzI',            // Date (Formula)
  cost_type: 'fldH0FLMSnrioAn74',             // Single select (optional)
  entered_by: 'fldwOD5duml2UFozS',            // Single line text (optional)
  description: 'fldy3azQdpvujHaUr',           // Long text (optional)
  is_verified: 'fldFMq9Io39WPQwdc',           // Checkbox (optional)
} as const;