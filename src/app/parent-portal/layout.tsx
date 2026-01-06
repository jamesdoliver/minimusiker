import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function ParentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch messages on the server
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
