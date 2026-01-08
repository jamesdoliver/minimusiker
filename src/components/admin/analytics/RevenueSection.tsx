import { EventRevenue } from '@/lib/types/analytics';

interface RevenueSectionProps {
  revenue: EventRevenue;
}

function formatCurrency(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

export default function RevenueSection({ revenue }: RevenueSectionProps) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-3">Revenue by Product</h4>

      {revenue.products.length === 0 ? (
        <p className="text-sm text-gray-500 italic">No revenue data available</p>
      ) : (
        revenue.products.map((product) => (
          <div key={product.productType} className="mb-4">
            {/* Product header */}
            <div className="text-sm font-medium text-gray-800 mb-1">
              {product.productType}
            </div>

            {/* Size breakdown table */}
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="pb-1 font-medium pl-4">Size</th>
                  <th className="pb-1 font-medium text-right">Qty</th>
                  <th className="pb-1 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {product.sizeBreakdown.map((size, idx) => (
                  <tr key={`${product.productType}-${size.size}-${idx}`}>
                    <td className="py-0.5 text-gray-600 pl-4">{size.size}</td>
                    <td className="py-0.5 text-right">{size.quantity}</td>
                    <td className="py-0.5 text-right">{formatCurrency(size.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      {/* Total */}
      <div className="border-t border-gray-300 pt-2 mt-2 flex justify-between font-semibold text-sm">
        <span>Total Revenue</span>
        <span>{formatCurrency(revenue.totalRevenue)}</span>
      </div>
    </div>
  );
}
