'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import TaskMatrix from '@/components/admin/tasks/TaskMatrix';
import TaskDateView from '@/components/admin/tasks/TaskDateView';
import TaskCompletionModal from '@/components/admin/tasks/TaskCompletionModal';
import CompletedTasksView from '@/components/admin/tasks/CompletedTasksView';
import TaskSearchBar from '@/components/admin/tasks/TaskSearchBar';
import IncomingOrdersView from '@/components/admin/tasks/IncomingOrdersView';
import {
  TaskWithEventDetails,
  TaskCompletionData,
  TaskMatrixRow,
} from '@/lib/types/tasks';

type ViewMode = 'by-event' | 'by-date' | 'incoming' | 'completed';

export default function AdminTasks() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [viewMode, setViewMode] = useState<ViewMode>('by-event');

  // Matrix (by-event) state
  const [matrixRows, setMatrixRows] = useState<TaskMatrixRow[]>([]);
  const [isMatrixLoading, setIsMatrixLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const matrixLoadedRef = useRef(false);

  // Completed state
  const [completedTasks, setCompletedTasks] = useState<TaskWithEventDetails[]>(
    []
  );
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchAbortRef = useRef<AbortController | null>(null);

  // Incoming badge count
  const [incomingCount, setIncomingCount] = useState<number | null>(null);

  // Shared
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] =
    useState<TaskWithEventDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch: Matrix rows (by-event view)
  // ---------------------------------------------------------------------------
  const fetchMatrixRows = useCallback(async () => {
    try {
      if (!matrixLoadedRef.current) {
        setIsMatrixLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const response = await fetch('/api/admin/tasks/matrix', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch task matrix');
      }

      const data = await response.json();

      if (data.success) {
        setMatrixRows(data.data.rows || []);
      } else {
        throw new Error(data.error || 'Failed to load task matrix');
      }
    } catch (err) {
      console.error('Error fetching task matrix:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load task matrix'
      );
    } finally {
      matrixLoadedRef.current = true;
      setIsMatrixLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch: Completed tasks
  // ---------------------------------------------------------------------------
  const fetchCompletedTasks = useCallback(
    async (search?: string, signal?: AbortSignal) => {
      try {
        setIsLoadingCompleted(true);
        const params = new URLSearchParams({ status: 'completed' });
        if (search) {
          params.set('search', search);
        }

        const response = await fetch(`/api/admin/tasks?${params}`, {
          credentials: 'include',
          signal,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(
            errorData.error || 'Failed to fetch completed tasks'
          );
        }

        const data = await response.json();

        if (data.success) {
          setCompletedTasks(data.data.tasks || []);
        } else {
          throw new Error(data.error || 'Failed to load completed tasks');
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Error fetching completed tasks:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load completed tasks'
        );
      } finally {
        setIsLoadingCompleted(false);
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // Fetch: Incoming orders count (badge)
  // ---------------------------------------------------------------------------
  const fetchIncomingCount = useCallback(async () => {
    try {
      const response = await fetch(
        '/api/admin/tasks/guesstimate-orders?status=pending',
        { credentials: 'include' }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIncomingCount(Array.isArray(data.data) ? data.data.length : 0);
        }
      }
    } catch {
      // Silently fail — badge is optional
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  // Load matrix data on mount
  useEffect(() => {
    fetchMatrixRows();
    fetchIncomingCount();
  }, [fetchMatrixRows, fetchIncomingCount]);

  // Load completed tasks when switching to completed view (or search changes)
  useEffect(() => {
    if (viewMode === 'completed') {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      fetchCompletedTasks(searchQuery, controller.signal);
    }
    return () => {
      searchAbortRef.current?.abort();
    };
  }, [viewMode, fetchCompletedTasks, searchQuery]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleRefresh = () => {
    if (viewMode === 'by-event') {
      fetchMatrixRows();
    }
    // by-date view self-fetches; incoming/completed have their own refresh
  };

  const handleCompleteClick = (task: TaskWithEventDetails) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  const handleCompleteTask = async (
    taskId: string,
    data: TaskCompletionData
  ) => {
    const response = await fetch(`/api/admin/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ completion_data: data }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to complete task');
    }

    // Refresh matrix data after completion
    await fetchMatrixRows();
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  // ---------------------------------------------------------------------------
  // Loading / Error
  // ---------------------------------------------------------------------------

  if (isMatrixLoading && viewMode === 'by-event') {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={() => {
            setError(null);
            fetchMatrixRows();
          }}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // View toggle config
  // ---------------------------------------------------------------------------

  const viewTabs: {
    id: ViewMode;
    label: string;
    badge?: number | null;
  }[] = [
    { id: 'by-event', label: 'By Event' },
    { id: 'by-date', label: 'By Date' },
    {
      id: 'incoming',
      label: 'Incoming Orders',
      badge: incomingCount && incomingCount > 0 ? incomingCount : null,
    },
    {
      id: 'completed',
      label: 'Completed',
      badge: completedTasks.length > 0 ? completedTasks.length : null,
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">
            Manage production tasks across all events
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          aria-label="Refresh tasks"
          className="inline-flex items-center px-4 py-2 bg-[#94B8B3] text-white rounded-lg hover:bg-[#7da39e] transition-colors disabled:opacity-70"
        >
          <svg
            className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-4 mb-6 flex-wrap" role="tablist" aria-label="Task views">
        {viewTabs.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={viewMode === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setViewMode(tab.id)}
            className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              viewMode === tab.id
                ? 'bg-[#94B8B3] text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {tab.label}
            {tab.badge != null && (
              <span
                className={`ml-2 inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-semibold rounded-full ${
                  viewMode === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* By Event View (Task Matrix) */}
      {viewMode === 'by-event' && (
        <div id="panel-by-event" role="tabpanel" aria-labelledby="tab-by-event">
          <TaskMatrix
            rows={matrixRows}
            isLoading={isMatrixLoading}
            onTaskAction={async (action, eventId, templateId, taskId, data) => {
              try {
                if (action === 'complete') {
                  if (taskId) {
                    await fetch(`/api/admin/tasks/${taskId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ completion_data: {} }),
                    });
                  } else {
                    await fetch('/api/admin/tasks/matrix/complete', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ eventId, templateId, completion_data: {} }),
                    });
                  }
                } else if (action === 'skip') {
                  if (taskId) {
                    await fetch(`/api/admin/tasks/${taskId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ status: 'skipped' }),
                    });
                  } else {
                    await fetch('/api/admin/tasks/matrix/complete', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ eventId, templateId, status: 'skipped' }),
                    });
                  }
                } else if (action === 'partial') {
                  const notes = (data?.notes as string) || '';
                  if (taskId) {
                    await fetch(`/api/admin/tasks/${taskId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ status: 'partial', completion_data: { notes } }),
                    });
                  } else {
                    await fetch('/api/admin/tasks/matrix/complete', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ eventId, templateId, status: 'partial', completion_data: { notes } }),
                    });
                  }
                } else if (action === 'revert') {
                  if (taskId) {
                    await fetch(`/api/admin/tasks/${taskId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      credentials: 'include',
                      body: JSON.stringify({ status: 'pending' }),
                    });
                  }
                  // Virtual cells can't be reverted (they're always pending)
                }
                await fetchMatrixRows();
              } catch (err) {
                console.error('Error performing task action:', err);
                setError(
                  err instanceof Error ? err.message : 'Failed to perform task action'
                );
              }
            }}
          />
        </div>
      )}

      {/* By Date View */}
      {viewMode === 'by-date' && (
        <div id="panel-by-date" role="tabpanel" aria-labelledby="tab-by-date">
          <TaskDateView />
        </div>
      )}

      {/* Incoming Orders View */}
      {viewMode === 'incoming' && (
        <div
          id="panel-incoming"
          role="tabpanel"
          aria-labelledby="tab-incoming"
        >
          <IncomingOrdersView
            onStockArrived={() => {
              fetchMatrixRows();
              fetchIncomingCount();
            }}
          />
        </div>
      )}

      {/* Completed Tasks View */}
      {viewMode === 'completed' && (
        <div
          id="panel-completed"
          role="tabpanel"
          aria-labelledby="tab-completed"
        >
          {/* Search Bar */}
          <div className="mb-6 max-w-md">
            <TaskSearchBar
              onSearch={handleSearch}
              placeholder="Search by event ID, GO-ID, or school..."
            />
          </div>

          {/* Completed Tasks Table */}
          <CompletedTasksView
            tasks={completedTasks}
            isLoading={isLoadingCompleted}
            onRefresh={() => fetchCompletedTasks(searchQuery)}
          />
        </div>
      )}

      {/* Completion Modal */}
      {selectedTask && (
        <TaskCompletionModal
          task={selectedTask}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTask(null);
          }}
          onComplete={handleCompleteTask}
        />
      )}
    </div>
  );
}
