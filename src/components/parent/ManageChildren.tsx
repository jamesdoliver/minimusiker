'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import AddChildModal from './AddChildModal';
import EditChildModal from './EditChildModal';
import EditProfileModal from './EditProfileModal';

interface ChildRegistration {
  registrationId: string;
  childName: string;
  classId: string;
  className?: string;
}

interface ManageChildrenProps {
  eventId: string;
  classId: string;
  parentEmail: string;
  parentFirstName: string;
  parentPhone: string;
  onDataChange?: () => void;
}

export default function ManageChildren({
  eventId,
  classId,
  parentEmail,
  parentFirstName,
  parentPhone,
  onDataChange,
}: ManageChildrenProps) {
  const t = useTranslations('parentPortal.manageChildren');
  const [children, setChildren] = useState<ChildRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingChild, setEditingChild] = useState<ChildRegistration | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [deletingChild, setDeletingChild] = useState<ChildRegistration | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchChildren = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/parent/registrations?eventId=${encodeURIComponent(eventId)}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch registrations');
      }

      const data = await response.json();
      if (data.success) {
        setChildren(data.data.children || []);
      }
    } catch (err) {
      console.error('Error fetching children:', err);
      setError(t('loadError'));
    } finally {
      setIsLoading(false);
    }
  }, [eventId, t]);

  useEffect(() => {
    fetchChildren();
  }, [fetchChildren]);

  const handleAddSuccess = () => {
    fetchChildren();
    onDataChange?.();
  };

  const handleEditSuccess = () => {
    fetchChildren();
    onDataChange?.();
  };

  const handleProfileSuccess = () => {
    onDataChange?.();
  };

  const handleDeleteChild = async () => {
    if (!deletingChild) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/parent/registrations/${deletingChild.registrationId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('deleteFailed'));
      }

      setDeletingChild(null);
      fetchChildren();
      onDataChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('deleteFailed'));
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-100 rounded"></div>
            <div className="h-12 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{t('title')}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{t('subtitle')}</p>
          </div>
          <button
            onClick={() => setShowProfileModal(true)}
            className="text-sm text-sage-600 hover:text-sage-700 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            {t('editProfile')}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-500 underline mt-1"
            >
              {t('dismiss')}
            </button>
          </div>
        )}

        {/* Children List */}
        <div className="p-6">
          {children.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              <p>{t('noChildren')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {children.map((child) => (
                <div
                  key={child.registrationId}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg group hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sage-100 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-sage-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{child.childName}</p>
                      {child.className && (
                        <p className="text-sm text-gray-500">{child.className}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setEditingChild(child)}
                      className="p-2 text-gray-400 hover:text-sage-600 hover:bg-white rounded-lg transition-colors"
                      title={t('edit')}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    {children.length > 1 && (
                      <button
                        onClick={() => setDeletingChild(child)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors"
                        title={t('remove')}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Child Button */}
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-4 w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-gray-500 hover:border-sage-300 hover:text-sage-600 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            {t('addAnotherChild')}
          </button>
        </div>
      </div>

      {/* Add Child Modal */}
      {showAddModal && (
        <AddChildModal
          eventId={eventId}
          classId={classId}
          existingChildren={children.map(c => ({ name: c.childName }))}
          onClose={() => setShowAddModal(false)}
          onSuccess={handleAddSuccess}
        />
      )}

      {/* Edit Child Modal */}
      {editingChild && (
        <EditChildModal
          registrationId={editingChild.registrationId}
          currentName={editingChild.childName}
          onClose={() => setEditingChild(null)}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Edit Profile Modal */}
      {showProfileModal && (
        <EditProfileModal
          currentFirstName={parentFirstName}
          currentPhone={parentPhone}
          email={parentEmail}
          onClose={() => setShowProfileModal(false)}
          onSuccess={handleProfileSuccess}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingChild && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{t('removeChildTitle')}</h3>
                <p className="text-sm text-gray-500">
                  {t('removeChildMessage', { name: deletingChild.childName })}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setDeletingChild(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleDeleteChild}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {isDeleting ? t('removing') : t('confirmRemove')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
