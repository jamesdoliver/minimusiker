# Staff Event Detail Enrichment — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show all class types (regular, choir, teacher_song), groups, and schulsong with songs on the staff event detail page, plus a dedicated audio streaming/download section.

**Architecture:** Enhance the staff event detail API to fetch groups alongside the existing data. Refactor the frontend into categorized sections with color-coded cards. Add three staff audio API routes (mirroring the teacher pattern) and a `StaffAudioSection` component adapted from the teacher's `AudioDownloadSection`.

**Tech Stack:** Next.js API routes, SWR, Airtable SDK, R2 signed URLs, archiver (zip)

---

### Task 1: Add groups to staff event detail API

**Files:**
- Modify: `src/app/api/staff/events/[eventId]/route.ts`

**Step 1: Add groups fetch to Promise.all and include in response**

The current route fetches `[eventDetail, allSongs]`. Add `getGroupsByEventId` as a third parallel fetch. Attach songs to groups the same way we attach them to classes.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getAirtableService } from '@/lib/services/airtableService';
import { getTeacherService } from '@/lib/services/teacherService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyStaffSession(request);

    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();

    // Fetch event detail, songs, and groups in parallel
    const [eventDetail, allSongs, groups] = await Promise.all([
      getAirtableService().getSchoolEventDetail(eventId),
      teacherService.getSongsByEventId(eventId).catch((err) => {
        console.error('Error fetching songs for staff event detail:', err);
        return [];
      }),
      teacherService.getGroupsByEventId(eventId).catch((err) => {
        console.error('Error fetching groups for staff event detail:', err);
        return [];
      }),
    ]);

    if (!eventDetail) {
      return NextResponse.json(
        { success: false, error: 'Event not found' },
        { status: 404 }
      );
    }

    // Attach songs to classes
    for (const cls of eventDetail.classes) {
      cls.songs = allSongs
        .filter(s => s.classId === cls.classId)
        .map(s => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          notes: s.notes,
          order: s.order,
          hiddenByEngineer: s.hiddenByEngineer,
        }));
    }

    // Build simplified groups with songs attached
    const groupsWithSongs = groups.map(group => {
      const groupSongs = allSongs
        .filter(s => s.classId === group.groupId)
        .map(s => ({
          id: s.id,
          title: s.title,
          artist: s.artist,
          notes: s.notes,
          order: s.order,
        }));

      return {
        groupId: group.groupId,
        groupName: group.groupName,
        memberClasses: (group.memberClasses || []).map(c => ({
          classId: c.classId,
          className: c.className,
        })),
        songs: groupSongs,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        ...eventDetail,
        groups: groupsWithSongs,
      },
    });
  } catch (error) {
    console.error('Error fetching staff event detail:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch event details',
      },
      { status: 500 }
    );
  }
}
```

**Step 2: Update the SWR hook response type**

In `src/lib/hooks/useStaffEventDetail.ts`, the response type uses `SchoolEventDetail` from `@/lib/types/airtable`. The `groups` field is new — we need to add it to the response interface. The simplest approach: define a `StaffEventDetailData` type that extends `SchoolEventDetail` with the groups field.

In `src/lib/hooks/useStaffEventDetail.ts`, update:

```typescript
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
```

Update the return type of the hook's `event` field to `StaffEventDetailData | null`.

**Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "error" | grep -v "test"`

**Step 4: Commit**

```bash
git add src/app/api/staff/events/\[eventId\]/route.ts src/lib/hooks/useStaffEventDetail.ts
git commit -m "feat: add groups with songs to staff event detail API"
```

---

### Task 2: Refactor staff event detail page — categorized sections

**Files:**
- Modify: `src/app/staff/events/[eventId]/page.tsx`

**Step 1: Replace the single "Classes Overview" with categorized sections**

Split `event.classes` by `classType`:
- `regularClasses`: `classType === 'regular'` or missing/undefined
- `choirs`: `classType === 'choir'`
- `teacherSongs`: `classType === 'teacher_song'` — but exclude any class with `className === 'Schulsong'` if `event.isSchulsong` is true (that goes in the schulsong section)
- `schulsongClass`: if `event.isSchulsong`, find the class with `className === 'Schulsong'` or `classType === 'teacher_song'` that looks like the schulsong

Groups come from `event.groups` (the new field from Task 1).

The page structure becomes:

```tsx
// Categorize classes
const regularClasses = event.classes.filter(
  c => !c.classType || c.classType === 'regular'
);
const choirs = event.classes.filter(c => c.classType === 'choir');

// Separate schulsong from teacher_song collections
const schulsongClass = event.isSchulsong
  ? event.classes.find(c => c.className === 'Schulsong' && c.classType === 'teacher_song')
  : null;
const teacherSongs = event.classes.filter(
  c => c.classType === 'teacher_song' && c !== schulsongClass
);

const groups = event.groups || [];
```

Then render sections in order:

1. **Regular Classes** — Keep the existing table exactly as-is, but filter to `regularClasses` only. Title stays "Classes Overview".

2. **Groups** — Only if `groups.length > 0`. Purple accent card per group:
```tsx
{groups.length > 0 && (
  <div className="mb-8">
    <h2 className="text-xl font-semibold text-gray-900 mb-4">Gruppen</h2>
    <div className="space-y-4">
      {groups.map(group => (
        <div key={group.groupId} className="bg-white rounded-xl shadow-sm border border-purple-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
              Gruppe
            </span>
            <h3 className="text-lg font-semibold text-gray-900">{group.groupName}</h3>
          </div>
          <p className="text-sm text-gray-500 mb-3">
            {group.memberClasses.map(c => c.className).join(' + ')}
          </p>
          {group.songs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {group.songs.map(song => (
                <span key={song.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                  {song.title}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

3. **Chor** — Only if `choirs.length > 0`. Teal accent:
```tsx
{choirs.length > 0 && (
  <div className="mb-8">
    <h2 className="text-xl font-semibold text-gray-900 mb-4">Chor</h2>
    <div className="space-y-4">
      {choirs.map(choir => (
        <div key={choir.classId} className="bg-white rounded-xl shadow-sm border border-teal-200 p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
              Chor
            </span>
            <h3 className="text-lg font-semibold text-gray-900">{choir.className}</h3>
          </div>
          {choir.songs && choir.songs.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {choir.songs.map(song => (
                <span key={song.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-50 text-teal-700">
                  {song.title}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Keine Lieder zugewiesen</p>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

4. **Lehrerlied** — Only if `teacherSongs.length > 0`. Amber accent (same card structure as Chor but with amber colors and "Lehrerlied" badge).

5. **Schulsong** — Only if `schulsongClass`. Green accent:
```tsx
{schulsongClass && (
  <div className="mb-8">
    <h2 className="text-xl font-semibold text-gray-900 mb-4">Schulsong</h2>
    <div className="bg-white rounded-xl shadow-sm border border-green-200 p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          Schulsong
        </span>
        <h3 className="text-lg font-semibold text-gray-900">{schulsongClass.className}</h3>
      </div>
      {schulsongClass.songs && schulsongClass.songs.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {schulsongClass.songs.map(song => (
            <span key={song.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
              {song.title}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400">Keine Lieder zugewiesen</p>
      )}
    </div>
  </div>
)}
```

6. Logic Project Upload Section (unchanged, already at bottom).

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep -i "error" | grep -v "test"`

**Step 3: Commit**

```bash
git add src/app/staff/events/\[eventId\]/page.tsx
git commit -m "feat: staff event detail shows groups, chors, lehrerlied, and schulsong sections"
```

---

### Task 3: Create staff audio downloads list API route

**Files:**
- Create: `src/app/api/staff/events/[eventId]/audio-downloads/route.ts`

**Step 1: Create the route**

Mirror the teacher route at `src/app/api/teacher/events/[eventId]/audio-downloads/route.ts` but use `verifyStaffSession` and skip the teacher event access check (staff are already authenticated, and we trust the eventId). Staff don't have the `isDefault` class concept, so we include all non-schulsong final+ready files grouped by classId.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { AudioFile } from '@/lib/types/teacher';

export const dynamic = 'force-dynamic';

/**
 * GET /api/staff/events/[eventId]/audio-downloads
 * List downloadable audio tracks for a staff member's event.
 * Returns metadata only (no actual file bytes).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();

    // Fetch event detail (for class names) and audio files in parallel
    const [eventDetail, allAudioFiles] = await Promise.all([
      getAirtableService().getSchoolEventDetail(eventId),
      teacherService.getAudioFilesByEventId(eventId),
    ]);

    if (!eventDetail) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Filter to final + ready files only
    const finalReadyFiles = allAudioFiles.filter(
      (f: AudioFile) => f.type === 'final' && f.status === 'ready'
    );

    if (finalReadyFiles.length === 0) {
      return NextResponse.json({ success: true, tracks: [] });
    }

    // Group by classId, separate schulsong
    const filesByClass = new Map<string, AudioFile[]>();
    const schulsongFiles: AudioFile[] = [];

    for (const f of finalReadyFiles) {
      if (f.isSchulsong) {
        schulsongFiles.push(f);
        continue;
      }
      const existing = filesByClass.get(f.classId) || [];
      existing.push(f);
      filesByClass.set(f.classId, existing);
    }

    const tracks: {
      fileId: string;
      className: string;
      classType?: string;
      songTitle?: string;
      fileSizeBytes?: number;
      isSchulsong: boolean;
    }[] = [];

    // One track per class that has final audio (prefer MP3)
    for (const cls of eventDetail.classes) {
      const candidates = filesByClass.get(cls.classId);
      if (!candidates || candidates.length === 0) continue;

      const best = pickBestFile(candidates);

      // Try to resolve song title
      const songTitle = best.songId && cls.songs
        ? cls.songs.find(s => s.id === best.songId)?.title
        : cls.songs?.length === 1
          ? cls.songs[0].title
          : undefined;

      tracks.push({
        fileId: best.id,
        className: cls.className,
        classType: cls.classType,
        songTitle,
        fileSizeBytes: best.fileSizeBytes,
        isSchulsong: false,
      });
    }

    // Schulsong track
    if (eventDetail.isSchulsong && schulsongFiles.length > 0) {
      const best = pickBestFile(schulsongFiles);
      tracks.push({
        fileId: best.id,
        className: 'Schulsong',
        classType: undefined,
        songTitle: undefined,
        fileSizeBytes: best.fileSizeBytes,
        isSchulsong: true,
      });
    }

    return NextResponse.json({ success: true, tracks });
  } catch (error) {
    console.error('Error fetching staff audio downloads:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to fetch audio downloads' },
      { status: 500 }
    );
  }
}

function pickBestFile(candidates: AudioFile[]): AudioFile {
  const mp3 = candidates.find((f) => f.r2Key.endsWith('.mp3'));
  return mp3 ?? candidates[0];
}
```

**Step 2: Verify TypeScript compiles**

**Step 3: Commit**

```bash
git add src/app/api/staff/events/\[eventId\]/audio-downloads/route.ts
git commit -m "feat: add staff audio downloads list API route"
```

---

### Task 4: Create staff audio download/stream single file API route

**Files:**
- Create: `src/app/api/staff/events/[eventId]/audio-downloads/[fileId]/route.ts`

**Step 1: Create the route**

Mirror `src/app/api/teacher/events/[eventId]/audio-downloads/[fileId]/route.ts` with `verifyStaffSession`.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getR2Service } from '@/lib/services/r2Service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/staff/events/[eventId]/audio-downloads/[fileId]
 * Download or stream a single audio track via signed R2 URL.
 *
 * ?stream=1 — returns JSON { url } for audio element playback.
 * Default   — redirects with Content-Disposition for download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string; fileId: string } }
) {
  try {
    const session = verifyStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const fileId = params.fileId;
    const teacherService = getTeacherService();

    // Fetch audio files for this event and find the requested one
    const allAudioFiles = await teacherService.getAudioFilesByEventId(eventId);
    const audioFile = allAudioFiles.find(
      (f) => f.id === fileId && f.type === 'final' && f.status === 'ready'
    );

    if (!audioFile) {
      return NextResponse.json(
        { error: 'Audio file not found or not available' },
        { status: 404 }
      );
    }

    const r2Service = getR2Service();

    // Stream mode
    const isStream = request.nextUrl.searchParams.get('stream') === '1';
    if (isStream) {
      const streamUrl = await r2Service.generateSignedUrl(audioFile.r2Key, 3600);
      return NextResponse.json({ url: streamUrl });
    }

    // Download mode — build filename from class name
    let baseName: string;
    if (audioFile.isSchulsong) {
      baseName = 'Schulsong';
    } else {
      const eventDetail = await getAirtableService().getSchoolEventDetail(eventId);
      const matchingClass = eventDetail?.classes.find(c => c.classId === audioFile.classId);
      baseName = matchingClass?.className ?? 'Track';
    }

    const extension = audioFile.r2Key.endsWith('.wav') ? '.wav' : '.mp3';
    const downloadFilename = `${baseName}${extension}`;
    const signedUrl = await r2Service.generateSignedUrl(audioFile.r2Key, 3600, downloadFilename);

    return NextResponse.redirect(signedUrl);
  } catch (error) {
    console.error('Error generating staff audio download URL:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate download URL' },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify TypeScript compiles**

**Step 3: Commit**

```bash
git add "src/app/api/staff/events/[eventId]/audio-downloads/[fileId]/route.ts"
git commit -m "feat: add staff audio stream/download single file API route"
```

---

### Task 5: Create staff audio zip download API route

**Files:**
- Create: `src/app/api/staff/events/[eventId]/audio-downloads/zip/route.ts`

**Step 1: Create the route**

Mirror `src/app/api/teacher/events/[eventId]/audio-downloads/zip/route.ts` with `verifyStaffSession`.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { verifyStaffSession } from '@/lib/auth/verifyStaffSession';
import { getTeacherService } from '@/lib/services/teacherService';
import { getAirtableService } from '@/lib/services/airtableService';
import { getR2Service } from '@/lib/services/r2Service';
import { AudioFile } from '@/lib/types/teacher';
import archiver from 'archiver';
import { PassThrough } from 'stream';

export const dynamic = 'force-dynamic';

/**
 * GET /api/staff/events/[eventId]/audio-downloads/zip
 * Stream a zip archive of all final audio tracks for the event.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { eventId: string } }
) {
  try {
    const session = verifyStaffSession(request);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const eventId = decodeURIComponent(params.eventId);
    const teacherService = getTeacherService();

    // Fetch event detail and audio files in parallel
    const [eventDetail, allAudioFiles] = await Promise.all([
      getAirtableService().getSchoolEventDetail(eventId),
      teacherService.getAudioFilesByEventId(eventId),
    ]);

    if (!eventDetail) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const finalReadyFiles = allAudioFiles.filter(
      (f: AudioFile) => f.type === 'final' && f.status === 'ready'
    );

    if (finalReadyFiles.length === 0) {
      return NextResponse.json(
        { error: 'No final audio files available for download' },
        { status: 404 }
      );
    }

    // Pick best file per class (prefer MP3 over WAV)
    const filesByClass = new Map<string, AudioFile[]>();
    const schulsongFiles: AudioFile[] = [];

    for (const f of finalReadyFiles) {
      if (f.isSchulsong) {
        schulsongFiles.push(f);
        continue;
      }
      const existing = filesByClass.get(f.classId) || [];
      existing.push(f);
      filesByClass.set(f.classId, existing);
    }

    const filesToZip: { buffer: Buffer; zipName: string }[] = [];
    const r2Service = getR2Service();

    for (const cls of eventDetail.classes) {
      const candidates = filesByClass.get(cls.classId);
      if (!candidates || candidates.length === 0) continue;

      const best = pickBestFile(candidates);
      const extension = best.r2Key.endsWith('.mp3') ? '.mp3' : '.wav';
      const zipName = `${cls.className}${extension}`;

      const buffer = await r2Service.getFileBuffer(best.r2Key);
      if (buffer) {
        filesToZip.push({ buffer, zipName });
      }
    }

    if (schulsongFiles.length > 0) {
      const best = pickBestFile(schulsongFiles);
      const extension = best.r2Key.endsWith('.mp3') ? '.mp3' : '.wav';
      const buffer = await r2Service.getFileBuffer(best.r2Key);
      if (buffer) {
        filesToZip.push({ buffer, zipName: `Schulsong${extension}` });
      }
    }

    if (filesToZip.length === 0) {
      return NextResponse.json(
        { error: 'Could not retrieve any audio files from storage' },
        { status: 404 }
      );
    }

    // Build zip
    const archive = archiver('zip', { zlib: { level: 1 } });
    const passThrough = new PassThrough();
    archive.pipe(passThrough);

    for (const { buffer, zipName } of filesToZip) {
      archive.append(buffer, { name: zipName });
    }
    archive.finalize();

    const webStream = new ReadableStream({
      start(controller) {
        passThrough.on('data', (chunk: Buffer) => {
          controller.enqueue(new Uint8Array(chunk));
        });
        passThrough.on('end', () => controller.close());
        passThrough.on('error', (err) => controller.error(err));
      },
      cancel() {
        passThrough.destroy();
        archive.abort();
      },
    });

    const filename = `${eventDetail.schoolName} - Aufnahmen.zip`;

    return new NextResponse(webStream, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="Aufnahmen.zip"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (error) {
    console.error('Error generating staff audio ZIP:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to generate ZIP' },
      { status: 500 }
    );
  }
}

function pickBestFile(candidates: AudioFile[]): AudioFile {
  const mp3 = candidates.find((f) => f.r2Key.endsWith('.mp3'));
  return mp3 ?? candidates[0];
}
```

**Step 2: Verify TypeScript compiles**

**Step 3: Commit**

```bash
git add "src/app/api/staff/events/[eventId]/audio-downloads/zip/route.ts"
git commit -m "feat: add staff audio zip download API route"
```

---

### Task 6: Create StaffAudioSection component

**Files:**
- Create: `src/components/staff/StaffAudioSection.tsx`

**Step 1: Create the component**

Adapt the teacher's `AudioDownloadSection` at `src/components/teacher/AudioDownloadSection.tsx`. Key differences:
- API base path: `/api/staff/events/` instead of `/api/teacher/events/`
- English labels instead of German (the staff portal currently uses English)
- Same play/pause/seek/download/zip functionality

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Track {
  fileId: string;
  className: string;
  classType?: string;
  songTitle?: string;
  fileSizeBytes?: number;
  isSchulsong: boolean;
}

interface StaffAudioSectionProps {
  eventId: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function sortTracks(tracks: Track[]): Track[] {
  return [...tracks].sort((a, b) => {
    // Schulsong last
    if (a.isSchulsong !== b.isSchulsong) return a.isSchulsong ? 1 : -1;
    // Then alphabetical by className
    return a.className.localeCompare(b.className, 'de');
  });
}

export default function StaffAudioSection({ eventId }: StaffAudioSectionProps) {
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [zipDownloading, setZipDownloading] = useState(false);

  // Audio player state
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const fetchDownloads = async () => {
      try {
        const response = await fetch(`/api/staff/events/${encodeURIComponent(eventId)}/audio-downloads`);
        const data = await response.json();
        setTracks(sortTracks(data.tracks || []));
      } catch (err) {
        console.error('Error fetching audio downloads:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDownloads();
  }, [eventId]);

  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => { setIsPlaying(false); setCurrentTime(0); };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, []);

  const handlePlayPause = useCallback(async (trackId: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (activeTrackId === trackId) {
      if (isPlaying) { audio.pause(); } else { audio.play(); }
      return;
    }

    setIsLoadingAudio(true);
    setActiveTrackId(trackId);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);

    try {
      const res = await fetch(
        `/api/staff/events/${encodeURIComponent(eventId)}/audio-downloads/${encodeURIComponent(trackId)}?stream=1`
      );
      if (!res.ok) throw new Error('Failed to fetch audio URL');
      const data = await res.json();
      audio.src = data.url;
      audio.load();
      await audio.play();
    } catch (err) {
      console.error('Error playing audio:', err);
      setActiveTrackId(null);
      setIsPlaying(false);
    } finally {
      setIsLoadingAudio(false);
    }
  }, [activeTrackId, isPlaying, eventId]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  }, []);

  if (loading || tracks.length === 0) return null;

  const handleDownloadTrack = (fileId: string) => {
    window.open(`/api/staff/events/${encodeURIComponent(eventId)}/audio-downloads/${encodeURIComponent(fileId)}`, '_blank');
  };

  const handleDownloadZip = () => {
    setZipDownloading(true);
    const zipWindow = window.open(`/api/staff/events/${encodeURIComponent(eventId)}/audio-downloads/zip`, '_blank');
    setTimeout(() => setZipDownloading(false), 5000);
    if (!zipWindow) setZipDownloading(false);
  };

  return (
    <div className="mb-8 bg-white rounded-xl border border-[#94B8B3] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#94B8B3]/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#5a8a82]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Audio Tracks</h2>
            <p className="text-sm text-gray-500">{tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} available</p>
          </div>
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={zipDownloading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#5a8a82] text-white rounded-lg hover:bg-[#4a7a72] transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          {zipDownloading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Preparing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download All (.zip)
            </>
          )}
        </button>
      </div>

      {/* Track list */}
      <div className="divide-y divide-gray-100">
        {tracks.map((track) => (
          <div key={track.fileId}>
            <div className="flex items-center justify-between py-3 first:pt-0">
              <div className="flex items-center gap-3 min-w-0">
                {/* Play/Pause */}
                <button
                  onClick={() => handlePlayPause(track.fileId)}
                  disabled={isLoadingAudio && activeTrackId === track.fileId}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-[#94B8B3]/20 hover:bg-[#94B8B3]/40 transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  {isLoadingAudio && activeTrackId === track.fileId ? (
                    <svg className="w-4 h-4 text-[#5a8a82] animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : activeTrackId === track.fileId && isPlaying ? (
                    <svg className="w-4 h-4 text-[#5a8a82]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 text-[#5a8a82] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">{track.className}</span>
                    {track.isSchulsong && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 flex-shrink-0">
                        Schulsong
                      </span>
                    )}
                    {track.classType === 'choir' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700 flex-shrink-0">
                        Chor
                      </span>
                    )}
                    {track.classType === 'teacher_song' && !track.isSchulsong && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 flex-shrink-0">
                        Lehrerlied
                      </span>
                    )}
                  </div>
                  {track.songTitle && (
                    <p className="text-xs text-gray-500 truncate">{track.songTitle}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                {track.fileSizeBytes != null && (
                  <span className="text-xs text-gray-400">{formatFileSize(track.fileSizeBytes)}</span>
                )}
                <button
                  onClick={() => handleDownloadTrack(track.fileId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#5a8a82] bg-[#94B8B3]/10 rounded-lg hover:bg-[#94B8B3]/20 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
              </div>
            </div>

            {/* Seek bar */}
            {activeTrackId === track.fileId && (
              <div className="flex items-center gap-3 pb-3 pl-11">
                <span className="text-xs text-gray-500 w-10 text-right tabular-nums">{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#5a8a82] [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#5a8a82] [&::-webkit-slider-thumb]:appearance-none"
                />
                <span className="text-xs text-gray-500 w-10 tabular-nums">{formatTime(duration)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

Note: Uses the staff portal's existing `#5a8a82` / `#94B8B3` color scheme instead of the teacher portal's green.

**Step 2: Verify TypeScript compiles**

**Step 3: Commit**

```bash
git add src/components/staff/StaffAudioSection.tsx
git commit -m "feat: add StaffAudioSection component with streaming and download"
```

---

### Task 7: Wire StaffAudioSection into the event detail page

**Files:**
- Modify: `src/app/staff/events/[eventId]/page.tsx`

**Step 1: Import and render StaffAudioSection**

Add import at the top:
```typescript
import StaffAudioSection from '@/components/staff/StaffAudioSection';
```

Add the component between the last collection section and the LogicProjectUploadSection:
```tsx
{/* Audio Tracks Section */}
<StaffAudioSection eventId={event.eventId} />

{/* Logic Pro Project Upload Section */}
<LogicProjectUploadSection eventId={event.eventId} />
```

**Step 2: Verify TypeScript compiles**

**Step 3: Commit**

```bash
git add src/app/staff/events/\[eventId\]/page.tsx
git commit -m "feat: wire StaffAudioSection into staff event detail page"
```

---

### Task 8: Verify and clean up

**Step 1: Search for any remaining issues**

- Verify no TypeScript errors: `npx tsc --noEmit 2>&1 | grep -i "error" | grep -v "test"`
- Verify no dead imports in changed files
- Check that `event.groups` is properly typed and doesn't cause runtime issues if undefined (fallback to `[]`)

**Step 2: Final commit if any cleanup needed**

```bash
git commit -m "chore: clean up staff event detail enrichment"
```
