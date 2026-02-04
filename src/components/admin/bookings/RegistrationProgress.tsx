interface RegistrationProgressProps {
  registered: number;
  estimated: number | undefined;
}

export function RegistrationProgress({ registered, estimated }: RegistrationProgressProps) {
  // Edge case: no estimate available
  if (!estimated || estimated === 0) {
    return <span className="text-sm text-gray-400">-</span>;
  }

  const percentage = Math.round((registered / estimated) * 100);

  // Determine color based on thresholds
  let colorClass = 'text-green-600'; // 70%+
  if (percentage < 40) {
    colorClass = 'text-red-600';
  } else if (percentage < 60) {
    colorClass = 'text-orange-500';
  } else if (percentage < 70) {
    colorClass = 'text-yellow-600';
  }

  return (
    <span className={`text-sm font-medium ${colorClass}`}>
      {registered}/{estimated} ({percentage}%)
    </span>
  );
}
