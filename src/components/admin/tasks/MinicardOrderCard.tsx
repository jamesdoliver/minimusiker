// src/components/admin/tasks/MinicardOrderCard.tsx

'use client';

import { useState } from 'react';
import { MinicardOrderEvent } from '@/lib/types/minicardOrders';

interface MinicardOrderCardProps {
  event: MinicardOrderEvent;
  onMarkComplete: (event: MinicardOrderEvent) => void;
  onCancel: (event: MinicardOrderEvent) => void;
}

export default function MinicardOrderCard({
  event,
  onMarkComplete,
  onCancel,
}: MinicardOrderCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate urgency styling
  const getUrgencyBadge = () => {
    if (event.is_overdue) {
      const daysOverdue = Math.abs(event.days_until_due);
      return {
        text: `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`,
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        borderColor: 'border-red-300',
      };
    }
    if (event.days_until_due === 0) {
      return {
        text: 'Due today',
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-800',
        borderColor: 'border-orange-300',
      };
    }
    return {
      text: `${event.days_until_due} day${event.days_until_due !== 1 ? 's' : ''}`,
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-700',
      borderColor: 'border-gray-200',
    };
  };

  const urgency = getUrgencyBadge();
  const cardBorderColor = event.is_overdue ? 'border-red-400' : 'border-gray-200';

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border-2 ${cardBorderColor} overflow-hidden`}>
      {/* Urgency Badge */}
      <div className={`px-4 py-2 ${urgency.bgColor} ${urgency.borderColor} border-b`}>
        <span className={`text-sm font-medium ${urgency.textColor}`}>
          {urgency.text}
        </span>
      </div>

      {/* Header Row (Always Visible) */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
        aria-expanded={isExpanded}
      >
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              {event.school_name}
            </h3>
            <span className="text-sm text-gray-500">
              Event: {formatDate(event.event_date)}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {event.total_minicard_count} Minicard{event.total_minicard_count !== 1 ? 's' : ''} from {event.total_orders} order{event.total_orders !== 1 ? 's' : ''}
          </p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 ml-4 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Expanded Content */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-h-[500px]' : 'max-h-0'
        }`}
      >
        <div className="px-4 pb-4 border-t border-gray-100">
          {/* Combination Breakdown */}
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 mb-2 border-b pb-1">
              Order Breakdown
            </h4>
            {event.combinations.map((combo) => (
              <div key={combo.label} className="flex justify-between text-sm">
                <span className="text-gray-600">
                  {combo.order_count}x
                </span>
                <span className="font-medium text-gray-900 text-right">
                  {combo.label}{' '}
                  <span className="font-normal text-gray-500">
                    ({combo.minicard_qty} minicard{combo.minicard_qty !== 1 ? 's' : ''})
                  </span>
                </span>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6">
            {event.r2_download_url ? (
              <a
                href={event.r2_download_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Printable
              </a>
            ) : (
              <div
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 border border-gray-200 rounded-lg flex items-center justify-center cursor-not-allowed"
                title="PDF not yet generated"
              >
                <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Printable
              </div>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCancel(event);
              }}
              className="px-4 py-2 text-sm font-medium text-red-600 bg-white border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Cancel Task
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkComplete(event);
              }}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-[#94B8B3] rounded-lg hover:bg-[#7da39e] transition-colors"
            >
              Mark Complete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
