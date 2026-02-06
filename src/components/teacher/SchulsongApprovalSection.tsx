'use client';

import { useState, useEffect, useRef } from 'react';

interface SchulsongApprovalSectionProps {
  eventId: string;
}

type SchulsongStatus = 'waiting' | 'ready_for_approval' | 'approved';

interface SchulsongStatusResponse {
  success: boolean;
  hasSchulsong: boolean;
  status: SchulsongStatus;
  audioUrl?: string;
  teacherApprovedAt?: string;
  availableToParentsAt?: string;
  error?: string;
}

export default function SchulsongApprovalSection({ eventId }: SchulsongApprovalSectionProps) {
  const [status, setStatus] = useState<SchulsongStatus>('waiting');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [teacherApprovedAt, setTeacherApprovedAt] = useState<string | null>(null);
  const [availableToParentsAt, setAvailableToParentsAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSchulsong, setHasSchulsong] = useState(false);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetchSchulsongStatus();
  }, [eventId]);

  const fetchSchulsongStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/teacher/events/${encodeURIComponent(eventId)}/schulsong-status`);
      const data: SchulsongStatusResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch schulsong status');
      }

      setHasSchulsong(data.hasSchulsong);
      setStatus(data.status);
      setAudioUrl(data.audioUrl || null);
      setTeacherApprovedAt(data.teacherApprovedAt || null);
      setAvailableToParentsAt(data.availableToParentsAt || null);
    } catch (err) {
      console.error('Error fetching schulsong status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load schulsong status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (isApproving) return;

    try {
      setIsApproving(true);
      setError(null);

      const response = await fetch(`/api/teacher/events/${encodeURIComponent(eventId)}/schulsong-approve`, {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve schulsong');
      }

      // Update state with the approval
      setStatus('approved');
      setTeacherApprovedAt(data.approvedAt);
    } catch (err) {
      console.error('Error approving schulsong:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve schulsong');
    } finally {
      setIsApproving(false);
    }
  };

  // Audio player handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      setError('Fehler beim Laden der Audiodatei');
      setIsPlaying(false);
      setAudioLoading(false);
    };
    const handleCanPlay = () => setAudioLoading(false);
    const handleWaiting = () => setAudioLoading(true);

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('waiting', handleWaiting);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('waiting', handleWaiting);
    };
  }, [audioUrl]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.error('Playback error:', err);
        setError('Fehler beim Abspielen');
      });
    }
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  // Don't render if event doesn't have schulsong feature
  if (!isLoading && !hasSchulsong) {
    return null;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-yellow-600 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Schulsong</h2>
            <p className="text-sm text-gray-500">Wird geladen...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Schulsong</h2>
        </div>

        {/* Status Badge */}
        {status === 'approved' && (
          <span className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-700">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Freigegeben
          </span>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* State A: Waiting for audio/admin approval */}
      {status === 'waiting' && (
        <div className="bg-gray-50 rounded-lg p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-200 flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">Der Schulsong wird gerade vorbereitet.</p>
          <p className="text-sm text-gray-500 mt-1">
            Sobald er fertig ist, können Sie ihn hier anhören und freigeben.
          </p>
        </div>
      )}

      {/* State B: Ready for teacher approval */}
      {status === 'ready_for_approval' && (
        <div className="space-y-4">
          {/* Audio Player */}
          {audioUrl && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlayPause}
                  disabled={audioLoading}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                    audioLoading
                      ? 'bg-gray-200 cursor-not-allowed'
                      : 'bg-pink-600 hover:bg-pink-700 text-white'
                  }`}
                >
                  {audioLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                <div className="flex-1 space-y-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-pink-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-pink-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
                    disabled={!audioUrl || audioLoading}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>

              {/* Hidden audio element */}
              <audio
                ref={audioRef}
                src={audioUrl}
                preload="metadata"
                className="hidden"
              />
            </div>
          )}

          {/* Approval Instructions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              Bitte hören Sie sich den Schulsong an und geben Sie ihn frei, damit er nach Prüfung
              für die Eltern verfügbar wird.
            </p>
          </div>

          {/* Approve Button */}
          <div className="flex justify-end">
            <button
              onClick={handleApprove}
              disabled={isApproving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApproving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Wird freigegeben...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Schulsong freigeben
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* State C: Approved by teacher */}
      {status === 'approved' && (
        <div className="space-y-4">
          {/* Audio Player (read-only) */}
          {audioUrl && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={togglePlayPause}
                  disabled={audioLoading}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ${
                    audioLoading
                      ? 'bg-gray-200 cursor-not-allowed'
                      : 'bg-pink-600 hover:bg-pink-700 text-white'
                  }`}
                >
                  {audioLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : isPlaying ? (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>

                <div className="flex-1 space-y-1">
                  <input
                    type="range"
                    min="0"
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-pink-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:bg-pink-600 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-none"
                    disabled={!audioUrl || audioLoading}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              </div>

              {/* Hidden audio element */}
              <audio
                ref={audioRef}
                src={audioUrl}
                preload="metadata"
                className="hidden"
              />
            </div>
          )}

          {/* Approval Confirmation */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-800">
                  Der Schulsong wurde freigegeben
                </p>
                <p className="text-sm text-green-700 mt-1">
                  {availableToParentsAt
                    ? <>Der Song wird ab {formatDate(availableToParentsAt)} für Eltern verfügbar.</>
                    : <>Der Schulsong wird geprüft und bald für Eltern verfügbar.</>
                  }
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
