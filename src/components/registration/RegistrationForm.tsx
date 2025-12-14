'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ChildInputRow from './ChildInputRow';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { RegistrationData, ChildRegistrationData } from '@/lib/types/registration';
import {
  validateParentName,
  validateEmail,
  validatePhoneNumber,
  validateChildName,
  checkDuplicateChildren,
} from '@/lib/validators/registrationValidators';

interface RegistrationFormProps {
  eventId: string;
  classId: string;
  schoolName: string;
  className: string;
  eventType: string;
  initialEmail?: string;
}

export default function RegistrationForm({
  eventId,
  classId,
  schoolName,
  className,
  eventType,
  initialEmail = '',
}: RegistrationFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<Omit<RegistrationData, 'eventId' | 'classId'>>({
    parentEmail: initialEmail,
    parentFirstName: '',
    parentPhone: '',
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
      alert('You must register at least one child');
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

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    if (!validateForm()) {
      setError('Please fix the errors below');
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
        router.push(result.data.redirectUrl || '/parent-portal');
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

      {/* Parent Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Parent Information</h2>

        <div className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="parentEmail" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address *
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
              placeholder="your.email@example.com"
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
              First Name *
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
              placeholder="Sarah"
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
              Phone Number (Optional)
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
              placeholder="+44 7700 900000"
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
          <h2 className="text-xl font-semibold text-gray-900">Children</h2>
          <button
            type="button"
            onClick={handleAddChild}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors text-sm flex items-center gap-2"
          >
            <span>+</span>
            Add Another Child
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
          Registering for: <span className="font-medium">{className}</span> at{' '}
          <span className="font-medium">{schoolName}</span>
        </p>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-3 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-lg font-medium"
        >
          {isSubmitting && <LoadingSpinner size="sm" />}
          {isSubmitting ? 'Creating Your Account...' : 'Complete Registration'}
        </button>
      </div>
    </form>
  );
}
