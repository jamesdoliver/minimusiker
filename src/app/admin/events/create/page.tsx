'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface ClassInput {
  id: string;
  className: string;
  totalChildren?: number;
}

interface EventFormData {
  schoolName: string;
  eventDate: string;
  eventType: string;
  mainTeacher: string;
  otherTeachers: string[];
  classes: ClassInput[];
}

export default function CreateEventPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState<EventFormData>({
    schoolName: '',
    eventDate: '',
    eventType: 'minimusiker',
    mainTeacher: '',
    otherTeachers: [],
    classes: [{ id: crypto.randomUUID(), className: '', totalChildren: undefined }],
  });

  const [otherTeacherInput, setOtherTeacherInput] = useState('');

  const handleAddOtherTeacher = () => {
    if (otherTeacherInput.trim()) {
      setFormData({
        ...formData,
        otherTeachers: [...formData.otherTeachers, otherTeacherInput.trim()],
      });
      setOtherTeacherInput('');
    }
  };

  const handleRemoveOtherTeacher = (index: number) => {
    setFormData({
      ...formData,
      otherTeachers: formData.otherTeachers.filter((_, i) => i !== index),
    });
  };

  const handleAddClass = () => {
    setFormData({
      ...formData,
      classes: [
        ...formData.classes,
        { id: crypto.randomUUID(), className: '', totalChildren: undefined },
      ],
    });
  };

  const handleRemoveClass = (id: string) => {
    if (formData.classes.length === 1) {
      alert('You must have at least one class');
      return;
    }
    setFormData({
      ...formData,
      classes: formData.classes.filter((c) => c.id !== id),
    });
  };

  const handleClassChange = (id: string, field: keyof ClassInput, value: string | number | undefined) => {
    setFormData({
      ...formData,
      classes: formData.classes.map((c) =>
        c.id === id ? { ...c, [field]: value } : c
      ),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      // Validate form
      if (!formData.schoolName.trim()) {
        throw new Error('School name is required');
      }
      if (!formData.eventDate) {
        throw new Error('Event date is required');
      }
      if (!formData.mainTeacher.trim()) {
        throw new Error('Main teacher is required');
      }
      if (formData.classes.some((c) => !c.className.trim())) {
        throw new Error('All classes must have a name');
      }
      if (formData.classes.some((c) => !c.totalChildren || c.totalChildren < 1)) {
        throw new Error('All classes must have a total number of children');
      }

      // Submit to API
      const response = await fetch('/api/admin/events/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          schoolName: formData.schoolName.trim(),
          eventDate: formData.eventDate,
          eventType: formData.eventType,
          mainTeacher: formData.mainTeacher.trim(),
          otherTeachers: formData.otherTeachers,
          classes: formData.classes.map((c) => ({
            className: c.className.trim(),
            totalChildren: c.totalChildren,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create event');
      }

      const result = await response.json();
      setSuccess(true);

      // Show success message and redirect after 2 seconds
      setTimeout(() => {
        router.push('/admin/events');
      }, 2000);
    } catch (err) {
      console.error('Error creating event:', err);
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel? All unsaved changes will be lost.')) {
      router.push('/admin/events');
    }
  };

  if (success) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-green-600"
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
          </div>
          <h2 className="text-2xl font-bold text-green-900 mb-2">Event Created Successfully!</h2>
          <p className="text-green-700">Redirecting to events list...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Create New Event</h1>
        <p className="text-gray-600 mt-2">
          Set up a new event with school details, teachers, and participating classes.
          Children will be registered when parents complete the registration form.
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Event Information */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Event Information</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="schoolName" className="block text-sm font-medium text-gray-700 mb-2">
                School Name *
              </label>
              <input
                type="text"
                id="schoolName"
                value={formData.schoolName}
                onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., Calder High School"
                required
              />
            </div>

            <div>
              <label htmlFor="eventDate" className="block text-sm font-medium text-gray-700 mb-2">
                Event Date *
              </label>
              <input
                type="date"
                id="eventDate"
                value={formData.eventDate}
                onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="eventType" className="block text-sm font-medium text-gray-700 mb-2">
                Event Type *
              </label>
              <select
                id="eventType"
                value={formData.eventType}
                onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                required
              >
                <option value="minimusiker">Minimusiker</option>
                <option value="schulsong">Schulsong</option>
              </select>
            </div>
          </div>
        </div>

        {/* Teachers */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Teachers</h2>

          <div className="space-y-4">
            <div>
              <label htmlFor="mainTeacher" className="block text-sm font-medium text-gray-700 mb-2">
                Main Teacher *
              </label>
              <input
                type="text"
                id="mainTeacher"
                value={formData.mainTeacher}
                onChange={(e) => setFormData({ ...formData, mainTeacher: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="e.g., Mrs. Smith"
                required
              />
            </div>

            <div>
              <label htmlFor="otherTeachers" className="block text-sm font-medium text-gray-700 mb-2">
                Other Teachers (Optional)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="otherTeachers"
                  value={otherTeacherInput}
                  onChange={(e) => setOtherTeacherInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOtherTeacher();
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Add another teacher"
                />
                <button
                  type="button"
                  onClick={handleAddOtherTeacher}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Add
                </button>
              </div>

              {formData.otherTeachers.length > 0 && (
                <div className="mt-3 space-y-2">
                  {formData.otherTeachers.map((teacher, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md"
                    >
                      <span className="text-gray-700">{teacher}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveOtherTeacher(index)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Classes */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Participating Classes</h2>
            <button
              type="button"
              onClick={handleAddClass}
              className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm"
            >
              + Add Class
            </button>
          </div>

          <div className="space-y-4">
            {formData.classes.map((classItem, index) => (
              <div
                key={classItem.id}
                className="border border-gray-200 rounded-lg p-4 relative"
              >
                {formData.classes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveClass(classItem.id)}
                    className="absolute top-4 right-4 text-red-600 hover:text-red-700 text-sm"
                  >
                    Remove
                  </button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Class Name * {index > 0 && `(${index + 1})`}
                    </label>
                    <input
                      type="text"
                      value={classItem.className}
                      onChange={(e) =>
                        handleClassChange(classItem.id, 'className', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="e.g., Year 3, 3rd Grade, Mrs. Jones' Class"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Children *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={classItem.totalChildren ?? ''}
                      onChange={(e) =>
                        handleClassChange(
                          classItem.id,
                          'totalChildren',
                          e.target.value ? parseInt(e.target.value, 10) : undefined
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Number of children in class"
                      required
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end gap-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting && <LoadingSpinner size="sm" />}
            {isSubmitting ? 'Creating Event...' : 'Create Event'}
          </button>
        </div>
      </form>
    </div>
  );
}
