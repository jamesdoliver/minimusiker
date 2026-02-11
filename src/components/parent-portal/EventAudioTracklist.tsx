'use client';

import { useState } from 'react';
import CompactSongPlayer from './CompactSongPlayer';
import DownloadAllButton from './DownloadAllButton';

interface TrackEntry {
  songId?: string;
  title: string;
  artist?: string;
  order: number;
  durationSeconds?: number;
  fileSizeBytes?: number;
  audioUrl: string;
  downloadUrl: string;
  filename: string;
}

interface AudioSection {
  sectionId: string;
  sectionName: string;
  sectionType: 'class' | 'choir' | 'teacher_song' | 'group';
  memberClasses?: Array<{ classId: string; className: string }>;
  tracks: TrackEntry[];
}

interface AllAudioResponse {
  parentClassId: string;
  sections: AudioSection[];
  totalTracks: number;
  totalSizeBytes: number;
}

interface EventAudioTracklistProps {
  allAudio: AllAudioResponse;
  schoolName: string;
  eventId?: string;
}

const sectionBadgeLabels: Record<string, string> = {
  choir: 'Chor',
  teacher_song: 'Lehrerlied',
  group: 'Gruppenaufnahme',
};

export default function EventAudioTracklist({ allAudio, schoolName }: EventAudioTracklistProps) {
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleTogglePlay = (trackId: string) => {
    if (currentlyPlayingId === trackId) {
      setIsPlaying(prev => !prev);
    } else {
      setCurrentlyPlayingId(trackId);
      setIsPlaying(true);
    }
  };

  const handleTrackEnded = () => {
    setIsPlaying(false);
  };

  const hasDownloadableTracks = allAudio.totalTracks > 0;

  return (
    <section className="bg-white py-8 sm:py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900">Eure Aufnahmen</h3>
            <p className="text-sm text-gray-500 mt-1">
              {allAudio.totalTracks} {allAudio.totalTracks === 1 ? 'Lied' : 'Lieder'}
            </p>
          </div>
          {hasDownloadableTracks && (
            <DownloadAllButton
              sections={allAudio.sections}
              schoolName={schoolName}
              totalSizeBytes={allAudio.totalSizeBytes}
            />
          )}
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {allAudio.sections.map((section) => {
            const isParentClass = section.sectionId === allAudio.parentClassId;
            const badge = sectionBadgeLabels[section.sectionType];
            const trackCount = section.tracks.length;
            const trackLabel = trackCount === 1 ? 'Aufnahme' : (trackCount <= 0 ? '' : 'Lieder');

            return (
              <div key={section.sectionId} className="border border-gray-200 rounded-xl overflow-hidden">
                {/* Section Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-900">{section.sectionName}</h4>
                    {isParentClass && (
                      <span className="text-xs font-medium bg-sage-100 text-sage-700 px-2 py-0.5 rounded-full">
                        Deine Klasse
                      </span>
                    )}
                    {badge && (
                      <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                        {badge}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {trackCount > 0 ? `${trackCount} ${trackLabel}` : ''}
                  </span>
                </div>

                {/* Member classes for groups */}
                {section.sectionType === 'group' && section.memberClasses && section.memberClasses.length > 0 && (
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-500">
                    {section.memberClasses.map(c => c.className).join(' + ')}
                  </div>
                )}

                {/* Tracks */}
                {section.tracks.length > 0 ? (
                  <div className="divide-y divide-gray-100">
                    {section.tracks.map((track, index) => {
                      const trackId = `${section.sectionId}-${track.songId || index}`;
                      const isActive = currentlyPlayingId === trackId;

                      return (
                        <div key={trackId} className="px-4 py-3">
                          {/* Track info row */}
                          <div className="flex items-center gap-3 mb-2">
                            {/* Track number */}
                            <span className="flex-shrink-0 w-6 text-right text-sm text-gray-400 font-mono">
                              {track.order > 0 ? track.order : index + 1}
                            </span>

                            {/* Title + Artist */}
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-gray-900 truncate block">
                                {track.title}
                              </span>
                              {track.artist && (
                                <span className="text-xs text-gray-500">{track.artist}</span>
                              )}
                            </div>

                            {/* Download button */}
                            <a
                              href={track.downloadUrl}
                              download={track.filename}
                              className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                              aria-label={`Download ${track.title}`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </a>
                          </div>

                          {/* Player */}
                          <div className="ml-9">
                            <CompactSongPlayer
                              audioUrl={track.audioUrl}
                              durationSeconds={track.durationSeconds}
                              isActive={isActive}
                              isPlaying={isActive && isPlaying}
                              onTogglePlay={() => handleTogglePlay(trackId)}
                              onEnded={handleTrackEnded}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Empty section placeholder */
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-gray-400 italic">Aufnahme in Bearbeitung...</p>
                  </div>
                )}
              </div>
            );
          })}

          {/* If no sections at all */}
          {allAudio.sections.length === 0 && (
            <div className="text-center py-12">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
              <p className="text-gray-500">Noch keine Aufnahmen verfügbar.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
