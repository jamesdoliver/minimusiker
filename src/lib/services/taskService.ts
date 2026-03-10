import Airtable from 'airtable';
import { getAirtableService } from './airtableService';
import { getR2Service } from './r2Service';
import { getFulfillmentService, type WelleFulfillmentSummary } from './fulfillmentService';
import {
  Task,
  TaskWithEventDetails,
  TaskStatus,
  TaskType,
  TaskCompletionData,
  CreateTaskInput,
  GuesstimateOrder,
  GuesstimateOrderWithEventDetails,
  GuesstimateOrderItem,
  CreateGuesstimateOrderInput,
  TaskFilterTab,
  TaskMatrixRow,
  TaskMatrixCell,
  TaskCellStatus,
} from '@/lib/types/tasks';
import {
  PAPER_ORDER_TEMPLATES,
  CLOTHING_ORDER_TEMPLATES,
  SHIPPING_TEMPLATE,
  getTemplateById,
  calculateUrgencyScore,
  calculateDeadline,
} from '@/lib/config/taskTemplates';
import {
  TASK_TIMELINE,
  calculateDeadline as calculateDeadlineV2,
  type TaskPrefix,
  type TaskCompletionType as TimelineCompletionType,
} from '@/lib/config/taskTimeline';
import {
  TASKS_TABLE_ID,
  TASKS_FIELD_IDS,
  GUESSTIMATE_ORDERS_TABLE_ID,
  GUESSTIMATE_ORDERS_FIELD_IDS,
  EVENTS_FIELD_IDS,
  ORDERS_FIELD_IDS,
  type ShopifyOrderLineItem,
} from '@/lib/types/airtable';
import { getOrdersByEventRecordId } from './ordersHelper';
import { classifyVariant } from '@/lib/config/variantClassification';

/**
 * TaskService - Handles task generation, retrieval, and completion
 */
class TaskService {
  private airtable = getAirtableService();
  private r2 = getR2Service();

  /**
   * Fetch a single task record by ID using returnFieldsByFieldId.
   * .find() doesn't support returnFieldsByFieldId, so we use .select() with RECORD_ID() filter.
   */
  private async findTaskRecord(table: Airtable.Table<Airtable.FieldSet>, taskId: string) {
    const records = await table
      .select({
        returnFieldsByFieldId: true,
        filterByFormula: `RECORD_ID() = '${taskId}'`,
        maxRecords: 1,
      })
      .firstPage();
    if (records.length === 0) throw new Error(`Task not found: ${taskId}`);
    return records[0];
  }

  /**
   * Fetch a single GO record by ID using returnFieldsByFieldId.
   */
  private async findGoRecord(table: Airtable.Table<Airtable.FieldSet>, goId: string) {
    const records = await table
      .select({
        returnFieldsByFieldId: true,
        filterByFormula: `RECORD_ID() = '${goId}'`,
        maxRecords: 1,
      })
      .firstPage();
    if (records.length === 0) throw new Error(`GuesstimateOrder not found: ${goId}`);
    return records[0];
  }

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

    // Generate Clothing Order tasks from templates
    for (const template of CLOTHING_ORDER_TEMPLATES) {
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
      [TASKS_FIELD_IDS.event_id]: input.event_ids ?? [input.event_id], // Linked record(s)
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

    // Re-fetch with returnFieldsByFieldId for consistent field ID mapping
    const refetched = await this.findTaskRecord(table, record.id);
    return this.transformTaskRecord(refetched);
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
      // Escape single quotes to prevent Airtable formula injection
      const sanitizedSearch = options.search.replace(/'/g, "\\'");
      // Search across event_id, go_id display, and order_ids
      filters.push(`OR(
        SEARCH(LOWER('${sanitizedSearch}'), LOWER({${TASKS_FIELD_IDS.template_id}})),
        SEARCH(LOWER('${sanitizedSearch}'), LOWER({${TASKS_FIELD_IDS.order_ids}}))
      )`);
    }

    const filterFormula = filters.length > 0 ? `AND(${filters.join(', ')})` : '';

    // Fetch all tasks to calculate counts
    const allRecords = await table
      .select({
        returnFieldsByFieldId: true,
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
      standard_clothing_order: 0,
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
      ? await table.select({ returnFieldsByFieldId: true, filterByFormula: filterFormula }).all()
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
      // .find() doesn't support returnFieldsByFieldId, so use .select() with RECORD_ID() filter
      const records = await table
        .select({
          returnFieldsByFieldId: true,
          filterByFormula: `RECORD_ID() = '${taskId}'`,
          maxRecords: 1,
        })
        .firstPage();
      if (records.length === 0) return null;
      return this.enrichTaskWithEventDetails(records[0]);
    } catch {
      return null;
    }
  }

  /**
   * Complete a task
   * @param goEnrichment - Optional enrichment data for GO-ID (used by clothing orders)
   */
  async completeTask(
    taskId: string,
    completionData: TaskCompletionData,
    adminEmail: string,
    goEnrichment?: { order_ids?: string; contains?: GuesstimateOrderItem[] }
  ): Promise<{ task: Task; goId?: string; shippingTaskId?: string; fulfillmentSummary?: WelleFulfillmentSummary }> {
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    // Get the task first
    const record = await this.findTaskRecord(table, taskId);
    const task = this.transformTaskRecord(record);

    // Guard against double-completion
    if (task.status === 'completed') {
      throw new Error('Task is already completed');
    }

    // Handle orchestrated completion for shipment_welle_1 / shipment_welle_2 tasks
    if (
      task.template_id === 'shipment_welle_1' ||
      task.template_id === 'shipment_welle_2'
    ) {
      return this.completeWelleTask(task, taskId, adminEmail, completionData);
    }

    const template = getTemplateById(task.template_id);

    let goId: string | undefined;
    let shippingTaskId: string | undefined;

    // Create go_id if template requires it
    if (template?.creates_go_id) {
      const goOrder = await this.createGuesstimateOrder({
        event_id: task.event_id,
        event_ids: task.event_ids,
        order_date: new Date().toISOString().split('T')[0],
        order_amount: completionData.amount,
        order_ids: goEnrichment?.order_ids,
        contains: goEnrichment?.contains,
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

    if (goEnrichment?.order_ids) {
      updateFields[TASKS_FIELD_IDS.order_ids] = goEnrichment.order_ids;
    }

    await table.update(taskId, updateFields as Partial<Airtable.FieldSet>);

    // Create shipping task if template requires it
    if (template?.creates_shipping && goId) {
      const event = await this.airtable.getEventById(task.event_id);
      if (event) {
        const shippingTask = await this.createTask({
          event_id: task.event_id,
          event_ids: task.event_ids,
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
    const updatedRecord = await this.findTaskRecord(table, taskId);
    return {
      task: this.transformTaskRecord(updatedRecord),
      goId,
      shippingTaskId,
    };
  }

  /**
   * Handle orchestrated completion for Welle 1 / Welle 2 shipment tasks.
   *
   * Calls the FulfillmentService to batch-fulfill Shopify orders, then:
   * - If ALL orders succeeded: marks the task as completed with the summary
   * - If ANY orders failed: throws an error with the summary so the UI can display it
   */
  private async completeWelleTask(
    task: Task,
    taskId: string,
    adminEmail: string,
    completionData: TaskCompletionData,
  ): Promise<{ task: Task; fulfillmentSummary: WelleFulfillmentSummary }> {
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    const welle: 'Welle 1' | 'Welle 2' =
      task.template_id === 'shipment_welle_1' ? 'Welle 1' : 'Welle 2';

    const fulfillmentService = getFulfillmentService();
    const summary = await fulfillmentService.fulfillWelle(task.event_id, welle);

    // If any orders failed, throw with the summary attached so the UI can display details
    if (summary.failed > 0) {
      const error = new Error(
        `${welle} fulfillment partially failed: ${summary.succeeded}/${summary.total} succeeded, ${summary.failed} failed`,
      );
      // Attach the summary to the error for the API layer to extract
      (error as Error & { fulfillmentSummary: WelleFulfillmentSummary }).fulfillmentSummary = summary;
      throw error;
    }

    // All orders succeeded -- mark task as completed
    const mergedCompletionData = {
      ...completionData,
      fulfillment_summary: summary,
    };

    await table.update(taskId, {
      [TASKS_FIELD_IDS.status]: 'completed',
      [TASKS_FIELD_IDS.completed_at]: new Date().toISOString(),
      [TASKS_FIELD_IDS.completed_by]: adminEmail,
      [TASKS_FIELD_IDS.completion_data]: JSON.stringify(mergedCompletionData),
    } as Partial<Airtable.FieldSet>);

    // Refetch the updated task
    const updatedRecord = await this.findTaskRecord(table, taskId);
    return {
      task: this.transformTaskRecord(updatedRecord),
      fulfillmentSummary: summary,
    };
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string, adminEmail: string): Promise<Task> {
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    await table.update(taskId, {
      [TASKS_FIELD_IDS.status]: 'cancelled',
      [TASKS_FIELD_IDS.completed_by]: adminEmail,
      [TASKS_FIELD_IDS.completed_at]: new Date().toISOString(),
    } as Partial<Airtable.FieldSet>);

    const updatedRecord = await this.findTaskRecord(table, taskId);
    return this.transformTaskRecord(updatedRecord);
  }

  /**
   * Skip a task (mark as not applicable)
   */
  async skipTask(taskId: string, adminEmail: string): Promise<Task> {
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    await table.update(taskId, {
      [TASKS_FIELD_IDS.status]: 'skipped',
      [TASKS_FIELD_IDS.completed_by]: adminEmail,
      [TASKS_FIELD_IDS.completed_at]: new Date().toISOString(),
    } as Partial<Airtable.FieldSet>);

    const updatedRecord = await this.findTaskRecord(table, taskId);
    return this.transformTaskRecord(updatedRecord);
  }

  /**
   * Partially complete a task (requires notes)
   */
  async partialCompleteTask(
    taskId: string,
    completionData: TaskCompletionData,
    adminEmail: string,
  ): Promise<Task> {
    if (!completionData.notes) {
      throw new Error('Notes are required for partial completion');
    }

    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    await table.update(taskId, {
      [TASKS_FIELD_IDS.status]: 'partial',
      [TASKS_FIELD_IDS.completed_by]: adminEmail,
      [TASKS_FIELD_IDS.completed_at]: new Date().toISOString(),
      [TASKS_FIELD_IDS.completion_data]: JSON.stringify(completionData),
    } as Partial<Airtable.FieldSet>);

    const updatedRecord = await this.findTaskRecord(table, taskId);
    return this.transformTaskRecord(updatedRecord);
  }

  /**
   * Revert a completed/skipped/partial task back to pending
   */
  async revertTask(taskId: string, adminEmail: string): Promise<Task> {
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    // Verify the task is in a revertible state
    const record = await this.findTaskRecord(table, taskId);
    const task = this.transformTaskRecord(record);
    if (!['completed', 'skipped', 'partial'].includes(task.status)) {
      throw new Error(`Cannot revert task with status: ${task.status}`);
    }

    // Airtable REST API accepts null to clear fields; cast via unknown
    // because the Airtable SDK FieldSet type doesn't include null.
    await table.update(taskId, {
      [TASKS_FIELD_IDS.status]: 'pending',
      [TASKS_FIELD_IDS.completed_by]: null,
      [TASKS_FIELD_IDS.completed_at]: null,
      [TASKS_FIELD_IDS.completion_data]: null,
    } as unknown as Partial<Airtable.FieldSet>);

    const updatedRecord = await this.findTaskRecord(table, taskId);
    return this.transformTaskRecord(updatedRecord);
  }

  /**
   * Create a task record from TASK_TIMELINE config and immediately skip it.
   * Used for virtual cells that have no Airtable record yet.
   */
  async createAndSkipTask(
    eventId: string,
    templateId: string,
    adminEmail: string,
  ): Promise<Task> {
    const entry = TASK_TIMELINE.find((e) => e.id === templateId);
    if (!entry) throw new Error(`Unknown template: ${templateId}`);

    const event = await this.airtable.getEventById(eventId);
    if (!event) throw new Error(`Event not found: ${eventId}`);

    // Check for existing task record (race condition guard)
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);
    const existing = await table
      .select({
        returnFieldsByFieldId: true,
        filterByFormula: `AND({${TASKS_FIELD_IDS.event_id}} = '${event.event_id}', {${TASKS_FIELD_IDS.template_id}} = '${templateId}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (existing.length > 0) {
      return this.skipTask(existing[0].id, adminEmail);
    }

    const deadline = calculateDeadlineV2(event.event_date, entry.offset);
    const newTask = await this.createTask({
      event_id: eventId,
      template_id: entry.id,
      task_type: this.mapPrefixToTaskType(entry.prefix, entry.id),
      task_name: entry.displayName,
      description: entry.description,
      completion_type: this.mapCompletionType(entry.completion),
      timeline_offset: entry.offset,
      deadline: deadline.toISOString(),
      status: 'pending',
    });

    return this.skipTask(newTask.id, adminEmail);
  }

  /**
   * Create a task record from TASK_TIMELINE config and immediately partially complete it.
   * Used for virtual cells that have no Airtable record yet.
   */
  async createAndPartialTask(
    eventId: string,
    templateId: string,
    completionData: TaskCompletionData,
    adminEmail: string,
  ): Promise<Task> {
    const entry = TASK_TIMELINE.find((e) => e.id === templateId);
    if (!entry) throw new Error(`Unknown template: ${templateId}`);

    const event = await this.airtable.getEventById(eventId);
    if (!event) throw new Error(`Event not found: ${eventId}`);

    // Check for existing task record (race condition guard)
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);
    const existing = await table
      .select({
        returnFieldsByFieldId: true,
        filterByFormula: `AND({${TASKS_FIELD_IDS.event_id}} = '${event.event_id}', {${TASKS_FIELD_IDS.template_id}} = '${templateId}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (existing.length > 0) {
      return this.partialCompleteTask(existing[0].id, completionData, adminEmail);
    }

    const deadline = calculateDeadlineV2(event.event_date, entry.offset);
    const newTask = await this.createTask({
      event_id: eventId,
      template_id: entry.id,
      task_type: this.mapPrefixToTaskType(entry.prefix, entry.id),
      task_name: entry.displayName,
      description: entry.description,
      completion_type: this.mapCompletionType(entry.completion),
      timeline_offset: entry.offset,
      deadline: deadline.toISOString(),
      status: 'pending',
    });

    return this.partialCompleteTask(newTask.id, completionData, adminEmail);
  }

  /**
   * Create a GuesstimateOrder (go_id)
   */
  async createGuesstimateOrder(input: CreateGuesstimateOrderInput): Promise<GuesstimateOrder> {
    const base = this.airtable.getBase();
    const table = base(GUESSTIMATE_ORDERS_TABLE_ID);

    const fields: Record<string, string | number | string[]> = {
      [GUESSTIMATE_ORDERS_FIELD_IDS.event_id]: input.event_ids ?? [input.event_id],
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

    // Re-fetch with returnFieldsByFieldId for consistent field ID mapping
    const refetched = await this.findGoRecord(table, record.id);
    return this.transformGuesstimateOrderRecord(refetched);
  }

  /**
   * Get GuesstimateOrders, optionally filtered by event or pending status
   */
  async getGuesstimateOrders(eventId?: string, pendingOnly?: boolean): Promise<GuesstimateOrder[]> {
    const base = this.airtable.getBase();
    const table = base(GUESSTIMATE_ORDERS_TABLE_ID);

    const filters: string[] = [];

    if (eventId) {
      filters.push(`SEARCH('${eventId}', ARRAYJOIN({${GUESSTIMATE_ORDERS_FIELD_IDS.event_id}}))`);
    }

    if (pendingOnly) {
      filters.push(`{${GUESSTIMATE_ORDERS_FIELD_IDS.date_completed}} = BLANK()`);
    }

    const selectOptions: { filterByFormula?: string; returnFieldsByFieldId: boolean } = {
      returnFieldsByFieldId: true,
    };
    if (filters.length > 0) {
      selectOptions.filterByFormula = filters.length === 1
        ? filters[0]
        : `AND(${filters.join(', ')})`;
    }

    const records = await table.select(selectOptions).all();
    return records.map((record) => this.transformGuesstimateOrderRecord(record));
  }

  /**
   * Get a single GuesstimateOrder by its record ID
   */
  async getGuesstimateOrderById(goId: string): Promise<GuesstimateOrder | null> {
    const base = this.airtable.getBase();
    const table = base(GUESSTIMATE_ORDERS_TABLE_ID);

    try {
      const record = await this.findGoRecord(table, goId);
      return this.transformGuesstimateOrderRecord(record);
    } catch {
      return null;
    }
  }

  /**
   * Get GuesstimateOrders enriched with event details (for incoming orders view)
   */
  async getGuesstimateOrdersEnriched(options?: { pendingOnly?: boolean }): Promise<GuesstimateOrderWithEventDetails[]> {
    const orders = await this.getGuesstimateOrders(undefined, options?.pendingOnly);

    const enriched: GuesstimateOrderWithEventDetails[] = [];

    for (const order of orders) {
      let schoolName = 'Unknown School';
      let eventDate = '';

      if (order.event_id) {
        const event = await this.airtable.getEventById(order.event_id);
        if (event) {
          schoolName = event.school_name;
          eventDate = event.event_date;
        }
      }

      let parsedContains: GuesstimateOrderItem[] = [];
      if (order.contains) {
        try {
          parsedContains = JSON.parse(order.contains);
        } catch {
          // Ignore parse errors
        }
      }

      enriched.push({
        ...order,
        school_name: schoolName,
        event_date: eventDate,
        parsed_contains: parsedContains,
      });
    }

    return enriched;
  }

  /**
   * Mark a GuesstimateOrder as arrived (sets date_completed to today)
   */
  async markGuesstimateOrderArrived(goId: string): Promise<GuesstimateOrder> {
    const base = this.airtable.getBase();
    const table = base(GUESSTIMATE_ORDERS_TABLE_ID);

    await table.update(goId, {
      [GUESSTIMATE_ORDERS_FIELD_IDS.date_completed]: new Date().toISOString().split('T')[0],
    });

    const updatedRecord = await this.findGoRecord(table, goId);
    return this.transformGuesstimateOrderRecord(updatedRecord);
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
  // V2 Task Generation & Matrix Methods
  // ============================================================

  /**
   * Map a timeline prefix to the existing TaskType values used in Airtable.
   */
  private mapPrefixToTaskType(prefix: TaskPrefix, taskId: string): TaskType {
    switch (prefix) {
      case 'Ship':
        return 'paper_order';
      case 'Order':
        return 'clothing_order';
      case 'Shipment':
        return 'shipping';
      case 'Audio':
        return taskId.startsWith('audio_master') ? 'cd_master' : 'cd_production';
    }
  }

  /**
   * Map a timeline completion type to the existing TaskCompletionType used in Airtable.
   */
  private mapCompletionType(completion: TimelineCompletionType): Task['completion_type'] {
    switch (completion) {
      case 'monetary':
        return 'monetary';
      case 'orchestrated':
        return 'checkbox';
      case 'tracklist':
        return 'submit_only';
      case 'quantity_checkbox':
        return 'checkbox';
    }
  }

  /**
   * Generate all 11 tasks for an event using the new TASK_TIMELINE config.
   * This is the v2 replacement for generateTasksForEvent().
   */
  async generateTasksForEventV2(eventId: string): Promise<Task[]> {
    // Get event details to calculate deadlines
    const event = await this.airtable.getEventById(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    const eventDate = new Date(event.event_date);
    const createdTasks: Task[] = [];

    for (const entry of TASK_TIMELINE) {
      const deadline = calculateDeadlineV2(eventDate, entry.offset);

      const taskInput: CreateTaskInput = {
        event_id: eventId,
        template_id: entry.id,
        task_type: this.mapPrefixToTaskType(entry.prefix, entry.id),
        task_name: entry.displayName,
        description: entry.description,
        completion_type: this.mapCompletionType(entry.completion),
        timeline_offset: entry.offset,
        deadline: deadline.toISOString(),
        status: 'pending',
      };

      const task = await this.createTask(taskInput);
      createdTasks.push(task);
    }

    return createdTasks;
  }

  /**
   * Create a task record from TASK_TIMELINE config and immediately complete it.
   * Used for virtual cells that have no Airtable record yet.
   */
  async createAndCompleteTask(
    eventId: string,
    templateId: string,
    completionData: TaskCompletionData,
    adminEmail: string,
  ): Promise<{ task: Task; goId?: string; shippingTaskId?: string }> {
    // Find the TASK_TIMELINE entry
    const entry = TASK_TIMELINE.find((e) => e.id === templateId);
    if (!entry) {
      throw new Error(`Unknown template: ${templateId}`);
    }

    // Fetch event to compute deadline
    const event = await this.airtable.getEventById(eventId);
    if (!event) {
      throw new Error(`Event not found: ${eventId}`);
    }

    // Check for existing task record (race condition guard)
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);
    const existing = await table
      .select({
        returnFieldsByFieldId: true,
        filterByFormula: `AND({${TASKS_FIELD_IDS.event_id}} = '${event.event_id}', {${TASKS_FIELD_IDS.template_id}} = '${templateId}')`,
        maxRecords: 1,
      })
      .firstPage();

    if (existing.length > 0) {
      const existingTask = this.transformTaskRecord(existing[0]);
      if (existingTask.status === 'completed') {
        throw new Error('Task is already completed');
      }
      // Task exists but not completed — complete it via normal flow
      return this.completeTask(existingTask.id, completionData, adminEmail);
    }

    // Create the task record
    const deadline = calculateDeadlineV2(event.event_date, entry.offset);
    const newTask = await this.createTask({
      event_id: eventId,
      template_id: entry.id,
      task_type: this.mapPrefixToTaskType(entry.prefix, entry.id),
      task_name: entry.displayName,
      description: entry.description,
      completion_type: this.mapCompletionType(entry.completion),
      timeline_offset: entry.offset,
      deadline: deadline.toISOString(),
      status: 'pending',
    });

    // Complete it
    return this.completeTask(newTask.id, completionData, adminEmail);
  }

  /**
   * Get a task matrix: one row per Confirmed event, one cell per timeline task.
   * Event-driven: shows ALL confirmed events with virtual cells computed from
   * TASK_TIMELINE, overlaying any real task records on top.
   */
  async getTaskMatrix(filters?: {
    dateFrom?: string;
    dateTo?: string;
    search?: string;
  }): Promise<TaskMatrixRow[]> {
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    // 1. Parallel fetch: confirmed events + all non-cancelled tasks
    const [confirmedEvents, taskRecords] = await Promise.all([
      this.airtable.getConfirmedEvents(),
      table
        .select({
          returnFieldsByFieldId: true,
          filterByFormula: `{${TASKS_FIELD_IDS.status}} != 'cancelled'`,
        })
        .all(),
    ]);

    // 2. Index tasks by event_id → template_id for O(1) lookup
    const taskIndex = new Map<string, Map<string, Task>>();
    for (const record of taskRecords) {
      const task = this.transformTaskRecord(record);
      if (!task.event_id) continue;
      let eventMap = taskIndex.get(task.event_id);
      if (!eventMap) {
        eventMap = new Map();
        taskIndex.set(task.event_id, eventMap);
      }
      // If duplicate task records for same event+template, prefer completed > pending
      const existing = eventMap.get(task.template_id);
      if (!existing || (task.status === 'completed' && existing.status !== 'completed')) {
        eventMap.set(task.template_id, task);
      }
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // 3. Build rows from events (not tasks)
    const rows: TaskMatrixRow[] = [];

    for (const event of confirmedEvents) {
      // Skip events without event_date (can't compute deadlines)
      if (!event.event_date) continue;

      const eventTaskMap = taskIndex.get(event.id);
      const cells: Record<string, TaskMatrixCell> = {};

      for (const entry of TASK_TIMELINE) {
        const realTask = eventTaskMap?.get(entry.id);

        if (realTask) {
          // Real task record exists — use its data
          const deadlineDate = new Date(realTask.deadline);
          deadlineDate.setHours(0, 0, 0, 0);
          const diffMs = deadlineDate.getTime() - now.getTime();
          const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          let cellStatus: TaskCellStatus;
          if (realTask.status === 'completed') {
            cellStatus = 'green';
          } else if (realTask.status === 'cancelled' || realTask.status === 'skipped') {
            cellStatus = 'grey';
          } else if (realTask.status === 'partial') {
            cellStatus = 'orange';
          } else if (daysUntilDue < 0) {
            cellStatus = 'red';
          } else if (daysUntilDue <= 3) {
            cellStatus = 'yellow';
          } else {
            cellStatus = 'white';
          }

          cells[entry.id] = {
            taskId: realTask.id,
            templateId: entry.id,
            status: realTask.status,
            cellStatus,
            deadline: realTask.deadline,
            daysUntilDue,
            completedAt: realTask.completed_at,
          };
        } else {
          // Virtual cell — compute from TASK_TIMELINE config
          const deadline = calculateDeadlineV2(event.event_date, entry.offset);
          deadline.setHours(0, 0, 0, 0);
          const diffMs = deadline.getTime() - now.getTime();
          const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

          let cellStatus: TaskCellStatus;
          if (daysUntilDue < 0) {
            cellStatus = 'red';
          } else if (daysUntilDue <= 3) {
            cellStatus = 'yellow';
          } else {
            cellStatus = 'white';
          }

          cells[entry.id] = {
            taskId: null,
            templateId: entry.id,
            status: 'pending',
            cellStatus,
            deadline: deadline.toISOString(),
            daysUntilDue,
          };
        }
      }

      rows.push({
        eventId: event.id,
        eventRecordId: event.id,
        schoolName: event.school_name,
        eventDate: event.event_date,
        cells,
      });
    }

    // 4. Apply filters
    let filteredRows = rows;

    if (filters?.dateFrom) {
      const from = new Date(filters.dateFrom);
      filteredRows = filteredRows.filter(
        (row) => new Date(row.eventDate) >= from
      );
    }

    if (filters?.dateTo) {
      const to = new Date(filters.dateTo);
      filteredRows = filteredRows.filter(
        (row) => new Date(row.eventDate) <= to
      );
    }

    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      filteredRows = filteredRows.filter((row) =>
        row.schoolName.toLowerCase().includes(searchLower)
      );
    }

    // 5. Sort: most urgent first (events with most red/yellow cells at top)
    filteredRows.sort((a, b) => {
      const urgencyCount = (row: TaskMatrixRow): number => {
        let count = 0;
        for (const cell of Object.values(row.cells)) {
          if (cell.cellStatus === 'red') count += 2;
          if (cell.cellStatus === 'yellow') count += 1;
        }
        return count;
      };

      const urgA = urgencyCount(a);
      const urgB = urgencyCount(b);

      if (urgA !== urgB) {
        return urgB - urgA;
      }

      return new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime();
    });

    return filteredRows;
  }

  /**
   * Get pending tasks grouped by deadline date within a date range.
   * Event-driven: computes virtual tasks from TASK_TIMELINE for all Confirmed
   * events, overlaying real task records on top.
   */
  async getTasksByDate(
    dateFrom: string,
    dateTo: string
  ): Promise<Record<string, TaskWithEventDetails[]>> {
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    // 1. Parallel fetch: confirmed events + all non-cancelled tasks
    const [confirmedEvents, taskRecords] = await Promise.all([
      this.airtable.getConfirmedEvents(),
      table
        .select({
          returnFieldsByFieldId: true,
          filterByFormula: `{${TASKS_FIELD_IDS.status}} != 'cancelled'`,
        })
        .all(),
    ]);

    // 2. Index tasks by event_id → template_id
    const taskIndex = new Map<string, Map<string, Task>>();
    for (const record of taskRecords) {
      const task = this.transformTaskRecord(record);
      if (!task.event_id) continue;
      let eventMap = taskIndex.get(task.event_id);
      if (!eventMap) {
        eventMap = new Map();
        taskIndex.set(task.event_id, eventMap);
      }
      const existing = eventMap.get(task.template_id);
      if (!existing || (task.status === 'completed' && existing.status !== 'completed')) {
        eventMap.set(task.template_id, task);
      }
    }

    const fromDate = new Date(dateFrom);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(dateTo);
    toDate.setHours(0, 0, 0, 0);

    // 3. Build grouped results from events
    const grouped: Record<string, TaskWithEventDetails[]> = {};

    for (const event of confirmedEvents) {
      if (!event.event_date) continue;

      const eventTaskMap = taskIndex.get(event.id);

      for (const entry of TASK_TIMELINE) {
        const deadline = calculateDeadlineV2(event.event_date, entry.offset);
        deadline.setHours(0, 0, 0, 0);

        // Filter to date range
        if (deadline < fromDate || deadline > toDate) continue;

        const realTask = eventTaskMap?.get(entry.id);

        // Skip completed and skipped tasks (this view shows pending + partial)
        if (realTask?.status === 'completed' || realTask?.status === 'skipped') continue;

        const deadlineStr = deadline.toISOString();
        const dateKey = deadlineStr.split('T')[0];
        const { urgencyScore, daysUntilDue, isOverdue } = calculateUrgencyScore(deadline);

        let taskDetails: TaskWithEventDetails;

        if (realTask) {
          // Real pending task — use its data enriched with event details
          taskDetails = {
            ...realTask,
            school_name: event.school_name,
            event_date: event.event_date,
            event_type: event.event_type,
            urgency_score: urgencyScore,
            days_until_due: daysUntilDue,
            is_overdue: isOverdue,
          };
        } else {
          // Virtual task — construct from TASK_TIMELINE config
          taskDetails = {
            id: `virtual_${event.id}_${entry.id}`,
            task_id: `virtual_${event.id}_${entry.id}`,
            template_id: entry.id,
            event_id: event.id,
            task_type: this.mapPrefixToTaskType(entry.prefix, entry.id),
            task_name: entry.displayName,
            description: entry.description,
            completion_type: this.mapCompletionType(entry.completion),
            timeline_offset: entry.offset,
            deadline: deadlineStr,
            status: 'pending',
            created_at: '',
            school_name: event.school_name,
            event_date: event.event_date,
            event_type: event.event_type,
            urgency_score: urgencyScore,
            days_until_due: daysUntilDue,
            is_overdue: isOverdue,
          };
        }

        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(taskDetails);
      }
    }

    return grouped;
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
      event_ids: eventIds,
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
    let eventType: string | undefined;

    if (task.event_id) {
      const event = await this.airtable.getEventById(task.event_id);
      if (event) {
        schoolName = event.school_name;
        eventDate = event.event_date;
        eventType = event.event_type;
      }
    }

    // For standard_clothing_order tasks with multiple events, show batch summary
    if (task.task_type === 'standard_clothing_order' && task.event_ids && task.event_ids.length > 1) {
      schoolName = `${task.event_ids.length} schools`;
    }

    // Get go_id display value and stock arrival status
    let goDisplayId: string | undefined;
    let stockArrived: boolean | undefined;
    if (task.go_id) {
      try {
        const base = this.airtable.getBase();
        const goTable = base(GUESSTIMATE_ORDERS_TABLE_ID);
        const goRecord = await goTable.find(task.go_id);
        goDisplayId = goRecord.get(GUESSTIMATE_ORDERS_FIELD_IDS.go_id) as string;

        // For shipping tasks, check if linked GO-ID stock has arrived
        if (task.task_type === 'shipping') {
          const dateCompleted = goRecord.get(GUESSTIMATE_ORDERS_FIELD_IDS.date_completed) as string | undefined;
          stockArrived = !!dateCompleted;
        }
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
      stock_arrived: stockArrived,
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

  /**
   * Recalculate deadlines for all pending tasks when event date changes
   * Only affects tasks with status 'pending' - completed tasks are not modified
   * @param eventRecordId - The Airtable record ID of the event
   * @param newEventDate - The new event date in YYYY-MM-DD format
   * @returns Number of tasks updated
   */
  async recalculateDeadlinesForEvent(
    eventRecordId: string,
    newEventDate: string
  ): Promise<{ updatedCount: number; tasks: string[] }> {
    const base = this.airtable.getBase();
    const table = base(TASKS_TABLE_ID);

    // Parse new event date
    const eventDate = new Date(newEventDate);
    if (isNaN(eventDate.getTime())) {
      throw new Error('Invalid event date format');
    }

    // Find all pending tasks for this event
    // Use SEARCH() with ARRAYJOIN() because event_id is a linked record field (array)
    const sanitizedEventId = eventRecordId.replace(/'/g, "\\'");
    const records = await table
      .select({
        returnFieldsByFieldId: true,
        filterByFormula: `AND(
          SEARCH('${sanitizedEventId}', ARRAYJOIN({${TASKS_FIELD_IDS.event_id}})),
          {${TASKS_FIELD_IDS.status}} = 'pending'
        )`,
      })
      .all();

    const updatedTasks: string[] = [];

    // Update each task's deadline based on its timeline_offset
    for (const record of records) {
      const timelineOffset = record.get(TASKS_FIELD_IDS.timeline_offset) as number | undefined;

      // Skip tasks without timeline_offset (e.g., manually created tasks)
      if (timelineOffset === undefined || timelineOffset === null) {
        continue;
      }

      // Calculate new deadline using the existing calculateDeadline function
      const newDeadline = calculateDeadline(eventDate, timelineOffset);

      // Update the task
      await table.update(record.id, {
        [TASKS_FIELD_IDS.deadline]: newDeadline.toISOString().split('T')[0], // Date only
      });

      updatedTasks.push(record.id);
    }

    console.log(
      `Recalculated deadlines for ${updatedTasks.length} tasks for event ${eventRecordId} with new date ${newEventDate}`
    );

    return {
      updatedCount: updatedTasks.length,
      tasks: updatedTasks,
    };
  }

  /**
   * Get the total CD quantity ordered for an event.
   *
   * Fetches all orders linked to the event, parses their line_items JSON,
   * and sums quantities of items classified as 'audio' (CD variants).
   */
  async getCdQuantityForEvent(eventRecordId: string): Promise<number> {
    const orders = await getOrdersByEventRecordId(eventRecordId);

    let totalCdQuantity = 0;

    for (const order of orders) {
      // Only count paid orders
      const paymentStatus = order.get(ORDERS_FIELD_IDS.payment_status) as string | undefined;
      if (paymentStatus !== 'paid') continue;

      const lineItemsRaw = order.get(ORDERS_FIELD_IDS.line_items) as string | undefined;
      if (!lineItemsRaw) continue;

      let lineItems: ShopifyOrderLineItem[];
      try {
        lineItems = JSON.parse(lineItemsRaw);
      } catch {
        console.warn(`[getCdQuantityForEvent] Failed to parse line_items for order ${order.id}`);
        continue;
      }

      for (const item of lineItems) {
        const category = classifyVariant(String(item.variant_id));
        if (category === 'audio') {
          totalCdQuantity += item.quantity;
        }
      }
    }

    return totalCdQuantity;
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
