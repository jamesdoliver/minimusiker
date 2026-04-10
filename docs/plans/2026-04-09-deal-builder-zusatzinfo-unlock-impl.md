# Deal Builder: Unlock Zusatzinfo + Event Page Layout + Notes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unlock Zusatzinformationen checkboxes in Deal Builder, restructure event detail page layout (Event Config full-width, Deal Builder + Notes side-by-side), and replace debounced notes auto-save with explicit Save Notes button in both locations.

**Architecture:** DealBuilder becomes self-contained (no event-level props for info fields). Event detail page adds admin notes state + save handler, loaded from GET API response. Bookings overview notes switch from debounced auto-save to button-triggered save.

**Tech Stack:** React, Next.js, Tailwind CSS, Airtable (existing API)

---

### Task 1: Unlock Zusatzinformationen in DealBuilder

**Files:**
- Modify: `src/components/admin/DealBuilder.tsx`

**Step 1: Update the DealBuilderProps interface (line 7-15)**

Remove the four event-level props. The interface becomes:

```tsx
interface DealBuilderProps {
  dealConfig: DealConfig;
  onSave: (config: DealConfig) => void;
  isUpdating?: boolean;
}
```

**Step 2: Update the component signature (line 213-221)**

Remove destructured props `isPlus`, `scsShirtsIncluded`, `minicardOrderEnabled`, `minicardOrderQuantity`:

```tsx
export default function DealBuilder({
  dealConfig,
  onSave,
  isUpdating,
}: DealBuilderProps) {
```

**Step 3: Initialize local state from dealConfig (inside useState initializer, ~line 222)**

After the existing `migratePresets` and `pauschale` logic, ensure the info fields are seeded:

```tsx
const [localConfig, setLocalConfig] = useState<DealConfig>(() => {
  const migrated = migratePresets(dealConfig);
  const cfg = migrated ? { ...dealConfig, presets: migrated } : dealConfig;
  // Ensure pauschale is always enabled for new configs
  if (!cfg.presets?.pauschale) {
    return {
      ...cfg,
      presets: {
        ...cfg.presets,
        pauschale: { enabled: true, amount: 0 },
      },
    };
  }
  return cfg;
});
```

No change needed here — `localConfig` already includes `info_*` fields from `dealConfig`.

**Step 4: Unlock all four Zusatzinformationen checkboxes (lines 332-401)**

Replace the entire Zusatzinformationen section with editable checkboxes that read/write `localConfig.info_*`:

```tsx
{/* ── Zusatzinformationen (editable, stored in deal_config) */}
<div className="space-y-2">
  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Zusatzinformationen</h4>
  <div className="space-y-2">
    {/* T-Shirts inkl. */}
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={localConfig.info_tshirts_included || false}
        onChange={(e) => updateConfig({ info_tshirts_included: e.target.checked })}
        disabled={isUpdating}
        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
      />
      <span className={`text-sm flex-1 ${localConfig.info_tshirts_included ? 'text-gray-800' : 'text-gray-500'}`}>T-Shirts inkl.</span>
      <span className="text-xs text-gray-400">Anzahl</span>
      <input
        type="number"
        min="0"
        value={localConfig.info_tshirts_quantity ?? 0}
        onChange={(e) => {
          updateConfig({ info_tshirts_quantity: parseInt(e.target.value) || 0 });
        }}
        disabled={isUpdating}
        className="w-16 text-sm px-2 py-1 rounded border border-gray-200 bg-white text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-400"
      />
    </div>

    {/* Minicards inkl. */}
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={localConfig.info_minicards_included || false}
        onChange={(e) => updateConfig({ info_minicards_included: e.target.checked })}
        disabled={isUpdating}
        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
      />
      <span className={`text-sm flex-1 ${localConfig.info_minicards_included ? 'text-gray-800' : 'text-gray-500'}`}>Minicards inkl.</span>
      <span className="text-xs text-gray-400">Anzahl</span>
      <input
        type="number"
        min="0"
        value={localConfig.info_minicards_quantity ?? 0}
        onChange={(e) => {
          updateConfig({ info_minicards_quantity: parseInt(e.target.value) || 0 });
        }}
        disabled={isUpdating}
        className="w-16 text-sm px-2 py-1 rounded border border-gray-200 bg-white text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-emerald-400"
      />
    </div>

    {/* Start-Chancen-Schule */}
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={localConfig.info_scs || false}
        onChange={(e) => updateConfig({ info_scs: e.target.checked })}
        disabled={isUpdating}
        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
      />
      <span className={`text-sm ${localConfig.info_scs ? 'text-gray-800' : 'text-gray-500'}`}>Start-Chancen-Schule</span>
    </div>

    {/* Plus-Preise */}
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={localConfig.info_plus || false}
        onChange={(e) => updateConfig({ info_plus: e.target.checked })}
        disabled={isUpdating}
        className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
      />
      <span className={`text-sm ${localConfig.info_plus ? 'text-gray-800' : 'text-gray-500'}`}>Plus-Preise</span>
    </div>
  </div>
</div>
```

**Step 5: Update handleSave to read from localConfig (lines 268-298)**

Replace the info snapshot lines that read from props:

```tsx
function handleSave() {
  const breakdownItems: { label: string; amount: number }[] = [];

  for (const def of PRESET_DEFS) {
    const preset = localConfig.presets?.[def.key];
    if (preset?.enabled) {
      breakdownItems.push({ label: def.label, amount: preset.amount });
    }
  }

  for (const fee of localConfig.additional_fees || []) {
    if (fee.title && fee.amount !== 0) {
      breakdownItems.push({ label: fee.title, amount: fee.amount });
    }
  }

  const configToSave: DealConfig = {
    ...localConfig,
    calculated_fee: total,
    fee_breakdown: { base: 0, items: breakdownItems, total },
  };
  onSave(configToSave);
  setIsDirty(false);
}
```

The key change: remove the explicit `info_*` overwrites from props (lines 289-295). Since `localConfig` already contains all `info_*` fields, the spread `...localConfig` includes them automatically.

**Step 6: Verify build**

Run: `npx next build 2>&1 | head -30` (or `npx tsc --noEmit`)
Expected: No type errors from removed props

---

### Task 2: Add admin_notes to GET event API response

**Files:**
- Modify: `src/app/api/admin/events/[eventId]/route.ts:112-130`

**Step 1: Add `adminNotes` to the eventStatusAndType object**

At line ~112, add the field to the type:

```tsx
let eventStatusAndType: {
  // ... existing fields ...
  tracklistFinalizedAt?: string;
  adminNotes?: string;  // ADD THIS
} = {};
```

At line ~170, add the mapping inside the `if (eventRecord)` block:

```tsx
tracklistFinalizedAt: eventRecord.tracklist_finalized_at,
adminNotes: eventRecord.admin_notes,  // ADD THIS
```

This ensures the GET response includes `adminNotes` when the event has notes.

---

### Task 3: Add Admin Notes state + save handler to Event Detail Page

**Files:**
- Modify: `src/app/admin/events/[eventId]/page.tsx`

**Step 1: Add notes state (after line 182, after deal builder state)**

```tsx
// Admin notes state
const [adminNotes, setAdminNotes] = useState('');
const [savedNotes, setSavedNotes] = useState('');
const [isNoteDirty, setIsNoteDirty] = useState(false);
const [isSavingNotes, setIsSavingNotes] = useState(false);
```

**Step 2: Initialize from API response (after line 243, in fetchEventDetail)**

After the `setMinicardOrderQuantity` line:

```tsx
// Admin notes
setAdminNotes(data.data?.adminNotes || '');
setSavedNotes(data.data?.adminNotes || '');
```

**Step 3: Add notes change handler and save handler (after handleDealSave, ~line 480)**

```tsx
// Admin notes handlers
const handleNotesChange = (value: string) => {
  setAdminNotes(value);
  setIsNoteDirty(value !== savedNotes);
};

const handleNotesSave = async () => {
  setIsSavingNotes(true);
  try {
    const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_notes: adminNotes }),
    });
    if (!res.ok) throw new Error('Failed to save notes');
    setSavedNotes(adminNotes);
    setIsNoteDirty(false);
    toast.success('Notes saved');
  } catch {
    toast.error('Failed to save notes');
  } finally {
    setIsSavingNotes(false);
  }
};
```

---

### Task 4: Restructure Event Detail Page Layout

**Files:**
- Modify: `src/app/admin/events/[eventId]/page.tsx:1039-1306`

**Step 1: Replace the 5-column grid with new layout**

The current structure (lines 1039-1306):
```
<div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
  <div className="lg:col-span-3 ...">  {/* Event Config */}
  <div className="lg:col-span-2 ...">  {/* Deal Builder */}
</div>
```

Replace with:
```
{/* Event Configuration — full width */}
<div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
  {/* ... entire Event Config contents unchanged ... */}
</div>

{/* Deal Builder + Admin Notes — side by side */}
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
  {/* Deal Builder */}
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <DealBuilder
      dealConfig={dealConfig}
      onSave={handleDealSave}
      isUpdating={isUpdatingDeal}
    />
  </div>

  {/* Admin Notes */}
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col">
    <div className="pb-3 border-b border-gray-100 mb-4">
      <span className="text-lg font-semibold text-gray-900">Notes</span>
    </div>
    <textarea
      value={adminNotes}
      onChange={(e) => handleNotesChange(e.target.value)}
      className="w-full text-sm text-gray-900 border border-gray-300 rounded-md px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-h-[200px] flex-1"
      placeholder="Add notes about this booking..."
    />
    <button
      type="button"
      onClick={handleNotesSave}
      disabled={isSavingNotes || !isNoteDirty}
      className={`mt-3 w-full py-2 px-4 rounded-md text-sm font-medium transition-colors ${
        isNoteDirty && !isSavingNotes
          ? 'bg-blue-600 text-white hover:bg-blue-700'
          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
      }`}
    >
      {isSavingNotes ? 'Saving...' : 'Save Notes'}
    </button>
  </div>
</div>
```

Note: Remove the old props from `<DealBuilder>` — no more `isPlus`, `scsShirtsIncluded`, `minicardOrderEnabled`, `minicardOrderQuantity`.

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: Clean compile

---

### Task 5: Replace debounced auto-save with Save Notes button in BookingDetailsBreakdown

**Files:**
- Modify: `src/components/admin/bookings/BookingDetailsBreakdown.tsx`

**Step 1: Replace notes state (lines 60-63)**

Remove `notesTimerRef`. Add dirty tracking:

```tsx
// Admin notes state
const [notesText, setNotesText] = useState(booking.adminNotes || '');
const [savedNotesText, setSavedNotesText] = useState(booking.adminNotes || '');
const [notesSaveStatus, setNotesSaveStatus] = useState<'idle' | 'saving'>('idle');
const isNotesDirty = notesText !== savedNotesText;
```

**Step 2: Update sync effect (lines 65-68)**

```tsx
useEffect(() => {
  setNotesText(booking.adminNotes || '');
  setSavedNotesText(booking.adminNotes || '');
}, [booking.adminNotes]);
```

**Step 3: Replace handleNotesChange with simple setter + explicit save (lines 70-98)**

Remove the entire `handleNotesChange` callback. Replace with:

```tsx
const handleNotesSave = useCallback(async () => {
  setNotesSaveStatus('saving');
  try {
    const res = await fetch(`/api/admin/events/${encodeURIComponent(booking.code)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ admin_notes: notesText }),
    });
    if (res.ok) {
      setSavedNotesText(notesText);
      setNotesSaveStatus('idle');
      onNotesUpdate?.(booking.id, notesText);
    } else {
      setNotesSaveStatus('idle');
      toast.error('Failed to save notes');
    }
  } catch {
    setNotesSaveStatus('idle');
    toast.error('Failed to save notes');
  }
}, [booking.code, booking.id, notesText, onNotesUpdate]);
```

**Step 4: Remove debounce cleanup effect (lines 100-107)**

Delete the entire `useEffect` that clears `notesTimerRef`.

**Step 5: Update the Notes UI (lines 564-578)**

Replace with textarea + save button:

```tsx
{/* Notes */}
<h4 className="text-sm font-semibold text-gray-700 mb-3">Notes</h4>
<div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col flex-1">
  <textarea
    value={notesText}
    onChange={(e) => setNotesText(e.target.value)}
    className="w-full text-sm text-gray-900 border border-gray-300 rounded-md px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-h-[140px] flex-1"
    placeholder="Add notes about this booking..."
  />
  <button
    type="button"
    onClick={handleNotesSave}
    disabled={notesSaveStatus === 'saving' || !isNotesDirty}
    className={`mt-2 w-full py-1.5 px-3 rounded-md text-xs font-medium transition-colors ${
      isNotesDirty && notesSaveStatus !== 'saving'
        ? 'bg-blue-600 text-white hover:bg-blue-700'
        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
    }`}
  >
    {notesSaveStatus === 'saving' ? 'Saving...' : 'Save Notes'}
  </button>
</div>
```

**Step 6: Remove unused imports**

Remove `useRef` from the React import if no longer used elsewhere in the file.

**Step 7: Verify build**

Run: `npx tsc --noEmit`
Expected: Clean compile

---

### Task 6: Final verification

**Step 1: Build check**

Run: `npm run build`
Expected: Clean build, no errors

**Step 2: Commit**

```bash
git add src/components/admin/DealBuilder.tsx \
       src/app/api/admin/events/[eventId]/route.ts \
       src/app/admin/events/[eventId]/page.tsx \
       src/components/admin/bookings/BookingDetailsBreakdown.tsx
git commit -m "feat: unlock deal builder zusatzinfo, restructure event layout, add save notes button"
```
