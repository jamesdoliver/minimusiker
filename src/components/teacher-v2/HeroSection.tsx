'use client';

import { SchoolInfoCard } from './SchoolInfoCard';

interface HeroSectionProps {
  firstName: string;
  schoolInfo: {
    schoolName: string;
    address?: string;
    email: string;
    phone?: string;
  };
  onEditInfo: () => void;
}

export function HeroSection({ firstName, schoolInfo, onEditInfo }: HeroSectionProps) {
  return (
    <section className="bg-mm-accent text-white py-12 md:py-16 relative overflow-hidden">
      {/* Decorative dots pattern - top right */}
      <div className="absolute top-8 right-8 opacity-20 hidden md:block">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="55" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="60" cy="60" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
          <circle cx="60" cy="60" r="25" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
        </svg>
      </div>

      <div className="max-w-[1100px] mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left: Welcome text */}
          <div>
            <h1 className="font-playfair italic text-3xl md:text-4xl mb-4">
              Willkommen, {firstName}
            </h1>
            <p className="text-white/80 text-base leading-relaxed">
              Hier verwaltest du eure Projekte mit den Minimusikern. Bearbeite
              Termine und Daten oder übermittle Gruppen/Klassen und ihre Lieder
              an uns.
            </p>
          </div>

          {/* Right: School Info Card */}
          <div className="md:justify-self-end">
            <SchoolInfoCard
              schoolName={schoolInfo.schoolName}
              address={schoolInfo.address}
              email={schoolInfo.email}
              phone={schoolInfo.phone}
              onEdit={onEditInfo}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
