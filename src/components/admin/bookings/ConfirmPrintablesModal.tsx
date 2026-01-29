'use client';

import { useState, useEffect, useCallback } from 'react';
import { BookingWithDetails } from '@/app/api/admin/bookings/route';
import {
  PrintableItemType,
  PrintableEditorState,
  PRINTABLE_ITEMS,
  TOTAL_PRINTABLE_ITEMS,
  initializeEditorState,
} from '@/lib/config/printableTextConfig';
import PrintableEditor from './PrintableEditor';

// Item status type for the confirmation workflow
type ItemStatus = 'pending' | 'confirmed' | 'skipped';

interface ConfirmPrintablesModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingWithDetails;
}

// Health check response type
interface HealthCheckResult {
  healthy: boolean;
  bucketAccessible: boolean;
  templatesFound: string[];
  templatesMissing: string[];
  fontsFound: string[];
  fontsMissing: string[];
  errors: string[];
}

// Generation result types
interface GenerationResultItem {
  type: string;
  key?: string;
  error?: string;
}

interface GenerationResult {
  success: boolean;
  partialSuccess: boolean;
  eventId: string;
  audioFolderCreated: boolean;
  results: {
    succeeded: GenerationResultItem[];
    failed: GenerationResultItem[];
    skipped: { type: string; reason: string }[];
  };
  errors: string[];
}

// Initialize empty editor states for all items
function initializeAllItemsEditorState(schoolName: string, eventDate?: string): Record<PrintableItemType, PrintableEditorState> {
  const result: Record<PrintableItemType, PrintableEditorState> = {} as Record<PrintableItemType, PrintableEditorState>;
  PRINTABLE_ITEMS.forEach((item) => {
    result[item.type] = initializeEditorState(item.type, schoolName, 1, eventDate);
  });
  return result;
}

export default function ConfirmPrintablesModal({
  isOpen,
  onClose,
  booking,
}: ConfirmPrintablesModalProps) {
  // Current step in the wizard (0 to 10 for 11 items)
  const [currentStep, setCurrentStep] = useState(0);

  // Editor state for each item type
  const [itemEditorStates, setItemEditorStates] = useState<Record<PrintableItemType, PrintableEditorState>>(() =>
    initializeAllItemsEditorState(booking.schoolName, booking.bookingDate)
  );

  // Track status of each item: pending, confirmed, or skipped
  const [itemsStatus, setItemsStatus] = useState<Record<PrintableItemType, ItemStatus>>(() => {
    const status: Record<PrintableItemType, ItemStatus> = {} as Record<PrintableItemType, ItemStatus>;
    PRINTABLE_ITEMS.forEach((item) => {
      status[item.type] = 'pending';
    });
    return status;
  });

  // Loading state for fetching existing status
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);

  // Health check state
  const [healthCheck, setHealthCheck] = useState<HealthCheckResult | null>(null);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);

  // Preview download state
  const [isDownloading, setIsDownloading] = useState(false);

  // Current item config
  const currentItem = PRINTABLE_ITEMS[currentStep];
  const currentEditorState = itemEditorStates[currentItem.type];

  // Run health check and load status when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
      setItemEditorStates(initializeAllItemsEditorState(booking.schoolName, booking.bookingDate));
      // Reset all items to pending
      const initialStatus: Record<PrintableItemType, ItemStatus> = {} as Record<PrintableItemType, ItemStatus>;
      PRINTABLE_ITEMS.forEach((item) => {
        initialStatus[item.type] = 'pending';
      });
      setItemsStatus(initialStatus);
      setIsGenerating(false);
      setGenerationError(null);
      setGenerationResult(null);
      setHealthCheck(null);
      setHealthError(null);

      // Run health check
      checkHealth();

      // Load existing printable status from R2
      loadPrintablesStatus();
    }
  }, [isOpen, booking.schoolName]);

  // Load existing printables status from R2
  const loadPrintablesStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const params = new URLSearchParams({
        eventId: booking.code,
        schoolName: booking.schoolName,
        eventDate: booking.bookingDate,
      });
      const response = await fetch(`/api/admin/printables/status?${params.toString()}`);
      if (!response.ok) {
        console.warn('Could not load printables status');
        return;
      }
      const data = await response.json();
      if (data.status) {
        setItemsStatus(data.status);

        // Find the first pending or skipped item to jump to
        const firstPendingOrSkippedIndex = PRINTABLE_ITEMS.findIndex(
          (item) => data.status[item.type] === 'pending' || data.status[item.type] === 'skipped'
        );
        if (firstPendingOrSkippedIndex >= 0) {
          setCurrentStep(firstPendingOrSkippedIndex);
        }
      }
    } catch (error) {
      console.warn('Error loading printables status:', error);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  // Health check function
  const checkHealth = async () => {
    setIsCheckingHealth(true);
    setHealthError(null);

    try {
      const response = await fetch('/api/admin/printables/health');
      if (!response.ok) {
        throw new Error('Failed to check printables health');
      }
      const result = await response.json();
      setHealthCheck(result);

      if (!result.healthy) {
        setHealthError(`Missing assets: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      setHealthError(error instanceof Error ? error.message : 'Health check failed');
    } finally {
      setIsCheckingHealth(false);
    }
  };

  // Update editor state for current item
  const updateCurrentItemEditorState = useCallback(
    (state: PrintableEditorState) => {
      setItemEditorStates((prev) => ({
        ...prev,
        [currentItem.type]: state,
      }));
    },
    [currentItem.type]
  );

  // Handle confirm current item and go to next
  const handleConfirmAndNext = () => {
    setItemsStatus((prev) => ({
      ...prev,
      [currentItem.type]: 'confirmed',
    }));

    if (currentStep < TOTAL_PRINTABLE_ITEMS - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Handle skip current item and go to next
  const handleSkip = () => {
    setItemsStatus((prev) => ({
      ...prev,
      [currentItem.type]: 'skipped',
    }));

    if (currentStep < TOTAL_PRINTABLE_ITEMS - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  // Handle go back
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Handle generate all PDFs
  const handleGenerateAll = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setGenerationResult(null);

    try {
      const response = await fetch('/api/admin/printables/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: booking.code,
          schoolName: booking.schoolName,
          eventDate: booking.bookingDate,
          items: PRINTABLE_ITEMS.map(item => {
            const state = itemEditorStates[item.type];
            return {
              type: item.type,
              status: itemsStatus[item.type], // Include status for each item
              textElements: state.textElements,
              qrPosition: state.qrPosition,
              canvasScale: state.canvasScale,
            };
          }),
        }),
      });

      const result = await response.json();
      setGenerationResult(result);

      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate printables');
      }

      // If fully successful (no failures), close modal after short delay
      if (result.success && !result.partialSuccess) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate printables. Please try again.');
      console.error('Generation error:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle retry failed items
  const handleRetryFailed = async () => {
    if (!generationResult) return;

    setIsGenerating(true);
    setGenerationError(null);

    // Get the types that failed
    const failedTypes = generationResult.results.failed.map(f => f.type);

    try {
      const response = await fetch('/api/admin/printables/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: booking.code,
          schoolName: booking.schoolName,
          eventDate: booking.bookingDate,
          // Only send failed items for retry
          items: PRINTABLE_ITEMS
            .filter(item => failedTypes.includes(item.type))
            .map(item => {
              const state = itemEditorStates[item.type];
              return {
                type: item.type,
                status: itemsStatus[item.type],
                textElements: state.textElements,
                qrPosition: state.qrPosition,
                canvasScale: state.canvasScale,
              };
            }),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Retry failed');
      }

      // Merge results with previous successful items
      const newResult: GenerationResult = {
        ...result,
        results: {
          succeeded: [
            ...generationResult.results.succeeded,
            ...result.results.succeeded,
          ],
          failed: result.results.failed,
          skipped: [
            ...generationResult.results.skipped,
            ...result.results.skipped,
          ],
        },
      };

      setGenerationResult(newResult);

      // If now fully successful, close modal
      if (newResult.results.failed.length === 0) {
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Retry failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle download preview of current item
  const handleDownloadPreview = async () => {
    setIsDownloading(true);
    setGenerationError(null);

    try {
      const response = await fetch('/api/admin/printables/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: booking.code,
          schoolName: booking.schoolName,
          eventDate: booking.bookingDate,
          accessCode: booking.accessCode,
          item: {
            type: currentItem.type,
            textElements: currentEditorState.textElements,
            qrPosition: currentEditorState.qrPosition,
            canvasScale: currentEditorState.canvasScale,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate preview');
      }

      const result = await response.json();

      if (result.success && result.url) {
        window.open(result.url, '_blank');
      } else {
        throw new Error('No preview URL returned');
      }
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate preview. Please try again.');
      console.error('Preview error:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Count items by status
  const confirmedCount = Object.values(itemsStatus).filter(s => s === 'confirmed').length;
  const skippedCount = Object.values(itemsStatus).filter(s => s === 'skipped').length;
  const pendingCount = Object.values(itemsStatus).filter(s => s === 'pending').length;

  // All items are ready when none are pending (all confirmed or skipped)
  const allItemsReady = pendingCount === 0;

  // Check if on last step
  const isLastStep = currentStep === TOTAL_PRINTABLE_ITEMS - 1;

  // Check if health check passed
  const healthOk = healthCheck?.healthy ?? false;

  // Current item status
  const currentItemStatus = itemsStatus[currentItem.type];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{booking.schoolName}</h2>
            <p className="text-sm text-gray-500">Confirm printables for this event</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Health check warning */}
        {(isCheckingHealth || healthError) && (
          <div className={`px-6 py-3 ${healthError ? 'bg-red-50' : 'bg-blue-50'}`}>
            {isCheckingHealth ? (
              <div className="flex items-center gap-2 text-blue-700 text-sm">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Checking templates and assets...
              </div>
            ) : healthError ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-700 text-sm">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  {healthError}
                </div>
                <button
                  onClick={checkHealth}
                  className="text-sm text-red-700 hover:text-red-800 underline"
                >
                  Retry
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Progress stepper */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              Step {currentStep + 1} of {TOTAL_PRINTABLE_ITEMS}: {currentItem.name}
            </span>
            <div className="flex items-center gap-1.5">
              {PRINTABLE_ITEMS.map((item, index) => {
                const status = itemsStatus[item.type];
                const isCurrent = index === currentStep;

                // Determine dot style based on status
                let dotClass = 'bg-gray-300'; // pending
                if (status === 'confirmed') {
                  dotClass = 'bg-green-500';
                } else if (status === 'skipped') {
                  dotClass = 'bg-amber-400';
                }

                return (
                  <button
                    key={item.type}
                    onClick={() => setCurrentStep(index)}
                    className={`w-3 h-3 rounded-full transition-all ${dotClass} ${
                      isCurrent ? 'ring-2 ring-[#F4A261] ring-offset-1 scale-125' : ''
                    }`}
                    title={`${item.name} (${status})`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Generation Results Display */}
        {generationResult && (
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="space-y-3">
              {/* Summary */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Generation Results</h3>
                {generationResult.partialSuccess && (
                  <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                    Partial Success
                  </span>
                )}
                {generationResult.success && !generationResult.partialSuccess && (
                  <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-full">
                    All Succeeded
                  </span>
                )}
              </div>

              {/* Results grid */}
              <div className="flex flex-wrap gap-2">
                {/* Succeeded items */}
                {generationResult.results.succeeded.map((item) => (
                  <div
                    key={item.type}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item.type}
                  </div>
                ))}

                {/* Failed items */}
                {generationResult.results.failed.map((item) => (
                  <div
                    key={item.type}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs"
                    title={item.error}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {item.type}
                  </div>
                ))}

                {/* Skipped items */}
                {generationResult.results.skipped.map((item) => (
                  <div
                    key={item.type}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                    title={item.reason}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                    </svg>
                    {item.type}
                  </div>
                ))}
              </div>

              {/* Retry button for failed items */}
              {generationResult.results.failed.length > 0 && (
                <button
                  onClick={handleRetryFailed}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Retrying...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Retry {generationResult.results.failed.length} Failed Items
                    </>
                  )}
                </button>
              )}

              {/* Close button for full success */}
              {generationResult.success && !generationResult.partialSuccess && (
                <p className="text-sm text-green-600">All printables generated successfully. Closing...</p>
              )}
            </div>
          </div>
        )}

        {/* Main content - PrintableEditor */}
        <div className="flex-1 overflow-hidden min-h-0">
          <PrintableEditor
            itemConfig={currentItem}
            schoolName={booking.schoolName}
            accessCode={booking.accessCode}
            eventDate={booking.bookingDate}
            editorState={currentEditorState}
            onEditorStateChange={updateCurrentItemEditorState}
          />
        </div>

        {/* Summary display when all items are ready */}
        {allItemsReady && !generationResult && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Ready to Generate</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                  {confirmedCount} confirmed
                </span>
                {skippedCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    {skippedCount} skipped
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRINTABLE_ITEMS.map((item) => {
                const status = itemsStatus[item.type];
                return (
                  <span
                    key={item.type}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                      status === 'confirmed'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {status === 'confirmed' ? (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                      </svg>
                    )}
                    {item.name}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer with actions */}
        <div className="px-6 py-4 border-t border-gray-200 bg-white">
          {generationError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {generationError}
            </div>
          )}

          {/* Already generated indicator for confirmed items */}
          {currentItemStatus === 'confirmed' && (
            <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              This item has already been generated. You can update and regenerate if needed.
            </div>
          )}

          <div className="flex items-center justify-between">
            {/* Left side buttons */}
            <div className="flex items-center gap-2">
              {/* Back button */}
              <button
                onClick={handleBack}
                disabled={currentStep === 0}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  currentStep === 0
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              {/* Download Preview button */}
              <button
                onClick={handleDownloadPreview}
                disabled={isDownloading}
                className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download preview PDF"
              >
                {isDownloading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="sr-only">Generating...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span className="hidden sm:inline">Preview</span>
                  </>
                )}
              </button>
            </div>

            {/* Right side buttons */}
            <div className="flex items-center gap-3">
              {/* Skip button */}
              <button
                onClick={handleSkip}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Skip
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              </button>

              {/* Confirm & Next / Confirm button */}
              {!isLastStep ? (
                <button
                  onClick={handleConfirmAndNext}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#F4A261] text-white rounded-lg hover:bg-[#E07B3A] transition-colors font-medium"
                >
                  {currentItemStatus === 'confirmed' ? 'Update & Next' : 'Confirm & Next'}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button
                  onClick={handleConfirmAndNext}
                  className={`inline-flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors ${
                    currentItemStatus === 'confirmed'
                      ? 'bg-[#F4A261] text-white hover:bg-[#E07B3A]'
                      : 'bg-[#F4A261] text-white hover:bg-[#E07B3A]'
                  }`}
                >
                  {currentItemStatus === 'confirmed' ? 'Update' : 'Confirm'}
                </button>
              )}

              {/* Generate All button - show when all items are ready (no pending) */}
              {allItemsReady && (
                <button
                  onClick={handleGenerateAll}
                  disabled={isGenerating || !healthOk}
                  title={!healthOk ? 'Fix missing assets before generating' : undefined}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Generate {confirmedCount} PDFs
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
