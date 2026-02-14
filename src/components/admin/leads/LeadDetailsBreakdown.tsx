'use client';

import { useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import type { LeadStage, LeadSource, EventTypeInterest } from '@/lib/types/airtable';
import type { LeadWithStaffName, StaffOption, RegionOption } from '@/app/api/admin/leads/route';
import CallNotes from './CallNotes';
import LeadStageBadge from './LeadStageBadge';

const LEAD_SOURCES: LeadSource[] = [
  'Inbound Call', 'Outbound Call', 'Website', 'Referral', 'Repeat Customer', 'Event/Fair', 'Other',
];

const LEAD_STAGES: LeadStage[] = ['New', 'Contacted', 'In Discussion', 'Won', 'Lost'];

const EVENT_TYPES: EventTypeInterest[] = ['Minimusikertag', 'Plus', 'Kita', 'Schulsong'];

interface LeadDetailsBreakdownProps {
  lead: LeadWithStaffName;
  staffList: StaffOption[];
  regionList: RegionOption[];
  onUpdate: (leadId: string, data: Record<string, unknown>) => Promise<void>;
  onConvert: (leadId: string) => void;
  onDelete: (leadId: string) => void;
}

export default function LeadDetailsBreakdown({
  lead,
  staffList,
  regionList,
  onUpdate,
  onConvert,
  onDelete,
}: LeadDetailsBreakdownProps) {
  const [showLostReason, setShowLostReason] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const debouncedUpdate = useCallback(
    (data: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onUpdate(lead.id, data);
      }, 1000);
    },
    [lead.id, onUpdate]
  );

  const immediateUpdate = useCallback(
    (data: Record<string, unknown>) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      onUpdate(lead.id, data);
    },
    [lead.id, onUpdate]
  );

  const handleMarkLost = async () => {
    if (!lostReason.trim()) {
      toast.error('Please enter a reason');
      return;
    }
    await onUpdate(lead.id, { stage: 'Lost', lostReason: lostReason.trim() });
    setShowLostReason(false);
    setLostReason('');
  };

  const isTerminal = lead.stage === 'Won' || lead.stage === 'Lost';

  return (
    <div className="p-4 bg-gray-50 space-y-4">
      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact Information */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Contact Information</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">School Name</label>
              <input
                type="text"
                defaultValue={lead.schoolName}
                onChange={(e) => debouncedUpdate({ schoolName: e.target.value })}
                className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Contact Person</label>
              <input
                type="text"
                defaultValue={lead.contactPerson}
                onChange={(e) => debouncedUpdate({ contactPerson: e.target.value })}
                className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input
                  type="email"
                  defaultValue={lead.contactEmail || ''}
                  onChange={(e) => debouncedUpdate({ contactEmail: e.target.value })}
                  className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Phone</label>
                <input
                  type="tel"
                  defaultValue={lead.contactPhone || ''}
                  onChange={(e) => debouncedUpdate({ contactPhone: e.target.value })}
                  className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Location */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Location</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Address</label>
              <input
                type="text"
                defaultValue={lead.address || ''}
                onChange={(e) => debouncedUpdate({ address: e.target.value })}
                className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Postal Code</label>
                <input
                  type="text"
                  defaultValue={lead.postalCode || ''}
                  onChange={(e) => debouncedUpdate({ postalCode: e.target.value })}
                  className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">City</label>
                <input
                  type="text"
                  defaultValue={lead.city || ''}
                  onChange={(e) => debouncedUpdate({ city: e.target.value })}
                  className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Region</label>
              <select
                defaultValue={lead.regionId || ''}
                onChange={(e) => immediateUpdate({ regionId: e.target.value || null })}
                className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No region</option>
                {regionList.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Lead Details */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Lead Details</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Source</label>
              <select
                defaultValue={lead.leadSource || ''}
                onChange={(e) => immediateUpdate({ leadSource: e.target.value || null })}
                className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">No source</option>
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-2">Event Type Interest</label>
              <div className="flex flex-wrap gap-1.5">
                {EVENT_TYPES.map((type) => {
                  const active = lead.eventTypeInterest?.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const current = new Set(lead.eventTypeInterest || []);
                        if (current.has(type)) current.delete(type);
                        else current.add(type);
                        immediateUpdate({ eventTypeInterest: Array.from(current) });
                      }}
                      className={`px-2 py-1 rounded text-xs font-medium border transition-colors ${
                        active
                          ? 'bg-blue-100 border-blue-300 text-blue-800'
                          : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      {type}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Estimated Children</label>
              <input
                type="number"
                defaultValue={lead.estimatedChildren || ''}
                onChange={(e) => debouncedUpdate({ estimatedChildren: e.target.value ? Number(e.target.value) : null })}
                className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                min="0"
              />
            </div>

            {/* Toggle switches */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={lead.schulsongUpsell || false}
                    onChange={(e) => immediateUpdate({ schulsongUpsell: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`w-8 h-5 rounded-full transition-colors ${lead.schulsongUpsell ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${lead.schulsongUpsell ? 'translate-x-3' : ''}`} />
                  </div>
                </div>
                <span className="text-xs text-gray-600">Schulsong</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={lead.scsFunded || false}
                    onChange={(e) => immediateUpdate({ scsFunded: e.target.checked })}
                    className="sr-only"
                  />
                  <div className={`w-8 h-5 rounded-full transition-colors ${lead.scsFunded ? 'bg-green-600' : 'bg-gray-300'}`}>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${lead.scsFunded ? 'translate-x-3' : ''}`} />
                  </div>
                </div>
                <span className="text-xs text-gray-600">SCS Funded</span>
              </label>
            </div>

            {/* Estimated Date */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Estimated Date</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  defaultValue={lead.estimatedDate || ''}
                  onChange={(e) => immediateUpdate({ estimatedDate: e.target.value || null, estimatedMonth: null })}
                  className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-xs text-gray-400 self-center">or</span>
                <input
                  type="month"
                  defaultValue={lead.estimatedMonth || ''}
                  onChange={(e) => immediateUpdate({ estimatedMonth: e.target.value || null, estimatedDate: null })}
                  className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stage & Assignment */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Stage & Assignment</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Current Stage</label>
              <div className="flex items-center gap-2">
                <select
                  value={lead.stage}
                  onChange={(e) => immediateUpdate({ stage: e.target.value })}
                  className="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  {LEAD_STAGES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <LeadStageBadge stage={lead.stage} />
              </div>
            </div>

            {lead.lostReason && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Lost Reason</label>
                <p className="text-sm text-gray-600">{lead.lostReason}</p>
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-500 mb-1">Assigned Staff</label>
              <select
                defaultValue={lead.assignedStaffId || ''}
                onChange={(e) => immediateUpdate({ assignedStaffId: e.target.value || null })}
                className="w-full text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Unassigned</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {lead.convertedBookingId && (
              <div className="bg-green-50 border border-green-200 rounded p-2">
                <p className="text-xs text-green-700">Converted to booking</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Call Notes - full width */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <CallNotes
          callNotes={lead.callNotes}
          onChange={(notes) => debouncedUpdate({ callNotes: notes })}
        />
      </div>

      {/* Next Follow-Up */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">Next Follow-Up</h4>
        <input
          type="date"
          defaultValue={lead.nextFollowUp || ''}
          onChange={(e) => immediateUpdate({ nextFollowUp: e.target.value || null })}
          className="text-sm px-2 py-1.5 border border-gray-200 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {/* Action Buttons */}
      {!isTerminal && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => onConvert(lead.id)}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
          >
            Convert to Booking
          </button>

          {showLostReason ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                placeholder="Reason for losing..."
                className="text-sm px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-red-500 focus:border-red-500"
                autoFocus
              />
              <button
                onClick={handleMarkLost}
                className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Confirm
              </button>
              <button
                onClick={() => { setShowLostReason(false); setLostReason(''); }}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowLostReason(true)}
              className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            >
              Mark as Lost
            </button>
          )}

          {showDeleteConfirm ? (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-500">Delete this lead?</span>
              <button
                onClick={() => onDelete(lead.id)}
                className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="ml-auto px-4 py-2 text-sm font-medium text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Delete Lead
            </button>
          )}
        </div>
      )}
    </div>
  );
}
