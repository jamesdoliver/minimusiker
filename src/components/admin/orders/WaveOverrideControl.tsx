'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const WAVE_OPTIONS = ['Welle 1', 'Welle 2', 'Both', 'Rolling'] as const;
type WaveOption = (typeof WAVE_OPTIONS)[number];

interface WaveOverrideControlProps {
  currentWave: string;
  orderId: string;
  onOverride: (newWave: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function WaveOverrideControl({
  currentWave,
  orderId,
  onOverride,
}: WaveOverrideControlProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newWave = e.target.value as WaveOption;
    if (newWave === currentWave) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/wave`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ shipment_wave: newWave }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        throw new Error(data.error || `Failed to update wave (${res.status})`);
      }

      toast.success(`Wave updated to ${newWave}`);
      onOverride(newWave);
    } catch (err) {
      console.error('Error overriding wave:', err);
      const message = err instanceof Error ? err.message : 'Failed to update wave';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-2">
      <div className="relative">
        <select
          value={currentWave}
          onChange={handleChange}
          disabled={isLoading}
          className={cn(
            'appearance-none rounded-md border border-gray-300 bg-white py-1 pl-2.5 pr-7 text-sm font-medium text-gray-700',
            'hover:border-gray-400 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error && 'border-red-300 focus:border-red-500 focus:ring-red-500',
          )}
        >
          {WAVE_OPTIONS.map((wave) => (
            <option key={wave} value={wave}>
              {wave}
            </option>
          ))}
        </select>

        {/* Dropdown chevron */}
        {!isLoading && (
          <svg
            className="pointer-events-none absolute right-1.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}

        {/* Loading spinner overlay */}
        {isLoading && (
          <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-teal-600" />
          </div>
        )}
      </div>

      {/* Inline error */}
      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  );
}
