'use client';

import { useState, useMemo } from 'react';

interface Booking {
  date: string; // YYYY-MM-DD format
  schoolName: string;
}

interface StaffCalendarViewProps {
  bookings: Booking[];
  currentEventDate: string | null; // YYYY-MM-DD format
  selectedDate: string | null; // YYYY-MM-DD format
  onDateSelect: (date: string) => void;
  onBlockedDateClick: (date: string, schoolName: string) => void;
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function StaffCalendarView({
  bookings,
  currentEventDate,
  selectedDate,
  onDateSelect,
  onBlockedDateClick,
}: StaffCalendarViewProps) {
  // Initialize to show the month of the current event date or today
  const initialDate = currentEventDate ? new Date(currentEventDate) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Create a Set of booked dates for quick lookup
  const bookingsByDate = useMemo(() => {
    const map = new Map<string, string>();
    bookings.forEach((b) => {
      map.set(b.date, b.schoolName);
    });
    return map;
  }, [bookings]);

  // Generate calendar grid for the current month
  const calendarDays = useMemo(() => {
    const days: Array<{ date: Date | null; dateStr: string }> = [];

    // First day of the month
    const firstDay = new Date(viewYear, viewMonth, 1);
    // Get day of week (0 = Sunday, convert to Monday-based)
    let startDayOfWeek = firstDay.getDay();
    // Convert Sunday (0) to 7, so Monday is 1
    startDayOfWeek = startDayOfWeek === 0 ? 7 : startDayOfWeek;
    // Offset for Monday-based week (Monday = 0)
    const offset = startDayOfWeek - 1;

    // Add empty cells for days before the first
    for (let i = 0; i < offset; i++) {
      days.push({ date: null, dateStr: '' });
    }

    // Add all days of the month
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(viewYear, viewMonth, d);
      const dateStr = formatDateStr(date);
      days.push({ date, dateStr });
    }

    return days;
  }, [viewYear, viewMonth]);

  // Navigate to previous month
  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  // Navigate to next month
  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Handle date click
  const handleDateClick = (dateStr: string) => {
    if (!dateStr) return;

    const schoolName = bookingsByDate.get(dateStr);
    if (schoolName) {
      // Date is blocked - notify parent
      onBlockedDateClick(dateStr, schoolName);
    } else {
      // Date is available
      onDateSelect(dateStr);
    }
  };

  // Format date to YYYY-MM-DD
  function formatDateStr(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Check if date is in the past
  function isPastDate(dateStr: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(dateStr);
    return checkDate < today;
  }

  // Check if date is today
  function isToday(dateStr: string): boolean {
    const today = new Date();
    return formatDateStr(today) === dateStr;
  }

  return (
    <div className="flex-1">
      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h3 className="text-lg font-semibold text-gray-900">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </h3>
        <button
          onClick={goToNextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Next month"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, index) => {
          if (!day.date) {
            return <div key={`empty-${index}`} className="h-10" />;
          }

          const isCurrentEvent = day.dateStr === currentEventDate;
          const isSelected = day.dateStr === selectedDate;
          const hasBooking = bookingsByDate.has(day.dateStr);
          const isPast = isPastDate(day.dateStr);
          const isTodayDate = isToday(day.dateStr);

          return (
            <button
              key={day.dateStr}
              onClick={() => !isPast && handleDateClick(day.dateStr)}
              disabled={isPast}
              className={`
                relative h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors
                ${isPast
                  ? 'text-gray-300 cursor-not-allowed'
                  : isCurrentEvent
                    ? 'bg-blue-600 text-white'
                    : isSelected
                      ? 'bg-green-600 text-white'
                      : hasBooking
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'text-gray-700 hover:bg-gray-100'
                }
                ${isTodayDate && !isCurrentEvent && !isSelected ? 'ring-2 ring-blue-300 ring-inset' : ''}
              `}
            >
              {day.date.getDate()}
              {/* Booking indicator dot */}
              {hasBooking && !isCurrentEvent && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-orange-500 rounded-full" />
              )}
              {/* Current event indicator */}
              {isCurrentEvent && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-300 rounded-full" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200 flex flex-wrap gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-orange-500 rounded-full" />
          <span>Staff has booking</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-blue-600 rounded-full" />
          <span>Current event date</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-green-600 rounded-full" />
          <span>Selected new date</span>
        </div>
      </div>
    </div>
  );
}
