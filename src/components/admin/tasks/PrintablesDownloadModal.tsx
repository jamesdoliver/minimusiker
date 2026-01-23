'use client';

import { useState, useEffect } from 'react';
import { ClothingOrderEvent } from '@/lib/types/clothingOrders';

interface PrintableInfo {
  url: string;
  filename: string;
}

interface PrintablesData {
  tshirt?: PrintableInfo;
  hoodie?: PrintableInfo;
}

interface PrintablesDownloadModalProps {
  event: ClothingOrderEvent;
  onClose: () => void;
}

export default function PrintablesDownloadModal({
  event,
  onClose,
}: PrintablesDownloadModalProps) {
  const [loading, setLoading] = useState(true);
  const [printables, setPrintables] = useState<PrintablesData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch printables on mount
  useEffect(() => {
    const fetchPrintables = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/printables/clothing/${event.event_id}`);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch printables');
        }

        setPrintables(data.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load printables');
      } finally {
        setLoading(false);
      }
    };

    fetchPrintables();
  }, [event.event_id]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  // Handle download
  const handleDownload = (printable: PrintableInfo) => {
    const link = document.createElement('a');
    link.href = printable.url;
    link.download = printable.filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasPrintables = printables && (printables.tshirt || printables.hoodie);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Download Printables
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  {event.school_name} - {formatDate(event.event_date)}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#94B8B3]"></div>
                <span className="ml-3 text-gray-600">Loading printables...</span>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                <p className="font-medium">Error loading printables</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && !error && !hasPrintables && (
              <div className="text-center py-12">
                <div className="text-5xl mb-4">📄</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Clothing Printables Found
                </h3>
                <p className="text-gray-600">
                  No T-Shirt or Hoodie printables have been generated for this event yet.
                </p>
              </div>
            )}

            {/* Printables Grid */}
            {!loading && !error && hasPrintables && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* T-Shirt Section */}
                {printables?.tshirt && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900 flex items-center">
                        <span className="mr-2">👕</span>
                        T-Shirt Print
                      </h3>
                    </div>
                    <div className="p-4">
                      {/* PDF Preview */}
                      <div className="bg-gray-100 rounded-lg overflow-hidden mb-4" style={{ height: '300px' }}>
                        <iframe
                          src={`${printables.tshirt.url}#toolbar=0&navpanes=0`}
                          className="w-full h-full"
                          title="T-Shirt Print Preview"
                        />
                      </div>
                      {/* Download Button */}
                      <button
                        onClick={() => {
                          const tshirt = printables?.tshirt;
                          if (tshirt) handleDownload(tshirt);
                        }}
                        className="w-full px-4 py-2 text-sm font-medium text-white bg-[#94B8B3] rounded-lg hover:bg-[#7da39e] transition-colors flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download T-Shirt PDF
                      </button>
                    </div>
                  </div>
                )}

                {/* Hoodie Section */}
                {printables?.hoodie && (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900 flex items-center">
                        <span className="mr-2">🧥</span>
                        Hoodie Print
                      </h3>
                    </div>
                    <div className="p-4">
                      {/* PDF Preview */}
                      <div className="bg-gray-100 rounded-lg overflow-hidden mb-4" style={{ height: '300px' }}>
                        <iframe
                          src={`${printables.hoodie.url}#toolbar=0&navpanes=0`}
                          className="w-full h-full"
                          title="Hoodie Print Preview"
                        />
                      </div>
                      {/* Download Button */}
                      <button
                        onClick={() => {
                          const hoodie = printables?.hoodie;
                          if (hoodie) handleDownload(hoodie);
                        }}
                        className="w-full px-4 py-2 text-sm font-medium text-white bg-[#94B8B3] rounded-lg hover:bg-[#7da39e] transition-colors flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download Hoodie PDF
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
