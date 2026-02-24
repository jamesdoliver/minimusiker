'use client';

import useSWR from 'swr';
import { useCallback } from 'react';
import { BookingWithDetails, StaffOption, RegionOption } from '@/app/api/admin/bookings/route';

interface BookingsResponse {
  success: boolean;
  data: {
    bookings: BookingWithDetails[];
    stats: {
      total: number;
      confirmed: number;
      pending: number;
      cancelled: number;
    };
    staffList: StaffOption[];
    regionList: RegionOption[];
  };
  error?: string;
}

const fetcher = async (url: string): Promise<BookingsResponse> => {
  const response = await fetch(url, { credentials: 'include' });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to fetch bookings');
  }
  return response.json();
};

export function useBookings() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<BookingsResponse>(
    '/api/admin/bookings',
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
    bookings: data?.data?.bookings ?? [],
    staffList: data?.data?.staffList ?? [],
    regionList: data?.data?.regionList ?? [],
    isLoading,
    isValidating,
    error: error ? (error instanceof Error ? error.message : 'Failed to load bookings') : null,
    mutate,
    refresh,
  };
}
