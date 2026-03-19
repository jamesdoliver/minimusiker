'use client';

import { AudioStage, AudioStatusSummary } from '@/lib/types/audio-status';

const stageConfig: Record<AudioStage, { label: string; tooltip: string; className: string; dotColor: string; textColor: string }> = {
  none: {
    label: 'Kein Audio',
    tooltip: 'Noch keine Aufnahmen hochgeladen',
    className: 'bg-gray-200 text-gray-600 border-gray-300',
    dotColor: 'bg-gray-300',
    textColor: 'text-gray-500',
  },
  staff_uploaded: {
    label: 'Staff Uploaded',
    tooltip: 'Roh-Aufnahmen vom Team hochgeladen',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-400',
    textColor: 'text-amber-700',
  },
  raw: {
    label: 'Roh',
    tooltip: 'Roh-Aufnahmen vorhanden',
    className: 'bg-amber-100 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-400',
    textColor: 'text-amber-700',
  },
  preview: {
    label: 'Vorschau',
    tooltip: 'Vorschau-Versionen verfügbar',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
    dotColor: 'bg-blue-500',
    textColor: 'text-blue-700',
  },
  final: {
    label: 'Final',
    tooltip: 'Finale Mischungen eingereicht',
    className: 'bg-green-100 text-green-700 border-green-200',
    dotColor: 'bg-green-500',
    textColor: 'text-green-700',
  },
  approved: {
    label: 'Freigegeben',
    tooltip: 'Alle Tracks geprüft und freigegeben',
    className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dotColor: 'bg-emerald-500',
    textColor: 'text-emerald-800',
  },
};

type BadgeVariant = 'badge' | 'dot' | 'compact' | 'summary';

interface AudioStatusBadgeProps {
  variant: BadgeVariant;
  stage: AudioStage;
  summary?: AudioStatusSummary;
  audioHidden?: boolean;
}

export default function AudioStatusBadge({ variant, stage, summary, audioHidden }: AudioStatusBadgeProps) {
  const config = stageConfig[stage];
  const muted = audioHidden ?? summary?.audioHidden;

  if (variant === 'badge') {
    return (
      <span
        title={config.tooltip}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${config.className} ${muted ? 'opacity-50 line-through' : ''}`}
      >
        {stage === 'approved' && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {config.label}
      </span>
    );
  }

  if (variant === 'dot') {
    return (
      <div title={config.tooltip} className={`flex items-center gap-1.5 text-xs ${muted ? 'opacity-50' : ''}`}>
        <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
        <span className={config.textColor}>{config.label}</span>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <span title={config.tooltip} className={`text-sm font-medium ${config.textColor} ${muted ? 'opacity-50 line-through' : ''}`}>
        {stage === 'approved' && '✓ '}
        {config.label}
      </span>
    );
  }

  // variant === 'summary'
  const counts = summary?.counts;
  return (
    <div className={`flex items-center gap-3 ${muted ? 'opacity-50' : ''}`}>
      <span
        title={config.tooltip}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${config.className}`}
      >
        {stage === 'approved' && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        )}
        {config.label}
      </span>
      {counts && counts.total > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {counts.final}/{counts.total} Final
          </span>
          <div className="flex h-1.5 w-16 rounded-full overflow-hidden bg-gray-200">
            {counts.approved > 0 && (
              <div
                className="bg-emerald-500"
                style={{ width: `${(counts.approved / counts.total) * 100}%` }}
              />
            )}
            {counts.final - counts.approved > 0 && (
              <div
                className="bg-green-400"
                style={{ width: `${((counts.final - counts.approved) / counts.total) * 100}%` }}
              />
            )}
            {counts.preview - counts.final > 0 && (
              <div
                className="bg-blue-400"
                style={{ width: `${(Math.max(0, counts.preview - counts.final) / counts.total) * 100}%` }}
              />
            )}
            {counts.raw - Math.max(counts.preview, counts.final) > 0 && (
              <div
                className="bg-amber-400"
                style={{ width: `${(Math.max(0, counts.raw - Math.max(counts.preview, counts.final)) / counts.total) * 100}%` }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
