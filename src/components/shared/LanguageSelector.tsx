'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';

export default function LanguageSelector() {
  const router = useRouter();
  const [currentLocale, setCurrentLocale] = useState<Locale>('de');
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem('locale') as Locale;
    if (saved && locales.includes(saved)) {
      setCurrentLocale(saved);
    }
  }, []);

  const handleLanguageChange = (locale: Locale) => {
    // Save to localStorage
    localStorage.setItem('locale', locale);

    // Set cookie for server-side rendering
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`; // 1 year

    // Update state
    setCurrentLocale(locale);

    // Reload to apply translations
    router.refresh();
    window.location.reload();
  };

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sage-50 transition-colors border border-gray-200"
        data-testid="language-selector"
      >
        <span className="text-lg">{localeFlags[currentLocale]}</span>
        <span className="text-sm font-medium text-gray-700">
          {localeNames[currentLocale]}
        </span>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[160px] bg-white rounded-lg shadow-lg border border-gray-200 p-1 z-50"
          sideOffset={5}
        >
          {locales.map((locale) => (
            <DropdownMenu.Item
              key={locale}
              className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer outline-none ${
                locale === currentLocale
                  ? 'bg-sage-50 text-sage-700'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
              onClick={() => handleLanguageChange(locale)}
            >
              <span className="text-lg">{localeFlags[locale]}</span>
              <span className="text-sm font-medium">{localeNames[locale]}</span>
              {locale === currentLocale && (
                <svg className="w-4 h-4 ml-auto text-sage-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
