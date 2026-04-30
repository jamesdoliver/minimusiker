import type { Event } from '@/lib/types/airtable';
import { parseOverrides } from '@/lib/utils/eventThresholds';
import { getEventTier } from '@/lib/services/emailAutomationService';

export function isMixReadyForEvent(event: Event): boolean {
  // Tier check — Mimi/Plus only. Pure schulsong-only is handled by the
  // existing schulsong_release trigger.
  const tier = getEventTier({
    isMinimusikertag: event.is_minimusikertag,
    isPlus: event.is_plus,
    isSchulsong: event.is_schulsong,
    eventId: event.event_id,
    schoolName: event.school_name,
  });
  if (tier !== 'minimusikertag' && tier !== 'plus') return false;

  if (event.status === 'Cancelled' || event.status === 'Deleted') return false;

  if (event.audio_pipeline_stage !== 'finals_submitted') return false;

  // For schulsong-appended events, teacher must have approved schulsong
  // (the approve route writes schulsong_released_at to a non-null value).
  if (event.is_schulsong && !event.schulsong_released_at) return false;

  const overrides = parseOverrides(event.timeline_overrides);
  if (overrides?.audio_hidden === true) return false;
  if (overrides?.communications_paused === true) return false;

  return true;
}
