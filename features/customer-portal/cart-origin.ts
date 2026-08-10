import { formatOrderNumber } from '../orders/order-number';

export function getPreloadedCartNotice({
  status,
  orderNumber,
  itemCount,
}: {
  status: string;
  orderNumber: number | null;
  itemCount: number;
}): string | null {
  if (itemCount === 0) {
    return null;
  }

  if (status === 'DRAFT') {
    return 'הטיוטה השמורה שלך נטענה. בדקו ועדכנו כמויות לפני המעבר לסקירת ההזמנה.';
  }

  const orderLabel = orderNumber === null ? 'ההזמנה הקודמת' : `הזמנה ${formatOrderNumber(orderNumber)}`;
  return `סל ${orderLabel} נטען לנוחותך כהזמנה חוזרת. בדקו ועדכנו כמויות לפני שליחה כדי למנוע הזמנה כפולה.`;
}
