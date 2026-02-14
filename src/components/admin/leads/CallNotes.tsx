'use client';

import { useState } from 'react';
import type { CallNote } from '@/lib/types/airtable';

interface CallNotesProps {
  callNotes: CallNote[];
  onChange: (notes: CallNote[]) => void;
  readOnly?: boolean;
}

export default function CallNotes({ callNotes, onChange, readOnly = false }: CallNotesProps) {
  // Older calls (all except last two) start collapsed
  const [expandedCalls, setExpandedCalls] = useState<Set<number>>(() => {
    const lastTwo = new Set<number>();
    if (callNotes.length > 0) lastTwo.add(callNotes[callNotes.length - 1].callNumber);
    if (callNotes.length > 1) lastTwo.add(callNotes[callNotes.length - 2].callNumber);
    return lastTwo;
  });

  const toggleCall = (callNumber: number) => {
    setExpandedCalls(prev => {
      const next = new Set(prev);
      if (next.has(callNumber)) {
        next.delete(callNumber);
      } else {
        next.add(callNumber);
      }
      return next;
    });
  };

  const handleDateChange = (index: number, date: string) => {
    const updated = [...callNotes];
    updated[index] = { ...updated[index], date };
    onChange(updated);
  };

  const handleNotesChange = (index: number, notes: string) => {
    const updated = [...callNotes];
    updated[index] = { ...updated[index], notes };
    onChange(updated);
  };

  const addCall = () => {
    const nextNumber = callNotes.length > 0 ? Math.max(...callNotes.map(c => c.callNumber)) + 1 : 1;
    const newNote: CallNote = {
      callNumber: nextNumber,
      date: new Date().toISOString().split('T')[0],
      notes: '',
    };
    const updated = [...callNotes, newNote];
    // Auto-expand the new call
    setExpandedCalls(prev => new Set([...prev, nextNumber]));
    onChange(updated);
  };

  const isExpanded = (callNumber: number) => {
    if (readOnly) return true;
    // Last two are always expanded
    const lastTwo = callNotes.slice(-2).map(c => c.callNumber);
    return lastTwo.includes(callNumber) || expandedCalls.has(callNumber);
  };

  const truncate = (text: string, length: number) => {
    if (text.length <= length) return text;
    return text.substring(0, length) + '...';
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Call Notes</h4>

      {callNotes.map((call, index) => (
        <div key={call.callNumber} className="border border-gray-200 rounded-lg">
          {isExpanded(call.callNumber) ? (
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">Call {call.callNumber}</span>
                {!readOnly && callNotes.length > 2 && index < callNotes.length - 2 && (
                  <button
                    onClick={() => toggleCall(call.callNumber)}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Collapse
                  </button>
                )}
              </div>
              {readOnly ? (
                <div className="text-xs text-gray-500">{call.date}</div>
              ) : (
                <input
                  type="date"
                  value={call.date}
                  onChange={(e) => handleDateChange(index, e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              )}
              {readOnly ? (
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{call.notes}</p>
              ) : (
                <textarea
                  value={call.notes}
                  onChange={(e) => handleNotesChange(index, e.target.value)}
                  rows={3}
                  className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Enter call notes..."
                />
              )}
            </div>
          ) : (
            <button
              onClick={() => toggleCall(call.callNumber)}
              className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 rounded-lg"
            >
              <span className="font-medium text-gray-700">Call {call.callNumber}</span>
              <span className="mx-2 text-gray-300">|</span>
              <span className="text-xs">{call.date}</span>
              <span className="mx-2 text-gray-300">|</span>
              <span className="text-xs">{truncate(call.notes, 50)}</span>
            </button>
          )}
        </div>
      ))}

      {!readOnly && (
        <button
          onClick={addCall}
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors"
        >
          + Add Call
        </button>
      )}
    </div>
  );
}
