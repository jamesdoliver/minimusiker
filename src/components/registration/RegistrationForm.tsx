'use client';

import { useState, useRef, useEffect } from 'react';
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

// SessionStorage helpers for form persistence
function getStorageKey(eventId: string, classId: string): string {
  return `mm-reg-${eventId}-${classId}`;
}

interface SavedFormData {
  parentFirstName: string;
  parentPhone?: string;
  children: Array<{ childName: string; gradeLevel?: string }>;
}

function saveFormToSession(key: string, data: SavedFormData): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    // iOS private browsing or quota exceeded — ignore
  }
}

function loadFormFromSession(key: string): SavedFormData | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as SavedFormData;
  } catch {
    return null;
  }
}

function clearFormSession(key: string): void {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
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

  // Synchronous guard to prevent double-clicks (useState is async and has a tiny race window)
  const submissionInFlight = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Success screen state (Fix 5+10)
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredChildNames, setRegisteredChildNames] = useState<string[]>([]);
  const [showManualPortalLink, setShowManualPortalLink] = useState(false);
  const redirectUrlRef = useRef<string>('/familie');

  const storageKey = getStorageKey(eventId, classId);

  const [formData, setFormData] = useState<Omit<RegistrationData, 'eventId' | 'classId'>>({
    parentEmail: initialEmail,
    parentFirstName: initialFirstName,
    parentPhone: initialPhone,
    children: [{ childName: '', gradeLevel: '' }],
  });

  // Restore saved form data after mount (client-only — avoids hydration mismatch)
  useEffect(() => {
    const saved = loadFormFromSession(storageKey);
    if (saved) {
      setFormData(prev => ({
        ...prev,
        parentFirstName: saved.parentFirstName || prev.parentFirstName,
        parentPhone: saved.parentPhone || prev.parentPhone,
        children: saved.children.length > 0 ? saved.children : prev.children,
      }));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — only on mount

  // Save form data to sessionStorage on change (non-sensitive fields only)
  useEffect(() => {
    saveFormToSession(storageKey, {
      parentFirstName: formData.parentFirstName,
      parentPhone: formData.parentPhone,
      children: formData.children,
    });
  }, [storageKey, formData.parentFirstName, formData.parentPhone, formData.children]);

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

    // Synchronous guard - prevents double-clicks before React state updates
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;

    setError(null);

    // Client-side validation
    if (!validateForm()) {
      setError(t('fixErrors'));
      submissionInFlight.current = false; // Reset on validation failure
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

      // Success! Show confirmation screen then redirect
      clearFormSession(storageKey);
      const url = result.data.redirectUrl || '/familie';
      redirectUrlRef.current = url;
      setRegisteredChildNames(formData.children.map(c => c.childName));
      setIsSuccess(true);
      setIsSubmitting(false);

      // Redirect after 2s (gives time to read confirmation)
      setTimeout(() => {
        router.push(url);
      }, 2000);

      // Show manual link after 5s in case redirect fails
      setTimeout(() => {
        setShowManualPortalLink(true);
      }, 5000);
    } catch (err) {
      console.error('Registration error:', err);
      setError(err instanceof Error ? err.message : 'Failed to register. Please try again.');
      submissionInFlight.current = false; // Reset on error so user can retry
      setIsSubmitting(false);
    }
  };

  // Success confirmation screen (Fix 5+10)
  if (isSuccess) {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center space-y-6">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('successTitle')}</h2>
          <p className="text-gray-600">{t('successMessage')}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 text-left space-y-2">
          <p className="text-sm font-medium text-gray-700">{t('successChildrenLabel')}</p>
          <ul className="space-y-1">
            {registeredChildNames.map((name, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {name}
              </li>
            ))}
          </ul>
          <div className="pt-2 border-t border-gray-200 mt-2 space-y-1">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{t('successSchoolLabel')}</span> {schoolName}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">{t('successClassLabel')}</span> {className}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 text-gray-500">
          <LoadingSpinner size="sm" />
          <p className="text-sm">{t('redirectingToPortal')}</p>
        </div>

        {showManualPortalLink && (
          <a
            href={redirectUrlRef.current}
            className="inline-block px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium"
          >
            {t('goToPortalManual')}
          </a>
        )}
      </div>
    );
  }

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
        <div className="flex items-start gap-3 min-h-[44px] py-2">
          <input
            type="checkbox"
            id="terms"
            checked={termsAccepted}
            onChange={handleTermsChange}
            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
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
        <div className="flex items-start gap-3 min-h-[44px] py-2">
          <input
            type="checkbox"
            id="privacy"
            checked={privacyAccepted}
            onChange={handlePrivacyChange}
            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
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
