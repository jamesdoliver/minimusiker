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

  return {
    title: `${event.school_name} | MiniMusiker`,
    description: `Register for the MiniMusiker event at ${event.school_name}`,
  };
}
