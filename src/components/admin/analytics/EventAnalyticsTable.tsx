'use client';

import { useState, Fragment, useCallback } from 'react';
import { EventAnalyticsRow } from '@/lib/types/analytics';
import StatusBadge from './StatusBadge';
import EventBreakdown from './EventBreakdown';

interface EventAnalyticsTableProps {
  data: EventAnalyticsRow[];
  onRefresh?: () => void;
}

function formatCurrency(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

function formatDate(dateString: string): string {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${
        isOpen ? 'rotate-180' : ''
      }`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function EventAnalyticsTable({ data, onRefresh }: EventAnalyticsTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const handleManualCostChange = useCallback(() => {
    // Trigger parent refresh to update totals
    onRefresh?.();
  }, [onRefresh]);

  const toggleRow = (eventId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-4xl mb-4">📊</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No events to display</h3>
        <p className="text-gray-600">Events will appear here once created.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-10 px-4 py-3"></th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Event Name
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Revenue
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                AOV
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Incurred Cost
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Profit
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registration %
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, index) => {
              const isExpanded = expandedRows.has(row.eventId);
              const isEven = index % 2 === 0;

              return (
                <Fragment key={row.eventId}>
                  <tr
                    className={`cursor-pointer hover:bg-gray-100 transition-colors ${
                      isEven ? 'bg-white' : 'bg-gray-50'
                    } ${isExpanded ? 'bg-blue-50 hover:bg-blue-50' : ''}`}
                    onClick={() => toggleRow(row.eventId)}
                  >
                    <td className="px-4 py-4">
                      <ChevronIcon isOpen={isExpanded} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{row.schoolName}</div>
                      <div className="text-xs text-gray-500">{formatDate(row.eventDate)}</div>
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      {formatCurrency(row.totalRevenue)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      {formatCurrency(row.aov)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-900">
                      {formatCurrency(row.incurredCost)}
                    </td>
                    <td
                      className={`px-6 py-4 text-right text-sm font-medium ${
                        row.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {row.profit >= 0 ? '+' : ''}
                      {formatCurrency(row.profit)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-[#94B8B3] h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(row.registrationPercent, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-900 w-12 text-right">
                          {row.registrationPercent.toFixed(0)}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {row.registeredChildren}/{row.totalChildren} children
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <div
                          className="overflow-hidden transition-all duration-300 ease-in-out"
                          style={{ maxHeight: isExpanded ? '1000px' : '0' }}
                        >
                          <EventBreakdown
                            eventId={row.eventId}
                            revenue={row.revenue}
                            costs={row.costs}
                            onManualCostChange={handleManualCostChange}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
