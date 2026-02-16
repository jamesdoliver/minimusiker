'use client';

import { useState, useRef } from 'react';

interface InvoiceUploadButtonProps {
  taskId: string;
  hasInvoice: boolean;
  invoiceUrl?: string;
  onUploadSuccess?: () => void;
}

export default function InvoiceUploadButton({
  taskId,
  hasInvoice,
  invoiceUrl,
  onUploadSuccess,
}: InvoiceUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleViewClick = async () => {
    if (!invoiceUrl) return;

    try {
      const response = await fetch(`/api/admin/tasks/${taskId}/invoice`);
      const data = await response.json();
      if (data.success && data.data?.url) {
        window.open(data.data.url, '_blank');
      }
    } catch (error) {
      console.error('Error fetching invoice URL:', error);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/admin/tasks/${taskId}/invoice`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Upload failed');
      }

      onUploadSuccess?.();
    } catch (error) {
      console.error('Error uploading invoice:', error);
      alert('Failed to upload invoice');
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (hasInvoice) {
    return (
      <button
        onClick={handleViewClick}
        className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 transition-colors"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        View
      </button>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleFileChange}
        className="hidden"
      />
      <button
        onClick={handleUploadClick}
        disabled={isUploading}
        className="inline-flex items-center px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
      >
        {isUploading ? (
          <>
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-1" aria-hidden="true"></div>
            Uploading...
          </>
        ) : (
          'Upload'
        )}
      </button>
    </>
  );
}
