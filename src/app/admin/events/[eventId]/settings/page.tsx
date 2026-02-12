'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import {
  parseOverrides,
  getThreshold,
  getMilestoneOffset,
  GLOBAL_DEFAULTS,
  EventTimelineOverrides,
  ThresholdKey,
} from '@/lib/utils/eventThresholds';
import { EVENT_MILESTONES, Milestone, getMilestoneLabel } from '@/lib/utils/eventTimeline';
import { getAllTemplates } from '@/lib/config/taskTemplates';

// ─── Types ────────────────────────────────────────────────────────

interface ThresholdFieldConfig {
  key: ThresholdKey;
  label: string;
  description: string;
  suffix: string;
  /** If true, the stored value is negative but the UI shows positive */
  negateForDisplay: boolean;
}

// ─── Field Configurations ────────────────────────────────────────

const ORDER_DEADLINE_FIELDS: ThresholdFieldConfig[] = [
  {
    key: 'early_bird_deadline_days',
    label: 'Frühbucher-Frist',
    description: 'Bestellungen, die vor dieser Frist eingehen, erhalten 10% Frühbucher-Rabatt.',
    suffix: 'Tage vor Event',
    negateForDisplay: false,
  },
  {
    key: 'personalized_clothing_cutoff_days',
    label: 'Schulkleidung → Standard-Umstellung',
    description: 'Nach diesem Zeitpunkt wird im Elternportal-Shop personalisierte Schulkleidung ausgeblendet und stattdessen Standard-Minimusiker-Kleidung angezeigt.',
    suffix: 'Tage nach Event',
    negateForDisplay: true,
  },
  {
    key: 'schulsong_clothing_cutoff_days',
    label: 'Schulsong Kleidungsbestellung',
    description: 'Zeitfenster nach dem Event, in dem Eltern bei Schulsong-Events noch Kleidung bestellen können. Verlängertes Fenster, da es keine Audio-Produkte gibt.',
    suffix: 'Tage nach Event',
    negateForDisplay: true,
  },
  {
    key: 'merchandise_deadline_days',
    label: 'Merchandise-Frist (in E-Mails)',
    description: 'Das Datum, das den Eltern in E-Mails als letzte Bestellmöglichkeit angezeigt wird. Sollte mit der tatsächlichen Shop-Frist übereinstimmen.',
    suffix: 'Tage nach Event',
    negateForDisplay: false,
  },
];

const AUDIO_PORTAL_FIELDS: ThresholdFieldConfig[] = [
  {
    key: 'preview_available_days',
    label: 'Vorschau verfügbar',
    description: 'Ab diesem Zeitpunkt können Eltern kurze Audio-Vorschauen im Portal anhören.',
    suffix: 'Tage nach Event',
    negateForDisplay: false,
  },
  {
    key: 'full_release_days',
    label: 'Vollständige Freigabe',
    description: 'Ab diesem Zeitpunkt erhalten Minicard-Käufer Zugang zu den vollständigen Audio-Dateien und Downloads.',
    suffix: 'Tage nach Event',
    negateForDisplay: false,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────

function computeDate(eventDate: string, field: ThresholdFieldConfig, value: number): string {
  const date = new Date(eventDate);
  if (field.suffix === 'Tage vor Event') {
    date.setDate(date.getDate() - value);
  } else {
    date.setDate(date.getDate() + value);
  }
  return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
}

function displayValue(storedValue: number, negateForDisplay: boolean): number {
  return negateForDisplay ? Math.abs(storedValue) : storedValue;
}

function storageValue(displayVal: number, negateForDisplay: boolean): number {
  return negateForDisplay ? -Math.abs(displayVal) : displayVal;
}

// ─── Component ───────────────────────────────────────────────────

export default function EventSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [overrides, setOverrides] = useState<EventTimelineOverrides>({});
  const [savedOverrides, setSavedOverrides] = useState<EventTimelineOverrides>({});

  // Load event data
  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`);
        if (!response.ok) throw new Error('Failed to load event');

        const result = await response.json();
        const data = result.data;
        setEventName(data.schoolName || 'Event');
        setEventDate(data.eventDate || '');

        // Load existing overrides if any
        // The timeline_overrides is on the Event record, not the SchoolEventDetail
        // We need to fetch it from the Event record directly
        const eventRecordResponse = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/settings-data`);
        if (eventRecordResponse.ok) {
          const eventRecordResult = await eventRecordResponse.json();
          if (eventRecordResult.timeline_overrides) {
            const parsed = parseOverrides(eventRecordResult.timeline_overrides);
            if (parsed) {
              setOverrides(parsed);
              setSavedOverrides(parsed);
            }
          }
        }
      } catch (err) {
        console.error('Error loading event:', err);
        toast.error('Event konnte nicht geladen werden');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEvent();
  }, [eventId]);

  // Get current value for a threshold field
  const getValue = useCallback((field: ThresholdFieldConfig): number => {
    const stored = getThreshold(field.key, overrides);
    return displayValue(stored, field.negateForDisplay);
  }, [overrides]);

  // Get default value for a threshold field (for display)
  const getDefault = (field: ThresholdFieldConfig): number => {
    return displayValue(GLOBAL_DEFAULTS[field.key], field.negateForDisplay);
  };

  // Check if a field has any override set (even if it matches the default)
  const hasOverride = (field: ThresholdFieldConfig): boolean => {
    return overrides[field.key] !== undefined;
  };

  // Check if a field has been modified from its default
  const isModified = (field: ThresholdFieldConfig): boolean => {
    return overrides[field.key] !== undefined && overrides[field.key] !== GLOBAL_DEFAULTS[field.key];
  };

  // Update a threshold value
  const updateValue = (field: ThresholdFieldConfig, rawValue: string) => {
    // Allow clearing the input to remove the override
    if (rawValue === '') {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[field.key];
        return next;
      });
      return;
    }

    const numValue = parseInt(rawValue, 10);
    if (isNaN(numValue) || numValue < 0) return;

    const stored = storageValue(numValue, field.negateForDisplay);
    setOverrides((prev) => ({
      ...prev,
      [field.key]: stored,
    }));
  };

  // Reset a single field to default
  const resetField = (field: ThresholdFieldConfig) => {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[field.key];
      return next;
    });
  };

  // Reset all fields
  const resetAll = () => {
    setOverrides({});
  };

  // Save overrides
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Clean up overrides: remove keys that match global defaults
      const cleanOverrides: EventTimelineOverrides = {};
      for (const [key, value] of Object.entries(overrides)) {
        if (key in GLOBAL_DEFAULTS && value !== GLOBAL_DEFAULTS[key as ThresholdKey]) {
          (cleanOverrides as Record<string, unknown>)[key] = value;
        }
      }

      const hasOverrides = Object.keys(cleanOverrides).length > 0;
      const response = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timeline_overrides: hasOverrides ? JSON.stringify(cleanOverrides) : '',
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Save failed');
      }

      setSavedOverrides({ ...cleanOverrides });
      toast.success('Einstellungen gespeichert');
    } catch (err) {
      console.error('Error saving settings:', err);
      toast.error(err instanceof Error ? err.message : 'Speichern fehlgeschlagen');
    } finally {
      setIsSaving(false);
    }
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = JSON.stringify(overrides) !== JSON.stringify(savedOverrides);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <Link
            href={`/admin/events/${eventId}`}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Zurück zum Event
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Event-Einstellungen</h1>
          <p className="text-gray-600 mt-1">
            {eventName}
            {eventDate && (
              <span className="ml-2 text-gray-400">
                ({new Date(eventDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })})
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Section 1: Order Deadlines */}
        <SettingsSection title="Bestellfristen" description="Zeitfenster für Bestellungen und Frühbucher-Rabatte">
          {ORDER_DEADLINE_FIELDS.map((field) => (
            <ThresholdField
              key={field.key}
              field={field}
              value={getValue(field)}
              defaultValue={getDefault(field)}
              hasOverride={hasOverride(field)}
              isModified={isModified(field)}
              eventDate={eventDate}
              onChange={(val) => updateValue(field, val)}
              onReset={() => resetField(field)}
            />
          ))}
        </SettingsSection>

        {/* Section 2: Audio & Portal */}
        <SettingsSection title="Audio & Portal" description="Zeitpunkte für Vorschau-Freigabe und vollständigen Zugang">
          {AUDIO_PORTAL_FIELDS.map((field) => (
            <ThresholdField
              key={field.key}
              field={field}
              value={getValue(field)}
              defaultValue={getDefault(field)}
              hasOverride={hasOverride(field)}
              isModified={isModified(field)}
              eventDate={eventDate}
              onChange={(val) => updateValue(field, val)}
              onReset={() => resetField(field)}
            />
          ))}
        </SettingsSection>

        {/* Section 3: Task Timeline (Read-only, Phase 2) */}
        <SettingsSection title="Aufgaben-Zeitplan" description="Zeitliche Planung der Event-Aufgaben (Phase 2 - bald konfigurierbar)" locked>
          {getAllTemplates().map((template) => (
            <ReadOnlyField
              key={template.id}
              label={template.name}
              description={template.description}
              value={Math.abs(template.timeline_offset)}
              suffix={template.timeline_offset <= 0 ? 'Tage vor Event' : 'Tage nach Event'}
              eventDate={eventDate}
              offsetDays={template.timeline_offset}
            />
          ))}
        </SettingsSection>

        {/* Section 4: Milestones (Read-only, Phase 2) */}
        <SettingsSection title="Meilensteine" description="Event-Lifecycle-Meilensteine (Phase 2 - bald konfigurierbar)" locked>
          {(Object.keys(EVENT_MILESTONES) as Milestone[]).map((milestone) => (
            <ReadOnlyField
              key={milestone}
              label={getMilestoneLabel(milestone)}
              description={`Offset: ${EVENT_MILESTONES[milestone]} Tage`}
              value={Math.abs(getMilestoneOffset(milestone))}
              suffix={EVENT_MILESTONES[milestone] <= 0 ? 'Tage vor Event' : 'Tage nach Event'}
              eventDate={eventDate}
              offsetDays={EVENT_MILESTONES[milestone]}
            />
          ))}
        </SettingsSection>

        {/* Sticky Save Bar */}
        <div className="sticky bottom-0 bg-white border-t shadow-lg -mx-4 sm:-mx-6 px-4 sm:px-6 py-4">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <button
              onClick={resetAll}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Auf Standard zurücksetzen
            </button>
            <div className="flex items-center gap-3">
              {hasUnsavedChanges && (
                <span className="text-sm text-amber-600">Ungespeicherte Änderungen</span>
              )}
              <button
                onClick={handleSave}
                disabled={isSaving || !hasUnsavedChanges}
                className="px-6 py-2 bg-[#5a8a82] text-white rounded-lg hover:bg-[#4a7a72] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
              >
                {isSaving ? 'Speichert...' : 'Speichern'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────

function SettingsSection({
  title,
  description,
  locked,
  children,
}: {
  title: string;
  description: string;
  locked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border shadow-sm">
      <div className="px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          {locked && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-500 bg-gray-100 rounded-full">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Phase 2
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

function ThresholdField({
  field,
  value,
  defaultValue,
  hasOverride,
  isModified,
  eventDate,
  onChange,
  onReset,
}: {
  field: ThresholdFieldConfig;
  value: number;
  defaultValue: number;
  hasOverride: boolean;
  isModified: boolean;
  eventDate: string;
  onChange: (val: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <label className="font-medium text-gray-900 text-sm">{field.label}</label>
            {isModified && (
              <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" title="Vom Standard abweichend" />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="number"
            min={0}
            max={365}
            value={hasOverride ? value : ''}
            placeholder={String(defaultValue)}
            onChange={(e) => onChange(e.target.value)}
            className="w-20 px-3 py-1.5 text-sm border rounded-lg text-right focus:ring-2 focus:ring-[#5a8a82] focus:border-[#5a8a82] outline-none placeholder:text-gray-300"
          />
          <span className="text-xs text-gray-500 whitespace-nowrap w-28">{field.suffix}</span>
          {isModified && (
            <button
              onClick={onReset}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              title={`Zurücksetzen auf ${defaultValue}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {eventDate && (
        <p className="text-xs text-gray-400 mt-1">
          = {computeDate(eventDate, field, value)}
        </p>
      )}
    </div>
  );
}

function ReadOnlyField({
  label,
  description,
  value,
  suffix,
  eventDate,
  offsetDays,
}: {
  label: string;
  description: string;
  value: number;
  suffix: string;
  eventDate: string;
  offsetDays: number;
}) {
  const computedDate = eventDate ? (() => {
    const date = new Date(eventDate);
    date.setDate(date.getDate() + offsetDays);
    return date.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  })() : '';

  return (
    <div className="px-6 py-3 opacity-60">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <label className="font-medium text-gray-700 text-sm">{label}</label>
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-20 px-3 py-1.5 text-sm border rounded-lg text-right bg-gray-50 text-gray-500">
            {value}
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap w-28">{suffix}</span>
        </div>
      </div>
      {computedDate && (
        <p className="text-xs text-gray-400 mt-1">= {computedDate}</p>
      )}
    </div>
  );
}
