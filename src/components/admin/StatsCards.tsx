import { DashboardStats } from '@/types/airtable';
import { formatPrice } from '@/lib/utils';

interface StatsCardsProps {
  stats: DashboardStats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Revenue',
      value: formatPrice(stats.totalRevenue * 100),
      icon: '💰',
      change: stats.totalRevenue > 0 ? `${stats.totalOrders} orders` : 'No orders yet',
    },
    {
      title: 'Total Orders',
      value: stats.totalOrders.toString(),
      icon: '🛒',
      change: stats.totalOrders > 0 ? `${stats.activeEvents} active events` : 'No orders yet',
    },
    {
      title: 'Total Parents',
      value: stats.totalParents.toString(),
      icon: '👥',
      change: stats.totalParents > 0 ? 'Registered' : 'No registrations yet',
    },
    {
      title: 'Emails Sent',
      value: stats.emailsSent.toLocaleString(),
      icon: '📧',
      change: stats.emailsSent > 0 ? `${stats.emailOpenRate.toFixed(1)}% open rate` : 'No emails sent',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => (
        <div key={card.title} className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="mt-2 text-3xl font-bold text-gray-900">{card.value}</p>
              {card.change && (
                <p className="mt-2 text-sm text-gray-600">
                  {card.change}
                </p>
              )}
            </div>
            <div className="text-3xl">{card.icon}</div>
          </div>
        </div>
      ))}
    </div>
  );
}