'use client';

export type DateFilterOption = 'all' | 'this-week' | 'this-month' | 'next-30-days';

interface EventDateFilterProps {
  value: DateFilterOption;
  onChange: (value: DateFilterOption) => void;
}

const options: { value: DateFilterOption; label: string }[] = [
  { value: 'all', label: 'All dates' },
  { value: 'this-week', label: 'This week' },
  { value: 'this-month', label: 'This month' },
  { value: 'next-30-days', label: 'Next 30 days' },
];

export default function EventDateFilter({ value, onChange }: EventDateFilterProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as DateFilterOption)}
      className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#94B8B3]/50 focus:border-[#94B8B3] cursor-pointer"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
