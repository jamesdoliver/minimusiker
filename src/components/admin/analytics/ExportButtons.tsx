'use client';

import { EventAnalyticsRow } from '@/lib/types/analytics';

interface ExportButtonsProps {
  data: EventAnalyticsRow[];
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

function generateCSV(data: EventAnalyticsRow[]): string {
  const headers = [
    'Event Name',
    'Event Date',
    'Total Revenue (€)',
    'AOV (€)',
    'Incurred Cost (€)',
    'Profit (€)',
    'Status',
    'Registration %',
    'Registered Children',
    'Total Children',
    'Fixed Costs - Team Member (€)',
    'Fixed Costs - Mixing (€)',
    'Fixed Costs - Stickers (€)',
    'Fixed Costs - Poster (€)',
    'Variable Costs Total (€)',
  ];

  const rows = data.map((row) => [
    row.schoolName,
    formatDate(row.eventDate),
    row.totalRevenue.toFixed(2),
    row.aov.toFixed(2),
    row.incurredCost.toFixed(2),
    row.profit.toFixed(2),
    row.status,
    row.registrationPercent.toFixed(1),
    row.registeredChildren,
    row.totalChildren,
    row.costs.fixed.teamMember.toFixed(2),
    row.costs.fixed.mixing.toFixed(2),
    row.costs.fixed.stickers.toFixed(2),
    row.costs.fixed.poster.toFixed(2),
    row.costs.variableTotal.toFixed(2),
  ]);

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const cellStr = String(cell);
          // Escape quotes and wrap in quotes if contains comma or quote
          if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(',')
    )
    .join('\n');

  return csvContent;
}

function downloadCSV(data: EventAnalyticsRow[]) {
  const csv = generateCSV(data);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `event-analytics-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function printPDF() {
  window.print();
}

export default function ExportButtons({ data }: ExportButtonsProps) {
  return (
    <div className="flex gap-3">
      <button
        onClick={() => downloadCSV(data)}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#94B8B3] transition-colors"
        title="Export to CSV"
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        Export CSV
      </button>
      <button
        onClick={printPDF}
        className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#94B8B3] transition-colors"
        title="Print / Save as PDF"
      >
        <svg
          className="w-4 h-4 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
          />
        </svg>
        Print PDF
      </button>
    </div>
  );
}
