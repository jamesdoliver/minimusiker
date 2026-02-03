'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ChildInputRow from './ChildInputRow';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { RegistrationData, ChildRegistrationData } from '@/lib/types/registration';
import {
  validateParentName,
  validatePhoneNumber,
  validateChildName,
  checkDuplicateChildren,
} from '@/lib/validators/registrationValidators';
import { validateEmail } from '@/lib/utils/validators';

interface ExistingChild {
  name: string;
  eventName?: string;
  className?: string;
}

interface RegistrationFormProps {
  eventId: string;
  classId: string;
  schoolName: string;
  className: string;
  eventType: string;
  initialEmail?: string;
  initialFirstName?: string;
  initialPhone?: string;
  existingChildren?: ExistingChild[];
  isKnownParent?: boolean;
}

export default function RegistrationForm({
  eventId,
  classId,
  schoolName,
  className,
  eventType,
  initialEmail = '',
  initialFirstName = '',
  initialPhone = '',
  existingChildren = [],
  isKnownParent = false,
}: RegistrationFormProps) {
  const router = useRouter();
  const t = useTranslations('registration.form');
  const tEmailCheck = useTranslations('parentPortal.emailCheck');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  const [formData, setFormData] = useState<Omit<RegistrationData, 'eventId' | 'classId'>>({
    parentEmail: initialEmail,
    parentFirstName: initialFirstName,
    parentPhone: initialPhone,
    children: [{ childName: '', gradeLevel: '' }],
  });

  const handleAddChild = () => {
    setFormData({
      ...formData,
      children: [...formData.children, { childName: '', gradeLevel: '' }],
    });
  };

  const handleRemoveChild = (index: number) => {
    if (formData.children.length === 1) {
      alert(t('minOneChild'));
      return;
    }
    setFormData({
      ...formData,
      children: formData.children.filter((_, i) => i !== index),
    });
    // Clear any errors for removed child
    const newErrors = { ...fieldErrors };
    delete newErrors[`child-${index}`];
    setFieldErrors(newErrors);
  };

  const handleChildChange = (
    index: number,
    field: keyof ChildRegistrationData,
    value: string
  ) => {
    const newChildren = [...formData.children];
    newChildren[index] = { ...newChildren[index], [field]: value };
    setFormData({ ...formData, children: newChildren });

    // Clear error for this field
    if (fieldErrors[`child-${index}`]) {
      const newErrors = { ...fieldErrors };
      delete newErrors[`child-${index}`];
      setFieldErrors(newErrors);
    }
  };

  const handleTermsChange = () => {
    setTermsAccepted(!termsAccepted);
    if (fieldErrors.termsAccepted) {
      const { termsAccepted: _, ...rest } = fieldErrors;
      setFieldErrors(rest);
    }
  };

  const handlePrivacyChange = () => {
    setPrivacyAccepted(!privacyAccepted);
    if (fieldErrors.privacyAccepted) {
      const { privacyAccepted: _, ...rest } = fieldErrors;
      setFieldErrors(rest);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    // Validate parent email
    const emailValidation = validateEmail(formData.parentEmail);
    if (!emailValidation.valid) {
      errors.parentEmail = emailValidation.error!;
    }

    // Validate parent name
    const nameValidation = validateParentName(formData.parentFirstName);
    if (!nameValidation.valid) {
      errors.parentFirstName = nameValidation.error!;
    }

    // Validate phone (if provided)
    if (formData.parentPhone) {
      const phoneValidation = validatePhoneNumber(formData.parentPhone);
      if (!phoneValidation.valid) {
        errors.parentPhone = phoneValidation.error!;
      }
    }

    // Validate children
    formData.children.forEach((child, index) => {
      const childValidation = validateChildName(child.childName);
      if (!childValidation.valid) {
        errors[`child-${index}`] = childValidation.error!;
      }
    });

    // Check for duplicate children
    const duplicateCheck = checkDuplicateChildren(formData.children);
    if (!duplicateCheck.valid) {
      setError(duplicateCheck.error!);
      setFieldErrors(errors);
      return false;
    }

    // Validate consent checkboxes
    if (!termsAccepted) {
      errors.termsAccepted = t('termsRequired');
    }
    if (!privacyAccepted) {
      errors.privacyAccepted = t('privacyRequired');
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!validateForm()) {
      setError(t('fixErrors'));
      return;
    }

    setIsSubmitting(true);

    try {
      const registrationData: RegistrationData = {
        ...formData,
        eventId,
        classId,
      };

      const response = await fetch('/api/auth/parent-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(registrationData),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Registration failed');
      }

      // Success! Redirect to parent portal (session cookie is set by API)
      setTimeout(() => {
        router.push(result.data.redirectUrl || '/familie');
      }, 1500);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Failed to register. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Welcome Back Banner for known parents */}
      {isKnownParent && initialFirstName && (
        <div className="bg-sage-50 border border-sage-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-sage-100 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-sage-800">
                {tEmailCheck('knownParent', { name: initialFirstName })}
              </p>
              <p className="text-sm text-sage-700 mt-1">
                {tEmailCheck('prefillMessage')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Parent Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">{t('parentInfo')}</h2>

        <div className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="parentEmail" className="block text-sm font-medium text-gray-700 mb-2">
              {t('emailLabel')}
            </label>
            <input
              type="email"
              id="parentEmail"
              value={formData.parentEmail}
              onChange={(e) => {
                setFormData({ ...formData, parentEmail: e.target.value });
                if (fieldErrors.parentEmail) {
                  const { parentEmail, ...rest } = fieldErrors;
                  setFieldErrors(rest);
                }
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                fieldErrors.parentEmail ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={t('emailPlaceholder')}
              required
              autoComplete="email"
            />
            {fieldErrors.parentEmail && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.parentEmail}</p>
            )}
          </div>

          {/* First Name */}
          <div>
            <label
              htmlFor="parentFirstName"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              {t('firstNameLabel')}
            </label>
            <input
              type="text"
              id="parentFirstName"
              value={formData.parentFirstName}
              onChange={(e) => {
                setFormData({ ...formData, parentFirstName: e.target.value });
                if (fieldErrors.parentFirstName) {
                  const { parentFirstName, ...rest } = fieldErrors;
                  setFieldErrors(rest);
                }
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                fieldErrors.parentFirstName ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={t('firstNamePlaceholder')}
              required
              autoComplete="given-name"
            />
            {fieldErrors.parentFirstName && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.parentFirstName}</p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="parentPhone" className="block text-sm font-medium text-gray-700 mb-2">
              {t('phoneLabel')}
            </label>
            <input
              type="tel"
              id="parentPhone"
              value={formData.parentPhone}
              onChange={(e) => {
                setFormData({ ...formData, parentPhone: e.target.value });
                if (fieldErrors.parentPhone) {
                  const { parentPhone, ...rest } = fieldErrors;
                  setFieldErrors(rest);
                }
              }}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${
                fieldErrors.parentPhone ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder={t('phonePlaceholder')}
              autoComplete="tel"
            />
            {fieldErrors.parentPhone && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.parentPhone}</p>
            )}
          </div>
        </div>
      </div>

      {/* Children */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">{t('children')}</h2>
          <button
            type="button"
            onClick={handleAddChild}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm flex items-center gap-2"
          >
            <span>+</span>
            {t('addChild')}
          </button>
        </div>

        <div className="space-y-4">
          {formData.children.map((child, index) => (
            <ChildInputRow
              key={index}
              child={child}
              index={index}
              onChange={handleChildChange}
              onRemove={handleRemoveChild}
              showRemove={formData.children.length > 1}
              error={fieldErrors[`child-${index}`]}
            />
          ))}
        </div>

        <p className="mt-4 text-sm text-gray-600">
          {t('registeringFor', { className, schoolName })}
        </p>
      </div>

      {/* Legal Consent Section */}
      <div className="space-y-4">
        {/* Terms Checkbox */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="terms"
            checked={termsAccepted}
            onChange={handleTermsChange}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
          <label htmlFor="terms" className="text-sm text-gray-700 cursor-pointer">
            {t('termsLabel')}{' '}
            <a
              href="/agb"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline"
            >
              {t('termsLink')}
            </a>
          </label>
        </div>
        {fieldErrors.termsAccepted && (
          <p className="text-red-600 text-sm ml-7">{fieldErrors.termsAccepted}</p>
        )}

        {/* Privacy Checkbox */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="privacy"
            checked={privacyAccepted}
            onChange={handlePrivacyChange}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
          />
          <label htmlFor="privacy" className="text-sm text-gray-700 cursor-pointer">
            {t('privacyLabel')}{' '}
            <a
              href="/datenschutz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary/80 underline"
            >
              {t('privacyLink')}
            </a>
          </label>
        </div>
        {fieldErrors.privacyAccepted && (
          <p className="text-red-600 text-sm ml-7">{fieldErrors.privacyAccepted}</p>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-lg font-medium"
        >
          {isSubmitting && <LoadingSpinner size="sm" />}
          {isSubmitting ? t('submitting') : t('submitButton')}
        </button>
      </div>
    </form>
  );
}
