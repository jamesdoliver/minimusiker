'use client';

import { useState } from 'react';

interface ClassOption {
  classId: string;
  className: string;
}

interface AddGroupModalProps {
  eventId: string;
  availableClasses: ClassOption[];
  onClose: () => void;
  onSuccess: () => void;
  apiBasePath: string; // '/api/teacher' or '/api/admin'
}

export default function AddGroupModal({
  eventId,
  availableClasses,
  onClose,
  onSuccess,
  apiBasePath,
}: AddGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleClassToggle = (classId: string) => {
    const newSet = new Set(selectedClassIds);
    if (newSet.has(classId)) {
      newSet.delete(classId);
    } else {
      newSet.add(classId);
    }
    setSelectedClassIds(newSet);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupName.trim()) {
      setError('Bitte geben Sie einen Gruppennamen ein');
      return;
    }

    if (selectedClassIds.size < 2) {
      setError('Bitte wählen Sie mindestens 2 Klassen aus');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`${apiBasePath}/events/${encodeURIComponent(eventId)}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: groupName.trim(),
          memberClassIds: Array.from(selectedClassIds),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Erstellen der Gruppe');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen der Gruppe');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Gruppe erstellen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gruppenname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500"
              placeholder="z.B. Klasse 3+4, Jahrgang 2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Klassen auswählen <span className="text-red-500">*</span>
              <span className="text-gray-500 font-normal ml-1">(min. 2)</span>
            </label>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
              {availableClasses.length === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">
                  Keine Klassen verfügbar
                </div>
              ) : (
                availableClasses.map((cls) => (
                  <label
                    key={cls.classId}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClassIds.has(cls.classId)}
                      onChange={() => handleClassToggle(cls.classId)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">{cls.className}</span>
                  </label>
                ))
              )}
            </div>
            {selectedClassIds.size > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                {selectedClassIds.size} Klasse{selectedClassIds.size !== 1 ? 'n' : ''} ausgewählt
              </p>
            )}
          </div>

          <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
            <p className="text-xs text-purple-700">
              Eine Gruppe ermöglicht es mehreren Klassen, gemeinsame Lieder zu singen.
              Lieder, die der Gruppe hinzugefügt werden, gelten für alle Mitgliedsklassen.
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedClassIds.size < 2}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Erstellen...' : 'Gruppe erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
