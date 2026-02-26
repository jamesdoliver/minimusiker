/**
 * Short URL Route
 *
 * Handles short URLs like minimusiker.app/e/1562
 * Looks up the event by access_code and redirects to registration
 */

import { redirect, notFound } from 'next/navigation';
import { getAirtableService } from '@/lib/services/airtableService';

interface PageProps {
  params: Promise<{ code: string }>;
}

export default async function ShortUrlPage({ params }: PageProps) {
  const { code } = await params;

  // Parse the code as a number
  const accessCode = parseInt(code, 10);

  // Validate that it's a valid number
  if (isNaN(accessCode) || accessCode <= 0) {
    notFound();
  }

  // Look up the event by access_code
  const airtableService = getAirtableService();
  const event = await airtableService.getEventByAccessCode(accessCode);

  if (!event) {
    notFound();
  }

  // Block cancelled/deleted events
  const blockedStatuses = ['Cancelled', 'Deleted'];
  if (event.status && blockedStatuses.includes(event.status)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="mb-4">
            <svg
              className="mx-auto h-12 w-12 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Dieses Event ist leider nicht mehr verfügbar.
          </h2>
          <p className="text-gray-600 mb-4">
            This event is no longer available.
          </p>
          <p className="text-sm text-gray-500">
            Bitte kontaktiere deine Schule. / Please contact your school.
          </p>
        </div>
      </div>
    );
  }

  // Redirect to registration page with event pre-selected
  // The event_id is used as the eventId parameter
  const registrationUrl = `/register?event=${encodeURIComponent(event.event_id)}&school=${encodeURIComponent(event.school_name)}`;

  redirect(registrationUrl);
}

// Generate metadata for the page
export async function generateMetadata({ params }: PageProps) {
  const { code } = await params;
  const accessCode = parseInt(code, 10);

  if (isNaN(accessCode) || accessCode <= 0) {
    return { title: 'Event Not Found | MiniMusiker' };
  }

  const airtableService = getAirtableService();
  const event = await airtableService.getEventByAccessCode(accessCode);

  if (!event) {
    return { title: 'Event Not Found | MiniMusiker' };
  }

  const blockedStatuses = ['Cancelled', 'Deleted'];
  if (event.status && blockedStatuses.includes(event.status)) {
    return { title: 'Event Not Available | MiniMusiker' };
  }

  return {
    title: `${event.school_name} | MiniMusiker`,
    description: `Register for the MiniMusiker event at ${event.school_name}`,
  };
}
