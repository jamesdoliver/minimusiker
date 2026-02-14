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
    left: Math.max(8, anchorRect.left + anchorRect.width / 2 - 160),
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
