# Public & Internal Song Notes — Design

## Overview

Split the existing single `notes` field on songs into two fields: **Public Notes** (visible to parents) and **Internal Notes** (admin/engineer only). Existing notes data becomes Internal Notes; Public Notes start empty.

## Data Model

**Airtable — Songs table:**

| Field | Airtable Field | Who can edit | Who can see |
|-------|---------------|-------------|-------------|
| `public_notes` | New field (text) | Admin, Engineer, Teacher | Admin, Engineer, Teacher, Parents |
| `internal_notes` | Existing `notes` field (`fldZRLk0JP05VRDm6`), renamed | Admin, Engineer | Admin, Engineer only |

Existing `notes` field keeps its Airtable field ID — renamed to `internal_notes` in code. All current data stays as internal notes.

**TypeScript Song interface:**

```typescript
// replaces: notes?: string
publicNotes?: string;
internalNotes?: string;
```

## Portal Visibility & Editing

### Admin (event view / audio tab)
- Song display shows both fields as small gray text below artist, visually differentiated with labels
- `EditSongModal` and `AddSongModal` get two textareas: "Public Notes" and "Internal Notes"

### Engineer (event control screen)
- Song rows show both notes fields as small text below title/artist
- Both editable inline, consistent with existing title inline editing pattern

### Teacher (event view)
- Song cards show `publicNotes` as small gray text below artist
- `internalNotes` completely absent — not fetched, not rendered
- Edit modal has one textarea for Public Notes only

### Parent (tracklist)
- `publicNotes` shown below artist in `EventAudioTracklist` as `text-xs text-gray-500`
- Only rendered when non-empty

## API Changes

### Teacher routes — `publicNotes` only
- `PUT /api/teacher/songs/[songId]` — accepts `publicNotes`, excludes `internalNotes`
- `POST /api/teacher/classes/[classId]/songs` — accepts `publicNotes` only
- Responses exclude `internalNotes`

### Admin routes — both fields
- `PUT /api/admin/songs/[songId]` — accepts both
- `POST /api/admin/classes/[classId]/songs` — accepts both
- Responses include both

### Engineer routes — both fields
- Add or extend song update endpoint to accept both `publicNotes` and `internalNotes`

### Parent routes — read-only, `publicNotes` only
- `/api/parent/collections` — include `publicNotes` in song mapping
- `/api/parent/audio-access` — include `publicNotes` in track entries

## Migration
- No data migration needed — existing `notes` field ID stays the same, just renamed to `internal_notes` in code
- New `public_notes` field created in Airtable, starts empty
- No backfill required
