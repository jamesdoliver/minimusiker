'use client';

import type { LeadStage } from '@/lib/types/airtable';

const stageStyles: Record<LeadStage, string> = {
  'New': 'bg-blue-100 text-blue-800',
  'Contacted': 'bg-yellow-100 text-yellow-800',
  'In Discussion': 'bg-orange-100 text-orange-800',
  'Won': 'bg-green-100 text-green-800',
  'Lost': 'bg-gray-100 text-gray-500',
};

export default function LeadStageBadge({ stage }: { stage: LeadStage }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stageStyles[stage] || 'bg-gray-100 text-gray-500'}`}>
      {stage}
    </span>
  );
}
