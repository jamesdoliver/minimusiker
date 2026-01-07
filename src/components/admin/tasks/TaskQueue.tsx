'use client';

import { TaskWithEventDetails } from '@/lib/types/tasks';
import TaskCard from './TaskCard';

interface TaskQueueProps {
  tasks: TaskWithEventDetails[];
  isLoading: boolean;
  onComplete: (task: TaskWithEventDetails) => void;
}

export default function TaskQueue({
  tasks,
  isLoading,
  onComplete,
}: TaskQueueProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg shadow-sm border border-gray-200 h-64 animate-pulse"
          >
            <div className="h-12 bg-gray-100 border-b"></div>
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-100 rounded w-3/4"></div>
              <div className="h-3 bg-gray-100 rounded w-full"></div>
              <div className="h-3 bg-gray-100 rounded w-2/3"></div>
              <div className="h-16 bg-gray-100 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          All caught up!
        </h3>
        <p className="text-gray-600">
          No pending tasks in this category. Check back later or select a
          different filter.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} onComplete={onComplete} />
      ))}
    </div>
  );
}
