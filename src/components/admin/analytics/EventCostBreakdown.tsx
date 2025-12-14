import { EventCosts } from '@/lib/types/analytics';

interface EventCostBreakdownProps {
  costs: EventCosts;
}

function formatCurrency(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

export default function EventCostBreakdown({ costs }: EventCostBreakdownProps) {
  return (
    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fixed Costs Section */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Fixed Costs</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 font-medium text-right">Cost</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              <tr>
                <td className="py-1">Team Member</td>
                <td className="py-1 text-right">{formatCurrency(costs.fixed.teamMember)}</td>
              </tr>
              <tr>
                <td className="py-1">Mixing</td>
                <td className="py-1 text-right">{formatCurrency(costs.fixed.mixing)}</td>
              </tr>
              <tr>
                <td className="py-1">Stickers & Certificate</td>
                <td className="py-1 text-right">{formatCurrency(costs.fixed.stickers)}</td>
              </tr>
              <tr>
                <td className="py-1">Initial Poster</td>
                <td className="py-1 text-right">{formatCurrency(costs.fixed.poster)}</td>
              </tr>
              <tr className="border-t border-gray-300 font-semibold">
                <td className="pt-2">Subtotal</td>
                <td className="pt-2 text-right">{formatCurrency(costs.fixedTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Variable Costs Section */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Variable Costs</h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2 font-medium">Item</th>
                <th className="pb-2 font-medium text-right">Qty</th>
                <th className="pb-2 font-medium text-right">Unit</th>
                <th className="pb-2 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody className="text-gray-700">
              {costs.variable.map((item) => (
                <tr key={item.item}>
                  <td className="py-1">{item.item}</td>
                  <td className="py-1 text-right">{item.quantity}</td>
                  <td className="py-1 text-right">{formatCurrency(item.unitCost)}</td>
                  <td className="py-1 text-right">{formatCurrency(item.total)}</td>
                </tr>
              ))}
              <tr className="border-t border-gray-300 font-semibold">
                <td className="pt-2" colSpan={3}>
                  Subtotal
                </td>
                <td className="pt-2 text-right">{formatCurrency(costs.variableTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Total Cost */}
      <div className="mt-4 pt-4 border-t border-gray-300 flex justify-end">
        <div className="text-right">
          <span className="text-sm text-gray-600 mr-4">Total Incurred Cost:</span>
          <span className="text-lg font-bold text-gray-900">
            {formatCurrency(costs.totalCost)}
          </span>
        </div>
      </div>
    </div>
  );
}
