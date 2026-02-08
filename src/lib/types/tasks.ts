// Task Types for Admin Portal Task Management

// Task type categories
export type TaskType =
  | 'paper_order'
  | 'clothing_order'
  | 'cd_master'
  | 'cd_production'
  | 'shipping';

// How a task is completed
export type TaskCompletionType = 'monetary' | 'checkbox' | 'submit_only';

// Task status
export type TaskStatus = 'pending' | 'completed';

// Base Task interface (Airtable record)
export interface Task {
  id: string; // Airtable record ID
  task_id: string; // TSK-0001 (autonumber display)
  template_id: string; // Reference to hardcoded template
  event_id: string; // Linked event record ID
  task_type: TaskType;
  task_name: string;
  description: string;
  completion_type: TaskCompletionType;
  timeline_offset: number; // Days (negative = before event)
  deadline: string; // ISO date string
  status: TaskStatus;
  completed_at?: string;
  completed_by?: string;
  completion_data?: string; // JSON string of TaskCompletionData
  go_id?: string; // Linked GuesstimateOrder record ID
  order_ids?: string; // Comma-separated Shopify order IDs
  parent_task_id?: string; // For shipping tasks, references parent task
  created_at: string;
}

// Extended Task with event details and computed fields for display
export interface TaskWithEventDetails extends Task {
  school_name: string;
  event_date: string;
  event_type?: string; // May be undefined for events without type set
  go_display_id?: string; // GO-0001 format
  urgency_score: number; // Calculated urgency (lower = more urgent)
  days_until_due: number; // Days until/since deadline
  is_overdue: boolean;
  r2_file_path?: string; // Path to downloadable file
  r2_download_url?: string; // Signed URL for download
  stock_arrived?: boolean; // For shipping tasks: whether linked GO-ID stock has arrived
}

// Completion data stored as JSON
export interface TaskCompletionData {
  amount?: number; // For monetary type
  invoice_url?: string; // For monetary type (optional)
  confirmed?: boolean; // For checkbox type
  notes?: string; // Optional notes
}

// GuesstimateOrder interface (internal supplier order tracking)
export interface GuesstimateOrder {
  id: string; // Airtable record ID
  go_id: string; // GO-0001 (autonumber display)
  event_id: string; // Linked event record ID
  order_ids?: string; // Comma-separated Shopify order IDs
  order_date?: string;
  order_amount?: number;
  contains?: string; // JSON string of GuesstimateOrderItem[]
  date_completed?: string;
  created_at: string;
}

export interface GuesstimateOrderItem {
  sku: string;
  name: string;
  quantity: number;
}

// GuesstimateOrder enriched with event details (for incoming orders view)
export interface GuesstimateOrderWithEventDetails extends GuesstimateOrder {
  school_name: string;
  event_date: string;
  parsed_contains: GuesstimateOrderItem[];
}

// Task Template definition (hardcoded in config)
export interface TaskTemplate {
  id: string; // Unique template identifier
  type: TaskType;
  name: string;
  description: string;
  timeline_offset: number; // Days relative to event
  completion_type: TaskCompletionType;
  r2_file?: (eventId: string) => string; // Function to generate R2 path
  creates_go_id: boolean;
  creates_shipping: boolean;
}

// Task type configuration for UI
export interface TaskTypeConfig {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

export const TASK_TYPE_CONFIG: Record<TaskType, TaskTypeConfig> = {
  paper_order: {
    label: 'Paper Order',
    icon: '📄',
    color: 'text-blue-800',
    bgColor: 'bg-blue-100 border-blue-200',
  },
  clothing_order: {
    label: 'Clothing Order',
    icon: '👕',
    color: 'text-purple-800',
    bgColor: 'bg-purple-100 border-purple-200',
  },
  cd_master: {
    label: 'CD Master',
    icon: '💿',
    color: 'text-yellow-800',
    bgColor: 'bg-yellow-100 border-yellow-200',
  },
  cd_production: {
    label: 'CD Production',
    icon: '📀',
    color: 'text-orange-800',
    bgColor: 'bg-orange-100 border-orange-200',
  },
  shipping: {
    label: 'Shipping',
    icon: '📦',
    color: 'text-green-800',
    bgColor: 'bg-green-100 border-green-200',
  },
};

// Filter tab configuration
export type TaskFilterTab = TaskType | 'all';

export const TASK_FILTER_TABS: { id: TaskFilterTab; label: string }[] = [
  { id: 'all', label: 'All Tasks' },
  { id: 'paper_order', label: 'Paper Orders' },
  { id: 'clothing_order', label: 'Clothing Orders' },
  { id: 'cd_master', label: 'CD Master' },
  { id: 'cd_production', label: 'CD Production' },
  { id: 'shipping', label: 'Shipping' },
];

// API Response types
export interface TasksResponse {
  tasks: TaskWithEventDetails[];
  counts: Record<TaskFilterTab, number>;
}

export interface CreateTaskInput {
  event_id: string;
  template_id: string;
  task_type: TaskType;
  task_name: string;
  description: string;
  completion_type: TaskCompletionType;
  timeline_offset: number;
  deadline: string;
  status: TaskStatus;
  parent_task_id?: string;
}

export interface CompleteTaskInput {
  completion_data: TaskCompletionData;
}

export interface CreateGuesstimateOrderInput {
  event_id: string;
  order_ids?: string;
  order_date?: string;
  order_amount?: number;
  contains?: GuesstimateOrderItem[];
}
