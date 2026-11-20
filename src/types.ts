export interface PriceTiers {
  base: number;
  retail: number;
  wholesale: number;
  dealer: number;
  agency?: number;
  [key: string]: unknown;
}

export interface TechnicalSpec {
  key: string;
  value: string;
}

export interface TechnicalReview {
  summary?: string;
  standards?: string[];
  applications?: string[];
  notes?: string;
  [key: string]: unknown;
}

export interface ProductGalleryImage {
  id: string;
  url: string;
  fileName?: string;
  scope: 'family' | 'variant';
  identityVerified?: boolean;
  variantCode?: string;
  title?: string;
  order?: number;
}

export interface ProductVariant {
  technicalReview?: TechnicalReview;
  code: string;
  size: string;
  name: string;
  model?: string;
  brand?: string;
  unit?: string;
  price?: number;
  prices?: PriceTiers;
  inquiryOnly?: boolean;
  stock?: number;
  stockKnown?: boolean;
  technicalSpecs?: TechnicalSpec[];
  images?: string[];
  description?: string;
  active?: boolean;
}

export interface Product {
  submenu?: string;
  subcategory: string;
  variants?: ProductVariant[];
  sourceRow?: number;
  stockKnown?: boolean;
  imageScope?: 'family-example' | 'mixed' | 'sku-verified';
  galleryImages?: ProductGalleryImage[];
  active?: boolean;
  updatedAt?: string;
  code: string;
  legacyFamilyCodes?: string[];
  name: string;
  nameEn?: string;
  brand: string;
  categorySlug: string;
  categoryName: string;
  category?: string;
  technicalSpecs: TechnicalSpec[];
  prices: PriceTiers;
  discountPercent?: number;
  stock: number;
  inquiryOnly: boolean;
  isInquiryOnly?: boolean;
  rating?: number;
  images: string[];
  image?: string;
  tags: string[];
  minOrderQty?: number;
  unit: string;
  featured?: boolean;
  description?: string;
  clubPointsReward?: number;
  forzaCode?: string;
  cataloguePage?: number;
  hasCatalogueImage?: boolean;
  resolvedAssignment?: {
    categorySlug: string;
    submenuName: string;
    leafName: string | null;
    method?: string;
  } | null;
}

export interface Category {
  id: string | number;
  slug: string;
  name: string;
  nameEn: string;
  description: string;
  subcategories: string[];
  icon: string;
  count: number;
  familyCount?: number;
  skuCount?: number;
  directSkuCount?: number;
  image?: string;
  active?: boolean;
  sortOrder?: number;
  menuSource?: string;
  routeSlug?: string;
  children?: CategoryNode[];
}

export interface CategoryNode {
  name: string;
  value?: string;
  slug?: string;
  hidden?: boolean;
  children?: CategoryNode[];
}

export interface Brand {
  id: string;
  name: string;
  slug?: string;
  nameEn?: string;
  country?: string;
  isExclusive?: boolean;
  description?: string;
  logo?: string;
  logoUrl?: string;
  isFeatured?: boolean;
}

export interface DirectSku {
  skuCode: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  submenu: string | null;
  subcategory: string | null;
  brand: string;
  imageUrl: string | null;
  technicalSpecs: TechnicalSpec[];
  priceSnapshot: Record<string, unknown>;
  sourceFamilyCode: string | null;
  active?: boolean;
}
