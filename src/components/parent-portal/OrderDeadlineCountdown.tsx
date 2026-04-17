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

  const discountLabel = locale === 'de' ? 'RABATT' : 'OFF';

  return (
    <div className="bg-gradient-to-r from-sage-500 to-sage-700 rounded-xl py-5 px-6 mb-6 ring-2 ring-sage-300 animate-pulse">
      <div className="flex flex-col sm:flex-row items-center gap-4 text-white">
        {/* Discount badge — left side */}
        {isEarlyBird && (
          <div className="flex-shrink-0 bg-white/20 rounded-lg px-4 py-2 text-center">
            <div className="text-3xl sm:text-4xl font-bold leading-none">10%</div>
            <div className="text-xs font-bold uppercase tracking-wider mt-0.5">{discountLabel}</div>
          </div>
        )}

        {/* Message + countdown — right side */}
        <div className="flex-1 text-center sm:text-left">
          <p className="text-sm sm:text-base font-medium opacity-90">{message}</p>
          <div className="flex items-baseline justify-center sm:justify-start gap-1.5 mt-1">
            <span className="text-2xl sm:text-3xl font-bold tabular-nums">
              {countdown.days}
            </span>
            <span className="text-xs opacity-75 mr-2">{dayLabel}</span>
            <span className="text-2xl sm:text-3xl font-bold tabular-nums">
              {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
