'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { TeacherEventView, TeacherClassView, Song, ClassGroup } from '@/lib/types/teacher';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import InviteTeacherModal from '@/components/teacher/InviteTeacherModal';
import AlbumLayoutModal from '@/components/teacher/AlbumLayoutModal';

function formatDate(dateStr: string): string {
  if (!dateStr) return 'Datum unbekannt';
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function getStatusBadge(status: 'upcoming' | 'in-progress' | 'completed' | 'needs-setup') {
  switch (status) {
    case 'upcoming':
      return (
        <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-700">
          Bevorstehend
        </span>
      );
    case 'in-progress':
      return (
        <span className="px-3 py-1 text-sm font-medium rounded-full bg-yellow-100 text-yellow-700">
          Diese Woche
        </span>
      );
    case 'completed':
      return (
        <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-700">
          Abgeschlossen
        </span>
      );
    case 'needs-setup':
      return (
        <span className="px-3 py-1 text-sm font-medium rounded-full bg-yellow-100 text-yellow-800">
          Setup erforderlich
        </span>
      );
  }
}

interface AddClassModalProps {
  eventId: string;
  onClose: () => void;
  onClassAdded: () => void;
}

function AddClassModal({ eventId, onClose, onClassAdded }: AddClassModalProps) {
  const [className, setClassName] = useState('');
  const [numChildren, setNumChildren] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) {
      setError('Bitte geben Sie einen Klassennamen ein');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/teacher/events/${encodeURIComponent(eventId)}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: className.trim(),
          numChildren: numChildren ? parseInt(numChildren, 10) : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Hinzufügen');
      }

      onClassAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Hinzufügen');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Klasse hinzufügen</h3>
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
              Klassenname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
              placeholder="z.B. Klasse 3a, Jahrgang 2, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anzahl Kinder
            </label>
            <input
              type="number"
              value={numChildren}
              onChange={(e) => setNumChildren(e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
              placeholder="z.B. 25"
            />
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
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Wird hinzugefügt...' : 'Hinzufügen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AddSongModalProps {
  classId: string;
  eventId: string;
  onClose: () => void;
  onSongAdded: () => void;
}

function AddSongModal({ classId, eventId, onClose, onSongAdded }: AddSongModalProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Bitte geben Sie einen Titel ein');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/teacher/classes/${classId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), artist: artist.trim(), notes: notes.trim(), eventId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Hinzufügen');
      }

      onSongAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Hinzufügen');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Lied hinzufügen</h3>
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
              Titel <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
              placeholder="z.B. Alle meine Entchen"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Künstler/Interpret
            </label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
              placeholder="z.B. Volkslied"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anmerkungen
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
              placeholder="z.B. Mit Bewegungen, langsames Tempo..."
            />
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
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Wird hinzugefügt...' : 'Hinzufügen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SongCard({ song, onDelete }: { song: Song; onDelete: (songId: string) => void }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Möchten Sie dieses Lied wirklich löschen?')) return;
    setIsDeleting(true);
    onDelete(song.id);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-4 flex items-start justify-between group">
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        </div>
        <div>
          <p className="font-medium text-gray-900">{song.title}</p>
          {song.artist && <p className="text-sm text-gray-500">{song.artist}</p>}
          {song.notes && <p className="text-sm text-gray-400 mt-1">{song.notes}</p>}
        </div>
      </div>
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-500 transition-all"
        title="Löschen"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </div>
  );
}

interface EditClassModalProps {
  classId: string;
  className: string;
  numChildren?: number;
  onClose: () => void;
  onClassUpdated: () => void;
}

function EditClassModal({ classId, className: initialName, numChildren: initialChildren, onClose, onClassUpdated }: EditClassModalProps) {
  const [className, setClassName] = useState(initialName);
  const [numChildren, setNumChildren] = useState(initialChildren?.toString() || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!className.trim()) {
      setError('Bitte geben Sie einen Klassennamen ein');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/teacher/classes/${encodeURIComponent(classId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: className.trim(),
          numChildren: numChildren ? parseInt(numChildren, 10) : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Aktualisieren');
      }

      onClassUpdated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Aktualisieren');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Klasse bearbeiten</h3>
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
              Klassenname <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
              placeholder="z.B. Klasse 3a, Jahrgang 2, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Anzahl Kinder
            </label>
            <input
              type="number"
              value={numChildren}
              onChange={(e) => setNumChildren(e.target.value)}
              min="0"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
              placeholder="z.B. 25"
            />
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
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteClassModalProps {
  classId: string;
  className: string;
  onClose: () => void;
  onClassDeleted: () => void;
}

function DeleteClassModal({ classId, className, onClose, onClassDeleted }: DeleteClassModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');

    try {
      const response = await fetch(`/api/teacher/classes/${encodeURIComponent(classId)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Löschen');
      }

      onClassDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Klasse löschen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">Achtung</p>
              <p className="text-sm text-yellow-700 mt-1">
                Möchten Sie die Klasse <strong>&quot;{className}&quot;</strong> wirklich löschen?
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Löschen...' : 'Löschen'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CreateGroupModalProps {
  eventId: string;
  classes: TeacherClassView[];
  onClose: () => void;
  onGroupCreated: () => void;
}

function CreateGroupModal({ eventId, classes, onClose, onGroupCreated }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Filter out default classes from selection
  const availableClasses = classes.filter(c => !c.isDefault);

  const toggleClass = (classId: string) => {
    setSelectedClassIds(prev =>
      prev.includes(classId)
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupName.trim()) {
      setError('Bitte geben Sie einen Gruppennamen ein');
      return;
    }

    if (selectedClassIds.length < 2) {
      setError('Bitte wählen Sie mindestens 2 Klassen aus');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/teacher/events/${encodeURIComponent(eventId)}/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: groupName.trim(),
          memberClassIds: selectedClassIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Erstellen');
      }

      onGroupCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Klassen zusammen singen lassen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800">Gruppen-Aufnahme</p>
              <p className="text-sm text-blue-700 mt-1">
                Eine Gruppe erhält eine gemeinsame Audio-Aufnahme.
                Fügen Sie nach der Erstellung Lieder zur Gruppe hinzu.
              </p>
            </div>
          </div>
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
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
              placeholder="z.B. Klassen 2a + 2b, Schulchor, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Klassen auswählen <span className="text-red-500">*</span>
              <span className="font-normal text-gray-500 ml-1">(mindestens 2)</span>
            </label>
            {availableClasses.length < 2 ? (
              <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                <p className="text-sm">Sie benötigen mindestens 2 Klassen, um eine Gruppe zu erstellen.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availableClasses.map((cls) => (
                  <label
                    key={cls.classId}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedClassIds.includes(cls.classId)
                        ? 'border-pink-500 bg-pink-50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedClassIds.includes(cls.classId)}
                      onChange={() => toggleClass(cls.classId)}
                      className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{cls.className}</p>
                      <p className="text-sm text-gray-500">
                        {cls.numChildren ? `${cls.numChildren} Kinder` : 'Keine Kinderanzahl'}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {selectedClassIds.length > 0 && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">{selectedClassIds.length}</span> Klasse(n) ausgewählt
            </div>
          )}

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
              disabled={isSubmitting || availableClasses.length < 2}
              className="flex-1 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Wird erstellt...' : 'Gruppe erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteGroupModalProps {
  groupId: string;
  groupName: string;
  onClose: () => void;
  onGroupDeleted: () => void;
}

function DeleteGroupModal({ groupId, groupName, onClose, onGroupDeleted }: DeleteGroupModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');

    try {
      const response = await fetch(`/api/teacher/groups/${encodeURIComponent(groupId)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Löschen');
      }

      onGroupDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Gruppe löschen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">Achtung</p>
              <p className="text-sm text-yellow-700 mt-1">
                Möchten Sie die Gruppe <strong>&quot;{groupName}&quot;</strong> wirklich löschen?
                Die einzelnen Klassen bleiben erhalten.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Löschen...' : 'Löschen'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AddCollectionModalProps {
  eventId: string;
  onClose: () => void;
  onCollectionAdded: () => void;
}

function AddCollectionModal({ eventId, onClose, onCollectionAdded }: AddCollectionModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'choir' | 'teacher_song'>('choir');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Bitte geben Sie einen Namen ein');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/teacher/events/${encodeURIComponent(eventId)}/collections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Fehler beim Erstellen');
      }

      onCollectionAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Erstellen');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Sammlung hinzufügen</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800">Was ist eine Sammlung?</p>
              <p className="text-sm text-blue-700 mt-1">
                Sammlungen enthalten Lieder, die für alle Eltern sichtbar sind - unabhängig von der Klasse ihres Kindes.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Typ <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-3">
              <label
                className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  type === 'choir'
                    ? 'border-teal-500 bg-teal-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value="choir"
                  checked={type === 'choir'}
                  onChange={() => setType('choir')}
                  className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                />
                <div>
                  <p className="font-medium text-gray-900">Chor</p>
                  <p className="text-xs text-gray-500">Gemeinsame Chorlieder</p>
                </div>
              </label>
              <label
                className={`flex-1 flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  type === 'teacher_song'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value="teacher_song"
                  checked={type === 'teacher_song'}
                  onChange={() => setType('teacher_song')}
                  className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                />
                <div>
                  <p className="font-medium text-gray-900">Lehrerlied</p>
                  <p className="text-xs text-gray-500">Lieder der Lehrkräfte</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
              placeholder={type === 'choir' ? 'z.B. Schulchor, Klasse 3+4 Chor' : 'z.B. Lehrerband, Abschiedslied'}
            />
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
              disabled={isSubmitting}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${
                type === 'choir'
                  ? 'bg-teal-600 hover:bg-teal-700'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {isSubmitting ? 'Wird erstellt...' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CollectionCard({
  collection,
  eventId,
  isEditable,
  onCollectionUpdated,
}: {
  collection: TeacherClassView;
  eventId: string;
  isEditable: boolean;
  onCollectionUpdated: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddSong, setShowAddSong] = useState(false);
  const [showDeleteClass, setShowDeleteClass] = useState(false);

  const isChoir = collection.classType === 'choir';

  const handleDeleteSong = async (songId: string) => {
    try {
      const response = await fetch(`/api/teacher/songs/${songId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete song');
      }

      onCollectionUpdated();
    } catch (err) {
      console.error('Error deleting song:', err);
      alert('Fehler beim Löschen des Liedes');
    }
  };

  return (
    <div className={`bg-white rounded-xl border-2 ${isChoir ? 'border-teal-200' : 'border-orange-200'} shadow-sm overflow-hidden`}>
      {/* Collection Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full px-5 py-4 flex items-center justify-between ${isChoir ? 'hover:bg-teal-50/50' : 'hover:bg-orange-50/50'} transition-colors`}
      >
        <div className="flex items-center gap-4">
          <div className={`w-10 h-10 rounded-full ${isChoir ? 'bg-teal-100' : 'bg-orange-100'} flex items-center justify-center`}>
            {isChoir ? (
              <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            )}
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{collection.className}</h3>
              <span className={`px-2 py-0.5 text-xs ${isChoir ? 'bg-teal-100 text-teal-700' : 'bg-orange-100 text-orange-700'} rounded-full font-medium`}>
                {isChoir ? 'Chor' : 'Lehrerlied'}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {collection.songs.length} {collection.songs.length === 1 ? 'Lied' : 'Lieder'} · Sichtbar für alle Eltern
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Audio Status Badges */}
          <div className="flex gap-1">
            {collection.audioStatus.hasRawAudio && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">Raw</span>
            )}
            {collection.audioStatus.hasPreview && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded">Vorschau</span>
            )}
            {collection.audioStatus.hasFinal && (
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-600 rounded">Final</span>
            )}
          </div>
          {/* Delete button */}
          {isEditable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteClass(true);
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Sammlung löschen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className={`border-t ${isChoir ? 'border-teal-100' : 'border-orange-100'} px-5 py-4`}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-700">Lieder in dieser Sammlung</h4>
            {isEditable && (
              <button
                onClick={() => setShowAddSong(true)}
                className={`text-sm ${isChoir ? 'text-teal-600 hover:text-teal-700' : 'text-orange-600 hover:text-orange-700'} font-medium flex items-center gap-1`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Lied hinzufügen
              </button>
            )}
          </div>

          {collection.songs.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <svg
                className="w-8 h-8 mx-auto mb-2 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              <p className="text-sm">Noch keine Lieder in dieser Sammlung</p>
              {isEditable && (
                <button
                  onClick={() => setShowAddSong(true)}
                  className={`mt-2 text-sm ${isChoir ? 'text-teal-600 hover:text-teal-700' : 'text-orange-600 hover:text-orange-700'}`}
                >
                  Erstes Lied hinzufügen
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {collection.songs.map((song) => (
                <SongCard key={song.id} song={song} onDelete={isEditable ? handleDeleteSong : () => {}} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Song Modal */}
      {showAddSong && (
        <AddSongModal
          classId={collection.classId}
          eventId={eventId}
          onClose={() => setShowAddSong(false)}
          onSongAdded={onCollectionUpdated}
        />
      )}

      {/* Delete Collection Modal */}
      {showDeleteClass && (
        <DeleteClassModal
          classId={collection.classId}
          className={collection.className}
          onClose={() => setShowDeleteClass(false)}
          onClassDeleted={onCollectionUpdated}
        />
      )}
    </div>
  );
}

function GroupCard({
  group,
  eventId,
  isEditable,
  onGroupsUpdated,
}: {
  group: ClassGroup;
  eventId: string;
  isEditable: boolean;
  onGroupsUpdated: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddSong, setShowAddSong] = useState(false);
  const [showDeleteGroup, setShowDeleteGroup] = useState(false);

  const handleDeleteSong = async (songId: string) => {
    try {
      const response = await fetch(`/api/teacher/songs/${songId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete song');
      }

      onGroupsUpdated();
    } catch (err) {
      console.error('Error deleting song:', err);
      alert('Fehler beim Löschen des Liedes');
    }
  };

  const memberClassNames = group.memberClasses?.map(c => c.className).join(', ') || '';

  return (
    <div className="bg-white rounded-xl border-2 border-purple-200 shadow-sm overflow-hidden">
      {/* Group Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-purple-50/50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{group.groupName}</h3>
              <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full font-medium">
                Gruppe
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {memberClassNames || 'Keine Klassen'} · {group.songs.length} {group.songs.length === 1 ? 'Lied' : 'Lieder'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Audio Status Badges */}
          <div className="flex gap-1">
            {group.audioStatus.hasRawAudio && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">Raw</span>
            )}
            {group.audioStatus.hasPreview && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded">Vorschau</span>
            )}
            {group.audioStatus.hasFinal && (
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-600 rounded">Final</span>
            )}
          </div>
          {/* Delete button */}
          {isEditable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteGroup(true);
              }}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Gruppe löschen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-purple-100 px-5 py-4">
          {/* Member Classes Info */}
          <div className="mb-4 p-3 bg-purple-50 rounded-lg">
            <p className="text-sm font-medium text-purple-800 mb-1">Enthaltene Klassen:</p>
            <p className="text-sm text-purple-700">{memberClassNames || 'Keine Klassen zugewiesen'}</p>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-700">Lieder für diese Gruppe</h4>
            {isEditable && (
              <button
                onClick={() => setShowAddSong(true)}
                className="text-sm text-pink-600 hover:text-pink-700 font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Lied hinzufügen
              </button>
            )}
          </div>

          {group.songs.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <svg
                className="w-8 h-8 mx-auto mb-2 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              <p className="text-sm">Noch keine Lieder für diese Gruppe</p>
              {isEditable && (
                <button
                  onClick={() => setShowAddSong(true)}
                  className="mt-2 text-sm text-pink-600 hover:text-pink-700"
                >
                  Erstes Lied hinzufügen
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {group.songs.map((song) => (
                <SongCard key={song.id} song={song} onDelete={isEditable ? handleDeleteSong : () => {}} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Song Modal - Uses group ID as class ID */}
      {showAddSong && (
        <AddSongModal
          classId={group.groupId}
          eventId={eventId}
          onClose={() => setShowAddSong(false)}
          onSongAdded={onGroupsUpdated}
        />
      )}

      {/* Delete Group Modal */}
      {showDeleteGroup && (
        <DeleteGroupModal
          groupId={group.groupId}
          groupName={group.groupName}
          onClose={() => setShowDeleteGroup(false)}
          onGroupDeleted={onGroupsUpdated}
        />
      )}
    </div>
  );
}

function ClassCard({
  cls,
  eventId,
  isEditable,
  onSongsUpdated,
}: {
  cls: TeacherClassView;
  eventId: string;
  isEditable: boolean;
  onSongsUpdated: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddSong, setShowAddSong] = useState(false);
  const [showEditClass, setShowEditClass] = useState(false);
  const [showDeleteClass, setShowDeleteClass] = useState(false);

  const handleDeleteSong = async (songId: string) => {
    try {
      const response = await fetch(`/api/teacher/songs/${songId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete song');
      }

      onSongsUpdated();
    } catch (err) {
      console.error('Error deleting song:', err);
      alert('Fehler beim Löschen des Liedes');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Class Header - Always Visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-pink-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{cls.className}</h3>
              {cls.isDefault && (
                <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full font-medium">
                  Standard
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500">
              {cls.numChildren ? `${cls.numChildren} Kinder` : 'Keine Kinderanzahl'} ·{' '}
              {cls.songs.length} {cls.songs.length === 1 ? 'Lied' : 'Lieder'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Audio Status Badges */}
          <div className="flex gap-1">
            {cls.audioStatus.hasRawAudio && (
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">Raw</span>
            )}
            {cls.audioStatus.hasPreview && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded">Vorschau</span>
            )}
            {cls.audioStatus.hasFinal && (
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-600 rounded">Final</span>
            )}
          </div>
          {/* Edit/Delete buttons - only for editable non-default classes */}
          {isEditable && !cls.isDefault && (
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowEditClass(true);
                }}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Klasse bearbeiten"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteClass(true);
                }}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Klasse löschen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100 px-5 py-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-700">Lieder</h4>
            {isEditable && (
              <button
                onClick={() => setShowAddSong(true)}
                className="text-sm text-pink-600 hover:text-pink-700 font-medium flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Lied hinzufügen
              </button>
            )}
          </div>

          {cls.songs.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <svg
                className="w-8 h-8 mx-auto mb-2 text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
              <p className="text-sm">Noch keine Lieder hinzugefügt</p>
              {isEditable && (
                <button
                  onClick={() => setShowAddSong(true)}
                  className="mt-2 text-sm text-pink-600 hover:text-pink-700"
                >
                  Erstes Lied hinzufügen
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {cls.songs.map((song) => (
                <SongCard key={song.id} song={song} onDelete={isEditable ? handleDeleteSong : () => {}} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Song Modal */}
      {showAddSong && (
        <AddSongModal
          classId={cls.classId}
          eventId={eventId}
          onClose={() => setShowAddSong(false)}
          onSongAdded={onSongsUpdated}
        />
      )}

      {/* Edit Class Modal */}
      {showEditClass && (
        <EditClassModal
          classId={cls.classId}
          className={cls.className}
          numChildren={cls.numChildren}
          onClose={() => setShowEditClass(false)}
          onClassUpdated={onSongsUpdated}
        />
      )}

      {/* Delete Class Modal */}
      {showDeleteClass && (
        <DeleteClassModal
          classId={cls.classId}
          className={cls.className}
          onClose={() => setShowDeleteClass(false)}
          onClassDeleted={onSongsUpdated}
        />
      )}
    </div>
  );
}

export default function TeacherEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<TeacherEventView | null>(null);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [collections, setCollections] = useState<TeacherClassView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddClass, setShowAddClass] = useState(false);
  const [showAddCollection, setShowAddCollection] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showAlbumLayoutModal, setShowAlbumLayoutModal] = useState(false);

  const eventId = params.eventId as string;

  useEffect(() => {
    if (eventId) {
      fetchEventDetail();
      fetchGroups();
      fetchCollections();
    }
  }, [eventId]);

  const fetchEventDetail = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/teacher/events/${encodeURIComponent(eventId)}`);

      if (response.status === 401) {
        router.push('/paedagogen-login');
        return;
      }

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Event nicht gefunden');
        }
        throw new Error('Fehler beim Laden der Event-Details');
      }

      const data = await response.json();
      setEvent(data.event);
    } catch (err) {
      console.error('Error fetching event detail:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch(`/api/teacher/events/${encodeURIComponent(eventId)}/groups`);
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (err) {
      console.error('Error fetching groups:', err);
    }
  };

  const fetchCollections = async () => {
    try {
      const response = await fetch(`/api/teacher/events/${encodeURIComponent(eventId)}/collections`);
      if (response.ok) {
        const data = await response.json();
        setCollections(data.collections || []);
      }
    } catch (err) {
      console.error('Error fetching collections:', err);
    }
  };

  const handleRefresh = () => {
    fetchEventDetail();
    fetchGroups();
    fetchCollections();
  };

  const isEditable = event?.status !== 'completed';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Link
            href="/paedagogen"
            className="text-pink-600 hover:text-pink-700 flex items-center gap-1 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Zurück zur Übersicht
          </Link>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600">Fehler: {error || 'Event nicht gefunden'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Back Navigation */}
        <Link
          href="/paedagogen"
          className="text-pink-600 hover:text-pink-700 flex items-center gap-1 mb-6"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück zur Übersicht
        </Link>

        {/* Header Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            {/* Left: Event Info */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                {getStatusBadge(event.status)}
                {!isEditable && (
                  <span className="text-sm text-gray-500">(Nur Lesen)</span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.schoolName}</h1>
              <p className="text-gray-600">{formatDate(event.eventDate)}</p>
              {event.eventType && (
                <p className="text-gray-500 mt-1">{event.eventType}</p>
              )}
            </div>

            {/* Right: Stats and Invite */}
            <div className="flex flex-col gap-4 items-end">
              <div className="flex gap-4">
                <div className="bg-pink-50 rounded-lg px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-pink-600">{event.classes.length}</p>
                  <p className="text-sm text-pink-700">{event.classes.length === 1 ? 'Klasse' : 'Klassen'}</p>
                </div>
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {event.classes.reduce((sum, cls) => sum + cls.songs.length, 0)}
                  </p>
                  <p className="text-sm text-blue-700">Lieder</p>
                </div>
              </div>
              {/* Invite Button */}
              <button
                onClick={() => setShowInviteModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Kolleg:in einladen
              </button>
            </div>
          </div>

          {/* Edit Notice */}
          {isEditable && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex items-start gap-3 bg-blue-50 rounded-lg p-4">
                <svg
                  className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-blue-800">Sie können Lieder bearbeiten</p>
                  <p className="text-sm text-blue-700 mt-1">
                    Klicken Sie auf eine Klasse, um Lieder hinzuzufügen oder zu entfernen.
                    Änderungen sind bis zum Event-Datum möglich.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Classes Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold text-gray-900">Klassen & Lieder</h2>
              <button
                onClick={() => setShowAlbumLayoutModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                title="Album-Reihenfolge für das gedruckte Album festlegen"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                Album-Reihenfolge
              </button>
            </div>
            {isEditable && (
              <div className="flex gap-2 flex-wrap justify-end">
                <button
                  onClick={() => setShowAddCollection(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
                  title="Chor oder Lehrerlied hinzufügen (sichtbar für alle Eltern)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Sammlung
                </button>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  title="Mehrere Klassen für eine gemeinsame Aufnahme gruppieren"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Gruppe
                </button>
                <button
                  onClick={() => setShowAddClass(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Klasse
                </button>
              </div>
            )}
          </div>

          {event.classes.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Noch keine Klassen</h3>
              <p className="text-gray-600 mb-4">
                Fügen Sie eine Klasse hinzu, um Lieder zu verwalten.
              </p>
              {isEditable && (
                <button
                  onClick={() => setShowAddClass(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Erste Klasse hinzufügen
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {event.classes.map((cls) => (
                <ClassCard
                  key={cls.classId}
                  cls={cls}
                  eventId={event.eventId}
                  isEditable={isEditable}
                  onSongsUpdated={handleRefresh}
                />
              ))}
            </div>
          )}
        </div>

        {/* Groups Section */}
        {groups.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Gruppen</h2>
              <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full font-medium">
                Klassen die zusammen singen
              </span>
            </div>
            <div className="space-y-4">
              {groups.map((group) => (
                <GroupCard
                  key={group.groupId}
                  group={group}
                  eventId={event.eventId}
                  isEditable={isEditable}
                  onGroupsUpdated={handleRefresh}
                />
              ))}
            </div>
          </div>
        )}

        {/* Collections Section (Choir + Teacher Songs) */}
        {collections.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Sammlungen</h2>
              <span className="px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded-full font-medium">
                Sichtbar für alle Eltern
              </span>
            </div>
            <div className="space-y-4">
              {collections.map((collection) => (
                <CollectionCard
                  key={collection.classId}
                  collection={collection}
                  eventId={event.eventId}
                  isEditable={isEditable}
                  onCollectionUpdated={handleRefresh}
                />
              ))}
            </div>
          </div>
        )}

        {/* Add Class Modal */}
        {showAddClass && (
          <AddClassModal
            eventId={event.eventId}
            onClose={() => setShowAddClass(false)}
            onClassAdded={handleRefresh}
          />
        )}

        {/* Add Collection Modal */}
        {showAddCollection && (
          <AddCollectionModal
            eventId={event.eventId}
            onClose={() => setShowAddCollection(false)}
            onCollectionAdded={handleRefresh}
          />
        )}

        {/* Create Group Modal */}
        {showCreateGroup && (
          <CreateGroupModal
            eventId={event.eventId}
            classes={event.classes}
            onClose={() => setShowCreateGroup(false)}
            onGroupCreated={handleRefresh}
          />
        )}

        {/* Invite Teacher Modal */}
        {showInviteModal && (
          <InviteTeacherModal
            eventId={event.eventId}
            schoolName={event.schoolName}
            onClose={() => setShowInviteModal(false)}
          />
        )}

        {/* Album Layout Modal */}
        {showAlbumLayoutModal && (
          <AlbumLayoutModal
            eventId={event.eventId}
            onClose={() => setShowAlbumLayoutModal(false)}
            onSave={handleRefresh}
          />
        )}
      </div>
    </div>
  );
}
