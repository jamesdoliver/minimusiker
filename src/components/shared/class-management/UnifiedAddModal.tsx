'use client';

import { useState, useEffect } from 'react';

interface ClassOption {
  classId: string;
  className: string;
}

interface UnifiedAddModalProps {
  eventId: string;
  availableClasses: ClassOption[];
  onClose: () => void;
  onSuccess: () => void;
  apiBasePath: string; // '/api/teacher' or '/api/admin'
  initialTab?: 'group' | 'choir' | 'teacher_song';
  hideTabBar?: boolean;
}

type TabType = 'group' | 'choir' | 'teacher_song';

const TAB_CONFIG = {
  group: {
    label: 'Gruppe',
    color: 'purple',
    helpText: 'Mehrere Klassen singen gemeinsam ein Lied',
    buttonText: 'Gruppe erstellen',
    placeholder: 'z.B. Klasse 3+4, Jahrgang 2',
  },
  choir: {
    label: 'Chor',
    color: 'teal',
    helpText: 'Für alle Eltern sichtbar, unabhängig von der Klasse',
    buttonText: 'Chor erstellen',
    placeholder: 'z.B. Schulchor, Klasse 3+4 Chor',
  },
  teacher_song: {
    label: 'Lehrerlied',
    color: 'orange',
    helpText: 'Für alle Eltern sichtbar, unabhängig von der Klasse',
    buttonText: 'Lehrerlied erstellen',
    placeholder: 'z.B. Lehrerband, Abschiedslied',
  },
};

export default function UnifiedAddModal({
  eventId,
  availableClasses,
  onClose,
  onSuccess,
  apiBasePath,
  initialTab = 'group',
  hideTabBar = false,
}: UnifiedAddModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [name, setName] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Reset form when tab changes
  useEffect(() => {
    setName('');
    setSelectedClassIds(new Set());
    setError('');
  }, [activeTab]);

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

    if (!name.trim()) {
      setError('Bitte geben Sie einen Namen ein');
      return;
    }

    if (activeTab === 'group' && selectedClassIds.size < 2) {
      setError('Bitte wählen Sie mindestens 2 Klassen aus');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (activeTab === 'group') {
        // Submit to groups endpoint
        const response = await fetch(`${apiBasePath}/events/${encodeURIComponent(eventId)}/groups`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            groupName: name.trim(),
            memberClassIds: Array.from(selectedClassIds),
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Fehler beim Erstellen der Gruppe');
        }
      } else {
        // Submit to collections endpoint for choir or teacher_song
        const response = await fetch(`${apiBasePath}/events/${encodeURIComponent(eventId)}/collections`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            type: activeTab,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Fehler beim Erstellen');
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentConfig = TAB_CONFIG[activeTab];

  // Dynamic color classes based on active tab
  const getTabButtonClasses = (tab: TabType) => {
    const isActive = activeTab === tab;
    const colorMap = {
      group: 'text-purple-700',
      choir: 'text-teal-700',
      teacher_song: 'text-orange-700',
    };

    if (isActive) {
      return `bg-white shadow-sm ${colorMap[tab]}`;
    }
    return 'text-gray-600 hover:text-gray-900';
  };

  const getSubmitButtonClasses = () => {
    const colorMap = {
      group: 'bg-purple-600 hover:bg-purple-700',
      choir: 'bg-teal-600 hover:bg-teal-700',
      teacher_song: 'bg-orange-600 hover:bg-orange-700',
    };
    return colorMap[activeTab];
  };

  const getHelpBoxClasses = () => {
    const colorMap = {
      group: 'bg-purple-50 border-purple-100 text-purple-700',
      choir: 'bg-teal-50 border-teal-100 text-teal-700',
      teacher_song: 'bg-orange-50 border-orange-100 text-orange-700',
    };
    return colorMap[activeTab];
  };

  const getCheckboxClasses = () => {
    const colorMap = {
      group: 'text-purple-600 focus:ring-purple-500',
      choir: 'text-teal-600 focus:ring-teal-500',
      teacher_song: 'text-orange-600 focus:ring-orange-500',
    };
    return colorMap[activeTab];
  };

  const getSelectedBorderClasses = () => {
    const colorMap = {
      group: 'border-purple-500 bg-purple-50',
      choir: 'border-teal-500 bg-teal-50',
      teacher_song: 'border-orange-500 bg-orange-50',
    };
    return colorMap[activeTab];
  };

  const getFocusRingClasses = () => {
    const colorMap = {
      group: 'focus:ring-purple-500/50 focus:border-purple-500',
      choir: 'focus:ring-teal-500/50 focus:border-teal-500',
      teacher_song: 'focus:ring-orange-500/50 focus:border-orange-500',
    };
    return colorMap[activeTab];
  };

  const canSubmit = activeTab === 'group'
    ? name.trim() && selectedClassIds.size >= 2
    : name.trim();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {hideTabBar ? currentConfig.buttonText : 'Gruppe erstellen'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Segmented Tabs */}
        {!hideTabBar && (
          <div className="flex rounded-lg bg-gray-100 p-1 gap-1 mb-6">
            {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${getTabButtonClasses(tab)}`}
              >
                {TAB_CONFIG[tab].label}
              </button>
            ))}
          </div>
        )}

        {/* Help Text Box */}
        <div className={`border rounded-lg p-3 mb-4 ${getHelpBoxClasses()}`}>
          <p className="text-sm">{currentConfig.helpText}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {activeTab === 'group' ? 'Gruppenname' : 'Name'} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 ${getFocusRingClasses()}`}
              placeholder={currentConfig.placeholder}
            />
          </div>

          {/* Class Selection (only for Group tab) */}
          {activeTab === 'group' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Klassen auswählen <span className="text-red-500">*</span>
                <span className="text-gray-500 font-normal ml-1">(min. 2)</span>
              </label>
              {availableClasses.length < 2 ? (
                <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                  <p className="text-sm">Sie benötigen mindestens 2 Klassen, um eine Gruppe zu erstellen.</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-60 overflow-y-auto">
                  {availableClasses.map((cls) => (
                    <label
                      key={cls.classId}
                      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors ${
                        selectedClassIds.has(cls.classId)
                          ? getSelectedBorderClasses()
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedClassIds.has(cls.classId)}
                        onChange={() => handleClassToggle(cls.classId)}
                        className={`w-4 h-4 border-gray-300 rounded ${getCheckboxClasses()}`}
                      />
                      <span className="text-sm text-gray-700">{cls.className}</span>
                    </label>
                  ))}
                </div>
              )}
              {selectedClassIds.size > 0 && (
                <p className="mt-2 text-sm text-gray-500">
                  {selectedClassIds.size} Klasse{selectedClassIds.size !== 1 ? 'n' : ''} ausgewählt
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
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
              disabled={isSubmitting || !canSubmit}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${getSubmitButtonClasses()}`}
            >
              {isSubmitting ? 'Wird erstellt...' : currentConfig.buttonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
