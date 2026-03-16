'use client';

import { useCallback, useEffect, useState } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────

interface EventTeamSectionProps {
  eventId: string;
  classCount: number;
  songCount: number;
}

interface BookingContact {
  name: string;
  email: string;
  isCurrentUser: boolean;
}

interface Invite {
  id: string;
  inviteToken: string;
  status: 'pending' | 'accepted' | 'expired';
  invitedByName: string;
  invitedAt: string;
  acceptedAt?: string;
  acceptedByName?: string;
  acceptedByEmail?: string;
}

interface TeamData {
  bookingContact: BookingContact | null;
  invites: Invite[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.split(/[\s@]+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  return date.toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusBadge(
  status: 'pending' | 'accepted' | 'expired',
  isBookingContact: boolean
): { label: string; classes: string } {
  if (isBookingContact) {
    return {
      label: 'Buchungskontakt',
      classes: 'bg-blue-100 text-blue-700',
    };
  }
  switch (status) {
    case 'accepted':
      return { label: 'Aktiv', classes: 'bg-green-100 text-green-700' };
    case 'pending':
      return { label: 'Ausstehend', classes: 'bg-yellow-100 text-yellow-700' };
    case 'expired':
      return { label: 'Abgelaufen', classes: 'bg-gray-100 text-gray-500' };
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TeamMemberRow({
  name,
  email,
  badge,
  subtitle,
  avatarBg = 'bg-pink-100 text-pink-600',
}: {
  name: string;
  email: string;
  badge: { label: string; classes: string };
  subtitle?: string;
  avatarBg?: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      {/* Avatar */}
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarBg}`}
      >
        {getInitials(name)}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">{name}</span>
          <span
            className={`px-2 py-0.5 text-xs font-medium rounded-full ${badge.classes}`}
          >
            {badge.label}
          </span>
        </div>
        <p className="text-sm text-gray-500 truncate">{email}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function EventTeamSection({
  eventId,
  classCount,
  songCount,
}: EventTeamSectionProps) {
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Clipboard state
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/teacher/events/${encodeURIComponent(eventId)}/invites`
      );
      if (!res.ok) {
        throw new Error('Fehler beim Laden des Teams');
      }
      const data = await res.json();
      setTeamData({
        bookingContact: data.bookingContact,
        invites: data.invites ?? [],
      });
    } catch (err) {
      console.error('Error fetching team data:', err);
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  // ── Invite handler ───────────────────────────────────────────────────────

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;

    setInviteSending(true);
    setInviteError('');
    setInviteSuccess(false);

    try {
      const res = await fetch('/api/teacher/invite/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler beim Einladen');
      }

      setInviteEmail('');
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 4000);
      await fetchTeam();
    } catch (err) {
      console.error('Error sending invite:', err);
      setInviteError(
        err instanceof Error ? err.message : 'Fehler beim Einladen'
      );
    } finally {
      setInviteSending(false);
    }
  };

  // ── Copy link handler ────────────────────────────────────────────────────

  const handleCopyLink = async (token: string) => {
    const url = `${window.location.origin}/paedagogen-einladung/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // ── Revoke handler ───────────────────────────────────────────────────────

  const handleRevoke = async (inviteId: string) => {
    setRevokingId(inviteId);
    try {
      const res = await fetch(
        `/api/teacher/events/${encodeURIComponent(eventId)}/invites/${inviteId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Fehler beim Widerrufen');
      }
      await fetchTeam();
    } catch (err) {
      console.error('Error revoking invite:', err);
    } finally {
      setRevokingId(null);
    }
  };

  // ── Partition invites ────────────────────────────────────────────────────

  const accepted = teamData?.invites.filter((i) => i.status === 'accepted') ?? [];
  const pending = teamData?.invites.filter((i) => i.status === 'pending') ?? [];
  const expired = teamData?.invites.filter((i) => i.status === 'expired') ?? [];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="flex gap-4">
        <div className="bg-pink-50 rounded-lg px-4 py-3 text-center">
          <p className="text-2xl font-bold text-pink-600">{classCount}</p>
          <p className="text-sm text-pink-700">
            {classCount === 1 ? 'Klasse' : 'Klassen'}
          </p>
        </div>
        <div className="bg-blue-50 rounded-lg px-4 py-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{songCount}</p>
          <p className="text-sm text-blue-700">Lieder</p>
        </div>
      </div>

      {/* Team Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Team</h3>

        <div className="border border-gray-200 rounded-xl bg-white">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-600" />
            </div>
          )}

          {error && (
            <div className="p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {!loading && !error && teamData && (
            <div className="divide-y divide-gray-100">
              {/* Booking contact */}
              {teamData.bookingContact && (
                <div className="px-4">
                  <TeamMemberRow
                    name={teamData.bookingContact.name}
                    email={teamData.bookingContact.email}
                    badge={getStatusBadge('accepted', true)}
                    avatarBg="bg-pink-100 text-pink-600"
                  />
                </div>
              )}

              {/* Accepted invites */}
              {accepted.map((invite) => (
                <div key={invite.id} className="px-4">
                  <TeamMemberRow
                    name={invite.acceptedByName ?? 'Unbekannt'}
                    email={invite.acceptedByEmail ?? ''}
                    badge={getStatusBadge('accepted', false)}
                    subtitle={`Eingeladen von ${invite.invitedByName} am ${formatDate(invite.invitedAt)}`}
                    avatarBg="bg-green-100 text-green-600"
                  />
                </div>
              ))}

              {/* Pending invites */}
              {pending.map((invite) => (
                <div key={invite.id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 bg-yellow-100 text-yellow-600">
                      ?
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-500 italic">
                          Ausstehende Einladung
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                          Ausstehend
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Eingeladen von {invite.invitedByName} am{' '}
                        {formatDate(invite.invitedAt)}
                      </p>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleCopyLink(invite.inviteToken)}
                        className="px-3 py-1 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        {copiedToken === invite.inviteToken
                          ? 'Kopiert!'
                          : 'Link kopieren'}
                      </button>
                      <button
                        onClick={() => handleRevoke(invite.id)}
                        disabled={revokingId === invite.id}
                        className="px-3 py-1 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {revokingId === invite.id
                          ? 'Wird widerrufen...'
                          : 'Widerrufen'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Expired invites (collapsed) */}
              {expired.length > 0 && (
                <div className="px-4 py-2">
                  <details>
                    <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-500">
                      {expired.length} abgelaufene{' '}
                      {expired.length === 1 ? 'Einladung' : 'Einladungen'}
                    </summary>
                    <div className="mt-1 divide-y divide-gray-50 opacity-60">
                      {expired.map((invite) => (
                        <div key={invite.id} className="flex items-center gap-3 py-2">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 bg-gray-100 text-gray-400">
                            ?
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm text-gray-400 italic">
                                Abgelaufene Einladung
                              </span>
                              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
                                Abgelaufen
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                              Eingeladen von {invite.invitedByName} am{' '}
                              {formatDate(invite.invitedAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              )}

              {/* Invite form */}
              <div className="px-4 py-4">
                <form onSubmit={handleInvite} className="flex gap-2">
                  <input
                    type="email"
                    placeholder="E-Mail-Adresse eingeben"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
                  />
                  <button
                    type="submit"
                    disabled={inviteSending || !inviteEmail.trim()}
                    className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors text-sm font-medium disabled:opacity-50 whitespace-nowrap"
                  >
                    {inviteSending ? 'Wird gesendet...' : 'Einladen'}
                  </button>
                </form>

                {inviteError && (
                  <p className="mt-2 text-sm text-red-600">{inviteError}</p>
                )}

                {inviteSuccess && (
                  <p className="mt-2 text-sm text-green-600">
                    Einladung erfolgreich gesendet!
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
