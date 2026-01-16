'use client';

import { useTranslations } from 'next-intl';
import { ChildRegistrationData } from '@/lib/types/registration';

interface ChildInputRowProps {
  child: ChildRegistrationData;
  index: number;
  onChange: (index: number, field: keyof ChildRegistrationData, value: string) => void;
  onRemove?: (index: number) => void;
  showRemove: boolean;
  error?: string;
}

export default function ChildInputRow({
  child,
  index,
  onChange,
  onRemove,
  showRemove,
  error,
}: ChildInputRowProps) {
  const t = useTranslations('registration.childInput');

  return (
    <div className="border border-gray-200 rounded-lg p-4 relative bg-white">
      {showRemove && onRemove && (
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="absolute top-4 right-4 text-red-600 hover:text-red-700 text-sm font-medium transition-colors"
          aria-label={`${t('remove')} ${index + 1}`}
        >
          {t('remove')}
        </button>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Child Name */}
        <div className="md:col-span-2">
          <label
            htmlFor={`child-name-${index}`}
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {t('nameLabel', { index: index + 1 })}
          </label>
          <input
            type="text"
            id={`child-name-${index}`}
            name={`children[${index}].childName`}
            value={child.childName}
            onChange={(e) => onChange(index, 'childName', e.target.value)}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder={t('namePlaceholder')}
            required
            autoComplete="off"
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>

        {/* Grade Level */}
        <div className="md:col-span-2">
          <label
            htmlFor={`child-grade-${index}`}
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            {t('gradeLabel')}
          </label>
          <input
            type="text"
            id={`child-grade-${index}`}
            name={`children[${index}].gradeLevel`}
            value={child.gradeLevel || ''}
            onChange={(e) => onChange(index, 'gradeLevel', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder={t('gradePlaceholder')}
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-gray-500">{t('gradeHint')}</p>
        </div>
      </div>
    </div>
  );
}
