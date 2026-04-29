'use client';

import OrdersEventDetail from '@/components/admin/orders/OrdersEventDetail';

export default function OrdersEventPage({
  params,
}: {
  params: { eventId: string };
}) {
  return <OrdersEventDetail eventId={params.eventId} />;
}
