'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Schulsong, SchulsongProduktionStatus } from '@/lib/types/airtable';
import { SCHULSONG_PRODUKTION_STAGES } from '@/lib/types/airtable';
import SchulsongDetailModal from './SchulsongDetailModal';

interface SchulsongKanbanProps {
  schulsongs: Schulsong[];
  onUpdate: (id: string, data: Record<string, any>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRefresh: () => void;
}

function SchulsongTypBadge({ typ }: { typ?: string }) {
  if (!typ) return null;
  const isPool = typ === 'Poolsong';
  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
        isPool ? 'bg-teal-100 text-teal-800' : 'bg-orange-100 text-orange-800'
      )}
    >
      {typ}
    </span>
  );
}

function BookingStatusDot({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full',
        status === 'Buchung' ? 'bg-green-500' : 'bg-yellow-500'
      )}
      title={status}
    />
  );
}

export default function SchulsongKanban({
  schulsongs,
  onUpdate,
  onDelete,
  onRefresh,
}: SchulsongKanbanProps) {
  const [selectedSchulsong, setSelectedSchulsong] = useState<Schulsong | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, stage: SchulsongProduktionStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stage);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStage(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, stage: SchulsongProduktionStatus) => {
    e.preventDefault();
    setDragOverStage(null);
    const id = e.dataTransfer.getData('text/plain');
    setDraggedId(null);

    const song = schulsongs.find(s => s.id === id);
    if (!song || song.statusProduktion === stage) return;

    try {
      await onUpdate(id, { statusProduktion: stage });
      toast.success(`Moved to "${stage}"`);
    } catch {
      toast.error('Failed to update status');
    }
  }, [schulsongs, onUpdate]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    setDragOverStage(null);
  }, []);

  // Group schulsongs by stage
  const grouped = new Map<SchulsongProduktionStatus, Schulsong[]>();
  for (const stage of SCHULSONG_PRODUKTION_STAGES) {
    grouped.set(stage, []);
  }
  for (const song of schulsongs) {
    const stage = song.statusProduktion || 'Warte auf Fragebogen';
    const list = grouped.get(stage as SchulsongProduktionStatus);
    if (list) {
      list.push(song);
    } else {
      // Fallback: put in first column
      grouped.get('Warte auf Fragebogen')!.push(song);
    }
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
        {SCHULSONG_PRODUKTION_STAGES.map((stage) => {
          const cards = grouped.get(stage) || [];
          const isOver = dragOverStage === stage;

          return (
            <div
              key={stage}
              className={cn(
                'flex-shrink-0 w-64 flex flex-col bg-gray-50 rounded-lg border',
                isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
              )}
              onDragOver={(e) => handleDragOver(e, stage)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage)}
            >
              {/* Column header */}
              <div className="px-3 py-2 border-b border-gray-200 bg-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-700 truncate" title={stage}>
                    {stage}
                  </h3>
                  <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                    {cards.length}
                  </span>
                </div>
              </div>

              {/* Cards container */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {cards.map((song) => (
                  <div
                    key={song.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, song.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedSchulsong(song)}
                    className={cn(
                      'p-2.5 bg-white rounded-md border cursor-pointer hover:shadow-sm transition-shadow',
                      draggedId === song.id ? 'opacity-50 border-dashed' : 'border-gray-200',
                      song.schulsongTyp === 'Poolsong'
                        ? 'border-l-4 border-l-teal-400'
                        : song.schulsongTyp === 'Exklusivsong'
                          ? 'border-l-4 border-l-orange-400'
                          : ''
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-mono text-gray-500">
                        {song.schulsongId || `#${song.autoId || '?'}`}
                      </span>
                      <BookingStatusDot status={song.statusBooking} />
                    </div>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {song.songName || 'Untitled'}
                    </p>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {song.einrichtungName || song.idEinrichtung || '—'}
                    </p>
                    {song.aufnahmetagDatum && (
                      <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
                        </svg>
                        {new Date(song.aufnahmetagDatum + 'T00:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      </p>
                    )}
                    {song.schulsongTyp && (
                      <div className="mt-1.5">
                        <SchulsongTypBadge typ={song.schulsongTyp} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selectedSchulsong && (
        <SchulsongDetailModal
          schulsong={selectedSchulsong}
          onClose={() => setSelectedSchulsong(null)}
          onUpdate={async (data) => {
            await onUpdate(selectedSchulsong.id, data);
            setSelectedSchulsong(null);
          }}
          onDelete={async () => {
            await onDelete(selectedSchulsong.id);
            setSelectedSchulsong(null);
          }}
        />
      )}
    </>
  );
}
