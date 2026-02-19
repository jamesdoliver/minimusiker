'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlbumTrack, AlbumTrackUpdate } from '@/lib/services/teacherService';

interface AlbumLayoutModalProps {
  eventId: string;
  apiBaseUrl: string;
  classesWithoutSongs?: string[];
  onClose: () => void;
  onSave?: () => void;
}

type ModalState = 'loading' | 'ready' | 'saving' | 'error';

interface EditableTrack extends AlbumTrack {
  editedTitle: string;
  editedClassName: string;
}

// Sortable track item component
function SortableTrackItem({
  track,
  index,
  onTitleChange,
  onClassNameChange,
}: {
  track: EditableTrack;
  index: number;
  onTitleChange: (songId: string, title: string) => void;
  onClassNameChange: (songId: string, className: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.songId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg mb-2 ${
        isDragging ? 'shadow-lg ring-2 ring-pink-200' : ''
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 touch-none"
        title="Ziehen zum Sortieren"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>

      {/* Track number */}
      <span className="w-8 text-sm font-medium text-gray-500">{index + 1}.</span>

      {/* Song title input */}
      <input
        type="text"
        value={track.editedTitle}
        onChange={(e) => onTitleChange(track.songId, e.target.value)}
        className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-300 focus:outline-none focus:ring-1 focus:ring-pink-200"
        placeholder="Liedtitel"
      />

      {/* Separator */}
      <span className="text-gray-400">-</span>

      {/* Class name input */}
      <input
        type="text"
        value={track.editedClassName}
        onChange={(e) => onClassNameChange(track.songId, e.target.value)}
        className="w-40 px-2 py-1 text-sm border border-gray-200 rounded focus:border-pink-300 focus:outline-none focus:ring-1 focus:ring-pink-200"
        placeholder="Klasse"
      />

      {/* Class type badge */}
      {track.classType !== 'regular' && (
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          track.classType === 'choir'
            ? 'bg-purple-100 text-purple-700'
            : 'bg-amber-100 text-amber-700'
        }`}>
          {track.classType === 'choir' ? 'Chor' : 'Lehrer'}
        </span>
      )}
    </div>
  );
}

export default function AlbumLayoutModal({
  eventId,
  apiBaseUrl,
  classesWithoutSongs,
  onClose,
  onSave,
}: AlbumLayoutModalProps) {
  const [state, setState] = useState<ModalState>('loading');
  const [tracks, setTracks] = useState<EditableTrack[]>([]);
  const [error, setError] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch tracks on mount — cache-bust with timestamp to prevent stale data
  useEffect(() => {
    async function fetchTracks() {
      try {
        const url = `${apiBaseUrl}${apiBaseUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;
        console.log('[AlbumLayout] GET', url);
        const response = await fetch(url, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Fehler beim Laden der Tracks');
        }

        const data = await response.json();
        console.log('[AlbumLayout] GET response:', data.tracks?.length, 'tracks',
          data.tracks?.map((t: AlbumTrack) => `${t.albumOrder}. ${t.songTitle}`));
        const editableTracks: EditableTrack[] = data.tracks.map((t: AlbumTrack) => ({
          ...t,
          editedTitle: t.songTitle,
          editedClassName: t.className,
        }));

        setTracks(editableTracks);
        setState('ready');
      } catch (err) {
        console.error('Error fetching tracks:', err);
        setError(err instanceof Error ? err.message : 'Fehler beim Laden');
        setState('error');
      }
    }

    fetchTracks();
  }, [eventId, apiBaseUrl]);

  // Check for changes
  useEffect(() => {
    if (state !== 'ready') return;

    const changed = tracks.some((track, index) => {
      const orderChanged = track.albumOrder !== index + 1;
      const titleChanged = track.editedTitle !== track.originalTitle;
      const classNameChanged = track.editedClassName !== track.originalClassName;
      return orderChanged || titleChanged || classNameChanged;
    });

    setHasChanges(changed);
  }, [tracks, state]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setTracks((items) => {
        const oldIndex = items.findIndex((item) => item.songId === active.id);
        const newIndex = items.findIndex((item) => item.songId === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleTitleChange = (songId: string, title: string) => {
    setTracks((items) =>
      items.map((item) =>
        item.songId === songId ? { ...item, editedTitle: title } : item
      )
    );
  };

  const handleClassNameChange = (songId: string, className: string) => {
    setTracks((items) =>
      items.map((item) =>
        item.songId === songId ? { ...item, editedClassName: className } : item
      )
    );
  };

  const handleSave = async () => {
    setState('saving');
    setError('');

    try {
      // Build update payload
      const updates: AlbumTrackUpdate[] = tracks.map((track, index) => ({
        songId: track.songId,
        albumOrder: index + 1,
        classId: track.classId,
        // Only include title if changed
        ...(track.editedTitle !== track.originalTitle && { title: track.editedTitle }),
        // Only include className if changed
        ...(track.editedClassName !== track.originalClassName && { className: track.editedClassName }),
      }));

      console.log('[AlbumLayout] PUT', apiBaseUrl, 'updates:', updates.map(u => `${u.albumOrder}. ${u.songId}`));

      const response = await fetch(apiBaseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tracks: updates }),
      });

      const putResult = await response.json();
      console.log('[AlbumLayout] PUT response:', response.status, putResult);

      if (!response.ok) {
        throw new Error(putResult.error || 'Fehler beim Speichern');
      }

      // Verification: re-fetch to confirm save persisted
      const verifyUrl = `${apiBaseUrl}${apiBaseUrl.includes('?') ? '&' : '?'}_t=${Date.now()}`;
      const verifyResponse = await fetch(verifyUrl, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
        },
      });
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        const verifyOrder = verifyData.tracks?.map((t: AlbumTrack) => t.songId);
        const expectedOrder = updates.map(u => u.songId);
        const orderMatch = JSON.stringify(verifyOrder) === JSON.stringify(expectedOrder);
        console.log('[AlbumLayout] VERIFY after save:', orderMatch ? 'MATCH' : 'MISMATCH',
          { expected: expectedOrder, actual: verifyOrder });
        if (!orderMatch) {
          console.error('[AlbumLayout] SAVE DID NOT PERSIST! Expected:', expectedOrder, 'Got:', verifyOrder);
        }
      }

      // Update original values to reflect saved state
      setTracks((items) =>
        items.map((item, index) => ({
          ...item,
          albumOrder: index + 1,
          originalTitle: item.editedTitle,
          originalClassName: item.editedClassName,
          songTitle: item.editedTitle,
          className: item.editedClassName,
        }))
      );

      setHasChanges(false);
      setState('ready');

      // Notify parent to refresh
      onSave?.();
      onClose();
    } catch (err) {
      console.error('Error saving album order:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Speichern');
      setState('ready');
    }
  };

  const missingSongs = classesWithoutSongs && classesWithoutSongs.length > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Album-Reihenfolge</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Missing songs warning */}
          {missingSongs && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-yellow-800">
                  Folgende Klassen haben noch keine Lieder und fehlen in der Reihenfolge:{' '}
                  <span className="font-medium">{classesWithoutSongs!.join(', ')}</span>
                </p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {state === 'loading' && (
            <div className="py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Tracks werden geladen...</p>
            </div>
          )}

          {/* Error State */}
          {state === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-800">Fehler beim Laden</p>
                  <p className="text-sm text-red-700 mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Ready State - Track List */}
          {(state === 'ready' || state === 'saving') && (
            <>
              {tracks.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <p>Keine Lieder vorhanden</p>
                  <p className="text-sm mt-1">Fügen Sie zuerst Lieder zu den Klassen hinzu.</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Ziehen Sie die Lieder in die gewünschte Reihenfolge für das gedruckte Album.
                    Sie können auch Titel und Klassennamen bearbeiten.
                  </p>

                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={tracks.map((t) => t.songId)}
                      strategy={verticalListSortingStrategy}
                    >
                      {tracks.map((track, index) => (
                        <SortableTrackItem
                          key={track.songId}
                          track={track}
                          index={index}
                          onTitleChange={handleTitleChange}
                          onClassNameChange={handleClassNameChange}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                </>
              )}

              {/* Inline error for save failures */}
              {error && state === 'ready' && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            disabled={state === 'saving'}
            className="px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSave}
            disabled={state === 'saving' || state === 'loading' || !hasChanges || tracks.length === 0}
            className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {state === 'saving' && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
