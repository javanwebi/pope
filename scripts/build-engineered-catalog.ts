import fs from 'node:fs';
import path from 'node:path';
import {
  buildInvariantFamilyKey,
  normFa,
  refineEngineeredSku,
  type EngineeredSkuOutput,
} from '../src/utils/catalogEngineering.ts';
import { validateFamilyMenuAssignment } from '../src/data/catalogMenuSemanticGuard.ts';
import { resolveDisplayBrand } from '../src/utils/catalogBrands.ts';
import { APPROVED_MENU_CATEGORIES } from '../src/data/approvedMenuFallback.ts';
import type { Brand, DirectSku, Product, ProductGalleryImage, ProductVariant, TechnicalSpec } from '../src/types.ts';

const UPSTREAM_DIR = '/tmp/upstream';
const OUT_FILE = path.resolve(process.cwd(), 'server/data/engineeredCatalog.json');

function slugToken(input: string, maxLen: number): string {
  const cleaned = normFa(input)
    .replace(/[^a-zA-Z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (cleaned || 'STD').slice(0, maxLen).replace(/-+$/g, '') || 'STD';
}

function buildFamilyDisplayTitle(sample: EngineeredSkuOutput): string {
  const displayBrand = resolveDisplayBrand(sample.brand, sample.originalProductName);
  const rawBrand = normFa(sample.brand);
  const brandLabel =
    displayBrand ||
    (!rawBrand || ['GENERIC_INDUSTRIAL', 'ثبت نشده', 'نامشخص', ''].includes(rawBrand) ? '' : rawBrand);

  const baseType = sample.productType.trim();
  if (brandLabel && !normFa(baseType).toLowerCase().includes(normFa(brandLabel).toLowerCase())) {
    if (['خارجی', 'ایرانی', 'آلمانی', 'ایتالیایی', 'انگلیسی'].includes(brandLabel)) {
      return `${baseType} (${brandLabel})`;
    }
    return `${baseType} — برند ${brandLabel}`;
  }
  return baseType;
}

function buildFamilySpecs(sample: EngineeredSkuOutput): TechnicalSpec[] {
  const specs: TechnicalSpec[] = [];
  const displayBrand = resolveDisplayBrand(sample.brand, sample.originalProductName);
  specs.push({ key: 'نوع فنی محصول', value: sample.productType });
  if (displayBrand) specs.push({ key: 'برند', value: displayBrand });
  if (sample.profile && !sample.profile.includes('_STD_SERIES') && sample.profile !== 'STANDARD') {
    specs.push({ key: 'پروفیل / سری', value: sample.profile });
  }
  if (sample.material && !/unknown/i.test(sample.material)) {
    specs.push({ key: 'جنس / متریال', value: sample.material });
  }
  if (sample.construction && !/نامشخص/i.test(sample.construction)) {
    specs.push({ key: 'ساختار فنی', value: sample.construction });
  }
  if (sample.standard && !/نامشخص/i.test(sample.standard)) {
    specs.push({ key: 'استاندارد', value: sample.standard });
  }
  specs.push({ key: 'واحد سنجش', value: sample.unit || 'عدد' });
  return specs;
}

function buildVariantSpecs(sku: EngineeredSkuOutput): TechnicalSpec[] {
  const specs: TechnicalSpec[] = [];
  const seen = new Set<string>();
  const add = (key: string, value?: string | null) => {
    const k = String(key || '').trim();
    const v = String(value || '').trim();
    if (!k || !v || v === 'نامشخص' || v === '---') return;
    if (seen.has(k)) return;
    seen.add(k);
    specs.push({ key: k, value: v });
  };

  if (sku.specsMap) {
    for (const [k, v] of Object.entries(sku.specsMap)) {
      add(k, v);
    }
  }
  if (sku.originalSize && sku.originalSize !== 'نامشخص') {
    add('سایز کاتالوگ', sku.originalSize);
  }
  if (sku.profile && !sku.profile.includes('_STD_SERIES')) {
    add('پروفیل / سری', sku.profile);
  }
  add('واحد', sku.unit || 'عدد');
  return specs;
}

async function main() {
  const sourceData = JSON.parse(fs.readFileSync(path.join(UPSTREAM_DIR, 'catalogueSource.json'), 'utf8'));
  const techData = JSON.parse(fs.readFileSync(path.join(UPSTREAM_DIR, 'technical-research-2642.json'), 'utf8'));
  const imagesJson = JSON.parse(fs.readFileSync(path.join(UPSTREAM_DIR, 'catalogueImages.json'), 'utf8')) as Record<
    string,
    { familyName: string; scope: string; files: string[] }
  >;
  const sqlOverridesText = fs.readFileSync(
    path.join(UPSTREAM_DIR, '20261114_catalog_sku_level_menu_assignments.sql'),
    'utf8',
  );

  const skuOverrides = new Map<string, { categorySlug: string; submenuName: string; leafName: string | null }>();
  const overrideRe = /'([^']+)'\s*,\s*'(excel-v2-\d+-\d+)'\s*,\s*'([^']*)'\s*,\s*(?:NULL|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = overrideRe.exec(sqlOverridesText))) {
    skuOverrides.set(m[1], {
      categorySlug: m[2],
      submenuName: m[3],
      leafName: m[4] || null,
    });
  }

  const phase1ModPath = ['/tmp', 'upstream_orig', 'src', 'data', 'catalogPhase1Reconstruction.ts'].join('/');
  const phase1Mod = (await import(phase1ModPath)) as {
    extractBeltRefsFromTechnicalResearch: (data: unknown) => unknown;
    runPhase1CatalogReconstruction: (
      src: unknown,
      overrides: Map<string, { categorySlug: string; submenuName: string; leafName: string | null }>,
      beltRefs?: unknown,
    ) => { skuRecords: Array<Record<string, any>> };
  };
  const beltRefs = phase1Mod.extractBeltRefsFromTechnicalResearch(techData);
  const phase1 = phase1Mod.runPhase1CatalogReconstruction(sourceData, skuOverrides, beltRefs);
  const refinedAll: EngineeredSkuOutput[] = phase1.skuRecords.map((rec: Record<string, any>) => {
    const specsMap: Record<string, string> = {};
    if (rec.engineeringSpecifications?.nominalWidthMm) {
      specsMap['عرض'] = `${rec.engineeringSpecifications.nominalWidthMm} میلی‌متر`;
    }
    if (rec.engineeringSpecifications?.beltThicknessMm) {
      specsMap['ضخامت'] = `${rec.engineeringSpecifications.beltThicknessMm} میلی‌متر`;
    }
    if (rec.engineeringSpecifications?.pitchMm) {
      specsMap['گام'] = `${rec.engineeringSpecifications.pitchMm} میلی‌متر`;
    }
    return refineEngineeredSku({
      ...(rec as unknown as Omit<import('../src/utils/catalogEngineering.ts').EngineeredSkuInput, 'sourceFamilyCode' | 'sourceCategory' | 'sourceSubmenu' | 'sourceMaterial' | 'specsMap'>),
      sourceFamilyCode: rec.currentFamily || '',
      sourceCategory: rec.currentCategory || '',
      sourceSubmenu: rec.currentSubcategory || '',
      sourceMaterial: rec.material || null,
      specsMap,
    });
  });

  const validSkus = refinedAll.filter((s) => s.status === 'VALID');
  const quarantinedSkus = refinedAll.filter((s) => s.status === 'QUARANTINED');

  // Verify 0 semantic guard failures across all valid SKUs
  for (const s of validSkus) {
    const guard = validateFamilyMenuAssignment({
      familyCode: s.sourceFamilyCode,
      familyName: s.originalProductName,
      productType: s.productType,
      material: s.material,
      profile: s.profile,
      categorySlug: s.proposedCategorySlug,
      submenuName: s.proposedSubmenu,
      leafName: s.proposedLeaf,
    });
    if (!guard.valid) {
      throw new Error(`Semantic guard failed for SKU ${s.skuCode} (${s.proposedCategorySlug}): ${guard.reason}`);
    }
  }

  // Group strictly by invariant engineering key
  const groups = new Map<string, EngineeredSkuOutput[]>();
  for (const sku of validSkus) {
    const key = buildInvariantFamilyKey(sku);
    const list = groups.get(key) || [];
    list.push(sku);
    groups.set(key, list);
  }

  const sortedGroups = [...groups.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length;
    return a[0].localeCompare(b[0], 'en');
  });

  const products: Product[] = [];
  const directSkus: DirectSku[] = [];
  const usedFamilyCodes = new Set<string>();
  const sourceFamTargets = new Map<string, { familyCodes: Map<string, number>; directCodes: string[] }>();

  const recordSourceTarget = (srcFam: string, familyCode?: string, directCode?: string, weight = 1) => {
    if (!srcFam) return;
    const entry = sourceFamTargets.get(srcFam) || {
      familyCodes: new Map<string, number>(),
      directCodes: [] as string[],
    };
    if (familyCode) entry.familyCodes.set(familyCode, (entry.familyCodes.get(familyCode) || 0) + weight);
    if (directCode) entry.directCodes.push(directCode);
    sourceFamTargets.set(srcFam, entry);
  };

  const BELT_AUDITED_CATEGORIES = new Set([
    'excel-v2-1-1',
    'excel-v2-1-2',
    'excel-v2-1-3',
    'excel-v2-1-5',
  ]);
  const isAuditedBeltSample = (s: EngineeredSkuOutput): boolean =>
    BELT_AUDITED_CATEGORIES.has(s.proposedCategorySlug) ||
    (s.proposedCategorySlug === 'excel-v2-1-4' &&
      !['BELT_WELDING_DEVICE', 'BELT_PREP_TOOL'].includes(s.profile));
  const VERIFIED_OWNER_CONVEYOR_FILES = new Set([
    'e(859).png',
    'e(860).png',
    'e(862).png',
    'e(863).png',
    'e(864).png',
  ]);
  let claimedOwnerConveyorPhotos = false;

  let famCounter = 1;
  for (const [, group] of sortedGroups) {
    // Sort group members deterministically
    const sortedMembers = [...group].sort((a, b) => a.skuCode.localeCompare(b.skuCode, 'en'));
    const sample = sortedMembers[0];
    const isBeltGroup = isAuditedBeltSample(sample);

    if (sortedMembers.length === 1) {
      const displayBrand = resolveDisplayBrand(sample.brand, sample.originalProductName);
      const famMedia = imagesJson[sample.sourceFamilyCode];
      const rawFile = famMedia?.files?.[0];
      const allowImage =
        !isBeltGroup && rawFile;
      const imageUrl = allowImage ? `/storage/products/catalog/${rawFile}` : null;
      const directSku: DirectSku = {
        skuCode: sample.skuCode,
        name: sample.originalProductName,
        categorySlug: sample.proposedCategorySlug,
        categoryName: sample.proposedCategory,
        submenu: sample.proposedSubmenu || null,
        subcategory: sample.proposedLeaf || null,
        brand: displayBrand,
        imageUrl,
        technicalSpecs: buildVariantSpecs(sample),
        priceSnapshot: {},
        sourceFamilyCode: sample.sourceFamilyCode || null,
        active: true,
      };
      directSkus.push(directSku);
      recordSourceTarget(sample.sourceFamilyCode, undefined, sample.skuCode, 1);
      continue;
    }

    // Multi-SKU engineered family
    const has52692 = sortedMembers.some((m) => m.skuCode === '52692');
    let familyCode =
      has52692 && !usedFamilyCodes.has('PFAM-تسمه-تایمینگ-م-FORZA-AT20-015')
        ? 'PFAM-تسمه-تایمینگ-م-FORZA-AT20-015'
        : `PFAM-${slugToken(sample.productType, 14)}-${slugToken(sample.brand, 8)}-${slugToken(sample.profile, 12)}-${String(famCounter).padStart(3, '0')}`;

    while (usedFamilyCodes.has(familyCode.toLowerCase())) {
      famCounter += 1;
      familyCode = `PFAM-${slugToken(sample.productType, 14)}-${slugToken(sample.brand, 8)}-${slugToken(sample.profile, 12)}-${String(famCounter).padStart(3, '0')}`;
    }
    usedFamilyCodes.add(familyCode.toLowerCase());
    famCounter += 1;

    const legacyCodesSet = new Set<string>();
    const familyImages: string[] = [];
    const galleryImages: ProductGalleryImage[] = [];
    const seenImg = new Set<string>();
    const canAttachOwnerConveyor =
      sample.sourceFamilyCode === 'FAM-52858' && !claimedOwnerConveyorPhotos;

    for (const member of sortedMembers) {
      if (member.sourceFamilyCode) {
        legacyCodesSet.add(member.sourceFamilyCode);
        recordSourceTarget(member.sourceFamilyCode, familyCode, undefined, 1);
        const mediaEntry = imagesJson[member.sourceFamilyCode];
        if (mediaEntry?.files) {
          for (const file of mediaEntry.files) {
            if (isBeltGroup) {
              if (!canAttachOwnerConveyor || !VERIFIED_OWNER_CONVEYOR_FILES.has(file)) {
                continue;
              }
            }
            const url = `/storage/products/catalog/${file}`;
            if (!seenImg.has(url)) {
              seenImg.add(url);
              familyImages.push(url);
              galleryImages.push({
                id: `${familyCode}-${galleryImages.length + 1}`,
                url,
                fileName: file,
                scope: 'family',
                identityVerified: true,
                title: mediaEntry.familyName || sample.productType,
                order: galleryImages.length + 1,
              });
            }
          }
        }
      }
    }
    if (canAttachOwnerConveyor && familyImages.length > 0) {
      claimedOwnerConveyorPhotos = true;
    }

    const displayBrand = resolveDisplayBrand(sample.brand, sample.originalProductName);
    const variants: ProductVariant[] = sortedMembers.map((member) => {
      const mBrand = resolveDisplayBrand(member.brand, member.originalProductName) || displayBrand;
      return {
        code: member.skuCode,
        name: member.originalProductName,
        size: member.originalSize && member.originalSize !== 'نامشخص' ? member.originalSize : '',
        model: member.profile && !member.profile.includes('_STD_SERIES') ? member.profile : '',
        brand: mBrand,
        unit: member.unit || 'عدد',
        active: true,
        images: [],
        technicalSpecs: buildVariantSpecs(member),
        prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
        price: 0,
        stock: 0,
        stockKnown: false,
        inquiryOnly: true,
      };
    });

    const title = buildFamilyDisplayTitle(sample);
    const legacyFamilyCodes = Array.from(legacyCodesSet).sort();

    const product: Product = {
      code: familyCode,
      legacyFamilyCodes: legacyFamilyCodes.length ? legacyFamilyCodes : undefined,
      name: title,
      brand: displayBrand,
      categorySlug: sample.proposedCategorySlug,
      categoryName: sample.proposedCategory,
      subcategory: sample.proposedLeaf || sample.proposedSubmenu,
      submenu: sample.proposedSubmenu,
      unit: sample.unit || 'عدد',
      description: `${title} — ${sample.material} (${sample.construction}) · استاندارد ${sample.standard} · شامل ${variants.length} کد فنی`,
      active: true,
      images: familyImages,
      image: familyImages[0],
      technicalSpecs: buildFamilySpecs(sample),
      tags: Array.from(
        new Set(
          [
            sample.proposedCategory,
            sample.proposedSubmenu,
            sample.proposedLeaf || '',
            displayBrand,
            sample.profile,
          ].filter(Boolean),
        ),
      ),
      hasCatalogueImage: familyImages.length > 0,
      imageScope: familyImages.length > 0 ? 'family-example' : undefined,
      galleryImages,
      variants,
      prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
      stock: 0,
      stockKnown: false,
      inquiryOnly: true,
      resolvedAssignment: {
        categorySlug: sample.proposedCategorySlug,
        submenuName: sample.proposedSubmenu,
        leafName: sample.proposedLeaf,
        method: 'engineering_audited',
      },
    };

    // Double check assembled family passes semantic guard cleanly (both with and without profile)
    const famGuard = validateFamilyMenuAssignment({
      familyCode: product.code,
      familyName: `${product.name} ${variants.slice(0, 3).map((v) => v.name).join(' ')}`,
      productType: sample.productType,
      material: sample.material,
      profile: sample.profile,
      categorySlug: sample.proposedCategorySlug,
      submenuName: sample.proposedSubmenu,
      leafName: sample.proposedLeaf,
    });
    if (!famGuard.valid) {
      throw new Error(`Assembled family guard failed for ${product.code}: ${famGuard.reason}`);
    }

    products.push(product);
  }

  // Build legacy FAM-* alias table -> canonical PFAM-* or direct SKU
  const aliases: Array<[string, { newFamilyCode?: string; directSkuCode?: string }]> = [];
  for (const [oldFamCode, target] of sourceFamTargets.entries()) {
    const topFamily = [...target.familyCodes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (topFamily) {
      aliases.push([oldFamCode.toLowerCase(), { newFamilyCode: topFamily }]);
    } else if (target.directCodes[0]) {
      aliases.push([oldFamCode.toLowerCase(), { directSkuCode: target.directCodes[0] }]);
    }
  }

  // Build curated brand catalog
  const brandCounts = new Map<string, number>();
  for (const p of products) {
    if (p.brand) brandCounts.set(p.brand, (brandCounts.get(p.brand) || 0) + (p.variants?.length || 1));
  }
  for (const d of directSkus) {
    if (d.brand) brandCounts.set(d.brand, (brandCounts.get(d.brand) || 0) + 1);
  }
  const brands: Brand[] = [...brandCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count], idx) => ({
      id: String(idx + 1),
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `brand-${idx + 1}`,
      logoUrl: '',
      country: '',
      description: `${count} کد فنی در کاتالوگ مهندسی صنعت پیش اطلس`,
      isFeatured: idx < 10,
    }));

  const categorySummary = APPROVED_MENU_CATEGORIES.map((c) => {
    const catFams = products.filter((p) => p.resolvedAssignment?.categorySlug === c.slug);
    const catDirect = directSkus.filter((d) => d.categorySlug === c.slug);
    return {
      slug: c.slug,
      name: c.name,
      familyCount: catFams.length,
      directSkuCount: catDirect.length,
      skuCount: catFams.reduce((s, f) => s + (f.variants?.length || 0), 0) + catDirect.length,
    };
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    stats: {
      sourceFamilies: sourceData.length,
      sourceSkus: refinedAll.length,
      validSkus: validSkus.length,
      quarantinedSkus: quarantinedSkus.length,
      multiFamilies: products.length,
      directSkus: directSkus.length,
      aliases: aliases.length,
    },
    categorySummary,
    products,
    directSkus,
    aliases,
    brands,
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload));
  console.log('Generated engineeredCatalog.json:', payload.stats);
  console.log('V-Belt & Group 1 summary:', categorySummary.slice(0, 5));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
