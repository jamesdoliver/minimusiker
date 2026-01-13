'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { TeacherEventView, TeacherClassView, Song } from '@/lib/types/teacher';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

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

function getStatusBadge(status: 'upcoming' | 'in-progress' | 'completed') {
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
            <h3 className="font-semibold text-gray-900">{cls.className}</h3>
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
    </div>
  );
}

export default function TeacherEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<TeacherEventView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddClass, setShowAddClass] = useState(false);

  const eventId = params.eventId as string;

  useEffect(() => {
    if (eventId) {
      fetchEventDetail();
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

            {/* Right: Stats */}
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
            <h2 className="text-xl font-semibold text-gray-900">Klassen & Lieder</h2>
            {isEditable && (
              <button
                onClick={() => setShowAddClass(true)}
                className="flex items-center gap-2 px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Klasse hinzufügen
              </button>
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
                  onSongsUpdated={fetchEventDetail}
                />
              ))}
            </div>
          )}
        </div>

        {/* Add Class Modal */}
        {showAddClass && (
          <AddClassModal
            eventId={event.eventId}
            onClose={() => setShowAddClass(false)}
            onClassAdded={fetchEventDetail}
          />
        )}
      </div>
    </div>
  );
}
