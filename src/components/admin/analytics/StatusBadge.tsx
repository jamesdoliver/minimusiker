import { EventStatus } from '@/lib/types/analytics';

interface StatusBadgeProps {
  status: EventStatus;
}

const statusConfig: Record<EventStatus, { label: string; className: string }> = {
  'eight-weeks': {
    label: '-8 Weeks',
    className: 'text-red-600 font-medium',
  },
  'four-weeks': {
    label: '-4 Weeks',
    className: 'text-orange-500 font-medium',
  },
  'two-weeks': {
    label: '-2 Weeks',
    className: 'text-yellow-600 font-medium',
  },
  'event-day': {
    label: 'Event Day',
    className: 'text-green-600 font-medium',
  },
  'one-week-after': {
    label: '+1 Week',
    className: 'text-blue-500 font-medium',
  },
  archived: {
    label: 'Archive',
    className: 'text-gray-500 font-medium',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span className={`text-sm ${config.className}`}>
      {config.label}
    </span>
  );
}
