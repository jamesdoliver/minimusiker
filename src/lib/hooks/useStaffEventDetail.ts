'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { SchoolEventDetail } from '@/lib/types/airtable';

interface StaffGroup {
  groupId: string;
  groupName: string;
  memberClasses: { classId: string; className: string }[];
  songs: { id: string; title: string; artist?: string; notes?: string; order?: number }[];
}

interface StaffEventDetailData extends SchoolEventDetail {
  groups: StaffGroup[];
}

interface StaffEventDetailResponse {
  success: boolean;
  data: StaffEventDetailData;
  error?: string;
}

const fetcher = async (url: string): Promise<StaffEventDetailResponse> => {
  const response = await fetch(url, { credentials: 'include' });
  if (response.status === 401) {
    throw new Error('UNAUTHORIZED');
  }
  if (response.status === 404) {
    throw new Error('NOT_FOUND');
  }
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch event details');
  }
  return response.json();
};

export function useStaffEventDetail(eventId: string) {
  const { data, error, isLoading, isValidating, mutate } = useSWR<StaffEventDetailResponse>(
    eventId ? `/api/staff/events/${encodeURIComponent(eventId)}` : null,
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
    event: data?.data ?? null,
    isLoading,
    isValidating,
    isUnauthorized: error?.message === 'UNAUTHORIZED',
    isNotFound: error?.message === 'NOT_FOUND',
    error: error && error.message !== 'UNAUTHORIZED' && error.message !== 'NOT_FOUND'
      ? (error instanceof Error ? error.message : 'Failed to load event')
      : null,
    mutate,
    refresh,
  };
}
