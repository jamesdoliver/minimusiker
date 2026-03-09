'use client';

import { cn } from '@/lib/utils';
import OrderCard from './OrderCard';
import type { WaveOrder } from './OrderCard';

interface WelleColumnProps {
  title: string;
  orders: WaveOrder[];
  accentColor: 'teal' | 'amber';
  onWaveOverride?: (orderId: string, wave: string) => void;
}

const accentStyles = {
  teal: {
    border: 'border-t-teal-500',
    badge: 'bg-teal-100 text-teal-800',
  },
  amber: {
    border: 'border-t-amber-500',
    badge: 'bg-amber-100 text-amber-800',
  },
} as const;

export default function WelleColumn({
  title,
  orders,
  accentColor,
  onWaveOverride,
}: WelleColumnProps) {
  const styles = accentStyles[accentColor];

  return (
    <div
      className={cn(
        'flex flex-col bg-gray-50 rounded-lg border border-gray-200 border-t-4 overflow-hidden',
        styles.border,
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <span
          className={cn(
            'inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full text-xs font-semibold',
            styles.badge,
          )}
        >
          {orders.length}
        </span>
      </div>

      {/* Scrollable order list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '70vh' }}>
        {orders.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-gray-400">
            No orders in this wave
          </div>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.recordId}
              order={order}
              onWaveOverride={onWaveOverride}
            />
          ))
        )}
      </div>
    </div>
  );
}
