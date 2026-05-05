# Registration Shortfall Trigger Emails (T-14, T-4, T+3)

**Date:** 2026-05-04

## Problem

Schools currently have a multi-week registration runway from booking to the final days before each event. When a teacher's outreach to parents has been weak, low registration counts only become visible to admins through manual checking. There is no automated awareness signal at the meaningful timing checkpoints where the teacher (and admins) still have time to act — flyer 2 going out, the final-week scramble, and the post-event reflection on what went wrong.

## Goal

Send the assigned teacher up to three escalating reminder emails over the registration lifecycle of an event, each gated on the current `registeredChildren / estimatedChildren` ratio at a specific date offset. The three triggers are independent — a single school can receive all three emails if registration stays weak through the entire window. Templates ship `active=false` so admins finalize copy before they go live.

The three triggers:

- **T-14 days before event** — gentle reminder ("flyer 2 ist unterwegs"); fires when the ratio is below 33%. Most schools that ever fall below threshold will pass through this checkpoint.
- **T-4 days before event** — urgent alarm ("letzte Tage"); fires when the ratio is below 33%. Independent check from T-14: the cron just reads the current ratio at T-4, regardless of whether T-14 fired.
- **T+3 days after event** — post-event reflection; fires when the ratio is below 50%. Counts include any post-event opt-ins (the registration flow has no event-date cutoff — verified via code search across `src/app/register/`, `src/components/registration/`, and `getRegistrationsByEventId`; zero event-date filters).

## Design

### Trigger configuration

| Key | Date offset (days) | Threshold | Tone |
|---|---|---|---|
| `t_minus_14` | +14 (event 14 days from now) | < 33% | Informational; reminder about Flyer 2 |
| `t_minus_4` | +4 (event 4 days from now) | < 33% | Urgent; alarm |
| `t_plus_3` | -3 (event was 3 days ago) | < 50% | Post-event reflection |

Each trigger is independent — a single school can receive all three emails over the event lifecycle if registration stays below the respective threshold at each checkpoint. The "still under 33%" expectation at T-4 is captured operationally by the independent check (the cron just reads the current ratio at T-4, regardless of whether T-14 fired).

### Data sources

| Field | Source |
|---|---|
| Numerator (registered children) | `airtable.getRegistrationsByEventId(eventRecordId)`, **filtered to `registered_complete === true`**. Each surviving row = 1 child via `registered_child`. Same lookup used by `getParentRecipientsForEvent` (`emailAutomationService.ts:378`). |
| Denominator (expected children) | `booking.estimatedChildren` via `event.simplybook_booking[0]` → `airtable.getSchoolBookingById(...)`. Same path as `checkStaffEventReminder` (`eventReadinessService.ts:944-951`). |

Why child-level (not parent-level): `estimatedChildren` is the comparison target. A parent of twins yields 2 Registration rows, which keeps the units consistent.

Why `registered_complete`: Registration rows are created the moment a parent enters the registration flow. Counting incomplete rows would mask the actual shortfall the email is meant to surface. The flag is set when the parent finishes the funnel (see `registered_complete` field on `Registration`, `airtable.ts:264, 6913`).

**Post-event opt-ins at T+3**: the registration flow has no event-date cutoff (verified via code search: `src/app/register/`, `src/components/registration/`, `getRegistrationsByEventId` — zero event-date filters). A parent who registers two days *after* the event still increments the numerator, so the T+3 evaluation reflects the true final ratio rather than a stale T-day snapshot.

### Cron evaluator

New helper `checkRegistrationShortfall(triggerKey, dryRun)` in `src/lib/services/eventReadinessService.ts`, wired into the **daily** block of `src/app/api/cron/event-readiness/route.ts` (alongside `checkStaffEventReminder`, not behind the Monday-only gate). The cron route makes three calls per pass — one per trigger key — each evaluating its own date offset and ratio threshold.

Steps (per `triggerKey` invocation):

1. Resolve the trigger's date offset and threshold from a small in-file table (`+14 / 0.33`, `+4 / 0.33`, `-3 / 0.50`).
2. Fetch all events; filter to those whose `event_date` (YYYY-MM-DD) === today + offset.
3. Apply event filters:
   - `status === 'Confirmed'`
   - has `simplybook_booking[0]`
   - has assigned teacher with email (resolved via `getTeacherRecipientsForEvent`, same path `checkClassesAndSongs:296` uses)
   - takes parent registrations: `is_minimusikertag === true || is_plus === true || is_kita === true`. (Schulsong-only events excluded — they have no parent-registration flow.) These are the canonical event-type filter flags (`airtable.ts:6102-6104`); we deliberately do **not** match on the `event_type` string.
4. Resolve booking → `estimatedChildren`. If null/0/undefined → skip silently (log + `result.skipped++`).
5. Resolve registrations: `(await getRegistrationsByEventId(eventRecordId)).filter(r => r.registered_complete).length`.
6. Evaluate `shouldFire(reg, exp, triggerKey)` boolean predicate: `reg / exp < threshold`. If false → skip (no email).
7. **Pre-check active flag**: `await getTriggerTemplate(slug)` → if `!template.active` → `result.skipped++` and continue. (Prevents the disabled-template false-positive in step 9 — see Production safety note below.)
8. **Defensive empty-content guard**: if `template.active === true` but `subject` or `bodyHtml` is empty/whitespace → log a warning and `result.skipped++`. (Catches the foot-gun where an admin flips active before pasting copy.)
9. Send via the existing trigger-email send helper used by other readiness crons.
10. Log activity `registration_shortfall_<triggerKey>` for the audit trail.

**Idempotency**: exact-date match on T-14 / T-4 / T+3 means each event passes through each trigger's branch exactly once over its lifetime — same model as `checkStaffEventReminder`. No `email_logs` safety net: the EMAIL_LOGS Airtable schema (`email-automation.ts:41-50`) has no `trigger_slug` field, so a per-slug lookup would require either schema changes or brittle name-matching. Forced re-runs (`?forceWeekly=true`, manual deploy retries) would re-fire — but that risk applies equally to `checkStaffEventReminder` today and is considered acceptable.

Note: a single event hitting all three triggers' thresholds at their respective dates **will** produce three separate emails over the lifecycle. This is intentional per admin feedback — the previous mutually-exclusive design was scrapped because it suppressed the urgent T-4 ping for schools that had already received the gentler T-14.

**Production safety — disabled-template handling**: `resendService.ts:126` returns `{ success: true, messageId: 'disabled' }` when a template is inactive. Without the explicit pre-check in step 7, the cron would (a) increment `result.sent` for every disabled template, polluting telemetry, and (b) emit an `email_sent` activity log entry (`resendService.ts:168-177`) for emails that never went out. Step 7 short-circuits before that path. Step 8 catches the related foot-gun where active is flipped on but copy is still empty.

### Catalog entries

Three new entries in `src/lib/config/trigger-event-catalog.ts`, one per trigger key:

```ts
{
  key: 'cron:registration_t_minus_14',
  name: 'CRON: Registrierungen unter 33% (T-14)',
  description:
    'Läuft täglich. 14 Tage vor dem Event: sanfte Erinnerung, '
    + 'wenn weniger als 33% der erwarteten Kinder registriert sind '
    + '(z. B. „Flyer 2 ist unterwegs").',
  availableVariables: [
    'teacherName', 'schoolName', 'eventDate',
    'registeredCount', 'expectedCount', 'percentRegistered',
    'teacherPortalUrl',
  ],
  recipientMode: 'specific',
},
{
  key: 'cron:registration_t_minus_4',
  name: 'CRON: Registrierungen unter 33% (T-4)',
  description:
    'Läuft täglich. 4 Tage vor dem Event: dringende Warnung, '
    + 'wenn weniger als 33% der erwarteten Kinder registriert sind.',
  availableVariables: [ /* same set */ ],
  recipientMode: 'specific',
},
{
  key: 'cron:registration_t_plus_3',
  name: 'CRON: Registrierungen unter 50% (T+3)',
  description:
    'Läuft täglich. 3 Tage nach dem Event: Reflexion, '
    + 'wenn weniger als 50% der erwarteten Kinder registriert haben '
    + '(inkl. Nachzügler-Registrierungen).',
  availableVariables: [ /* same set */ ],
  recipientMode: 'specific',
},
```

Each trigger has its own `triggerEventKey` because each is a separate logical evaluation at a separate date offset.

### Registry entries

Three new entries appended to `TRIGGER_EMAIL_REGISTRY` in `src/lib/config/trigger-email-registry.ts`. Each:

- `recipientType: 'teacher'`
- `triggerEventKey` matching its catalog entry
- `category`: `'registrations_pre'` for T-14 and T-4, `'registrations_post'` for T+3 (separates pre-event signals from post-event reflection in the admin UI)
- `defaultActive: false` (new optional field — see Default template state below)
- Same `availableVariables` as the catalog entry
- **Empty `subject` and `bodyHtml`** — admins fill before activation, gated by the empty-content guard in the cron evaluator

| Slug | Name | Category | Tone |
|---|---|---|---|
| `cron:registration_t_minus_14` | Registrierungen unter 33% — T-14 | `registrations_pre` | Informational; Flyer-2-Hinweis |
| `cron:registration_t_minus_4` | Registrierungen unter 33% — T-4 | `registrations_pre` | Urgent; letzte Tage |
| `cron:registration_t_plus_3` | Registrierungen unter 50% — T+3 | `registrations_post` | Reflexion |

### Default template state

All three rows must ship inactive **and** with empty content. The existing infrastructure assumes templates start active in **three** places, all of which need to honor a new `defaultActive` field:

1. **`TriggerEmailDefinition` interface** (`trigger-email-registry.ts:9-22`) — add `defaultActive?: boolean`. Default semantics: `undefined` → `true` (preserves existing behavior for all current entries).

2. **`seedMissingTriggerTemplates`** (`triggerTemplateService.ts:209-223`) — currently hardcodes `active: true` at line 219. Change to `active: entry.defaultActive ?? true`.

3. **`populateAllTriggerCaches`** (`triggerTemplateService.ts:80-87`) and **`getAllTriggerTemplates`** (`triggerTemplateService.ts:271`) — both fall back to `active: true` when no Airtable record exists yet (the pre-seed window). Both must use `entry.defaultActive ?? true`. Without this, the cron sees `active: true` for the 60-second cache window between deploy and first admin save, defeating the inactive-on-launch contract.

The three new entries set `defaultActive: false`. All other entries leave the field unset and behave exactly as today.

Subject and name remain editable while inactive — the existing `TriggerEmailEditor` does not gate edits on the active flag (the flag only controls firing). Admins will paste their finalized German copy into the empty subject/body before flipping active.

### Admin UI changes

`src/components/admin/emails/TriggerEmailsTab.tsx` currently groups templates strictly by `recipientType` via `RECIPIENT_GROUP_ORDER` at line 117-121:

```ts
const grouped = RECIPIENT_GROUP_ORDER.map((group) => ({
  ...group,
  templates: templates.filter((t) => t.recipientType === group.key),
})).filter((group) => group.templates.length > 0);
```

Changes:

- Add an optional `category?: string` field to `TriggerEmailDefinition`. Surface it on `TriggerEmailTemplate` in `email-automation.ts:90-105` and propagate through `triggerTemplateService.ts` mapping functions (`getAllTriggerTemplates`, `getTriggerTemplateBySlug`).
- In the tab, render category groups **first** (top of the list), then the existing recipient-type groups below. Two registration sections appear: "Registrierungen — Vor" (T-14, T-4) and "Registrierungen — Nach" (T+3).
- **Critical**: change the recipient-group filter to `t.recipientType === group.key && !t.category`. Without this exclusion, a template with `category: 'registrations_pre'` and `recipientType: 'teacher'` would render in **both** the Registrierungen section and the Lehrer-E-Mails section.
- Section heading styling matches existing uppercase `text-sm font-semibold text-gray-700 uppercase tracking-wider`.
- Only the three new entries set a `category` — every existing entry stays exactly where it is today, no migration.

### Variable substitution

Variables passed to the template (same set across all three triggers):

- `teacherName` — first name of assigned teacher
- `schoolName` — booking school name
- `eventDate` — formatted German date (DD.MM.YYYY)
- `registeredCount` — integer
- `expectedCount` — integer (`estimatedChildren`)
- `percentRegistered` — integer percentage (rounded down, e.g. `"32"`)
- `teacherPortalUrl` — `${baseUrl}/paedagogen/events/{eventId}`

(No `daysUntilEvent` variable — admins encode the timing in the per-template subject/body since each trigger has a fixed offset.)

## Edge cases

| Case | Behavior |
|---|---|
| Event date isn't exactly T-14, T-4, or T+3 | not evaluated this pass for that trigger |
| `estimatedChildren` missing or 0 | skip silently, log only, `result.skipped++` |
| `event.status !== 'Confirmed'` | skip |
| No assigned teacher on booking, or teacher has no email | skip with warning log, `result.skipped++` |
| All three event flags false (e.g. schulsong-only event) | skip — not registration-eligible |
| Registration rows exist but none have `registered_complete === true` | numerator = 0 → fires at every threshold below 100% if `expectedCount > 0` |
| Registration count meets or exceeds the trigger's threshold | no email |
| Template has `active === false` | `result.skipped++`, no email, no activity log entry |
| Template has `active === true` but `subject` or `bodyHtml` is empty | `result.skipped++` with warning log (defensive guard) |
| Same event hits multiple triggers' thresholds at their respective dates | all matching triggers fire — intentional, cumulative |
| Forced re-run on same day (`?forceWeekly=true` etc.) | will re-fire — accepted risk, parity with `checkStaffEventReminder` |

## Testing

Two test files cover ~32 tests total:

1. **`registrationShortfall.test.ts`** (~13 tests) — shape and `shouldFire(reg, exp, triggerKey)` boundaries: ratio rounding, the inclusive/exclusive edge of each threshold (e.g. exactly 33% does **not** fire under-33% triggers), zero-numerator handling, missing-denominator handling.

2. **`eventReadinessService.test.ts`** (~19 tests, ~5-7 per trigger) — full-flow coverage per trigger key: ratio gate, date math (today + offset matches), schulsong-only skip, inactive-template skip, empty-content defensive guard, `registered_complete` filter, dryRun behavior, and edge cases (no teacher, missing estimatedChildren).

Manual smoke (post-deploy):

- **Synthetic matrix** — temporarily date-shift Confirmed events to today+14d, today+4d, today-3d with registration counts crafted to straddle each threshold; run cron with `?dryRun=true`; verify the right slugs are selected.
- **End-to-end** — pick one event, run cron without dry-run, confirm the email lands in the teacher inbox with correct variable substitution.

## Rollout

1. Land code: cron evaluator + 3 registry entries + 3 catalog entries + UI grouping field + `defaultActive` plumbing + empty-content guard.
2. On deploy the three new entries appear immediately in `/admin/emails` (rendered from the registry merge in `getAllTriggerTemplates`, with `active = defaultActive ?? true` → `false`). Two land under "Registrierungen — Vor" and one under "Registrierungen — Nach". No Airtable row exists yet — seeding is lazy: `seedMissingTriggerTemplates` is invoked only when an admin first saves an edit (`triggerTemplateService.ts:384`). The lazy-seed step writes `active: entry.defaultActive ?? true` → `false` for the three new entries, preserving the inactive contract.
3. Until any admin saves, the cron's pre-check (`getTriggerTemplate(slug).active`) reads `false` from the registry-default fallback path (`populateAllTriggerCaches`/`getAllTriggerTemplates`), so no email fires even on the day after deploy.
4. Admins paste subject/body copy in `/admin/emails`, then flip `active = true` per template when ready. The empty-content guard means a flip-without-paste still skips with a warning rather than sending blanks.
5. Next daily cron pass picks up matching events with the active templates — the cron starts evaluating all three triggers immediately, but emails only fire after admin fills + activates each one.

## Production-safety verification (resolved during audit)

The following items were investigated against the codebase before locking in the design. Each links to the relevant file:line.

| Concern | Resolution |
|---|---|
| Seeding hardcodes `active: true` (`triggerTemplateService.ts:219`) | Add `defaultActive` field; three call sites updated (see Default template state) |
| Pre-seed window leaks `active: true` (`triggerTemplateService.ts:80-87, 271`) | Same `defaultActive` fallback applied in both fallback paths |
| Wrong event-type values in initial design (`SCS` / `SCS_PLUS` don't exist) | Filter on boolean flags `is_minimusikertag || is_plus || is_kita`, confirmed all three have parent-registration flow |
| UI category double-render | Recipient-group filter excludes entries with `category` set |
| `email_logs` has no `trigger_slug` field (`email-automation.ts:41-50`) | Drop the safety-net lookup; rely on date-exact-match idempotency per trigger, parity with `checkStaffEventReminder` |
| `Registration` rows include incomplete entries | Filter numerator to `registered_complete === true` |
| Disabled templates report `success: true` (`resendService.ts:126`) | Pre-check `getTriggerTemplate(slug).active` before send; bail with `result.skipped++` |
| Active-but-empty templates would send blank emails | Defensive guard in cron evaluator: skip with warning if `active === true` but `subject` or `bodyHtml` is empty (new in this rework) |
| Cumulative emails per event | **Intentional** — admin feedback explicitly required that a school can receive all three triggers over the lifecycle if registration stays weak. The previous mutually-exclusive tier design was scrapped for suppressing the urgent T-4 signal. |

## Known minor risks (accepted, not blockers)

- **Performance**: the daily cron now runs `getAllEvents()` six times (one per `checkX` helper, including three for the registration triggers). Each call is a full Airtable scan. Refactoring to one shared fetch is out of scope here.
- **Per-event registration scan**: `getRegistrationsByEventId` (`airtableService.ts:6896-6903`) full-scans the Registrations table per event matched. Acceptable at current scale.
- **UTC vs Berlin date drift**: `now.getDate() + offset` runs in server-local time (UTC on Vercel). For events at midnight Berlin, the date string match could be off by one day for any of the three triggers. Same risk profile as the existing `checkStaffEventReminder` — not new.

## Open questions for implementation (small)

- Does the Persons table have a teacher-side `email_campaigns` opt-out flag analogous to parents'? `airtable.ts:911` shows the field exists on parents (`'yes' | 'no'`); verify whether the teacher persons-record has the same field. Honor it if present, otherwise no change. (Resolved during initial implementation — carried forward.)
- Confirm activity-type union in `airtable.ts:1117` accepts the new `registration_shortfall_*` values — or whether the union needs an additional entry. (Resolved during initial implementation — carried forward.)
