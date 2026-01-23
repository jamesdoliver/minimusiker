# Orders Pre-Migration State

**Date:** 2026-01-23
**Issue:** Malformed event IDs with double underscore (missing event_type)
**Script:** `scripts/migrate-malformed-event-ids.js`

## Summary

28 orders found with malformed `booking_id` values that need migration to correct format.

## Root Cause

Parent registration code was using empty `event_type` from Events table, causing event IDs to be generated with double underscores (e.g., `evt_school__date_hash` instead of `evt_school_minimusiker_date_hash`).

Fix applied in commit `372f1e4` - parent registration now defaults to 'minimusiker' when event_type is empty.

---

## Affected Orders

### 1. Schule An Der Ruhr (17 orders)

| Field | Value |
|-------|-------|
| Date | 2026-02-05 |
| Old ID | `evt_schule_an_der_ruhr__20260205_c72014` |
| New ID | `evt_schule_an_der_ruhr_minimusiker_20260205_33c3a0` |
| Target | Found existing orders with correct ID |

**Order Numbers:**
- #1028
- #1030
- #1024
- #1048
- #1017
- #1016
- #1023
- #1029
- #1015
- #1038
- #1021
- #1034
- #1019
- #1044
- #1033
- #1053
- #1018

---

### 2. Grundschule St Nikolaus Herzla (10 orders)

| Field | Value |
|-------|-------|
| Date | 2026-02-11 |
| Old ID | `evt_grundschule_st_nikolaus_herzla__20260211_459f13` |
| New ID | `evt_grundschule_st_nikolaus_herzla_minimusiker_20260211_0c85ab` |
| Target | Found existing orders with correct ID |

**Order Numbers:**
- #1022
- #1025
- #1020
- #1047
- #1037
- #1026
- #1027
- #1041
- #1035
- #1031

---

### 3. Grundschule Am R Merbad Zunzwe (1 order)

| Field | Value |
|-------|-------|
| Date | 2026-03-02 |
| Old ID | `evt_grundschule_am_r_merbad_zunzwe__20260302_5a7f17` |
| New ID | `evt_grundschule_am_r_merbad_zunzwe_minimusiker_20260302_77714f` |
| Target | Generated (no existing orders with correct ID found) |

**Order Numbers:**
- #1043

---

## Migration Command

```bash
node scripts/migrate-malformed-event-ids.js --apply
```

## Related Commits

- `372f1e4` - fix: add fallback for empty event_type in parent registration
