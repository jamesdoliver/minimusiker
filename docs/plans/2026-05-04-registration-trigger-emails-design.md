# Registration Shortfall Trigger Emails (T-7)

**Date:** 2026-05-04

## Problem

Schools currently have a 49-day registration runway (T-56 → T-7). When a teacher's outreach to parents has been weak, low registration counts only become visible to admins through manual checking. There is no automated awareness signal at the point where the teacher still has time to act (flyers in backpacks, parent-WhatsApp blast).

## Goal

Seven days before each event, evaluate `registeredChildren / estimatedChildren`. When the ratio is below 50%, send the assigned teacher exactly one of two escalating reminder emails — selected by which severity bucket the ratio falls into. Templates ship `active=false` so admins finalize copy before they go live.

## Design

### Tier model — escalating, mutually exclusive

| Ratio band | Tier | Registry slug |
|---|---|---|
| ≥ 50% | none — no email | — |
| 33.0% – 49.9% | Low | `cron:registration_low_t7` |
| < 33.0% | Critical | `cron:registration_critical_t7` |

Exactly one email fires per event. `registeredCount === 0` with `estimatedChildren > 0` falls into the Critical bucket.

### Data sources

| Field | Source |
|---|---|
| Numerator (registered children) | `airtable.getRegistrationsByEventId(eventRecordId)`, **filtered to `registered_complete === true`**. Each surviving row = 1 child via `registered_child`. Same lookup used by `getParentRecipientsForEvent` (`emailAutomationService.ts:378`). |
| Denominator (expected children) | `booking.estimatedChildren` via `event.simplybook_booking[0]` → `airtable.getSchoolBookingById(...)`. Same path as `checkStaffEventReminder` (`eventReadinessService.ts:944-951`). |

Why child-level (not parent-level): `estimatedChildren` is the comparison target. A parent of twins yields 2 Registration rows, which keeps the units consistent.

Why `registered_complete`: Registration rows are created the moment a parent enters the registration flow. Counting incomplete rows would mask the actual shortfall the email is meant to surface. The flag is set when the parent finishes the funnel (see `registered_complete` field on `Registration`, `airtable.ts:264, 6913`).

### Cron evaluator

New helper `checkRegistrationShortfall(dryRun)` in `src/lib/services/eventReadinessService.ts`, wired into the **daily** block of `src/app/api/cron/event-readiness/route.ts` (alongside `checkStaffEventReminder`, not behind the Monday-only gate).

Steps:

1. Fetch all events; filter to those whose `event_date` (YYYY-MM-DD) === today + 7 days.
2. Apply event filters:
   - `status === 'Confirmed'`
   - has `simplybook_booking[0]`
   - has assigned teacher with email (resolved via `getTeacherRecipientsForEvent`, same path `checkClassesAndSongs:296` uses)
   - takes parent registrations: `is_minimusikertag === true || is_plus === true || is_kita === true`. (Schulsong-only events excluded — they have no parent-registration flow.) These are the canonical event-type filter flags (`airtable.ts:6102-6104`); we deliberately do **not** match on the `event_type` string.
3. Resolve booking → `estimatedChildren`. If null/0/undefined → skip silently (log + `result.skipped++`).
4. Resolve registrations: `(await getRegistrationsByEventId(eventRecordId)).filter(r => r.registered_complete).length`.
5. Compute `ratio = registeredCount / estimatedChildren`.
6. Pick tier slug from the table above. If `ratio >= 0.50` → skip (no email).
7. **Pre-check active flag**: `await getTriggerTemplate(slug)` → if `!template.active` → `result.skipped++` and continue. (Prevents the disabled-template false-positive in step 8 — see Production safety note below.)
8. Send via the existing trigger-email send helper used by other readiness crons.
9. Log activity `registration_shortfall_t7` with the chosen tier in the description for the audit trail.

**Idempotency**: exact-date match on T-7 means each event passes through this branch exactly once over its lifetime — same model as `checkStaffEventReminder`. No `email_logs` safety net: the EMAIL_LOGS Airtable schema (`email-automation.ts:41-50`) has no `trigger_slug` field, so a per-slug lookup would require either schema changes or brittle name-matching. Forced re-runs (`?forceWeekly=true`, manual deploy retries) would re-fire — but that risk applies equally to `checkStaffEventReminder` today and is considered acceptable.

**Production safety — disabled-template handling**: `resendService.ts:126` returns `{ success: true, messageId: 'disabled' }` when a template is inactive. Without the explicit pre-check in step 7, the cron would (a) increment `result.sent` for every disabled template, polluting telemetry, and (b) emit an `email_sent` activity log entry (`resendService.ts:168-177`) for emails that never went out. Step 7 short-circuits before that path.

### Catalog entry

One new entry in `src/lib/config/trigger-event-catalog.ts`:

```ts
{
  key: 'cron:registration_shortfall_t7',
  name: 'CRON: Registrierungen unter Schwelle (T-7)',
  description:
    'Läuft täglich um 7 Uhr. Sendet eine Erinnerung an die Lehrkraft, '
    + 'wenn 7 Tage vor dem Event weniger als 50% der erwarteten Kinder '
    + 'registriert sind. Zwei Schwere-Stufen: <50%, <33%.',
  availableVariables: [
    'teacherName', 'schoolName', 'eventDate',
    'registeredCount', 'expectedCount', 'percentRegistered',
    'daysUntilEvent', 'teacherPortalUrl',
  ],
  recipientMode: 'specific',
}
```

Both template branches share this single `triggerEventKey` since they are two outcomes of one logical evaluation.

### Registry entries

Two new entries appended to `TRIGGER_EMAIL_REGISTRY` in `src/lib/config/trigger-email-registry.ts`. Each:

- `recipientType: 'teacher'`
- `triggerEventKey: 'cron:registration_shortfall_t7'`
- `category: 'registrations'` (new optional field — see UI section)
- `defaultActive: false` (new optional field — see Default template state below)
- Same `availableVariables` as the catalog entry
- Minimal placeholder German subject + body (admins will rewrite)

| Slug | Name | Tone |
|---|---|---|
| `cron:registration_low_t7` | Registrierungen niedrig (33–50%) — T-7 | Direct, action-oriented |
| `cron:registration_critical_t7` | Registrierungen kritisch niedrig (<33%) — T-7 | Urgent, "letzte Chance" |

### Default template state

All three rows must ship inactive. The existing infrastructure assumes templates start active in **three** places, all of which need to honor a new `defaultActive` field:

1. **`TriggerEmailDefinition` interface** (`trigger-email-registry.ts:9-22`) — add `defaultActive?: boolean`. Default semantics: `undefined` → `true` (preserves existing behavior for all current entries).

2. **`seedMissingTriggerTemplates`** (`triggerTemplateService.ts:209-223`) — currently hardcodes `active: true` at line 219. Change to `active: entry.defaultActive ?? true`.

3. **`populateAllTriggerCaches`** (`triggerTemplateService.ts:80-87`) and **`getAllTriggerTemplates`** (`triggerTemplateService.ts:271`) — both fall back to `active: true` when no Airtable record exists yet (the pre-seed window). Both must use `entry.defaultActive ?? true`. Without this, the cron sees `active: true` for the 60-second cache window between deploy and first admin save, defeating the inactive-on-launch contract.

The three new entries set `defaultActive: false`. All other entries leave the field unset and behave exactly as today.

Subject and name remain editable while inactive — the existing `TriggerEmailEditor` does not gate edits on the active flag (the flag only controls firing).

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
- In the tab, render category groups **first** (top of the list), then the existing recipient-type groups below.
- **Critical**: change the recipient-group filter to `t.recipientType === group.key && !t.category`. Without this exclusion, a template with `category: 'registrations'` and `recipientType: 'teacher'` would render in **both** the Registrierungen section and the Lehrer-E-Mails section.
- Section heading "Registrierungen" matches existing uppercase `text-sm font-semibold text-gray-700 uppercase tracking-wider` styling.
- Only the three new entries set `category: 'registrations'` — every existing entry stays exactly where it is today, no migration.

### Variable substitution

Variables passed to the template:

- `teacherName` — first name of assigned teacher
- `schoolName` — booking school name
- `eventDate` — formatted German date (DD.MM.YYYY)
- `registeredCount` — integer
- `expectedCount` — integer (`estimatedChildren`)
- `percentRegistered` — integer percentage (rounded down, e.g. `"32"`)
- `daysUntilEvent` — `7` (constant for this trigger)
- `teacherPortalUrl` — `${baseUrl}/paedagogen/events/{eventId}`

## Edge cases

| Case | Behavior |
|---|---|
| Event date isn't exactly T+7 | not evaluated this pass |
| `estimatedChildren` missing or 0 | skip silently, log only, `result.skipped++` |
| `event.status !== 'Confirmed'` | skip |
| No assigned teacher on booking, or teacher has no email | skip with warning log, `result.skipped++` |
| All three event flags false (e.g. schulsong-only event) | skip — not registration-eligible |
| Registration rows exist but none have `registered_complete === true` | numerator = 0 → falls into < 33% (Critical) bucket if `expectedCount > 0` |
| `registeredCount >= 0.50 * expectedCount` | no email |
| Selected tier's template has `active === false` | `result.skipped++`, no email, no activity log entry |
| Forced re-run on same day (`?forceWeekly=true` etc.) | will re-fire — accepted risk, parity with `checkStaffEventReminder` |

## Testing

1. **Dry-run** — extend `?dryRun=true` query param logging to print `would send <slug> to <teacher.email> (ratio: X%, registered: N/M)`.
2. **Synthetic matrix** — temporarily date-shift four real Confirmed events to today+7d with registration counts crafted to hit 0%, 30%, 40%, 60%; run cron with dry-run; verify slug selection (Critical, Critical, Low, none).
3. **End-to-end smoke** — pick one such event, run cron without dry-run, confirm the email lands in the teacher inbox with correct variable substitution.

## Rollout

1. Land code: cron evaluator + registry entries + catalog entry + UI grouping field + `defaultActive` plumbing.
2. On deploy the three new entries appear immediately in `/admin/emails` (rendered from the registry merge in `getAllTriggerTemplates`, with `active = defaultActive ?? true` → `false` for the three new slugs). No Airtable row exists yet — seeding is lazy: `seedMissingTriggerTemplates` is invoked only when an admin first saves an edit (`triggerTemplateService.ts:384`). The lazy-seed step writes `active: entry.defaultActive ?? true` → `false` for the three new entries, preserving the inactive contract.
3. Until any admin saves, the cron's pre-check (`getTriggerTemplate(slug).active`) reads `false` from the registry-default fallback path (`populateAllTriggerCaches`/`getAllTriggerTemplates`), so no email fires even on the day after deploy.
4. Admins edit subject/body copy in `/admin/emails`, then flip `active = true` per template when ready.
5. Next daily cron pass picks up matching events with the active templates.

## Production-safety verification (resolved during audit)

The following items were investigated against the codebase before locking in the design. Each links to the relevant file:line.

| Concern | Resolution |
|---|---|
| Seeding hardcodes `active: true` (`triggerTemplateService.ts:219`) | Add `defaultActive` field; three call sites updated (see Default template state) |
| Pre-seed window leaks `active: true` (`triggerTemplateService.ts:80-87, 271`) | Same `defaultActive` fallback applied in both fallback paths |
| Wrong event-type values in initial design (`SCS` / `SCS_PLUS` don't exist) | Filter on boolean flags `is_minimusikertag || is_plus || is_kita`, confirmed all three have parent-registration flow |
| UI category double-render | Recipient-group filter excludes entries with `category` set |
| `email_logs` has no `trigger_slug` field (`email-automation.ts:41-50`) | Drop the safety-net lookup; rely on T-7 exact-date idempotency, parity with `checkStaffEventReminder` |
| `Registration` rows include incomplete entries | Filter numerator to `registered_complete === true` |
| Disabled templates report `success: true` (`resendService.ts:126`) | Pre-check `getTriggerTemplate(slug).active` before send; bail with `result.skipped++` |
| `triggerEventKey` shared across multiple templates | Already an established pattern (`event:mix_ready_for_release` is shared by 3 entries at `trigger-email-registry.ts:1330, 1346, 1362`); our 2-template / 1-event-key model is consistent |

## Known minor risks (accepted, not blockers)

- **Performance**: the daily cron now runs `getAllEvents()` four times (one per `checkX` helper). Each call is a full Airtable scan. Refactoring to one shared fetch is out of scope here.
- **Per-event registration scan**: `getRegistrationsByEventId` (`airtableService.ts:6896-6903`) full-scans the Registrations table per event matched. Acceptable at current scale.
- **UTC vs Berlin date drift**: `now.getDate() + 7` runs in server-local time (UTC on Vercel). For events at midnight Berlin, the date string match could be off by one day. Same risk profile as the existing `checkStaffEventReminder` — not new.

## Open questions for implementation (small)

- Does the Persons table have a teacher-side `email_campaigns` opt-out flag analogous to parents'? `airtable.ts:911` shows the field exists on parents (`'yes' | 'no'`); verify whether the teacher persons-record has the same field. Honor it if present, otherwise no change.
- Confirm activity-type union in `airtable.ts:1117` accepts the new `registration_shortfall_t7` value — or whether the union needs an additional entry.
