'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EventAnalyticsTable from '@/components/admin/analytics/EventAnalyticsTable';
import ExportButtons from '@/components/admin/analytics/ExportButtons';
import {
  EventAnalyticsRow,
  DEFAULT_FIXED_COSTS,
  calculateFixedTotal,
  calculateVariableTotal,
  generateFillerVariableCosts,
  generateFillerRevenueBreakdown,
  determineEventStatus,
} from '@/lib/types/analytics';
import { SchoolEventSummary } from '@/lib/types/airtable';

// Transform API event data to analytics row format
function transformToAnalyticsRow(event: SchoolEventSummary): EventAnalyticsRow {
  // Generate filler data (will be replaced with real data from Shopify/Stock DB later)
  const variableCosts = generateFillerVariableCosts();
  const revenueBreakdown = generateFillerRevenueBreakdown();
  const fixedTotal = calculateFixedTotal(DEFAULT_FIXED_COSTS);
  const variableTotal = calculateVariableTotal(variableCosts);
  const manualTotal = 0; // Manual costs will be fetched when row expands
  const totalCost = fixedTotal + variableTotal + manualTotal;

  // Calculate registration percentage
  const registeredChildren = event.totalParents; // Using parents as proxy for registered children
  const totalChildren = event.totalChildren || registeredChildren || 1; // Avoid division by zero
  const registrationPercent = totalChildren > 0 ? (registeredChildren / totalChildren) * 100 : 0;

  // Determine status based on weeks from event date
  const status = determineEventStatus(event.eventDate);

  // Calculate AOV (Average Order Value)
  const aov = registeredChildren > 0 ? revenueBreakdown.totalRevenue / registeredChildren : 0;

  return {
    eventId: event.eventId,
    eventName: `${event.schoolName} - ${event.eventDate}`,
    schoolName: event.schoolName,
    eventDate: event.eventDate,
    totalRevenue: revenueBreakdown.totalRevenue,
    aov,
    incurredCost: totalCost,
    profit: revenueBreakdown.totalRevenue - totalCost,
    status,
    registrationPercent,
    totalChildren,
    registeredChildren,
    revenue: revenueBreakdown,
    costs: {
      fixed: { ...DEFAULT_FIXED_COSTS },
      variable: variableCosts,
      manual: [], // Manual costs will be fetched when row expands
      fixedTotal,
      variableTotal,
      manualTotal,
      totalCost,
    },
  };
}

export default function AdminAnalytics() {
  const [events, setEvents] = useState<SchoolEventSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleRefresh = useCallback(() => {
    // Increment refresh key to force re-fetch of data
    setRefreshKey((prev) => prev + 1);
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await fetch('/api/airtable/get-events');
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await response.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  // Transform events to analytics rows (memoized to keep filler data stable)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const analyticsData = useMemo(() => {
    return events.map(transformToAnalyticsRow);
  }, [events, refreshKey]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (analyticsData.length === 0) {
      return {
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        avgRegistration: 0,
        avgOrderValue: 0,
        eventCount: 0,
      };
    }

    const totalRevenue = analyticsData.reduce((sum, e) => sum + e.totalRevenue, 0);
    const totalCost = analyticsData.reduce((sum, e) => sum + e.incurredCost, 0);
    const totalOrders = analyticsData.reduce((sum, e) => sum + e.registeredChildren, 0);
    const avgRegistration =
      analyticsData.reduce((sum, e) => sum + e.registrationPercent, 0) / analyticsData.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalRevenue,
      totalCost,
      totalProfit: totalRevenue - totalCost,
      avgRegistration,
      avgOrderValue,
      eventCount: analyticsData.length,
    };
  }, [analyticsData]);

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
      </div>
    );
  }

  return (
    <div className="print:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Event Analytics</h1>
          <p className="text-gray-600 mt-1">{analyticsData.length} events</p>
        </div>
        <div className="print:hidden">
          <ExportButtons data={analyticsData} />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            €{summaryStats.totalRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">Filler data</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Avg Order Value</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            €{summaryStats.avgOrderValue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">Per order</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Total Costs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            €{summaryStats.totalCost.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">Fixed + Variable</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Total Profit</p>
          <p
            className={`text-2xl font-bold mt-1 ${
              summaryStats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {summaryStats.totalProfit >= 0 ? '+' : ''}€
            {summaryStats.totalProfit.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-400 mt-1">Revenue - Costs</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <p className="text-sm font-medium text-gray-500">Avg Registration</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {summaryStats.avgRegistration.toFixed(1)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">Across all events</p>
        </div>
      </div>

      {/* Status Legend */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 print:hidden">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Status Legend</h3>

        {/* Row 1: Colored status labels */}
        <div className="grid grid-cols-6 gap-4 mb-2">
          <span className="text-sm text-red-600 font-medium text-center">-8 Weeks</span>
          <span className="text-sm text-orange-500 font-medium text-center">-4 Weeks</span>
          <span className="text-sm text-yellow-600 font-medium text-center">-2 Weeks</span>
          <span className="text-sm text-green-600 font-medium text-center">Event Day</span>
          <span className="text-sm text-blue-500 font-medium text-center">+1 Week</span>
          <span className="text-sm text-gray-500 font-medium text-center">Archive</span>
        </div>

        {/* Row 2: Explanatory text */}
        <div className="grid grid-cols-6 gap-4 text-xs text-gray-500">
          <span className="text-center">8+ weeks before</span>
          <span className="text-center">4-8 weeks</span>
          <span className="text-center">2-4 weeks</span>
          <span className="text-center">&lt;2 weeks</span>
          <span className="text-center">0-1 week after</span>
          <span className="text-center">1+ weeks after</span>
        </div>
      </div>

      {/* Main Table */}
      <EventAnalyticsTable data={analyticsData} onRefresh={handleRefresh} />

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          nav,
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
