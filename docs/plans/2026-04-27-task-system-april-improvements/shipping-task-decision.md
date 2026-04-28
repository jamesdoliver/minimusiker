# V2 Shipping-Task Semantics — Decision

**Decision: A** — v2 collapses ordering + shipping into a single atomic task per print/supplier item. There is no separate downstream shipping task.

## Evidence

- **Section 2, prefix categories:** "**Ship** — Outbound print materials to school/supplier. Monetary completion with optional invoice upload." A single completion type per row, with no follow-up referenced anywhere.
- **Section 9, `ship_poster` entry:** `description: 'Order and ship poster to school'`. The v2 description bundles both verbs into one task; likewise `ship_flyer_1`: `'Order and ship first flyer batch'`.
- **Section 9 schema:** the `TaskTimelineEntry` interface defines `creates_go_id` but has no `creates_shipping` field.

## Implication for Task 2.7

Task 2.7 will delete the `creates_shipping` branch in `taskService.completeTask`, remove `SHIPPING_TEMPLATE` and the `creates_shipping` field from `taskTemplates.ts`, and drop the `'shipping'` task type — no v2 mapping is needed.
