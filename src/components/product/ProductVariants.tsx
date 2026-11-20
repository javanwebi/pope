import React, { useMemo, useState } from 'react';
import { Check, FileText, Image as ImageIcon } from 'lucide-react';
import type { ProductGalleryImage, ProductVariant } from '../../types';
import { formatPrice, toPersianDigits } from '../../utils/formatters';
import { normalizeCatalogText } from '../../utils/excelCategoryCatalog';
import { getBeltSkuMedia, isExcludedBeltSku } from '../../utils/beltCatalogMedia';
import { ProductImage } from './ProductImage';
import { Modal } from '../ui/Modal';

interface ProductVariantsProps {
  variants: ProductVariant[];
  selected: string;
  onSelect: (code: string) => void;
  showPrices?: boolean;
  familyCode?: string;
  galleryImages?: ProductGalleryImage[];
}

export const ProductVariants: React.FC<ProductVariantsProps> = ({
  variants,
  selected,
  onSelect,
  showPrices = true,
  familyCode,
  galleryImages = [],
}) => {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [previewVariant, setPreviewVariant] = useState<ProductVariant | null>(null);

  const results = useMemo(() => {
    const q = normalizeCatalogText(query);
    if (!q) return variants;
    const tokens = q.split(' ').filter(Boolean);
    return variants.filter((v) => {
      const hay = normalizeCatalogText(
        `${v.code} ${v.size || ''} ${v.model || ''} ${v.name || ''} ${v.brand || ''}`,
      );
      return tokens.every((t) => hay.includes(t));
    });
  }, [variants, query]);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const getVariantLinkedImages = (v: ProductVariant): string[] => {
    const urls = new Set<string>();
    for (const u of v.images || []) {
      if (u && u.trim()) urls.add(u.trim());
    }
    for (const g of galleryImages) {
      if (g.scope === 'variant' && g.variantCode === v.code && g.url) {
        urls.add(g.url);
      }
    }
    return Array.from(urls);
  };

  if (!variants.length) return null;

  const previewSkuMedia =
    previewVariant && !isExcludedBeltSku(previewVariant.code)
      ? getBeltSkuMedia(familyCode, previewVariant.code, { variants })
      : null;

  return (
    <div className="space-y-3 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-sm font-black text-[#37383b]">انتخاب نوع، سایز و کد کالا</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            با انتخاب هر کد کالا، تصویر اختصاصی، مشخصات فنی و قیمت همان کد نمایش داده می‌شود.
          </p>
        </div>
        <span className="text-xs font-semibold text-slate-600">
          {toPersianDigits(variants.length)} کد کالا در این خانواده
        </span>
      </div>

      {variants.length > 3 && (
        <label className="block text-xs text-slate-600">
          جستجو در سایز، کد، مدل یا شرح کالا
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-[#E06518] focus:outline-none"
            placeholder="مثلاً 34265 یا Z18 یا 5*42"
          />
        </label>
      )}

      <div className="max-h-80 overflow-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs text-right border-collapse">
          <thead className="sticky top-0 bg-slate-100 text-slate-700 z-10 border-b border-slate-200">
            <tr>
              <th className="p-2.5 font-bold">کد کالا</th>
              <th className="p-2.5 font-bold">سایز / مدل</th>
              <th className="p-2.5 font-bold">شرح دقیق نوع کالا</th>
              <th className="p-2.5 font-bold">تصویر</th>
              <th className="p-2.5 font-bold">اطلاعات خرید</th>
              <th className="p-2.5 font-bold text-center">انتخاب</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {results.slice((safePage - 1) * pageSize, safePage * pageSize).map((v) => {
              const isSelected = selected === v.code;
              const linkedImages = getVariantLinkedImages(v);
              const unitPrice = v.price ?? v.prices?.retail ?? 0;
              const isInquiry = v.inquiryOnly !== undefined ? v.inquiryOnly : unitPrice <= 0;
              return (
                <tr
                  key={v.code}
                  onClick={() => onSelect(v.code)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-orange-50/90 hover:bg-orange-50' : 'hover:bg-slate-50/80 bg-white'
                  }`}
                >
                  <td className="p-2.5 font-mono font-bold text-slate-800 whitespace-nowrap" dir="ltr">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(v.code);
                        setPreviewVariant(v);
                      }}
                      className="rounded-md text-[#C65A16] underline decoration-dotted underline-offset-4 hover:text-[#9F4310] cursor-pointer"
                      aria-label={`نمایش تصویر کد کالا ${v.code}`}
                    >
                      {v.code}
                    </button>
                  </td>
                  <td className="p-2.5 text-slate-700" dir="auto">
                    <div className="font-semibold">{v.size || '—'}</div>
                    {v.model && (
                      <div className="text-[10.5px] font-mono text-slate-500 mt-0.5" dir="ltr">
                        {v.model}
                      </div>
                    )}
                  </td>
                  <td className="p-2.5 min-w-44 leading-6 text-slate-800">
                    <div className="font-medium">{v.name}</div>
                    {v.brand && <div className="text-[10.5px] text-slate-500">برند: {v.brand}</div>}
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    {linkedImages.length > 0 ? (
                      <div className="inline-flex items-center gap-1.5">
                        <div className="w-8 h-8 rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0">
                          <ProductImage
                            src={linkedImages[0]}
                            alt={v.name}
                            className="w-full h-full object-contain p-0.5"
                          />
                        </div>
                        {linkedImages.length > 1 && (
                          <span className="text-[10.5px] text-slate-500 font-medium">
                            +{toPersianDigits(linkedImages.length - 1)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10.5px] text-slate-400 inline-flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        <span>عمومی</span>
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 whitespace-nowrap">
                    {showPrices && !isInquiry && unitPrice > 0 ? (
                      <div>
                        <span className="font-mono font-bold text-emerald-800">
                          {formatPrice(unitPrice)}
                        </span>
                        <span className="text-[10.5px] text-slate-500 mr-1">تومان</span>
                      </div>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-700">
                        {showPrices ? 'نیازمند استعلام' : 'در پنل کاربری'}
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-center">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(v.code);
                      }}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors inline-flex items-center gap-1 cursor-pointer ${
                        isSelected
                          ? 'bg-[#E06518] border-[#E06518] text-white'
                          : 'border-orange-200 bg-white text-orange-700 hover:bg-orange-50'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>انتخاب‌شده</span>
                        </>
                      ) : (
                        <span>انتخاب {v.code}</span>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!results.length && (
          <p className="p-4 text-sm text-slate-500 text-center">کد یا سایز مطابق پیدا نشد.</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs pt-1">
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="disabled:opacity-40 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
          >
            قبلی
          </button>
          <span className="text-slate-600">
            صفحه {toPersianDigits(safePage)} از {toPersianDigits(totalPages)}
          </span>
          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="disabled:opacity-40 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
          >
            بعدی
          </button>
        </div>
      )}

      <Modal
        isOpen={Boolean(previewVariant)}
        onClose={() => setPreviewVariant(null)}
        title={previewVariant ? `تصویر و نقشه فنی کد ${previewVariant.code}` : ''}
        size="lg"
      >
        {previewVariant && (
          <div className="space-y-4">
            <div className="text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2 bg-slate-50 rounded-xl px-3.5 py-2.5 border border-slate-200">
              <span className="font-bold text-slate-800">{previewVariant.name}</span>
              <span className="font-mono font-bold text-[#E06518]" dir="ltr">
                {previewVariant.size || previewVariant.code}
              </span>
            </div>

            {previewSkuMedia ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#E06518]" />
                    <span>نقشه فنی پروفیل (CAD)</span>
                  </div>
                  <div className="aspect-[16/10] bg-slate-50 rounded-lg overflow-hidden grid place-items-center p-2">
                    {previewSkuMedia.profileDrawingWebp ? (
                      <ProductImage
                        src={previewSkuMedia.profileDrawingWebp}
                        alt={`نقشه پروفیل ${previewVariant.code}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-xs text-rose-700 px-4">
                        نقشه فنی متوقف‌شده (NEEDS_TECHNICAL_DATA — نیازمند اندازه‌گیری فیزیکی در انبار)
                      </div>
                    )}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
                  <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#E06518]" />
                    <span>تصویر واقعی محصول</span>
                  </div>
                  <div className="aspect-[16/10] bg-slate-50 rounded-lg overflow-hidden grid place-items-center p-2">
                    {previewSkuMedia.realProductImage ? (
                      <ProductImage
                        src={previewSkuMedia.realProductImage}
                        alt={previewVariant.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-center text-xs text-slate-500 px-4">
                        {previewSkuMedia.realImageStatusLabelFa}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="aspect-[16/9] max-h-80 bg-slate-50 rounded-xl border border-slate-200 grid place-items-center p-4">
                <ProductImage
                  src={getVariantLinkedImages(previewVariant)[0]}
                  alt={previewVariant.name}
                  className="max-h-72 w-full object-contain"
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};
