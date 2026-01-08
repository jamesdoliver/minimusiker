# Printable Generation System - Setup Guide

## Overview

This system automatically generates customized printables (flyers, posters, merchandise prints, etc.) for each school event by overlaying school name, event date, and logo onto base PDF templates.

**Current Status:** Infrastructure complete, awaiting base PDF templates from client.

---

## Implementation Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | R2 Service Updates | ✅ Complete |
| Phase 2 | Printable Generation Service | ✅ Complete |
| Phase 3 | Webhook Enhancement | ✅ Complete |
| Phase 4 | Regeneration System | ⏳ Blocked (needs templates for testing) |
| Phase 5 | Backfill Script | ⏳ Blocked (needs templates) |
| Phase 6 | Admin Panel Integration | ⏳ Blocked (needs templates) |

### What's Already Built

1. **R2 Service** (`src/lib/services/r2Service.ts`)
   - Dual bucket support (`minimusiker-assets` for new structure)
   - Event folder initialization
   - Template upload/retrieval methods
   - Printable and mockup upload methods

2. **Printable Service** (`src/lib/services/printableService.ts`)
   - PDF manipulation using `pdf-lib`
   - Text overlay (school name, event date)
   - Image overlay (school logo for minicard/cd-jacket)
   - Generation methods for all printable types

3. **Webhook Integration** (`src/app/api/simplybook/webhook/route.ts`)
   - Auto-creates Events record when booking arrives
   - Initializes R2 folder structure
   - Copies school logo from Airtable
   - Generates all printables (when templates available)

4. **Configuration** (`src/lib/config/printableConfig.ts`)
   - Placeholder text placement coordinates
   - Color definitions (brand color, default black)
   - German date formatting

---

## Required Templates

Upload these 10 PDF templates to R2 bucket `minimusiker-assets` in the `/templates/` folder:

| # | Filename | Purpose | Overlaid Data |
|---|----------|---------|---------------|
| 1 | `flyer1-template.pdf` | Marketing flyer variant 1 | School name, event date |
| 2 | `flyer2-template.pdf` | Marketing flyer variant 2 | School name, event date |
| 3 | `flyer3-template.pdf` | Marketing flyer variant 3 | School name, event date |
| 4 | `poster-template.pdf` | Event poster | School name, event date |
| 5 | `tshirt-print-template.pdf` | T-shirt print file | School name, event date |
| 6 | `hoodie-print-template.pdf` | Hoodie print file | School name, event date |
| 7 | `minicard-template.pdf` | Product insert card | School name, event date, **logo** |
| 8 | `cd-jacket-template.pdf` | CD case insert | School name, event date, **logo** |
| 9 | `mock-tshirt-template.pdf` | T-shirt preview for customers | School name only |
| 10 | `mock-hoodie-template.pdf` | Hoodie preview for customers | School name only |

### Template Requirements

Each template PDF should:
- Have designated blank areas where text will be overlaid
- For minicard/cd-jacket: have designated area for logo placement
- Be print-ready resolution (300 DPI recommended)
- Use standard paper sizes where applicable (A4 for flyers/posters)

### Design Guidance for Templates

When creating templates, leave clear space for:
- **School name**: Typically 28-36pt bold text
- **Event date**: Typically 16-24pt regular text (format: "15. Januar 2026")
- **Logo** (minicard/cd-jacket only): Square area approximately 50-100pt

---

## Upload Instructions

### Option 1: Cloudflare R2 Dashboard (Recommended)

1. Log into Cloudflare dashboard
2. Navigate to R2 → `minimusiker-assets` bucket
3. Create folder `templates/` if it doesn't exist
4. Upload all 10 PDFs with exact filenames listed above

### Option 2: Using AWS CLI (S3-compatible)

```bash
# Configure AWS CLI for R2
aws configure set aws_access_key_id $R2_ACCESS_KEY_ID
aws configure set aws_secret_access_key $R2_SECRET_ACCESS_KEY

# Upload templates
aws s3 cp ./flyer1-template.pdf s3://minimusiker-assets/templates/flyer1-template.pdf \
  --endpoint-url $R2_ENDPOINT

# Repeat for all 10 templates
```

### Option 3: Script (Future - not yet built)

```bash
# TODO: Build admin upload endpoint
node scripts/upload-templates.js --dir ./templates/
```

---

## Configuration: Text Placement Coordinates

After uploading templates, you **must** configure where text appears on each template.

### File to Edit

`src/lib/config/printableConfig.ts`

### How to Find Coordinates

1. Open each template PDF in a PDF editor (Adobe Acrobat, Preview, etc.)
2. Identify where school name and date should appear
3. Note the x, y position from the **bottom-left corner**
4. PDF coordinates use points (1 point = 1/72 inch)
5. Standard A4 page is 595 × 842 points

### Current Placeholder Configuration

```typescript
// Example: flyer1 configuration
flyer1: {
  schoolName: {
    x: 297.5,      // Center of A4 page (595/2)
    y: 700,        // Near top
    fontSize: 28,
    maxWidth: 400,
    color: BRAND_COLOR,  // MiniMusiker coral (#E87452)
    align: 'center',
  },
  eventDate: {
    x: 297.5,
    y: 660,        // Below school name
    fontSize: 18,
    maxWidth: 300,
    color: DEFAULT_COLOR,  // Black
    align: 'center',
  },
},
```

### Logo Placement (minicard/cd-jacket only)

```typescript
minicard: {
  schoolName: { ... },
  eventDate: { ... },
  logo: {
    x: 100,        // Left edge of logo
    y: 220,        // Bottom edge of logo
    width: 100,    // Max width
    height: 100,   // Max height
    fit: 'contain', // Maintain aspect ratio
  },
},
```

### Testing Coordinates

After configuring, test with a single event:

```typescript
// In a test script or API route
import { getPrintableService } from '@/lib/services/printableService';

const printableService = getPrintableService();
const result = await printableService.generatePrintable(
  'test-event-id',
  'flyer1',
  'Test School Name',
  '2026-03-15'
);
console.log(result);
```

---

## Remaining Work (After Templates Uploaded)

### Phase 4: Regeneration System

**Purpose:** Regenerate printables when school name, event date, or logo changes.

**File to create:** `src/lib/services/printableRegenerationService.ts`

**Triggers:**
- School name change → regenerate ALL printables + mockups
- Event date change → regenerate ALL printables (not mockups - no date on them)
- Logo change → regenerate minicard + CD jacket only

**Implementation options:**
1. Manual trigger - Admin button in panel
2. Airtable webhook - Listen for record changes
3. API endpoint - Called from admin panel

### Phase 5: Backfill Script

**Purpose:** Generate printables for all existing 2026 events.

**File to create:** `scripts/backfill-printables.ts`

**Steps:**
1. Query Events table for all 2026 events
2. For each event:
   - Check if printables already exist in R2
   - Generate missing printables
   - Log progress

### Phase 6: Admin Panel Integration

**Features needed:**
- View/download all printables for an event
- Manual "Regenerate Printables" button
- Status indicator (generated/pending/failed)
- Template management (view which templates are uploaded)

---

## Environment Variables

Ensure these are set in `.env.local`:

```bash
# R2 Configuration
R2_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=school-recordings
R2_ASSETS_BUCKET_NAME=minimusiker-assets  # New bucket for printables
```

---

## Verification Checklist

After uploading templates, verify the system works:

- [ ] All 10 templates uploaded to `templates/` folder in R2
- [ ] Text coordinates configured in `printableConfig.ts`
- [ ] Test single printable generation manually
- [ ] Create test booking via SimplyBook
- [ ] Verify Events record created in Airtable
- [ ] Verify R2 folder structure created: `events/{event_id}/`
- [ ] Verify printables generated in `events/{event_id}/printables/`
- [ ] Download and visually inspect generated PDFs
- [ ] Verify text placement looks correct

---

## Troubleshooting

### "Template not found" error

Templates haven't been uploaded to R2. Check:
```bash
# List templates in R2 (via AWS CLI)
aws s3 ls s3://minimusiker-assets/templates/ --endpoint-url $R2_ENDPOINT
```

### Text appears in wrong position

Coordinates in `printableConfig.ts` need adjustment. Remember:
- Origin (0,0) is bottom-left corner
- Y increases upward
- X increases rightward

### Logo not appearing on minicard/cd-jacket

1. Check if school has logo in Airtable Einrichtung record
2. Check if logo was copied to event folder
3. Check logo placement coordinates in config

### Printables not generating on new bookings

Check webhook logs:
```bash
# View Vercel function logs
vercel logs --follow
```

Look for:
- "Generated event_id: ..."
- "Created Event record: ..."
- "Initialized R2 event structure for: ..."
- "Generated all printables for event: ..."

---

## Related Files

| File | Purpose |
|------|---------|
| `src/lib/services/r2Service.ts` | R2 storage operations |
| `src/lib/services/printableService.ts` | PDF generation logic |
| `src/lib/config/printableConfig.ts` | Text placement coordinates |
| `src/app/api/simplybook/webhook/route.ts` | Webhook that triggers generation |
| `src/lib/utils/eventIdentifiers.ts` | Event ID generation |
| `src/lib/types/airtable.ts` | Event type definition |

---

## Contact / Questions

If you have questions about this system:
1. Review the implementation plan: `.claude/plans/kind-strolling-whale.md`
2. Check the codebase for inline comments
3. Test with a single event before running backfill
