'use client';

type BookingStatus = 'confirmed' | 'hold' | 'no_region' | 'pending' | 'cancelled';

interface BookingStatusBadgeProps {
  status: BookingStatus;
}

const statusConfig: Record<BookingStatus, { label: string; className: string }> = {
  confirmed: {
    label: 'Confirmed',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  hold: {
    label: 'Hold',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
  },
  no_region: {
    label: 'NO REGION',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  pending: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  },
};

export default function BookingStatusBadge({ status }: BookingStatusBadgeProps) {
  const config = statusConfig[status] || {
    label: status || 'Unknown',
    className: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  );
}
