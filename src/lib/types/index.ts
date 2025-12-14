// Re-export all types from individual modules
export * from './airtable';

// Common application types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'staff' | 'parent';
  firstName?: string;
  lastName?: string;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: string;
  exp: number;
  iat: number;
}

// ParentSession is now exported from './airtable' with the updated structure

export interface FileUpload {
  filename: string;
  mimetype: string;
  size: number;
  url: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  variables: string[];
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  pushNotifications: boolean;
}