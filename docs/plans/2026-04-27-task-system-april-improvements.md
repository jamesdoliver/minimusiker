# Task System April Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up the orphaned completion components, tighten input validation, unify the legacy and new template systems, and establish baseline reliability/cleanup hygiene across the admin task system.

**Architecture:** Three sequential phases mapped to three commit groupings. Phase 1 (safety + UI wiring) ships first — highest user value, contained blast radius. Phase 2 (type system unification) ships second once the new completion paths are confirmed working. Phase 3 (reliability + cleanup) ships last, parallelizable across small commits.

**Tech Stack:** Next.js 14 App Router, TypeScript, Airtable (via `airtable.js`), R2 (via `@aws-sdk/client-s3`), Shopify Admin API, Jest + Playwright. Test infra has known `jest-dom` matcher type issues; production `type-check` is clean.

**Worktree:** `.worktrees/task_system_april/` on branch `task_system_april`.

**Reference docs:**
- Audit: `docs/plans/2026-02-15-task-system-audit.md`
- Overhaul design: `docs/plans/2026-03-09-task-system-overhaul-design.md`
- E2E checklist: `docs/plans/2026-03-10-task-system-e2e-test-checklist.md`

**Working invariants for every task:**
- Branch: `task_system_april`. Never push without explicit user approval.
- After every task: run `npm run type-check`, `npm run lint`, then commit.
- Commit messages follow the conventional-commits style already in this repo (`fix:`, `feat:`, `refactor:`, `chore:`).
- No `--no-verify`, no amending of pushed commits.
- Test infra: production code must remain type-clean. Tests live in `tests/unit/` (jest) and `tests/e2e/` (playwright).

---

## Phase 1 — Safety + completion wiring

Goal: lock down two input-validation gaps, then wire the three orphan completion UIs into the per-event detail page and the matrix popover. After Phase 1, every task type completes via its correct UI.

### Task 1.1: Whitelist `status` in `PATCH /api/admin/tasks/[taskId]`

**Why:** Currently any unknown `body.status` falls through to `completeTask`. A typo, future enum value, or malicious payload silently completes a task instead of erroring.

**Files:**
- Modify: `src/app/api/admin/tasks/[taskId]/route.ts:60-148`
- Create: `tests/unit/api/tasks-patch-validation.test.ts`

**Change:**

Add at the top of the `PATCH` function body, after `body = await request.json()`:

```typescript
const VALID_STATUS_OVERRIDES = ['cancelled', 'skipped', 'partial', 'pending'] as const;
type ValidStatusOverride = typeof VALID_STATUS_OVERRIDES[number];

if (
  body.status !== undefined &&
  !VALID_STATUS_OVERRIDES.includes(body.status)
) {
  return NextResponse.json(
    {
      success: false,
      error: `Invalid status. Expected one of: ${VALID_STATUS_OVERRIDES.join(', ')} or omit for completion.`,
    },
    { status: 400 },
  );
}
```

Place it before the `if (body.status === 'cancelled')` block.

**Test (write first):** create `tests/unit/api/tasks-patch-validation.test.ts` exercising the validator function. Extract the whitelist to a small pure helper if needed so we can unit-test it without mocking Next's request/response.

```typescript
import { isValidStatusOverride } from '@/app/api/admin/tasks/[taskId]/route';

describe('isValidStatusOverride', () => {
  it('accepts the four valid overrides', () => {
    expect(isValidStatusOverride('cancelled')).toBe(true);
    expect(isValidStatusOverride('skipped')).toBe(true);
    expect(isValidStatusOverride('partial')).toBe(true);
    expect(isValidStatusOverride('pending')).toBe(true);
  });
  it('accepts undefined (default completion path)', () => {
    expect(isValidStatusOverride(undefined)).toBe(true);
  });
  it('rejects unknown strings', () => {
    expect(isValidStatusOverride('completed')).toBe(false);
    expect(isValidStatusOverride('done')).toBe(false);
    expect(isValidStatusOverride('')).toBe(false);
    expect(isValidStatusOverride('skipped_and_destroy')).toBe(false);
  });
});
```

To keep the helper testable and the route file unchanged in spirit, export `isValidStatusOverride` from the route file (Next.js permits arbitrary exports from route handlers — they just won't be served as endpoints).

**Verify:**
```bash
npm run type-check
npm test -- tests/unit/api/tasks-patch-validation.test.ts
```
Expected: type-check passes; new test passes.

**Commit:** `fix: validate status override in task PATCH handler`

---

### Task 1.2: Whitelist `status` in `GET /api/admin/orders` (formula injection)

**Why:** `route.ts:94` interpolates the `status` query param straight into an Airtable `filterByFormula` string. A crafted value like `paid"} OR {1}=1 OR {a}="b` could exfiltrate or alter the result set.

**Files:**
- Modify: `src/app/api/admin/orders/route.ts` (around line 94)

**Change:**

Add a whitelist near the top of the GET handler:

```typescript
const VALID_PAYMENT_STATUSES = ['paid', 'pending', 'refunded', 'authorized', 'voided'] as const;

const rawStatus = searchParams.get('status');
const status = rawStatus && VALID_PAYMENT_STATUSES.includes(rawStatus as typeof VALID_PAYMENT_STATUSES[number])
  ? rawStatus
  : null;
```

Then use the validated `status` in the formula. If `rawStatus` was provided but not whitelisted, return `400` with a helpful error rather than silently ignoring.

**Verify:**
```bash
npm run type-check
curl -s 'http://localhost:3000/api/admin/orders?status=paid"' --cookie "admin_token=..."  # expect 400
```

If running curl against a logged-in dev server is too involved, do the verification by reading the new code once more and confirming the formula no longer contains `${rawStatus}`.

**Commit:** `fix: whitelist payment_status param in admin orders endpoint`

---

### Task 1.3: Build `MonetaryCompletion` inline panel component

**Why:** Three of the four completion modes already have inline panel components (`MasterCdCompletion`, `CdProductionCompletion`, `WelleCompletion`). Monetary tasks (the bulk: ship/order tasks, 7 of 11) currently have only the legacy `TaskCompletionModal`, which reads the legacy `completion_type` enum. We need an inline-panel sibling for the new dispatch.

**Files:**
- Create: `src/components/admin/tasks/MonetaryCompletion.tsx`

**Spec:**

Props:
```typescript
interface MonetaryCompletionProps {
  taskId: string;
  taskName: string;            // for display, e.g. "Ship: Poster"
  willCreateGoId: boolean;     // from TaskTimelineEntry.creates_go_id
  onComplete: () => void;
}
```

Behavior:
- Cost input (required, `type="number"`, `step="0.01"`, `min="0"`, parse as float, must be `> 0`)
- Optional invoice file upload (PDF/PNG/JPG, ≤ 10 MB) — same validation as `TaskCompletionModal:120-131`
- Optional notes textarea
- Submit button:
  1. `PATCH /api/admin/tasks/${taskId}` with `{ completion_data: { amount, notes } }`
  2. If invoice file present, `POST /api/admin/tasks/${taskId}/invoice` (FormData) — failure of upload should NOT roll back completion (matches existing `TaskCompletionModal:88-105` behaviour); show a non-blocking warning.
  3. Call `onComplete()` on success
- Loading + error states matching the visual language of `CdProductionCompletion` (Tailwind, `#94B8B3` primary)
- Banner above the submit button: "This will create a new GO-ID for order tracking." when `willCreateGoId`.

Do NOT add the "shipping task creation" sub-text here — Phase 2 task 2.4 audits whether v2 tasks should auto-create shipping tasks at all.

**Verify:**
```bash
npm run type-check
npm run lint -- src/components/admin/tasks/MonetaryCompletion.tsx
```

Component is intentionally not yet imported anywhere; that happens in Task 1.4.

**Commit:** `feat: add MonetaryCompletion inline panel for v2 task dispatch`

---

### Task 1.4: Refactor `EventDetailTimeline` `ExpandedTaskCard` to dispatch by completion type

**Why:** Current `ExpandedTaskCard` always sends `{ confirmed: true }` regardless of `entry.completion`. The new design has four modes — wire each to its component.

**Files:**
- Modify: `src/components/admin/tasks/EventDetailTimeline.tsx:262-404`
- Modify: `src/app/admin/tasks/[eventId]/page.tsx` (pass refetch callback through)

**Change to `EventDetailTimeline.tsx`:**

1. Add prop `onTaskRefresh: () => void` to both `EventDetailTimelineProps` and `ExpandedTaskCardProps`. Thread it through.

2. Replace the body of `ExpandedTaskCard` after the detail grid (lines 385-400) with a `switch (entry.completion)`:

```typescript
function CompletionBody({
  entry,
  task,
  onComplete,
}: {
  entry: TaskTimelineEntry;
  task: TaskWithEventDetails | undefined;
  onComplete: () => void;
}) {
  if (!task) {
    return (
      <p className="mt-4 text-sm text-gray-500">
        Task record not yet created — completing this from the matrix will
        create the underlying record automatically.
      </p>
    );
  }

  switch (entry.completion) {
    case 'monetary':
      return (
        <MonetaryCompletion
          taskId={task.id}
          taskName={entry.displayName}
          willCreateGoId={entry.creates_go_id}
          onComplete={onComplete}
        />
      );
    case 'tracklist':
      return (
        <MasterCdCompletion
          taskId={task.id}
          eventId={task.event_id}
          onComplete={onComplete}
        />
      );
    case 'quantity_checkbox':
      return (
        <CdProductionCompletion
          taskId={task.id}
          eventId={task.event_id}
          onComplete={onComplete}
        />
      );
    case 'orchestrated': {
      const welle: 'Welle 1' | 'Welle 2' =
        entry.id === 'shipment_welle_1' ? 'Welle 1' : 'Welle 2';
      return (
        <WelleCompletion
          taskId={task.id}
          eventId={task.event_id}
          welle={welle}
          onComplete={onComplete}
        />
      );
    }
    default: {
      const _exhaustive: never = entry.completion;
      return <p className="text-red-600">Unknown completion type: {_exhaustive}</p>;
    }
  }
}
```

3. Replace `window.location.reload()` (line 304) with `onTaskRefresh()`. Remove the inline `handleMarkComplete` and `Mark Complete` button — completion now happens inside the dispatched component.

4. Keep the existing "completed_at / completed_by" display (lines 371-383) when `cellStatus === 'green'`.

**Change to `[eventId]/page.tsx`:**

Extract `fetchEventData` so it can be re-called:
```typescript
const fetchEventData = useCallback(async () => {
  // existing body
}, [eventId]);

useEffect(() => { fetchEventData(); }, [fetchEventData]);
```

Pass `<EventDetailTimeline tasks={tasks} eventDate={event.eventDate} onTaskRefresh={fetchEventData} />`.

**Verify:**
```bash
npm run type-check
npm run lint
```

Manual verification when convenient:
1. Start dev server: `npm run dev`
2. Login as `till@minimusiker.de` / `1`
3. Navigate to `/admin/tasks` → click an event row → verify per-event detail loads
4. Click each pending task type and confirm the right inline panel renders. Do NOT actually complete tasks against production data.

**Commit:** `feat: dispatch task completion to specialized inline panels`

---

### Task 1.5: Refactor `TaskMatrixPopover` to dispatch by completion type

**Why:** The matrix popover is the second entry point to task completion. Same gap as the per-event timeline.

**Files:**
- Modify: `src/components/admin/tasks/TaskMatrixPopover.tsx`
- Read for context: `src/components/admin/tasks/TaskMatrix.tsx` (parent — uses `onAction` callback)

**Approach:**

The popover is constrained for space (`w-72` / `w-96`). For monetary tasks, keep the inline form simple (single cost field + notes, no invoice upload — the user can finish that on the per-event detail page). For audio/orchestrated tasks the popover should redirect to the per-event detail page rather than rendering the full panel.

Concretely:

1. After existing header, add a section that switches on `entry.completion`:

```typescript
{canComplete && entry && (
  (() => {
    switch (entry.completion) {
      case 'monetary':
        return <PopoverMonetaryQuickComplete taskId={cell.taskId} eventId={eventId} templateId={templateId} onCompleted={onClose} />;
      case 'tracklist':
      case 'quantity_checkbox':
      case 'orchestrated':
        return (
          <Link
            href={`/admin/tasks/${eventId}`}
            className="block w-full text-center px-3 py-2 bg-[#94B8B3] text-white text-sm font-medium rounded-lg hover:bg-[#7da39e] transition-colors"
          >
            Open completion panel →
          </Link>
        );
    }
  })()
)}
```

2. `PopoverMonetaryQuickComplete` is a tiny inline form: cost + notes, submit. Reuses the same `PATCH /api/admin/tasks/[taskId]` call. If `cell.taskId` is null (virtual cell), it should call `POST /api/admin/tasks/matrix/complete` instead — that endpoint accepts a `templateId` + `eventId` and creates-then-completes in one go. Read its current shape before writing the form.

3. Drop the existing generic action buttons that send `{ confirmed: true }` for non-orchestrated tasks. Keep the cancel / skip / revert buttons unchanged.

4. After successful completion, call `onAction('refresh')` then `onClose()` so the parent matrix refetches.

**Verify:**
```bash
npm run type-check
npm run lint
```

Manual: from the matrix, click cells of each completion type and confirm the popover's behaviour matches the spec above.

**Commit:** `feat: dispatch matrix popover completion by task type`

---

### Task 1.6: Smoke test the completion flows end-to-end (manual)

**Why:** Phase 1 is the user-visible piece. Confirm before moving to refactoring in Phase 2.

**Steps:**
1. `npm run dev`
2. Walk through `docs/plans/2026-03-10-task-system-e2e-test-checklist.md` Sections 4 (matrix popover), 5 (by-date), 7 (per-event detail), 13 (completion flows).
3. For destructive flows (Section 13), use a dev-only test event if available, or note "verified UI state, did not click Confirm."
4. Capture screenshots of: monetary panel, master CD panel, CD production panel, Welle 1 panel — drop into `docs/plans/2026-04-27-task-system-april-improvements/` (create folder).

**No code changes. Document findings in a brief `phase-1-smoke-notes.md` in the same folder.**

**Commit (docs only):** `docs: phase 1 completion smoke-test notes`

---

## Phase 2 — Type system unification

Goal: collapse the parallel legacy template system into the single `taskTimeline.ts` source of truth. After Phase 2, `taskTemplates.ts` no longer exists; all callers read from `TASK_TIMELINE`; `TaskCompletionType` has one definition; `recalculateDeadlinesForEvent` uses the v2 calculator.

This phase has migration risk because Airtable Task records carry `template_id` strings. Some existing records may use legacy IDs (`flyer1`, `poster_letter`, `order_schul_shirts`, etc.). Before deleting legacy IDs we need to either: (a) verify no records use them, or (b) translate them.

### Task 2.1: Audit live `template_id` values in Airtable

**Why:** We can't safely remove legacy IDs without knowing what's stored.

**Files:**
- Create: `scripts/audit-task-template-ids.ts`

**What it does:**
- Connects to Airtable using existing service credentials.
- Reads all `Tasks` records.
- Aggregates and prints a histogram of `template_id` values, partitioned by `status` (pending vs completed/skipped/cancelled).
- Writes the result to `docs/plans/2026-04-27-task-system-april-improvements/template-id-audit.md`.

**Verify:**
```bash
npx ts-node scripts/audit-task-template-ids.ts
cat docs/plans/2026-04-27-task-system-april-improvements/template-id-audit.md
```

**Decision point:** Based on the audit:
- **All legacy IDs are completed/cancelled only** → safe to delete legacy IDs (their meaning is frozen in completion data; we don't need template lookups).
- **Pending tasks reference legacy IDs** → Task 2.2 must rename them in Airtable before code removal.

Document the decision in the audit file.

**Commit:** `chore: audit live task template_id distribution`

---

### Task 2.2 (conditional): Backfill / rename pending legacy `template_id` values

Skip this task if Task 2.1 showed no pending tasks use legacy IDs.

**Why:** If pending tasks reference `flyer1`/`poster_letter`/`order_schul_shirts`, removing legacy lookups breaks them.

**Files:**
- Create: `scripts/migrate-legacy-template-ids.ts`

**Mapping (from offsets and intent):**
| Legacy | New | Notes |
|--------|-----|-------|
| `poster_letter` (-58) | `ship_poster` (-45) | offset changed; deadline must recalc per Task 2.6 |
| `flyer1` (-42) | `ship_flyer_1` (-43) | offset off-by-one |
| `flyer2` (-22) | `ship_flyer_2` (-18) | offset changed |
| `flyer3` (-14) | `ship_flyer_3` (-10) | offset changed |
| `minicard` (+1) | `order_minicard` (+5) | offset changed; new prefix |
| `order_schul_shirts` (-18) | `order_schul_clothing` (-18) | rename only |
| `order_standard_shirts` (0) | (no v2 equivalent) | leave as-is — see Task 2.7 |

**Behavior:**
- Dry-run mode by default (`--apply` flag to actually write).
- For each pending Task with a legacy `template_id`, update both `template_id` and (if its `deadline` differs from the new offset's recalculated value) the `deadline`.
- Print a summary table: count per migration, errors.

**Verify:**
```bash
npx ts-node scripts/migrate-legacy-template-ids.ts          # dry run
npx ts-node scripts/migrate-legacy-template-ids.ts --apply  # only after dry-run review
```

**Commit:** `chore: migrate pending legacy task template_id values`

---

### Task 2.3: Decide and document v2 shipping-task semantics

**Why:** Today, `taskService.completeTask()` calls `getTemplateById(task.template_id)` to read `creates_shipping`. Legacy templates set this to `true`; v2 timeline entries don't have the field at all. So v2 tasks never auto-create separate shipping tasks. Two interpretations:

**Interpretation A (likely):** The v2 design absorbed shipping into each `Ship: *` and `Shipment: *` task. There's no separate "shipping" follow-up task. The dead `creates_shipping` branch is just legacy debris.

**Interpretation B:** v2 was supposed to keep the same auto-create-shipping-after-paper-order pattern but the wiring was missed.

**Files:**
- Read: `docs/plans/2026-03-09-task-system-overhaul-design.md` Sections 2, 3, 9
- Read: `src/lib/services/taskService.ts:300-365`
- Read: `src/lib/config/taskTemplates.ts` (`SHIPPING_TEMPLATE`)

**Action:**
1. Re-read the overhaul design Section 2 timeline. Confirm whether "Ship" tasks in v2 are intended to encapsulate both ordering and shipping, or whether shipping is a separate downstream task.
2. Write a short decision note in `docs/plans/2026-04-27-task-system-april-improvements/shipping-task-decision.md` (under 150 words) — pick A or B with quoted evidence from the design doc.
3. If A: the work in Task 2.4 includes deleting the shipping-task creation branch entirely.
4. If B: Task 2.4 must include a v2 mapping (which v2 tasks create shipping follow-ups, and what those follow-ups look like).

**No code changes yet. This is the prerequisite for Task 2.4.**

**Commit:** `docs: decide v2 shipping-task semantics (A or B)`

---

### Task 2.4: Migrate `clothingOrdersService.ts` and the event settings page off `taskTemplates.ts`

**Why:** These are the two non-`taskService` consumers of legacy templates. After this task, only `taskService.ts` itself imports from `taskTemplates.ts`.

**Files:**
- Modify: `src/lib/services/clothingOrdersService.ts`
- Modify: `src/app/admin/events/[eventId]/settings/page.tsx`

**Approach for `clothingOrdersService.ts`:**
- Currently imports `calculateDeadline` from `taskTemplates.ts`. Replace with the v2 `calculateDeadline` from `taskTimeline.ts`. The functions differ in normalization (`setHours(0,0,0,0)`); audit each callsite to confirm normalized dates are equivalent or improved.
- If the service references specific legacy template IDs, replace with v2 equivalents per the mapping in Task 2.2.

**Approach for event settings page:**
- Currently imports `getAllTemplates()`. Replace with `TASK_TIMELINE` and adapt the rendered list. Field name changes:
  - `template.name` → `entry.displayName` (or `entry.name` for the short form)
  - `template.timeline_offset` → `entry.offset`
  - `template.completion_type` → `entry.completion`
  - `template.r2_file` → no v2 equivalent; if the settings page renders a download link for the template's R2 file, keep that behaviour conditionally (only legacy templates had this).

**Verify:**
```bash
npm run type-check
npm run lint
```

Manual: load `/admin/events/[some-event-id]/settings` in dev — the template list should render with the 11 v2 entries.

**Commit:** `refactor: migrate clothingOrdersService and event settings off legacy templates`

---

### Task 2.5: Unify `TaskCompletionType` definitions

**Why:** Two unions exist: `tasks.ts:13` (`'monetary' | 'checkbox' | 'submit_only'`) and `taskTimeline.ts:23` (`'monetary' | 'orchestrated' | 'tracklist' | 'quantity_checkbox'`). The new union is the correct one going forward.

**Files:**
- Modify: `src/lib/types/tasks.ts`
- Modify: `src/lib/config/taskTimeline.ts` (consolidate types)
- Modify: every consumer of the legacy union — likely `TaskCompletionModal.tsx`, `TaskCard.tsx`, others. Use grep to find them.

**Plan:**
1. Make `taskTimeline.ts` the canonical source. Re-export `TaskCompletionType` from there.
2. In `tasks.ts`, replace the legacy union with `import type { TaskCompletionType } from '@/lib/config/taskTimeline'`.
3. Find all references to the legacy values:
   - `'checkbox'` — used by the `SHIPPING_TEMPLATE` and `TaskCompletionModal`. After Task 2.3 we know whether shipping-task creation stays. If it stays, `checkbox` becomes a fifth value. If it goes, all `'checkbox'` checks are dead.
   - `'submit_only'` — used by `poster_letter` legacy template only. Dead after legacy templates removed.
4. Update `TaskCompletionModal.tsx` (still used in legacy paths) to map from the new union to its UI sections, or mark it deprecated and stop importing it from active components.

**Verify:**
```bash
npm run type-check    # must be clean
grep -rn "completion_type:" src/                    # spot-check remaining usages
grep -rn "'checkbox'\|'submit_only'" src/           # must be empty (or only in deprecated files)
```

**Commit:** `refactor: unify TaskCompletionType under taskTimeline`

---

### Task 2.6: Fix `recalculateDeadlinesForEvent` to use the v2 calculator

**Why:** Currently uses the legacy `calculateDeadline` (no `setHours` normalization) — produces off-by-one deadlines around DST and timezone boundaries.

**Files:**
- Modify: `src/lib/services/taskService.ts:1336` (and surrounding function)
- Read: `src/lib/config/taskTimeline.ts:198-206` for the v2 calculator

**Change:**

Replace the legacy import with:
```typescript
import { calculateDeadline as calculateDeadlineV2, getTimelineEntry } from '@/lib/config/taskTimeline';
```

In the loop, look up the timeline entry by `template_id`:
```typescript
const entry = getTimelineEntry(task.template_id);
if (!entry) continue;  // legacy IDs (if any remain) skip recalculation
const newDeadline = calculateDeadlineV2(newEventDate, entry.offset);
```

**Test (write first):**

Create `tests/unit/services/recalculateDeadlines.test.ts`. Use Jest fake timers and a mock for `airtableService` to verify:
- Event date `2026-04-15` + offset `-45` → deadline `2026-03-01` (with `setHours(0,0,0,0)` normalization).
- Crossing DST boundary (Berlin DST spring-forward = 2026-03-29) — given offset `-9` and event date `2026-04-05`, the deadline is `2026-03-27` (clean date, no shift).

If mocking `airtableService` is heavy, factor a pure function `computeDeadline(eventDate: Date, offset: number): string` out of the service method and unit test that. Service method then becomes a thin wrapper that loops + calls the pure function + writes.

**Verify:**
```bash
npm run type-check
npm test -- tests/unit/services/recalculateDeadlines.test.ts
```

**Commit:** `fix: use v2 deadline calculator in recalculateDeadlinesForEvent`

---

### Task 2.7: Apply Task 2.3's decision to the shipping-task branch

**Why:** Now that callers are migrated and types are unified, finalize the v2 shipping-task semantics.

**Files:**
- Modify: `src/lib/services/taskService.ts` (the `completeTask` shipping branch, currently around lines 300-365)

**If Interpretation A (no separate shipping tasks in v2):**
- Delete the entire shipping-task creation block (`if (template?.creates_shipping) { ... }`).
- Delete `getTemplateById` call — no longer needed inside `completeTask`.
- Delete the legacy `SHIPPING_TEMPLATE` from `taskTemplates.ts`.

**If Interpretation B (shipping tasks belong in v2 too):**
- Add `creates_shipping?: boolean` to `TaskTimelineEntry`.
- Set `true` on `ship_poster`, `ship_flyer_1`, `ship_flyer_2`, `ship_flyer_3`, `order_schul_clothing`, `order_minicard`, `order_schul_clothing_2` (the supplier-order tasks).
- Keep the shipping-task creation block but read `entry.creates_shipping` instead of `template?.creates_shipping`.

**Verify:**
```bash
npm run type-check
npm test -- tests/unit/services/  # if there are existing tests
```

Manual smoke: complete a `Ship: Poster` task in dev and verify the expected outcome (no shipping task created if A; shipping task created if B).

**Commit:** `refactor: apply v2 shipping-task semantics`

---

### Task 2.8: Remove `taskTemplates.ts`

**Why:** After Tasks 2.4 and 2.7, the file should have no consumers.

**Files:**
- Delete: `src/lib/config/taskTemplates.ts`
- Modify: `src/lib/services/taskService.ts` (remove `generateTasksForEvent` legacy method)

**Steps:**
1. `grep -rn "from '@/lib/config/taskTemplates'" src/` → expect empty.
2. `grep -rn "PAPER_ORDER_TEMPLATES\|CLOTHING_ORDER_TEMPLATES\|STANDARD_CLOTHING_ORDER_TEMPLATES\|SHIPPING_TEMPLATE\|getTemplateById\|getAllTemplates\|getTemplatesByType\|calculateUrgencyScore" src/` → expect empty (or only in `taskTemplates.ts` itself, since we're deleting it).
3. Delete the file.
4. Remove the orphaned `generateTasksForEvent` method from `taskService.ts` (the v2 version is `generateTasksForEventV2`; the v1 was already orphaned per Phase 1 audit).

**Verify:**
```bash
npm run type-check    # must be clean
npm run lint
grep -rn "taskTemplates" src/   # no references
```

**Commit:** `chore: delete legacy taskTemplates and generateTasksForEvent`

---

### Task 2.9: Backport batch enrichment to `getTasks`

**Why:** `taskService.getTaskMatrix()` already does the right pattern (fetch all events + all tasks once, index in memory). `getTasks()` calls `enrichTaskWithEventDetails` per-task, causing N+1 for large lists.

**Files:**
- Modify: `src/lib/services/taskService.ts` (`getTasks`, `enrichTaskWithEventDetails`)

**Approach:**
1. Before the enrichment loop, collect the unique `event_id`s and `go_id`s from the fetched tasks.
2. Batch-fetch those records with one Airtable query each (`OR(RECORD_ID()='rec1', RECORD_ID()='rec2', ...)`). Note Airtable formula length cap (~16 KB); chunk into batches of ~50 IDs if needed.
3. Build two maps: `eventById`, `goById`.
4. Refactor `enrichTaskWithEventDetails` to accept the pre-fetched maps as optional parameters; if absent, fall back to per-record fetches (preserves existing single-task call sites).

**Test (write first):**

Add a unit test in `tests/unit/services/taskService.test.ts` that:
- Creates a mock `airtableService` recording call counts.
- Calls `getTasks` with 50 fake tasks across 5 events.
- Asserts the mock saw at most 3 Airtable round-trips (1 for tasks, 1 for events, 1 for GOs).

If `airtableService` is hard to mock, extract the enrichment-with-maps function as a pure helper and unit test it with fixture data.

**Verify:**
```bash
npm run type-check
npm test -- tests/unit/services/taskService.test.ts
```

**Commit:** `perf: batch event/GO lookups in taskService.getTasks`

---

## Phase 3 — Reliability + cleanup

Goal: pay down small but compounding debt. Each task is independent and can be a separate small commit.

### Task 3.1: Identify and delete confirmed orphan components

**Files:**
- Audit and potentially delete from `src/components/admin/tasks/`

**Steps:**
1. For each candidate file, run `grep -rn "from '@/components/admin/tasks/<filename>'" src/` and `grep -rn "import .* <ComponentName>" src/`. If both return empty, the file is orphaned.
2. **Candidates** (verify each — some may be re-imported by re-exports):
   - `TaskCard.tsx`, `TaskQueue.tsx` — pre-overhaul list view
   - `TaskTypeTabs.tsx`, `TaskTypeFilter.tsx`, `TaskTypeBadge.tsx` — used by legacy `TaskCompletionModal` only; if Phase 2 deprecates that modal, these go too
   - `DeadlineCountdown.tsx` — pre-overhaul widget
   - `MasterCdModal.tsx` — replaced by inline `MasterCdCompletion`
   - `ClothingOrder*.tsx` (5 files), `MinicardOrder*.tsx` (2 files), `StandardClothingBatch*.tsx` (4 files), `ClothingOrdersView.tsx`, `MinicardOrdersView.tsx`, `StandardClothingBatchView.tsx` — superseded by Welle UI
   - `PrintablesDownloadModal.tsx`, `InvoiceUploadButton.tsx` — unused
   - `IncomingOrderCard.tsx` — verify (likely internal to `IncomingOrdersView`, in which case keep)
   - `TaskMatrixCell.tsx`, `TaskDateGroup.tsx` — verify (likely internal renderers, keep)

3. Delete confirmed orphans. **One commit per logical group** (e.g. one for the legacy clothing-order family, one for the minicard family, etc.) — easier to revert if something turns out to be referenced through dynamic-import or string lookup.

**Verify after each deletion:**
```bash
npm run type-check
npm run lint
npm run build   # critical — Next.js may catch dynamic imports type-check missed
```

**Commit (per group):** `chore: remove orphaned <group> components`

---

### Task 3.2: Add Airtable retry/backoff wrapper

**Why:** Airtable rate limits at 5 req/sec/base. Bursts (cron runs, bulk wave override, refetch storms) hit the limit with no backoff.

**Files:**
- Modify: `src/lib/services/airtableService.ts` (or wherever the base airtable client lives)
- Create: `tests/unit/services/airtableRetry.test.ts`

**Approach:**

Add a small wrapper that retries on 429 (rate-limited) with exponential backoff:
```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  const { maxAttempts = 4, baseDelayMs = 200 } = opts;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as { statusCode?: number; status?: number })?.statusCode
        ?? (err as { status?: number })?.status;
      if (status !== 429 || attempt === maxAttempts) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100; // jitter
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}
```

Wrap the `.select()`, `.create()`, `.update()`, `.find()` calls in the airtable service.

**Test (write first):** Unit-test `withRetry` with a mock `fn` that throws 429 N times then succeeds. Use Jest fake timers to skip the actual delay.

**Verify:**
```bash
npm run type-check
npm test -- tests/unit/services/airtableRetry.test.ts
```

**Commit:** `feat: add retry/backoff wrapper for Airtable API calls`

---

### Task 3.3: AbortController hygiene in completion components

**Why:** `MasterCdCompletion`, `CdProductionCompletion`, `WelleCompletion`, `EventWelleBreakdown` all fetch on mount without cancellation. Component unmount mid-fetch leaks state updates.

**Files:**
- Modify: each of the four components

**Pattern (apply per component):**
```typescript
useEffect(() => {
  const controller = new AbortController();
  fetchData(controller.signal).catch((err) => {
    if (err.name !== 'AbortError') {
      // handle real error
    }
  });
  return () => controller.abort();
}, [/* deps */]);
```

Pass the `signal` through to the `fetch()` call.

**Verify:**
```bash
npm run type-check
npm run lint
```

Manual: in dev, open the per-event detail page, expand a task panel, immediately navigate away. Console should show no "state update on unmounted component" warnings.

**Commit (one per component):** `fix: cancel in-flight fetches on unmount in <component>`

---

### Task 3.4: Standardize API response shapes

**Files:**
- Create: `src/lib/api/response.ts` (helper)
- Sweep: route handlers under `src/app/api/admin/`

**Helper:**
```typescript
import { NextResponse } from 'next/server';

export function apiOk<T>(data: T, message?: string) {
  return NextResponse.json({ success: true, data, ...(message ? { message } : {}) });
}

export function apiError(error: string, status = 500) {
  return NextResponse.json({ success: false, error }, { status });
}
```

Sweep handlers and replace ad-hoc `NextResponse.json(...)` calls. Don't change error semantics — just shape.

**Verify:**
```bash
npm run type-check
npm run lint
```

**Commit:** `refactor: standardize admin API response shapes via apiOk/apiError`

---

### Task 3.5: Replace `.catch(() => ({}))` swallowing with proper error parsing

**Files:**
- `src/components/admin/tasks/IncomingOrdersView.tsx:47`
- `src/components/admin/tasks/TaskCompletionModal.tsx:99`
- `src/components/admin/tasks/WelleCompletion.tsx:86,125`
- `src/components/admin/tasks/ClothingOrderCompletionModal.tsx:89` (if still present after Phase 3.1 deletes)
- `src/app/admin/tasks/[eventId]/page.tsx:60`

**Helper to add:**
```typescript
// src/lib/api/parseResponse.ts
export async function parseJsonOrThrow(response: Response): Promise<unknown> {
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let parsedError: string | undefined;
    try {
      parsedError = JSON.parse(text)?.error;
    } catch {
      // not JSON — fall through
    }
    throw new Error(
      parsedError ?? `Request failed (${response.status}): ${text.slice(0, 200) || response.statusText}`,
    );
  }
  return response.json();
}
```

Replace each silent `.catch(() => ({}))` with `parseJsonOrThrow(res)` and let the error propagate to the existing error handling.

**Verify:**
```bash
npm run type-check
npm run lint
grep -rn "catch(() => ({}))" src/components/admin/tasks/   # expect empty
```

**Commit:** `refactor: replace silent JSON-parse swallowing with parseJsonOrThrow`

---

### Task 3.6: Add a Next.js `middleware.ts` matcher for `/api/admin/*`

**Why:** Belt-and-braces. Today every admin route calls `requireAdmin()`. A future route added without the wrapper would be unauthenticated. Middleware enforces auth at the edge.

**Files:**
- Create or modify: `middleware.ts` at project root

**Approach:**
- Read `src/lib/auth/verifyAdminSession.ts` to understand the existing JWT flow.
- Middleware verifies the JWT cookie before the request reaches the route handler.
- Matcher: `['/api/admin/:path*', '/admin/:path*']` (admin pages already redirect on auth failure; this just adds API protection).
- Excludes: login endpoint, public webhooks. Use a regex matcher or explicit exclusions.

**Verify:**
```bash
npm run type-check
npm run build
```

Manual: in an incognito window, `curl http://localhost:3000/api/admin/tasks` → expect 401 even without per-route `requireAdmin`.

**Commit:** `feat: add middleware-level auth for /api/admin/*`

---

## Done criteria

After all phases:
- [ ] Production `npm run type-check` passes (test errors pre-existed and are out of scope).
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `grep -rn "from '@/lib/config/taskTemplates'" src/` returns empty.
- [ ] `grep -rn "window.location.reload" src/components/admin/tasks/` returns empty (it's currently used in 1 place that Phase 1 removes; the error-state reload in `[eventId]/page.tsx:107` is acceptable as a manual user retry).
- [ ] All four completion modes have a working inline panel reachable from the per-event detail page.
- [ ] `taskService.completeTask` no longer references `taskTemplates.ts`.
- [ ] Airtable calls go through `withRetry`.
- [ ] No silent `.catch(() => ({}))` in `src/components/admin/tasks/`.

## Out of scope (Tier 4 — separate design conversations)

- Real-time multi-admin sync.
- Pagination on matrix and by-date views.
- i18n abstraction.
- Horizontal-timeline visual rework on per-event detail.

---

## Execution checkpoints

After each phase, pause for review:

- **End of Phase 1**: smoke-test artifacts in `docs/plans/2026-04-27-task-system-april-improvements/phase-1-smoke-notes.md`. Decide whether to ship Phase 1 as a standalone PR before starting Phase 2.
- **End of Phase 2**: confirm Airtable audit results match expectations, no broken existing flows. Decide whether to ship Phase 2 as a separate PR.
- **End of Phase 3**: full type-check + build + lint clean. Final PR or merge as appropriate.
