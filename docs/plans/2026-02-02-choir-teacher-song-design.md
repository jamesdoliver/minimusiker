# Choir and Teacher Song Collections Design

**Date:** 2026-02-02
**Status:** Pending Implementation

## Problem

The client needs two new collection types:
- **Choir** - For choir-specific songs
- **Teacher Song** - For teacher demonstration/example songs

Unlike regular classes, these collections hold only song information (no child/class data). Like "Alle Kinder", they should be visible to all registered parents in the event.

## Design Summary

### Data Model

Extend the existing **Classes table** with a `class_type` field:

| class_type | Description |
|------------|-------------|
| `regular` | Normal class with children |
| `choir` | Choir song collection (no children) |
| `teacher_song` | Teacher song collection (no children) |

This reuses existing infrastructure:
- Songs link via `class_id` (no changes needed)
- AudioFiles link via `class_id` (no changes needed)
- Teacher assignment works via existing fields

### Key Decisions

1. **Multiple per event** - Teachers can create multiple Choirs ("Junior Choir", "Senior Choir") and multiple Teacher Songs
2. **Both teachers and admins can create** collections
3. **All parents see all collections** - No class-specific visibility restrictions
4. **Tabbed parent portal UI** - My Class | Choir | Teacher Songs | Alle Kinder

### User Flows

**Teacher creates Choir:**
1. Teacher goes to event page
2. Clicks "Add Choir" (or dropdown "Add → Choir")
3. Enters name (e.g., "Junior Choir")
4. Collection appears in Choir section
5. Adds songs using existing song management

**Parent views Choir:**
1. Parent logs into portal
2. Sees tabbed interface
3. Clicks "Choir" tab
4. Sees all Choir collections for the event
5. Expands collection to see songs and play audio

### Implementation Phases

1. **Schema:** Add `class_type` field to Airtable Classes table
2. **Services:** Update teacherService with collection methods
3. **APIs:** New endpoints for collections (teacher, admin, parent)
4. **Teacher UI:** Add collection creation and management
5. **Admin UI:** Add collection CRUD with delete
6. **Parent UI:** Refactor to tabbed layout with Choir/Teacher Songs tabs

## Alternatives Considered

1. **New dedicated table** - More separation but requires new relationships and more API changes
2. **Repurpose Groups table** - Groups already have member_classes concept which doesn't fit song-only collections

Extending Classes table chosen for:
- Minimal changes to existing infrastructure
- Songs and AudioFiles already link correctly
- Consistent with how "Alle Kinder" works
