import { School, Event, Parent } from '@/types/airtable';

interface HeroSectionProps {
  school: School;
  event: Event;
  parent: Parent;
  daysUntilEvent: number;
}

export default function HeroSection({ school, event, parent, daysUntilEvent }: HeroSectionProps) {
  const eventDate = new Date(event.event_date);

  // Use school branding color if available, default to sage gradient
  const brandingStyle = school.branding_color
    ? { backgroundColor: school.branding_color }
    : { background: 'linear-gradient(135deg, #94B8B3 0%, #7A9E99 100%)' };

  return (
    <section className="relative overflow-hidden" style={brandingStyle}>
      <div className="absolute inset-0 bg-black opacity-5"></div>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center text-sage-900">
          {school.logo_url && (
            <img
              src={school.logo_url}
              alt={`${school.school_name} logo`}
              className="h-24 w-auto mx-auto mb-6 bg-white rounded-lg p-2"
            />
          )}

          <h1 className="text-4xl md:text-6xl font-bold mb-4">
            Welcome, {parent.first_name}!
          </h1>

          <p className="text-xl md:text-2xl mb-8 opacity-95">
            {school.school_name} {event.event_type}
          </p>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 mt-12">
            <div className="bg-white bg-opacity-90 shadow-lg rounded-lg px-6 py-4 text-sage-900">
              <p className="text-sm uppercase tracking-wide opacity-90 mb-1">Event Date</p>
              <p className="text-2xl font-bold">
                {eventDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>

            {daysUntilEvent > 0 && (
              <div className="bg-white bg-opacity-90 shadow-lg rounded-lg px-6 py-4 text-sage-900">
                <p className="text-sm uppercase tracking-wide opacity-90 mb-1">Days Until Event</p>
                <p className="text-3xl font-bold">{daysUntilEvent}</p>
              </div>
            )}

            {daysUntilEvent <= 0 && (
              <div className="bg-white bg-opacity-90 shadow-lg rounded-lg px-6 py-4 text-sage-900">
                <p className="text-lg font-semibold">Event Complete!</p>
                <p className="text-sm opacity-90">Recordings Available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Decorative wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          className="w-full h-12 text-cream-200"
          preserveAspectRatio="none"
          viewBox="0 0 1440 48"
          fill="currentColor"
        >
          <path d="M0,48L60,42.7C120,37,240,27,360,24C480,21,600,27,720,29.3C840,32,960,32,1080,29.3C1200,27,1320,21,1380,18.7L1440,16L1440,48L1380,48C1320,48,1200,48,1080,48C960,48,840,48,720,48C600,48,480,48,360,48C240,48,120,48,60,48L0,48Z" />
        </svg>
      </div>
    </section>
  );
}