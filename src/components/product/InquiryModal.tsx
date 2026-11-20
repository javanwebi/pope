import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Loader2, Send } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { useCatalog } from '../../context/CatalogContext';
import { toPersianDigits } from '../../utils/formatters';

export const InquiryModal: React.FC = () => {
  const { inquiryTarget, closeInquiryModal } = useCatalog();
  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [customerNote, setCustomerNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  useEffect(() => {
    if (!inquiryTarget) return;
    setQuantity(Math.max(1, inquiryTarget.quantity || 1));
    setCustomerNote(inquiryTarget.notes || '');
    setError('');
    setSubmittedId(null);
  }, [inquiryTarget]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inquiryTarget) return;
    if (!customerName.trim() || !phone.trim()) {
      setError('لطفاً نام و شماره تماس معتبر خود را وارد کنید.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName.trim(),
          companyName: companyName.trim() || undefined,
          phone: phone.trim(),
          productCode: inquiryTarget.code,
          productName: inquiryTarget.name,
          quantity: Math.max(1, Number(quantity) || 1),
          unit: inquiryTarget.unit || 'عدد',
          customerNote: customerNote.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || 'ثبت درخواست استعلام انجام نشد.');
      }
      setSubmittedId(data.inquiry?.id || 'INQ-SAVED');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ارتباط با سرور');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(inquiryTarget)}
      onClose={closeInquiryModal}
      title="ثبت درخواست قیمت و استعلام موجودی"
      size="md"
    >
      {inquiryTarget && submittedId ? (
        <div className="space-y-4 py-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-base font-black text-[#2B313A]">درخواست استعلام شما با موفقیت ثبت شد</h4>
            <p className="text-xs text-slate-600 leading-6">
              شماره پیگیری: <strong className="font-mono text-[#E06518]" dir="ltr">{submittedId}</strong>
            </p>
            <p className="text-[11.5px] text-slate-500 leading-6">
              کارشناسان فروش بازرگانی صنعت پیش پس از بررسی موجودی و قیمت روز کد{' '}
              <strong className="font-mono" dir="ltr">{inquiryTarget.code}</strong> با شما تماس می‌گیرند.
            </p>
          </div>
          <button
            type="button"
            onClick={closeInquiryModal}
            className="inline-flex items-center justify-center rounded-xl bg-[#E06518] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#c95210] transition-colors cursor-pointer"
          >
            بستن و ادامه بررسی کاتالوگ
          </button>
        </div>
      ) : inquiryTarget ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-xl border border-orange-200/80 bg-orange-50/60 p-3.5 space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-bold text-[#b84d0e]">
                <FileSpreadsheet className="h-4 w-4" />
                <span>مشخصات کالای انتخاب‌شده</span>
              </span>
              <span className="font-mono font-bold text-[#2B313A]" dir="ltr">
                {inquiryTarget.code}
              </span>
            </div>
            <p className="text-xs font-bold text-slate-800 leading-6">{inquiryTarget.name}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="space-y-1">
              <span className="font-bold text-slate-700 block">نام و نام خانوادگی *</span>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="مثلاً مهدی رضایی"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs focus:border-[#E06518] focus:outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="font-bold text-slate-700 block">شماره تماس *</span>
              <input
                type="tel"
                required
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0913..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs text-left font-mono focus:border-[#E06518] focus:outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="font-bold text-slate-700 block">نام واحد صنعتی / شرکت</span>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="اختیاری"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs focus:border-[#E06518] focus:outline-none"
              />
            </label>

            <label className="space-y-1">
              <span className="font-bold text-slate-700 block">
                تعداد درخواستی ({inquiryTarget.unit || 'عدد'})
              </span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-mono focus:border-[#E06518] focus:outline-none"
              />
            </label>
          </div>

          <label className="space-y-1 block text-xs">
            <span className="font-bold text-slate-700 block">توضیحات فنی یا شرایط تحویل</span>
            <textarea
              rows={3}
              value={customerNote}
              onChange={(e) => setCustomerNote(e.target.value)}
              placeholder="در صورت نیاز به برش عرض خاص، آپارات، یا برند جایگزین یادداشت بگذارید..."
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-[#E06518] focus:outline-none"
            />
          </label>

          {error && (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-500">
              تعداد: <strong>{toPersianDigits(quantity)}</strong> {inquiryTarget.unit || 'عدد'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeInquiryModal}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E06518] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#c95210] disabled:opacity-60 cursor-pointer transition-colors"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span>ثبت نهایی استعلام</span>
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </Modal>
  );
};
