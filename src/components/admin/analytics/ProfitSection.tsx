interface ProfitSectionProps {
  totalRevenue: number;
  totalCosts: number;
}

function formatCurrency(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

export default function ProfitSection({ totalRevenue, totalCosts }: ProfitSectionProps) {
  const profit = totalRevenue - totalCosts;
  const isPositive = profit >= 0;

  return (
    <div className="mt-4 pt-4 border-t border-gray-300 flex justify-between items-center">
      <span className="text-sm font-medium text-gray-700">Total Event Profit</span>
      <span className={`text-xl font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? '+' : ''}{formatCurrency(profit)}
      </span>
    </div>
  );
}
