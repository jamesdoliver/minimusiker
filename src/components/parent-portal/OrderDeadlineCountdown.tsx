'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { getSchulsongClothingCountdown, getEarlyBirdCountdown } from '@/lib/utils/eventTimeline';

interface OrderDeadlineCountdownProps {
  eventDate: string;
  profileType: string;
}

export default function OrderDeadlineCountdown({
  eventDate,
  profileType,
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

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!eventDate) return;

    const update = () => {
      if (isSchulsong) {
        setCountdown(getSchulsongClothingCountdown(eventDate));
      } else if (isEarlyBird) {
        setCountdown(getEarlyBirdCountdown(eventDate));
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [eventDate, isSchulsong, isEarlyBird]);

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
