# Tasks View Architecture

The Tasks View (`/admin/tasks`) tracks the 11-step operational timeline that runs
for each confirmed event. The timeline itself is hardcoded; per-event task
records live in Airtable so completion state and audit trail persist.

## Canonical sources

- **Timeline config (single source of truth):** `src/lib/config/taskTimeline.ts`
  — defines all 11 tasks, their offsets relative to event date, completion
  types (`monetary` / `orchestrated` / `tracklist` / `quantity_checkbox`),
  and R2 paths for printable assets.
- **Service:** `src/lib/services/taskService.ts` — task CRUD, matrix
  generation, GO-ID lifecycle, deadline recalculation.
- **Types:** `src/lib/types/tasks.ts` (`TaskCompletionType` is re-exported from
  the timeline config).
- **Airtable field IDs:** `src/lib/types/airtable.ts` — `TASKS_FIELD_IDS` and
  `GUESSTIMATE_ORDERS_FIELD_IDS`.
- **UI:** `src/components/admin/tasks/` — matrix grid (`TaskMatrix`,
  `TaskMatrixCell`, `TaskMatrixPopover`), per-event timeline
  (`EventDetailTimeline`), and the four completion-type forms
  (`MonetaryCompletion`, `WelleCompletion`, `MasterCdCompletion`,
  `CdProductionCompletion`).

The completion form is dispatched by `completion_type` from
`EventDetailTimeline` and `TaskMatrixPopover`; each form posts to the matching
endpoint under `/api/admin/tasks/`.

## Design history (read-only)

The current shape is the v2 model. Decisions that produced it are captured in
the dated plan docs — read these for context, not as implementation
references:

- `docs/plans/2026-01-22-clothing-order-tasks-design.md`
- `docs/plans/2026-01-22-clothing-order-tasks-implementation.md`
- `docs/plans/2026-02-15-task-system-audit.md`
- `docs/plans/2026-03-09-task-system-overhaul-design.md`
- `docs/plans/2026-03-09-task-system-overhaul-implementation.md`
- `docs/plans/2026-04-27-task-system-april-improvements.md`

When the timeline, completion model, or UI changes, update
`taskTimeline.ts` first — this doc only points at the canonical sources, so
it should rarely need edits.
