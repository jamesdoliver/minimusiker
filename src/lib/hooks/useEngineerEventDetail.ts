'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { EngineerEventDetail } from '@/lib/types/engineer';

interface EngineerEventDetailResponse {
  success: boolean;
  event: EngineerEventDetail;
  error?: string;
}

const fetcher = async (url: string): Promise<EngineerEventDetailResponse> => {
  const response = await fetch(url, { credentials: 'include' });
  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (response.status === 403) {
    throw new Error('FORBIDDEN');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch event details');
  }
  return response.json();
};

export function useEngineerEventDetail(eventId: string) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<EngineerEventDetailResponse>(
    eventId ? `/api/engineer/events/${encodeURIComponent(eventId)}` : null,
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
    event: data?.event ?? null,
    isLoading,
    isValidating,
    isUnauthorized: error?.message === 'UNAUTHORIZED',
    isForbidden: error?.message === 'FORBIDDEN',
    error: error && error.message !== 'UNAUTHORIZED' && error.message !== 'FORBIDDEN'
      ? (error instanceof Error ? error.message : 'Failed to load event')
      : null,
    mutate,
    refresh,
  };
}
