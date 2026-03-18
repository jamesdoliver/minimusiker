'use client';

import { useState, useEffect, useCallback } from 'react';

interface ViewEventAsModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
}

interface TeacherData {
  name: string;
  email: string;
}

interface ParentData {
  parentId: string;
  parentName: string;
  parentEmail: string;
  childName: string;
  hasAudioAccess: boolean;
}

interface ClassData {
  classId: string;
  className: string;
  childCount: number;
  parents: ParentData[];
}

interface PreviewData {
  teacher: TeacherData | null;
  classes: ClassData[];
}

export default function ViewEventAsModal({ isOpen, onClose, eventId }: ViewEventAsModalProps) {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [isMintingSession, setIsMintingSession] = useState<string | null>(null);

  const fetchPreviewData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/preview-data`);
      if (!response.ok) {
        throw new Error('Vorschaudaten konnten nicht geladen werden');
      }
      const data = await response.json();
      setPreviewData(data);
    } catch (err) {
      console.error('Error fetching preview data:', err);
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  // Fetch preview data when modal opens
  useEffect(() => {
    if (isOpen && eventId) {
      fetchPreviewData();
    }
    if (!isOpen) {
      setPreviewData(null);
      setError(null);
      setSelectedClassId(null);
      setIsMintingSession(null);
    }
  }, [isOpen, eventId, fetchPreviewData]);

  // Handle escape key
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleKeyDown]);

  const openPortal = async (type: 'teacher' | 'parent', parentId?: string) => {
    const mintKey = type === 'teacher' ? 'teacher' : parentId!;
    setIsMintingSession(mintKey);
    try {
      const response = await fetch('/api/admin/preview-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, eventId, parentId }),
      });
      if (!response.ok) {
        throw new Error('Session konnte nicht erstellt werden');
      }
      const { portalUrl } = await response.json();
      window.open(portalUrl, '_blank');
    } catch (err) {
      console.error('Error minting preview session:', err);
      setError(err instanceof Error ? err.message : 'Session konnte nicht erstellt werden');
    } finally {
      setIsMintingSession(null);
    }
  };

  const selectedClass = previewData?.classes.find((c) => c.classId === selectedClassId) ?? null;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Portal-Vorschau</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Cookie warning */}
        <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 text-xs text-amber-700">
          Hinweis: Das Öffnen einer Vorschau ersetzt eine eventuell vorhandene Pädagogen- oder Eltern-Session in diesem Browser. Verwende ein Inkognito-Fenster, um dies zu vermeiden.
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5a8a82]" />
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {previewData && !isLoading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Teacher Card */}
              <div className="border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#5a8a82]/10">
                    <svg className="w-5 h-5 text-[#5a8a82]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">Als Pädagoge ansehen</h3>
                </div>

                {previewData.teacher && previewData.teacher.email ? (
                  <>
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-900">{previewData.teacher.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{previewData.teacher.email}</p>
                    </div>
                    <button
                      onClick={() => openPortal('teacher')}
                      disabled={isMintingSession === 'teacher'}
                      className="w-full px-4 py-2 text-sm font-medium text-white bg-[#5a8a82] hover:bg-[#4a7a72] rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isMintingSession === 'teacher' ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                          Wird geöffnet...
                        </>
                      ) : (
                        'Pädagogen-Portal öffnen'
                      )}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 italic">Kein Pädagoge zugewiesen</p>
                )}
              </div>

              {/* Parent Card */}
              <div className="border border-gray-200 rounded-lg p-5">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#5a8a82]/10">
                    <svg className="w-5 h-5 text-[#5a8a82]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900">Als Elternteil ansehen</h3>
                </div>

                {previewData.classes.length > 0 ? (
                  <>
                    {/* Class dropdown */}
                    <select
                      value={selectedClassId ?? ''}
                      onChange={(e) => setSelectedClassId(e.target.value || null)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#5a8a82]/30 focus:border-[#5a8a82] mb-3"
                    >
                      <option value="">Klasse wählen...</option>
                      {previewData.classes.map((cls) => (
                        <option key={cls.classId} value={cls.classId}>
                          {cls.className} — {cls.childCount} Kinder
                        </option>
                      ))}
                    </select>

                    {/* Parent list */}
                    {selectedClass && (
                      selectedClass.parents.length > 0 ? (
                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {selectedClass.parents.map((parent) => (
                            <button
                              key={`${parent.parentId}-${parent.childName}`}
                              onClick={() => openPortal('parent', parent.parentId)}
                              disabled={isMintingSession === parent.parentId}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed group"
                            >
                              {/* Audio access badge */}
                              <span className={`flex-shrink-0 w-2 h-2 rounded-full ${parent.hasAudioAccess ? 'bg-green-500' : 'bg-gray-300'}`} />

                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 truncate">{parent.childName}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {parent.parentName} &middot; {parent.parentEmail}
                                </p>
                              </div>

                              {/* External link icon or loading spinner */}
                              <div className="flex-shrink-0 text-gray-400 group-hover:text-[#5a8a82]">
                                {isMintingSession === parent.parentId ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#5a8a82]" />
                                ) : (
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                                    />
                                  </svg>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 italic py-2">Keine Registrierungen</p>
                      )
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400 italic">Keine Klassen vorhanden</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
