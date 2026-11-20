import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  Copy,
  FileSpreadsheet,
  Heart,
  Layers,
  PackageCheck,
  PhoneCall,
  Share2,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Truck,
  ZoomIn,
} from 'lucide-react';
import type { Product, ProductGalleryImage } from '../types';
import { useCatalog } from '../context/CatalogContext';
import { ProductImage } from '../components/product/ProductImage';
import { ProductVariants } from '../components/product/ProductVariants';
import { ProductCard } from '../components/product/ProductCard';
import {
  BeltVisualMediaSection,
  type BeltDocModalPayload,
} from '../components/product/BeltVisualMediaSection';
import { Modal } from '../components/ui/Modal';
import { formatPrice, toPersianDigits } from '../utils/formatters';
import { resolveDisplayBrand } from '../utils/catalogBrands';
import { resolveSiteProductImage } from '../utils/siteProductImages';
import {
  buildBeltGalleryImages,
  getBeltFamilyMedia,
  getBeltSkuMedia,
  isExcludedBeltSku,
} from '../utils/beltCatalogMedia';
import type { TechnicalReviewPayload } from '../utils/partMeasurements';

type ProductDetailResponse = {
  success: boolean;
  product: Product;
  categoryMeta?: { slug: string; name: string };
  similarProducts?: Product[];
};

function buildDefaultGalleryImages(product: Product): ProductGalleryImage[] {
  if (product.galleryImages && product.galleryImages.length > 0) {
    return product.galleryImages;
  }
  return (product.images || []).map((url, idx) => ({
    id: `fam-default-${idx}`,
    url,
    scope: 'family' as const,
    title: product.name,
    order: idx + 1,
  }));
}

export const ProductDetailPage: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const decodedCode = decodeURIComponent(code).trim();

  const {
    panelMode,
    addToCart,
    toggleWishlist,
    isInWishlist,
    openInquiryModal,
  } = useCatalog();

  const isPortalRoute =
    location.pathname.startsWith('/consumer-dashboard/') ||
    location.pathname.startsWith('/account/');
  const showCommercial = panelMode || isPortalRoute;

  const [detail, setDetail] = useState<ProductDetailResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [selectedVariantCode, setSelectedVariantCode] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectorOpen, setSelectorOpen] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'specs' | 'catalogue' | 'delivery'>('specs');
  const [beltDocModal, setBeltDocModal] = useState<BeltDocModalPayload | null>(null);
  const [lazyReviews, setLazyReviews] = useState<Record<string, TechnicalReviewPayload | null>>({});

  const pendingVariantFocusRef = useRef<string | null>(null);
  const gallerySectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!decodedCode) {
      setStatus('not-found');
      return;
    }
    const controller = new AbortController();
    let mounted = true;
    setStatus('loading');

    fetch(`/api/catalog/product/${encodeURIComponent(decodedCode)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 404) {
          if (mounted) setStatus('not-found');
          return null;
        }
        if (!res.ok) throw new Error('Product fetch failed');
        return (await res.json()) as ProductDetailResponse;
      })
      .then((json) => {
        if (!mounted || !json?.product) return;
        setDetail(json);
        setStatus('ready');
      })
      .catch((err) => {
        if (!mounted || (err instanceof Error && err.name === 'AbortError')) return;
        setStatus('error');
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [decodedCode]);

  const product = detail?.product;
  const visibleVariants = useMemo(
    () => (product?.variants || []).filter((v) => v.active !== false),
    [product],
  );

  // Sync initial selected SKU from ?sku= query param, URL code, or first variant
  useEffect(() => {
    if (!product) return;
    const searchParams = new URLSearchParams(location.search);
    const querySku = (searchParams.get('sku') || searchParams.get('variant') || '').trim().toLowerCase();
    const lowerDecoded = decodedCode.toLowerCase();
    const aliasSkuHint = lowerDecoded.replace(/^fam-/i, '');
    const matched =
      (querySku ? visibleVariants.find((v) => v.code.toLowerCase() === querySku) : undefined) ||
      visibleVariants.find((v) => v.code.toLowerCase() === lowerDecoded) ||
      visibleVariants.find((v) => v.code.toLowerCase() === aliasSkuHint);
    const initial = matched?.code || visibleVariants[0]?.code || '';
    setSelectedVariantCode(initial);
    pendingVariantFocusRef.current = initial || null;
    setQuantity(1);
  }, [decodedCode, location.search, product?.code, visibleVariants]);

  const galleryImages = useMemo(() => {
    if (!product) return [];
    const baseImgs = buildDefaultGalleryImages(product);
    return buildBeltGalleryImages(product, baseImgs, selectedVariantCode);
  }, [product, selectedVariantCode]);

  // Focus gallery to newly selected SKU CAD/photo
  useEffect(() => {
    if (!galleryImages.length) {
      setActiveImageIndex(0);
      return;
    }
    const pending = pendingVariantFocusRef.current;
    if (pending) {
      pendingVariantFocusRef.current = null;
      const realIdx = galleryImages.findIndex(
        (img) => img.scope === 'variant' && img.variantCode === pending,
      );
      if (realIdx >= 0) {
        setActiveImageIndex(realIdx);
        return;
      }
      const famIdx = galleryImages.findIndex((img) => img.scope === 'family');
      setActiveImageIndex(famIdx >= 0 ? famIdx : 0);
      return;
    }
    if (activeImageIndex >= galleryImages.length) {
      setActiveImageIndex(0);
    }
  }, [galleryImages, activeImageIndex]);

  // Lazy load technical review for selected variant
  useEffect(() => {
    if (activeTab !== 'specs' || !selectedVariantCode) return;
    const selected = visibleVariants.find((v) => v.code === selectedVariantCode);
    if (
      !selected ||
      selected.technicalReview ||
      Object.prototype.hasOwnProperty.call(lazyReviews, selectedVariantCode)
    ) {
      return;
    }
    const controller = new AbortController();
    fetch(`/api/catalog/variant-review/${encodeURIComponent(selectedVariantCode)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!controller.signal.aborted) {
          setLazyReviews((prev) => ({
            ...prev,
            [selectedVariantCode]: data?.success ? (data.technicalReview ?? null) : null,
          }));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLazyReviews((prev) => ({ ...prev, [selectedVariantCode]: null }));
        }
      });
    return () => controller.abort();
  }, [activeTab, selectedVariantCode, visibleVariants, lazyReviews]);

  const handleSelectVariant = (newCode: string) => {
    setSelectedVariantCode(newCode);
    setQuantity(1);
    pendingVariantFocusRef.current = newCode;
  };

  const handleSelectImage = (idx: number) => {
    setActiveImageIndex(idx);
    const clicked = galleryImages[idx];
    if (clicked?.scope === 'variant' && clicked.variantCode) {
      if (visibleVariants.some((v) => v.code === clicked.variantCode)) {
        setSelectedVariantCode(clicked.variantCode);
      }
    }
  };

  if (status === 'loading') {
    return (
      <div className="product-detail-loading product-detail-premium-state" role="status" dir="rtl">
        <span className="product-detail-loading-spinner" aria-hidden="true" />
        <h2>در حال دریافت اطلاعات قطعه</h2>
        <p>کاتالوگ و مشخصات فنی از پایگاه داده صنعت پیش بارگذاری می‌شود.</p>
      </div>
    );
  }

  if (status === 'not-found' || status === 'error' || !product) {
    return (
      <div
        dir="rtl"
        className="bg-white rounded-3xl border border-slate-200 p-10 text-center space-y-4 max-w-xl mx-auto my-12 shadow-xs"
      >
        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-black text-[#2B313A]">کالای مورد نظر یافت نشد</h2>
        <p className="text-xs text-slate-500 leading-6">
          کد کالای وارد شده در کاتالوگ جامع قطعات ثبت نشده است یا موقتاً غیرفعال شده است.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            to="/products"
            className="inline-flex px-5 py-2.5 bg-[#E06518] text-white text-xs font-bold rounded-xl hover:bg-[#c85612]"
          >
            بازگشت به کاتالوگ محصولات
          </Link>
          <Link
            to="/categories"
            className="inline-flex px-5 py-2.5 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50"
          >
            دسته‌بندی قطعات
          </Link>
        </div>
      </div>
    );
  }

  const selectedVariant =
    visibleVariants.find((v) => v.code === selectedVariantCode) || visibleVariants[0];
  const activeSkuCode = selectedVariant?.code || product.code;
  const activeUnitPrice =
    selectedVariant?.price ?? selectedVariant?.prices?.retail ?? product.prices?.retail ?? 0;
  const isSelectedInquiryOnly = selectedVariant
    ? selectedVariant.inquiryOnly !== undefined
      ? selectedVariant.inquiryOnly
      : activeUnitPrice <= 0
    : product.inquiryOnly || activeUnitPrice <= 0;
  const isStockKnown = selectedVariant
    ? selectedVariant.stockKnown !== undefined
      ? selectedVariant.stockKnown
      : typeof selectedVariant.stock === 'number' && !isSelectedInquiryOnly
    : product.stockKnown !== false;
  const activeStockCount = selectedVariant ? (selectedVariant.stock ?? 0) : (product.stock ?? 0);

  const activeBrand = resolveDisplayBrand(
    selectedVariant?.brand || product.brand,
    selectedVariant?.name || product.name,
  );
  const activeUnit = selectedVariant?.unit || product.unit || 'عدد';
  const activeVariantSpecs = selectedVariant?.technicalSpecs || [];
  const selectedTechnicalReview =
    (selectedVariant?.technicalReview as TechnicalReviewPayload | undefined) ||
    lazyReviews[activeSkuCode];

  const beltHints = {
    variants: product.variants,
    legacyFamilyCodes: product.legacyFamilyCodes,
  };
  const beltFamilyMedia = getBeltFamilyMedia(
    product.code,
    product.images?.[0] || product.image,
    beltHints,
  );
  const beltSkuMedia =
    beltFamilyMedia && !isExcludedBeltSku(activeSkuCode)
      ? getBeltSkuMedia(product.code, activeSkuCode, beltHints)
      : null;

  const currentGalleryImage = galleryImages[activeImageIndex];
  const activeImageUrl =
    currentGalleryImage?.url ||
    beltFamilyMedia?.primaryThumbnail ||
    product.images?.[0] ||
    product.image ||
    resolveSiteProductImage(product, `${product.subcategory} ${product.categoryName}`);

  const categorySlug = detail?.categoryMeta?.slug || product.resolvedAssignment?.categorySlug || product.categorySlug;
  const categoryTitle = detail?.categoryMeta?.name || product.categoryName || 'قطعات صنعتی';
  const displayTitle = selectedVariant?.name || product.name;
  const isFavorited = isInWishlist(product.code);
  const similarProducts = detail?.similarProducts || [];

  const copyProductCode = () => {
    navigator.clipboard?.writeText(activeSkuCode).catch(() => {});
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  const shareCurrentLink = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1800);
  };

  const handleAddToCart = () => {
    if (isSelectedInquiryOnly || activeUnitPrice <= 0) {
      openInquiryModal({
        code: activeSkuCode,
        name: displayTitle,
        unit: activeUnit,
        quantity,
      });
      return;
    }
    const cartProduct: Product = {
      ...product,
      code: activeSkuCode,
      name: displayTitle,
      brand: activeBrand || product.brand,
      unit: activeUnit,
      prices: {
        base: activeUnitPrice,
        retail: activeUnitPrice,
        wholesale: activeUnitPrice,
        dealer: activeUnitPrice,
      },
      images: [activeImageUrl],
    };
    addToCart(cartProduct, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  };

  return (
    <div className="product-detail-premium" dir="rtl">
      <div className="space-y-6">
        {/* Breadcrumb + Share Bar */}
        <div className="product-detail-breadcrumb-row flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <nav className="product-detail-breadcrumbs flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
            <Link to="/">صفحه اصلی</Link>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            <Link to="/categories">دسته‌بندی‌ها</Link>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            {categorySlug && (
              <>
                <Link to={`/category/${encodeURIComponent(categorySlug)}`}>{categoryTitle}</Link>
                <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
              </>
            )}
            <span className="font-bold text-[#2B313A]">{product.name}</span>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 text-xs font-bold text-slate-600 hover:text-[#E06518] cursor-pointer"
            >
              <span>بازگشت</span>
            </button>
            <button
              type="button"
              onClick={shareCurrentLink}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-xs font-bold text-slate-600 hover:text-[#E06518] cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedLink ? 'لینک کپی شد' : 'اشتراک‌گذاری'}</span>
            </button>
          </div>
        </div>

        {/* Main Card Matching Screenshot 5 */}
        <section className="product-detail-main space-y-5">
          {/* Top Metadata Line + Stock Badge */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-2">
              <span>
                خانواده:{' '}
                <strong className="font-mono text-slate-800" dir="ltr">
                  {product.code}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                کد کالای انتخاب‌شده:{' '}
                <strong className="font-mono text-[#E06518]" dir="ltr">
                  {toPersianDigits(activeSkuCode)}
                </strong>
              </span>
              {activeBrand && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    برند: <strong className="text-slate-800">{activeBrand}</strong>
                  </span>
                </>
              )}
              {selectedVariant?.model && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    مدل:{' '}
                    <strong className="font-mono text-slate-800" dir="ltr">
                      {selectedVariant.model}
                    </strong>
                  </span>
                </>
              )}
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <span
                className={`w-2 h-2 rounded-full ${
                  isStockKnown && activeStockCount > 0 ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              <span>
                {isStockKnown && activeStockCount > 0
                  ? `موجود در انبار (${toPersianDigits(activeStockCount)} ${activeUnit})`
                  : 'موجودی نیازمند استعلام'}
              </span>
            </div>
          </div>

          {/* Product Family & Active SKU Title Header (Screenshot 5 Top) */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-slate-500">
              خانواده محصول: <span className="text-slate-700 font-bold">{product.name}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#2B313A] leading-snug">
              {displayTitle}
            </h1>
            {selectedVariant?.size && (
              <p className="text-xs sm:text-sm font-bold text-[#E06518]">
                سایز / مشخصه فنی کد {toPersianDigits(activeSkuCode)}:{' '}
                <span className="font-mono" dir="ltr">
                  {selectedVariant.size}
                </span>
              </p>
            )}

            {/* 3-Cell Summary Bar (Screenshot 5) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 rounded-2xl border border-slate-200/90 bg-[#FAF8F5] px-4 py-3 text-xs">
              <div className="flex items-center justify-between sm:justify-start gap-2">
                <span className="text-slate-500">برند سازنده:</span>
                <strong className="text-[#2B313A] font-black">{activeBrand || 'متفرقه صنعتی'}</strong>
              </div>
              <div className="flex items-center justify-between sm:justify-center gap-2 sm:border-r sm:border-l sm:border-slate-200 sm:px-4">
                <span className="text-slate-500">گروه فنی:</span>
                <strong className="text-[#2B313A] font-black">{categoryTitle}</strong>
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2">
                <span className="text-slate-500">تنوع سایز / مدل:</span>
                <strong className="text-[#E06518] font-black">
                  {toPersianDigits(Math.max(1, visibleVariants.length))} کد فنی
                </strong>
              </div>
            </div>
          </div>

          {/* 2-Column Workspace: Right = Gallery/CAD, Left = SKU Selector & Purchase Card (Screenshot 5) */}
          <div className="product-detail-layout grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-6 items-start">
            {/* Column 1 (Right in RTL): Gallery & CAD Viewer */}
            <div ref={gallerySectionRef} className="product-detail-gallery lg:sticky lg:top-28 space-y-3">
              <div className="product-detail-image relative rounded-2xl border border-slate-200 bg-white overflow-hidden">
                {/* Top-right orange badge + Top-left image counter */}
                <div className="absolute top-3 inset-x-3 z-10 flex items-center justify-between gap-2 pointer-events-none">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#E06518] px-3 py-1 text-[11px] font-bold text-white shadow-xs">
                    {currentGalleryImage?.scope === 'variant' && currentGalleryImage.variantCode
                      ? `تصویر کد ${toPersianDigits(currentGalleryImage.variantCode)}`
                      : 'تصویر خانواده محصول'}
                  </span>
                  {galleryImages.length > 0 && (
                    <span className="rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs">
                      {toPersianDigits(activeImageIndex + 1)} از {toPersianDigits(galleryImages.length)}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setBeltDocModal({
                      title: currentGalleryImage?.title || displayTitle,
                      webpUrl: activeImageUrl,
                      svgUrl: activeImageUrl,
                      subtitle: selectedVariant?.size || product.name,
                    })
                  }
                  aria-label="بزرگ‌نمایی تصویر تسمه"
                  className="w-full h-full flex items-center justify-center p-6 pt-12 pb-12 cursor-zoom-in"
                >
                  <ProductImage
                    src={activeImageUrl}
                    alt={currentGalleryImage?.title || displayTitle}
                    disableFallback={Boolean(beltFamilyMedia)}
                    className="w-full h-full object-contain"
                  />
                </button>

                {/* Bottom Dark Caption Bar */}
                <div className="absolute bottom-2.5 inset-x-3 z-10 flex items-center justify-between gap-2 rounded-xl bg-[#2B313A] px-3.5 py-2 text-[11px] font-bold text-white">
                  <span className="truncate">
                    {currentGalleryImage?.title || `تصویر اختصاصی کد ${toPersianDigits(activeSkuCode)}`}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setBeltDocModal({
                        title: currentGalleryImage?.title || displayTitle,
                        webpUrl: activeImageUrl,
                        svgUrl: activeImageUrl,
                        subtitle: selectedVariant?.size || product.name,
                      })
                    }
                    className="inline-flex items-center gap-1 text-orange-300 hover:text-white shrink-0 cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>بزرگ‌نمایی</span>
                  </button>
                </div>
              </div>

              {/* Clean Provenance Status */}
              {beltSkuMedia ? (
                <p
                  role="status"
                  className={`text-xs leading-6 rounded-xl px-3.5 py-2.5 flex items-start gap-2 border ${
                    beltSkuMedia.skuImageSourceType === 'EXACT_WEB_VERIFIED'
                      ? 'text-emerald-950 bg-emerald-50/75 border-emerald-200'
                      : 'text-slate-700 bg-[#FAF8F5] border-slate-200'
                  }`}
                >
                  <ShieldCheck
                    className={`w-4 h-4 shrink-0 mt-1 ${
                      beltSkuMedia.skuImageSourceType === 'EXACT_WEB_VERIFIED'
                        ? 'text-emerald-700'
                        : 'text-[#E06518]'
                    }`}
                  />
                  <span>
                    {beltSkuMedia.skuImageSourceType === 'EXACT_WEB_VERIFIED' ? (
                      <>
                        عکس واقعی مارکینگ کارخانه برای کد{' '}
                        <strong className="font-mono" dir="ltr">
                          {beltSkuMedia.skuCode}
                        </strong>{' '}
                        تأیید و متصل شده است.
                      </>
                    ) : (
                      <>
                        تصویر اختصاصی کد{' '}
                        <strong className="font-mono text-[#E06518]" dir="ltr">
                          {beltSkuMedia.skuCode}
                        </strong>{' '}
                        با درج برند، پروفیل و ابعاد روی بدنه تسمه همراه با ۴ تصویر واقعی خانواده آماده بررسی است.
                      </>
                    )}
                  </span>
                </p>
              ) : null}

              {/* Thumbnails Strip */}
              {galleryImages.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                    <span>نمای اختصاصی کد و ۴ زاویه خانواده:</span>
                    <span>{toPersianDigits(galleryImages.length)} تصویر</span>
                  </div>
                  <div className="product-thumb-strip" aria-label="گالری تصاویر محصول">
                    {galleryImages.map((img, idx) => {
                      const isCurrentImg = activeImageIndex === idx;
                      const isBound =
                        img.scope === 'variant' && img.variantCode === selectedVariant?.code;
                      const isCloseup = String(img.id || '').includes('-closeup-');
                      const famMatch = String(img.id || '').match(/belt-fam-.*-(\d)$/);
                      return (
                        <button
                          key={img.id || idx}
                          type="button"
                          aria-pressed={isCurrentImg}
                          aria-label={img.title || `تصویر ${idx + 1}`}
                          onClick={() => handleSelectImage(idx)}
                          className={`relative rounded-xl border overflow-hidden transition-all cursor-pointer text-right ${
                            isCurrentImg
                              ? 'border-[#E06518] ring-2 ring-[#E06518]/30 bg-white'
                              : isBound
                                ? 'border-orange-300 bg-orange-50/30 hover:border-[#E06518]'
                                : 'border-slate-200/80 opacity-85 hover:opacity-100 bg-slate-50'
                          }`}
                        >
                          <ProductImage
                            src={img.url}
                            disableFallback={Boolean(beltFamilyMedia)}
                            alt=""
                            loading="lazy"
                            className="w-full h-full object-contain p-2 pb-5"
                          />
                          <span
                            className={`absolute bottom-0 inset-x-0 text-[9.5px] font-bold px-1.5 py-0.5 text-center truncate ${
                              img.scope === 'variant' && img.variantCode
                                ? isBound
                                  ? 'bg-[#E06518] text-white font-mono'
                                  : 'bg-slate-800/85 text-white font-mono'
                                : 'bg-slate-200/90 text-slate-700'
                            }`}
                            dir={img.scope === 'variant' && !isCloseup ? 'ltr' : 'rtl'}
                          >
                            {img.scope === 'variant' && img.variantCode
                              ? isCloseup
                                ? 'کلوزآپ مارکینگ'
                                : `کد ${img.variantCode}`
                              : famMatch
                                ? `نمای ${toPersianDigits(famMatch[1])} خانواده`
                                : 'تصویر خانواده'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quick Wishlist & Copy SKU Actions */}
              <div className="flex items-center justify-between pt-1 px-1 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={() => toggleWishlist(product.code)}
                  className="flex items-center gap-1.5 hover:text-red-600 transition-colors cursor-pointer py-1"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      isFavorited ? 'fill-red-500 text-red-500' : 'text-slate-400'
                    }`}
                  />
                  <span>{isFavorited ? 'نشان‌شده در فهرست شما' : 'نشان کردن خانواده کالا'}</span>
                </button>
                <button
                  type="button"
                  onClick={copyProductCode}
                  className="flex items-center gap-1.5 hover:text-[#2B313A] transition-colors cursor-pointer py-1"
                >
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>
                    {copiedCode ? 'کد کالا کپی شد' : `کپی کد انتخاب‌شده (${activeSkuCode})`}
                  </span>
                </button>
              </div>
            </div>

            {/* Column 2 (Left in RTL): Collapsible SKU Selector + Commercial Action Card */}
            <div className="product-detail-info space-y-5">
              {/* Accordion Header matching Screenshot 5 ("جستجو و انتخاب کد کالا") */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSelectorOpen((v) => !v)}
                  aria-expanded={selectorOpen}
                  className="w-full px-4 py-3 bg-[#FAF8F5] border-b border-slate-200 flex items-center justify-between text-xs font-black text-[#2B313A] cursor-pointer"
                >
                  <span>جستجو و انتخاب کد کالا</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform ${
                      selectorOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {selectorOpen && visibleVariants.length > 0 && (
                  <div className="p-3 sm:p-4">
                    <ProductVariants
                      variants={visibleVariants}
                      selected={activeSkuCode}
                      onSelect={handleSelectVariant}
                      showPrices={showCommercial}
                      familyCode={product.code}
                      galleryImages={galleryImages}
                    />
                  </div>
                )}
              </div>

              {/* Price / Inquiry / Add to Cart Box */}
              <div className="rounded-2xl border border-slate-200 bg-[#FAF8F5] p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-500 block">
                      وضعیت قیمت و سفارش کد {toPersianDigits(activeSkuCode)}
                    </span>
                    {showCommercial && !isSelectedInquiryOnly && activeUnitPrice > 0 ? (
                      <div className="flex items-baseline gap-1.5">
                        <strong className="text-2xl font-mono font-black text-emerald-700">
                          {formatPrice(activeUnitPrice)}
                        </strong>
                        <span className="text-xs font-bold text-slate-600">
                          تومان / {activeUnit}
                        </span>
                      </div>
                    ) : (
                      <div className="text-sm font-black text-[#c25111]">
                        نیازمند استعلام قیمت روز و موجودی انبار
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-600">تعداد:</label>
                    <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        aria-label="کاهش تعداد"
                      >
                        -
                      </button>
                      <span className="px-3 text-xs font-mono font-black">{toPersianDigits(quantity)}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => q + 1)}
                        className="px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                        aria-label="افزایش تعداد"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="flex items-center justify-center gap-2 rounded-xl bg-[#E06518] hover:bg-[#c85612] py-3 px-4 text-xs font-black text-white shadow-xs transition-colors cursor-pointer"
                  >
                    {added ? <Check className="w-4 h-4" /> : <ShoppingCart className="w-4 h-4" />}
                    <span>
                      {added
                        ? 'به سبد سفارش اضافه شد'
                        : !isSelectedInquiryOnly && activeUnitPrice > 0
                          ? 'افزودن به سبد سفارش'
                          : 'ثبت درخواست قیمت / استعلام'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      openInquiryModal({
                        code: activeSkuCode,
                        name: displayTitle,
                        unit: activeUnit,
                        quantity,
                      })
                    }
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white hover:border-[#E06518] hover:text-[#E06518] py-3 px-4 text-xs font-bold text-[#2B313A] transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-[#E06518]" />
                    <span>درخواست پیش‌فاکتور رسمی</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80 text-[11px] text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-[#E06518]" />
                    <span>ارسال به سراسر کشور از انبار مرکزی یزد</span>
                  </span>
                  <a
                    href="tel:03538739900"
                    className="inline-flex items-center gap-1 font-bold text-[#2B313A] hover:text-[#E06518]"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-[#E06518]" />
                    <span dir="ltr" className="font-mono">۰۳۵-۳۸۷۳۹۹۰۰</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Belt 4 Family Visuals + 2 SKU Visuals Section */}
        {beltFamilyMedia && (
          <BeltVisualMediaSection
            productName={product.name}
            beltFamilyMedia={beltFamilyMedia}
            beltSkuMedia={beltSkuMedia}
            selectedSkuSize={selectedVariant?.size}
            selectedSkuName={selectedVariant?.name}
            onOpenDocModal={(payload) => setBeltDocModal(payload)}
            onJumpToFamilyGallery={() => {
              const famIdx = galleryImages.findIndex((g) => g.scope === 'family');
              if (famIdx >= 0) setActiveImageIndex(famIdx);
              gallerySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
        )}

        {/* 3 Interactive Detail Tabs */}
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
          <div className="flex flex-wrap border-b border-slate-200 bg-[#FAF8F5]" role="tablist">
            {[
              { id: 'specs' as const, label: 'مشخصات فنی کد و خانواده', icon: Layers },
              { id: 'catalogue' as const, label: 'شناسه‌ها و مدارک کاتالوگ', icon: Sparkles },
              { id: 'delivery' as const, label: 'شرایط تأمین و ارسال یزد', icon: PackageCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-xs font-black border-b-2 transition-colors cursor-pointer ${
                    isActive
                      ? 'border-[#E06518] text-[#E06518] bg-white'
                      : 'border-transparent text-slate-600 hover:text-[#2B313A]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-4 sm:p-6">
            {activeTab === 'specs' && (
              <div className="space-y-6">
                {selectedVariant && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-black text-[#2B313A]">
                      ۱. مشخصات دقیق کد کالای انتخاب‌شده ({toPersianDigits(selectedVariant.code)})
                    </h3>
                    <div className="overflow-x-auto rounded-2xl border border-orange-200/80">
                      <table className="w-full text-xs text-right">
                        <thead>
                          <tr className="bg-orange-50/70 border-b border-orange-200/80 text-slate-700">
                            <th className="py-3 px-4 font-bold w-1/3">شاخص فنی</th>
                            <th className="py-3 px-4 font-bold">مقدار ثبت‌شده</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-100">
                          <tr className="bg-white">
                            <td className="py-3 px-4 font-semibold text-slate-700">کد دقیق کالا</td>
                            <td className="py-3 px-4 font-mono font-bold text-[#E06518]" dir="ltr">
                              {selectedVariant.code}
                            </td>
                          </tr>
                          <tr className="bg-orange-50/20">
                            <td className="py-3 px-4 font-semibold text-slate-700">نام دقیق کالا</td>
                            <td className="py-3 px-4 font-bold text-slate-800">{selectedVariant.name}</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="py-3 px-4 font-semibold text-slate-700">سایز / ابعاد</td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-800" dir="auto">
                              {selectedVariant.size || '—'}
                            </td>
                          </tr>
                          {activeVariantSpecs.map((spec, idx) => (
                            <tr key={`${spec.key}-${idx}`} className={idx % 2 === 0 ? 'bg-orange-50/20' : 'bg-white'}>
                              <td className="py-3 px-4 font-semibold text-slate-700">{spec.key}</td>
                              <td className="py-3 px-4 font-bold text-slate-800">{spec.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {selectedTechnicalReview?.note && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 leading-6 space-y-1.5">
                    <h4 className="font-black text-[#2B313A]">یادداشت مهندسی کد کالا</h4>
                    <p>{selectedTechnicalReview.note}</p>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-sm font-black text-[#2B313A]">
                    ۲. مشخصات مشترک خانواده ({product.name})
                  </h3>
                  {product.technicalSpecs && product.technicalSpecs.length > 0 ? (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <table className="w-full text-xs text-right">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                            <th className="py-3 px-4 font-bold w-1/3">شاخص فنی مشترک خانواده</th>
                            <th className="py-3 px-4 font-bold">اطلاعات ثبت‌شده</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {product.technicalSpecs.map((spec, idx) => (
                            <tr key={`${spec.key}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}>
                              <td className="py-3 px-4 font-semibold text-slate-700">{spec.key}</td>
                              <td className="py-3 px-4 font-bold text-[#2B313A]">{spec.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 p-4 rounded-xl bg-slate-50 border border-slate-200">
                      مشخصات تفصیلی هر سایز در جدول کدهای بالای صفحه ثبت شده است.
                    </p>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'catalogue' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-slate-500 block text-[11px]">کد کالای انتخاب‌شده</span>
                  <strong className="font-mono font-black text-[#2B313A] text-sm block" dir="ltr">
                    {activeSkuCode}
                  </strong>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-slate-500 block text-[11px]">کد خانواده محصول</span>
                  <strong className="font-mono font-black text-[#E06518] text-sm block" dir="ltr">
                    {product.code}
                  </strong>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-slate-500 block text-[11px]">شماره صفحه کاتالوگ اطلس</span>
                  <strong className="font-mono font-black text-[#2B313A] text-sm block">
                    {product.cataloguePage ? toPersianDigits(product.cataloguePage) : 'ثبت سیستمی'}
                  </strong>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-slate-500 block text-[11px]">برند تجاری</span>
                  <strong className="font-black text-[#2B313A] text-sm block">
                    {activeBrand || 'صنعت پیش'}
                  </strong>
                </div>
              </div>
            )}

            {activeTab === 'delivery' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="rounded-2xl border border-slate-200 bg-[#FAF8F5] p-4 space-y-1.5">
                  <strong className="text-[#2B313A] block">ارسال فوری از انبار یزد</strong>
                  <p className="text-slate-600 leading-6">
                    سفارش‌های تأییدشده تا ساعت ۱۶ در همان روز کاری از طریق باربری، تیپاکس یا پست پیشتاز ارسال می‌شوند.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-[#FAF8F5] p-4 space-y-1.5">
                  <strong className="text-[#2B313A] block">برش و آپارات سفارشی</strong>
                  <p className="text-slate-600 leading-6">
                    امکان برش تسمه در عرض دلخواه و اتصال حرارتی یا مکانیکی طبق نقشه خط تولید وجود دارد.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-[#FAF8F5] p-4 space-y-1.5">
                  <strong className="text-[#2B313A] block">ضمانت اصالت و معادل‌یابی</strong>
                  <p className="text-slate-600 leading-6">
                    کلیه کدهای فنی با تطبیق دقیق ابعاد، گام و برند کارخانه عرضه می‌گردند.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Similar Products */}
        {similarProducts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-black text-[#2B313A]">
                سایر خانواده‌های مشابه در دسته {categoryTitle}
              </h2>
              {categorySlug && (
                <Link
                  to={`/category/${encodeURIComponent(categorySlug)}`}
                  className="text-xs font-bold text-[#E06518] hover:underline"
                >
                  مشاهده همه در این دسته
                </Link>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {similarProducts.map((sim) => (
                <ProductCard key={sim.code} product={sim} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 4-View CAD / Image Zoom Modal */}
      <Modal
        isOpen={Boolean(beltDocModal)}
        onClose={() => setBeltDocModal(null)}
        title={beltDocModal?.title || ''}
        size="xl"
      >
        {beltDocModal && (
          <div className="space-y-3">
            {beltDocModal.subtitle && (
              <p className="text-xs font-semibold text-slate-600">{beltDocModal.subtitle}</p>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 grid place-items-center max-h-[70vh] overflow-auto">
              <img
                src={beltDocModal.webpUrl}
                alt={beltDocModal.title}
                className="max-w-full max-h-[62vh] object-contain"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ProductDetailPage;
