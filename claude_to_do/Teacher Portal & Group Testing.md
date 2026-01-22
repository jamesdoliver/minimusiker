# Teacher Portal & Group Testing

**Created:** 2026-01-16
**Related Commit:** `61312b7` - feat: add class management improvements and "Classes Singing Together" feature

---

## Overview

This checklist covers testing for Bug 4 fixes:
1. **Part 1:** numChildren bug fix (form errors when children quantity entered)
2. **Part 2:** Teacher edit/delete classes
3. **Part 3:** "Classes Singing Together" (Groups feature)

---

## Part 1: numChildren Bug Fix

**Test Location:** Teacher Portal - Add Class Modal

- [ ] Navigate to `/paedagogen/events/[eventId]`
- [ ] Click "Klasse hinzufügen"
- [ ] Enter class name and children quantity (e.g., 25)
- [ ] Submit - should work without errors
- [ ] Enter class name with children quantity of 0
- [ ] Submit - should work without errors (0 is valid)
- [ ] Verify class appears with correct children count

---

## Part 2: Teacher Edit/Delete Classes

**Test Location:** Teacher Portal - Event Detail Page

### Edit Class
- [ ] Navigate to event with existing classes
- [ ] Hover over a non-default class card
- [ ] Verify edit button (pencil icon) appears
- [ ] Click edit - modal opens with current values
- [ ] Change class name - save successfully
- [ ] Change children count - save successfully
- [ ] Verify changes reflected in class card

### Delete Class
- [ ] Verify delete button (trash icon) appears on non-default classes
- [ ] Default class ("Alle Kinder") should NOT have delete button
- [ ] Click delete on class with songs - should show error "Remove songs first"
- [ ] Click delete on empty class - confirmation modal appears
- [ ] Confirm deletion - class removed successfully

---

## Part 3: Groups Feature ("Classes Singing Together")

### Teacher Portal (`/paedagogen`)

**Prerequisites:**
- [ ] Log in as a teacher with an existing event
- [ ] Ensure the event has at least 2 non-default classes

**Creating Groups:**
- [ ] Navigate to event detail page (`/paedagogen/events/[eventId]`)
- [ ] Verify "Gruppe erstellen" button (purple) appears next to "Klasse hinzufügen"
- [ ] Click "Gruppe erstellen" - modal should open
- [ ] Verify info box explains groups get combined audio
- [ ] Verify only non-default classes appear in selection (not "Alle Kinder")
- [ ] Try submitting with <2 classes selected - should show error
- [ ] Try submitting without group name - should show error
- [ ] Select 2+ classes, enter name, submit - should create successfully
- [ ] Verify group appears in new "Gruppen" section with purple border

**Group Display:**
- [ ] Group card shows purple theme (icon, border)
- [ ] Group card shows "Gruppe" badge
- [ ] Group card shows member class names
- [ ] Expanding group shows "Enthaltene Klassen" info box
- [ ] Group has "Lied hinzufügen" option

**Adding Songs to Groups:**
- [ ] Click "Lied hinzufügen" in group card
- [ ] Add a song - should save successfully
- [ ] Song appears in group's song list

**Deleting Groups:**
- [ ] Delete button (trash icon) appears on group card header
- [ ] Clicking shows confirmation modal
- [ ] Modal warns that classes remain intact
- [ ] If group has songs, deletion should fail with error message
- [ ] Empty group deletes successfully

### Parent Portal (`/familie`)

**Prerequisites:**
- [ ] Log in as a parent whose class belongs to a group
- [ ] Group should have audio uploaded (preview or final)

**Group Audio Display:**
- [ ] Purple "Gruppen-Aufnahme" section appears below class audio
- [ ] Shows group name and member classes
- [ ] Audio player works for group recording

---

## API Endpoints (Optional - via browser dev tools)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/teacher/events/[eventId]/groups` | GET | Returns groups list for event |
| `/api/teacher/events/[eventId]/groups` | POST | Creates new group |
| `/api/teacher/groups/[groupId]` | GET | Returns single group |
| `/api/teacher/groups/[groupId]` | PUT | Updates group (name/members) |
| `/api/teacher/groups/[groupId]` | DELETE | Deletes group |
| `/api/parent/groups?classId=xxx` | GET | Returns groups for parent's class |

---

## Airtable Configuration

**Groups Table ID:** `tblAPwTzqYTHbaz2k`

| Field | Field ID | Description |
|-------|----------|-------------|
| `group_id` | `fld6BW3r6uAADjuMx` | Unique identifier |
| `group_name` | `fldiqq6p37u8G6iGs` | Display name |
| `event_id` | `fld1wQzJMIA4uCNeQ` | Linked to Events table |
| `member_classes` | `fldyeuP6wYE3DRrXX` | Linked to Classes table (multiple) |
| `created_at` | `fld8v4sD1IX6wfzBy` | Creation timestamp |
| `created_by` | `flduZ1riZm12QWD5Y` | Teacher email |

---

## Test Results

| Test Area | Status | Notes |
|-----------|--------|-------|
| numChildren fix | ⬜ Pending | |
| Teacher edit class | ⬜ Pending | |
| Teacher delete class | ⬜ Pending | |
| Create group | ⬜ Pending | |
| Group display | ⬜ Pending | |
| Group songs | ⬜ Pending | |
| Delete group | ⬜ Pending | |
| Parent portal groups | ⬜ Pending | |

---

## Issues Found

_Document any bugs or issues found during testing here:_

1.

---

## Notes

- Groups use the `groupId` as the `classId` for songs and audio files
- A class can belong to multiple groups
- Groups have their own songs list (not inherited from member classes)
- Default "Alle Kinder" class cannot be added to groups
