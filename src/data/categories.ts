import type { Category, CategoryNode } from '../types';

export type { CategoryNode };

export interface EnhancedCategory extends Category {
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
  children: CategoryNode[];
}

export const categorySlugFor = (name: string): string =>
  name
    .trim()
    .replace(/[\s‌\u200c]+/g, '-')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9-]/g, '');

const LEGACY_SLUGS: Record<string, string> = {
  'industrial-belts': 'تسمه-و-انتقال-نیرو',
  'industrial-belts-transmission': 'تسمه-و-انتقال-نیرو',
  'belts': 'تسمه-و-انتقال-نیرو',
  'conveyor-belts': 'نوارهای-نقاله',
  'bearings-housings': 'بلبرینگ-و-رولربرینگ',
  'chains-sprockets': 'زنجیر-و-ملحقات',
  'pulleys-idlers': 'پولی-و-انتقال-نیرو',
};

export const resolveCategorySlug = (slug: string): string => {
  const mapped = LEGACY_SLUGS[slug] || slug;
  if (/^تسمه(?:\s|\u200c|-)+و(?:\s|\u200c|-)+انتقال(?:\s|\u200c|-)+(?:نیرو|قدرت)$/.test(mapped)) {
    return 'تسمه-و-انتقال-نیرو';
  }
  return mapped;
};

export function normalizeManagedCategory(c: Record<string, unknown>): EnhancedCategory {
  const rawChildren = Array.isArray(c.children)
    ? (c.children as CategoryNode[])
    : Array.isArray(c.subcategories)
      ? (c.subcategories as string[]).map((s) => ({ name: String(s), children: [] }))
      : [];

  const familyCountValue = Number(c.familyCount ?? c.count ?? 0);
  const skuCountValue = Number(c.skuCount ?? c.itemCount ?? c.count ?? 0);
  const familyCount = Number.isFinite(familyCountValue) ? Math.max(0, familyCountValue) : 0;
  const skuCount = Number.isFinite(skuCountValue) ? Math.max(0, skuCountValue) : familyCount;
  const nameEn = typeof c.nameEn === 'string' ? c.nameEn : '';
  const description =
    typeof c.description === 'string' && c.description.trim()
      ? c.description
      : rawChildren.map((node) => node.name).filter(Boolean).join('، ');
  const icon = typeof c.icon === 'string' && c.icon.trim() ? c.icon : 'Package';
  const image = typeof c.image === 'string' && c.image.trim() ? c.image : undefined;

  return {
    ...(c as Partial<EnhancedCategory>),
    id: (c.id ?? '') as string | number,
    slug: typeof c.slug === 'string' ? c.slug : '',
    name: typeof c.name === 'string' ? c.name : '',
    nameEn,
    description,
    icon,
    image,
    count: familyCount,
    familyCount,
    skuCount,
    directSkuCount: Number(c.directSkuCount ?? 0) || 0,
    subcategories: Array.isArray(c.subcategories)
      ? (c.subcategories as string[])
      : rawChildren.map((node) => node.name),
    children: rawChildren,
  };
}
