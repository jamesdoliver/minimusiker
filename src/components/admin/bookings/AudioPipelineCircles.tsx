'use client';

import { useState } from 'react';

type MinimusikertagStage = 'not_started' | 'staff_uploaded' | 'finals_submitted';
type SchulsongStage = 'none' | 'pending' | 'rejected' | 'approved' | 'released';

interface AudioPipelineCirclesProps {
  isMinimusikertag?: boolean;
  isSchulsong?: boolean;
  minimusikertagStage?: MinimusikertagStage;
  schulsongStage?: SchulsongStage;
  eventDate?: string;
  size?: 'sm' | 'md' | 'lg';
}

interface CircleConfig {
  letter: string;
  color: string;
  label: string;
}

const sizeClasses = {
  sm: 'w-5 h-5 text-[10px]',
  md: 'w-6 h-6 text-xs',
  lg: 'w-7 h-7 text-sm',
};

// Tailwind palette aligned with StatusCircle.tsx
const GRAY = '#d1d5db'; // gray-300
const AMBER = '#f59e0b'; // amber-500
const GREEN = '#22c55e'; // green-500
const RED = '#ef4444'; // red-500

function minimusikertagCircle(stage: MinimusikertagStage, isFuture: boolean): CircleConfig {
  if (isFuture) {
    return { letter: 'M', color: GRAY, label: 'Minimusikertag – event not yet held' };
  }
  if (stage === 'finals_submitted') {
    return { letter: 'M', color: GREEN, label: 'Minimusikertag – finals submitted' };
  }
  if (stage === 'staff_uploaded') {
    return { letter: 'M', color: AMBER, label: 'Minimusikertag – staff uploaded, awaiting finals' };
  }
  return { letter: 'M', color: GRAY, label: 'Minimusikertag – no audio uploaded yet' };
}

function schulsongCircle(stage: SchulsongStage): CircleConfig {
  if (stage === 'released' || stage === 'approved') {
    return {
      letter: 'S',
      color: GREEN,
      label: stage === 'released'
        ? 'Schulsong – approved & released'
        : 'Schulsong – approved by teacher',
    };
  }
  if (stage === 'rejected') {
    return { letter: 'S', color: RED, label: 'Schulsong – rejected by teacher' };
  }
  if (stage === 'pending') {
    return { letter: 'S', color: AMBER, label: 'Schulsong – uploaded, waiting for teacher' };
  }
  return { letter: 'S', color: GRAY, label: 'Schulsong – not uploaded yet' };
}

export default function AudioPipelineCircles({
  isMinimusikertag,
  isSchulsong,
  minimusikertagStage,
  schulsongStage,
  eventDate,
  size = 'md',
}: AudioPipelineCirclesProps) {
  const [hovered, setHovered] = useState<number | null>(null);

  let isFuture = false;
  if (eventDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDay = new Date(eventDate + 'T00:00:00');
    eventDay.setHours(0, 0, 0, 0);
    isFuture = eventDay > today;
  }

  const circles: CircleConfig[] = [];
  if (isMinimusikertag) {
    circles.push(minimusikertagCircle(minimusikertagStage || 'not_started', isFuture));
  }
  if (isSchulsong) {
    circles.push(schulsongCircle(schulsongStage || 'none'));
  }

  if (circles.length === 0) {
    return <span className="text-gray-300" aria-label="No audio tracks for this event">—</span>;
  }

  return (
    <div className="flex items-center justify-center gap-1">
      {circles.map((circle, index) => (
        <div key={`${circle.letter}-${index}`} className="relative">
          <div
            className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold text-white cursor-help transition-transform hover:scale-110`}
            style={{ backgroundColor: circle.color }}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
            role="img"
            aria-label={circle.label}
          >
            {circle.letter}
          </div>

          {hovered === index && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-gray-700 bg-white rounded shadow-lg border border-gray-200 whitespace-nowrap z-10">
              {circle.label}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
