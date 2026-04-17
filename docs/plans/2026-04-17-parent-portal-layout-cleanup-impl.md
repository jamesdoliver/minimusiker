# Parent Portal Layout Cleanup Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Hide preparation sections post-event and merge the schulsong into the audio section as the first track with a golden glow.

**Architecture:** Two independent changes in `/familie/page.tsx`: (1) an `isPostEvent` flag gates HeroIntroSection and PreparationSection, (2) schulsong audio data is stored from the existing API call and rendered inline above the audio state A/B/C using CompactSongPlayer in a golden-glow card. SchulsongSection standalone component is removed from the page.

**Tech Stack:** Next.js 14 · React 18 · TypeScript · Tailwind · CompactSongPlayer (existing) · `next-intl`

**Reference design:** `docs/plans/2026-04-17-parent-portal-layout-cleanup-design.md`

---

## Worktree

All work in: `.worktrees/parent_portal_rework/` on branch `parent_portal_rework`.

```bash
cd /Users/jamesoliver/WebstormProjects/MiniMusiker/.worktrees/parent_portal_rework
```

---

## Task 1: Add i18n key for schulsong label

**Files:**
- Modify: `messages/de.json`
- Modify: `messages/en.json`

**Step 1:** Inside the existing `"parentPortalCard"` block in both files, add:

`messages/de.json`:
```json
      "schoolSong": "Euer Schulsong"
```

`messages/en.json`:
```json
      "schoolSong": "Your School Song"
```

Remember to add a comma to the previous key.

**Step 2: Validate JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/de.json', 'utf8')); JSON.parse(require('fs').readFileSync('messages/en.json', 'utf8')); console.log('OK')"
```

**Step 3: Commit**

```bash
git add messages/de.json messages/en.json
git commit -m "i18n: add school song label key (de + en)"
```

---

## Task 2: Post-event hiding + schulsong merge

This is the core task. All changes are in `/src/app/familie/page.tsx`.

**Files:**
- Modify: `src/app/familie/page.tsx`

### Step 1: Add schulsong state variables

After the existing state declarations (around line 100, after `const [isStandardMerchOnly, setIsStandardMerchOnly] = useState(false);`), add:

```typescript
  const [hasSchulsongAudio, setHasSchulsongAudio] = useState(false);
  const [schulsongAudioUrl, setSchulsongAudioUrl] = useState<string | null>(null);
  const [schulsongDownloadUrl, setSchulsongDownloadUrl] = useState<string | null>(null);
  const [isPlayingSchulsong, setIsPlayingSchulsong] = useState(false);
```

### Step 2: Store schulsong data from existing fetch

In the `fetchSchulsongStatus` callback (around line 193-234), AFTER the existing `setIsStandardMerchOnly(data.isStandardMerchOnly === true);` line (line 227), add:

```typescript
          // Store schulsong audio data for inline rendering
          if (data.isSchulsong && data.hasAudio) {
            setHasSchulsongAudio(true);
            setSchulsongAudioUrl(data.audioUrl || null);
            setSchulsongDownloadUrl(data.downloadUrl || null);
          }
```

### Step 3: Add `isPostEvent` computation

After the existing derived state (around line 241, after `const isSchulsongOnly = ...;`), add:

```typescript
  // Hide preparation sections the calendar day after the event
  const isPostEvent = eventDate
    ? new Date(new Date().toDateString()) > new Date(new Date(eventDate).toDateString())
    : false;
```

### Step 4: Add CompactSongPlayer import

At the top of the file, add:

```typescript
import CompactSongPlayer from '@/components/parent-portal/CompactSongPlayer';
```

### Step 5: Add a translations namespace for the parent portal card

Near the existing `useTranslations` calls (around lines 86-90), add:

```typescript
  const tCard = useTranslations('parentPortalCard');
```

### Step 6: Update HeroIntroSection conditional

Find line 417:
```tsx
      {!isSchulsongOnly && <HeroIntroSection />}
```

Replace with:
```tsx
      {!isSchulsongOnly && !isPostEvent && <HeroIntroSection />}
```

### Step 7: Update PreparationSection conditional

Find line 420:
```tsx
      {!isSchulsongOnly && <PreparationSection />}
```

Replace with:
```tsx
      {!isSchulsongOnly && !isPostEvent && <PreparationSection />}
```

### Step 8: Remove SchulsongSection

Find line 422-423:
```tsx
      {/* Schulsong Section - Free school song with waveform player */}
      {eventId && <SchulsongSection eventId={eventId} />}
```

DELETE these two lines entirely.

Also remove the import at the top of the file (line 14):
```typescript
import SchulsongSection from '@/components/parent-portal/SchulsongSection';
```

### Step 9: Add inline schulsong rendering above audio states

BETWEEN the deleted SchulsongSection location and the audio state comment block (the `/* ================================================================` comment at line 425), insert:

```tsx
      {/* Schulsong — inline in audio section, golden glow, always first when available */}
      {hasSchulsongAudio && schulsongAudioUrl && (
        <section className="bg-white pt-8 pb-4">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="border-2 border-amber-400 bg-amber-50/30 shadow-[0_0_20px_rgba(245,158,11,0.25)] rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2.5 py-0.5 bg-amber-500 text-white text-xs font-bold rounded-full">
                  {tCard('schoolSong')}
                </span>
              </div>
              <CompactSongPlayer
                audioUrl={schulsongAudioUrl}
                isActive={isPlayingSchulsong}
                isPlaying={isPlayingSchulsong}
                onTogglePlay={() => setIsPlayingSchulsong((prev) => !prev)}
                onEnded={() => setIsPlayingSchulsong(false)}
              />
              {schulsongDownloadUrl && (
                <div className="mt-3 flex justify-end">
                  <a
                    href={schulsongDownloadUrl}
                    download
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download
                  </a>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
```

### Step 10: Type-check

```bash
npm run type-check
```
Expected: no new errors in source files.

### Step 11: Commit

```bash
git add src/app/familie/page.tsx
git commit -m "feat(parent-portal): hide prep sections post-event and merge schulsong into audio section"
```

---

## Task 3: Final verification

**Step 1: Run all tests**

```bash
npm test
```
Expected: same 5 pre-existing failures in eventTimeline only.

**Step 2: Type-check**

```bash
npm run type-check
```

**Step 3: Lint**

```bash
npx next lint --file src/app/familie/page.tsx
```

**Step 4: Git status + log**

```bash
git status
git log --oneline d13a5c9..HEAD
```
Expected: clean tree, 3 commits (i18n + main change + plan doc was already committed before this plan).

---

## Out of scope

- No API changes (schulsong data comes from existing response).
- No changes to SchulsongSection.tsx file itself (just stop rendering it).
- No changes to CompactSongPlayer or EventAudioTracklist.
- No WaveSurfer usage.
- No changes to ProductSelector, cards, or shop.

## When done

Use `superpowers:finishing-a-development-branch` to choose merge / PR / cleanup.
