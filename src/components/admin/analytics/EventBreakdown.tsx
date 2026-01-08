'use client';

import { EventCosts, EventRevenue } from '@/lib/types/analytics';
import RevenueSection from './RevenueSection';
import CostsSection from './CostsSection';
import ProfitSection from './ProfitSection';

interface EventBreakdownProps {
  eventId: string;
  revenue: EventRevenue;
  costs: EventCosts;
  onManualCostChange: () => void;
}

export default function EventBreakdown({
  eventId,
  revenue,
  costs,
  onManualCostChange,
}: EventBreakdownProps) {
  return (
    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Revenue Section */}
        <RevenueSection revenue={revenue} />

        {/* RIGHT: Costs Section */}
        <CostsSection
          eventId={eventId}
          costs={costs}
          onManualCostChange={onManualCostChange}
        />
      </div>

      {/* BOTTOM: Profit Section */}
      <ProfitSection
        totalRevenue={revenue.totalRevenue}
        totalCosts={costs.totalCost}
      />
    </div>
  );
}
