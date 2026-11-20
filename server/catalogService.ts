import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { database, databaseEnabled, resetDatabasePool } from './db/connection.ts';
import { APPROVED_MENU_CATEGORIES, APPROVED_MENU_GROUPS } from '../src/data/approvedMenuFallback.ts';
import { normalizeCatalogText } from '../src/utils/excelCategoryCatalog.ts';
import { resolveDisplayBrand } from '../src/utils/catalogBrands.ts';
import type { Brand, Category, DirectSku, Product, ProductGalleryImage, TechnicalSpec } from '../src/types.ts';

export interface NavigationGroup {
  id: string;
  title: string;
  iconKey: string;
  imageUrl: string | null;
  categorySlugs: string[];
  sortOrder: number;
  active: boolean;
}

export interface MenuAssignment {
  categorySlug: string;
  submenuName: string;
  leafName: string | null;
  method?: string;
}

interface CatalogSnapshot {
  loadedAt: number;
  groups: NavigationGroup[];
  categories: Category[];
  products: Product[];
  productByCode: Map<string, Product>;
  productByVariantCode: Map<string, Product>;
  aliasMap: Map<string, { newFamilyCode?: string; directSkuCode?: string }>;
  assignmentsByFamily: Map<string, MenuAssignment>;
  directSkus: DirectSku[];
  brands: Brand[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
const ENGINEERED_SNAPSHOT_PATH = path.resolve(process.cwd(), 'server/data/engineeredCatalog.json');
let snapshotCache: CatalogSnapshot | null = null;
let inFlightLoad: Promise<CatalogSnapshot> | null = null;
const inMemoryInquiries: Array<Record<string, unknown>> = [];

function isTransientDbConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = String((err as { code?: unknown }).code || '').toUpperCase();
  if (['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'ECONNREFUSED', '57P01', '57P02', '57P03', '08000', '08003', '08006'].includes(code)) {
    return true;
  }
  const msg = String((err as { message?: unknown }).message || '').toLowerCase();
  return (
    msg.includes('connection terminated') ||
    msg.includes('client has encountered a connection error') ||
    msg.includes('connection ended unexpectedly') ||
    msg.includes('socket hang up') ||
    msg.includes('timeout expired') ||
    msg.includes('econnreset')
  );
}

async function withDatabaseRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (err) {
    if (!isTransientDbConnectionError(err)) throw err;
    await resetDatabasePool();
    return await operation();
  }
}

function toman(amount: unknown, currency: unknown): number {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return String(currency || '').toUpperCase() === 'IRR' ? Math.round(numeric / 10) : Math.round(numeric);
}

function asArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  if (typeof val === 'string' && val.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function buildCatalogSnapshot(): Promise<CatalogSnapshot> {
  const pool = database();
  const [
    baseSnap,
    groupRes,
    categoryRes,
    commercialRes,
    galleryRes,
    familyImgRes,
    brandRes,
    aliasRes,
  ] = await Promise.all([
    buildSnapshotFromEngineeredJson(),
    pool.query(
      `select id, title, icon_key as "iconKey", image_url as "imageUrl",
              category_slugs as "categorySlugs", sort_order as "sortOrder", is_active as active
       from public.catalog_navigation_groups
       where is_active = true
       order by sort_order, id`,
    ),
    pool.query(
      `select id, slug, name, icon, image_url as image, description,
              sort_order as "sortOrder", is_active as active, metadata
       from public.catalog_categories
       where is_active = true
       order by sort_order, name`,
    ),
    pool.query(
      `select variant_code, price, base_price, retail_price, wholesale_price, dealer_price,
              stock, stock_reserved, stock_known, inquiry_only, currency
       from public.variant_commercial_specs`,
    ),
    pool.query(
      `select g.id, g.family_code, g.variant_code, g.file_name, g.url, g.scope, g.title, g.sort_order, g.identity_verified
       from public.catalog_gallery_images g
       order by g.sort_order, g.id`,
    ),
    pool.query(
      `select code, images from public.catalog_families where is_active = true and is_deleted = false`,
    ),
    pool.query(
      `select id, name, slug, logo_url as "logoUrl", country, description, is_featured as "isFeatured"
       from public.catalog_brands
       order by sort_order, name`,
    ),
    pool.query(
      `select old_family_code, new_family_code, direct_sku_code
       from public.catalog_family_aliases`,
    ),
  ]);

  // Index live commercial specs by variant_code
  const commercialByVariant = new Map<string, {
    prices: { base: number; retail: number; wholesale: number; dealer: number };
    price: number;
    stock: number;
    stockKnown: boolean;
    inquiryOnly: boolean;
  }>();
  for (const c of commercialRes.rows) {
    const code = String(c.variant_code || '').trim().toLowerCase();
    if (!code) continue;
    const retail = toman(c.retail_price || c.price, c.currency);
    commercialByVariant.set(code, {
      prices: {
        base: toman(c.base_price, c.currency),
        retail,
        wholesale: toman(c.wholesale_price, c.currency),
        dealer: toman(c.dealer_price, c.currency),
      },
      price: retail,
      stock: Math.max(0, Number(c.stock || 0) - Number(c.stock_reserved || 0)),
      stockKnown: c.stock_known === true,
      inquiryOnly: c.inquiry_only !== false,
    });
  }

  // Index DB gallery images by variantCode and DB familyCode (including old_family_code aliases)
  const dbFamilyByOldCode = new Map<string, string>();
  for (const a of aliasRes.rows) {
    if (a.old_family_code && a.new_family_code) {
      dbFamilyByOldCode.set(String(a.old_family_code).toLowerCase(), String(a.new_family_code));
    }
  }
  const dbFamilyImagesByCode = new Map<string, string[]>();
  for (const row of familyImgRes.rows) {
    const imgs = asArray<string>(row.images).filter(Boolean);
    if (imgs.length && row.code) {
      dbFamilyImagesByCode.set(String(row.code), imgs);
    }
  }
  const galleryByDbFamily = new Map<string, ProductGalleryImage[]>();
  const galleryByVariantCode = new Map<string, ProductGalleryImage[]>();
  for (const img of galleryRes.rows) {
    const entry: ProductGalleryImage = {
      id: img.id,
      url: img.url,
      fileName: img.file_name || '',
      scope: img.scope === 'variant' ? 'variant' : 'family',
      variantCode: img.variant_code || undefined,
      identityVerified: img.identity_verified === true,
      title: img.title || '',
      order: Number(img.sort_order) || 0,
    };
    if (img.family_code) {
      const list = galleryByDbFamily.get(String(img.family_code)) || [];
      list.push(entry);
      galleryByDbFamily.set(String(img.family_code), list);
    }
    if (img.variant_code) {
      const vKey = String(img.variant_code).toLowerCase();
      const list = galleryByVariantCode.get(vKey) || [];
      list.push(entry);
      galleryByVariantCode.set(vKey, list);
    }
  }

  // Merge live DB commercial specs & images onto engineered products
  // Strict audit rule (Laws 4 & 5): Do NOT merge unverified/duplicate legacy PostgreSQL images onto audited belt families.
  const AUDITED_BELT_SLUGS = new Set([
    'excel-v2-1-1',
    'excel-v2-1-2',
    'excel-v2-1-3',
    'excel-v2-1-5',
  ]);
  const isAuditedBeltProduct = (p: Product): boolean => {
    const slug = p.resolvedAssignment?.categorySlug || p.categorySlug;
    if (AUDITED_BELT_SLUGS.has(slug)) return true;
    if (slug === 'excel-v2-1-4') {
      return !/دستگاه|قیچی|هویه|گیره/.test(`${p.name} ${p.resolvedAssignment?.submenuName || ''}`);
    }
    return false;
  };

  for (const product of baseSnap.products) {
    const isAuditedBelt = isAuditedBeltProduct(product);
    const matchedGallery: ProductGalleryImage[] = [...(product.galleryImages || [])];
    const seenGalleryUrls = new Set(matchedGallery.map((g) => g.url));
    const dbFamilyImgs = new Set<string>();

    const attachGallery = (items: ProductGalleryImage[] | undefined) => {
      for (const g of items || []) {
        if (!g.url || seenGalleryUrls.has(g.url)) continue;
        if (isAuditedBelt && g.scope === 'family') continue;
        if (isAuditedBelt && !g.identityVerified) continue;
        seenGalleryUrls.add(g.url);
        matchedGallery.push(g);
        if (g.scope === 'family') dbFamilyImgs.add(g.url);
      }
    };

    if (!isAuditedBelt) {
      attachGallery(galleryByDbFamily.get(product.code));
      for (const url of dbFamilyImagesByCode.get(product.code) || []) {
        dbFamilyImgs.add(url);
      }
      for (const oldCode of product.legacyFamilyCodes || []) {
        const dbFamCode = dbFamilyByOldCode.get(oldCode.toLowerCase());
        if (dbFamCode) {
          attachGallery(galleryByDbFamily.get(dbFamCode));
          for (const url of dbFamilyImagesByCode.get(dbFamCode) || []) {
            dbFamilyImgs.add(url);
          }
        }
      }
    }

    const updatedVariants = (product.variants || []).map((v) => {
      const vKey = String(v.code || '').toLowerCase();
      const comm = commercialByVariant.get(vKey);
      const rawVarGal = galleryByVariantCode.get(vKey) || [];
      const varGal = isAuditedBelt ? rawVarGal.filter((g) => g.identityVerified) : rawVarGal;
      attachGallery(varGal);
      const varUrls = Array.from(new Set([...(v.images || []), ...varGal.map((g) => g.url)]));
      return {
        ...v,
        ...(comm
          ? {
              prices: comm.prices,
              price: comm.price,
              stock: comm.stock,
              stockKnown: comm.stockKnown,
              inquiryOnly: comm.inquiryOnly,
            }
          : {}),
        images: varUrls,
      };
    });

    const familyImages = Array.from(new Set([...(product.images || []), ...dbFamilyImgs]));
    product.variants = updatedVariants;
    product.images = familyImages;
    product.image = familyImages[0] || undefined;
    product.galleryImages = matchedGallery;
    if (updatedVariants.length > 0) {
      product.prices = updatedVariants[0].prices || product.prices || { base: 0, retail: 0, wholesale: 0, dealer: 0 };
      product.stock = updatedVariants.reduce((sum, v) => sum + (v.stock || 0), 0);
      product.stockKnown = updatedVariants.every((v) => v.stockKnown === true);
      product.inquiryOnly = updatedVariants.every((v) => v.inquiryOnly !== false);
    }
  }

  // Merge DB commercial prices onto direct SKUs as well
  for (const d of baseSnap.directSkus) {
    const comm = commercialByVariant.get(d.skuCode.toLowerCase());
    if (comm) {
      d.priceSnapshot = {
        ...d.priceSnapshot,
        price: comm.price,
        retailPrice: comm.prices.retail,
        stock: comm.stock,
        stockKnown: comm.stockKnown,
        inquiryOnly: comm.inquiryOnly,
      };
    }
  }

  // Merge DB category images/descriptions/icons onto authoritative approved categories
  const dbCatBySlug = new Map(categoryRes.rows.map((r) => [String(r.slug), r]));
  const categories = baseSnap.categories.map((cat) => {
    const dbCat = dbCatBySlug.get(cat.slug);
    if (!dbCat) return cat;
    return {
      ...cat,
      id: dbCat.id || cat.id,
      icon: dbCat.icon || cat.icon,
      image: dbCat.image || cat.image,
      description: (dbCat.description && String(dbCat.description).trim()) || cat.description,
    };
  });

  const groups: NavigationGroup[] = groupRes.rows.length ? groupRes.rows : baseSnap.groups;
  const brands: Brand[] = brandRes.rows.length
    ? brandRes.rows.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        logoUrl: b.logoUrl || '',
        country: b.country || '',
        description: b.description || '',
        isFeatured: b.isFeatured === true,
      }))
    : baseSnap.brands;

  return {
    ...baseSnap,
    loadedAt: Date.now(),
    groups,
    categories,
    brands,
  };
}

async function buildSnapshotFromEngineeredJson(): Promise<CatalogSnapshot> {
  const raw = await fs.readFile(ENGINEERED_SNAPSHOT_PATH, 'utf8');
  const data = JSON.parse(raw) as {
    products: Product[];
    directSkus: DirectSku[];
    aliases: Array<[string, { newFamilyCode?: string; directSkuCode?: string }]>;
    brands: Brand[];
  };

  const groups: NavigationGroup[] = APPROVED_MENU_GROUPS.map((g) => ({
    id: g.id,
    title: g.title,
    iconKey: g.iconKey,
    imageUrl: g.imageUrl,
    categorySlugs: g.categorySlugs,
    sortOrder: g.sortOrder,
    active: g.active !== false,
  }));

  const products = data.products || [];
  const directSkus = data.directSkus || [];
  const productByCode = new Map<string, Product>();
  const productByVariantCode = new Map<string, Product>();
  const assignmentsByFamily = new Map<string, MenuAssignment>();
  const menuStats = new Map<string, { familyCount: number; skuCount: number }>();

  for (const product of products) {
    productByCode.set(product.code.toLowerCase(), product);
    for (const v of product.variants || []) {
      if (v.code) productByVariantCode.set(v.code.toLowerCase(), product);
    }
    if (product.resolvedAssignment?.categorySlug) {
      const assignment: MenuAssignment = {
        categorySlug: product.resolvedAssignment.categorySlug,
        submenuName: product.resolvedAssignment.submenuName || '',
        leafName: product.resolvedAssignment.leafName || null,
        method: product.resolvedAssignment.method || 'engineering_audited',
      };
      assignmentsByFamily.set(product.code, assignment);
      const st = menuStats.get(assignment.categorySlug) || { familyCount: 0, skuCount: 0 };
      st.familyCount += 1;
      st.skuCount += product.variants?.length || 0;
      menuStats.set(assignment.categorySlug, st);
    }
  }

  const directSkuCountByCat = new Map<string, number>();
  for (const d of directSkus) {
    directSkuCountByCat.set(d.categorySlug, (directSkuCountByCat.get(d.categorySlug) || 0) + 1);
  }

  const categories: Category[] = APPROVED_MENU_CATEGORIES.map((cat) => {
    const stat = menuStats.get(cat.slug) || { familyCount: 0, skuCount: 0 };
    const directSkuCount = directSkuCountByCat.get(cat.slug) || 0;
    const totalSkuCount = stat.skuCount + directSkuCount;
    return {
      ...cat,
      count: stat.familyCount,
      familyCount: stat.familyCount,
      directSkuCount,
      skuCount: totalSkuCount,
      active: true,
    };
  });

  const aliasMap = new Map<string, { newFamilyCode?: string; directSkuCode?: string }>(
    data.aliases || [],
  );

  return {
    loadedAt: Date.now(),
    groups,
    categories,
    products,
    productByCode,
    productByVariantCode,
    aliasMap,
    assignmentsByFamily,
    directSkus,
    brands: data.brands || [],
  };
}

export async function getCatalogSnapshot(): Promise<CatalogSnapshot> {
  if (snapshotCache && Date.now() - snapshotCache.loadedAt < CACHE_TTL_MS) {
    return snapshotCache;
  }
  if (!inFlightLoad) {
    const loader = databaseEnabled()
      ? withDatabaseRetry(() => buildCatalogSnapshot())
      : buildSnapshotFromEngineeredJson();
    inFlightLoad = loader
      .then((snap) => {
        snapshotCache = snap;
        return snap;
      })
      .finally(() => {
        inFlightLoad = null;
      });
  }
  return inFlightLoad;
}

export async function getNavigationGroups() {
  const snap = await getCatalogSnapshot();
  return snap.groups;
}

export async function getCategories() {
  const snap = await getCatalogSnapshot();
  return snap.categories;
}

export async function getMenuCategoryPayload(slug: string) {
  const snap = await getCatalogSnapshot();
  const category = snap.categories.find(
    (c) => c.slug === slug && c.menuSource === 'industrial_megamenu_hierarchy_v2',
  );
  if (!category) return null;

  const matchedProducts: Product[] = [];
  const families: Array<{
    code: string;
    name: string;
    brand: string;
    submenu: string | null;
    leaf: string | null;
    skuCount: number;
  }> = [];

  for (const product of snap.products) {
    const assignment = snap.assignmentsByFamily.get(product.code);
    if (!assignment || assignment.categorySlug !== slug) continue;
    families.push({
      code: product.code,
      name: product.name,
      brand: resolveDisplayBrand(product.brand, product.name) || product.brand || '',
      submenu: assignment.submenuName || null,
      leaf: assignment.leafName || null,
      skuCount: product.variants?.length || 0,
    });
    // Return slim product summaries with variants trimmed to spec/brand/size metadata for fast category filtering
    matchedProducts.push({
      ...product,
      variants: (product.variants || []).map((v) => ({
        code: v.code,
        name: v.name,
        size: v.size,
        model: v.model,
        brand: v.brand,
        unit: v.unit,
        active: v.active,
        technicalSpecs: v.technicalSpecs,
        images: v.images?.slice(0, 1),
        stock: v.stock,
        stockKnown: v.stockKnown,
        inquiryOnly: v.inquiryOnly,
        price: v.price,
        prices: v.prices,
      })),
    });
  }

  return {
    category: {
      slug: category.slug,
      name: category.name,
      description: category.description || '',
      image: category.image || null,
      children: category.children || [],
    },
    families,
    products: matchedProducts,
  };
}

export async function getLegacyCategoryPayload(slug: string) {
  const snap = await getCatalogSnapshot();
  const category = snap.categories.find((c) => c.slug === slug);
  if (!category) return null;
  const matchedProducts = snap.products.filter(
    (p) => p.categorySlug === slug || p.resolvedAssignment?.categorySlug === slug,
  );
  return {
    category,
    products: matchedProducts,
  };
}

export async function getMenuFamilyIndex() {
  const snap = await getCatalogSnapshot();
  const assignments: Array<{
    familyCode: string;
    categorySlug: string;
    submenuName: string;
    leafName: string | null;
    method: string;
  }> = [];
  for (const [familyCode, assignment] of snap.assignmentsByFamily.entries()) {
    assignments.push({
      familyCode,
      categorySlug: assignment.categorySlug,
      submenuName: assignment.submenuName,
      leafName: assignment.leafName,
      method: assignment.method || 'static_audited',
    });
  }
  return assignments;
}

export async function getProductByCode(rawCode: string) {
  const snap = await getCatalogSnapshot();
  const code = rawCode.trim().toLowerCase();
  let product = snap.productByCode.get(code) || snap.productByVariantCode.get(code);

  if (!product) {
    const alias = snap.aliasMap.get(code);
    if (alias?.newFamilyCode) {
      product = snap.productByCode.get(alias.newFamilyCode.toLowerCase());
    } else if (alias?.directSkuCode) {
      const d = snap.directSkus.find((item) => item.skuCode.toLowerCase() === alias.directSkuCode!.toLowerCase());
      if (d) {
        product = {
          code: d.skuCode,
          legacyFamilyCodes: d.sourceFamilyCode ? [d.sourceFamilyCode] : undefined,
          name: d.name,
          brand: d.brand || '',
          categorySlug: d.categorySlug,
          categoryName: d.categoryName,
          subcategory: d.subcategory || d.submenu || '',
          submenu: d.submenu || undefined,
          unit: 'عدد',
          description: d.name,
          active: d.active !== false,
          images: d.imageUrl ? [d.imageUrl] : [],
          image: d.imageUrl || undefined,
          technicalSpecs: d.technicalSpecs || [],
          tags: [d.categoryName, d.submenu || '', d.subcategory || ''].filter(Boolean),
          variants: [
            {
              code: d.skuCode,
              name: d.name,
              size: '',
              model: '',
              brand: d.brand || '',
              unit: 'عدد',
              active: true,
              images: d.imageUrl ? [d.imageUrl] : [],
              technicalSpecs: d.technicalSpecs || [],
              prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
              price: 0,
              stock: 0,
              stockKnown: false,
              inquiryOnly: true,
            },
          ],
          prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
          stock: 0,
          stockKnown: false,
          inquiryOnly: true,
          resolvedAssignment: {
            categorySlug: d.categorySlug,
            submenuName: d.submenu || '',
            leafName: d.subcategory || null,
            method: 'engineering_audited',
          },
        };
      }
    }
  }
  if (!product) {
    const d = snap.directSkus.find((item) => item.skuCode.toLowerCase() === code);
    if (d) {
      product = {
        code: d.skuCode,
        legacyFamilyCodes: d.sourceFamilyCode ? [d.sourceFamilyCode] : undefined,
        name: d.name,
        brand: d.brand || '',
        categorySlug: d.categorySlug,
        categoryName: d.categoryName,
        subcategory: d.subcategory || d.submenu || '',
        submenu: d.submenu || undefined,
        unit: 'عدد',
        description: d.name,
        active: d.active !== false,
        images: d.imageUrl ? [d.imageUrl] : [],
        image: d.imageUrl || undefined,
        technicalSpecs: d.technicalSpecs || [],
        tags: [d.categoryName, d.submenu || '', d.subcategory || ''].filter(Boolean),
        variants: [
          {
            code: d.skuCode,
            name: d.name,
            size: '',
            model: '',
            brand: d.brand || '',
            unit: 'عدد',
            active: true,
            images: d.imageUrl ? [d.imageUrl] : [],
            technicalSpecs: d.technicalSpecs || [],
            prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
            price: 0,
            stock: 0,
            stockKnown: false,
            inquiryOnly: true,
          },
        ],
        prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
        stock: 0,
        stockKnown: false,
        inquiryOnly: true,
        resolvedAssignment: {
          categorySlug: d.categorySlug,
          submenuName: d.submenu || '',
          leafName: d.subcategory || null,
          method: 'engineering_audited',
        },
      };
    }
  }
  if (!product) return null;

  // Find similar products in the same approved menu category or legacy category
  const targetSlug = product.resolvedAssignment?.categorySlug || product.categorySlug;
  const similarProducts = snap.products
    .filter((p) => {
      if (p.code === product!.code) return false;
      const pSlug = p.resolvedAssignment?.categorySlug || p.categorySlug;
      return pSlug === targetSlug;
    })
    .slice(0, 4)
    .map((p) => ({
      ...p,
      variants: (p.variants || []).slice(0, 3),
    }));

  const approvedCat = APPROVED_MENU_CATEGORIES.find((c) => c.slug === targetSlug);

  return {
    product,
    categoryMeta: approvedCat
      ? { slug: approvedCat.slug, name: approvedCat.name }
      : { slug: product.categorySlug, name: product.categoryName },
    similarProducts,
  };
}

export async function queryAllProducts(params: {
  q?: string;
  categorySlug?: string;
  brand?: string;
  inStockOnly?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}) {
  const snap = await getCatalogSnapshot();
  const qNorm = normalizeCatalogText(params.q || '');
  const tokens = qNorm ? qNorm.split(' ').filter(Boolean) : [];
  const catSlug = (params.categorySlug || '').trim();
  const brandFilter = normalizeCatalogText(params.brand || '');

  let filtered = snap.products.filter((p) => {
    if (catSlug && catSlug !== 'all') {
      const assignedSlug = p.resolvedAssignment?.categorySlug;
      if (p.categorySlug !== catSlug && assignedSlug !== catSlug) return false;
    }
    if (brandFilter) {
      const displayBrand = normalizeCatalogText(resolveDisplayBrand(p.brand, p.name) || p.brand);
      if (!displayBrand.includes(brandFilter)) return false;
    }
    if (params.inStockOnly && (!p.stockKnown || p.stock <= 0)) {
      return false;
    }
    if (tokens.length > 0) {
      const haystack = normalizeCatalogText(
        [
          p.code,
          p.name,
          p.brand,
          p.categoryName,
          p.subcategory,
          p.resolvedAssignment?.submenuName || '',
          ...(p.variants || []).slice(0, 15).flatMap((v) => [v.code, v.name, v.size, v.model || '']),
        ].join(' '),
      );
      if (!tokens.every((t) => haystack.includes(t))) return false;
    }
    return true;
  });

  if (params.sort === 'sku_desc') {
    filtered = [...filtered].sort((a, b) => (b.variants?.length || 0) - (a.variants?.length || 0));
  } else if (params.sort === 'name') {
    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  } else if (params.sort === 'code') {
    filtered = [...filtered].sort((a, b) => a.code.localeCompare(b.code, 'en'));
  } else {
    filtered = [...filtered].sort((a, b) => {
      const imgDiff = (b.images.length > 0 ? 1 : 0) - (a.images.length > 0 ? 1 : 0);
      if (imgDiff !== 0) return imgDiff;
      return (b.variants?.length || 0) - (a.variants?.length || 0);
    });
  }

  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(params.limit) || 24));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * limit;
  const items = filtered.slice(start, start + limit).map((p) => ({
    ...p,
    variants: (p.variants || []).slice(0, 6),
    variantCount: p.variants?.length || 0,
  }));

  // Brand facets from current category scope
  const brandCounts = new Map<string, number>();
  for (const p of snap.products) {
    if (catSlug && catSlug !== 'all' && p.categorySlug !== catSlug && p.resolvedAssignment?.categorySlug !== catSlug) {
      continue;
    }
    const b = resolveDisplayBrand(p.brand, p.name);
    if (b) brandCounts.set(b, (brandCounts.get(b) || 0) + 1);
  }

  return {
    items,
    total,
    page: safePage,
    limit,
    totalPages,
    brands: Array.from(brandCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}

export async function instantSearch(rawQuery: string) {
  const snap = await getCatalogSnapshot();
  const q = normalizeCatalogText(rawQuery);
  if (q.length < 2) {
    return { products: [], variants: [], categories: [], brands: [] };
  }
  const tokens = q.split(' ').filter(Boolean);

  const matchedProducts: Array<{
    code: string;
    name: string;
    brand: string;
    categoryName: string;
    skuCount: number;
    image: string;
    matchedSku?: string;
    isDirectSku?: boolean;
    exactScore?: number;
  }> = [];

  for (const p of snap.products) {
    const familyHaystack = normalizeCatalogText(`${p.code} ${p.name} ${p.brand} ${p.categoryName}`);
    let matchedSku: string | undefined;
    let exactScore = normalizeCatalogText(p.code) === q ? 3 : 0;
    const exactVar = (p.variants || []).find((v) => normalizeCatalogText(v.code) === q);
    if (exactVar) {
      matchedSku = exactVar.code;
      exactScore = 3;
    } else {
      const familyMatch = tokens.every((t) => familyHaystack.includes(t));
      if (!familyMatch) {
        const foundVar = (p.variants || []).find((v) => {
          const vHay = normalizeCatalogText(`${v.code} ${v.name} ${v.size} ${v.model || ''}`);
          return tokens.every((t) => vHay.includes(t));
        });
        if (!foundVar) continue;
        matchedSku = foundVar.code;
      }
    }
    matchedProducts.push({
      code: p.code,
      name: p.name,
      brand: resolveDisplayBrand(p.brand, p.name) || p.brand,
      categoryName: p.categoryName,
      skuCount: p.variants?.length || 0,
      image: p.images[0] || '',
      matchedSku,
      isDirectSku: false,
      exactScore,
    });
  }

  for (const d of snap.directSkus) {
    const skuNorm = normalizeCatalogText(d.skuCode);
    const hay = normalizeCatalogText(`${d.skuCode} ${d.name} ${d.brand} ${d.categoryName} ${d.submenu || ''}`);
    if (!tokens.every((t) => hay.includes(t))) continue;
    const exactScore = skuNorm === q ? 4 : skuNorm.startsWith(q) ? 2 : 0;
    matchedProducts.push({
      code: d.skuCode,
      name: d.name,
      brand: resolveDisplayBrand(d.brand, d.name) || d.brand,
      categoryName: d.categoryName,
      skuCount: 1,
      image: d.imageUrl || '',
      matchedSku: d.skuCode,
      isDirectSku: true,
      exactScore,
    });
  }

  matchedProducts.sort((a, b) => (b.exactScore || 0) - (a.exactScore || 0) || b.skuCount - a.skuCount);
  const topProducts = matchedProducts.slice(0, 12).map(({ exactScore: _score, ...rest }) => rest);

  const matchedCategories = snap.categories
    .filter((c) => c.menuSource === 'industrial_megamenu_hierarchy_v2')
    .filter((c) => {
      const hay = normalizeCatalogText(`${c.name} ${c.description} ${(c.subcategories || []).join(' ')}`);
      return tokens.every((t) => hay.includes(t));
    })
    .slice(0, 6);

  const matchedBrands = snap.brands
    .filter((b) => normalizeCatalogText(`${b.name} ${b.slug}`).includes(q))
    .slice(0, 5);

  return {
    products: topProducts,
    categories: matchedCategories,
    brands: matchedBrands,
  };
}

export async function getDirectSkus(categorySlug?: string, categoryPrefix?: string) {
  const snap = await getCatalogSnapshot();
  return snap.directSkus.filter((item) => {
    if (categorySlug && item.categorySlug === categorySlug) return true;
    if (categoryPrefix && item.categorySlug.startsWith(categoryPrefix)) return true;
    return !categorySlug && !categoryPrefix;
  });
}

export async function getDirectSkuByCode(skuCode: string) {
  const snap = await getCatalogSnapshot();
  const clean = skuCode.trim().toLowerCase();
  return snap.directSkus.find((item) => item.skuCode.toLowerCase() === clean) || null;
}

export async function getVariantReview(code: string) {
  if (databaseEnabled()) {
    const res = await withDatabaseRetry(() =>
      database().query(
        `select code, technical_review as "technicalReview"
         from public.catalog_variants
         where lower(code) = lower($1) and active = true
         limit 1`,
        [code.trim()],
      ),
    );
    if (res.rows.length) return res.rows[0];
  }
  const snap = await getCatalogSnapshot();
  const clean = code.trim().toLowerCase();
  const prod = snap.productByVariantCode.get(clean);
  if (prod) {
    const variant = (prod.variants || []).find((v) => v.code.toLowerCase() === clean);
    if (variant) return { code: variant.code, technicalReview: null };
  }
  const direct = snap.directSkus.find((d) => d.skuCode.toLowerCase() === clean);
  if (direct) return { code: direct.skuCode, technicalReview: null };
  return null;
}

export async function getBrands() {
  const snap = await getCatalogSnapshot();
  return snap.brands;
}

export async function createPriceInquiry(input: {
  customerName: string;
  phone: string;
  companyName?: string;
  productCode: string;
  productName: string;
  quantity: number;
  unit?: string;
  customerNote?: string;
}) {
  const id = `INQ-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  if (!databaseEnabled()) {
    inMemoryInquiries.push({
      id,
      customerName: input.customerName.trim(),
      companyName: input.companyName?.trim() || null,
      phone: input.phone.trim(),
      productCode: input.productCode.trim(),
      productName: input.productName.trim(),
      quantity: Math.max(1, Math.floor(input.quantity || 1)),
      unit: input.unit || 'عدد',
      customerNote: input.customerNote?.trim() || null,
      createdAt: new Date().toISOString(),
    });
    return { id, status: 'pending' };
  }
  await withDatabaseRetry(() =>
    database().query(
      `insert into public.price_inquiries (
         id, customer_name, company_name, phone, product_code, product_name,
         quantity, unit, status, customer_note, items, attachments
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10::jsonb, '[]'::jsonb)`,
      [
        id,
        input.customerName.trim(),
        input.companyName?.trim() || null,
        input.phone.trim(),
        input.productCode.trim(),
        input.productName.trim(),
        Math.max(1, Math.floor(input.quantity || 1)),
        input.unit || 'عدد',
        input.customerNote?.trim() || null,
        JSON.stringify([
          {
            code: input.productCode.trim(),
            name: input.productName.trim(),
            quantity: Math.max(1, Math.floor(input.quantity || 1)),
          },
        ]),
      ],
    ),
  );
  return { id, status: 'pending' };
}
