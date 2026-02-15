'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import TaskQueue from '@/components/admin/tasks/TaskQueue';
import TaskTypeTabs from '@/components/admin/tasks/TaskTypeTabs';
import TaskCompletionModal from '@/components/admin/tasks/TaskCompletionModal';
import CompletedTasksView from '@/components/admin/tasks/CompletedTasksView';
import TaskSearchBar from '@/components/admin/tasks/TaskSearchBar';
import ClothingOrdersView from '@/components/admin/tasks/ClothingOrdersView';
import StandardClothingBatchView from '@/components/admin/tasks/StandardClothingBatchView';
import IncomingOrdersView from '@/components/admin/tasks/IncomingOrdersView';
import MinicardOrdersView from '@/components/admin/tasks/MinicardOrdersView';
import {
  TaskWithEventDetails,
  TaskFilterTab,
  TaskCompletionData,
} from '@/lib/types/tasks';

type ViewMode = 'pending' | 'incoming' | 'completed';

interface TasksStats {
  total: number;
  all: number;
  paper_order: number;
  clothing_order: number;
  standard_clothing_order: number;
  cd_master: number;
  cd_production: number;
  shipping: number;
}

export default function AdminTasks() {
  const [pendingTasks, setPendingTasks] = useState<TaskWithEventDetails[]>([]);
  const [completedTasks, setCompletedTasks] = useState<TaskWithEventDetails[]>(
    []
  );
  const [stats, setStats] = useState<TasksStats>({
    total: 0,
    all: 0,
    paper_order: 0,
    clothing_order: 0,
    standard_clothing_order: 0,
    cd_master: 0,
    cd_production: 0,
    shipping: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TaskFilterTab>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [incomingCount, setIncomingCount] = useState<number | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const hasLoadedRef = useRef(false);
  const [selectedTask, setSelectedTask] =
    useState<TaskWithEventDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch pending tasks
  const fetchPendingTasks = useCallback(async () => {
    try {
      // Only show full-page spinner on initial load (no data yet)
      if (!hasLoadedRef.current) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      const params = new URLSearchParams({ status: 'pending' });

      const response = await fetch(`/api/admin/tasks?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch tasks');
      }

      const data = await response.json();

      if (data.success) {
        setPendingTasks(data.data.tasks || []);
        setStats({
          total: data.data.counts?.total || 0,
          all: data.data.counts?.all || 0,
          paper_order: data.data.counts?.paper_order || 0,
          clothing_order: data.data.counts?.clothing_order || 0,
          standard_clothing_order: data.data.counts?.standard_clothing_order || 0,
          cd_master: data.data.counts?.cd_master || 0,
          cd_production: data.data.counts?.cd_production || 0,
          shipping: data.data.counts?.shipping || 0,
        });
      } else {
        throw new Error(data.error || 'Failed to load tasks');
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      hasLoadedRef.current = true;
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Fetch completed tasks
  const fetchCompletedTasks = useCallback(async (search?: string, signal?: AbortSignal) => {
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
        throw new Error(errorData.error || 'Failed to fetch completed tasks');
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
      setError(err instanceof Error ? err.message : 'Failed to load completed tasks');
    } finally {
      setIsLoadingCompleted(false);
    }
  }, []);

  // Fetch incoming orders count for badge
  const fetchIncomingCount = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/tasks/guesstimate-orders?status=pending', {
        credentials: 'include',
      });
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

  useEffect(() => {
    fetchPendingTasks();
    fetchIncomingCount();
  }, [fetchPendingTasks, fetchIncomingCount]);

  useEffect(() => {
    if (viewMode === 'completed') {
      // Abort previous search request to prevent stale results
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;
      fetchCompletedTasks(searchQuery, controller.signal);
    }
    return () => {
      searchAbortRef.current?.abort();
    };
  }, [viewMode, fetchCompletedTasks, searchQuery]);

  // Filter tasks based on active tab
  const filteredTasks = useMemo(() => {
    if (activeTab === 'all') {
      return pendingTasks;
    }
    return pendingTasks.filter((task) => task.task_type === activeTab);
  }, [pendingTasks, activeTab]);

  // Handle task completion click
  const handleCompleteClick = (task: TaskWithEventDetails) => {
    setSelectedTask(task);
    setIsModalOpen(true);
  };

  // Handle task completion submission
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

    // Refresh tasks after completion
    await fetchPendingTasks();
    setRefreshKey(k => k + 1);
  };

  // Handle search in completed tasks
  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  if (isLoading) {
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
          onClick={fetchPendingTasks}
          className="mt-2 text-sm text-red-700 underline hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Task Queue</h1>
          <p className="text-gray-600 mt-1">
            {stats.all} pending tasks across all categories
          </p>
        </div>
        <button
          onClick={fetchPendingTasks}
          disabled={isRefreshing}
          className="inline-flex items-center px-4 py-2 bg-[#94B8B3] text-white rounded-lg hover:bg-[#7da39e] transition-colors disabled:opacity-70"
        >
          <svg
            className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
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
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setViewMode('pending')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'pending'
              ? 'bg-[#94B8B3] text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Pending Tasks
          <span
            className={`ml-2 inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-semibold rounded-full ${
              viewMode === 'pending'
                ? 'bg-white/20 text-white'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {stats.all}
          </span>
        </button>
        <button
          onClick={() => setViewMode('incoming')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'incoming'
              ? 'bg-[#94B8B3] text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Incoming Orders
          {incomingCount !== null && incomingCount > 0 && (
            <span
              className={`ml-2 inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-semibold rounded-full ${
                viewMode === 'incoming'
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {incomingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setViewMode('completed')}
          className={`px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            viewMode === 'completed'
              ? 'bg-[#94B8B3] text-white'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Completed
          {completedTasks.length > 0 && (
            <span
              className={`ml-2 inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-xs font-semibold rounded-full ${
                viewMode === 'completed'
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              {completedTasks.length}
            </span>
          )}
        </button>
      </div>

      {/* Pending Tasks View */}
      {viewMode === 'pending' && (
        <>
          {/* Task Type Tabs */}
          <div className="mb-6">
            <TaskTypeTabs
              activeTab={activeTab}
              onTabChange={setActiveTab}
              counts={{
                all: stats.all,
                paper_order: stats.paper_order,
                clothing_order: stats.clothing_order,
                standard_clothing_order: stats.standard_clothing_order,
                cd_master: stats.cd_master,
                cd_production: stats.cd_production,
                shipping: stats.shipping,
              }}
            />
          </div>

          {/* Show specialized views for clothing tabs, TaskQueue for others */}
          {activeTab === 'clothing_order' ? (
            <ClothingOrdersView isActive={activeTab === 'clothing_order'} />
          ) : activeTab === 'standard_clothing_order' ? (
            <StandardClothingBatchView isActive={activeTab === 'standard_clothing_order'} />
          ) : activeTab === 'paper_order' ? (
            <>
              <MinicardOrdersView isActive={true} onCompleteTask={handleCompleteClick} refreshKey={refreshKey} />
              <div className="mt-8 mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Flyers & Posters</h2>
                <p className="text-sm text-gray-500">Individual print order tasks</p>
              </div>
              <TaskQueue
                tasks={filteredTasks.filter(t => t.template_id !== 'minicard')}
                isLoading={isLoading}
                onComplete={handleCompleteClick}
              />
            </>
          ) : (
            <TaskQueue
              tasks={filteredTasks}
              isLoading={isLoading}
              onComplete={handleCompleteClick}
            />
          )}
        </>
      )}

      {/* Incoming Orders View */}
      {viewMode === 'incoming' && (
        <IncomingOrdersView onStockArrived={() => { fetchPendingTasks(); fetchIncomingCount(); }} />
      )}

      {/* Completed Tasks View */}
      {viewMode === 'completed' && (
        <>
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
        </>
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
