'use client';

import { useState } from 'react';

interface EventTypeCirclesProps {
  isPlus?: boolean;
  isKita?: boolean;
  isSchulsong?: boolean;
  isMinimusikertag?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

interface CircleConfig {
  letter: string;
  bgColor: string;
  textColor: string;
  label: string;
}

const sizeClasses = {
  sm: 'w-5 h-5 text-[10px]',
  md: 'w-6 h-6 text-xs',
  lg: 'w-7 h-7 text-sm',
};

export default function EventTypeCircles({
  isPlus = false,
  isKita = false,
  isSchulsong = false,
  isMinimusikertag = true,
  size = 'md',
}: EventTypeCirclesProps) {
  const [hoveredCircle, setHoveredCircle] = useState<number | null>(null);

  // Build array of circles to display
  const circles: CircleConfig[] = [];

  // Circle 1: Only show M/+ circle when isMinimusikertag is true
  if (isMinimusikertag) {
    circles.push({
      letter: isPlus ? '+' : 'M',
      bgColor: '#93c5fd', // blue-300
      textColor: '#1e40af', // blue-800
      label: isPlus ? 'Minimusikertag PLUS' : 'Minimusikertag',
    });
  }

  // Circle 2: Shows 'K' if is_kita=true
  if (isKita) {
    circles.push({
      letter: 'K',
      bgColor: '#c4b5fd', // violet-300
      textColor: '#5b21b6', // violet-800
      label: 'Kita',
    });
  }

  // Circle 3: Shows 'S' if is_schulsong=true
  if (isSchulsong) {
    circles.push({
      letter: 'S',
      bgColor: '#fdba74', // orange-300
      textColor: '#9a3412', // orange-800
      label: 'Schulsong',
    });
  }

  return (
    <div className="flex items-center gap-1">
      {circles.map((circle, index) => (
        <div key={index} className="relative">
          <div
            className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold cursor-help transition-transform hover:scale-110`}
            style={{
              backgroundColor: circle.bgColor,
              color: circle.textColor,
            }}
            onMouseEnter={() => setHoveredCircle(index)}
            onMouseLeave={() => setHoveredCircle(null)}
            role="img"
            aria-label={circle.label}
          >
            {circle.letter}
          </div>

          {/* Tooltip */}
          {hoveredCircle === index && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium text-gray-700 bg-white rounded shadow-lg border border-gray-200 whitespace-nowrap z-10">
              {circle.label}
              {/* Arrow */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
