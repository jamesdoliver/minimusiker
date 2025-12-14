import { Student } from '@/types/airtable';
import { getInitials } from '@/lib/utils';

interface StudentCardProps {
  student: Student;
}

export default function StudentCard({ student }: StudentCardProps) {
  const fullName = `${student.first_name} ${student.last_name}`;
  const initials = getInitials(fullName);

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
      <div className="flex items-center space-x-4">
        <div className="flex-shrink-0">
          <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white text-xl font-bold">
            {initials}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 truncate">{fullName}</h3>
          {student.grade && (
            <p className="text-sm text-gray-500">Grade {student.grade}</p>
          )}
          {student.instrument && (
            <p className="text-sm text-gray-500">{student.instrument}</p>
          )}
        </div>
      </div>

      {(student.class_id || student.class_name) && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="space-y-1">
            {student.class_name && (
              <div className="text-sm text-gray-700">
                <span className="font-medium">Class:</span> {student.class_name}
              </div>
            )}
            {student.class_id && (
              <div className="text-xs text-gray-500">
                <span className="font-medium">Class ID:</span>{' '}
                <code className="bg-gray-100 px-1.5 py-0.5 rounded">
                  {student.class_id}
                </code>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}