'use client';

import { use } from 'react';
import OrdersEventDetail from '@/components/admin/orders/OrdersEventDetail';

export default function OrdersEventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = use(params);

  return <OrdersEventDetail eventId={eventId} />;
}
