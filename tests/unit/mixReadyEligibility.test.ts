// Mock the Airtable module — importing mixReadyEmailService pulls in
// emailAutomationService → airtableService, which top-level requires the
// `airtable` package. We don't exercise it from this pure-predicate test,
// but the require chain still needs to resolve cleanly.
jest.mock('airtable', () => {
  const mockTable = jest.fn(() => ({ select: jest.fn(), find: jest.fn() }));
  const mockBase = jest.fn(() => mockTable);
  return jest.fn(() => ({ base: mockBase }));
});

import { isMixReadyForEvent } from '@/lib/services/mixReadyEmailService';
import type { Event } from '@/lib/types/airtable';

function baseEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'recE',
    event_id: 'evt_1',
    school_name: 'Test',
    event_date: '2026-04-01',
    is_minimusikertag: true,
    is_plus: false,
    is_schulsong: false,
    is_kita: false,
    status: 'Confirmed',
    audio_pipeline_stage: 'finals_submitted',
    schulsong_released_at: undefined,
    timeline_overrides: undefined,
    ...overrides,
  } as Event;
}

describe('isMixReadyForEvent', () => {
  it('Mimi event with finals_submitted is eligible', () => {
    expect(isMixReadyForEvent(baseEvent())).toBe(true);
  });

  it('Plus event with finals_submitted is eligible', () => {
    expect(isMixReadyForEvent(baseEvent({ is_minimusikertag: false, is_plus: true }))).toBe(true);
  });

  it('schulsong-only event is NOT eligible (handled by existing schulsong_release trigger)', () => {
    expect(isMixReadyForEvent(baseEvent({ is_minimusikertag: false, is_plus: false, is_schulsong: true }))).toBe(false);
  });

  it('Mimi+Schulsong combined event needs schulsong_released_at to be set', () => {
    expect(isMixReadyForEvent(baseEvent({ is_schulsong: true }))).toBe(false);
    expect(isMixReadyForEvent(baseEvent({ is_schulsong: true, schulsong_released_at: '2026-04-15T07:00:00Z' }))).toBe(true);
  });

  it('not eligible when audio_pipeline_stage is not finals_submitted', () => {
    expect(isMixReadyForEvent(baseEvent({ audio_pipeline_stage: 'staff_uploaded' }))).toBe(false);
    expect(isMixReadyForEvent(baseEvent({ audio_pipeline_stage: 'not_started' }))).toBe(false);
  });

  it('not eligible when event is cancelled or deleted', () => {
    expect(isMixReadyForEvent(baseEvent({ status: 'Cancelled' }))).toBe(false);
    expect(isMixReadyForEvent(baseEvent({ status: 'Deleted' }))).toBe(false);
  });

  it('not eligible when audio_hidden is set in timeline_overrides', () => {
    expect(isMixReadyForEvent(baseEvent({ timeline_overrides: '{"audio_hidden":true}' }))).toBe(false);
  });

  it('not eligible when communications_paused is set in timeline_overrides', () => {
    expect(isMixReadyForEvent(baseEvent({ timeline_overrides: '{"communications_paused":true}' }))).toBe(false);
  });

  it('not eligible when event_id is in the pre-launch backlog skip set', () => {
    // Pick any one of the 12 backlog event_ids — the predicate must short-circuit
    // even though every other gating condition is satisfied.
    expect(isMixReadyForEvent(baseEvent({ event_id: 'evt_sterfeldschule_minimusiker_20260318_5104a0' }))).toBe(false);
    expect(isMixReadyForEvent(baseEvent({ event_id: 'evt_grundschule_am_r_merbad_zunzwe_minimusiker_20260302_1afb54' }))).toBe(false);
  });
});
