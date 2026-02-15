// src/components/admin/tasks/CompletedTasksView.tsx

'use client';

import { useState, useMemo, Fragment } from 'react';
import { TaskWithEventDetails, TASK_TYPE_CONFIG, TaskFilterTab } from '@/lib/types/tasks';
import TaskTypeBadge from './TaskTypeBadge';
import TaskTypeFilter from './TaskTypeFilter';
import InvoiceUploadButton from './InvoiceUploadButton';

interface CompletionData {
  amount?: number;
  invoice_r2_key?: string;
  notes?: string;
}

interface CompletedTasksViewProps {
  tasks: TaskWithEventDetails[];
  isLoading: boolean;
  onRefresh?: () => void;
}

export default function CompletedTasksView({
  tasks,
  isLoading,
  onRefresh,
}: CompletedTasksViewProps) {
  const PAGE_SIZE = 50;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TaskFilterTab>('all');
  const [sortField, setSortField] = useState<'task' | 'school' | 'amount' | 'completed'>('completed');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'completed' ? 'desc' : 'asc');
    }
  };

  const parseAmount = (task: TaskWithEventDetails): number => {
    if (!task.completion_data) return 0;
    try {
      const data = JSON.parse(task.completion_data);
      return data.amount || 0;
    } catch {
      return 0;
    }
  };

  // Reset visible count when filter changes
  const handleFilterChange = (filter: TaskFilterTab) => {
    setTypeFilter(filter);
    setVisibleCount(PAGE_SIZE);
  };

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    const filtered = typeFilter === 'all'
      ? tasks
      : tasks.filter(task => task.task_type === typeFilter);

    return [...filtered].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'task':
          return dir * a.task_name.localeCompare(b.task_name);
        case 'school':
          return dir * a.school_name.localeCompare(b.school_name);
        case 'amount':
          return dir * (parseAmount(a) - parseAmount(b));
        case 'completed':
          return dir * (new Date(a.completed_at || 0).getTime() - new Date(b.completed_at || 0).getTime());
        default:
          return 0;
      }
    });
  }, [tasks, typeFilter, sortField, sortDirection]);

  const visibleTasks = filteredTasks.slice(0, visibleCount);
  const hasMore = visibleCount < filteredTasks.length;

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <div className="h-6 w-24 bg-gray-100 rounded"></div>
              <div className="h-4 w-40 bg-gray-100 rounded"></div>
              <div className="h-4 w-32 bg-gray-100 rounded flex-1"></div>
              <div className="h-4 w-24 bg-gray-100 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Filter Row */}
      <div className="mb-4 flex items-center gap-4">
        <TaskTypeFilter value={typeFilter} onChange={handleFilterChange} />
        <span className="text-sm text-gray-500">
          {hasMore
            ? `Showing ${visibleCount} of ${filteredTasks.length} tasks`
            : `${filteredTasks.length} task${filteredTasks.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {filteredTasks.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">📋</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Completed Tasks
          </h3>
          <p className="text-gray-600">
            {typeFilter === 'all'
              ? 'Completed tasks will appear here for reference.'
              : `No completed ${TASK_TYPE_CONFIG[typeFilter]?.label || typeFilter} tasks found.`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-4 py-3"></th>
                {([
                  { key: 'task' as const, label: 'Task' },
                  { key: 'school' as const, label: 'School' },
                  { key: 'amount' as const, label: 'Amount' },
                  { key: 'completed' as const, label: 'Completed' },
                ] as const).map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none"
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      {sortField === key && (
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          {sortDirection === 'asc'
                            ? <path d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L10 6.414l-3.293 3.293a1 1 0 01-1.414 0z" />
                            : <path d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L10 13.586l3.293-3.293a1 1 0 011.414 0z" />
                          }
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {visibleTasks.map((task) => {
                const isExpanded = expandedId === task.id;
                let completionData: CompletionData = {};
                if (task.completion_data) {
                  try {
                    completionData = JSON.parse(task.completion_data) as CompletionData;
                  } catch {
                    console.error(`Failed to parse completion_data for task ${task.id}`);
                  }
                }
                const hasInvoice = !!completionData.invoice_r2_key;

                return (
                  <Fragment key={task.id}>
                    <tr
                      className={`hover:bg-gray-50 cursor-pointer ${
                        isExpanded ? 'bg-gray-50' : ''
                      }`}
                      onClick={() => toggleExpand(task.id)}
                    >
                      <td className="px-4 py-3">
                        <svg
                          className={`w-4 h-4 text-gray-400 transition-transform ${
                            isExpanded ? 'rotate-90' : ''
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <TaskTypeBadge type={task.task_type} size="sm" />
                          <span className="text-sm text-gray-900 font-medium">
                            {task.task_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {task.school_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {completionData.amount
                          ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(completionData.amount)
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {task.completed_at
                          ? new Date(task.completed_at).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <InvoiceUploadButton
                          taskId={task.id}
                          hasInvoice={hasInvoice}
                          invoiceUrl={completionData.invoice_r2_key}
                          onUploadSuccess={onRefresh}
                        />
                      </td>
                    </tr>

                    {/* Expanded Details Row */}
                    {isExpanded && (
                      <tr className="bg-gray-50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="ml-8 space-y-3">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium text-gray-700">
                                  Event ID:
                                </span>{' '}
                                <span className="text-gray-600 font-mono text-xs">
                                  {task.event_id}
                                </span>
                              </div>
                              <div>
                                <span className="font-medium text-gray-700">
                                  Event Date:
                                </span>{' '}
                                <span className="text-gray-600">
                                  {new Date(task.event_date).toLocaleDateString('en-GB', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                              </div>
                              {task.go_display_id && (
                                <div>
                                  <span className="font-medium text-gray-700">
                                    GO-ID:
                                  </span>{' '}
                                  <span className="text-sage-700 font-mono">
                                    {task.go_display_id}
                                  </span>
                                </div>
                              )}
                              {task.completed_by && (
                                <div>
                                  <span className="font-medium text-gray-700">
                                    Completed By:
                                  </span>{' '}
                                  <span className="text-gray-600">
                                    {task.completed_by}
                                  </span>
                                </div>
                              )}
                            </div>
                            {completionData.notes && (
                              <div className="text-sm">
                                <span className="font-medium text-gray-700">
                                  Notes:
                                </span>{' '}
                                <span className="text-gray-600">
                                  {completionData.notes}
                                </span>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {/* Load More */}
          {hasMore && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-center">
              <button
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                className="text-sm font-medium text-[#94B8B3] hover:text-[#7da39e] transition-colors"
              >
                Show more ({filteredTasks.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
