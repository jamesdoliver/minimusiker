# Master Calendar Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a collapsible month-view calendar to the top of the Leads page so salespeople can instantly see booking availability across regions during calls.

**Architecture:** Lightweight `/api/admin/calendar` endpoint fetches only calendar-relevant fields from Buchungen + Events + Personen tables for a given month. A `MasterCalendar` React component renders a CSS Grid month view with color-coded event-type dots. Clicking a dot opens a `BookingPopover` with booking details and a "View Booking" link.

**Tech Stack:** Next.js App Router, Airtable REST API, React, Tailwind CSS, CSS Grid

---

### Task 1: Add `CalendarEntry` type and `getCalendarBookings` method to Airtable service

**Files:**
- Modify: `src/lib/types/airtable.ts` (add type at end of file)
- Modify: `src/lib/services/airtableService.ts` (add method)

**Step 1: Add the CalendarEntry type**

In `src/lib/types/airtable.ts`, add at the end of the file (before the final closing, after the last type/interface):

```typescript
export interface CalendarEntry {
  bookingId: string;
  date: string; // YYYY-MM-DD
  schoolName: string;
  contactName: string;
  contactPhone?: string;
  regionId?: string;
  regionName?: string;
  staffNames: string[];
  eventType: 'Minimusikertag' | 'Plus' | 'Kita' | 'Schulsong';
  status: 'Confirmed' | 'On Hold' | 'Pending';
}
```

**Step 2: Add `getCalendarBookings` method to AirtableService**

In `src/lib/services/airtableService.ts`, add this method to the class (near the other booking-related methods like `getAllBookings`):

```typescript
/**
 * Fetch lightweight booking data for calendar display.
 * Queries Buchungen filtered by startDate within the given month,
 * then fetches linked Events for type flags and Personen for staff names.
 */
async getCalendarBookings(month: string): Promise<CalendarEntry[]> {
  try {
    // Parse month to get date range
    const [year, monthNum] = month.split('-').map(Number);
    const startOfMonth = `${year}-${String(monthNum).padStart(2, '0')}-01`;
    const endOfMonth = new Date(year, monthNum, 0); // Last day of month
    const endDateStr = `${year}-${String(monthNum).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;

    // Fetch bookings in date range
    const bookingRecords = await this.base(SCHOOL_BOOKINGS_TABLE_ID)
      .select({
        filterByFormula: `AND(
          {${SCHOOL_BOOKINGS_FIELD_IDS.start_date}} >= '${startOfMonth}',
          {${SCHOOL_BOOKINGS_FIELD_IDS.start_date}} <= '${endDateStr}',
          {${SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status}} != 'deleted'
        )`,
        fields: [
          SCHOOL_BOOKINGS_FIELD_IDS.start_date,
          SCHOOL_BOOKINGS_FIELD_IDS.school_name,
          SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name,
          SCHOOL_BOOKINGS_FIELD_IDS.school_phone,
          SCHOOL_BOOKINGS_FIELD_IDS.region,
          SCHOOL_BOOKINGS_FIELD_IDS.assigned_staff,
          SCHOOL_BOOKINGS_FIELD_IDS.simplybook_status,
        ],
        returnFieldsByFieldId: true,
      })
      .all();

    if (bookingRecords.length === 0) return [];

    // Collect all staff IDs and region IDs for batch lookup
    const allStaffIds = new Set<string>();
    const allRegionIds = new Set<string>();

    for (const record of bookingRecords) {
      const staffIds = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.assigned_staff] as string[] | undefined;
      staffIds?.forEach(id => allStaffIds.add(id));
      const regionIds = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.region] as string[] | undefined;
      if (regionIds?.[0]) allRegionIds.add(regionIds[0]);
    }

    // Batch fetch staff names
    const staffMap = new Map<string, string>();
    if (allStaffIds.size > 0) {
      const staffRecords = await this.base(PERSONEN_TABLE_ID)
        .select({
          filterByFormula: `OR(${[...allStaffIds].map(id => `RECORD_ID()='${id}'`).join(',')})`,
          fields: [PERSONEN_FIELD_IDS.staff_name],
          returnFieldsByFieldId: true,
        })
        .all();
      for (const r of staffRecords) {
        staffMap.set(r.id, r.fields[PERSONEN_FIELD_IDS.staff_name] as string);
      }
    }

    // Batch fetch region names
    const regionMap = new Map<string, string>();
    if (allRegionIds.size > 0) {
      const regionRecords = await this.base(TEAMS_REGIONEN_TABLE_ID)
        .select({
          filterByFormula: `OR(${[...allRegionIds].map(id => `RECORD_ID()='${id}'`).join(',')})`,
          fields: [TEAMS_REGIONEN_FIELD_IDS.name],
          returnFieldsByFieldId: true,
        })
        .all();
      for (const r of regionRecords) {
        regionMap.set(r.id, r.fields[TEAMS_REGIONEN_FIELD_IDS.name] as string);
      }
    }

    // Fetch all Events linked to these bookings to get event type flags and status
    // We need to check which Events have simplybook_booking linking to our booking IDs
    const bookingIds = bookingRecords.map(r => r.id);
    const eventRecords = await this.base(EVENTS_TABLE_ID)
      .select({
        fields: [
          EVENTS_FIELD_IDS.simplybook_booking,
          EVENTS_FIELD_IDS.status,
          EVENTS_FIELD_IDS.is_plus,
          EVENTS_FIELD_IDS.is_kita,
          EVENTS_FIELD_IDS.is_schulsong,
          EVENTS_FIELD_IDS.is_minimusikertag,
          EVENTS_FIELD_IDS.assigned_staff,
        ],
      })
      .all();

    // Build a map: bookingId -> event data
    const eventByBookingId = new Map<string, {
      status?: string;
      isPlus?: boolean;
      isKita?: boolean;
      isSchulsong?: boolean;
      isMinimusikertag?: boolean;
      assignedStaff?: string[];
    }>();
    for (const eventRecord of eventRecords) {
      const linkedBookings = eventRecord.get('simplybook_booking') as string[] | undefined;
      if (linkedBookings) {
        for (const bookingId of linkedBookings) {
          if (bookingIds.includes(bookingId)) {
            eventByBookingId.set(bookingId, {
              status: eventRecord.get('status') as string | undefined,
              isPlus: eventRecord.get('is_plus') as boolean | undefined,
              isKita: eventRecord.get('is_kita') as boolean | undefined,
              isSchulsong: eventRecord.get('is_schulsong') as boolean | undefined,
              isMinimusikertag: eventRecord.get('is_minimusikertag') as boolean | undefined,
              assignedStaff: eventRecord.get('assigned_staff') as string[] | undefined,
            });
          }
        }
      }
    }

    // Transform to CalendarEntry
    return bookingRecords.map(record => {
      const eventData = eventByBookingId.get(record.id);

      // Determine event type from flags
      let eventType: CalendarEntry['eventType'] = 'Minimusikertag';
      if (eventData?.isPlus) eventType = 'Plus';
      else if (eventData?.isKita) eventType = 'Kita';
      else if (eventData?.isSchulsong) eventType = 'Schulsong';

      // Determine status
      let status: CalendarEntry['status'] = 'Confirmed';
      const eventStatus = eventData?.status;
      if (eventStatus === 'On Hold') status = 'On Hold';
      else if (eventStatus === 'Pending') status = 'Pending';

      // Resolve staff names from Event's assigned_staff (preferred) or Booking's assigned_staff
      const staffIds = eventData?.assignedStaff || (record.fields[SCHOOL_BOOKINGS_FIELD_IDS.assigned_staff] as string[] | undefined);
      const staffNames = staffIds?.map(id => staffMap.get(id)).filter(Boolean) as string[] || [];

      const regionIds = record.fields[SCHOOL_BOOKINGS_FIELD_IDS.region] as string[] | undefined;
      const regionId = regionIds?.[0];

      return {
        bookingId: record.id,
        date: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.start_date] as string,
        schoolName: (record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_name] as string) ||
                    (record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name] as string) || 'Unknown',
        contactName: (record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_contact_name] as string) || '',
        contactPhone: record.fields[SCHOOL_BOOKINGS_FIELD_IDS.school_phone] as string | undefined,
        regionId,
        regionName: regionId ? regionMap.get(regionId) : undefined,
        staffNames,
        eventType,
        status,
      };
    });
  } catch (error) {
    console.error('Error fetching calendar bookings:', error);
    throw new Error(`Failed to fetch calendar bookings: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

**Step 3: Add import for CalendarEntry type**

Ensure `CalendarEntry` is imported in `airtableService.ts`. Add to the existing import from `@/lib/types/airtable`:

```typescript
import { ..., CalendarEntry } from '@/lib/types/airtable';
```

**Step 4: Build and verify no type errors**

Run: `cd /Users/jamesoliver/WebstormProjects/MiniMusiker && npx next build 2>&1 | head -50`
Expected: Build succeeds (no type errors from the new code)

**Step 5: Commit**

```bash
git add src/lib/types/airtable.ts src/lib/services/airtableService.ts
git commit -m "feat(calendar): add CalendarEntry type and getCalendarBookings service method"
```

---

### Task 2: Create `/api/admin/calendar` API endpoint

**Files:**
- Create: `src/app/api/admin/calendar/route.ts`

**Step 1: Create the calendar API route**

Create `src/app/api/admin/calendar/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSession } from '@/lib/auth/verifyAdminSession';
import { getAirtableService } from '@/lib/services/airtableService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const admin = verifyAdminSession(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json(
        { success: false, error: 'Valid month parameter required (YYYY-MM)' },
        { status: 400 }
      );
    }

    const airtableService = getAirtableService();
    const entries = await airtableService.getCalendarBookings(month);

    return NextResponse.json({ success: true, data: entries });
  } catch (error) {
    console.error('Error fetching calendar data:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch calendar data' },
      { status: 500 }
    );
  }
}
```

**Step 2: Build and verify**

Run: `cd /Users/jamesoliver/WebstormProjects/MiniMusiker && npx next build 2>&1 | head -50`
Expected: Build succeeds, new route compiles

**Step 3: Commit**

```bash
git add src/app/api/admin/calendar/route.ts
git commit -m "feat(calendar): add lightweight /api/admin/calendar endpoint"
```

---

### Task 3: Create BookingPopover component

**Files:**
- Create: `src/components/admin/leads/BookingPopover.tsx`

**Step 1: Create the BookingPopover component**

Create `src/components/admin/leads/BookingPopover.tsx`:

```typescript
'use client';

import { useEffect, useRef } from 'react';
import type { CalendarEntry } from '@/lib/types/airtable';

const EVENT_TYPE_COLORS: Record<CalendarEntry['eventType'], { bg: string; text: string }> = {
  Minimusikertag: { bg: 'bg-blue-100 text-blue-700', text: 'text-blue-600' },
  Plus: { bg: 'bg-purple-100 text-purple-700', text: 'text-purple-600' },
  Kita: { bg: 'bg-amber-100 text-amber-700', text: 'text-amber-600' },
  Schulsong: { bg: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-600' },
};

const STATUS_STYLES: Record<CalendarEntry['status'], string> = {
  Confirmed: 'bg-green-100 text-green-700',
  'On Hold': 'bg-yellow-100 text-yellow-700',
  Pending: 'bg-gray-100 text-gray-600',
};

interface BookingPopoverProps {
  entries: CalendarEntry[];
  anchorRect: DOMRect;
  onClose: () => void;
}

export default function BookingPopover({ entries, anchorRect, onClose }: BookingPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Position the popover below the anchor, centered horizontally
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.bottom + 8,
    left: Math.max(8, anchorRect.left + anchorRect.width / 2 - 160), // 160 = half of max-w-xs (320px)
    zIndex: 50,
    maxHeight: '60vh',
    overflowY: 'auto',
  };

  // If popover would go off bottom of screen, show above instead
  if (anchorRect.bottom + 300 > window.innerHeight) {
    style.top = undefined;
    (style as Record<string, unknown>).bottom = window.innerHeight - anchorRect.top + 8;
  }

  return (
    <div ref={popoverRef} style={style} className="w-80 bg-white rounded-lg shadow-xl border border-gray-200 p-3 space-y-3">
      {entries.map((entry) => {
        const typeColor = EVENT_TYPE_COLORS[entry.eventType];
        const statusStyle = STATUS_STYLES[entry.status];

        return (
          <div key={entry.bookingId} className={entries.length > 1 ? 'pb-3 border-b border-gray-100 last:border-0 last:pb-0' : ''}>
            <p className="font-semibold text-gray-900 text-sm">{entry.schoolName}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {entry.regionName || 'No region'}{entry.staffNames.length > 0 ? ` · ${entry.staffNames.join(', ')}` : ''}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${typeColor.bg}`}>
                {entry.eventType}
              </span>
              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${statusStyle}`}>
                {entry.status}
              </span>
            </div>
            {entry.contactName && (
              <p className="text-xs text-gray-600 mt-1.5">
                Contact: {entry.contactName}
              </p>
            )}
            {entry.contactPhone && (
              <p className="text-xs text-gray-600">
                Phone: <a href={`tel:${entry.contactPhone}`} className="text-blue-600 hover:underline">{entry.contactPhone}</a>
              </p>
            )}
            <a
              href="/admin/bookings"
              className="inline-block mt-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              View Booking →
            </a>
          </div>
        );
      })}
    </div>
  );
}
```

**Step 2: Build and verify**

Run: `cd /Users/jamesoliver/WebstormProjects/MiniMusiker && npx next build 2>&1 | head -50`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/admin/leads/BookingPopover.tsx
git commit -m "feat(calendar): add BookingPopover component for booking details on click"
```

---

### Task 4: Create MasterCalendar component

**Files:**
- Create: `src/components/admin/leads/MasterCalendar.tsx`

**Step 1: Create the MasterCalendar component**

Create `src/components/admin/leads/MasterCalendar.tsx`:

```typescript
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { CalendarEntry } from '@/lib/types/airtable';
import BookingPopover from './BookingPopover';

interface RegionOption {
  id: string;
  name: string;
}

interface MasterCalendarProps {
  regions: RegionOption[];
  refreshTrigger?: number; // Increment to force calendar refresh
}

const EVENT_TYPE_DOT_STYLES: Record<CalendarEntry['eventType'], { solid: string; dashed: string; label: string }> = {
  Minimusikertag: { solid: 'bg-blue-500 text-white', dashed: 'border-2 border-dashed border-blue-500 text-blue-500', label: 'M' },
  Plus: { solid: 'bg-purple-500 text-white', dashed: 'border-2 border-dashed border-purple-500 text-purple-500', label: '+' },
  Kita: { solid: 'bg-amber-500 text-white', dashed: 'border-2 border-dashed border-amber-500 text-amber-500', label: 'K' },
  Schulsong: { solid: 'bg-emerald-500 text-white', dashed: 'border-2 border-dashed border-emerald-500 text-emerald-500', label: 'S' },
};

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const COLLAPSE_KEY = 'masterCalendarCollapsed';

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function MasterCalendar({ regions, refreshTrigger }: MasterCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(COLLAPSE_KEY) === 'true';
    }
    return false;
  });
  const [selectedRegion, setSelectedRegion] = useState('all');
  const [entries, setEntries] = useState<Map<string, CalendarEntry[]>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [popover, setPopover] = useState<{ entries: CalendarEntry[]; rect: DOMRect } | null>(null);

  // Cache for pre-fetched months
  const cache = useRef<Map<string, CalendarEntry[]>>(new Map());

  const currentMonthKey = getMonthKey(currentDate);

  const fetchMonth = useCallback(async (monthKey: string, skipCache = false) => {
    if (!skipCache && cache.current.has(monthKey)) return cache.current.get(monthKey)!;

    const response = await fetch(`/api/admin/calendar?month=${monthKey}`, { credentials: 'include' });
    const data = await response.json();
    if (data.success) {
      cache.current.set(monthKey, data.data);
      return data.data as CalendarEntry[];
    }
    return [];
  }, []);

  // Fetch current month + prefetch adjacent months
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const current = await fetchMonth(currentMonthKey);
        if (cancelled) return;

        // Group by date
        const grouped = new Map<string, CalendarEntry[]>();
        for (const entry of current) {
          const existing = grouped.get(entry.date) || [];
          existing.push(entry);
          grouped.set(entry.date, existing);
        }
        setEntries(grouped);

        // Prefetch adjacent months in background
        const prevMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        fetchMonth(getMonthKey(prevMonth));
        fetchMonth(getMonthKey(nextMonth));
      } catch (err) {
        console.error('Failed to load calendar:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [currentMonthKey, fetchMonth, currentDate]);

  // Refresh when refreshTrigger changes (e.g., after booking creation)
  useEffect(() => {
    if (refreshTrigger === undefined || refreshTrigger === 0) return;
    cache.current.clear();
    fetchMonth(currentMonthKey, true).then(current => {
      const grouped = new Map<string, CalendarEntry[]>();
      for (const entry of current) {
        const existing = grouped.get(entry.date) || [];
        existing.push(entry);
        grouped.set(entry.date, existing);
      }
      setEntries(grouped);
    });
  }, [refreshTrigger, currentMonthKey, fetchMonth]);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, String(next));
      return next;
    });
  };

  const navigateMonth = (delta: number) => {
    setPopover(null);
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  };

  // Build calendar grid
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Monday = 0, Sunday = 6 (ISO week)
  let startDay = firstDayOfMonth.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const handleDotClick = (dayEntries: CalendarEntry[], e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ entries: dayEntries, rect });
  };

  const handleDateClick = (dayEntries: CalendarEntry[], e: React.MouseEvent) => {
    if (dayEntries.length === 0) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPopover({ entries: dayEntries, rect });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <h3 className="text-sm font-semibold text-gray-800 min-w-[140px] text-center">
            {MONTH_NAMES[month]} {year}
          </h3>
          <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white text-gray-700"
          >
            <option value="all">All Regions</option>
            {regions.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          <button onClick={toggleCollapse} className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700">
            <svg className={`w-4 h-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Calendar body */}
      {!isCollapsed && (
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-400">Loading...</div>
          ) : (
            <div className="grid grid-cols-7 gap-px">
              {/* Day headers */}
              {DAY_NAMES.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-400 pb-2">{day}</div>
              ))}

              {/* Empty cells before first day */}
              {Array.from({ length: startDay }, (_, i) => (
                <div key={`empty-${i}`} className="h-12" />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }, (_, i) => {
                const dayNum = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isToday = dateStr === todayStr;
                const isPast = dateStr < todayStr;
                const isWeekend = ((startDay + i) % 7) >= 5;

                let dayEntries = entries.get(dateStr) || [];

                // Filter by region if selected
                if (selectedRegion !== 'all') {
                  dayEntries = dayEntries.filter(e => e.regionId === selectedRegion);
                }

                const maxDots = 3;
                const visibleEntries = dayEntries.slice(0, maxDots);
                const overflow = dayEntries.length - maxDots;

                return (
                  <div
                    key={dayNum}
                    onClick={(e) => handleDateClick(dayEntries, e)}
                    className={`h-12 rounded-md flex flex-col items-center pt-1 transition-colors
                      ${dayEntries.length > 0 ? 'cursor-pointer hover:bg-gray-50' : ''}
                      ${isToday ? 'ring-2 ring-blue-400 ring-inset' : ''}
                      ${isPast ? 'opacity-50' : ''}
                      ${isWeekend ? 'bg-gray-50/50' : ''}
                    `}
                  >
                    <span className={`text-xs ${isToday ? 'font-bold text-blue-600' : 'text-gray-700'}`}>
                      {dayNum}
                    </span>

                    {dayEntries.length > 0 && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {visibleEntries.map((entry) => {
                          const dotStyle = EVENT_TYPE_DOT_STYLES[entry.eventType];
                          const isSolid = entry.status === 'Confirmed';
                          return (
                            <button
                              key={entry.bookingId}
                              onClick={(e) => handleDotClick([entry], e)}
                              className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold leading-none
                                ${isSolid ? dotStyle.solid : dotStyle.dashed}
                              `}
                              title={`${entry.schoolName} (${entry.eventType})`}
                            >
                              {dotStyle.label}
                            </button>
                          );
                        })}
                        {overflow > 0 && (
                          <span className="text-[9px] text-gray-400 font-medium">+{overflow}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Popover */}
      {popover && (
        <BookingPopover
          entries={popover.entries}
          anchorRect={popover.rect}
          onClose={() => setPopover(null)}
        />
      )}
    </div>
  );
}
```

**Step 2: Build and verify**

Run: `cd /Users/jamesoliver/WebstormProjects/MiniMusiker && npx next build 2>&1 | head -50`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add src/components/admin/leads/MasterCalendar.tsx
git commit -m "feat(calendar): add MasterCalendar component with month grid and region filter"
```

---

### Task 5: Integrate MasterCalendar into the Leads page

**Files:**
- Modify: `src/app/admin/leads/page.tsx`

**Step 1: Add import**

In `src/app/admin/leads/page.tsx`, add after the existing imports (around line 10):

```typescript
import MasterCalendar from '@/components/admin/leads/MasterCalendar';
```

**Step 2: Add refresh trigger state**

Add a new state variable after `bookingPrefillData` (around line 50):

```typescript
const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);
```

**Step 3: Add MasterCalendar to the JSX**

Insert the `MasterCalendar` component between the header section and the filter panel. The header `</div>` is around line 333. Insert right after it, before the filter panel `<div>`:

```tsx
{/* Master Calendar */}
<MasterCalendar regions={regionList} refreshTrigger={calendarRefreshTrigger} />
```

**Step 4: Trigger calendar refresh on booking creation**

In the `CreateBookingModal` `onSuccess` callback (around line 502), add a calendar refresh trigger increment:

Change:
```typescript
onSuccess={() => {
  setShowBookingModal(false);
  setBookingPrefillData(undefined);
  fetchLeads();
  toast.success('Lead converted to booking!');
}}
```

To:
```typescript
onSuccess={() => {
  setShowBookingModal(false);
  setBookingPrefillData(undefined);
  fetchLeads();
  setCalendarRefreshTrigger(prev => prev + 1);
  toast.success('Lead converted to booking!');
}}
```

**Step 5: Build and verify**

Run: `cd /Users/jamesoliver/WebstormProjects/MiniMusiker && npx next build 2>&1 | head -50`
Expected: Build succeeds with no errors

**Step 6: Commit**

```bash
git add src/app/admin/leads/page.tsx
git commit -m "feat(calendar): integrate MasterCalendar into Leads page with refresh on booking creation"
```

---

### Task 6: Manual testing and final verification

**Step 1: Start dev server**

Run: `cd /Users/jamesoliver/WebstormProjects/MiniMusiker && npm run dev`

**Step 2: Test in browser**

Navigate to `/admin/leads` and verify:

1. Calendar appears at top of page, showing current month
2. Navigation arrows move between months
3. Booking dots appear on correct dates with correct colors
4. Region filter dropdown filters dots by region
5. Clicking a dot shows popover with booking details
6. Popover closes on click-outside and Escape
7. Collapse button hides/shows calendar, state persists on refresh
8. "View Booking" link in popover navigates to bookings page

**Step 3: Test edge cases**

1. Month with no bookings shows empty calendar
2. Multiple bookings on same date show stacked dots with overflow "+N"
3. Today's date has blue ring highlight
4. Past dates are dimmed
5. Dashed dots appear for On Hold / Pending bookings

**Step 4: Final build check**

Run: `cd /Users/jamesoliver/WebstormProjects/MiniMusiker && npx next build`
Expected: Clean build, no warnings
