'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getSchulsongClothingCountdown, getEarlyBirdCountdown } from '@/lib/utils/eventTimeline';
import { parseOverrides, getThreshold } from '@/lib/utils/eventThresholds';

interface OrderDeadlineCountdownProps {
  eventDate: string;
  profileType: string;
  timelineOverrides?: string | null;
}

export default function OrderDeadlineCountdown({
  eventDate,
  profileType,
  timelineOverrides,
}: OrderDeadlineCountdownProps) {
  const t = useTranslations('orderDeadline');
  const locale = useLocale();
  const [hasMounted, setHasMounted] = useState(false);
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  const isSchulsong = profileType === 'schulsong-only';
  const isEarlyBird = profileType === 'minimusikertag' || profileType === 'plus';

  const overrides = useMemo(() => parseOverrides(timelineOverrides), [timelineOverrides]);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!eventDate) return;

    const update = () => {
      if (isSchulsong) {
        const days = Math.abs(getThreshold('schulsong_clothing_cutoff_days', overrides));
        setCountdown(getSchulsongClothingCountdown(eventDate, days));
      } else if (isEarlyBird) {
        const days = getThreshold('early_bird_deadline_days', overrides);
        setCountdown(getEarlyBirdCountdown(eventDate, days));
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [eventDate, isSchulsong, isEarlyBird, overrides]);

  // Guard: only for supported profile types
  if (!isSchulsong && !isEarlyBird) return null;

  // Guard: SSR hydration
  if (!hasMounted) return null;

  // Guard: no event date or deadline passed
  if (!eventDate || !countdown) return null;

  const pad = (n: number) => String(n).padStart(2, '0');

  const dayLabel =
    locale === 'de'
      ? countdown.days === 1
        ? 'Tag'
        : 'Tage'
      : countdown.days === 1
        ? 'day'
        : 'days';

  const message = isSchulsong ? t('clothingMessage') : t('earlyBirdMessage');

  return (
    <div className="bg-gradient-to-r from-sage-500 to-sage-700 rounded-xl py-3 px-4 mb-6">
      <div className="flex items-center justify-center gap-2 text-white text-sm sm:text-base">
        {/* Shopping bag icon */}
        <svg
          className="w-5 h-5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
        <span>
          {message}{' '}
          <span className="font-bold tabular-nums">
            {countdown.days} {dayLabel} {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
          </span>
        </span>
      </div>
    </div>
  );
}
