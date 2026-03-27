'use client';

import { useState, useEffect } from 'react';
import HinweiseSection from '@/components/teacher/HinweiseSection';
import AlbumLayoutModal from '@/components/shared/AlbumLayoutModal';

interface AdminLehrerStatusCardProps {
  eventId: string;
  classes: Array<{ songs?: Array<unknown>; className: string }>;
  isSchulsong: boolean;
  tracklistFinalizedAt?: string;
  eventDate: string;
}

export default function AdminLehrerStatusCard({
  eventId,
  classes,
  isSchulsong,
  tracklistFinalizedAt,
  eventDate,
}: AdminLehrerStatusCardProps) {
  const [schulsongApproved, setSchulsongApproved] = useState(false);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [localFinalizedAt, setLocalFinalizedAt] = useState(tracklistFinalizedAt);

  useEffect(() => { setLocalFinalizedAt(tracklistFinalizedAt); }, [tracklistFinalizedAt]);

  useEffect(() => {
    if (!isSchulsong) return;

    async function fetchSchulsongStatus() {
      try {
        const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/schulsong-status`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setSchulsongApproved(data.schulsongFile?.approvalStatus === 'approved');
        }
      } catch (err) {
        console.error('Error fetching schulsong status:', err);
      }
    }
    fetchSchulsongStatus();
  }, [isSchulsong, eventId]);

  const handleUnlock = async () => {
    if (!confirm('Die Lieder-Reihenfolge wird entsperrt. Du kannst sie bearbeiten und erneut bestätigen. Fortfahren?')) return;
    setIsUnlocking(true);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/album-order/unlock`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) throw new Error('Unlock failed');
      setLocalFinalizedAt(undefined);
    } catch (err) {
      console.error('Unlock failed:', err);
    } finally {
      setIsUnlocking(false);
    }
  };

  const classesWithoutSongs = classes
    .filter(c => (c.songs || []).length === 0)
    .map(c => c.className);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Lehrer-Status</h3>
          <div className="flex items-center gap-2">
            {localFinalizedAt ? (
              <>
                <button onClick={() => setShowAlbumModal(true)} className="text-sm text-pink-600 hover:text-pink-700 font-medium">
                  Tracklist ansehen
                </button>
                <button onClick={handleUnlock} disabled={isUnlocking} className="text-sm text-amber-600 hover:text-amber-700 font-medium">
                  {isUnlocking ? 'Entsperren...' : 'Entsperren'}
                </button>
              </>
            ) : (
              <button onClick={() => setShowAlbumModal(true)} className="text-sm text-pink-600 hover:text-pink-700 font-medium">
                Tracklist bearbeiten
              </button>
            )}
          </div>
        </div>
        <HinweiseSection
          classesWithoutSongs={classesWithoutSongs}
          tracklistFinalized={Boolean(localFinalizedAt)}
          isSchulsong={isSchulsong}
          schulsongApproved={schulsongApproved}
        />
      </div>

      {showAlbumModal && (
        <AlbumLayoutModal
          eventId={eventId}
          apiBaseUrl={`/api/admin/events/${encodeURIComponent(eventId)}/album-order`}
          onClose={() => setShowAlbumModal(false)}
          onSave={() => { setLocalFinalizedAt(undefined); }}
          hideFinalize={true}
          showAdminFinalize={!localFinalizedAt}
          tracklistFinalizedAt={localFinalizedAt}
          eventDate={eventDate}
        />
      )}
    </>
  );
}
