// SimplyBook API Type Definitions

/**
 * SimplyBook webhook notification payload
 * Sent when bookings are created, changed, or cancelled
 */
export interface SimplybookWebhookPayload {
  booking_id: string;
  booking_hash: string;
  company: string;
  notification_type: 'create' | 'change' | 'cancel';
}

/**
 * SimplyBook intake form field
 * Note: The API returns an array with field_title/field_name properties
 */
export interface SimplybookIntakeField {
  id?: string;
  title?: string;        // For backward compatibility
  field_title?: string;  // Actual property name from SimplyBook API
  field_name?: string;   // Internal field name
  value: string;
  type?: string;
}

/**
 * SimplyBook client information
 */
export interface SimplybookClient {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

/**
 * SimplyBook booking details from API
 */
export interface SimplybookBooking {
  id: string;
  code: string;
  hash: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  start_date_time: string;
  end_date_time: string;
  event_id: string;
  event_name?: string;
  unit_id?: string;
  unit_name?: string;
  client_id: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  is_confirmed: boolean;
  status?: string;
  additional_fields?: SimplybookIntakeField[] | Record<string, SimplybookIntakeField>;
  location?: {
    id: string;
    title: string;
    address1?: string;
    city?: string;
  };
}

/**
 * Mapped booking data after processing intake form fields
 */
export interface MappedBookingData {
  schoolName: string;
  contactPerson: string;
  contactEmail: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  region?: string;
  city?: string;
  numberOfChildren: number;
  costCategory: '>150 children' | '<150 children';
  bookingDate: string;
}

/**
 * SimplyBook JSON-RPC request format
 */
export interface SimplybookJsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params: unknown[];
  id: number;
}

/**
 * SimplyBook JSON-RPC response format
 */
export interface SimplybookJsonRpcResponse<T = unknown> {
  jsonrpc: '2.0';
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: number;
}

/**
 * SimplyBook authentication token response
 */
export interface SimplybookTokenResponse {
  token: string;
  company: string;
  login: string;
  auth_type?: string;
}

/**
 * SimplyBook service (event type) definition
 */
export interface SimplybookService {
  id: string;
  name: string;
  description?: string;
  duration: number;
  price?: number;
  is_active: boolean;
}

/**
 * SimplyBook provider (unit) definition
 */
export interface SimplybookProvider {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
}
