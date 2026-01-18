'use client';

import { useTranslations } from 'next-intl';

interface RegisterCTACardProps {
  onRegisterClick: () => void;
}

export default function RegisterCTACard({ onRegisterClick }: RegisterCTACardProps) {
  const t = useTranslations('registration.page');

  return (
    <div className="bg-[#f0efec] rounded-2xl p-6 md:p-8 shadow-sm h-full flex flex-col justify-center">
      <h2 className="font-heading text-2xl md:text-3xl font-bold text-[#6b8a85] mb-4">
        {t('registerCardTitle')}
      </h2>

      <p className="text-gray-600 text-lg mb-6">
        {t('registerCardSubtitle')}
      </p>

      <button
        onClick={onRegisterClick}
        className="w-full py-3 px-4 rounded-lg shadow-sm text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 transition-all font-button font-bold uppercase tracking-wide"
      >
        {t('registerCardCta')}
      </button>
    </div>
  );
}
