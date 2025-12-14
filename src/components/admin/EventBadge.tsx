interface EventBadgeProps {
  type: string;
  size?: 'sm' | 'md';
}

const typeColors: Record<string, string> = {
  minimusiker: 'bg-[#94B8B3]/20 text-[#5a8a82]',
  schulsong: 'bg-amber-100 text-amber-800',
  concert: 'bg-purple-100 text-purple-800',
  recital: 'bg-blue-100 text-blue-800',
  default: 'bg-gray-100 text-gray-700',
};

export default function EventBadge({ type, size = 'sm' }: EventBadgeProps) {
  const normalizedType = type?.toLowerCase() || 'default';
  const colorClass = typeColors[normalizedType] || typeColors.default;

  const sizeClass = size === 'sm'
    ? 'px-2.5 py-0.5 text-xs'
    : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold capitalize ${colorClass} ${sizeClass}`}
    >
      {type || 'Event'}
    </span>
  );
}
