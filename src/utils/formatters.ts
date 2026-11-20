const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: number | string | undefined | null): string {
  if (input === undefined || input === null) return '';
  return input.toString().replace(/\d/g, (digit) => PERSIAN_DIGITS[parseInt(digit, 10)] ?? digit);
}

export function formatPrice(amount: number, showUnit = true): string {
  if (!amount || amount <= 0) return 'استعلام قیمت';
  const formatted = toPersianDigits(new Intl.NumberFormat('fa-IR').format(amount));
  return showUnit ? `${formatted} تومان` : formatted;
}

export function getStockStatus(stock: number) {
  if (stock <= 0) {
    return {
      text: 'ناموجود در انبار مرکزی',
      colorClass: 'text-[#DC2626] bg-red-50 border-red-200',
      badgeBg: '#DC2626',
      status: 'out_of_stock' as const,
    };
  }
  if (stock <= 5) {
    return {
      text: `تنها ${toPersianDigits(stock)} عدد باقی‌مانده`,
      colorClass: 'text-[#F59E0B] bg-amber-50 border-amber-200',
      badgeBg: '#F59E0B',
      status: 'low' as const,
    };
  }
  return {
    text: `موجود در انبار (${toPersianDigits(stock)} موجود)`,
    colorClass: 'text-[#16A34A] bg-emerald-50 border-emerald-200',
    badgeBg: '#16A34A',
    status: 'in_stock' as const,
  };
}
