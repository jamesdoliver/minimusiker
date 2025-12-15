import { notFound } from 'next/navigation';
import airtableService from '@/lib/services/airtableService';
import HeroSection from '@/components/landing/HeroSection';
import StudentCard from '@/components/landing/StudentCard';
import PreviewPlayer from '@/components/landing/PreviewPlayer';
import ProductGrid from '@/components/landing/ProductGrid';
import Footer from '@/components/shared/Footer';

interface ParentLandingPageProps {
  params: {
    accessToken: string;
  };
}

export default async function ParentLandingPage({ params }: ParentLandingPageProps) {
  const { accessToken } = params;

  // Fetch parent portal data
  let portalData;
  try {
    portalData = await airtableService.getParentPortalData(accessToken);
  } catch (error) {
    console.error('Error fetching portal data:', error);
    portalData = null;
  }

  if (!portalData) {
    notFound();
  }

  const { parent, students, event, school, products, orders } = portalData;

  // Calculate days until event
  const eventDate = new Date(event.event_date);
  const today = new Date();
  const daysUntilEvent = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50">
      {/* Hero Section with School Branding */}
      <HeroSection
        school={school}
        event={event}
        parent={parent}
        daysUntilEvent={daysUntilEvent}
      />

      {/* Student Information */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Children</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map((student) => (
            <StudentCard key={student.id} student={student} />
          ))}
        </div>
      </section>

      {/* Event Details & Preview */}
      <section className="bg-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Event Details</h2>
              <div className="prose prose-lg">
                <p className="text-gray-600">
                  Join us for an unforgettable musical experience featuring all the talented students
                  from {school.school_name}.
                </p>
                <dl className="mt-6 space-y-4">
                  <div>
                    <dt className="font-semibold text-gray-900">Date & Time</dt>
                    <dd className="mt-1 text-gray-600">
                      {new Date(event.event_date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-900">Location</dt>
                    <dd className="mt-1 text-gray-600">{school.address}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-gray-900">Event Type</dt>
                    <dd className="mt-1 text-gray-600 capitalize">{event.event_type}</dd>
                  </div>
                </dl>
              </div>
            </div>

            {/* Preview Player */}
            {event.preview_key && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Preview Recording</h2>
                <PreviewPlayer
                  eventId={event.event_id}
                  previewKey={event.preview_key}
                  isLocked={!orders?.some(o => o.products.some(p => p.product_id.includes('recording')))}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Products Section */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Merchandise & Recordings</h2>
          <p className="text-gray-600 mb-8">
            Capture the memories with our exclusive event merchandise and professional recordings.
          </p>
          <ProductGrid
            products={products}
            eventId={event.event_id}
            parentId={parent.parent_id}
            existingOrders={orders}
          />
        </div>
      </section>

      <Footer />
    </div>
  );
}

// Generate metadata for the page
export async function generateMetadata({ params }: ParentLandingPageProps) {
  try {
    const portalData = await airtableService.getParentPortalData(params.accessToken);

    if (!portalData) {
      return {
        title: 'Event Not Found - MiniMusiker',
      };
    }

    const { event, school, parent } = portalData;

    return {
      title: `${event.event_type} - ${school.school_name} | MiniMusiker`,
      description: `Welcome ${parent.first_name}! Access your personalized portal for the ${school.school_name} ${event.event_type}.`,
    };
  } catch (error) {
    return {
      title: 'MiniMusiker',
      description: 'School Music Event Platform',
    };
  }
}