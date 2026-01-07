import Airtable from 'airtable';
import { getAirtableService } from './airtableService';
import { getR2Service } from './r2Service';
import {
  Task,
  TaskWithEventDetails,
  TaskStatus,
  TaskType,
  TaskCompletionData,
  CreateTaskInput,
  GuesstimateOrder,
  CreateGuesstimateOrderInput,
  TaskFilterTab,
} from '@/lib/types/tasks';
import {
  PAPER_ORDER_TEMPLATES,
  SHIPPING_TEMPLATE,
  getTemplateById,
  calculateUrgencyScore,
  calculateDeadline,
} from '@/lib/config/taskTemplates';
import {
  TASKS_TABLE_ID,
  TASKS_FIELD_IDS,
  GUESSTIMATE_ORDERS_TABLE_ID,
  GUESSTIMATE_ORDERS_FIELD_IDS,
  EVENTS_FIELD_IDS,
} from '@/lib/types/airtable';

/**
 * TaskService - Handles task generation, retrieval, and completion
 */
class TaskService {
  private airtable = getAirtableService();
  private r2 = getR2Service();

  /**
   * Generate all tasks for a new event
   * Called when a SimplyBook booking is confirmed
   */
  async generateTasksForEvent(eventId: string): Promise<Task[]> {
    // Get event details to calculate deadlines
    const event = await this.airtable.getEventById(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const eventDate = new Date(event.event_date);
    const createdTasks: Task[] = [];

    // Generate Paper Order tasks from templates
    for (const template of PAPER_ORDER_TEMPLATES) {
      const deadline = calculateDeadline(eventDate, template.timeline_offset);

      const taskInput: CreateTaskInput = {
        event_id: eventId,
        template_id: template.id,
        task_type: template.type,
        task_name: template.name,
        description: template.description,
        completion_type: template.completion_type,
        timeline_offset: template.timeline_offset,
        deadline: deadline.toISOString(),
        status: 'pending',
      };

      const task = await this.createTask(taskInput);
      createdTasks.push(task);
    }

    return createdTasks;
  }

  /**
   * Create a single task in Airtable
   */
  async createTask(input: CreateTaskInput): Promise<Task> {
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    const record = await table.create({
      [TASKS_FIELD_IDS.template_id]: input.template_id,
      [TASKS_FIELD_IDS.event_id]: [input.event_id], // Linked record
      [TASKS_FIELD_IDS.task_type]: input.task_type,
      [TASKS_FIELD_IDS.task_name]: input.task_name,
      [TASKS_FIELD_IDS.description]: input.description,
      [TASKS_FIELD_IDS.completion_type]: input.completion_type,
      [TASKS_FIELD_IDS.timeline_offset]: input.timeline_offset,
      [TASKS_FIELD_IDS.deadline]: input.deadline.split('T')[0], // Date only
      [TASKS_FIELD_IDS.status]: input.status,
      [TASKS_FIELD_IDS.created_at]: new Date().toISOString(),
      ...(input.parent_task_id && {
        [TASKS_FIELD_IDS.parent_task_id]: [input.parent_task_id],
      }),
    });

    return this.transformTaskRecord(record);
  }

  /**
   * Get all tasks with optional filtering
   */
  async getTasks(options: {
    status?: TaskStatus;
    type?: TaskFilterTab;
    search?: string;
  } = {}): Promise<{ tasks: TaskWithEventDetails[]; counts: Record<TaskFilterTab, number> }> {
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    // Build filter formula
    const filters: string[] = [];

    if (options.status) {
      filters.push(`{${TASKS_FIELD_IDS.status}} = '${options.status}'`);
    }

    if (options.type && options.type !== 'all') {
      filters.push(`{${TASKS_FIELD_IDS.task_type}} = '${options.type}'`);
    }

    if (options.search) {
      // Search across event_id, go_id display, and order_ids
      filters.push(`OR(
        SEARCH(LOWER('${options.search}'), LOWER({${TASKS_FIELD_IDS.template_id}})),
        SEARCH(LOWER('${options.search}'), LOWER({${TASKS_FIELD_IDS.order_ids}}))
      )`);
    }

    const filterFormula = filters.length > 0 ? `AND(${filters.join(', ')})` : '';

    // Fetch all tasks to calculate counts
    const allRecords = await table
      .select({
        filterByFormula: options.status
          ? `{${TASKS_FIELD_IDS.status}} = '${options.status}'`
          : '',
      })
      .all();

    // Calculate counts per type
    const counts: Record<TaskFilterTab, number> = {
      all: allRecords.length,
      paper_order: 0,
      clothing_order: 0,
      cd_master: 0,
      cd_production: 0,
      shipping: 0,
    };

    for (const record of allRecords) {
      const taskType = record.get(TASKS_FIELD_IDS.task_type) as TaskType;
      if (taskType && counts[taskType] !== undefined) {
        counts[taskType]++;
      }
    }

    // Fetch filtered tasks
    const filteredRecords = filterFormula
      ? await table.select({ filterByFormula: filterFormula }).all()
      : allRecords;

    // Transform to TaskWithEventDetails
    const tasks = await Promise.all(
      filteredRecords.map((record) => this.enrichTaskWithEventDetails(record))
    );

    // Sort by urgency (lower score = more urgent)
    tasks.sort((a, b) => {
      if (a.urgency_score !== b.urgency_score) {
        return a.urgency_score - b.urgency_score;
      }
      return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
    });

    return { tasks, counts };
  }

  /**
   * Get a single task by ID
   */
  async getTaskById(taskId: string): Promise<TaskWithEventDetails | null> {
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    try {
      const record = await table.find(taskId);
      return this.enrichTaskWithEventDetails(record);
    } catch {
      return null;
    }
  }

  /**
   * Complete a task
   */
  async completeTask(
    taskId: string,
    completionData: TaskCompletionData,
    adminEmail: string
  ): Promise<{ task: Task; goId?: string; shippingTaskId?: string }> {
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    // Get the task first
    const record = await table.find(taskId);
    const task = this.transformTaskRecord(record);
    const template = getTemplateById(task.template_id);

    let goId: string | undefined;
    let shippingTaskId: string | undefined;

    // Create go_id if template requires it
    if (template?.creates_go_id) {
      const goOrder = await this.createGuesstimateOrder({
        event_id: task.event_id,
        order_date: new Date().toISOString().split('T')[0],
        order_amount: completionData.amount,
      });
      goId = goOrder.id;
    }

    // Update the task
    const updateFields: Record<string, string | number | string[]> = {
      [TASKS_FIELD_IDS.status]: 'completed',
      [TASKS_FIELD_IDS.completed_at]: new Date().toISOString(),
      [TASKS_FIELD_IDS.completed_by]: adminEmail,
      [TASKS_FIELD_IDS.completion_data]: JSON.stringify(completionData),
    };

    if (goId) {
      updateFields[TASKS_FIELD_IDS.go_id] = [goId];
    }

    await table.update(taskId, updateFields as Partial<Airtable.FieldSet>);

    // Create shipping task if template requires it
    if (template?.creates_shipping && goId) {
      const event = await this.airtable.getEventById(task.event_id);
      if (event) {
        const shippingTask = await this.createTask({
          event_id: task.event_id,
          template_id: `shipping_${task.template_id}`,
          task_type: 'shipping',
          task_name: SHIPPING_TEMPLATE.name,
          description: `${SHIPPING_TEMPLATE.description} - ${template.name}`,
          completion_type: SHIPPING_TEMPLATE.completion_type,
          timeline_offset: 0, // Immediate
          deadline: new Date().toISOString(),
          status: 'pending',
          parent_task_id: taskId,
        });
        shippingTaskId = shippingTask.id;

        // Link shipping task to the go_id
        await table.update(shippingTask.id, {
          [TASKS_FIELD_IDS.go_id]: [goId],
        });
      }
    }

    // Refetch the updated task
    const updatedRecord = await table.find(taskId);
    return {
      task: this.transformTaskRecord(updatedRecord),
      goId,
      shippingTaskId,
    };
  }

  /**
   * Create a GuesstimateOrder (go_id)
   */
  async createGuesstimateOrder(input: CreateGuesstimateOrderInput): Promise<GuesstimateOrder> {
    const base = this.airtable.getBase();
    const table = base(GUESSTIMATE_ORDERS_TABLE_ID);

    const fields: Record<string, string | number | string[]> = {
      [GUESSTIMATE_ORDERS_FIELD_IDS.event_id]: [input.event_id],
      [GUESSTIMATE_ORDERS_FIELD_IDS.order_ids]: input.order_ids || '',
      [GUESSTIMATE_ORDERS_FIELD_IDS.order_amount]: input.order_amount || 0,
      [GUESSTIMATE_ORDERS_FIELD_IDS.contains]: input.contains
        ? JSON.stringify(input.contains)
        : '',
      [GUESSTIMATE_ORDERS_FIELD_IDS.created_at]: new Date().toISOString(),
    };

    if (input.order_date) {
      fields[GUESSTIMATE_ORDERS_FIELD_IDS.order_date] = input.order_date;
    }

    const record = await table.create(fields as Partial<Airtable.FieldSet>);

    return this.transformGuesstimateOrderRecord(record as Airtable.Record<Airtable.FieldSet>);
  }

  /**
   * Get GuesstimateOrders, optionally filtered by event
   */
  async getGuesstimateOrders(eventId?: string): Promise<GuesstimateOrder[]> {
    const base = this.airtable.getBase();
    const table = base(GUESSTIMATE_ORDERS_TABLE_ID);

    const selectOptions: { filterByFormula?: string } = {};

    if (eventId) {
      selectOptions.filterByFormula = `SEARCH('${eventId}', ARRAYJOIN({${GUESSTIMATE_ORDERS_FIELD_IDS.event_id}}))`;
    }

    const records = await table.select(selectOptions).all();
    return records.map((record) => this.transformGuesstimateOrderRecord(record));
  }

  /**
   * Get download URL for task's R2 file
   */
  async getTaskDownloadUrl(taskId: string): Promise<string | null> {
    const task = await this.getTaskById(taskId);
    if (!task || !task.r2_file_path) {
      return null;
    }

    // Generate signed URL (1 hour expiry)
    return this.r2.generateSignedUrlForAssetsBucket(task.r2_file_path, 3600);
  }

  // ============================================================
  // Private helper methods
  // ============================================================

  private transformTaskRecord(record: { id: string; fields: Record<string, unknown> } | { id: string; get: (field: string) => unknown }): Task {
    // Handle both raw record and Airtable record formats
    const get = (field: string) => {
      if ('get' in record) {
        return record.get(field);
      }
      return record.fields[field];
    };

    const eventIds = get(TASKS_FIELD_IDS.event_id) as string[] | undefined;
    const goIds = get(TASKS_FIELD_IDS.go_id) as string[] | undefined;
    const parentTaskIds = get(TASKS_FIELD_IDS.parent_task_id) as string[] | undefined;

    return {
      id: record.id,
      task_id: (get(TASKS_FIELD_IDS.task_id) as string) || record.id,
      template_id: (get(TASKS_FIELD_IDS.template_id) as string) || '',
      event_id: eventIds?.[0] || '',
      task_type: (get(TASKS_FIELD_IDS.task_type) as TaskType) || 'paper_order',
      task_name: (get(TASKS_FIELD_IDS.task_name) as string) || '',
      description: (get(TASKS_FIELD_IDS.description) as string) || '',
      completion_type: (get(TASKS_FIELD_IDS.completion_type) as Task['completion_type']) || 'submit_only',
      timeline_offset: (get(TASKS_FIELD_IDS.timeline_offset) as number) || 0,
      deadline: (get(TASKS_FIELD_IDS.deadline) as string) || '',
      status: (get(TASKS_FIELD_IDS.status) as TaskStatus) || 'pending',
      completed_at: get(TASKS_FIELD_IDS.completed_at) as string | undefined,
      completed_by: get(TASKS_FIELD_IDS.completed_by) as string | undefined,
      completion_data: get(TASKS_FIELD_IDS.completion_data) as string | undefined,
      go_id: goIds?.[0],
      order_ids: get(TASKS_FIELD_IDS.order_ids) as string | undefined,
      parent_task_id: parentTaskIds?.[0],
      created_at: (get(TASKS_FIELD_IDS.created_at) as string) || '',
    };
  }

  private async enrichTaskWithEventDetails(record: { id: string; get: (field: string) => unknown }): Promise<TaskWithEventDetails> {
    const task = this.transformTaskRecord(record);

    // Get event details
    let schoolName = 'Unknown School';
    let eventDate = task.deadline;
    let eventType = 'concert';

    if (task.event_id) {
      const event = await this.airtable.getEventById(task.event_id);
      if (event) {
        schoolName = event.school_name;
        eventDate = event.event_date;
        eventType = event.event_type;
      }
    }

    // Get go_id display value
    let goDisplayId: string | undefined;
    if (task.go_id) {
      try {
        const base = this.airtable.getBase();
        const goTable = base(GUESSTIMATE_ORDERS_TABLE_ID);
        const goRecord = await goTable.find(task.go_id);
        goDisplayId = goRecord.get(GUESSTIMATE_ORDERS_FIELD_IDS.go_id) as string;
      } catch {
        // Ignore if go_id record not found
      }
    }

    // Calculate urgency
    const deadline = new Date(task.deadline);
    const { urgencyScore, daysUntilDue, isOverdue } = calculateUrgencyScore(deadline);

    // Get R2 file path from template
    const template = getTemplateById(task.template_id);
    const r2FilePath = template?.r2_file?.(task.event_id);

    return {
      ...task,
      school_name: schoolName,
      event_date: eventDate,
      event_type: eventType,
      go_display_id: goDisplayId,
      urgency_score: urgencyScore,
      days_until_due: daysUntilDue,
      is_overdue: isOverdue,
      r2_file_path: r2FilePath,
    };
  }

  private transformGuesstimateOrderRecord(record: { id: string; get: (field: string) => unknown }): GuesstimateOrder {
    const eventIds = record.get(GUESSTIMATE_ORDERS_FIELD_IDS.event_id) as string[] | undefined;
    const containsStr = record.get(GUESSTIMATE_ORDERS_FIELD_IDS.contains) as string | undefined;

    return {
      id: record.id,
      go_id: (record.get(GUESSTIMATE_ORDERS_FIELD_IDS.go_id) as string) || record.id,
      event_id: eventIds?.[0] || '',
      order_ids: record.get(GUESSTIMATE_ORDERS_FIELD_IDS.order_ids) as string | undefined,
      order_date: record.get(GUESSTIMATE_ORDERS_FIELD_IDS.order_date) as string | undefined,
      order_amount: record.get(GUESSTIMATE_ORDERS_FIELD_IDS.order_amount) as number | undefined,
      contains: containsStr,
      date_completed: record.get(GUESSTIMATE_ORDERS_FIELD_IDS.date_completed) as string | undefined,
      created_at: (record.get(GUESSTIMATE_ORDERS_FIELD_IDS.created_at) as string) || '',
    };
  }
}

// Singleton instance
let taskServiceInstance: TaskService | null = null;

export function getTaskService(): TaskService {
  if (!taskServiceInstance) {
    taskServiceInstance = new TaskService();
  }
  return taskServiceInstance;
}
