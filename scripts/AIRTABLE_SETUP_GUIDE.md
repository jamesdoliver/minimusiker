# Airtable Setup Guide for Teacher Portal Revamp

This guide outlines all the Airtable schema changes needed for the teacher portal revamp.

## 📋 Overview

We need to:
1. ✅ Add new fields to **Teachers** table (already completed by user)
2. ✅ Add bio and profile_photo fields to existing **Personen** table
3. ✅ Create **PreparationTips** table
4. ✅ Seed initial data

---

## 1. Update Teachers Table ✅ COMPLETED

**Table ID:** `tblLO2vXcgvNjrJ0T`

### New Fields (Already Added by User):

| Field Name | Field ID | Field Type | Description |
|---|---|---|---|
| `region` | `fldVHy77JMhWpfxKy` | Text | Teacher's region for representative assignment |
| `school_address` | `fldY8gUK35GlE7IAz` | Single line text | School physical address (editable by teacher) |
| `school_phone` | `fld9bssBb8WJWxQYV` | Phone number | School contact phone (editable by teacher) |
| `linked_bookings` | `fldxukHyKQ4KEBDWv` | Linked records | Links to SimplyBook bookings |

**Note:** School email will use the teacher's existing email field (fldkVlTMgLrLUrwlo).

**Status:** ✅ All fields have been added to Airtable by user. TypeScript field IDs have been updated.

---

## 2. Update Personen Table (Use Existing Table)

**IMPORTANT:** Instead of creating a new table, we'll use the existing **Personen** table (tblu8iWectQaQGTto) for representatives.

**Table ID:** `tblu8iWectQaQGTto`

### Existing Fields We'll Use:

| Field Name | Field ID | Description |
|---|---|---|
| `staff_name` | `fldEBMBVfGSWpywKU` | Representative's name |
| `email` | `fldKCmnASEo1RhvLu` | Contact email |
| `telefon` | `fld8SFo4WPV5qqk9p` | Contact phone |
| `rollen` | `fldoyimmjNZY3sBLa` | Role (use "team" role: rec4nmwoqYehpGOC5) |
| `teams_regionen` | `fldsd73JGjVM7BpYW` | Region assignment (linked record) |

### New Fields to Add:

| Field Name | Field Type | Description | Required |
|---|---|---|---|
| `bio` | Long text | Personal introduction shown to teachers | No |
| `profile_photo` | Attachment | Profile photo for representative card | No |

### Steps:
1. Open Airtable and navigate to the **Personen** table
2. Add `bio` field:
   - Click the `+` button next to the last column
   - Field type: "Long text"
   - Field name: "bio"
3. Add `profile_photo` field:
   - Click the `+` button next to the last column
   - Field type: "Attachment"
   - Field name: "profile_photo"
   - Allow multiple attachments: No (just one photo per person)

### Assignment Logic:
- Teachers are matched to representatives by region
- Match Teachers.region (fldVHy77JMhWpfxKy) with Personen.teams_regionen (fldsd73JGjVM7BpYW)
- Filter Personen by "team" role (rec4nmwoqYehpGOC5)
- Return first matching active team member
- If no match, return generic "Minimusiker Team" profile

### Sample Bio Content:

**Example 1: Hamburg Representative**
```
Moin. Ich bin [Name] und komme aus Hamburg. Ich freu mich schon auf den Minimusikertag bei euch. Wenn ich selbst Musik mache, dann meist auf meiner Gitarre. Ich bringe aber auch meine Ukulele mit und zeige euch, wie das klingt.
```

**Example 2: Default Representative**
```
Hallo! Wir freuen uns sehr auf den Minimusikertag bei euch. Das Minimusiker-Team steht euch jederzeit mit Rat und Tat zur Seite.
```

---

## 3. Create PreparationTips Table

This table stores helpful tips shown to teachers on the dashboard.

### Table Structure:

| Field Name | Field Type | Description | Primary |
|---|---|---|---|
| `title` | Single line text | Tip title (e.g., "Weniger ist mehr") | ✓ Primary |
| `content` | Long text | Full tip description/explanation | |
| `order` | Number | Display order (1, 2, 3...) | |
| `active` | Checkbox | Show/hide this tip | |
| `icon_name` | Single line text | Optional icon identifier | |

### Initial Data to Add:

**Tip 1:**
```
Title: Weniger ist mehr
Content: Konzentrieren Sie sich auf wenige, gut geübte Lieder statt viele halbfertige. Die Kinder haben mehr Freude, wenn sie ein Lied wirklich können und sich sicher fühlen.
Order: 1
Active: ✓
```

**Tip 2:**
```
Title: Regelmäßig üben
Content: Kurze, regelmäßige Übungseinheiten (10-15 Minuten) sind effektiver als lange, seltene Sessions. Bauen Sie die Lieder in den Schulalltag ein.
Order: 2
Active: ✓
```

**Tip 3:**
```
Title: Instrumente erkunden
Content: Lassen Sie die Kinder verschiedene Klänge und Instrumente ausprobieren. Experimentieren fördert die Kreativität und macht Musik greifbar.
Order: 3
Active: ✓
```

**Tip 4:**
```
Title: Bewegung einbauen
Content: Verbinden Sie Musik mit Bewegung. Rhythmus kann geklatscht, gestampft oder getanzt werden – das macht Spaß und hilft beim Lernen.
Order: 4
Active: ✓
```

**Tip 5:**
```
Title: Positive Atmosphäre schaffen
Content: Loben Sie die Kinder für ihre Bemühungen, nicht nur für das Ergebnis. Eine positive, ermutigende Atmosphäre motiviert zum Weitermachen.
Order: 5
Active: ✓
```

---

## 4. Field IDs (for Code) ✅ PARTIALLY COMPLETE

### Teachers Table Field IDs ✅ DONE

**Status:** ✅ Already updated in `src/lib/types/teacher.ts`

```typescript
export const TEACHERS_FIELD_IDS = {
  // ... existing fields
  region: 'fldVHy77JMhWpfxKy', // ✅ Added
  school_address: 'fldY8gUK35GlE7IAz', // ✅ Added
  school_phone: 'fld9bssBb8WJWxQYV', // ✅ Added
  linked_bookings: 'fldxukHyKQ4KEBDWv', // ✅ Added
} as const;
```

### Personen Table Field IDs - TO DO

After adding `bio` and `profile_photo` fields to Personen table:

1. Get the field IDs:
   - Open Airtable → Personen table
   - Right-click on `bio` field name → "Copy field ID"
   - Right-click on `profile_photo` field name → "Copy field ID"

2. Update `src/lib/types/airtable.ts`:
```typescript
export const PERSONEN_FIELD_IDS = {
  // ... existing fields
  bio: 'fldXXXXXXXXXXXXXXX', // Add actual field ID after creating field
  profile_photo: 'fldXXXXXXXXXXXXXXX', // Add actual field ID after creating field
} as const;
```

### PreparationTips Table - TO DO

After creating PreparationTips table, get table ID and field IDs, then create:

**src/lib/types/preparation-tips.ts** (new file)
```typescript
export const PREPARATION_TIPS_TABLE_ID = 'tblXXXXXXXXXXXXXXX'; // Add actual table ID

export const PREPARATION_TIPS_FIELD_IDS = {
  title: 'fldXXXXXXXXXXXXXXX',
  content: 'fldXXXXXXXXXXXXXXX',
  order: 'fldXXXXXXXXXXXXXXX',
  active: 'fldXXXXXXXXXXXXXXX',
  icon_name: 'fldXXXXXXXXXXXXXXX',
} as const;
```

---

## 5. Migration Script

After creating all fields and tables, run the migration script to backfill data for existing teachers:

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/migrate-teacher-data.ts
```

This will:
- Set default region ("Default") for all existing teachers
- Copy teacher email → school_email (teachers can update later)
- Copy teacher phone → school_phone (teachers can update later)
- Leave school_address empty (prompt teachers to fill in)

---

## ✅ Checklist

- [x] Add new fields to Teachers table (completed by user)
- [x] Update TypeScript field IDs for Teachers table
- [x] Create migration script for teacher data
- [ ] Add `bio` and `profile_photo` fields to Personen table
- [ ] Add bio content for at least one team member per region
- [ ] Upload profile photos for representatives
- [ ] Get Personen field IDs (bio, profile_photo)
- [ ] Update TypeScript constants in `src/lib/types/airtable.ts`
- [ ] Create PreparationTips table
- [ ] Add 5-10 initial tips to PreparationTips table
- [ ] Get PreparationTips table ID and field IDs
- [ ] Create `src/lib/types/preparation-tips.ts` with field IDs
- [ ] Run migration script to backfill teacher data: `npx dotenv-cli -e .env.local -- npx tsx scripts/migrate-teacher-data.ts`
- [ ] Verify data in Airtable with audit script: `npx dotenv-cli -e .env.local -- npx tsx scripts/audit-teachers.ts`

---

## 🆘 Need Help?

If you encounter issues:
1. Check that field types match exactly
2. Verify field IDs are copied correctly
3. Ensure region options are identical between Teachers and Representatives tables
4. Test with the audit script: `npx dotenv-cli -e .env.local -- npx tsx scripts/audit-teachers.ts`

