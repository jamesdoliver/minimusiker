'use client';

import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { parseJsonOrThrow } from '@/lib/api/parseResponse';

interface MonetaryCompletionProps {
  taskId: string;
  taskName: string;
  willCreateGoId: boolean;
  onComplete: () => void;
}

const ALLOWED_INVOICE_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const MAX_INVOICE_BYTES = 10 * 1024 * 1024; // 10 MB

export default function MonetaryCompletion({
  taskId,
  taskName,
  willCreateGoId,
  onComplete,
}: MonetaryCompletionProps) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_INVOICE_TYPES.includes(file.type)) {
      setError('Invalid file type. Allowed: PDF, PNG, JPG');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_INVOICE_BYTES) {
      setError('File size exceeds 10MB limit');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError(null);
    setInvoiceFile(file);
  };

  const handleClearFile = () => {
    setInvoiceFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setWarning(null);

    const amountNum = parseFloat(amount);
    if (!amount || !Number.isFinite(amountNum) || amountNum <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/admin/tasks/${taskId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completion_data: {
            amount: amountNum,
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          },
        }),
      });

      const data = await parseJsonOrThrow<{ success: boolean; error?: string }>(response);

      if (!data.success) {
        throw new Error(data.error || 'Failed to complete task');
      }

      // Upload invoice after task completion. Failure is non-blocking — task is
      // already marked complete server-side; we surface a warning but still call
      // onComplete() to match TaskCompletionModal behavior (lines 88-105).
      if (invoiceFile) {
        try {
          const formData = new FormData();
          formData.append('file', invoiceFile);
          const uploadRes = await fetch(`/api/admin/tasks/${taskId}/invoice`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });
          // parseJsonOrThrow throws on !ok with a meaningful message; we catch
          // below and convert to a warning rather than blocking task completion.
          await parseJsonOrThrow(uploadRes);
        } catch (uploadErr) {
          console.error('Invoice upload error:', uploadErr);
          setWarning('Task completed, but invoice upload failed. You can re-upload from the task list.');
        }
      }

      onComplete();
    } catch (err) {
      console.error('Error completing monetary task:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Complete Task</h3>
        <p className="text-sm text-gray-500 mt-0.5">{taskName}</p>
      </div>

      {/* Body */}
      <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
        {/* Amount */}
        <div>
          <label
            htmlFor="monetary-amount"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Order Cost (EUR) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
              €
            </span>
            <input
              id="monetary-amount"
              type="number"
              step="0.01"
              min="0.01"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              disabled={isSubmitting}
              required
              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent disabled:opacity-50"
            />
          </div>
        </div>

        {/* Invoice (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Invoice (Optional)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png"
              disabled={isSubmitting}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Choose File
            </button>
            <span className="text-sm text-gray-500 truncate">
              {invoiceFile ? invoiceFile.name : 'No file selected'}
            </span>
            {invoiceFile && !isSubmitting && (
              <button
                type="button"
                onClick={handleClearFile}
                aria-label="Remove selected file"
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500">PDF, PNG, or JPG &middot; up to 10 MB</p>
        </div>

        {/* Notes (optional) */}
        <div>
          <label
            htmlFor="monetary-notes"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Notes (Optional)
          </label>
          <textarea
            id="monetary-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Add any notes..."
            disabled={isSubmitting}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent resize-none disabled:opacity-50"
          />
        </div>

        {/* GO-ID banner */}
        {willCreateGoId && (
          <div className="bg-sage-50 border border-sage-200 rounded-lg p-3 text-sm text-sage-800">
            This will create a new GO-ID for order tracking.
          </div>
        )}

        {/* Warning (non-blocking) */}
        {warning && (
          <div
            role="status"
            aria-live="polite"
            className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800"
          >
            {warning}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="-mx-6 -mb-6 mt-2 px-6 py-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              'w-full px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
              'bg-[#94B8B3] hover:bg-[#7da39e]',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'flex items-center justify-center'
            )}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Completing...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Mark Complete
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
