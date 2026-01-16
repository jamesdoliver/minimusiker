'use client';

import { usePathname } from 'next/navigation';
import Footer from './Footer';

export default function FooterWrapper() {
  const pathname = usePathname();

  // Don't show footer on admin pages
  if (pathname?.startsWith('/admin')) {
    return null;
  }

  return <Footer />;
}
