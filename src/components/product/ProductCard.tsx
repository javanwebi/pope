import React from 'react';
import { Link } from 'react-router-dom';
import { Layers, ShoppingCart } from 'lucide-react';
import type { Product } from '../../types';
import { useCatalog } from '../../context/CatalogContext';
import { ProductImage } from './ProductImage';
import { formatPrice, toPersianDigits } from '../../utils/formatters';
import { resolveDisplayBrand } from '../../utils/catalogBrands';
import { resolveSiteProductImage } from '../../utils/siteProductImages';
import { getBeltFamilyMedia } from '../../utils/beltCatalogMedia';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { panelMode } = useCatalog();
  const brandLabel = resolveDisplayBrand(product.brand, product.name);
  const beltMedia = getBeltFamilyMedia(
    product.code,
    product.images?.[0] || product.image,
    { variants: product.variants, legacyFamilyCodes: product.legacyFamilyCodes },
  );
  const imageSrc =
    beltMedia?.primaryThumbnail ||
    product.images?.[0] ||
    product.image ||
    resolveSiteProductImage(product, `${product.subcategory} ${product.categoryName}`);

  const skuCount = product.variants?.length || (product as { variantCount?: number }).variantCount || 0;
  const retailPrice = product.prices?.retail || 0;
  const href = panelMode
    ? `/consumer-dashboard/product/${encodeURIComponent(product.code)}`
    : `/product/${encodeURIComponent(product.code)}`;

  const topSpec = product.technicalSpecs?.slice(0, 2) || [];

  return (
    <article
      dir="rtl"
      className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-[#e6dfd5] bg-white shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#eab086] hover:shadow-md"
    >
      <Link
        to={href}
        className="relative flex h-44 items-center justify-center border-b border-[#f3eee7] bg-white p-4 overflow-hidden"
      >
        <ProductImage
          src={imageSrc}
          alt={product.name}
          loading="lazy"
          className="max-h-36 w-full object-contain transition-transform duration-300 group-hover:scale-105"
        />
        {brandLabel && (
          <span className="absolute top-2.5 right-2.5 rounded-md border border-slate-200 bg-white/95 px-2 py-0.5 text-[10px] font-black text-slate-700 shadow-2xs">
            {brandLabel}
          </span>
        )}
        {skuCount > 0 && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full border border-orange-200 bg-orange-50/95 px-2 py-0.5 text-[10px] font-bold text-[#c25111]">
            <Layers className="w-3 h-3" />
            <span>{toPersianDigits(skuCount)} کد</span>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col justify-between gap-2.5 p-3.5 text-right">
        <div className="space-y-1.5">
          <Link
            to={href}
            className="block text-xs sm:text-[13px] font-black text-[#2B313A] hover:text-[#E06518] leading-6 line-clamp-2"
          >
            {product.name}
          </Link>
          {topSpec.length > 0 && (
            <p className="text-[11px] text-slate-500 line-clamp-1">
              {topSpec.map((s) => `${s.key}: ${s.value}`).join(' | ')}
            </p>
          )}
        </div>

        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1.5 font-bold text-amber-700">
              <span className="h-2 w-2 rounded-full bg-[#E06518]" />
              <span>آماده تأمین ({toPersianDigits(Math.max(1, skuCount))} کد)</span>
            </span>
            {panelMode && !product.inquiryOnly && retailPrice > 0 ? (
              <span className="font-mono font-black text-emerald-700">
                {formatPrice(retailPrice)} <small className="font-sans font-normal">تومان</small>
              </span>
            ) : (
              <span className="font-bold text-[#E06518]">مشاهده قیمت در پنل</span>
            )}
          </div>

          <Link
            to={href}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#E06518] py-2 text-xs font-bold text-white hover:bg-[#c85612] transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>انتخاب سایز و خرید</span>
          </Link>

          <div className="flex items-center justify-between gap-2 text-[10.5px] text-slate-400 border-t border-slate-100 pt-2">
            <span className="shrink-0">{product.categoryName || 'قطعات صنعتی'}</span>
            <span className="font-mono font-bold text-slate-500 truncate" dir="ltr">
              {brandLabel ? `${brandLabel} · ` : ''}
              <bdi dir="ltr">{product.code}</bdi>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
};
