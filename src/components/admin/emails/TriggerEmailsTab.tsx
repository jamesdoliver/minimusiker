'use client';

import { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import TriggerEmailEditor from './TriggerEmailEditor';
import { TriggerEmailTemplate } from '@/lib/types/email-automation';

const RECIPIENT_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'bg-blue-100 text-blue-700' },
  teacher: { label: 'Lehrer', color: 'bg-purple-100 text-purple-700' },
  parent: { label: 'Eltern', color: 'bg-orange-100 text-orange-700' },
  staff: { label: 'Staff', color: 'bg-teal-100 text-teal-700' },
  engineer: { label: 'Engineer', color: 'bg-indigo-100 text-indigo-700' },
};

const RECIPIENT_GROUP_ORDER: Array<{ key: string; label: string }> = [
  { key: 'admin', label: 'Admin-Benachrichtigungen' },
  { key: 'teacher', label: 'Lehrer-E-Mails' },
  { key: 'parent', label: 'Eltern-E-Mails' },
  { key: 'staff', label: 'Staff-E-Mails' },
  { key: 'engineer', label: 'Engineer-E-Mails' },
];

export default function TriggerEmailsTab() {
  const [templates, setTemplates] = useState<TriggerEmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [togglingSlug, setTogglingSlug] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/trigger-templates', {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch trigger templates');
      }

      const data = await response.json();
      if (data.success) {
        setTemplates(data.data.templates);
      } else {
        throw new Error(data.error || 'Failed to load trigger templates');
      }
    } catch (err) {
      console.error('Error fetching trigger templates:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trigger templates');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleToggleActive = async (slug: string, currentActive: boolean) => {
    setTogglingSlug(slug);
    try {
      const response = await fetch(`/api/admin/trigger-templates/${slug}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive }),
      });

      if (response.ok) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.triggerSlug === slug ? { ...t, active: !currentActive } : t
          )
        );
      }
    } catch (err) {
      console.error('Error toggling template:', err);
    } finally {
      setTogglingSlug(null);
    }
  };

  const handleEditorClose = () => {
    setEditingSlug(null);
    fetchTemplates();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={() => {
            setError(null);
            fetchTemplates();
          }}
          className="mt-2 text-sm text-red-600 underline hover:no-underline"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  // Group templates by recipient type
  const grouped = RECIPIENT_GROUP_ORDER.map((group) => ({
    ...group,
    templates: templates.filter((t) => t.recipientType === group.key),
  })).filter((group) => group.templates.length > 0);

  return (
    <>
      <div className="space-y-6">
        <p className="text-sm text-gray-500">
          Trigger-E-Mails werden automatisch bei bestimmten Ereignissen gesendet (z.B. Buchung, Login, Registrierung).
          Du kannst Betreff und Inhalt anpassen oder einzelne E-Mails deaktivieren.
        </p>

        {grouped.map((group) => (
          <div key={group.key}>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
              {group.label}
            </h3>
            <div className="space-y-2">
              {group.templates.map((template) => {
                const badge = RECIPIENT_LABELS[template.recipientType];
                return (
                  <div
                    key={template.triggerSlug}
                    className={`bg-white rounded-lg border p-4 transition-colors ${
                      template.active
                        ? 'border-gray-200 hover:shadow-md'
                        : 'border-gray-100 bg-gray-50 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-medium text-gray-900">
                            {template.name}
                          </h4>
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.color}`}
                          >
                            {badge.label}
                          </span>
                          {template.isCustomized && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                              Angepasst
                            </span>
                          )}
                          {!template.isCustomized && template.id && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                              Standard
                            </span>
                          )}
                          {template.triggerEventName && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-50 text-cyan-700">
                              ⚡ {template.triggerEventName}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                          {template.description}
                        </p>
                        <p className="mt-1 text-xs text-gray-400 truncate">
                          Betreff: {template.subject}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Active/Inactive Toggle */}
                        <button
                          onClick={() => handleToggleActive(template.triggerSlug, template.active)}
                          disabled={togglingSlug === template.triggerSlug}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            template.active ? 'bg-green-500' : 'bg-gray-300'
                          } ${togglingSlug === template.triggerSlug ? 'opacity-50' : ''}`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              template.active ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                      <button
                        onClick={() => setEditingSlug(template.triggerSlug)}
                        className="text-xs text-primary hover:text-primary/80 font-medium"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={async () => {
                          const response = await fetch(`/api/admin/trigger-templates/${template.triggerSlug}`, {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: '{}',
                          });
                          if (response.ok) {
                            const data = await response.json();
                            if (data.success) {
                              // Open preview in new window
                              const previewWindow = window.open('', '_blank');
                              if (previewWindow) {
                                previewWindow.document.write(data.data.html);
                                previewWindow.document.close();
                              }
                            }
                          }
                        }}
                        className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                      >
                        Vorschau
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Editor Modal */}
      {editingSlug && (
        <TriggerEmailEditor
          slug={editingSlug}
          onClose={handleEditorClose}
        />
      )}
    </>
  );
}
