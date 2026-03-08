'use client';

import { useState, useEffect, useRef } from 'react';
import type {
  SchulsongTyp,
  SchulsongBookingStatus,
  SchulsongProduktionStatus,
} from '@/lib/types/airtable';
import { SCHULSONG_PRODUKTION_STAGES } from '@/lib/types/airtable';

interface CreateSchulsongModalProps {
  onClose: () => void;
  onCreate: (data: Record<string, any>) => Promise<void>;
}

export default function CreateSchulsongModal({ onClose, onCreate }: CreateSchulsongModalProps) {
  const [songName, setSongName] = useState('');
  const [schulsongTyp, setSchulsongTyp] = useState<SchulsongTyp | ''>('');
  const [statusBooking, setStatusBooking] = useState<SchulsongBookingStatus | ''>('');
  const [statusProduktion, setStatusProduktion] = useState<SchulsongProduktionStatus | ''>('Warte auf Fragebogen');

  // Einrichtung search
  const [einrichtungSearch, setEinrichtungSearch] = useState('');
  const [einrichtungResults, setEinrichtungResults] = useState<{ id: string; name: string }[]>([]);
  const [selectedEinrichtung, setSelectedEinrichtung] = useState<{ id: string; name: string } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<NodeJS.Timeout | null>(null);

  // Inline create Einrichtung
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlz, setNewPlz] = useState('');
  const [newOrt, setNewOrt] = useState('');
  const [newType, setNewType] = useState('');
  const [creating, setCreating] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (einrichtungSearch.length < 2 || selectedEinrichtung) {
      setEinrichtungResults([]);
      setShowResults(false);
      return;
    }

    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/admin/schulsong/search-einrichtungen?q=${encodeURIComponent(einrichtungSearch)}`,
          { credentials: 'include' }
        );
        if (res.ok) {
          const data = await res.json();
          setEinrichtungResults(data.data || []);
          setShowResults(true);
        }
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [einrichtungSearch, selectedEinrichtung]);

  const handleCreateEinrichtung = async () => {
    if (!einrichtungSearch.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/schulsong/search-einrichtungen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          customerName: einrichtungSearch.trim(),
          plz: newPlz.trim() || undefined,
          ort: newOrt.trim() || undefined,
          type: newType.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setSelectedEinrichtung(data.data);
          setShowCreateForm(false);
          setShowResults(false);
        }
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!songName.trim() || !selectedEinrichtung) return;

    setSaving(true);
    try {
      await onCreate({
        songName: songName.trim(),
        einrichtungenId: selectedEinrichtung.id,
        schulsongTyp: schulsongTyp || undefined,
        statusBooking: statusBooking || undefined,
        statusProduktion: statusProduktion || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Neuer Schulsong</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Song Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Song Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="z.B. Unser Schullied"
              required
            />
          </div>

          {/* Einrichtung Search */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Einrichtung <span className="text-red-500">*</span>
            </label>
            {selectedEinrichtung ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-300 rounded-md">
                <span className="text-sm text-gray-900 flex-1">{selectedEinrichtung.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEinrichtung(null);
                    setEinrichtungSearch('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  &times;
                </button>
              </div>
            ) : (
              <input
                type="text"
                value={einrichtungSearch}
                onChange={(e) => setEinrichtungSearch(e.target.value)}
                onFocus={() => einrichtungResults.length > 0 && setShowResults(true)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Search school name..."
              />
            )}
            {showResults && einrichtungResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                {einrichtungResults.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      setSelectedEinrichtung(r);
                      setEinrichtungSearch(r.name);
                      setShowResults(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
            {searching && (
              <p className="text-xs text-gray-400 mt-1">Searching...</p>
            )}
            {!selectedEinrichtung && einrichtungSearch.length >= 2 && (showCreateForm || (!searching && showResults && einrichtungResults.length === 0)) && (
              <div className="mt-2">
                {!showCreateForm && <p className="text-xs text-gray-500 mb-2">No matches found.</p>}
                {!showCreateForm ? (
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    + Create new Einrichtung
                  </button>
                ) : (
                  <div className="border border-gray-200 rounded-md p-3 space-y-2 bg-gray-50">
                    <p className="text-xs font-medium text-gray-700">New Einrichtung</p>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Name</label>
                      <input
                        type="text"
                        value={einrichtungSearch}
                        onChange={(e) => setEinrichtungSearch(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-white"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-0.5">PLZ</label>
                        <input
                          type="text"
                          value={newPlz}
                          onChange={(e) => setNewPlz(e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                          placeholder="12345"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs text-gray-500 mb-0.5">Ort</label>
                        <input
                          type="text"
                          value={newOrt}
                          onChange={(e) => setNewOrt(e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                          placeholder="Berlin"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-0.5">Type</label>
                      <input
                        type="text"
                        value={newType}
                        onChange={(e) => setNewType(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md"
                        placeholder="Grundschule"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowCreateForm(false)}
                        className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateEinrichtung}
                        disabled={creating || !einrichtungSearch.trim()}
                        className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                      >
                        {creating ? 'Creating...' : '+ Create & Select'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Schulsong Typ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Schulsong Typ</label>
            <select
              value={schulsongTyp}
              onChange={(e) => setSchulsongTyp(e.target.value as SchulsongTyp)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
            >
              <option value="">—</option>
              <option value="Poolsong">Poolsong</option>
              <option value="Exklusivsong">Exklusivsong</option>
            </select>
          </div>

          {/* Status Booking */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status Booking</label>
            <select
              value={statusBooking}
              onChange={(e) => setStatusBooking(e.target.value as SchulsongBookingStatus)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
            >
              <option value="">—</option>
              <option value="Anfrage">Anfrage</option>
              <option value="Buchung">Buchung</option>
            </select>
          </div>

          {/* Status Produktion */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status Produktion</label>
            <select
              value={statusProduktion}
              onChange={(e) => setStatusProduktion(e.target.value as SchulsongProduktionStatus)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
            >
              <option value="">—</option>
              {SCHULSONG_PRODUKTION_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !songName.trim() || !selectedEinrichtung}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
