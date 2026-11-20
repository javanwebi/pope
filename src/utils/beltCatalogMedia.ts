import beltManifestRaw from '../generated/beltCatalogManifest';
import type { Product, ProductGalleryImage } from '../types';

export interface BeltManifestFamilyEntry {
  s:
    | 'excel-v2-1-1'
    | 'excel-v2-1-2'
    | 'excel-v2-1-3'
    | 'excel-v2-1-4'
    | 'excel-v2-1-5'
    | 'excel-v2-2-1';
  d: string;
  db: string | null;
  p: [string | null, string | null, string | null, string | null];
  m?: 'E' | 'H' | 'P';
}

export interface BeltCatalogManifest {
  version: number;
  generatedAt: string;
  licenseStatus?: 'USER_CONFIRMED';
  licenseDecoupledFromVisualVerification?: boolean;
  totals: {
    realBeltFamilies: number;
    realBeltSkus: number;
    excludedPureNonBeltFamilies: number;
    excludedMixedNonBeltSkus: number;
    exactVerifiedRealSkuImages: number;
    exactVerifiedRealCloseupImages?: number;
    labeledStudioRenderSkuImages?: number;
    verifiedUniqueFamilies?: number;
    exactBrandFamilies?: number;
    hybridFamilies?: number;
    profileMatchedFamilies?: number;
    complete4PhotoFamilies?: number;
    skuFinalStatusBreakdown?: {
      VERIFIED_REAL_PRODUCT_IMAGE: number;
      NOT_FOUND: number;
      NEEDS_MANUAL_REVIEW: number;
      SOURCE_UNAVAILABLE: number;
    };
  };
  excludedFamilyIds: string[];
  excludedMixedSkuIds: string[];
  pendingReviewSkuIds?: string[];
  manualReviewSkuIds?: string[];
  sourceUnavailableSkuIds?: string[];
  exactRealSkuIds: string[];
  exactRealCloseupSkuIds?: string[];
  aliases?: Record<string, string>;
  families: Record<string, BeltManifestFamilyEntry>;
  skus: Record<string, string>;
}

const manifest = beltManifestRaw as unknown as BeltCatalogManifest;
const EXCLUDED_FAMILY_SET = new Set<string>(manifest.excludedFamilyIds || []);
const EXCLUDED_MIXED_SKU_SET = new Set<string>(manifest.excludedMixedSkuIds || []);
const PENDING_REVIEW_SKU_SET = new Set<string>(manifest.pendingReviewSkuIds || []);
const MANUAL_REVIEW_SKU_SET = new Set<string>(manifest.manualReviewSkuIds || []);
const SOURCE_UNAVAILABLE_SKU_SET = new Set<string>(manifest.sourceUnavailableSkuIds || []);
const EXACT_REAL_SKU_SET = new Set<string>(manifest.exactRealSkuIds || []);
const EXACT_REAL_CLOSEUP_SKU_SET = new Set<string>(manifest.exactRealCloseupSkuIds || []);

export type BeltFamilyPhotoMatchType =
  | 'EXACT_BRAND'
  | 'HYBRID_EXACT_AND_PROFILE'
  | 'PROFILE_MATCHED';

export interface BeltFamilyMedia {
  familyCode: string;
  menuCategorySlug: string;
  dominantDivision: string;
  existingDbImage: string | null;
  hasVerifiedRealPhoto: boolean;
  familyPhotoMatchType: BeltFamilyPhotoMatchType;
  cardPreviewSvg: string;
  primaryThumbnail: string;
  familyPhotos: [string | null, string | null, string | null, string | null];
  specSheetWebp: string | null;
  specSheetSvg: string | null;
}

export type BeltSkuFinalStatus =
  | 'VERIFIED_REAL_PRODUCT_IMAGE'
  | 'NOT_FOUND'
  | 'NEEDS_MANUAL_REVIEW'
  | 'SOURCE_UNAVAILABLE';

export type BeltSkuImageSourceType = 'EXACT_WEB_VERIFIED' | 'LABELED_STUDIO_RENDER';

export interface BeltSkuMedia {
  skuCode: string;
  familyCode: string;
  technicalDrawingWebp: string | null;
  technicalDrawingSvg: string | null;
  profileDrawingWebp: string | null;
  profileDrawingSvg: string | null;
  technicalDrawingStatus: 'VERIFIED_ENGINEERING_REDRAW' | 'NEEDS_TECHNICAL_DATA';
  realProductImage: string;
  realProductCloseupImage: string | null;
  skuImageSourceType: BeltSkuImageSourceType;
  licenseStatus: 'USER_CONFIRMED';
  visualStatus: 'VERIFIED' | 'NOT_FOUND' | 'NEEDS_MANUAL_REVIEW' | 'SOURCE_UNAVAILABLE';
  finalSkuStatus: BeltSkuFinalStatus;
  realImageStatus: 'EXACT_SKU_IMAGE_FOUND' | 'LABELED_STUDIO_RENDER';
  realImageStatusLabelFa: string;
}

function normalizeOfficialDbImage(candidate?: string | null): string | null {
  const clean = String(candidate || '').trim();
  if (
    /^\/belt-catalog\/owner-conveyor\/e\([1-9]\d{0,3}\)\.(png|webp|jpg)$/i.test(clean) ||
    /^\/storage\/products\/(catalog\/e\([1-9]\d{0,3}\)\.png|thumbs\/e\([1-9]\d{0,3}\)\.webp)$/i.test(clean)
  ) {
    return clean;
  }
  return null;
}

export function getBeltManifestTotals() {
  return manifest.totals;
}

export interface BeltFamilyHints {
  variants?: Array<{ code?: string | null }> | null;
  legacyFamilyCodes?: string[] | null;
}

export function resolveBeltManifestFamilyCode(
  familyCode?: string | null,
  hints?: BeltFamilyHints,
): string | null {
  const clean = String(familyCode || '').trim();
  if (clean && !EXCLUDED_FAMILY_SET.has(clean)) {
    const aliased = manifest.aliases?.[clean];
    if (aliased && Object.prototype.hasOwnProperty.call(manifest.families, aliased)) {
      return aliased;
    }
    if (Object.prototype.hasOwnProperty.call(manifest.families, clean)) {
      return clean;
    }
  }
  if (clean && EXCLUDED_FAMILY_SET.has(clean)) {
    return null;
  }
  for (const legacy of hints?.legacyFamilyCodes || []) {
    const c = String(legacy || '').trim();
    if (!c || EXCLUDED_FAMILY_SET.has(c)) continue;
    const aliasedLegacy = manifest.aliases?.[c];
    if (aliasedLegacy && Object.prototype.hasOwnProperty.call(manifest.families, aliasedLegacy)) {
      return aliasedLegacy;
    }
    if (Object.prototype.hasOwnProperty.call(manifest.families, c)) {
      return c;
    }
  }
  for (const variant of hints?.variants || []) {
    const sku = String(variant?.code || '').trim();
    if (!sku || EXCLUDED_MIXED_SKU_SET.has(sku)) continue;
    const mapped = manifest.skus[sku];
    if (mapped && !EXCLUDED_FAMILY_SET.has(mapped) && Object.prototype.hasOwnProperty.call(manifest.families, mapped)) {
      return mapped;
    }
  }
  return null;
}

export function isExcludedBeltFamily(familyCode?: string | null): boolean {
  const clean = String(familyCode || '').trim();
  return Boolean(clean && EXCLUDED_FAMILY_SET.has(clean));
}

export function isRealBeltFamily(familyCode?: string | null, hints?: BeltFamilyHints): boolean {
  return Boolean(resolveBeltManifestFamilyCode(familyCode, hints));
}

export function isExcludedBeltSku(skuCode?: string | null): boolean {
  const clean = String(skuCode || '').trim();
  return Boolean(clean && EXCLUDED_MIXED_SKU_SET.has(clean));
}

export function isRealBeltSku(skuCode?: string | null): boolean {
  const clean = String(skuCode || '').trim();
  if (!clean || EXCLUDED_MIXED_SKU_SET.has(clean)) return false;
  return Object.prototype.hasOwnProperty.call(manifest.skus, clean);
}

export function getBeltFamilyMedia(
  familyCode?: string | null,
  _existingImageOverride?: string | null,
  hints?: BeltFamilyHints,
): BeltFamilyMedia | null {
  const manifestFamilyCode = resolveBeltManifestFamilyCode(familyCode, hints);
  if (!manifestFamilyCode) return null;
  const entry = manifest.families[manifestFamilyCode];
  const dbImg = normalizeOfficialDbImage(entry.db);
  const base = `/src/assets/catalog/belts/families/${encodeURIComponent(manifestFamilyCode)}`;
  const photo1 = entry.p[0] ? `${base}/family-image-01.webp` : null;
  const photo2 = entry.p[1] ? `${base}/family-image-02.webp` : null;
  const photo3 = entry.p[2] ? `${base}/family-image-03.webp` : null;
  const photo4 = entry.p[3] ? `${base}/family-image-04.webp` : null;
  const hasVerifiedRealPhoto = Boolean(photo1 || photo2 || photo3 || photo4 || dbImg);
  const familyPhotoMatchType: BeltFamilyPhotoMatchType =
    entry.m === 'E'
      ? 'EXACT_BRAND'
      : entry.m === 'H'
        ? 'HYBRID_EXACT_AND_PROFILE'
        : 'PROFILE_MATCHED';
  const cardPreviewSvg = `${base}/card-preview.svg`;
  const hasSpecSheet = entry.d !== 'service-ambiguous';
  const specSheetWebp = hasSpecSheet ? `${base}/family-specifications.webp` : null;
  const specSheetSvg = hasSpecSheet ? `${base}/family-specifications.svg` : null;

  return {
    familyCode: manifestFamilyCode,
    menuCategorySlug: entry.s,
    dominantDivision: entry.d,
    existingDbImage: dbImg,
    hasVerifiedRealPhoto,
    familyPhotoMatchType,
    cardPreviewSvg,
    primaryThumbnail: photo1 || dbImg || photo2 || photo3 || photo4 || cardPreviewSvg || '',
    familyPhotos: [photo1, photo2, photo3, photo4],
    specSheetWebp,
    specSheetSvg,
  };
}

export function getBeltSkuMedia(
  familyCode?: string | null,
  skuCode?: string | null,
  hints?: BeltFamilyHints,
): BeltSkuMedia | null {
  const cleanSku = String(skuCode || '').trim();
  if (!cleanSku || isExcludedBeltSku(cleanSku)) return null;
  const mappedFamily = manifest.skus[cleanSku];
  if (!mappedFamily) return null;
  const cleanFamily = String(familyCode || '').trim();
  if (cleanFamily && cleanFamily !== mappedFamily) {
    const resolvedFamily = resolveBeltManifestFamilyCode(cleanFamily, hints);
    const belongsToVariants = Boolean(
      hints?.variants?.some((v) => String(v?.code || '').trim() === cleanSku),
    );
    if (resolvedFamily !== mappedFamily && !(cleanFamily.startsWith('PFAM-') && belongsToVariants)) {
      return null;
    }
  }
  const base = `/src/assets/catalog/belts/skus/${encodeURIComponent(cleanSku)}`;
  const hasExactReal = EXACT_REAL_SKU_SET.has(cleanSku);
  const hasExactCloseup = hasExactReal && EXACT_REAL_CLOSEUP_SKU_SET.has(cleanSku);
  const isPendingReview = PENDING_REVIEW_SKU_SET.has(cleanSku);
  const isManualReview = MANUAL_REVIEW_SKU_SET.has(cleanSku) || isPendingReview;
  const isSourceUnavailable = SOURCE_UNAVAILABLE_SKU_SET.has(cleanSku);

  const finalSkuStatus: BeltSkuFinalStatus = hasExactReal
    ? 'VERIFIED_REAL_PRODUCT_IMAGE'
    : isSourceUnavailable
      ? 'SOURCE_UNAVAILABLE'
      : isManualReview
        ? 'NEEDS_MANUAL_REVIEW'
        : 'NOT_FOUND';

  const visualStatus: BeltSkuMedia['visualStatus'] = hasExactReal
    ? 'VERIFIED'
    : finalSkuStatus === 'SOURCE_UNAVAILABLE'
      ? 'SOURCE_UNAVAILABLE'
      : finalSkuStatus === 'NEEDS_MANUAL_REVIEW'
        ? 'NEEDS_MANUAL_REVIEW'
        : 'NOT_FOUND';

  const skuImageSourceType: BeltSkuImageSourceType = hasExactReal
    ? 'EXACT_WEB_VERIFIED'
    : 'LABELED_STUDIO_RENDER';

  const realImageStatusLabelFa = hasExactReal
    ? hasExactCloseup
      ? 'عکس واقعی مارکینگ کارخانه + کلوزآپ همان تسمه (EXACT_WEB_VERIFIED)'
      : 'عکس واقعی مارکینگ کارخانه تأییدشده از وب (EXACT_WEB_VERIFIED)'
    : 'تصویر استودیویی اختصاصی با چاپ برند، پروفیل، ابعاد و کد کالا روی بدنه تسمه';

  return {
    skuCode: cleanSku,
    familyCode: mappedFamily,
    technicalDrawingWebp: null,
    technicalDrawingSvg: null,
    profileDrawingWebp: null,
    profileDrawingSvg: null,
    technicalDrawingStatus: isPendingReview ? 'NEEDS_TECHNICAL_DATA' : 'VERIFIED_ENGINEERING_REDRAW',
    realProductImage: `${base}/real-product-image.webp`,
    realProductCloseupImage: hasExactCloseup ? `${base}/real-marking-closeup.webp` : null,
    skuImageSourceType,
    licenseStatus: 'USER_CONFIRMED',
    visualStatus,
    finalSkuStatus,
    realImageStatus: hasExactReal ? 'EXACT_SKU_IMAGE_FOUND' : 'LABELED_STUDIO_RENDER',
    realImageStatusLabelFa,
  };
}

export function buildBeltGalleryImages(
  product: Pick<Product, 'code' | 'legacyFamilyCodes' | 'name' | 'image' | 'images' | 'variants'>,
  baseGallery: ProductGalleryImage[],
  activeSkuCode?: string | null,
): ProductGalleryImage[] {
  const hints: BeltFamilyHints = {
    variants: product.variants,
    legacyFamilyCodes: product.legacyFamilyCodes,
  };
  const familyMedia = getBeltFamilyMedia(
    product.code,
    product.images?.find((u) => Boolean(normalizeOfficialDbImage(u))) || product.image,
    hints,
  );
  if (!familyMedia) return baseGallery;
  const result: ProductGalleryImage[] = [];
  const seenKeys = new Set<string>();
  const pushUnique = (img: ProductGalleryImage) => {
    const key = `${img.scope}:${img.variantCode || ''}:${img.url}`;
    if (!img.url || seenKeys.has(key)) return;
    seenKeys.add(key);
    result.push({ ...img, order: result.length + 1 });
  };

  // 1. Selected SKU dedicated labeled belt photo (+ linked close-up if web-verified)
  const targetSku = String(
    activeSkuCode || product.variants?.find((v) => v?.code && !isExcludedBeltSku(v.code))?.code || '',
  ).trim();
  if (targetSku && !isExcludedBeltSku(targetSku)) {
    const activeSkuMedia = getBeltSkuMedia(product.code, targetSku, hints);
    if (activeSkuMedia?.realProductImage) {
      pushUnique({
        id: `belt-sku-real-${targetSku}`,
        url: activeSkuMedia.realProductImage,
        scope: 'variant',
        variantCode: targetSku,
        title:
          activeSkuMedia.skuImageSourceType === 'EXACT_WEB_VERIFIED'
            ? `عکس واقعی مارکینگ کارخانه کد ${targetSku}`
            : `تصویر اختصاصی با چاپ مشخصات و کد ${targetSku} روی بدنه تسمه`,
      });
    }
    if (activeSkuMedia?.realProductCloseupImage) {
      pushUnique({
        id: `belt-sku-closeup-${targetSku}`,
        url: activeSkuMedia.realProductCloseupImage,
        scope: 'variant',
        variantCode: targetSku,
        title: `کلوزآپ مارکینگ همان تسمه کد ${targetSku}`,
      });
    }
  }

  // 2. All 4 real family belt photos (01-main, 02-angle, 03-detail, 04-closeup) — zero CAD drawings
  const photoLabels = [
    'نمای کلی تسمه (۰۱)',
    'نمای زاویه و دندانه (۰۲)',
    'جزئیات لایه‌ها و ساختار (۰۳)',
    'نمای نزدیک بدنه (۰۴)',
  ];
  familyMedia.familyPhotos.forEach((url, idx) => {
    if (!url) return;
    pushUnique({
      id: `belt-fam-${product.code}-${idx + 1}`,
      url,
      scope: 'family',
      title: `${product.name} — ${photoLabels[idx]}`,
    });
  });

  return result;
}
