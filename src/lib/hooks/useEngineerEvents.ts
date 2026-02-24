'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { EngineerEventSummary } from '@/lib/types/engineer';

interface EngineerEventsResponse {
  success: boolean;
  events: EngineerEventSummary[];
  error?: string;
}

const fetcher = async (url: string): Promise<EngineerEventsResponse> => {
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

export function useEngineerEvents() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<EngineerEventsResponse>(
    '/api/engineer/events',
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
