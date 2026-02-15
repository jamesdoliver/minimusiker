# Task System Audit — Findings & Improvement Plan

**Date:** 2026-02-15
**Status:** In Progress — Phase 3 (Phases 1 & 2 complete)

---

## Scope

Full audit of the admin task management system: services, API routes, UI components, cron jobs, and configuration. Covers security, reliability, data integrity, UX, and accessibility.

---

## Critical (Data Corruption / Security Risk)

### 1. Double-completion creates duplicate GO-IDs and shipping tasks
**Location:** `src/lib/services/taskService.ts` — `completeTask()`
**Issue:** No status guard. If a task is already completed, calling `completeTask` again creates a second GuesstimateOrder and a second shipping task. Network retries, slow UIs, or double-clicks can trigger this.
**Fix:** Check `task.status === 'completed'` at the start of `completeTask()` and reject with an error.

### 2. No authentication on 11 of 12 API routes
**Location:** All files in `src/app/api/admin/tasks/` except `[taskId]/invoice/route.ts`
**Issue:** `verifyAdminSession()` exists but is only called in the invoice route. The middleware matcher is `[]` (runs on zero routes). Every task endpoint is open to anonymous access.
**Fix:** Create a shared `withAdminAuth()` wrapper and apply it to every exported handler.

### 3. Hardcoded admin email breaks audit trail
**Location:** `src/app/api/admin/tasks/[taskId]/route.ts` (line 66), `clothing-orders/[eventId]/complete/route.ts` (line 44), `standard-clothing-batches/[batchTaskId]/complete/route.ts` (line 47)
**Issue:** `const adminEmail = 'admin@minimusiker.de'` with `// TODO` comments. All mutations are attributed to a single static address.
**Fix:** Use `getAdminEmailFromRequest(request)` from the existing auth utility (follows naturally from fix #2).

### 4. JWT secret fallback to hardcoded string
**Location:** `src/lib/auth/verifyAdminSession.ts` (line 4)
**Issue:** `process.env.JWT_SECRET || 'admin-secret-key'` — if the env var is unset, anyone can forge admin tokens.
**Fix:** Remove the fallback; throw at startup if `JWT_SECRET` is not set.

---

## High (Functional Bugs)

### 5. Race condition in standard clothing batch cron
**Location:** `src/app/api/cron/standard-clothing-batch/route.ts`, `src/lib/services/standardClothingBatchService.ts`
**Issue:** No idempotency check. Duplicate cron invocations (network retry, cold start) can create two batch tasks for the same week. The `getAlreadyBatchedOrderIds()` deduplication runs before insert, so both see zero existing batches.
**Fix:** Check for existing batch with the same batch ID before creating. Use the batch ID (`STD-2026-W06`) as an idempotency key.

### 6. ISO week year mismatch in batch IDs
**Location:** `src/lib/services/standardClothingBatchService.ts` — `generateBatchId()`
**Issue:** Uses `new Date().getFullYear()` (calendar year) instead of ISO week year. Around year boundaries, ISO week 1 can belong to the adjacent year, producing wrong batch IDs like `STD-2024-W01` when it should be `STD-2025-W01`.
**Fix:** Calculate the ISO week year properly (the Thursday of the week determines the year).

### 7. `recalculateDeadlinesForEvent` likely returns zero matches
**Location:** `src/lib/services/taskService.ts` — `recalculateDeadlinesForEvent()`
**Issue:** Uses `=` comparison on a linked record field in the Airtable formula. Linked record fields store arrays internally; `=` comparison likely fails. Needs `FIND()` or `SEARCH()`.
**Fix:** Test and fix the formula. Verify that changing an event date actually updates task deadlines.

### 8. Airtable formula injection via search
**Location:** `src/lib/services/taskService.ts` — `getTasks()`
**Issue:** Search input is interpolated directly into `filterByFormula`. Single quotes break the formula string.
**Fix:** Escape single quotes in user input before interpolating into formulas.

### 9. `TaskCompletionModal` form state persists across re-opens
**Location:** `src/components/admin/tasks/TaskCompletionModal.tsx`
**Issue:** Unlike `ClothingOrderCompletionModal` (which resets on open), this modal keeps stale values from the previous task. Amount, notes, invoice file, and error state all carry over.
**Fix:** Add a `useEffect` that resets form state when `isOpen` changes to `true` or when `task` changes.

### 10. Invoice upload is a TODO stub
**Location:** `src/components/admin/tasks/TaskCompletionModal.tsx` (line 54)
**Issue:** `// TODO: Handle invoice upload to R2 and store URL`. The file picker works but the file is never uploaded. A placeholder string is stored instead.
**Fix:** Implement the upload using the existing invoice API endpoint, or remove the file picker to avoid confusion.

---

## Medium (Gaps & Missing Features)

### 11. Zero/negative amounts accepted in monetary fields
**Location:** `TaskCompletionModal.tsx`, `ClothingOrderCompletionModal.tsx`
**Issue:** Only checks `!amount` (empty string). `"0"`, `"-5.00"`, and `"abc"` all pass validation.
**Fix:** Validate `parseFloat(amount) > 0` and `!isNaN(parseFloat(amount))` before enabling submit.

### 12. No `response.ok` check before `response.json()` in UI
**Location:** `ClothingOrdersView.tsx`, `ClothingOrderCompletionModal.tsx`, `StandardClothingBatchView.tsx`, `IncomingOrdersView.tsx`
**Issue:** If the server returns a 502 with HTML, `response.json()` throws a confusing parse error.
**Fix:** Check `response.ok` before parsing; show a meaningful error message on failure.

### 13. CD Master and CD Production templates are stubs
**Location:** `src/lib/config/taskTemplates.ts`
**Issue:** Task types exist in the type system but have no actual templates. Events won't get CD tasks auto-generated.
**Fix:** Define templates with appropriate timeline offsets, or remove the types if not needed yet.

### 14. Minicard orders have no completion flow
**Location:** `src/lib/services/minicardOrdersService.ts`
**Issue:** Can fetch pending minicard orders but has no `completeMinicardOrder()` method or individual order detail view.
**Fix:** Implement completion flow matching the clothing orders pattern, or clarify if minicards use a different workflow.

### 15. No pagination on completed tasks
**Location:** `src/components/admin/tasks/CompletedTasksView.tsx`
**Issue:** All completed tasks render in a single `<table>`. Will cause slow renders as history grows.
**Fix:** Add server-side pagination or "load more" with a reasonable page size (e.g., 50).

### 16. Fetch-all-then-filter pattern
**Location:** `guesstimate-orders/[goId]/route.ts` GET, `standard-clothing-batches/[batchTaskId]/complete/route.ts` POST
**Issue:** Fetches ALL records from Airtable and filters in memory to find a single item.
**Fix:** Add direct-lookup-by-ID methods to the service layer.

### 17. Backdrop click / Cancel button closes modal during submission
**Location:** `TaskCompletionModal.tsx`
**Issue:** Backdrop `onClick={onClose}` and Cancel button have no `isSubmitting` guard. Closing during an in-flight API call can cause React state-update-on-unmounted-component errors.
**Fix:** Disable close/cancel while `isSubmitting` is true.

### 18. No Escape key handler in `TaskCompletionModal`
**Location:** `TaskCompletionModal.tsx`
**Issue:** `ClothingOrderCompletionModal` implements Escape-to-close; the generic modal does not.
**Fix:** Add a `useEffect` with a `keydown` listener for Escape.

---

## Low (UX Polish)

### 19. Full-page spinner on refresh
**Location:** `src/app/admin/tasks/page.tsx`
**Issue:** The "Refresh" button sets `isLoading(true)`, replacing the entire page with a spinner. User loses scroll position and visual context.
**Fix:** Use an inline refresh indicator (e.g., a subtle spinner in the header) and keep existing content visible.

### 20. Currency formatting inconsistency
**Location:** `CompletedTasksView.tsx`
**Issue:** Uses `€${amount.toFixed(2)}` (English format: `€123.45`) while every other component uses `Intl.NumberFormat('de-DE', ...)` (German format: `123,45 EUR`).
**Fix:** Use the same `Intl.NumberFormat` pattern everywhere.

### 21. No sortable columns in completed tasks table
**Location:** `CompletedTasksView.tsx`
**Issue:** Column headers are not clickable. For an audit view, sorting by date, amount, or type is important.
**Fix:** Add client-side sort toggling on column headers.

### 22. Event ID always truncated with ellipsis
**Location:** `TaskCard.tsx` (line 157)
**Issue:** `event_id.substring(0, 30) + '...'` appends `...` unconditionally, even for short IDs.
**Fix:** Only append ellipsis if `event_id.length > 30`.

### 23. No count badges on "Incoming Orders" / "Completed" view buttons
**Location:** `src/app/admin/tasks/page.tsx`
**Issue:** "Pending Tasks" shows a count badge; the other two view mode buttons show no counts.
**Fix:** Add count badges to all three view mode buttons.

### 24. No confirmation before "Mark Stock Arrived"
**Location:** `IncomingOrdersView.tsx`, `IncomingOrderCard.tsx`
**Issue:** The button fires the API call immediately. This action is irreversible and enables shipping tasks system-wide.
**Fix:** Add a confirmation dialog.

### 25. Completed tasks search race condition
**Location:** `src/app/admin/tasks/page.tsx`
**Issue:** No abort controller on search requests. Fast typing can cause an older response to overwrite a newer one.
**Fix:** Use `AbortController` or a request ID to discard stale responses.

### 26. Completed tasks error silently swallowed
**Location:** `src/app/admin/tasks/page.tsx` — `fetchCompletedTasks()`
**Issue:** Catches errors and logs to console but never calls `setError()`. User sees no error message.
**Fix:** Set error state on failure.

### 27. Three action buttons overflow on mobile
**Location:** `ClothingOrderCard.tsx`
**Issue:** Three `flex-1` buttons side-by-side. On narrow screens, text wraps or buttons become unreadably narrow.
**Fix:** Add `flex-wrap` or stack vertically on small screens.

### 28. Hardcoded `max-h-[500px]` clips content
**Location:** `ClothingOrderCard.tsx` (line 123)
**Issue:** Expanded section uses a fixed max height for CSS transition. Content exceeding this is clipped with no scroll.
**Fix:** Add `overflow-y-auto` or dynamically calculate the height.

---

## Accessibility

### 29. Modals lack dialog semantics
**Location:** `TaskCompletionModal.tsx`, `ClothingOrderCompletionModal.tsx`
**Issue:** No `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, or focus trap.

### 30. View mode buttons lack tab semantics
**Location:** `src/app/admin/tasks/page.tsx`
**Issue:** View mode buttons lack `role="tablist"` / `role="tab"` / `aria-selected`.

### 31. Completed tasks table rows are clickable but not keyboard-accessible
**Location:** `CompletedTasksView.tsx`
**Issue:** Rows use `onClick` and `cursor-pointer` but have no `role="button"`, `tabindex="0"`, or keyboard event handlers.

### 32. Missing aria-labels throughout
**Location:** Multiple components
**Issue:** Refresh button, download buttons, close buttons, emoji icons all lack `aria-label` or `aria-hidden`.

---

## Architecture Observations (Not Bugs)

- **No Airtable rate limiting or retry logic** — all API calls are fire-and-forget. A burst of admin activity could hit Airtable's rate limit (5 req/sec) with no backoff.
- **N+1 query pattern** in task enrichment — each task triggers individual event lookups. Could be batched.
- **Clothing variant mapping is hardcoded** — adding new sizes/types requires code changes and redeployment.
- **No real-time updates** — if two admins are working simultaneously, they see stale data until manual refresh.

---

## Implementation Phases

### Phase 1: Quick Wins (< 30 min each, ~45 min total)
Low-risk, high-value fixes:

- [x] **#9** Form state persists across modal re-opens (5 min)
- [x] **#11** Zero/negative amounts accepted (5 min)
- [x] **#12** No `response.ok` check before `.json()` in 4 components (10 min)
- [x] **#17** Backdrop/Cancel closes modal during submit (5 min)
- [x] **#18** No Escape key in `TaskCompletionModal` (5 min)
- [x] **#22** Event ID always shows ellipsis (2 min)
- [x] **#20** Currency formatting inconsistency (5 min)
- [x] **#26** Completed tasks errors silently swallowed (3 min)
- [x] **#8** Airtable formula injection via search (5 min)
- [x] **#4** JWT secret fallback (2 min)

### Phase 2: Auth & Audit Trail (~90 min)
Critical security work:

- [x] **#2** Add auth to all 11 unprotected routes (60 min)
- [x] **#3** Replace hardcoded admin email (15 min)
- [x] **#1** Double-completion guard (15 min)

### Phase 3: Data Integrity (~2 hours)
Prevent silent data issues:

- [ ] **#5** Batch cron idempotency (30 min)
- [ ] **#6** ISO week year mismatch (15 min)
- [ ] **#7** `recalculateDeadlinesForEvent` formula (30 min)
- [ ] **#16** Fetch-all-then-filter pattern (30 min)

### Phase 4: UX Polish (~2.5 hours)
Better admin experience:

- [ ] **#19** Inline refresh instead of full-page spinner (30 min)
- [ ] **#23** Count badges on all view buttons (20 min)
- [ ] **#24** Confirmation on "Mark Stock Arrived" (15 min)
- [ ] **#25** Search race condition (15 min)
- [ ] **#21** Sortable columns in completed tasks (45 min)
- [ ] **#27** Mobile button overflow (10 min)
- [ ] **#28** Clipped expanded content (5 min)

### Phase 5: Bigger Efforts (half-day each)
Need design thought:

- [ ] **#10** Invoice upload implementation (2-3 hrs)
- [ ] **#15** Completed tasks pagination (2-3 hrs)
- [ ] **#14** Minicard completion flow (3-4 hrs)
- [ ] **#13** CD Master/Production templates (1-2 hrs, needs business requirements)

### Phase 6: Accessibility (ongoing)
Best done incrementally as you touch each component:

- [ ] **#29** Dialog semantics on modals
- [ ] **#30** Tab semantics on view buttons
- [ ] **#31** Keyboard-accessible table rows
- [ ] **#32** Missing aria-labels throughout
