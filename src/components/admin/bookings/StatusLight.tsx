/**
 * StatusLight Component
 *
 * Simple component showing a colored circle with a label.
 * Grey when incomplete, green when complete.
 */

interface StatusLightProps {
  label: string;
  isComplete: boolean;
}

export default function StatusLight({ label, isComplete }: StatusLightProps) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-3 h-3 rounded-full transition-colors ${
          isComplete ? 'bg-green-500' : 'bg-gray-300'
        }`}
      />
      <span className="text-sm text-gray-600">{label}</span>
    </div>
  );
}
