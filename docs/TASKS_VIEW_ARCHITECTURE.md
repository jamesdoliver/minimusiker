# Tasks View Architecture

## Overview

The Tasks View (`/admin/tasks`) manages manual operational tasks for school events. Tasks are template-based: **templates are hardcoded** in the application, while **task instances are stored in Airtable** for tracking.

## Key Concepts

### Task Types
```typescript
type TaskType = 'paper_order' | 'clothing_order' | 'cd_master' | 'cd_production' | 'shipping';
```

### Completion Types
- `monetary` - Requires amount input + optional invoice upload
- `checkbox` - Requires confirmation checkbox
- `submit_only` - Just a submit button

### Timeline Offset
Days relative to event date. Negative = before event, positive = after.
- `-42` = 42 days before event
- `+1` = 1 day after event

### Urgency Algorithm
```typescript
// Lower score = more urgent
if (overdue) return -1000 + daysOverdue;  // e.g., -3 days overdue = -1003
return daysUntilDue;
```

## File Structure

```
src/
├── lib/
│   ├── types/tasks.ts              # Type definitions
│   ├── config/taskTemplates.ts     # Hardcoded templates + urgency calc
│   └── services/taskService.ts     # Task CRUD + completion logic
├── app/
│   ├── admin/tasks/page.tsx        # Main page
│   └── api/admin/tasks/
│       ├── route.ts                # GET tasks list
│       ├── [taskId]/route.ts       # GET/PATCH single task
│       └── guesstimate-orders/     # GO-ID CRUD
└── components/admin/tasks/
    ├── TaskCard.tsx                # Individual task card
    ├── TaskQueue.tsx               # Grid of cards
    ├── TaskTypeTabs.tsx            # Filter tabs with counts
    ├── TaskCompletionModal.tsx     # Completion form (3 types)
    ├── CompletedTasksView.tsx      # Completed tasks table
    ├── TaskTypeBadge.tsx           # Color-coded type badge
    ├── DeadlineCountdown.tsx       # Urgency display
    └── TaskSearchBar.tsx           # Debounced search
```

## Airtable Tables

### Tasks (`tblf59JyawJjgDqPJ`)
| Field | Purpose |
|-------|---------|
| task_id | Autonumber primary |
| template_id | Links to hardcoded template |
| event_id | Linked record → Events |
| task_type | Single select |
| status | pending / completed |
| completion_data | JSON with amount, notes, etc. |
| go_id | Linked record → GuesstimateOrders |
| parent_task_id | For shipping tasks linked to paper orders |

### GuesstimateOrders (`tblvNKyWN47i4blkr`)
Internal supplier order tracking (GO-0001, GO-0002, etc.)

Field IDs are in `src/lib/types/airtable.ts` at the bottom.

## Adding a New Task Type

### 1. Add to type definitions
`src/lib/types/tasks.ts`:
```typescript
// Add to TaskType union
export type TaskType = '...' | 'new_type';

// Add to TASK_TYPE_CONFIG
new_type: {
  label: 'New Type',
  icon: '🆕',
  color: 'text-pink-800',
  bgColor: 'bg-pink-100 border-pink-200',
}

// Add to TASK_FILTER_TABS
{ id: 'new_type', label: 'New Type' }
```

### 2. Create templates
`src/lib/config/taskTemplates.ts`:
```typescript
export const NEW_TYPE_TEMPLATES: TaskTemplate[] = [
  {
    id: 'new_type_task_1',
    type: 'new_type',
    name: 'Task Name',
    description: 'What to do',
    timeline_offset: -30,  // 30 days before event
    completion_type: 'monetary',
    r2_file: (eventId) => `events/${eventId}/path/to/file.pdf`,
    creates_go_id: true,
    creates_shipping: true,
  },
];
```

### 3. Add to task generation
`src/lib/services/taskService.ts` in `generateTasksForEvent()`:
```typescript
// Add loop for new templates
for (const template of NEW_TYPE_TEMPLATES) {
  // ... same pattern as PAPER_ORDER_TEMPLATES
}
```

### 4. Update filter counts
`src/app/api/admin/tasks/route.ts` - counts are auto-calculated from task_type field.

## Task Completion Flow

1. User clicks "Complete Task" on TaskCard
2. TaskCompletionModal opens with appropriate form
3. On submit: `PATCH /api/admin/tasks/[taskId]`
4. If template has `creates_go_id: true`:
   - Creates GuesstimateOrder record
   - Links task to GO-ID
5. If template has `creates_shipping: true`:
   - Creates shipping task linked to same GO-ID
6. Task marked as completed

## R2 Integration

Tasks can have downloadable files from R2. The `r2_file` function in templates returns the R2 path:
```typescript
r2_file: (eventId) => `events/${eventId}/printables/flyers/flyer1.pdf`
```

Download URLs are generated via `taskService.getTaskDownloadUrl()`.

## Current Paper Order Templates

| Template | Timeline | Completion | Creates |
|----------|----------|------------|---------|
| Poster & Letter | -58 days | submit_only | GO-ID + Shipping |
| Flyer One | -42 days | monetary | GO-ID + Shipping |
| Flyer Two | -22 days | monetary | GO-ID + Shipping |
| Flyer Three | -14 days | monetary | GO-ID + Shipping |
| Minicard | +1 day | monetary | GO-ID only |

## Task Generation Trigger

Tasks are generated when an event is confirmed. Call:
```typescript
await taskService.generateTasksForEvent(eventId);
```

This creates task instances in Airtable for all templates matching the event.
