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
  refreshTrigger?: number;
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const current = await fetchMonth(currentMonthKey);
        if (cancelled) return;

        const grouped = new Map<string, CalendarEntry[]>();
        for (const entry of current) {
          const existing = grouped.get(entry.date) || [];
          existing.push(entry);
          grouped.set(entry.date, existing);
        }
        setEntries(grouped);

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

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

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

      {!isCollapsed && (
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-gray-400">Loading...</div>
          ) : (
            <div className="grid grid-cols-7 gap-px">
              {DAY_NAMES.map(day => (
                <div key={day} className="text-center text-xs font-medium text-gray-400 pb-2">{day}</div>
              ))}

              {Array.from({ length: startDay }, (_, i) => (
                <div key={`empty-${i}`} className="h-12" />
              ))}

              {Array.from({ length: daysInMonth }, (_, i) => {
                const dayNum = i + 1;
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isToday = dateStr === todayStr;
                const isPast = dateStr < todayStr;
                const isWeekend = ((startDay + i) % 7) >= 5;

                let dayEntries = entries.get(dateStr) || [];

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
