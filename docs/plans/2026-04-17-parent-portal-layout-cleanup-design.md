# Parent Portal — Layout Cleanup: Post-Event Hiding + Schulsong Merge (Design)

**Date:** 2026-04-17
**Branch:** `parent_portal_rework`
**Status:** Design validated, ready for implementation plan

## Problem

The `/familie` parent portal shows preparation materials (intro video, PDF download) that are irrelevant after the event. The schulsong (free school song) renders as a standalone section disconnected from the rest of the audio content. Parents see a fragmented audio experience.

## Goal

1. Hide preparation sections (HeroIntroSection, PreparationSection) starting the calendar day after the event.
2. Merge the schulsong into the audio section as the first track with a golden glow, removing the standalone SchulsongSection.

## Scope

**In scope:**

- Post-event hiding of HeroIntroSection and PreparationSection via `isPostEvent` flag.
- Remove SchulsongSection from its standalone position.
- Store schulsong audio data from the existing `/api/parent/schulsong-status` response (no new API calls).
- Render schulsong as a golden-glow card at the top of the audio section using CompactSongPlayer.
- 2 new i18n keys for the schulsong label.

**Out of scope:**

- No API changes.
- No changes to SchulsongSection.tsx itself (just stop importing/rendering it).
- No changes to EventAudioTracklist component.
- No WaveSurfer usage (CompactSongPlayer for consistency).
- No changes to the audio state machine (A/B/C logic unchanged).
- No changes to ProductSelector, card components, or shop.

## Design

### Post-event hiding

Compute `isPostEvent` in `/familie/page.tsx`:

```typescript
const isPostEvent = eventDate
  ? new Date(new Date().toDateString()) > new Date(new Date(eventDate).toDateString())
  : false;
```

True starting the calendar day after the event. Defaults to `false` when no `eventDate` (safe — shows everything).

Sections hidden when `isPostEvent`:

1. `HeroIntroSection`: `{!isSchulsongOnly && !isPostEvent && <HeroIntroSection />}`
2. `PreparationSection`: `{!isSchulsongOnly && !isPostEvent && <PreparationSection ... />}`

Sections NOT hidden (always visible):
- Header, Child Selector, School Banner
- Audio section (with merged schulsong)
- OrderDeadlineCountdown (self-hides when deadline passes)
- ProductSelector + CartDrawer
- ManageChildren

### Schulsong merge into audio section

**Data flow:**

The page's `fetchSchulsongStatus` effect already calls `/api/parent/schulsong-status` for shop profile resolution. Extend it to also store:

```typescript
const [hasSchulsongAudio, setHasSchulsongAudio] = useState(false);
const [schulsongAudioUrl, setSchulsongAudioUrl] = useState<string | null>(null);
const [schulsongDownloadUrl, setSchulsongDownloadUrl] = useState<string | null>(null);
```

Populated from the same response — zero new API calls.

**Rendering:**

Remove `<SchulsongSection eventId={eventId} />` from its standalone position.

In the audio section area, ABOVE the existing state A/B/C content, render:

```tsx
{shopProfile && hasSchulsongAudio && schulsongAudioUrl && (
  <div className="border-2 border-amber-400 bg-amber-50/30 shadow-[0_0_20px_rgba(245,158,11,0.25)] rounded-xl p-4 mb-6">
    <div className="flex items-center gap-2 mb-3">
      <span className="px-2 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
        {t('schoolSong')}
      </span>
    </div>
    <CompactSongPlayer
      audioUrl={schulsongAudioUrl}
      isActive={...}
      isPlaying={...}
      onTogglePlay={...}
      onEnded={...}
    />
    {schulsongDownloadUrl && (
      <a href={schulsongDownloadUrl} download className="...">Download</a>
    )}
  </div>
)}
```

- Golden glow: `border-amber-400 bg-amber-50/30 shadow-[0_0_20px_rgba(245,158,11,0.25)]`
- Badge: "Euer Schulsong" / "Your School Song" (amber-500 pill)
- CompactSongPlayer for consistency with EventAudioTracklist tracks
- Download button beside the player
- Visible regardless of audio state A/B/C (independent of minicard purchase)
- Visible regardless of event timing (pre-event, event day, post-event)
- Only shown when `hasSchulsongAudio && schulsongAudioUrl` — no placeholder if audio not ready

**Player state management:**

The schulsong CompactSongPlayer needs play/pause state. Add a simple `isPlayingSchulsong` state in the page, or integrate with the existing `currentlyPlayingId` pattern used by EventAudioTracklist. Since the page controls the audio section, a simple `useRef<HTMLAudioElement>` or lightweight state is sufficient — the schulsong is a single track, not a list.

### i18n

Add to both `messages/de.json` and `messages/en.json` inside the existing `parentPortalCard` block:

```json
"schoolSong": "Euer Schulsong"   // DE
"schoolSong": "Your School Song" // EN
```

### Edge cases

| Case | Behaviour |
|------|-----------|
| No schulsong event | No golden card. Audio section unchanged. |
| Schulsong event, audio not ready | No golden card. Audio states A/B/C render normally. |
| Schulsong ready, no class audio yet | Golden schulsong card only. "Coming Soon" below. |
| Schulsong ready, full tracklist unlocked | Golden schulsong card at top, EventAudioTracklist below. |
| No eventDate | `isPostEvent=false`, all sections visible. |
| Schulsong-only event | HeroIntro + Preparation already hidden. Post-event hiding redundant but harmless. |

## Dependencies

- `CompactSongPlayer` (existing component in `src/components/parent-portal/`)
- Existing `/api/parent/schulsong-status` response (no changes)
- Existing `isSchulsongOnly` flag
- Existing `eventDate` from session

## Rollout

Two conditional checks in page JSX + schulsong inline rendering. No migration, no feature flag, no data changes.
