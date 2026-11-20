import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Headphones,
  LayoutGrid,
  List as ListIcon,
  Package,
  RotateCcw,
  Ruler,
  Search,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import type { Category, CategoryNode, DirectSku, Product } from '../types';
import { useCatalog } from '../context/CatalogContext';
import { resolveCategorySlug } from '../data/categories';
import { resolveDisplayBrand, productHasDisplayBrand } from '../utils/catalogBrands';
import { formatPrice, toPersianDigits } from '../utils/formatters';
import { getBeltFamilyMedia } from '../utils/beltCatalogMedia';
import { resolveSiteProductImage } from '../utils/siteProductImages';
import { getCommonComparisonSpecKeys } from '../utils/partMeasurements';
import {
  buildCategoryFacetProfile,
  buildPaginationWindow,
  buildSubcategoryStripNodes,
  extractNumericDimensions,
  matchesDimensionRange,
  matchesDynamicFacetToken,
  normalizeCatalogText,
  resolveExcelCategoryArtwork,
  resolveSubcategoryThumb,
  type MenuFamilySummary,
} from '../utils/excelCategoryCatalog';

type MenuCategoryPayload = {
  category: {
    slug: string;
    name: string;
    description: string;
    image?: string | null;
    children: CategoryNode[];
  };
  families: MenuFamilySummary[];
  products: Product[];
};

const VBELT_SECTION_GROUPS = [
  {
    id: 'classic',
    title: 'وی‌بلت کلاسیک',
    standard: 'DIN 2215',
    subtitle: 'مقطع استاندارد Z, A, B, C, D',
    profiles: [
      { code: 'Z', size: '10×6' },
      { code: 'A', size: '13×8' },
      { code: 'B', size: '17×11' },
      { code: 'C', size: '22×14' },
      { code: 'D', size: '32×19' },
      { code: 'E', size: '38×25' },
    ],
  },
  {
    id: 'narrow',
    title: 'اسپشیال باریک (Narrow)',
    standard: 'DIN 7753',
    subtitle: 'انتقال توان بالا SPZ, SPA, SPB, SPC',
    profiles: [
      { code: 'SPZ', size: '9.7×8' },
      { code: 'SPA', size: '12.7×10' },
      { code: 'SPB', size: '16.3×13' },
      { code: 'SPC', size: '22×18' },
    ],
  },
  {
    id: 'cogged',
    title: 'دنده‌دار خام‌بر (Raw Edge)',
    standard: 'Cogged',
    subtitle: 'انعطاف‌پذیری بالا برای پولی کوچک',
    profiles: [
      { code: 'AX', size: '13×8' },
      { code: 'BX', size: '17×11' },
      { code: 'CX', size: '22×14' },
      { code: 'XPZ', size: '9.7×8' },
      { code: 'XPA', size: '12.7×10' },
      { code: 'XPB', size: '16.3×13' },
    ],
  },
];

const VBELT_STRUCTURES = [
  { id: 'wrapped', label: 'روکش‌دار (Wrapped)' },
  { id: 'cogged', label: 'دنده‌دار (Cogged)' },
  { id: 'open', label: 'متری / جوشی' },
];

function collectDescendantNames(node: CategoryNode): string[] {
  const out = [node.value || node.name, node.name];
  for (const child of node.children || []) {
    if (child.hidden !== true) {
      out.push(...collectDescendantNames(child));
    }
  }
  return Array.from(new Set(out.filter(Boolean)));
}

function matchesSelection(
  family: MenuFamilySummary,
  targetName: string,
  allTopNodes: CategoryNode[] = [],
): boolean {
  const cleanTarget = normalizeCatalogText(targetName);
  if (!cleanTarget) return true;
  const matchedTopNode = allTopNodes.find((n) => normalizeCatalogText(n.name) === cleanTarget);
  const validTargets = new Set(
    (matchedTopNode ? collectDescendantNames(matchedTopNode) : [targetName]).map(normalizeCatalogText),
  );
  const famSub = normalizeCatalogText(family.submenu || '');
  const famLeaf = normalizeCatalogText(family.leaf || '');
  return validTargets.has(famSub) || validTargets.has(famLeaf);
}

export const ExcelMenuCategoryPage: React.FC = () => {
  const { slug: rawSlug = '' } = useParams<{ slug: string }>();
  const slug = resolveCategorySlug(decodeURIComponent(rawSlug));
  const [searchParams, setSearchParams] = useSearchParams();
  const { panelMode, openInquiryModal } = useCatalog();

  const [payload, setPayload] = useState<MenuCategoryPayload | null>(null);
  const [directSkus, setDirectSkus] = useState<DirectSku[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');

  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [compareCodes, setCompareCodes] = useState<string[]>([]);
  const [compareNotice, setCompareNotice] = useState('');
  const [showAllFacetOptions, setShowAllFacetOptions] = useState(false);
  const [showAllDirectSkus, setShowAllDirectSkus] = useState(false);
  const [vbeltMatrixOpen, setVbeltMatrixOpen] = useState(false);
  const [beltStructure, setBeltStructure] = useState('');
  const [beltTopWidth, setBeltTopWidth] = useState('');
  const [specFilterKey, setSpecFilterKey] = useState('all');

  const resultsRef = useRef<HTMLElement>(null);

  // URL search params state
  const selection = searchParams.get('sub') || '';
  const brandFilter = searchParams.get('brand') || '';
  const specValue = searchParams.get('spec') || '';
  const queryText = searchParams.get('q') || '';
  const sortMode = (searchParams.get('sort') || 'featured') as 'featured' | 'name' | 'sku_desc';
  const viewMode = (searchParams.get('view') || 'grid') as 'grid' | 'list';
  const pageSize = Math.max(12, Math.min(48, Number(searchParams.get('limit')) || 12));
  const currentPageRaw = Math.max(1, Number(searchParams.get('page')) || 1);
  const inStockOnly = searchParams.get('inStock') === '1';
  const imageOnly = searchParams.get('hasImage') === '1';
  const orderMode = searchParams.get('orderMode') || 'all';
  const lenMin = searchParams.get('lenMin') || '';
  const lenMax = searchParams.get('lenMax') || '';
  const dimMin = searchParams.get('dimMin') || '';
  const dimMax = searchParams.get('dimMax') || '';

  const updateParam = (key: string, value: string, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (resetPage && key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;
    setStatus('loading');
    setShowAllFacetOptions(false);
    setShowAllDirectSkus(false);
    setCompareCodes([]);
    setCompareNotice('');

    const loadCategory = async () => {
      try {
        const isExcelSlug = /^excel-v2-[0-9]+-[0-9]+$/.test(slug);
        const endpoint = isExcelSlug
          ? `/api/catalog/menu-category/${encodeURIComponent(slug)}`
          : `/api/catalog/category/${encodeURIComponent(slug)}`;

        const [catRes, directRes] = await Promise.all([
          fetch(endpoint, { cache: 'no-store', signal: controller.signal }),
          fetch(`/api/catalog/direct-skus?categorySlug=${encodeURIComponent(slug)}`, {
            cache: 'no-store',
            signal: controller.signal,
          }),
        ]);

        if (catRes.status === 404) {
          if (mounted) setStatus('not-found');
          return;
        }
        if (!catRes.ok) throw new Error('Failed to load category');

        const catJson = await catRes.json();
        const directJson = directRes.ok ? await directRes.json() : { items: [] };
        if (!mounted) return;

        if (isExcelSlug) {
          setPayload({
            category: catJson.category,
            families: catJson.families || [],
            products: catJson.products || [],
          });
        } else {
          const legacyCat = catJson.category as Category;
          const legacyProducts = (catJson.products || []) as Product[];
          setPayload({
            category: {
              slug: legacyCat.slug,
              name: legacyCat.name,
              description: legacyCat.description || '',
              image: legacyCat.image || null,
              children: legacyCat.children || [],
            },
            families: legacyProducts.map((p) => ({
              code: p.code,
              name: p.name,
              brand: resolveDisplayBrand(p.brand, p.name) || p.brand || '',
              submenu: p.resolvedAssignment?.submenuName || p.submenu || p.subcategory || null,
              leaf: p.resolvedAssignment?.leafName || null,
              skuCount: p.variants?.length || 0,
            })),
            products: legacyProducts,
          });
        }
        setDirectSkus(Array.isArray(directJson.items) ? directJson.items : []);
        setStatus('ready');
      } catch (err) {
        if (!mounted || (err instanceof Error && err.name === 'AbortError')) return;
        setStatus('error');
      }
    };

    void loadCategory();
    return () => {
      mounted = false;
      controller.abort();
    };
  }, [slug]);

  const resolvedCategory = payload?.category;
  const families = payload?.families || [];
  const productMap = useMemo(
    () => new Map((payload?.products || []).map((p) => [p.code, p])),
    [payload],
  );

  const isVBeltCategory = slug === 'excel-v2-1-2';

  const visibleSubnodes = useMemo(
    () => (resolvedCategory?.children || []).filter((n) => n.hidden !== true),
    [resolvedCategory],
  );

  const stripNodes = useMemo(
    () => buildSubcategoryStripNodes(visibleSubnodes, resolvedCategory?.name || ''),
    [visibleSubnodes, resolvedCategory?.name],
  );

  // Leaf specialty sub-branches across visible subnodes
  const leafFilterNodes = useMemo(() => {
    const out: CategoryNode[] = [];
    const seen = new Set<string>();
    const activeParent = visibleSubnodes.find(
      (n) => normalizeCatalogText(n.name) === normalizeCatalogText(selection),
    );
    const roots = activeParent ? [activeParent] : visibleSubnodes;
    for (const root of roots) {
      for (const child of root.children || []) {
        if (child.hidden === true || seen.has(child.name)) continue;
        const count =
          families.filter((f) => matchesSelection(f, child.name)).length +
          directSkus.filter((d) =>
            matchesSelection(
              { code: d.skuCode, name: d.name, brand: d.brand, submenu: d.submenu, leaf: d.subcategory, skuCount: 1 },
              child.name,
            ),
          ).length;
        if (count > 0) {
          seen.add(child.name);
          out.push(child);
        }
      }
    }
    return out;
  }, [visibleSubnodes, selection, families, directSkus]);

  const skuTotal = useMemo(
    () => families.reduce((sum, f) => sum + Number(f.skuCount || 0), 0) + directSkus.length,
    [families, directSkus],
  );

  const familyResolvedBrands = useMemo(() => {
    const map = new Map<string, string>();
    for (const fam of families) {
      const prod = productMap.get(fam.code);
      const b = resolveDisplayBrand(prod?.brand || fam.brand, prod?.name || fam.name);
      if (b) map.set(fam.code, b);
    }
    return map;
  }, [families, productMap]);

  const availableBrands = useMemo(() => {
    const counts = new Map<string, number>();
    for (const fam of families) {
      const b = familyResolvedBrands.get(fam.code);
      if (!b) continue;
      counts.set(b, (counts.get(b) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [families, familyResolvedBrands]);

  const facetProfile = useMemo(
    () => buildCategoryFacetProfile(slug, resolvedCategory?.name || '', families, productMap),
    [slug, resolvedCategory?.name, families, productMap],
  );

  const specKeyOptions = useMemo(() => {
    const keys = new Set<string>();
    for (const prod of productMap.values()) {
      for (const s of prod.technicalSpecs || []) {
        if (s.key?.trim()) keys.add(s.key.trim());
      }
    }
    return Array.from(keys).slice(0, 12);
  }, [productMap]);

  const familyArtwork = (fam: MenuFamilySummary): string => {
    const prod = productMap.get(fam.code);
    const beltMedia = getBeltFamilyMedia(fam.code, prod?.images?.[0] || prod?.image, {
      variants: prod?.variants,
      legacyFamilyCodes: prod?.legacyFamilyCodes,
    });
    if (beltMedia?.primaryThumbnail) return beltMedia.primaryThumbnail;
    if (prod?.images?.[0]) return prod.images[0];
    if (prod?.image) return prod.image;
    return resolveSiteProductImage(prod, `${fam.name} ${fam.submenu || ''} ${resolvedCategory?.name || ''}`);
  };

  const stockStats = useMemo(() => {
    let inStock = 0;
    let withImage = 0;
    for (const fam of families) {
      const prod = productMap.get(fam.code);
      if (prod && prod.stockKnown !== false && prod.stock > 0) inStock += 1;
      const beltMedia = getBeltFamilyMedia(fam.code, prod?.image, {
        variants: prod?.variants,
        legacyFamilyCodes: prod?.legacyFamilyCodes,
      });
      if (prod?.images?.length || beltMedia?.hasVerifiedRealPhoto) {
        withImage += 1;
      }
    }
    return { inStock, withImage };
  }, [families, productMap]);

  const filteredFamilies = useMemo(() => {
    const qNorm = normalizeCatalogText(queryText);
    const qTokens = qNorm ? qNorm.split(' ').filter(Boolean) : [];
    const selectedBrands = brandFilter ? brandFilter.split(',').filter(Boolean) : [];

    const matched = families.filter((fam) => {
      const prod = productMap.get(fam.code);
      if (selection && !matchesSelection(fam, selection, visibleSubnodes)) return false;

      if (selectedBrands.length > 0) {
        const famBrand = familyResolvedBrands.get(fam.code) || '';
        const hasAny = selectedBrands.some(
          (b) => famBrand === b || (prod && productHasDisplayBrand(prod, b)),
        );
        if (!hasAny) return false;
      }

      if (specValue && !matchesDynamicFacetToken(fam, prod, specValue)) return false;

      if (beltStructure) {
        const text = normalizeCatalogText(`${fam.name} ${fam.leaf || ''} ${fam.submenu || ''}`);
        if (beltStructure === 'cogged' && !/دنده|cog|xp|ax|bx|cx/.test(text)) return false;
        if (beltStructure === 'wrapped' && /دنده|متری|جوشی/.test(text)) return false;
        if (beltStructure === 'open' && !/متری|جوشی|open/.test(text)) return false;
      }

      if (beltTopWidth) {
        const text = normalizeCatalogText(`${fam.name} ${(prod?.technicalSpecs || []).map((s) => s.value).join(' ')}`);
        if (!text.includes(normalizeCatalogText(beltTopWidth))) return false;
      }

      if (inStockOnly && (!prod || !prod.stockKnown || prod.stock <= 0)) return false;

      if (imageOnly) {
        const beltMedia = getBeltFamilyMedia(fam.code, prod?.image, {
          variants: prod?.variants,
          legacyFamilyCodes: prod?.legacyFamilyCodes,
        });
        const hasImg = Boolean(prod?.images?.length || beltMedia?.hasVerifiedRealPhoto);
        if (!hasImg) return false;
      }

      if (orderMode === 'direct') {
        const hasPriced = prod && !prod.inquiryOnly && (prod.prices?.retail || 0) > 0;
        if (!hasPriced) return false;
      } else if (orderMode === 'inquiry') {
        const isInq = !prod || prod.inquiryOnly || (prod.prices?.retail || 0) <= 0;
        if (!isInq) return false;
      }

      if (lenMin || lenMax || dimMin || dimMax) {
        const dims = extractNumericDimensions(fam, prod);
        if (!matchesDimensionRange(dims, lenMin, lenMax, dimMin, dimMax)) return false;
      }

      if (qTokens.length > 0) {
        const specText =
          specFilterKey === 'all'
            ? [
                ...(prod?.technicalSpecs || []).map((s) => `${s.key} ${s.value}`),
                ...(prod?.variants || []).slice(0, 12).flatMap((v) => [
                  v.code,
                  v.size,
                  v.model || '',
                  v.name,
                ]),
              ].join(' ')
            : (prod?.technicalSpecs || [])
                .filter((s) => s.key === specFilterKey)
                .map((s) => s.value)
                .join(' ');
        const haystack = normalizeCatalogText(
          `${fam.code} ${fam.name} ${fam.brand} ${fam.submenu || ''} ${fam.leaf || ''} ${specText}`,
        );
        if (!qTokens.every((t) => haystack.includes(t))) return false;
      }

      return true;
    });

    if (sortMode === 'name') {
      return [...matched].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
    }
    if (sortMode === 'sku_desc') {
      return [...matched].sort((a, b) => b.skuCount - a.skuCount);
    }
    return [...matched].sort((a, b) => {
      const prodA = productMap.get(a.code);
      const prodB = productMap.get(b.code);
      const beltA = getBeltFamilyMedia(a.code, prodA?.image, {
        variants: prodA?.variants,
        legacyFamilyCodes: prodA?.legacyFamilyCodes,
      });
      const beltB = getBeltFamilyMedia(b.code, prodB?.image, {
        variants: prodB?.variants,
        legacyFamilyCodes: prodB?.legacyFamilyCodes,
      });
      const hasA = prodA?.images?.length || beltA?.hasVerifiedRealPhoto ? 1 : 0;
      const hasB = prodB?.images?.length || beltB?.hasVerifiedRealPhoto ? 1 : 0;
      if (hasB !== hasA) return hasB - hasA;
      return b.skuCount - a.skuCount;
    });
  }, [
    families,
    productMap,
    selection,
    visibleSubnodes,
    brandFilter,
    familyResolvedBrands,
    specValue,
    beltStructure,
    beltTopWidth,
    inStockOnly,
    imageOnly,
    orderMode,
    lenMin,
    lenMax,
    dimMin,
    dimMax,
    queryText,
    specFilterKey,
    sortMode,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredFamilies.length / pageSize));
  const currentPage = Math.min(currentPageRaw, totalPages);
  const pageFamilies = filteredFamilies.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const paginationTokens = buildPaginationWindow(currentPage, totalPages);

  const filteredDirectSkus = useMemo(() => {
    const qNorm = normalizeCatalogText(queryText);
    const qTokens = qNorm ? qNorm.split(' ').filter(Boolean) : [];
    const selectedBrands = brandFilter ? brandFilter.split(',').filter(Boolean) : [];
    return directSkus.filter((sku) => {
      if (selection) {
        const directSummary: MenuFamilySummary = {
          code: sku.skuCode,
          name: sku.name,
          brand: sku.brand,
          submenu: sku.submenu,
          leaf: sku.subcategory,
          skuCount: 1,
        };
        if (!matchesSelection(directSummary, selection, visibleSubnodes)) return false;
      }
      if (selectedBrands.length > 0) {
        const b = resolveDisplayBrand(sku.brand, sku.name);
        if (!selectedBrands.some((selB) => selB === b)) return false;
      }
      if (qTokens.length > 0) {
        const hay = normalizeCatalogText(`${sku.skuCode} ${sku.name} ${sku.brand} ${sku.submenu || ''} ${sku.subcategory || ''}`);
        if (!qTokens.every((t) => hay.includes(t))) return false;
      }
      return true;
    });
  }, [directSkus, queryText, brandFilter, selection, visibleSubnodes]);

  const toggleBrand = (brandName: string) => {
    const selected = new Set(brandFilter ? brandFilter.split(',').filter(Boolean) : []);
    if (selected.has(brandName)) selected.delete(brandName);
    else selected.add(brandName);
    updateParam('brand', Array.from(selected).join(','));
  };

  const clearFilters = () => {
    setBeltStructure('');
    setBeltTopWidth('');
    setSpecFilterKey('all');
    setSearchParams({}, { replace: true });
  };

  const activeFilterCount =
    (selection ? 1 : 0) +
    (brandFilter ? brandFilter.split(',').filter(Boolean).length : 0) +
    (specValue ? 1 : 0) +
    (queryText ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (imageOnly ? 1 : 0) +
    (orderMode !== 'all' ? 1 : 0) +
    (lenMin || lenMax || dimMin || dimMax ? 1 : 0);

  const toggleCompare = (code: string) => {
    setCompareNotice('');
    setCompareCodes((prev) => {
      if (prev.includes(code)) return prev.filter((c) => c !== code);
      if (prev.length >= 4) {
        setCompareNotice('حداکثر ۴ خانواده همزمان قابل مقایسه است.');
        return prev;
      }
      return [...prev, code];
    });
  };

  const compareFamilies = useMemo(
    () => families.filter((f) => compareCodes.includes(f.code)),
    [families, compareCodes],
  );

  const comparisonSpecs = useMemo(
    () =>
      getCommonComparisonSpecKeys(
        compareFamilies.map((f) => productMap.get(f.code)).filter((p): p is Product => Boolean(p)),
      ),
    [compareFamilies, productMap],
  );

  const detailHrefFor = (code: string) =>
    panelMode
      ? `/consumer-dashboard/product/${encodeURIComponent(code)}`
      : `/product/${encodeURIComponent(code)}`;

  if (status === 'loading') {
    return (
      <div className="excel-category-page" dir="rtl">
        <div className="excel-category-shell">
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3 mt-6">
            <div className="w-9 h-9 border-3 border-orange-200 border-t-[#E06518] rounded-full animate-spin mx-auto" />
            <h2 className="text-sm font-black text-[#2B313A]">در حال دریافت محصولات و فیلترهای دسته...</h2>
            <p className="text-xs text-slate-500">اطلاعات از پایگاه داده زنده کاتالوگ بارگذاری می‌شود.</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'not-found' || status === 'error' || !resolvedCategory) {
    return (
      <div className="excel-category-page" dir="rtl">
        <div className="excel-category-shell">
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-4 mt-6 max-w-xl mx-auto">
            <Package className="w-10 h-10 text-[#E06518] mx-auto" />
            <h2 className="text-base font-black text-[#2B313A]">
              {status === 'not-found' ? 'دسته‌بندی مورد نظر یافت نشد' : 'خطا در دریافت اطلاعات دسته'}
            </h2>
            <p className="text-xs text-slate-500">
              می‌توانید به فهرست جامع ۴۰ دسته‌بندی صنعتی بازگردید و دسته مورد نظر خود را انتخاب کنید.
            </p>
            <Link
              to="/categories"
              className="inline-flex items-center gap-2 rounded-xl bg-[#E06518] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#c85612]"
            >
              <span>بازگشت به همه دسته‌بندی‌ها</span>
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const artwork = resolveExcelCategoryArtwork(
    resolvedCategory.slug,
    resolvedCategory.name,
    resolvedCategory.image,
  );
  const selectedBrandsSet = new Set(brandFilter ? brandFilter.split(',').filter(Boolean) : []);
  const displayedFacetOptions = showAllFacetOptions
    ? facetProfile.primaryFacetOptions
    : facetProfile.primaryFacetOptions.slice(0, 6);

  const renderFilterSections = (isMobile = false) => (
    <div className="excel-filter-sections">
      {/* Brand Filter */}
      {availableBrands.length > 0 && (
        <details open className="excel-filter-group">
          <summary>
            <span>برند</span>
            <ChevronDown size={15} className="excel-filter-chevron" />
          </summary>
          <div className="excel-filter-group-body">
            <div className="excel-filter-checkbox-list">
              {availableBrands.map((b) => {
                const checked = selectedBrandsSet.has(b.name);
                return (
                  <label key={b.name} className={`excel-filter-check-row ${checked ? 'is-checked' : ''}`}>
                    <span className="excel-filter-check-main">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBrand(b.name)}
                      />
                      <span className="excel-filter-check-title">{b.name}</span>
                    </span>
                    <em className="excel-filter-check-count">({toPersianDigits(b.count)})</em>
                  </label>
                );
              })}
            </div>
          </div>
        </details>
      )}

      {/* Primary Dynamic Facet (Timing Pitch / V-Belt Profile / Spec) */}
      {facetProfile.primaryFacetOptions.length > 0 && (
        <details open className="excel-filter-group">
          <summary>
            <span>{facetProfile.primaryFacetTitle}</span>
            <ChevronDown size={15} className="excel-filter-chevron" />
          </summary>
          <div className="excel-filter-group-body">
            <div className="excel-filter-checkbox-list">
              {displayedFacetOptions.map((opt) => {
                const checked = specValue === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`excel-filter-check-row ${checked ? 'is-checked' : ''}`}
                  >
                    <span className="excel-filter-check-main">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => updateParam('spec', checked ? '' : opt.value)}
                      />
                      <span className="excel-filter-check-title">{opt.label}</span>
                    </span>
                    <em className="excel-filter-check-count">({toPersianDigits(opt.count)})</em>
                  </label>
                );
              })}
            </div>
            {facetProfile.primaryFacetOptions.length > 6 && (
              <button
                type="button"
                className="excel-filter-show-more cursor-pointer"
                onClick={() => setShowAllFacetOptions((v) => !v)}
              >
                <span>{showAllFacetOptions ? 'نمایش کمتر' : 'نمایش بیشتر'}</span>
                <ChevronDown size={13} className={showAllFacetOptions ? 'is-rotated' : ''} />
              </button>
            )}

            {/* Spec search selector matching Screenshot 4 */}
            <div className="excel-sidebar-spec-search">
              <span>جستجوی دقیق مشخصه یا پروفیل</span>
              <select
                value={specFilterKey}
                onChange={(e) => setSpecFilterKey(e.target.value)}
                aria-label="فیلتر بر اساس نوع مشخصه فنی"
              >
                <option value="all">همه مشخصات فنی</option>
                {specKeyOptions.map((key) => (
                  <option key={key} value={key}>
                    {key}
                  </option>
                ))}
              </select>
              <input
                type="search"
                value={queryText}
                onChange={(e) => updateParam('q', e.target.value)}
                placeholder={facetProfile.searchPlaceholder}
                aria-label="جستجوی کد یا مشخصه"
              />
            </div>
          </div>
        </details>
      )}

      {/* Dimension Range Filter */}
      <details open className="excel-filter-group">
        <summary>
          <span>{facetProfile.dimensionTitle}</span>
          <ChevronDown size={15} className="excel-filter-chevron" />
        </summary>
        <div className="excel-filter-group-body space-y-2.5">
          <div className="excel-dim-range-block">
            <span className="excel-dim-range-label">{facetProfile.primaryDimLabel}</span>
            <div className="excel-dim-range-inputs">
              <input
                type="text"
                inputMode="decimal"
                placeholder="از"
                value={lenMin}
                onChange={(e) => updateParam('lenMin', e.target.value)}
                aria-label={`${facetProfile.primaryDimLabel} از`}
              />
              <span>تا</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="تا"
                value={lenMax}
                onChange={(e) => updateParam('lenMax', e.target.value)}
                aria-label={`${facetProfile.primaryDimLabel} تا`}
              />
            </div>
          </div>
          <div className="excel-dim-range-block">
            <span className="excel-dim-range-label">{facetProfile.secondaryDimLabel}</span>
            <div className="excel-dim-range-inputs">
              <input
                type="text"
                inputMode="decimal"
                placeholder="از"
                value={dimMin}
                onChange={(e) => updateParam('dimMin', e.target.value)}
                aria-label={`${facetProfile.secondaryDimLabel} از`}
              />
              <span>تا</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="تا"
                value={dimMax}
                onChange={(e) => updateParam('dimMax', e.target.value)}
                aria-label={`${facetProfile.secondaryDimLabel} تا`}
              />
            </div>
          </div>
        </div>
      </details>

      {/* Order Mode Filter */}
      <details className="excel-filter-group">
        <summary>
          <span>نحوه سفارش و قیمت</span>
          <ChevronDown size={15} className="excel-filter-chevron" />
        </summary>
        <div className="excel-filter-group-body">
          <div className="excel-filter-checkbox-list">
            {[
              { id: 'all', label: 'همه روش‌های تأمین' },
              { id: 'direct', label: 'دارای قیمت ثبت‌شده' },
              { id: 'inquiry', label: 'نیازمند استعلام قیمت' },
            ].map((opt) => (
              <label
                key={opt.id}
                className={`excel-filter-check-row ${orderMode === opt.id ? 'is-checked' : ''}`}
              >
                <span className="excel-filter-check-main">
                  <input
                    type="radio"
                    name={isMobile ? 'orderModeMobile' : 'orderModeDesktop'}
                    checked={orderMode === opt.id}
                    onChange={() => updateParam('orderMode', opt.id === 'all' ? '' : opt.id)}
                  />
                  <span className="excel-filter-check-title">{opt.label}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      </details>

      {/* Stock & Image Status */}
      <details open className="excel-filter-group">
        <summary>
          <span>وضعیت موجودی</span>
          <ChevronDown size={15} className="excel-filter-chevron" />
        </summary>
        <div className="excel-filter-group-body">
          <div className="excel-filter-checkbox-list">
            <label className={`excel-filter-check-row ${inStockOnly ? 'is-checked' : ''}`}>
              <span className="excel-filter-check-main">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => updateParam('inStock', e.target.checked ? '1' : '')}
                />
                <span className="excel-filter-check-title">موجود در انبار</span>
              </span>
              <em className="excel-filter-check-count">({toPersianDigits(stockStats.inStock)})</em>
            </label>
            <label className={`excel-filter-check-row ${imageOnly ? 'is-checked' : ''}`}>
              <span className="excel-filter-check-main">
                <input
                  type="checkbox"
                  checked={imageOnly}
                  onChange={(e) => updateParam('hasImage', e.target.checked ? '1' : '')}
                />
                <span className="excel-filter-check-title">دارای تصویر ثبت‌شده</span>
              </span>
              <em className="excel-filter-check-count">({toPersianDigits(stockStats.withImage)})</em>
            </label>
          </div>
        </div>
      </details>
    </div>
  );

  return (
    <div className="excel-category-page" dir="rtl">
      <div className="excel-category-shell">
        <nav className="excel-category-breadcrumbs" aria-label="مسیر صفحه">
          <Link to="/">صفحه اصلی</Link>
          <ChevronLeft size={13} />
          <Link to="/categories">دسته‌بندی‌ها</Link>
          <ChevronLeft size={13} />
          <span aria-current="page">{resolvedCategory.name}</span>
        </nav>

        {/* Hero Card matching Screenshot 3 */}
        <header className="excel-category-hero">
          <div className="excel-category-hero-copy">
            <h1>{resolvedCategory.name}</h1>
            <span className="excel-category-hero-accent-rule" aria-hidden="true" />
            <p>
              {resolvedCategory.description ||
                `تأمین انواع ${resolvedCategory.name} صنعتی از برندهای معتبر، مناسب انتقال دقیق دور و گشتاور در ماشین‌آلات خطوط تولید و بسته‌بندی همراه با مشاوره فنی و ارسال سریع.`}
            </p>
            <div className="excel-category-hero-features">
              <Link to="/products" className="excel-category-hero-feature-card">
                <span className="excel-feature-icon">
                  <Truck size={18} />
                </span>
                <span>ارسال سریع و مطمئن</span>
              </Link>
              <button
                type="button"
                onClick={() =>
                  openInquiryModal({
                    code: slug,
                    name: `مشاوره تخصصی برای دسته ${resolvedCategory.name}`,
                    unit: 'درخواست',
                    quantity: 1,
                  })
                }
                className="excel-category-hero-feature-card cursor-pointer"
              >
                <span className="excel-feature-icon">
                  <Headphones size={18} />
                </span>
                <span>مشاوره فنی تخصصی</span>
              </button>
              <Link to="/products" className="excel-category-hero-feature-card excel-feature-identify">
                <span className="excel-feature-icon">
                  <Search size={17} />
                </span>
                <span>جستجوی کد فنی در کاتالوگ</span>
              </Link>
            </div>

            <div className="excel-category-hero-meta-line">
              <span>{toPersianDigits(families.length)} خانواده ثبت‌شده</span>
              <i aria-hidden="true">·</i>
              <span>{toPersianDigits(skuTotal)} کد فنی و سایز</span>
              {availableBrands.length > 0 && (
                <>
                  <i aria-hidden="true">·</i>
                  <span>{toPersianDigits(availableBrands.length)} برند صنعتی</span>
                </>
              )}
            </div>
          </div>

          <div className="excel-category-hero-visual">
            {artwork ? (
              <img
                src={artwork}
                alt={resolvedCategory.name}
                loading="eager"
                decoding="async"
              />
            ) : (
              <div className="excel-category-hero-placeholder" aria-hidden="true">
                <Package size={58} />
              </div>
            )}
          </div>
        </header>

        {/* 4-Card Subcategory Strip matching Screenshot 3 */}
        {stripNodes.length > 0 && (
          <section className="excel-category-subnav" aria-label="انتخاب زیرگروه">
            <div className={`excel-category-subgrid count-${Math.min(4, stripNodes.length)}`}>
              {stripNodes.map((node) => {
                const isSelected = node.isAllOption ? !selection : selection === node.name;
                const nodeFamilies = node.isAllOption
                  ? families
                  : families.filter((fam) => matchesSelection(fam, node.name, visibleSubnodes));
                const nodeDirectSkus = node.isAllOption
                  ? directSkus
                  : directSkus.filter((d) =>
                      matchesSelection(
                        {
                          code: d.skuCode,
                          name: d.name,
                          brand: d.brand,
                          submenu: d.submenu,
                          leaf: d.subcategory,
                          skuCount: 1,
                        },
                        node.name,
                        visibleSubnodes,
                      ),
                    );
                const subCountText =
                  nodeFamilies.length > 0
                    ? nodeDirectSkus.length > 0 && !node.isAllOption
                      ? `${toPersianDigits(nodeFamilies.length)} خانواده · ${toPersianDigits(nodeDirectSkus.length)} کد`
                      : `${toPersianDigits(nodeFamilies.length)} خانواده`
                    : nodeDirectSkus.length > 0
                      ? `${toPersianDigits(nodeDirectSkus.length)} کد مستقیم`
                      : '۰ خانواده';
                const thumbSrc = node.isAllOption
                  ? artwork
                  : resolveSubcategoryThumb(node.name, resolvedCategory.name, resolvedCategory.slug);
                return (
                  <button
                    key={node.key}
                    type="button"
                    aria-pressed={isSelected}
                    className={`excel-subcard cursor-pointer ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => updateParam('sub', node.isAllOption || isSelected ? '' : node.name)}
                  >
                    <div className="excel-subcard-media">
                      <img src={thumbSrc} alt={node.name} loading="eager" decoding="async" />
                    </div>
                    <div className="excel-subcard-footer">
                      <div className="excel-subcard-titles">
                        <strong>{node.name}</strong>
                        <small>{subCountText}</small>
                      </div>
                      <ChevronLeft size={17} className="excel-subcard-arrow" />
                    </div>
                  </button>
                );
              })}
            </div>

            {leafFilterNodes.length > 0 && (
              <div className="excel-subleaf-strip" aria-label="زیرشاخه‌های تخصصی">
                <span>زیرشاخه‌های تخصصی:</span>
                <div className="excel-subleaf-list">
                  {leafFilterNodes.map((child) => {
                    const active = selection === child.name;
                    const count =
                      families.filter((fam) => matchesSelection(fam, child.name)).length +
                      directSkus.filter((d) =>
                        matchesSelection(
                          { code: d.skuCode, name: d.name, brand: d.brand, submenu: d.submenu, leaf: d.subcategory, skuCount: 1 },
                          child.name,
                        ),
                      ).length;
                    return (
                      <button
                        key={child.name}
                        type="button"
                        aria-pressed={active}
                        className={`cursor-pointer ${active ? 'is-active' : ''}`}
                        onClick={() => updateParam('sub', active ? '' : child.name)}
                      >
                        <b>{child.name}</b>
                        <span>{toPersianDigits(count)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* V-Belt Cross-Section Engineering Matrix (excel-v2-1-2) */}
        {isVBeltCategory && (
          <section className="excel-vbelt-matrix" aria-label="انتخابگر مهندسی پروفیل و مقطع وی‌بلت">
            <div className="excel-vbelt-matrix-header">
              <div>
                <span className="excel-vbelt-matrix-eyebrow">
                  <Ruler size={13} /> جدول مهندسی مقاطع استاندارد وی‌بلت (DIN 2215 / DIN 7753)
                </span>
                <h2>انتخاب سریع بر اساس تیپ پروفیل، ساختار دندانه و عرض بالای مقطع</h2>
              </div>
              <div className="excel-vbelt-header-actions">
                {(specValue || beltStructure || beltTopWidth) && (
                  <button
                    type="button"
                    className="excel-vbelt-matrix-reset cursor-pointer"
                    onClick={() => {
                      updateParam('spec', '');
                      setBeltStructure('');
                      setBeltTopWidth('');
                    }}
                  >
                    <RotateCcw size={13} /> پاک کردن انتخاب
                  </button>
                )}
                <button
                  type="button"
                  className="excel-vbelt-matrix-toggle cursor-pointer"
                  onClick={() => setVbeltMatrixOpen((v) => !v)}
                  aria-expanded={vbeltMatrixOpen}
                >
                  <span>{vbeltMatrixOpen ? 'بستن جدول مقاطع' : 'باز کردن جدول مقاطع'}</span>
                  <ChevronDown size={15} className={vbeltMatrixOpen ? 'is-rotated' : ''} />
                </button>
              </div>
            </div>

            {vbeltMatrixOpen && (
              <>
                <div className="excel-vbelt-groups-grid">
                  {VBELT_SECTION_GROUPS.map((grp) => (
                    <div key={grp.id} className="excel-vbelt-group-card">
                      <div className="excel-vbelt-group-head">
                        <div>
                          <h3>{grp.title}</h3>
                          <p>{grp.subtitle}</p>
                        </div>
                        <span className="excel-vbelt-standard-tag">{grp.standard}</span>
                      </div>
                      <div className="excel-vbelt-profile-chips">
                        {grp.profiles.map((p) => {
                          const active = specValue === p.code;
                          return (
                            <button
                              key={p.code}
                              type="button"
                              onClick={() => updateParam('spec', active ? '' : p.code)}
                              className={`excel-vbelt-profile-btn cursor-pointer ${active ? 'is-active' : ''}`}
                            >
                              <span className="excel-vbelt-profile-top">
                                <strong>{p.code}</strong>
                              </span>
                              <small dir="ltr">{p.size} mm</small>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="excel-vbelt-facets-bar">
                  <div className="excel-vbelt-facet-group">
                    <span className="excel-vbelt-facet-label">ساختار:</span>
                    <div className="excel-vbelt-facet-pills">
                      {VBELT_STRUCTURES.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setBeltStructure((v) => (v === st.id ? '' : st.id))}
                          className={`cursor-pointer ${beltStructure === st.id ? 'is-active' : ''}`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        {/* 2-Column Catalog Workspace matching Screenshot 4 */}
        <div className="excel-category-shop">
          {/* Right Sticky Filter Sidebar */}
          <aside className="excel-category-filter-panel" aria-label="فیلتر محصولات">
            <div className="excel-category-filter-heading">
              <div>
                <SlidersHorizontal size={16} />
                <strong>فیلتر محصولات</strong>
              </div>
              <button
                type="button"
                onClick={clearFilters}
                title="بازنشانی فیلترها"
                aria-label="بازنشانی فیلترها"
                className="cursor-pointer"
              >
                <RotateCcw size={14} />
              </button>
            </div>
            {renderFilterSections(false)}
          </aside>

          {/* Left Results Column */}
          <section className="excel-category-results" ref={resultsRef} aria-label="فهرست خانواده‌های محصول">
            {/* Toolbar */}
            <div className="excel-category-toolbar">
              <div className="excel-toolbar-controls-right">
                <label className="excel-toolbar-select-group">
                  <span>نمایش</span>
                  <select
                    value={pageSize}
                    onChange={(e) => updateParam('limit', e.target.value)}
                    aria-label="تعداد نمایش در صفحه"
                  >
                    <option value="12">{toPersianDigits(12)} کالا</option>
                    <option value="24">{toPersianDigits(24)} کالا</option>
                    <option value="36">{toPersianDigits(36)} کالا</option>
                    <option value="48">{toPersianDigits(48)} کالا</option>
                  </select>
                </label>

                <label className="excel-toolbar-select-group">
                  <span>مرتب‌سازی:</span>
                  <select
                    value={sortMode}
                    onChange={(e) => updateParam('sort', e.target.value)}
                    aria-label="مرتب‌سازی محصولات"
                  >
                    <option value="featured">پرفروش‌ترین / منتخب</option>
                    <option value="sku_desc">بیشترین تنوع کد فنی</option>
                    <option value="name">الفبایی نام</option>
                  </select>
                </label>

                <div className="excel-toolbar-search">
                  <Search size={15} />
                  <input
                    type="search"
                    value={queryText}
                    onChange={(e) => updateParam('q', e.target.value)}
                    placeholder={facetProfile.searchPlaceholder}
                    aria-label="جستجو در این دسته"
                  />
                  {queryText && (
                    <button
                      type="button"
                      onClick={() => updateParam('q', '')}
                      aria-label="پاک کردن جستجو"
                      className="cursor-pointer"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              <div className="excel-toolbar-controls-left">
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(true)}
                  className="excel-category-mobile-filter cursor-pointer"
                >
                  <SlidersHorizontal size={14} />
                  <span>فیلترها</span>
                  {activeFilterCount > 0 && <b>{toPersianDigits(activeFilterCount)}</b>}
                </button>

                <div className="excel-view-switcher" role="group" aria-label="حالت نمایش محصولات">
                  <button
                    type="button"
                    aria-label="نمای شبکه‌ای"
                    aria-pressed={viewMode === 'grid'}
                    className={`cursor-pointer ${viewMode === 'grid' ? 'is-active' : ''}`}
                    onClick={() => updateParam('view', 'grid', false)}
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    aria-label="نمای فهرستی"
                    aria-pressed={viewMode === 'list'}
                    className={`cursor-pointer ${viewMode === 'list' ? 'is-active' : ''}`}
                    onClick={() => updateParam('view', 'list', false)}
                  >
                    <ListIcon size={15} />
                  </button>
                </div>

                <span className="excel-toolbar-counter">
                  {filteredFamilies.length > 0 ? (
                    <>
                      نمایش {toPersianDigits(pageFamilies.length ? (currentPage - 1) * pageSize + 1 : 0)} تا{' '}
                      {toPersianDigits(Math.min(currentPage * pageSize, filteredFamilies.length))} از{' '}
                      {toPersianDigits(filteredFamilies.length)} خانواده
                    </>
                  ) : (
                    <>نمایش {toPersianDigits(filteredDirectSkus.length)} کد کالای مستقیم</>
                  )}
                </span>
              </div>
            </div>

            {/* Active Filter Chips */}
            {activeFilterCount > 0 && (
              <div className="excel-category-active-filters">
                <b>فیلترهای فعال:</b>
                {selection && (
                  <button type="button" onClick={() => updateParam('sub', '')} className="cursor-pointer">
                    زیرگروه: {selection} <X size={12} />
                  </button>
                )}
                {Array.from(selectedBrandsSet).map((b) => (
                  <button key={b} type="button" onClick={() => toggleBrand(b)} className="cursor-pointer">
                    برند: {b} <X size={12} />
                  </button>
                ))}
                {specValue && (
                  <button type="button" onClick={() => updateParam('spec', '')} className="cursor-pointer">
                    پروفیل: {specValue} <X size={12} />
                  </button>
                )}
                <button type="button" onClick={clearFilters} className="is-reset cursor-pointer">
                  پاک کردن همه
                </button>
              </div>
            )}

            {/* Families Grid / List */}
            {pageFamilies.length === 0 && filteredDirectSkus.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-10 text-center space-y-3">
                <Package className="w-9 h-9 text-slate-400 mx-auto" />
                <h3 className="text-sm font-black text-[#2B313A]">محصولی با این فیلترها پیدا نشد</h3>
                <p className="text-xs text-slate-500">
                  فیلترهای انتخابی را تغییر دهید یا از جستجوی جامع کل کاتالوگ استفاده کنید.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#E06518] px-4 py-2 text-xs font-bold text-white cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>نمایش همه محصولات این دسته</span>
                </button>
              </div>
            ) : pageFamilies.length > 0 ? (
              <div
                className={`excel-category-product-grid ${viewMode === 'list' ? 'is-list' : ''}`}
              >
                {pageFamilies.map((family) => {
                  const prod = productMap.get(family.code);
                  const resolvedBrand = familyResolvedBrands.get(family.code) || family.brand;
                  const artworkSrc = familyArtwork(family);
                  const isCompared = compareCodes.includes(family.code);
                  const specsPreview = (prod?.technicalSpecs || [])
                    .filter((s) => s.key && s.value && !/توضیح|توالی/i.test(s.key))
                    .slice(0, 2);
                  const retailPrice = prod?.prices?.retail || 0;
                  const isInquiry = !prod || prod.inquiryOnly || retailPrice <= 0;
                  const detailHref = detailHrefFor(family.code);

                  return (
                    <div key={family.code} className="excel-category-product-shell">
                      <article className={`excel-card ${viewMode === 'list' ? 'is-list-row' : ''}`}>
                        <div className="excel-card-media">
                          <Link to={detailHref}>
                            <img src={artworkSrc} alt={family.name} loading="lazy" decoding="async" />
                          </Link>
                        </div>

                        <div className="excel-card-body">
                          <Link to={detailHref} className="excel-card-title">
                            {family.name}
                          </Link>

                          <div className="excel-card-specs">
                            {specsPreview.length > 0 ? (
                              specsPreview.map((spec, idx) => (
                                <React.Fragment key={spec.key}>
                                  {idx > 0 && <span className="excel-card-spec-sep" aria-hidden="true">|</span>}
                                  <span className="excel-card-spec-item">
                                    <em>{spec.key}:</em> <b>{spec.value}</b>
                                  </span>
                                </React.Fragment>
                              ))
                            ) : (
                              <>
                                <span className="excel-card-spec-item">
                                  <em>برند:</em> <b>{resolvedBrand || 'ثبت نشده'}</b>
                                </span>
                                <span className="excel-card-spec-sep" aria-hidden="true">|</span>
                                <span className="excel-card-spec-item">
                                  <em>تنوع:</em> <b>{toPersianDigits(family.skuCount)} کد فنی</b>
                                </span>
                              </>
                            )}
                          </div>

                          <div className="excel-card-status-block">
                            <span className="excel-card-stock is-supply">
                              <i aria-hidden="true" />
                              آماده تأمین ({toPersianDigits(Math.max(1, family.skuCount))} کد)
                            </span>
                            <span className="excel-card-price">
                              {panelMode && !isInquiry
                                ? `${formatPrice(retailPrice)} تومان`
                                : 'مشاهده قیمت در پنل'}
                            </span>
                          </div>

                          <Link to={detailHref} className="excel-card-cta">
                            <ShoppingCart size={15} />
                            <span>انتخاب سایز و خرید</span>
                          </Link>

                          <div className="excel-card-footer">
                            <label className="excel-card-compare-check">
                              <input
                                type="checkbox"
                                checked={isCompared}
                                onChange={() => toggleCompare(family.code)}
                              />
                              <span>مقایسه</span>
                            </label>
                            <span className="excel-card-meta-brand" dir="ltr">
                              {resolvedBrand ? `${resolvedBrand} · ` : ''}
                              {family.code}
                            </span>
                          </div>
                        </div>
                      </article>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* Direct SKUs attached to category if present */}
            {filteredDirectSkus.length > 0 && (
              <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-black text-[#2B313A] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#E06518]" />
                    <span>کدهای کالای مستقیم ثبت‌شده در این دسته ({toPersianDigits(filteredDirectSkus.length)})</span>
                  </h3>
                  {filteredDirectSkus.length > 12 && (
                    <button
                      type="button"
                      onClick={() => setShowAllDirectSkus((prev) => !prev)}
                      className="text-xs font-bold text-[#E06518] hover:underline cursor-pointer"
                    >
                      {showAllDirectSkus
                        ? 'نمایش کمتر'
                        : `نمایش همه (${toPersianDigits(filteredDirectSkus.length)} کد)`}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {(showAllDirectSkus ? filteredDirectSkus : filteredDirectSkus.slice(0, 12)).map((sku) => (
                    <Link
                      key={sku.skuCode}
                      to={`/direct-product/${encodeURIComponent(sku.skuCode)}`}
                      className="rounded-xl border border-slate-200 p-3 hover:border-[#E06518] transition-colors flex flex-col gap-1.5 bg-[#FAF8F5]/60"
                    >
                      <div className="text-xs font-bold text-[#2B313A] line-clamp-2">{sku.name}</div>
                      <div className="text-[11px] font-mono font-bold text-[#E06518]" dir="ltr">
                        {sku.skuCode} {sku.brand ? `· ${sku.brand}` : ''}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="excel-category-pagination" aria-label="صفحه‌بندی محصولات">
                <button
                  type="button"
                  className="excel-page-arrow cursor-pointer"
                  disabled={currentPage <= 1}
                  aria-label="صفحه قبلی"
                  onClick={() => updateParam('page', String(currentPage - 1), false)}
                >
                  <ChevronRight size={15} />
                </button>
                {paginationTokens.map((token, idx) =>
                  token === 'ellipsis' ? (
                    <span key={`ellipsis-${idx}`} className="excel-page-ellipsis" aria-hidden="true">
                      …
                    </span>
                  ) : (
                    <button
                      key={token}
                      type="button"
                      className={`excel-page-num cursor-pointer ${token === currentPage ? 'is-active' : ''}`}
                      aria-current={token === currentPage ? 'page' : undefined}
                      onClick={() => updateParam('page', String(token), false)}
                    >
                      {toPersianDigits(token)}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  className="excel-page-arrow cursor-pointer"
                  disabled={currentPage >= totalPages}
                  aria-label="صفحه بعدی"
                  onClick={() => updateParam('page', String(currentPage + 1), false)}
                >
                  <ChevronLeft size={15} />
                </button>
              </nav>
            )}
          </section>
        </div>
      </div>

      {/* Compare Dock */}
      {compareCodes.length > 0 && (
        <div className="excel-category-compare-dock" role="region" aria-label="نوار مقایسه محصولات">
          <div>
            <strong>
              مقایسه خانواده‌ها <span>{toPersianDigits(compareCodes.length)}/۴</span>
            </strong>
            <small>{compareFamilies.map((f) => f.name).join('، ')}</small>
            {compareNotice && <small className="excel-category-compare-notice">{compareNotice}</small>}
          </div>
          <div>
            <button
              type="button"
              className="excel-category-compare-clear cursor-pointer"
              onClick={() => {
                setCompareCodes([]);
                setCompareNotice('');
              }}
            >
              پاک کردن
            </button>
            <button
              type="button"
              className="excel-category-compare-open cursor-pointer"
              disabled={compareFamilies.length < 2}
              onClick={() => setComparisonOpen(true)}
            >
              مقایسه {toPersianDigits(compareFamilies.length)} مورد <ArrowLeftRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Filter Sheet */}
      {mobileFiltersOpen && (
        <div className="excel-category-modal-backdrop" onMouseDown={() => setMobileFiltersOpen(false)}>
          <section
            className="excel-category-filter-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="فیلترهای دسته‌بندی"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header>
              <strong>فیلتر محصولات — {resolvedCategory.name}</strong>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label="بستن فیلترها"
                className="cursor-pointer"
              >
                <X size={19} />
              </button>
            </header>
            <div className="excel-category-filter-sheet-content">{renderFilterSections(true)}</div>
            <footer>
              <button type="button" onClick={clearFilters} className="cursor-pointer">
                پاک کردن فیلترها
              </button>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                className="cursor-pointer"
              >
                نمایش {toPersianDigits(filteredFamilies.length)} نتیجه
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* Comparison Modal */}
      {comparisonOpen && compareFamilies.length > 1 && (
        <div
          className="excel-category-modal-backdrop excel-category-compare-backdrop"
          onMouseDown={() => setComparisonOpen(false)}
        >
          <section
            className="excel-category-compare-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="excel-category-compare-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <span>مقایسه فنی</span>
                <h2 id="excel-category-compare-title">مقایسه خانواده‌های انتخاب‌شده</h2>
              </div>
              <button
                type="button"
                onClick={() => setComparisonOpen(false)}
                aria-label="بستن مقایسه"
                className="cursor-pointer"
              >
                <X size={19} />
              </button>
            </header>
            <div className="excel-category-compare-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>مشخصه</th>
                    {compareFamilies.map((f) => (
                      <th key={f.code}>
                        {f.name}
                        <code dir="ltr">{f.code}</code>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>برند</th>
                    {compareFamilies.map((f) => (
                      <td key={f.code}>{familyResolvedBrands.get(f.code) || f.brand || '—'}</td>
                    ))}
                  </tr>
                  <tr>
                    <th>زیرگروه</th>
                    {compareFamilies.map((f) => (
                      <td key={f.code}>{f.leaf || f.submenu || '—'}</td>
                    ))}
                  </tr>
                  <tr>
                    <th>تعداد کد و سایز</th>
                    {compareFamilies.map((f) => (
                      <td key={f.code}>{toPersianDigits(f.skuCount)}</td>
                    ))}
                  </tr>
                  {comparisonSpecs.map((specKey) => (
                    <tr key={specKey}>
                      <th>{specKey}</th>
                      {compareFamilies.map((f) => {
                        const p = productMap.get(f.code);
                        const vals = [
                          ...(p?.technicalSpecs || []),
                          ...(p?.variants || []).flatMap((v) => v.technicalSpecs || []),
                        ]
                          .filter((s) => s.key === specKey)
                          .map((s) => s.value)
                          .filter(Boolean);
                        return <td key={f.code}>{Array.from(new Set(vals)).join('، ') || '—'}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer>
              <span>کلیه مشخصات فنی مستقیماً از پایگاه داده کاتالوگ خوانده می‌شوند.</span>
              <button type="button" onClick={() => setComparisonOpen(false)} className="cursor-pointer">
                بستن مقایسه
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};

export default ExcelMenuCategoryPage;
