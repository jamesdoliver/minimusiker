'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { SchoolEventSummary } from '@/lib/types/airtable';

interface StaffEventsResponse {
  success: boolean;
  events: SchoolEventSummary[];
  staff: {
    email: string;
    name: string;
    personenId?: string;
  } | null;
  error?: string;
}

const fetcher = async (url: string): Promise<StaffEventsResponse> => {
  const response = await fetch(url, { credentials: 'include' });
  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch events');
  }
  return response.json();
};

export function useStaffEvents() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<StaffEventsResponse>(
    '/api/staff/events',
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 10000,
      keepPreviousData: true,
    }
  );

  const refresh = useCallback(() => {
    mutate();
  }, [mutate]);

  return {
    events: data?.events ?? [],
    staffInfo: data?.staff ?? null,
    isLoading,
    isValidating,
    isUnauthorized: error?.message === 'UNAUTHORIZED',
    error: error && error.message !== 'UNAUTHORIZED'
      ? (error instanceof Error ? error.message : 'Failed to load events')
      : null,
    mutate,
    refresh,
  };
}
