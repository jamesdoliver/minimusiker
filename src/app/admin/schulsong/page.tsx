'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import SchulsongKanban from '@/components/admin/schulsong/SchulsongKanban';
import CreateSchulsongModal from '@/components/admin/schulsong/CreateSchulsongModal';
import type { Schulsong, SchulsongTyp, SchulsongBookingStatus } from '@/lib/types/airtable';

export default function AdminSchulsong() {
  const [schulsongs, setSchulsongs] = useState<Schulsong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typFilter, setTypFilter] = useState<SchulsongTyp | ''>('');
  const [bookingFilter, setBookingFilter] = useState<SchulsongBookingStatus | ''>('');

  const fetchSchulsongs = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/schulsong', { credentials: 'include' });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch schulsongs');
      }

      const data = await response.json();
      if (data.success) {
        setSchulsongs(data.data.schulsongs || []);
      } else {
        throw new Error(data.error || 'Failed to load schulsongs');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load schulsongs';
      setError(message);
      console.error('Error fetching schulsongs:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchulsongs();
  }, [fetchSchulsongs]);

  const handleUpdate = useCallback(async (id: string, data: Record<string, any>) => {
    // Optimistic update
    const previous = schulsongs;
    setSchulsongs(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));

    try {
      const response = await fetch(`/api/admin/schulsong/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Failed to update');

      const result = await response.json();
      if (result.success && result.data) {
        setSchulsongs(prev => prev.map(s => s.id === id ? result.data : s));
      }
    } catch {
      setSchulsongs(previous);
      toast.error('Failed to update schulsong');
      throw new Error('Update failed');
    }
  }, [schulsongs]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/admin/schulsong/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to delete');

      setSchulsongs(prev => prev.filter(s => s.id !== id));
      toast.success('Schulsong deleted');
    } catch {
      toast.error('Failed to delete schulsong');
    }
  }, []);

  const handleCreate = useCallback(async (data: Record<string, any>) => {
    try {
      const response = await fetch('/api/admin/schulsong', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to create');
      }

      const result = await response.json();
      if (result.success && result.data) {
        setSchulsongs(prev => [...prev, result.data]);
        toast.success('Schulsong created');
        setShowCreateModal(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create schulsong');
    }
  }, []);

  const filteredSchulsongs = useMemo(() => {
    let filtered = schulsongs;

    if (typFilter) {
      filtered = filtered.filter(s => s.schulsongTyp === typFilter);
    }

    if (bookingFilter) {
      filtered = filtered.filter(s => s.statusBooking === bookingFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.songName?.toLowerCase().includes(q) ||
        s.schulsongId?.toLowerCase().includes(q) ||
        s.idEinrichtung?.toLowerCase().includes(q) ||
        s.schulsongLabel?.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [schulsongs, typFilter, bookingFilter, searchQuery]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
        <button onClick={fetchSchulsongs} className="mt-2 text-sm text-red-700 underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Schulsong ({schulsongs.length})</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
        >
          + Neuer Schulsong
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, ID, school..."
            className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          />
          <select
            value={typFilter}
            onChange={(e) => setTypFilter(e.target.value as SchulsongTyp | '')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="">Alle Typen</option>
            <option value="Poolsong">Poolsong</option>
            <option value="Exklusivsong">Exklusivsong</option>
          </select>
          <select
            value={bookingFilter}
            onChange={(e) => setBookingFilter(e.target.value as SchulsongBookingStatus | '')}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
          >
            <option value="">Alle Booking Status</option>
            <option value="Anfrage">Anfrage</option>
            <option value="Buchung">Buchung</option>
          </select>
        </div>
      </div>

      {/* Kanban Board */}
      <SchulsongKanban
        schulsongs={filteredSchulsongs}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
        onRefresh={fetchSchulsongs}
      />

      {/* Create Modal */}
      {showCreateModal && (
        <CreateSchulsongModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
