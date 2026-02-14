'use client';

import { useState, useEffect, useMemo, useCallback, Fragment } from 'react';
import { toast } from 'sonner';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import CreateLeadModal from '@/components/admin/leads/CreateLeadModal';
import CreateBookingModal from '@/components/admin/bookings/CreateBookingModal';
import LeadStageBadge from '@/components/admin/leads/LeadStageBadge';
import LeadDetailsBreakdown from '@/components/admin/leads/LeadDetailsBreakdown';
import MasterCalendar from '@/components/admin/leads/MasterCalendar';
import type { LeadStage } from '@/lib/types/airtable';
import type { LeadWithStaffName, StaffOption, RegionOption } from '@/app/api/admin/leads/route';

const ACTIVE_STAGES: LeadStage[] = ['New', 'Contacted', 'In Discussion'];
const ALL_STAGES: LeadStage[] = ['New', 'Contacted', 'In Discussion', 'Won', 'Lost'];

interface BookingPrefillData {
  leadId?: string;
  schoolName?: string;
  contactName?: string;
  contactEmail?: string;
  phone?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  regionId?: string;
  estimatedChildren?: string;
  eventDate?: string;
  callNotes?: Array<{ callNumber: number; date: string; notes: string }>;
}

export default function AdminLeads() {
  const [leads, setLeads] = useState<LeadWithStaffName[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [regionList, setRegionList] = useState<RegionOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [activeStages, setActiveStages] = useState<Set<LeadStage>>(new Set(ACTIVE_STAGES));
  const [sourceFilter, setSourceFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingPrefillData, setBookingPrefillData] = useState<BookingPrefillData | undefined>();
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/leads', { credentials: 'include' });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch leads');
      }

      const data = await response.json();
      if (data.success) {
        setLeads(data.data.leads || []);
        setStaffList(data.data.staffList || []);
        setRegionList(data.data.regionList || []);
      } else {
        throw new Error(data.error || 'Failed to load leads');
      }
    } catch (err) {
      console.error('Error fetching leads:', err);
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleStage = (stage: LeadStage) => {
    setActiveStages(prev => {
      const next = new Set(prev);
      if (next.has(stage)) {
        next.delete(stage);
        if (next.size === 0) next.add('New');
      } else {
        next.add(stage);
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUpdateLead = useCallback(async (leadId: string, data: Record<string, unknown>) => {
    try {
      // Optimistic update
      setLeads(prev => prev.map(lead => {
        if (lead.id !== leadId) return lead;
        const updated = { ...lead };
        if (data.schoolName !== undefined) updated.schoolName = data.schoolName as string;
        if (data.contactPerson !== undefined) updated.contactPerson = data.contactPerson as string;
        if (data.contactEmail !== undefined) updated.contactEmail = data.contactEmail as string;
        if (data.contactPhone !== undefined) updated.contactPhone = data.contactPhone as string;
        if (data.address !== undefined) updated.address = data.address as string;
        if (data.postalCode !== undefined) updated.postalCode = data.postalCode as string;
        if (data.city !== undefined) updated.city = data.city as string;
        if (data.stage !== undefined) updated.stage = data.stage as LeadStage;
        if (data.lostReason !== undefined) updated.lostReason = data.lostReason as string;
        if (data.callNotes !== undefined) updated.callNotes = data.callNotes as typeof lead.callNotes;
        if (data.nextFollowUp !== undefined) updated.nextFollowUp = data.nextFollowUp as string;
        if (data.estimatedDate !== undefined) updated.estimatedDate = (data.estimatedDate as string) || undefined;
        if (data.estimatedMonth !== undefined) updated.estimatedMonth = (data.estimatedMonth as string) || undefined;
        if (data.assignedStaffId !== undefined) {
          updated.assignedStaffId = (data.assignedStaffId as string) || undefined;
          updated.assignedStaffName = updated.assignedStaffId
            ? staffList.find(s => s.id === updated.assignedStaffId)?.name
            : undefined;
        }
        if (data.schulsongUpsell !== undefined) updated.schulsongUpsell = data.schulsongUpsell as boolean;
        if (data.scsFunded !== undefined) updated.scsFunded = data.scsFunded as boolean;
        if (data.eventTypeInterest !== undefined) updated.eventTypeInterest = data.eventTypeInterest as typeof lead.eventTypeInterest;
        if (data.leadSource !== undefined) updated.leadSource = data.leadSource as typeof lead.leadSource;
        if (data.regionId !== undefined) updated.regionId = (data.regionId as string) || undefined;
        if (data.estimatedChildren !== undefined) updated.estimatedChildren = data.estimatedChildren as number;
        return updated;
      }));

      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update lead');
      }
    } catch (err) {
      console.error('Error updating lead:', err);
      toast.error('Failed to update lead');
      fetchLeads(); // Revert on error
    }
  }, [staffList]);

  const handleConvertLead = useCallback(async (leadId: string) => {
    try {
      const response = await fetch(`/api/admin/leads/${leadId}/convert`, {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to convert lead');
      }

      // Open CreateBookingModal with prefill data (lead gets marked Won when booking is created)
      setBookingPrefillData(data.data);
      setShowBookingModal(true);
    } catch (err) {
      console.error('Error converting lead:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to convert lead');
    }
  }, []);

  const handleDeleteLead = useCallback(async (leadId: string) => {
    try {
      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to delete lead');
      }

      setLeads(prev => prev.filter(l => l.id !== leadId));
      setExpandedRows(prev => {
        const next = new Set(prev);
        next.delete(leadId);
        return next;
      });
      toast.success('Lead deleted');
    } catch (err) {
      console.error('Error deleting lead:', err);
      toast.error('Failed to delete lead');
    }
  }, []);

  // Compute stage counts
  const stageCounts = useMemo(() => {
    const counts: Record<LeadStage, number> = { New: 0, Contacted: 0, 'In Discussion': 0, Won: 0, Lost: 0 };
    leads.forEach(l => { counts[l.stage] = (counts[l.stage] || 0) + 1; });
    return counts;
  }, [leads]);

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    let filtered = leads.filter(l => activeStages.has(l.stage));

    if (sourceFilter) {
      filtered = filtered.filter(l => l.leadSource === sourceFilter);
    }

    if (staffFilter) {
      filtered = filtered.filter(l => l.assignedStaffId === staffFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        l.schoolName?.toLowerCase().includes(q) ||
        l.contactPerson?.toLowerCase().includes(q) ||
        l.contactEmail?.toLowerCase().includes(q)
      );
    }

    // Sort: overdue follow-ups first, then today, this week, then by created (newest first)
    // Won/Lost to the bottom
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekFromNow = new Date(now);
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const weekStr = weekFromNow.toISOString().split('T')[0];

    filtered.sort((a, b) => {
      // Terminal stages always at bottom
      const aTerminal = a.stage === 'Won' || a.stage === 'Lost';
      const bTerminal = b.stage === 'Won' || b.stage === 'Lost';
      if (aTerminal && !bTerminal) return 1;
      if (!aTerminal && bTerminal) return -1;

      // Follow-up priority
      const aFollow = a.nextFollowUp || '';
      const bFollow = b.nextFollowUp || '';

      const aOverdue = aFollow && aFollow < today;
      const bOverdue = bFollow && bFollow < today;
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      const aToday = aFollow === today;
      const bToday = bFollow === today;
      if (aToday && !bToday) return -1;
      if (!aToday && bToday) return 1;

      const aThisWeek = aFollow && aFollow <= weekStr && aFollow > today;
      const bThisWeek = bFollow && bFollow <= weekStr && bFollow > today;
      if (aThisWeek && !bThisWeek) return -1;
      if (!aThisWeek && bThisWeek) return 1;

      // Fall back to created date (newest first)
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return filtered;
  }, [leads, activeStages, sourceFilter, staffFilter, searchQuery]);

  const getFollowUpStyle = (followUp?: string): string => {
    if (!followUp) return '';
    const today = new Date().toISOString().split('T')[0];
    if (followUp < today) return 'text-red-600 font-medium';
    if (followUp === today) return 'text-orange-600 font-medium';
    return 'text-gray-500';
  };

  const formatDate = (date?: string) => {
    if (!date) return '';
    try {
      return new Date(date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
    } catch {
      return date;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error: {error}</p>
        <button onClick={fetchLeads} className="mt-2 text-sm text-red-700 underline hover:no-underline">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-3xl font-bold text-gray-900">
          Leads <span className="text-lg font-normal text-gray-500">({leads.length})</span>
        </h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Lead
          </button>
          <button
            onClick={fetchLeads}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Master Calendar */}
      <MasterCalendar regions={regionList} refreshTrigger={calendarRefreshTrigger} />

      {/* Filter Panel */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 space-y-4">
        {/* Stage Toggles */}
        <div className="flex flex-wrap gap-2">
          {ALL_STAGES.map((stage) => (
            <button
              key={stage}
              onClick={() => toggleStage(stage)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeStages.has(stage)
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {stage} ({stageCounts[stage]})
            </button>
          ))}
        </div>

        {/* Search + Dropdown Filters */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search school, contact..."
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Sources</option>
            <option value="Inbound Call">Inbound Call</option>
            <option value="Outbound Call">Outbound Call</option>
            <option value="Website">Website</option>
            <option value="Referral">Referral</option>
            <option value="Repeat Customer">Repeat Customer</option>
            <option value="Event/Fair">Event/Fair</option>
            <option value="Other">Other</option>
          </select>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Staff</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">School</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">Follow-Up</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No leads found
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const isExpanded = expandedRows.has(lead.id);
                  const isTerminal = lead.stage === 'Won' || lead.stage === 'Lost';

                  return (
                    <Fragment key={lead.id}>
                      <tr
                        onClick={() => toggleRow(lead.id)}
                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${isTerminal ? 'opacity-50' : ''}`}
                      >
                        <td className="px-3 py-3">
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 max-w-[200px] truncate">
                          {lead.schoolName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-[150px] truncate">
                          {lead.contactPerson}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 hidden md:table-cell">
                          {lead.contactPhone || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <LeadStageBadge stage={lead.stage} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 hidden lg:table-cell">
                          {lead.leadSource || '-'}
                        </td>
                        <td className={`px-4 py-3 text-sm hidden md:table-cell ${getFollowUpStyle(lead.nextFollowUp)}`}>
                          {lead.nextFollowUp ? formatDate(lead.nextFollowUp) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400 hidden lg:table-cell">
                          {formatDate(lead.createdAt)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="p-0">
                            <LeadDetailsBreakdown
                              lead={lead}
                              staffList={staffList}
                              regionList={regionList}
                              onUpdate={handleUpdateLead}
                              onConvert={handleConvertLead}
                              onDelete={handleDeleteLead}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
          Showing {filteredLeads.length} of {leads.length} leads
        </div>
      </div>

      {/* Create Lead Modal */}
      <CreateLeadModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchLeads();
        }}
        regions={regionList}
        staffList={staffList}
      />

      {/* Create Booking Modal (for conversion) */}
      <CreateBookingModal
        isOpen={showBookingModal}
        onClose={() => {
          setShowBookingModal(false);
          setBookingPrefillData(undefined);
        }}
        onSuccess={() => {
          setShowBookingModal(false);
          setBookingPrefillData(undefined);
          fetchLeads();
          setCalendarRefreshTrigger(prev => prev + 1);
          toast.success('Lead converted to booking!');
        }}
        regions={regionList}
        prefillData={bookingPrefillData}
      />
    </div>
  );
}
