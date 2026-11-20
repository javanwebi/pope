import React from 'react';
import { CheckCircle2, Layers, ShieldCheck, Tag, ZoomIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BeltFamilyMedia, BeltSkuMedia } from '../../utils/beltCatalogMedia';
import { toPersianDigits } from '../../utils/formatters';

export interface BeltDocModalPayload {
  title: string;
  webpUrl: string;
  svgUrl: string;
  subtitle?: string;
}

interface BeltVisualMediaSectionProps {
  productName: string;
  beltFamilyMedia: BeltFamilyMedia;
  beltSkuMedia: BeltSkuMedia | null;
  selectedSkuSize?: string;
  selectedSkuName?: string;
  onOpenDocModal: (payload: BeltDocModalPayload) => void;
  onJumpToFamilyGallery?: () => void;
}

export const BeltVisualMediaSection: React.FC<BeltVisualMediaSectionProps> = ({
  productName,
  beltFamilyMedia,
  beltSkuMedia,
  selectedSkuSize,
  selectedSkuName,
  onOpenDocModal,
}) => {
  const familySlots = [
    {
      id: 'fam-img-1',
      slotCode: '01-main',
      url: beltFamilyMedia.familyPhotos[0],
      label: 'نمای کلی تسمه',
      caption: 'نمای اصلی و فرم کامل حلقه/رول تسمه',
    },
    {
      id: 'fam-img-2',
      slotCode: '02-angle',
      url: beltFamilyMedia.familyPhotos[1],
      label: 'نمای زاویه و پروفیل',
      caption: 'زاویه جانبی، دندانه یا شیارهای استاندارد',
    },
    {
      id: 'fam-img-3',
      slotCode: '03-detail',
      url: beltFamilyMedia.familyPhotos[2],
      label: 'بافت، لایه و کورد',
      caption: 'جزئیات مقطع، کورد کششی و ساختار بدنه',
    },
    {
      id: 'fam-img-4',
      slotCode: '04-closeup',
      url: beltFamilyMedia.familyPhotos[3],
      label: 'نمای نزدیک بدنه',
      caption: 'کیفیت سطح، چاپ و پرداخت صنعتی تسمه',
    },
  ];

  const availableFamilySlots = familySlots.filter((s) => Boolean(s.url));
  const familyProvenanceFa =
    beltFamilyMedia.familyPhotoMatchType === 'EXACT_BRAND'
      ? 'عکس‌های واقعی اختصاصی برند'
      : beltFamilyMedia.familyPhotoMatchType === 'HYBRID_EXACT_AND_PROFILE'
        ? 'عکس واقعی برند + تکمیل ۴ زاویه هم‌پروفیل'
        : '۴ زاویه واقعی هم‌پروفیل بدون واترمارک';

  return (
    <section
      dir="rtl"
      aria-label="گالری ۴تصویری خانواده و تصویر اختصاصی کد کالا"
      className="space-y-5"
    >
      {/* Part 1: 4 Real Belt Photos for the Family (Zero-Pill Overlay Rule, Zero CAD Drawings) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
          <div className="space-y-0.5">
            <h2 className="text-sm sm:text-base font-black text-[#2B313A] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#E06518]" />
              <span>گالری ۴تصویری واقعی خانواده محصول</span>
            </h2>
            <p className="text-xs text-slate-500">
              {productName} ·{' '}
              <span className="font-semibold text-slate-600">{familyProvenanceFa}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="font-bold text-[#2B313A]">
              {toPersianDigits(availableFamilySlots.length)} تصویر واقعی
            </span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <Link
              to="/belt-audit"
              className="inline-flex items-center gap-1 font-bold text-slate-600 hover:text-[#E06518] transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>گزارش اصالت کاتالوگ</span>
            </Link>
          </div>
        </div>

        <div
          data-testid="family-4photo-grid"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3.5"
        >
          {availableFamilySlots.map((card, idx) => (
            <button
              key={card.id}
              type="button"
              onClick={() =>
                onOpenDocModal({
                  title: `${card.label} — ${productName}`,
                  webpUrl: card.url!,
                  svgUrl: card.url!,
                  subtitle: `${card.caption} · ${familyProvenanceFa}`,
                })
              }
              aria-label={`بزرگ‌نمایی ${card.label} خانواده ${productName}`}
              className="group rounded-2xl border border-slate-200/90 bg-white overflow-hidden text-right hover:border-[#E06518] hover:shadow-md transition-all cursor-pointer flex flex-col"
            >
              <div className="relative aspect-[4/3] w-full bg-[#FAF8F5] p-3 flex items-center justify-center overflow-hidden border-b border-slate-100">
                <img
                  src={card.url!}
                  alt={`${card.label} — ${productName}`}
                  loading="lazy"
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                />
                <span className="absolute top-2.5 left-2.5 rounded-lg bg-slate-900/70 text-white p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="p-3 space-y-0.5 bg-white flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-black text-[#2B313A]">{card.label}</span>
                  <span className="font-mono text-[10px] text-slate-400" dir="ltr">
                    0{idx + 1}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 leading-5">{card.caption}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Part 2: Dedicated Selected SKU Belt Photo (With Printed Code & Specs — Zero CAD Drawings) */}
      {beltSkuMedia && (
        <div
          data-testid="sku-labeled-belt-section"
          className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div className="space-y-0.5">
              <h2 className="text-sm sm:text-base font-black text-[#2B313A] flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#E06518]" />
                <span>
                  تصویر اختصاصی تسمه با درج مشخصات کد{' '}
                  <bdi dir="ltr" className="font-mono text-[#E06518]">
                    {beltSkuMedia.skuCode}
                  </bdi>
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {selectedSkuName || productName}
                {selectedSkuSize ? (
                  <>
                    {' '}·{' '}
                    <span className="font-mono text-slate-700" dir="ltr">
                      {selectedSkuSize}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 font-bold ${
                  beltSkuMedia.skuImageSourceType === 'EXACT_WEB_VERIFIED'
                    ? 'text-emerald-700'
                    : 'text-[#c25111]'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {beltSkuMedia.skuImageSourceType === 'EXACT_WEB_VERIFIED'
                    ? 'عکس واقعی مارکینگ کارخانه (وب)'
                    : 'چاپ اختصاصی برند، ابعاد و کد روی بدنه تسمه'}
                </span>
              </span>
            </div>
          </div>

          <div
            className={`grid gap-4 items-stretch ${
              beltSkuMedia.realProductCloseupImage
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]'
            }`}
          >
            {/* Primary SKU Labeled Belt Image */}
            <button
              type="button"
              onClick={() =>
                onOpenDocModal({
                  title: `تصویر اختصاصی تسمه — کد ${beltSkuMedia.skuCode}`,
                  webpUrl: beltSkuMedia.realProductImage,
                  svgUrl: beltSkuMedia.realProductImage,
                  subtitle: `${selectedSkuName || productName} · ${beltSkuMedia.realImageStatusLabelFa}`,
                })
              }
              aria-label={`بزرگ‌نمایی تصویر اختصاصی تسمه کد ${beltSkuMedia.skuCode}`}
              className="group relative flex flex-col rounded-2xl border border-slate-200/90 bg-white overflow-hidden hover:border-[#E06518] hover:shadow-md transition-all cursor-zoom-in text-right"
            >
              <div className="relative aspect-[16/10] w-full flex items-center justify-center p-4 bg-[#FAF8F5]">
                <img
                  src={beltSkuMedia.realProductImage}
                  alt={`تصویر اختصاصی تسمه کد ${beltSkuMedia.skuCode} با درج مشخصات روی بدنه`}
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                />
                <span className="absolute top-3 left-3 rounded-lg bg-slate-900/75 text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-4 h-4" />
                </span>
              </div>
              <div className="px-4 py-3 border-t border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-black text-[#2B313A]">
                  {beltSkuMedia.skuImageSourceType === 'EXACT_WEB_VERIFIED'
                    ? 'نمای کامل روبه‌رو با مارکینگ واقعی کارخانه'
                    : `نمای اختصاصی تسمه کد ${toPersianDigits(beltSkuMedia.skuCode)}`}
                </span>
                <span className="font-mono text-[11px] text-slate-500" dir="ltr">
                  SKU: {beltSkuMedia.skuCode}
                </span>
              </div>
            </button>

            {/* Either Verified Macro Close-up (if web-verified pair exists) OR Crisp Spec Provenance Summary */}
            {beltSkuMedia.realProductCloseupImage ? (
              <button
                type="button"
                onClick={() =>
                  onOpenDocModal({
                    title: `کلوزآپ مارکینگ همان تسمه — کد ${beltSkuMedia.skuCode}`,
                    webpUrl: beltSkuMedia.realProductCloseupImage!,
                    svgUrl: beltSkuMedia.realProductCloseupImage!,
                    subtitle: `${selectedSkuName || productName} · نمای نزدیک مارکینگ چاپ‌شده کارخانه`,
                  })
                }
                aria-label={`بزرگ‌نمایی کلوزآپ مارکینگ کد ${beltSkuMedia.skuCode}`}
                className="group relative flex flex-col rounded-2xl border border-slate-200/90 bg-white overflow-hidden hover:border-[#E06518] hover:shadow-md transition-all cursor-zoom-in text-right"
              >
                <div className="relative aspect-[16/10] w-full flex items-center justify-center p-4 bg-[#FAF8F5]">
                  <img
                    src={beltSkuMedia.realProductCloseupImage}
                    alt={`کلوزآپ مارکینگ چاپ‌شده روی تسمه کد ${beltSkuMedia.skuCode}`}
                    className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                  />
                  <span className="absolute top-3 left-3 rounded-lg bg-slate-900/75 text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ZoomIn className="w-4 h-4" />
                  </span>
                </div>
                <div className="px-4 py-3 border-t border-slate-100 bg-white flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-black text-[#2B313A]">کلوزآپ مارکینگ همان تسمه</span>
                  <span className="font-mono text-[11px] text-emerald-700 font-bold" dir="ltr">
                    EXACT_WEB_VERIFIED
                  </span>
                </div>
              </button>
            ) : (
              <div className="rounded-2xl border border-slate-200/90 bg-[#FAF8F5] p-5 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="text-xs font-black text-[#2B313A]">
                    مشخصات درج‌شده روی بدنه تسمه
                  </div>
                  <p className="text-xs text-slate-600 leading-6">
                    روی این تصویر استودیویی دقیقاً برند، پروفیل مقطع، ابعاد اسمی و کد کالای{' '}
                    <strong className="font-mono text-[#E06518]" dir="ltr">
                      SKU:{beltSkuMedia.skuCode}
                    </strong>{' '}
                    مطابق اطلاعات ثبت‌شده در انبار صنعت پیش چاپ شده است تا هنگام بررسی و سفارش هیچ خطایی بین سایزهای مشابه رخ ندهد.
                  </p>
                </div>
                <div className="pt-3 border-t border-slate-200/80 space-y-1.5 text-[11px] text-slate-500">
                  <div className="flex items-center justify-between gap-2">
                    <span>وضعیت منبع تصویر</span>
                    <span className="font-mono font-bold text-slate-700" dir="ltr">
                      {beltSkuMedia.skuImageSourceType}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span>وضعیت مجوز نمایش</span>
                    <span className="font-mono font-bold text-emerald-700" dir="ltr">
                      {beltSkuMedia.licenseStatus}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
