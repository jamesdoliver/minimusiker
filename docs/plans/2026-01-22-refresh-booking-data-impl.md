# Refresh Booking Data Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Refresh Booking Data" button to admin booking accordion that fetches missing data from SimplyBook API with preview before applying.

**Architecture:** New API endpoint at `/api/admin/bookings/[id]/refresh` handles preview and apply modes. Modal component shows diff and warnings. Button added to existing `BookingDetailsBreakdown` component.

**Tech Stack:** Next.js API routes, React modal component, Airtable SDK, SimplyBook JSON-RPC API

---

## Task 1: Create Refresh API Endpoint (Preview Mode)

**Files:**
- Create: `src/app/api/admin/bookings/[id]/refresh/route.ts`

**Step 1: Create the API route file with types**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { simplybookService } from '@/lib/services/simplybookService';
import { SCHOOL_BOOKINGS_TABLE_ID, SCHOOL_BOOKINGS_FIELD_IDS } from '@/lib/types/airtable';
import Airtable from 'airtable';

export const dynamic = 'force-dynamic';

// Response types
interface FieldUpdate {
  field: string;
  label: string;
  current: string;
  new: string;
}

interface MissingField {
  field: string;
  label: string;
}

interface RefreshPreviewResponse {
  success: true;
  updates: FieldUpdate[];
  stillMissing: MissingField[];
  hasUpdates: boolean;
}

interface RefreshApplyResponse {
  success: true;
  updatedCount: number;
  message: string;
}

interface RefreshErrorResponse {
  success: false;
  error: string;
}

// Field configuration for comparison
const FIELD_CONFIG = [
  { airtable: 'school_name', mapped: 'schoolName', label: 'School Name', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.school_name },
  { airtable: 'school_contact_name', mapped: 'contactPerson', label: 'Contact Person', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name },
  { airtable: 'school_contact_email', mapped: 'contactEmail', label: 'Contact Email', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.school_contact_email },
  { airtable: 'school_phone', mapped: 'phone', label: 'Phone', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.school_phone },
  { airtable: 'school_address', mapped: 'address', label: 'Address', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.school_address },
  { airtable: 'school_postal_code', mapped: 'postalCode', label: 'Postal Code', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.school_postal_code },
  { airtable: 'city', mapped: 'city', label: 'City', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.city },
  { airtable: 'estimated_children', mapped: 'numberOfChildren', label: 'Estimated Children', fieldId: SCHOOL_BOOKINGS_FIELD_IDS.estimated_children },
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<RefreshPreviewResponse | RefreshApplyResponse | RefreshErrorResponse>> {
  try {
    // Verify admin authentication
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id: bookingId } = await params;
    const { searchParams } = new URL(request.url);
    const preview = searchParams.get('preview') !== 'false'; // Default to preview mode

    // Get booking from Airtable
    const airtableService = getAirtableService();
    const booking = await airtableService.getSchoolBookingById(bookingId);

    if (!booking) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }

    if (!booking.simplybookId) {
      return NextResponse.json({ success: false, error: 'Booking has no SimplyBook ID' }, { status: 400 });
    }

    // Fetch fresh data from SimplyBook
    const simplybookData = await simplybookService.getBookingDetails(booking.simplybookId);
    const mappedData = simplybookService.mapIntakeFields(simplybookData);

    // Compare fields
    const updates: FieldUpdate[] = [];
    const stillMissing: MissingField[] = [];

    const currentValues: Record<string, string | number | undefined> = {
      schoolName: booking.schoolName,
      contactPerson: booking.schoolContactName,
      contactEmail: booking.schoolContactEmail,
      phone: booking.schoolPhone,
      address: booking.schoolAddress,
      postalCode: booking.schoolPostalCode,
      city: booking.city,
      numberOfChildren: booking.estimatedChildren,
    };

    for (const config of FIELD_CONFIG) {
      const currentValue = currentValues[config.mapped];
      const newValue = mappedData[config.mapped as keyof typeof mappedData];
      const isEmpty = !currentValue || currentValue === '' || currentValue === 0;
      const hasNewValue = newValue !== undefined && newValue !== '' && newValue !== 0;

      if (isEmpty && hasNewValue) {
        updates.push({
          field: config.airtable,
          label: config.label,
          current: String(currentValue || ''),
          new: String(newValue),
        });
      } else if (isEmpty && !hasNewValue) {
        stillMissing.push({
          field: config.airtable,
          label: config.label,
        });
      }
    }

    // Preview mode - return comparison
    if (preview) {
      return NextResponse.json({
        success: true,
        updates,
        stillMissing,
        hasUpdates: updates.length > 0,
      });
    }

    // Apply mode - update Airtable
    if (updates.length === 0) {
      return NextResponse.json({
        success: true,
        updatedCount: 0,
        message: 'No updates needed',
      });
    }

    // Build update object using field IDs
    const updateFields: Record<string, string | number> = {};
    for (const update of updates) {
      const config = FIELD_CONFIG.find(c => c.airtable === update.field);
      if (config) {
        updateFields[config.fieldId] = update.field === 'estimated_children'
          ? parseInt(update.new, 10)
          : update.new;
      }
    }

    // Update Airtable record
    const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(process.env.AIRTABLE_BASE_ID!);
    await airtable.table(SCHOOL_BOOKINGS_TABLE_ID).update(bookingId, updateFields);

    return NextResponse.json({
      success: true,
      updatedCount: updates.length,
      message: `${updates.length} field${updates.length === 1 ? '' : 's'} updated from SimplyBook`,
    });
  } catch (error) {
    console.error('Error refreshing booking data:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to refresh booking' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify the endpoint loads without errors**

Run: `curl -X POST http://localhost:3000/api/admin/bookings/test123/refresh -H "Cookie: admin_session=..." 2>/dev/null | head -20`

Expected: Returns JSON (either error about auth/not found or success)

**Step 3: Commit**

```bash
git add src/app/api/admin/bookings/\[id\]/refresh/route.ts
git commit -m "feat: add refresh booking data API endpoint"
```

---

## Task 2: Create RefreshBookingModal Component

**Files:**
- Create: `src/components/admin/bookings/RefreshBookingModal.tsx`

**Step 1: Create the modal component**

```typescript
'use client';

import { useEffect, useRef } from 'react';

interface FieldUpdate {
  field: string;
  label: string;
  current: string;
  new: string;
}

interface MissingField {
  field: string;
  label: string;
}

interface RefreshBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: () => void;
  isApplying: boolean;
  updates: FieldUpdate[];
  stillMissing: MissingField[];
  hasUpdates: boolean;
}

export default function RefreshBookingModal({
  isOpen,
  onClose,
  onApply,
  isApplying,
  updates,
  stillMissing,
  hasUpdates,
}: RefreshBookingModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isApplying) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isApplying, onClose]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node) && !isApplying) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, isApplying, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        ref={modalRef}
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Refresh Booking Data</h2>
          <button
            onClick={onClose}
            disabled={isApplying}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {hasUpdates ? (
            <>
              {/* Updates Section */}
              <div className="mb-4">
                <div className="flex items-center gap-2 text-green-700 mb-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">{updates.length} field{updates.length === 1 ? '' : 's'} will be updated:</span>
                </div>
                <div className="space-y-2">
                  {updates.map((update) => (
                    <div key={update.field} className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="text-sm font-medium text-gray-700">{update.label}</div>
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <span className="text-gray-500 line-through">{update.current || '(empty)'}</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="text-green-700 font-medium">{update.new}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-6">
              <svg className="w-12 h-12 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-600 font-medium">Already up to date</p>
              <p className="text-gray-500 text-sm mt-1">No new data available from SimplyBook</p>
            </div>
          )}

          {/* Missing Fields Warning */}
          {stillMissing.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="font-medium text-sm">{stillMissing.length} field{stillMissing.length === 1 ? '' : 's'} still missing (not in SimplyBook):</span>
              </div>
              <ul className="text-sm text-amber-600 ml-7 list-disc">
                {stillMissing.map((field) => (
                  <li key={field.field}>{field.label}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={isApplying}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {hasUpdates ? 'Cancel' : 'Close'}
          </button>
          {hasUpdates && (
            <button
              onClick={onApply}
              disabled={isApplying}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isApplying ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Applying...
                </>
              ) : (
                'Apply Updates'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/admin/bookings/RefreshBookingModal.tsx
git commit -m "feat: add RefreshBookingModal component"
```

---

## Task 3: Add Refresh Button to BookingDetailsBreakdown

**Files:**
- Modify: `src/components/admin/bookings/BookingDetailsBreakdown.tsx`

**Step 1: Add imports and state**

At the top of the file, add the import:

```typescript
import RefreshBookingModal from './RefreshBookingModal';
```

Inside the component, after the existing state declarations (around line 16), add:

```typescript
const [isRefreshing, setIsRefreshing] = useState(false);
const [showRefreshModal, setShowRefreshModal] = useState(false);
const [refreshData, setRefreshData] = useState<{
  updates: Array<{ field: string; label: string; current: string; new: string }>;
  stillMissing: Array<{ field: string; label: string }>;
  hasUpdates: boolean;
} | null>(null);
const [isApplyingRefresh, setIsApplyingRefresh] = useState(false);
```

**Step 2: Add handler functions**

After the existing handlers (after `handleCopyLink` around line 43), add:

```typescript
// Refresh booking data from SimplyBook
const handleRefresh = async () => {
  setIsRefreshing(true);
  try {
    const response = await fetch(`/api/admin/bookings/${booking.id}/refresh?preview=true`, {
      method: 'POST',
    });
    const data = await response.json();

    if (data.success) {
      setRefreshData({
        updates: data.updates,
        stillMissing: data.stillMissing,
        hasUpdates: data.hasUpdates,
      });
      setShowRefreshModal(true);
    } else {
      alert(`Failed to fetch data: ${data.error}`);
    }
  } catch (error) {
    alert('Failed to connect to SimplyBook');
    console.error('Refresh error:', error);
  } finally {
    setIsRefreshing(false);
  }
};

// Apply refresh updates
const handleApplyRefresh = async () => {
  setIsApplyingRefresh(true);
  try {
    const response = await fetch(`/api/admin/bookings/${booking.id}/refresh?preview=false`, {
      method: 'POST',
    });
    const data = await response.json();

    if (data.success) {
      setShowRefreshModal(false);
      setRefreshData(null);
      // Refresh the page to show updated data
      window.location.reload();
    } else {
      alert(`Failed to apply updates: ${data.error}`);
    }
  } catch (error) {
    alert('Failed to apply updates');
    console.error('Apply refresh error:', error);
  } finally {
    setIsApplyingRefresh(false);
  }
};
```

**Step 3: Add the button to the Actions Row**

Find the Actions Row section (around line 221-242). Replace it with:

```typescript
{/* Actions Row */}
<div className="mt-6 pt-4 border-t border-gray-200 flex justify-end gap-3">
  <button
    onClick={handleRefresh}
    disabled={isRefreshing}
    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
  >
    {isRefreshing ? (
      <>
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        Checking...
      </>
    ) : (
      <>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh Booking Data
      </>
    )}
  </button>
  <button
    onClick={() => setShowPrintablesModal(true)}
    className="inline-flex items-center gap-2 px-4 py-2 bg-[#F4A261] text-white rounded-lg hover:bg-[#E07B3A] transition-colors"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    Confirm Printables
  </button>
  <Link
    href={`/admin/events/${booking.code}`}
    className="inline-flex items-center gap-2 px-4 py-2 bg-[#94B8B3] text-white rounded-lg hover:bg-[#7da39e] transition-colors"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
    View Event Details
  </Link>
</div>
```

**Step 4: Add the RefreshBookingModal component**

After the ConfirmPrintablesModal (around line 248), add:

```typescript
{/* Refresh Booking Data Modal */}
{refreshData && (
  <RefreshBookingModal
    isOpen={showRefreshModal}
    onClose={() => {
      setShowRefreshModal(false);
      setRefreshData(null);
    }}
    onApply={handleApplyRefresh}
    isApplying={isApplyingRefresh}
    updates={refreshData.updates}
    stillMissing={refreshData.stillMissing}
    hasUpdates={refreshData.hasUpdates}
  />
)}
```

**Step 5: Commit**

```bash
git add src/components/admin/bookings/BookingDetailsBreakdown.tsx
git commit -m "feat: add Refresh Booking Data button to admin accordion"
```

---

## Task 4: Manual Testing

**Step 1: Start the dev server**

Run: `npm run dev`

**Step 2: Test the feature**

1. Log in to admin at `/admin`
2. Navigate to `/admin/bookings`
3. Expand a booking in the accordion
4. Verify the blue "Refresh Booking Data" button appears on the left
5. Click the button and verify:
   - Button shows "Checking..." with spinner
   - Modal opens with preview data
   - Updates shown in green (if any)
   - Missing fields shown as warning
6. Click "Apply Updates" and verify:
   - Button shows "Applying..."
   - Page reloads with updated data

**Step 3: Test edge cases**

- Test on a booking that's already up to date (should show "Already up to date")
- Test on a booking with missing SimplyBook ID (should show error)
- Test clicking Cancel (should close modal without changes)
- Test pressing Escape (should close modal)

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Refresh Booking Data feature

- Add POST /api/admin/bookings/[id]/refresh endpoint
- Add RefreshBookingModal component
- Add Refresh Booking Data button to admin accordion
- Support preview and apply modes"
```

---

## Summary

| Task | Files | Description |
|------|-------|-------------|
| 1 | `src/app/api/admin/bookings/[id]/refresh/route.ts` | API endpoint for preview/apply |
| 2 | `src/components/admin/bookings/RefreshBookingModal.tsx` | Modal showing diff and warnings |
| 3 | `src/components/admin/bookings/BookingDetailsBreakdown.tsx` | Add button and integrate modal |
| 4 | - | Manual testing |

**Total new code:** ~300 lines across 2 new files + ~50 lines modified
