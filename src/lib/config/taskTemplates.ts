import { TaskTemplate, TaskType } from '@/lib/types/tasks';

/**
 * Paper Order Task Templates
 * These are automatically created for each event when booking is confirmed
 */
export const PAPER_ORDER_TEMPLATES: TaskTemplate[] = [
  {
    id: 'poster_letter',
    type: 'paper_order',
    name: 'Poster & Letter To School',
    description: 'Send poster and customized letter to school for event promotion',
    timeline_offset: -58, // 58 days before event
    completion_type: 'submit_only',
    r2_file: (eventId: string) => `events/${eventId}/printables/poster.pdf`,
    creates_go_id: true,
    creates_shipping: true,
  },
  {
    id: 'flyer1',
    type: 'paper_order',
    name: "Order 'Flyer One' To School",
    description: 'Place Flyeralarm order for Flyer 1 - first wave of event materials',
    timeline_offset: -42, // 42 days before event
    completion_type: 'monetary',
    r2_file: (eventId: string) => `events/${eventId}/printables/flyers/flyer1.pdf`,
    creates_go_id: true,
    creates_shipping: true,
  },
  {
    id: 'flyer2',
    type: 'paper_order',
    name: "Order 'Flyer Two' To School",
    description: 'Place Flyeralarm order for Flyer 2 - second wave of event materials',
    timeline_offset: -22, // 22 days before event
    completion_type: 'monetary',
    r2_file: (eventId: string) => `events/${eventId}/printables/flyers/flyer2.pdf`,
    creates_go_id: true,
    creates_shipping: true,
  },
  {
    id: 'flyer3',
    type: 'paper_order',
    name: 'Flyer Three',
    description: 'Place Flyeralarm order for Flyer 3 - final wave of event materials',
    timeline_offset: -14, // 14 days before event
    completion_type: 'monetary',
    r2_file: (eventId: string) => `events/${eventId}/printables/flyers/flyer3.pdf`,
    creates_go_id: true,
    creates_shipping: true,
  },
  {
    id: 'minicard',
    type: 'paper_order',
    name: 'Minicard To Office',
    description: 'Order Minicards for post-event distribution to parents',
    timeline_offset: 1, // 1 day after event
    completion_type: 'monetary',
    r2_file: (eventId: string) => `events/${eventId}/printables/minicards/minicard.pdf`,
    creates_go_id: false,
    creates_shipping: false,
  },
];

/**
 * Shipping Task Template (created dynamically when paper order is completed)
 */
export const SHIPPING_TEMPLATE: Omit<TaskTemplate, 'id' | 'timeline_offset'> = {
  type: 'shipping',
  name: 'Ship Order To School',
  description: 'Confirm shipment of materials to school',
  completion_type: 'checkbox',
  creates_go_id: false,
  creates_shipping: false,
};

/**
 * Get all task templates by type
 */
export function getTemplatesByType(type: TaskType): TaskTemplate[] {
  switch (type) {
    case 'paper_order':
      return PAPER_ORDER_TEMPLATES;
    case 'clothing_order':
      return []; // TODO: Add clothing order templates
    case 'cd_master':
      return []; // TODO: Add CD master templates
    case 'cd_production':
      return []; // TODO: Add CD production templates
    case 'shipping':
      return []; // Shipping tasks are created dynamically
    default:
      return [];
  }
}

/**
 * Get all task templates
 */
export function getAllTemplates(): TaskTemplate[] {
  return [
    ...PAPER_ORDER_TEMPLATES,
    // Add other types here as they are implemented
  ];
}

/**
 * Get a specific template by ID
 */
export function getTemplateById(templateId: string): TaskTemplate | undefined {
  return getAllTemplates().find((t) => t.id === templateId);
}

/**
 * Calculate deadline from event date and timeline offset
 */
export function calculateDeadline(eventDate: Date, timelineOffset: number): Date {
  const deadline = new Date(eventDate);
  deadline.setDate(deadline.getDate() + timelineOffset);
  return deadline;
}

/**
 * Calculate urgency score for sorting
 * Lower score = more urgent
 * Overdue tasks get negative scores (appear at top)
 */
export function calculateUrgencyScore(deadline: Date): {
  urgencyScore: number;
  daysUntilDue: number;
  isOverdue: boolean;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const deadlineNormalized = new Date(deadline);
  deadlineNormalized.setHours(0, 0, 0, 0);

  const diffTime = deadlineNormalized.getTime() - today.getTime();
  const daysUntilDue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilDue < 0;

  // Overdue tasks get priority: -1000 + daysOverdue (so -5 days overdue = -1005)
  const urgencyScore = isOverdue ? -1000 + daysUntilDue : daysUntilDue;

  return { urgencyScore, daysUntilDue, isOverdue };
}
