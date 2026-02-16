'use client';

import { useState, useEffect, useRef } from 'react';
import { TaskWithEventDetails, TaskCompletionData } from '@/lib/types/tasks';
import TaskTypeBadge from './TaskTypeBadge';

interface TaskCompletionModalProps {
  task: TaskWithEventDetails;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (taskId: string, data: TaskCompletionData) => Promise<void>;
}

export default function TaskCompletionModal({
  task,
  isOpen,
  onClose,
  onComplete,
}: TaskCompletionModalProps) {
  const [amount, setAmount] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setConfirmed(false);
      setNotes('');
      setInvoiceFile(null);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate based on completion type
    if (task.completion_type === 'monetary') {
      const amountNum = parseFloat(amount);
      if (!amount || isNaN(amountNum) || amountNum <= 0) {
        setError('Please enter a valid positive amount');
        return;
      }
    }

    if (task.completion_type === 'checkbox' && !confirmed) {
      setError('Please confirm the checkbox');
      return;
    }

    setIsSubmitting(true);

    try {
      const completionData: TaskCompletionData = {
        notes: notes || undefined,
      };

      if (task.completion_type === 'monetary') {
        completionData.amount = parseFloat(amount);
      }

      if (task.completion_type === 'checkbox') {
        completionData.confirmed = confirmed;
      }

      await onComplete(task.id, completionData);

      // Upload invoice after task completion (so the task record exists with completion_data)
      if (invoiceFile) {
        try {
          const formData = new FormData();
          formData.append('file', invoiceFile);
          const uploadRes = await fetch(`/api/admin/tasks/${task.id}/invoice`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });
          if (!uploadRes.ok) {
            const uploadData = await uploadRes.json().catch(() => ({}));
            console.error('Invoice upload failed:', uploadData.error || uploadRes.status);
          }
        } catch (uploadErr) {
          console.error('Invoice upload error:', uploadErr);
        }
      }

      onClose();
    } catch (err) {
      console.error('Error completing task:', err);
      setError('Failed to complete task. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Allowed: PDF, PNG, JPG');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File size exceeds 10MB limit');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setError(null);
    setInvoiceFile(file);
  };

  // Determine what will be created on completion
  const willCreateGoId = task.task_type === 'paper_order' && task.completion_type === 'monetary';
  const willCreateShipping = willCreateGoId && task.template_id !== 'minicard';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={() => !isSubmitting && onClose()}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full transform transition-all">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h2 id="task-modal-title" className="text-lg font-semibold text-gray-900">
                Complete Task
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">{task.task_name}</p>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              aria-label="Close dialog"
              className="text-gray-400 hover:text-gray-500 disabled:opacity-50"
            >
              <svg
                className="w-6 h-6"
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
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
            {/* Task Type Badge */}
            <div className="flex items-center gap-2">
              <TaskTypeBadge type={task.task_type} size="sm" />
              <span className="text-sm text-gray-500">{task.school_name}</span>
            </div>

            {/* Monetary Completion */}
            {task.completion_type === 'monetary' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Cost (EUR) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      €
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent"
                    />
                  </div>
                </div>

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
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Choose File
                    </button>
                    <span className="text-sm text-gray-500">
                      {invoiceFile ? invoiceFile.name : 'No file selected'}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Checkbox Completion */}
            {task.completion_type === 'checkbox' && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="confirm-checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-1 h-4 w-4 text-[#94B8B3] border-gray-300 rounded focus:ring-[#94B8B3]"
                />
                <label
                  htmlFor="confirm-checkbox"
                  className="text-sm text-gray-700"
                >
                  I confirm that this task has been completed (e.g., order has
                  been shipped)
                </label>
              </div>
            )}

            {/* Submit Only - Just show confirmation text */}
            {task.completion_type === 'submit_only' && (
              <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                Click the button below to mark this task as complete.
              </p>
            )}

            {/* Notes (optional for all types) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Add any notes..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#94B8B3] focus:border-transparent resize-none"
              />
            </div>

            {/* What will be created */}
            {(willCreateGoId || willCreateShipping) && (
              <div className="bg-sage-50 border border-sage-200 rounded-lg p-3 text-sm text-sage-800">
                <span className="font-medium">This will create:</span>
                <ul className="mt-1 space-y-0.5">
                  {willCreateGoId && <li>• New GO-ID for order tracking</li>}
                  {willCreateShipping && <li>• Shipping task for delivery</li>}
                </ul>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                {error}
              </div>
            )}
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-[#94B8B3] text-white text-sm font-medium rounded-lg hover:bg-[#7da39e] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? (
                <span>Processing...</span>
              ) : (
                <>
                  <span>Complete Task</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
