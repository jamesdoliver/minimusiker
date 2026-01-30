'use client';

import { useState, useMemo } from 'react';

export interface StaffMemberWithRegions {
  id: string;
  name: string;
  email: string;
  regions: string[];
}

interface StaffSelectorSidebarProps {
  staff: StaffMemberWithRegions[];
  selectedStaffId: string | null;
  currentStaffId: string | null; // The originally assigned staff
  onSelectStaff: (staffId: string) => void;
  isLoading?: boolean;
}

export default function StaffSelectorSidebar({
  staff,
  selectedStaffId,
  currentStaffId,
  onSelectStaff,
  isLoading = false,
}: StaffSelectorSidebarProps) {
  // Track which regions are expanded
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());

  // Group staff by region
  const staffByRegion = useMemo(() => {
    const regionMap = new Map<string, StaffMemberWithRegions[]>();

    // Collect all staff by their regions
    staff.forEach((member) => {
      const regions = member.regions.length > 0 ? member.regions : ['No Region'];
      regions.forEach((region) => {
        const existing = regionMap.get(region) || [];
        // Avoid duplicates
        if (!existing.find((s) => s.id === member.id)) {
          existing.push(member);
        }
        regionMap.set(region, existing);
      });
    });

    // Sort regions alphabetically, but put "No Region" last
    const sortedRegions = Array.from(regionMap.keys()).sort((a, b) => {
      if (a === 'No Region') return 1;
      if (b === 'No Region') return -1;
      return a.localeCompare(b);
    });

    return { regionMap, sortedRegions };
  }, [staff]);

  // Auto-expand the region containing the selected/current staff
  useMemo(() => {
    const relevantStaffId = selectedStaffId || currentStaffId;
    if (relevantStaffId) {
      const staffMember = staff.find((s) => s.id === relevantStaffId);
      if (staffMember) {
        const regions = staffMember.regions.length > 0 ? staffMember.regions : ['No Region'];
        setExpandedRegions((prev) => {
          const next = new Set(prev);
          regions.forEach((r) => next.add(r));
          return next;
        });
      }
    }
  }, [selectedStaffId, currentStaffId, staff]);

  const toggleRegion = (region: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) {
        next.delete(region);
      } else {
        next.add(region);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="w-56 border-l border-gray-200 pl-4 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-24 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-8 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-56 border-l border-gray-200 pl-4 overflow-y-auto max-h-[400px]">
      <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
        Staff Members
      </h4>

      {staff.length === 0 ? (
        <p className="text-sm text-gray-500">No staff members found</p>
      ) : (
        <div className="space-y-2">
          {staffByRegion.sortedRegions.map((region) => {
            const members = staffByRegion.regionMap.get(region) || [];
            const isExpanded = expandedRegions.has(region);

            return (
              <div key={region}>
                {/* Region Header */}
                <button
                  onClick={() => toggleRegion(region)}
                  className="w-full flex items-center gap-2 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span>{region}</span>
                  <span className="text-xs text-gray-400">({members.length})</span>
                </button>

                {/* Staff List */}
                {isExpanded && (
                  <div className="ml-4 space-y-0.5">
                    {members.map((member) => {
                      const isSelected = member.id === selectedStaffId;
                      const isCurrent = member.id === currentStaffId;

                      return (
                        <button
                          key={member.id}
                          onClick={() => onSelectStaff(member.id)}
                          className={`
                            w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors
                            ${isSelected
                              ? 'bg-blue-100 text-blue-800 font-medium'
                              : 'text-gray-700 hover:bg-gray-100'
                            }
                          `}
                        >
                          {/* Selection indicator */}
                          <span
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              isSelected ? 'bg-blue-600' : isCurrent ? 'bg-green-500' : 'bg-transparent'
                            }`}
                          />
                          <span className="truncate flex-1">{member.name}</span>
                          {isCurrent && !isSelected && (
                            <span className="text-xs text-green-600 flex-shrink-0">(current)</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
