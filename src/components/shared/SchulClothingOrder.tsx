'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { SchulClothingOrder as SchulClothingOrderType } from '@/lib/types/airtable';

interface SchulClothingOrderProps {
  eventId: string;
  apiBasePath: string; // '/api/admin/events' or '/api/teacher/events'
  readOnly?: boolean;
  maxQuantity?: number; // 250 or 500 based on estimated children
}

const SIZE_ROWS = [
  { key: 'size_98_104' as const, label: '98/104', age: '3-4 Jahre' },
  { key: 'size_110_116' as const, label: '110/116', age: '5-6 Jahre' },
  { key: 'size_122_128' as const, label: '122/128', age: '7-8 Jahre' },
  { key: 'size_134_146' as const, label: '134/146', age: '9-11 Jahre' },
  { key: 'size_152_164' as const, label: '152/164', age: '12-14 Jahre' },
] as const;

type SizeKey = typeof SIZE_ROWS[number]['key'];

export default function SchulClothingOrder({
  eventId,
  apiBasePath,
  readOnly = false,
  maxQuantity = 250,
}: SchulClothingOrderProps) {
  const [order, setOrder] = useState<SchulClothingOrderType | null>(null);
  const [sizes, setSizes] = useState<Record<SizeKey, number>>({
    size_98_104: 0,
    size_110_116: 0,
    size_122_128: 0,
    size_134_146: 0,
    size_152_164: 0,
  });
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const total = Object.values(sizes).reduce((sum, v) => sum + v, 0);
  const isOverLimit = total > maxQuantity;

  useEffect(() => {
    fetchOrder();
  }, [eventId]);

  async function fetchOrder() {
    try {
      const response = await fetch(
        `${apiBasePath}/${encodeURIComponent(eventId)}/clothing-order`
      );
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      if (data.data) {
        setOrder(data.data);
        setSizes({
          size_98_104: data.data.size_98_104 || 0,
          size_110_116: data.data.size_110_116 || 0,
          size_122_128: data.data.size_122_128 || 0,
          size_134_146: data.data.size_134_146 || 0,
          size_152_164: data.data.size_152_164 || 0,
        });
        setNotes(data.data.notes || '');
      }
    } catch (err) {
      console.error('Error fetching clothing order:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (isOverLimit) {
      toast.error(`Total exceeds maximum of ${maxQuantity}`);
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(
        `${apiBasePath}/${encodeURIComponent(eventId)}/clothing-order`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...sizes, notes }),
        }
      );
      if (!response.ok) throw new Error('Failed to save');
      const data = await response.json();
      setOrder(data.data);
      toast.success('T-Shirt order saved');
    } catch (err) {
      toast.error('Failed to save order');
    } finally {
      setIsSaving(false);
    }
  }

  function updateSize(key: SizeKey, value: number) {
    setSizes(prev => ({ ...prev, [key]: Math.max(0, value) }));
  }

  if (isLoading) {
    return (
      <div className="border border-gray-200 rounded-lg bg-white p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-8 bg-gray-200 rounded" />
          <div className="h-8 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-800">Schul-T-Shirt Bestellung</h3>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="space-y-2">
          {SIZE_ROWS.map(({ key, label, age }) => (
            <div key={key} className="flex items-center gap-3">
              <div className="w-20 text-sm font-medium text-gray-700">{label}</div>
              <div className="text-xs text-gray-500 w-20">({age})</div>
              <input
                type="number"
                min={0}
                value={sizes[key]}
                onChange={(e) => updateSize(key, parseInt(e.target.value) || 0)}
                disabled={readOnly || isSaving}
                className="w-20 rounded-md border-gray-300 shadow-sm text-sm text-center focus:border-orange-500 focus:ring-orange-500 disabled:opacity-50"
              />
            </div>
          ))}
        </div>

        {/* Total */}
        <div className={`flex items-center gap-2 text-sm font-semibold pt-2 border-t border-gray-100 ${isOverLimit ? 'text-red-600' : 'text-gray-800'}`}>
          <span>Total: {total} / {maxQuantity}</span>
          {isOverLimit && <span className="text-xs font-normal">(exceeds limit)</span>}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={readOnly || isSaving}
            rows={2}
            placeholder="Optional notes..."
            className="w-full rounded-md border-gray-300 shadow-sm text-sm focus:border-orange-500 focus:ring-orange-500 disabled:opacity-50"
          />
        </div>

        {/* Last updated info */}
        {order?.last_updated_by && (
          <div className="text-xs text-gray-400">
            Last updated by {order.last_updated_by}
            {order.last_updated_at && (
              <> at {new Date(order.last_updated_at).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
              })}</>
            )}
          </div>
        )}

        {/* Save button */}
        {!readOnly && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isOverLimit}
            className={`w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              !isSaving && !isOverLimit
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save Order'}
          </button>
        )}
      </div>
    </div>
  );
}
