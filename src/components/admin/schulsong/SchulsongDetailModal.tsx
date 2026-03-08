'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type {
  Schulsong,
  SchulsongTyp,
  SchulsongBookingStatus,
  SchulsongProduktionStatus,
  PoolsongAuswahl,
} from '@/lib/types/airtable';
import { SCHULSONG_PRODUKTION_STAGES } from '@/lib/types/airtable';

interface SchulsongDetailModalProps {
  schulsong: Schulsong;
  onClose: () => void;
  onUpdate: (data: Record<string, any>) => Promise<void>;
  onDelete: () => Promise<void>;
}

const POOLSONG_OPTIONS: PoolsongAuswahl[] = [
  'Song #1', 'Song #2', 'Song #3', 'Song #4', 'Song #5',
  'Song #6', 'Song #7', 'Song #8', 'Song #9', 'Song #10',
];

export default function SchulsongDetailModal({
  schulsong,
  onClose,
  onUpdate,
  onDelete,
}: SchulsongDetailModalProps) {
  const [form, setForm] = useState({
    songName: schulsong.songName || '',
    schulsongTyp: schulsong.schulsongTyp || '',
    statusBooking: schulsong.statusBooking || '',
    statusProduktion: schulsong.statusProduktion || '',
    poolsongAuswahl: schulsong.poolsongAuswahl || '',
    songtext: schulsong.songtext || '',
    songtextGoogleDocUrl: schulsong.songtextGoogleDocUrl || '',
    feedback: schulsong.feedback || '',
    gebuchtAm: schulsong.gebuchtAm || '',
    aufnahmetagDatum: schulsong.aufnahmetagDatum || '',
    // URLs
    streamingLink: schulsong.streamingLink || '',
    layoutUrl: schulsong.layoutUrl || '',
    playbackUrl: schulsong.playbackUrl || '',
    songUrl: schulsong.songUrl || '',
    notenUrl: schulsong.notenUrl || '',
    textUrl: schulsong.textUrl || '',
    materialUrl: schulsong.materialUrl || '',
    instrumentalUrl: schulsong.instrumentalUrl || '',
    leadUrl: schulsong.leadUrl || '',
    backingsUrl: schulsong.backingsUrl || '',
    // Config flags
    notenKonfig: schulsong.notenKonfig || false,
    uebematerialKonfig: schulsong.uebematerialKonfig || false,
    streamingKonfig: schulsong.streamingKonfig || false,
    cdKonfig: schulsong.cdKonfig ?? 0,
    aufnahmetagKonfig: schulsong.aufnahmetagKonfig || false,
    miniKonfig: schulsong.miniKonfig || false,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data: Record<string, any> = {};
      if (form.songName !== (schulsong.songName || '')) data.songName = form.songName;
      if (form.schulsongTyp !== (schulsong.schulsongTyp || '')) data.schulsongTyp = form.schulsongTyp || undefined;
      if (form.statusBooking !== (schulsong.statusBooking || '')) data.statusBooking = form.statusBooking || undefined;
      if (form.statusProduktion !== (schulsong.statusProduktion || '')) data.statusProduktion = form.statusProduktion || undefined;
      if (form.poolsongAuswahl !== (schulsong.poolsongAuswahl || '')) data.poolsongAuswahl = form.poolsongAuswahl || undefined;
      if (form.songtext !== (schulsong.songtext || '')) data.songtext = form.songtext;
      if (form.songtextGoogleDocUrl !== (schulsong.songtextGoogleDocUrl || '')) data.songtextGoogleDocUrl = form.songtextGoogleDocUrl;
      if (form.feedback !== (schulsong.feedback || '')) data.feedback = form.feedback;
      if (form.gebuchtAm !== (schulsong.gebuchtAm || '')) data.gebuchtAm = form.gebuchtAm || undefined;
      if (form.aufnahmetagDatum !== (schulsong.aufnahmetagDatum || '')) data.aufnahmetagDatum = form.aufnahmetagDatum || undefined;
      // URLs
      if (form.streamingLink !== (schulsong.streamingLink || '')) data.streamingLink = form.streamingLink;
      if (form.layoutUrl !== (schulsong.layoutUrl || '')) data.layoutUrl = form.layoutUrl;
      if (form.playbackUrl !== (schulsong.playbackUrl || '')) data.playbackUrl = form.playbackUrl;
      if (form.songUrl !== (schulsong.songUrl || '')) data.songUrl = form.songUrl;
      if (form.notenUrl !== (schulsong.notenUrl || '')) data.notenUrl = form.notenUrl;
      if (form.textUrl !== (schulsong.textUrl || '')) data.textUrl = form.textUrl;
      if (form.materialUrl !== (schulsong.materialUrl || '')) data.materialUrl = form.materialUrl;
      if (form.instrumentalUrl !== (schulsong.instrumentalUrl || '')) data.instrumentalUrl = form.instrumentalUrl;
      if (form.leadUrl !== (schulsong.leadUrl || '')) data.leadUrl = form.leadUrl;
      if (form.backingsUrl !== (schulsong.backingsUrl || '')) data.backingsUrl = form.backingsUrl;
      // Config flags
      if (form.notenKonfig !== (schulsong.notenKonfig || false)) data.notenKonfig = form.notenKonfig;
      if (form.uebematerialKonfig !== (schulsong.uebematerialKonfig || false)) data.uebematerialKonfig = form.uebematerialKonfig;
      if (form.streamingKonfig !== (schulsong.streamingKonfig || false)) data.streamingKonfig = form.streamingKonfig;
      if (form.cdKonfig !== (schulsong.cdKonfig ?? 0)) data.cdKonfig = form.cdKonfig;
      if (form.aufnahmetagKonfig !== (schulsong.aufnahmetagKonfig || false)) data.aufnahmetagKonfig = form.aufnahmetagKonfig;
      if (form.miniKonfig !== (schulsong.miniKonfig || false)) data.miniKonfig = form.miniKonfig;

      if (Object.keys(data).length > 0) {
        await onUpdate(data);
      } else {
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await onDelete();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {schulsong.schulsongId || 'Schulsong'} — {schulsong.songName || 'Untitled'}
            </h2>
            <p className="text-sm text-gray-500">{schulsong.idEinrichtung || schulsong.schulsongLabel}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-4 space-y-6">
          {/* Identity */}
          <Section title="Identity">
            <Field label="Song Name">
              <input
                type="text"
                value={form.songName}
                onChange={(e) => setForm(f => ({ ...f, songName: e.target.value }))}
                className="input-field"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Schulsong Typ">
                <select
                  value={form.schulsongTyp}
                  onChange={(e) => setForm(f => ({ ...f, schulsongTyp: e.target.value as SchulsongTyp }))}
                  className="input-field"
                >
                  <option value="">—</option>
                  <option value="Poolsong">Poolsong</option>
                  <option value="Exklusivsong">Exklusivsong</option>
                </select>
              </Field>
              <Field label="Poolsong Auswahl">
                <select
                  value={form.poolsongAuswahl}
                  onChange={(e) => setForm(f => ({ ...f, poolsongAuswahl: e.target.value as PoolsongAuswahl }))}
                  className="input-field"
                >
                  <option value="">—</option>
                  {POOLSONG_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* Status */}
          <Section title="Status">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Booking Status">
                <select
                  value={form.statusBooking}
                  onChange={(e) => setForm(f => ({ ...f, statusBooking: e.target.value as SchulsongBookingStatus }))}
                  className="input-field"
                >
                  <option value="">—</option>
                  <option value="Anfrage">Anfrage</option>
                  <option value="Buchung">Buchung</option>
                </select>
              </Field>
              <Field label="Produktion Status">
                <select
                  value={form.statusProduktion}
                  onChange={(e) => setForm(f => ({ ...f, statusProduktion: e.target.value as SchulsongProduktionStatus }))}
                  className="input-field"
                >
                  <option value="">—</option>
                  {SCHULSONG_PRODUKTION_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Gebucht am">
                <input
                  type="date"
                  value={form.gebuchtAm}
                  onChange={(e) => setForm(f => ({ ...f, gebuchtAm: e.target.value }))}
                  className="input-field"
                />
              </Field>
              <Field label="Aufnahmetag">
                <input
                  type="date"
                  value={form.aufnahmetagDatum}
                  onChange={(e) => setForm(f => ({ ...f, aufnahmetagDatum: e.target.value }))}
                  className="input-field"
                />
              </Field>
            </div>
          </Section>

          {/* Song Content */}
          <Section title="Song Content">
            <Field label="Songtext">
              <textarea
                value={form.songtext}
                onChange={(e) => setForm(f => ({ ...f, songtext: e.target.value }))}
                className="input-field min-h-[80px]"
                rows={4}
              />
            </Field>
            <Field label="Songtext Google Doc URL">
              <input
                type="url"
                value={form.songtextGoogleDocUrl}
                onChange={(e) => setForm(f => ({ ...f, songtextGoogleDocUrl: e.target.value }))}
                className="input-field"
              />
            </Field>
            <Field label="Feedback">
              <textarea
                value={form.feedback}
                onChange={(e) => setForm(f => ({ ...f, feedback: e.target.value }))}
                className="input-field min-h-[60px]"
                rows={3}
              />
            </Field>
          </Section>

          {/* Asset URLs */}
          <Section title="Asset URLs">
            <div className="grid grid-cols-2 gap-3">
              {([
                ['streamingLink', 'Streaming Link'],
                ['layoutUrl', 'Layout URL'],
                ['playbackUrl', 'Playback URL'],
                ['songUrl', 'Song URL'],
                ['notenUrl', 'Noten URL'],
                ['textUrl', 'Text URL'],
                ['materialUrl', 'Material URL'],
                ['instrumentalUrl', 'Instrumental URL'],
                ['leadUrl', 'Lead URL'],
                ['backingsUrl', 'Backings URL'],
              ] as const).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    type="url"
                    value={form[key]}
                    onChange={(e) => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="input-field text-xs"
                    placeholder="https://..."
                  />
                </Field>
              ))}
            </div>
          </Section>

          {/* Config Flags */}
          <Section title="Configuration">
            <div className="grid grid-cols-2 gap-3">
              {([
                ['notenKonfig', 'Noten'],
                ['uebematerialKonfig', 'Übematerial'],
                ['streamingKonfig', 'Streaming'],
                ['aufnahmetagKonfig', 'Aufnahmetag'],
                ['miniKonfig', '+Mini'],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm(f => ({ ...f, [key]: e.target.checked }))}
                    className="rounded border-gray-300"
                  />
                  {label}
                </label>
              ))}
              <Field label="CD Konfig (Anzahl)">
                <input
                  type="number"
                  min={0}
                  value={form.cdKonfig}
                  onChange={(e) => setForm(f => ({ ...f, cdKonfig: Number(e.target.value) }))}
                  className="input-field w-24"
                />
              </Field>
            </div>
          </Section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div>
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-600">Are you sure?</span>
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800"
              >
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        .input-field {
          width: 100%;
          padding: 0.375rem 0.625rem;
          font-size: 0.875rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          outline: none;
        }
        .input-field:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 1px #3b82f6;
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  );
}
