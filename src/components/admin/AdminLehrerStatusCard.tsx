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

  const classesWithoutSongs = classes
    .filter(c => (c.songs || []).length === 0)
    .map(c => c.className);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Lehrer-Status</h3>
          <button
            onClick={() => setShowAlbumModal(true)}
            className="text-sm text-pink-600 hover:text-pink-700 font-medium"
          >
            Tracklist ansehen
          </button>
        </div>
        <HinweiseSection
          classesWithoutSongs={classesWithoutSongs}
          tracklistFinalized={Boolean(tracklistFinalizedAt)}
          isSchulsong={isSchulsong}
          schulsongApproved={schulsongApproved}
        />
      </div>

      {showAlbumModal && (
        <AlbumLayoutModal
          eventId={eventId}
          apiBaseUrl={`/api/admin/events/${encodeURIComponent(eventId)}/album-order`}
          onClose={() => setShowAlbumModal(false)}
          hideFinalize={true}
          tracklistFinalizedAt={tracklistFinalizedAt}
          eventDate={eventDate}
        />
      )}
    </>
  );
}
