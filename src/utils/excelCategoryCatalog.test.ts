import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaginationWindow,
  buildSubcategoryStripNodes,
  extractNumericDimensions,
  matchesDimensionRange,
  matchesDynamicFacetToken,
  normalizeCatalogText,
  parseNumericInput,
} from './excelCategoryCatalog';
import { resolveDisplayBrand } from './catalogBrands';
import { toPersianDigits } from './formatters';
import { buildBeltGalleryImages, getBeltFamilyMedia, getBeltSkuMedia } from './beltCatalogMedia';
import { validateFamilyMenuAssignment } from '../data/catalogMenuSemanticGuard';
import { STORE_ASSETS } from '../assets/images';

test('normalizeCatalogText normalizes Arabic Kaf/Yeh and Persian digits', () => {
  assert.equal(normalizeCatalogText('تسمه تايمينگ ۱۲۳'), 'تسمه تایمینگ 123');
  assert.equal(parseNumericInput('۱۲۵۰'), 1250);
  assert.equal(parseNumericInput(''), null);
});

test('extractNumericDimensions and matchesDimensionRange filter by belt length and width', () => {
  const dims = extractNumericDimensions(
    { code: 'FAM-52692', name: 'تسمه چمفر APL AT20 FORZA', brand: 'FORZA', submenu: 'سیم‌دار فابریک', leaf: 'APL دار', skuCount: 143 },
    {
      code: 'FAM-52692',
      name: 'تسمه چمفر APL AT20 FORZA',
      brand: 'FORZA',
      categorySlug: 'excel-v2-1-1',
      categoryName: 'تسمه تایمینگ',
      subcategory: 'تسمه تایمینگ',
      technicalSpecs: [],
      prices: { base: 0, retail: 0, wholesale: 0, dealer: 0 },
      stock: 0,
      inquiryOnly: true,
      images: [],
      tags: [],
      unit: 'حلقه',
      variants: [
        { code: '52692', name: 'تسمه چمفر 6APL * 10180 * 100AT20', size: '6*10180*20, 100AT20', technicalSpecs: [{ key: 'طول نامی', value: '10180 میلی‌متر' }] },
      ],
    },
  );
  assert.ok(dims.primaryValues.includes(10180));
  assert.equal(matchesDimensionRange(dims, '10000', '11000', '', ''), true);
  assert.equal(matchesDimensionRange(dims, '100', '500', '', ''), false);
});

test('matchesDynamicFacetToken matches AT20 profile accurately', () => {
  const matches = matchesDynamicFacetToken(
    { code: 'FAM-52692', name: 'تسمه چمفر APL AT20 FORZA', brand: 'FORZA', submenu: 'سیم‌دار فابریک', leaf: 'APL دار', skuCount: 143 },
    undefined,
    'AT20',
  );
  assert.equal(matches, true);
});

test('buildPaginationWindow returns bounded ellipsis window', () => {
  assert.deepEqual(buildPaginationWindow(1, 3), [1, 2, 3]);
  assert.deepEqual(buildPaginationWindow(5, 12), [1, 'ellipsis', 4, 5, 6, 'ellipsis', 12]);
});

test('buildSubcategoryStripNodes appends all-option for 3 nodes', () => {
  const strip = buildSubcategoryStripNodes(
    [{ name: 'سیم‌دار فابریک' }, { name: 'لاستیکی فابریک' }, { name: 'انواع گام و کدهای تایمینگ' }],
    'تسمه تایمینگ',
  );
  assert.equal(strip.length, 4);
  assert.equal(strip[3].isAllOption, true);
  assert.equal(strip[3].name, 'همه تسمه تایمینگ');
});

test('resolveDisplayBrand strips placeholders and extracts FORZA / Megadyne', () => {
  assert.equal(resolveDisplayBrand('ثبت نشده', 'تسمه چمفر APL AT20 FORZA'), 'FORZA');
  assert.equal(resolveDisplayBrand('ثبت نشده', 'تسمه تایمینگ عادی'), '');
  assert.equal(toPersianDigits(52692), '۵۲۶۹۲');
});

test('beltCatalogMedia resolves PFAM family codes, aliases, local verified photos, and enforces strict non-duplication', () => {
  const pfam = 'PFAM-تسمه-تایمینگ-م-FORZA-AT20-015';
  const hints = {
    legacyFamilyCodes: ['FAM-52692'],
    variants: [{ code: '52692' }, { code: '10335' }],
  };
  const famMedia = getBeltFamilyMedia(pfam, null, hints);
  assert.ok(famMedia);
  assert.equal(famMedia.familyCode, pfam);
  assert.equal(famMedia.hasVerifiedRealPhoto, false);
  assert.equal(famMedia.familyPhotos[0], null);
  assert.equal(
    famMedia.primaryThumbnail,
    `/src/assets/catalog/belts/families/${encodeURIComponent(pfam)}/card-preview.svg`,
  );
  assert.notEqual(famMedia.primaryThumbnail, famMedia.specSheetWebp);
  assert.equal(
    famMedia.specSheetWebp,
    `/src/assets/catalog/belts/families/${encodeURIComponent(pfam)}/family-specifications.webp`,
  );

  // All 11 upgraded families have 4 visually-verified unique real .webp photos (01-main .. 04-closeup)
  const full4PhotoFamilies = [
    'PFAM-تسمه-تایمینگ-ذ-OPTIBELT-L-148',
    'PFAM-تسمه-تایمینگ-ذ-OPTIBELT-H-077',
    'PFAM-تسمه-تایمینگ-م-OPTIBELT-8M-234',
    'PFAM-تسمه-چندشیاری-OPTIBELT-PJ-113',
    'PFAM-تسمه-تایمینگ-م-MEGADYNE-8M-360',
    'PFAM-تسمه-تایمینگ-ذ-MEGADYNE-H-106',
    'PFAM-تسمه-تایمینگ-م-MEGADYNE-T5-134',
    'PFAM-تسمه-تایمینگ-ذ-BANDO-H-554',
    'PFAM-تسمه-گرد-جوشی-FOREIGN-CRC-386',
    'PFAM-تسمه-جوشی-V-شک-ENGLAND-B-613',
    'PFAM-نوار-نقاله-PVC-GENERIC-PVC-STONE-SU-013',
  ];
  for (const famCode of full4PhotoFamilies) {
    const fm = getBeltFamilyMedia(famCode);
    assert.ok(fm, `Expected family media for ${famCode}`);
    assert.equal(fm.hasVerifiedRealPhoto, true, `Expected real photos on ${famCode}`);
    assert.equal(fm.familyPhotos.length, 4, `Expected 4 photo slots on ${famCode}`);
    for (let i = 0; i < 4; i++) {
      assert.equal(
        fm.familyPhotos[i],
        `/src/assets/catalog/belts/families/${encodeURIComponent(famCode)}/family-image-0${i + 1}.webp`,
        `Expected slot ${i + 1} on ${famCode}`,
      );
    }
  }

  // Optibelt ZR L alias resolution (FAM-34388 -> PFAM-تسمه-تایمینگ-ذ-OPTIBELT-L-148)
  const optiPfam = 'PFAM-تسمه-تایمینگ-ذ-OPTIBELT-L-148';
  const optiFamMedia = getBeltFamilyMedia('FAM-34388');
  assert.ok(optiFamMedia);
  assert.equal(optiFamMedia.familyCode, optiPfam);
  assert.equal(
    optiFamMedia.familyPhotos[3],
    `/src/assets/catalog/belts/families/${encodeURIComponent(optiPfam)}/family-image-04.webp`,
  );

  const skuMedia = getBeltSkuMedia(pfam, '52692', hints);
  assert.ok(skuMedia);
  assert.equal(skuMedia.profileDrawingWebp, '/src/assets/catalog/belts/skus/52692/profile-drawing.webp');
  assert.equal(skuMedia.realProductImage, null);

  // All 14 visually-verified exact physical SKU marking photos
  const exactSkuChecks: Array<[string, string]> = [
    [optiPfam, '52009'],
    [optiPfam, '52050'],
    [optiPfam, '39130'],
    ['PFAM-تسمه-تایمینگ-ذ-OPTIBELT-H-077', '53301'],
    ['PFAM-تسمه-تایمینگ-ذ-OPTIBELT-H-077', '53283'],
    ['PFAM-تسمه-تایمینگ-م-OPTIBELT-8M-234', '58357'],
    ['PFAM-تسمه-تایمینگ-م-OPTIBELT-8M-234', '35271'],
    ['PFAM-تسمه-چندشیاری-OPTIBELT-PJ-113', '32121'],
    ['PFAM-تسمه-چندشیاری-OPTIBELT-PJ-113', '34029'],
    ['PFAM-تسمه-چندشیاری-OPTIBELT-PJ-113', '35116'],
    ['PFAM-تسمه-تایمینگ-م-MEGADYNE-8M-360', '33016'],
    ['PFAM-تسمه-تایمینگ-م-MEGADYNE-8M-360', '33042'],
    ['PFAM-تسمه-تایمینگ-ذ-BANDO-DH-446', '41349'],
    ['PFAM-تسمه-چندشیاری-DONGIL-PK-195', '38082'],
  ];
  for (const [fCode, sCode] of exactSkuChecks) {
    const m = getBeltSkuMedia(fCode, sCode);
    assert.ok(m, `Expected SKU media for ${sCode}`);
    assert.equal(m.realImageStatus, 'EXACT_SKU_IMAGE_FOUND');
    assert.equal(m.realProductImage, `/src/assets/catalog/belts/skus/${sCode}/real-product-image.webp`);
  }

  // Pending review SKU without verified dimensions must not fabricate a technical drawing (Rule 1)
  const pendingSku = getBeltSkuMedia('FAM-10077', '10077');
  assert.ok(pendingSku);
  assert.equal(pendingSku.technicalDrawingStatus, 'NEEDS_TECHNICAL_DATA');
  assert.equal(pendingSku.technicalDrawingWebp, null);

  const gallery = buildBeltGalleryImages(
    {
      code: pfam,
      legacyFamilyCodes: ['FAM-52692'],
      name: 'تسمه تایمینگ متریک',
      images: [],
      variants: [{ code: '52692', name: 'تسمه چمفر', size: '100AT20' }],
    },
    [],
    '52692',
  );
  assert.ok(gallery.some((g) => g.scope === 'variant' && g.variantCode === '52692' && g.url.includes('/52692/profile-drawing.webp')));
  assert.ok(gallery.some((g) => g.scope === 'family' && g.url.includes(`/${encodeURIComponent(pfam)}/family-specifications.webp`)));
});

test('validateFamilyMenuAssignment accepts restored DB leaf names and rejects false placements', () => {
  assert.equal(
    validateFamilyMenuAssignment({
      familyCode: 'PFAM-TIMING-AT10',
      familyName: 'تسمه تایمینگ سیم‌دار AT10 FORZA',
      productType: 'تسمه تایمینگ',
      material: 'پلی‌یورتان',
      profile: 'AT10',
      categorySlug: 'excel-v2-1-1',
      submenuName: 'انواع گام و کدهای تایمینگ',
      leafName: 'T5 , AT5 , AT10 , AT20',
    }).valid,
    true,
  );

  assert.equal(
    validateFamilyMenuAssignment({
      familyCode: 'PFAM-VBELT-SPB',
      familyName: 'تسمه وی‌بلت اسپشیال SPB BANDO',
      productType: 'تسمه وی‌بلت',
      material: 'لاستیک',
      profile: 'SPB',
      categorySlug: 'excel-v2-1-2',
      submenuName: 'تسمه اسپشیال',
      leafName: 'SPA , SPB , SPC و دندانه‌دار',
    }).valid,
    true,
  );

  assert.equal(
    validateFamilyMenuAssignment({
      familyCode: 'PFAM-WELDED-PU-B',
      familyName: 'تسمه جوشی پلی‌یورتان V شکل B',
      productType: 'تسمه جوشی V شکل',
      material: 'PU',
      profile: 'B',
      categorySlug: 'excel-v2-1-3',
      submenuName: 'تسمه جوشی V شکل (A / B / C)',
      leafName: null,
    }).valid,
    true,
  );

  assert.equal(
    validateFamilyMenuAssignment({
      familyCode: 'PFAM-POLYV-PK',
      familyName: 'تسمه چندشیاری PK POWER',
      productType: 'تسمه چندشیاری',
      material: 'لاستیک',
      profile: 'PK',
      categorySlug: 'excel-v2-1-5',
      submenuName: 'پروفیل PK',
      leafName: null,
    }).valid,
    true,
  );

  assert.equal(
    validateFamilyMenuAssignment({
      familyCode: 'PFAM-MOLD-REJECT',
      familyName: 'قالب تفلونی گام AT10',
      productType: 'قالب صنعتی',
      material: 'تفلون',
      profile: 'AT10',
      categorySlug: 'excel-v2-1-1',
      submenuName: 'انواع گام و کدهای تایمینگ',
      leafName: 'T5 , AT5 , AT10 , AT20',
    }).valid,
    false,
  );

  assert.equal(
    validateFamilyMenuAssignment({
      familyCode: 'PFAM-COUPLING-ROTEX',
      familyName: 'لاستیک کوپلینگ انعطاف‌پذیر ROTEX',
      productType: 'لاستیک کوپلینگ',
      material: 'پلی‌یورتان',
      profile: 'ROTEX',
      categorySlug: 'excel-v2-4-2',
      submenuName: 'کوپلینگ شفت و همزن',
      leafName: null,
    }).valid,
    true,
  );

  assert.equal(
    validateFamilyMenuAssignment({
      familyCode: 'PFAM-PTFE-SHEET',
      familyName: 'ورق تفلون ضدسایش PTFE',
      productType: 'ورق پلیمری مهندسی',
      material: 'تفلون (PTFE / UHMWPE)',
      profile: 'SHEET_PTFE',
      categorySlug: 'excel-v2-7-4',
      submenuName: 'ورق و میلگرد پلیمری',
      leafName: null,
    }).valid,
    true,
  );

  assert.equal(
    validateFamilyMenuAssignment({
      familyCode: 'PFAM-HOSE-PVC',
      familyName: 'شیلنگ صنعتی PVC سیم‌دار',
      productType: 'شیلنگ صنعتی',
      material: 'پلی‌وینیل کلراید (PVC)',
      profile: 'HOSE_PVC',
      categorySlug: 'excel-v2-7-5',
      submenuName: 'شیلنگ صنعتی',
      leafName: null,
    }).valid,
    true,
  );

  assert.equal(
    validateFamilyMenuAssignment({
      familyCode: 'PFAM-STACKER-GUIDE',
      familyName: 'راهنمای کاشی خطوط لعاب و استاکر',
      productType: 'راهنمای کاشی',
      material: 'پلی‌یورتان',
      profile: 'TILE_GUIDE',
      categorySlug: 'excel-v2-10-3',
      submenuName: 'راهنمای کاشی و ردیف‌کن',
      leafName: null,
    }).valid,
    true,
  );

  assert.equal(
    validateFamilyMenuAssignment({
      familyCode: 'PFAM-BUSHING-NOT-MESH',
      familyName: 'بوش مشکی آجدار داخل 32',
      productType: 'بوش صنعتی',
      material: 'پلیمر صنعتی',
      profile: 'ROLLER_BUSHING',
      categorySlug: 'excel-v2-11-1',
      submenuName: 'انواع توری مش',
      leafName: null,
    }).valid,
    false,
  );

  assert.equal(
    validateFamilyMenuAssignment({
      familyCode: 'PFAM-WELDING-NOT-CUSTOM',
      familyName: 'دستگاه هویه آپارات تسمه جوشی ولتا',
      productType: 'دستگاه جوش تسمه صنعتی',
      material: 'استیل',
      profile: 'WELDER',
      categorySlug: 'excel-v2-12-1',
      submenuName: 'مطابق با نقشه فنی',
      leafName: null,
    }).valid,
    false,
  );
});

import fs from 'node:fs';
import path from 'node:path';
import {
  buildInvariantFamilyKey,
  isSpecLessPlaceholder,
  refineEngineeredSku,
  type EngineeredSkuInput,
} from './catalogEngineering';

function makeSkuInput(overrides: Partial<EngineeredSkuInput>): EngineeredSkuInput {
  return {
    skuCode: 'TEST-1',
    originalProductName: 'تسمه آزمایشی',
    originalSize: '',
    sourceFamilyCode: 'FAM-TEST',
    sourceFamilyName: 'تسمه آزمایشی',
    sourceCategory: 'تسمه و انتقال نیرو',
    sourceSubmenu: 'تسمه وی‌بلت',
    sourceTechnicalType: 'تسمه V شکل',
    sourceMaterial: 'لاستیک',
    productType: 'تسمه V شکل',
    brand: 'GENERIC_INDUSTRIAL',
    material: 'لاستیک کلروپرن',
    construction: 'مداربسته',
    profile: '',
    standard: 'DIN 2215',
    unit: 'حلقه',
    proposedCategorySlug: 'excel-v2-1-2',
    proposedCategory: 'تسمه وی‌بلت (V-Belt)',
    proposedSubmenu: 'کلاسیک و دنده‌دار',
    proposedLeaf: 'Z (9.5) , M , A , B , C , D , E , 8V',
    familyDecision: 'APPROVED_FAMILY',
    decisionReason: 'test',
    technicalEvidence: 'INVENTORY_DESCRIPTION',
    confidence: 'HIGH',
    ...overrides,
  };
}

test('refineEngineeredSku classifies V-Belt hierarchy accurately (classical, cogged, narrow wedge, hex, perforated, banded)', () => {
  const classical = refineEngineeredSku(
    makeSkuInput({ skuCode: '333', originalProductName: 'تسمه دانگيل A36', profile: 'A' }),
  );
  assert.equal(classical.status, 'VALID');
  assert.equal(classical.brand, 'DONGIL');
  assert.equal(classical.profile, 'A');
  assert.equal(classical.unit, 'حلقه');
  assert.equal(classical.proposedCategorySlug, 'excel-v2-1-2');
  assert.equal(classical.proposedSubmenu, 'کلاسیک و دنده‌دار');
  assert.equal(classical.proposedLeaf, 'Z (9.5) , M , A , B , C , D , E , 8V');

  const swrZ = refineEngineeredSku(
    makeSkuInput({ skuCode: '38910', originalProductName: 'تسمه 890 * 11/5 SWR', profile: 'Z', productType: 'تسمه با کد ناقص' }),
  );
  assert.equal(swrZ.brand, 'SWR');
  assert.equal(swrZ.profile, 'Z');
  assert.equal(swrZ.proposedCategorySlug, 'excel-v2-1-2');

  const optiTypo = refineEngineeredSku(
    makeSkuInput({ skuCode: '37541', originalProductName: 'تسه اپتي C185', profile: 'C', proposedCategorySlug: 'UNRESOLVED' }),
  );
  assert.equal(optiTypo.brand, 'OPTIBELT');
  assert.equal(optiTypo.profile, 'C');
  assert.equal(optiTypo.proposedCategorySlug, 'excel-v2-1-2');

  const narrowMetric = refineEngineeredSku(
    makeSkuInput({ skuCode: '10742', originalProductName: 'تسمه SPA2732 FORZA', profile: 'SPA' }),
  );
  assert.equal(narrowMetric.proposedSubmenu, 'تسمه اسپشیال');
  assert.equal(narrowMetric.proposedLeaf, 'SPA , SPB , SPC و دندانه‌دار');

  const narrowInch = refineEngineeredSku(
    makeSkuInput({ skuCode: '39734', originalProductName: 'تسمه 6R3VX 565', profile: '3VX-BANDED' }),
  );
  assert.equal(narrowInch.profile, '3VX-BANDED');
  assert.equal(narrowInch.proposedSubmenu, 'تسمه اسپشیال');
  assert.equal(narrowInch.proposedLeaf, 'تسمه باریک و دور متغیر (3V / 5V / 8V)');

  const hex = refineEngineeredSku(
    makeSkuInput({ skuCode: '33794', originalProductName: 'تسمه AA 87 SWR', profile: 'AA' }),
  );
  assert.equal(hex.proposedSubmenu, 'کلاسیک و دنده‌دار');
  assert.equal(hex.proposedLeaf, 'تسمه شش‌ضلعی دوطرفه (AA / BB)');

  const perforated = refineEngineeredSku(
    makeSkuInput({ skuCode: '10560', originalProductName: 'تسمه B سوراخ دار', profile: 'B', unit: 'حلقه' }),
  );
  assert.equal(perforated.profile, 'B-PERFORATED');
  assert.equal(perforated.unit, 'متر');
  assert.equal(perforated.proposedSubmenu, 'وی‌بلت متری');
  assert.equal(perforated.proposedLeaf, 'تسمه A و B و C وی‌بلت متری');
});

test('refineEngineeredSku separates welded PU, haul-off crowned, non-belt hardware, kiln bearings, and placeholders', () => {
  const weldedV = refineEngineeredSku(
    makeSkuInput({ skuCode: 'W-1', originalProductName: 'تسمه جوشي گروه B سبز', profile: 'B', proposedCategorySlug: 'UNRESOLVED' }),
  );
  assert.equal(weldedV.proposedCategorySlug, 'excel-v2-1-3');
  assert.equal(weldedV.proposedSubmenu, 'تسمه جوشی V شکل (A / B / C)');
  assert.equal(weldedV.unit, 'متر');

  const crowned = refineEngineeredSku(
    makeSkuInput({ skuCode: 'C-1', originalProductName: 'تسمه مگادين CRC 225', profile: '', proposedCategorySlug: 'UNRESOLVED' }),
  );
  assert.equal(crowned.proposedCategorySlug, 'excel-v2-1-4');
  assert.equal(crowned.proposedSubmenu, 'تسمه بارکش');

  const hardware = refineEngineeredSku(
    makeSkuInput({
      skuCode: '35635',
      originalProductName: 'اهرم نگهدارنده پولي كد 1250/6',
      productType: 'پایه (فولاد و متریال استاندارد صنعتی)',
      material: 'فولاد و متریال استاندارد صنعتی',
      profile: 'BRACKET',
      proposedCategorySlug: 'excel-v2-9-3',
      proposedSubmenu: 'بست، گیره و پایه نگهدارنده',
      proposedLeaf: 'بست U شکل، پایه رولر و ساپورت صنعتی',
    }),
  );
  assert.equal(hardware.proposedCategorySlug, 'excel-v2-9-3');

  const bushingNotMesh = refineEngineeredSku(
    makeSkuInput({
      skuCode: '40468',
      originalProductName: 'بوش مشكي آج دار داخل 28 كد ت/1162/2',
      productType: 'بوش صنعتی',
      material: 'پلیمر صنعتی',
      profile: 'بوش-صنعتی_STD_SERIES',
      proposedCategorySlug: 'excel-v2-11-1',
      proposedSubmenu: 'انواع توری مش',
      proposedLeaf: 'توری مش در ابعاد و چشمه‌های مختلف',
    }),
  );
  assert.equal(bushingNotMesh.proposedCategorySlug, 'excel-v2-7-4');

  const kilnBearing = refineEngineeredSku(
    makeSkuInput({ skuCode: '40730', originalProductName: 'بلبرينگ كوره', proposedCategorySlug: 'excel-v2-8-2' }),
  );
  assert.equal(kilnBearing.proposedCategorySlug, 'excel-v2-13-1');

  assert.equal(
    isSpecLessPlaceholder(makeSkuInput({ originalProductName: 'تسمه تايم 104', originalSize: '104' })),
    true,
  );
  assert.equal(
    isSpecLessPlaceholder(makeSkuInput({ originalProductName: 'forza 12', originalSize: 'نامشخص' })),
    true,
  );
  assert.equal(
    isSpecLessPlaceholder(makeSkuInput({ originalProductName: 'تسمه آهني', originalSize: 'نامشخص' })),
    true,
  );
});

test('validateFamilyMenuAssignment infers V-belt & double-sided timing profiles cleanly when profile is omitted', () => {
  assert.equal(
    validateFamilyMenuAssignment({
      familyCode: 'FAM-PERF-B',
      familyName: 'تسمه ذوزنقه‌ای سوراخ‌دار متری پروفیل B-PERFORATED',
      productType: 'تسمه ذوزنقه‌ای سوراخ‌دار متری پروفیل B',
      material: 'لاستیک نئوپرن',
      categorySlug: 'excel-v2-1-2',
      submenuName: 'وی‌بلت متری',
      leafName: 'تسمه A و B و C وی‌بلت متری',
    }).valid,
    true,
  );
  assert.equal(
    validateFamilyMenuAssignment({
      familyCode: 'FAM-DH-1000',
      familyName: 'تسمه تایمینگ 1000DH100',
      productType: 'تسمه تایمینگ',
      material: 'لاستیک کلروپرن',
      categorySlug: 'excel-v2-1-1',
      submenuName: 'انواع گام و کدهای تایمینگ',
      leafName: 'H , XH , L , XL',
    }).valid,
    true,
  );
  assert.notEqual(
    buildInvariantFamilyKey(refineEngineeredSku(makeSkuInput({ skuCode: 'A1', originalProductName: 'تسمه A40', profile: 'A' }))),
    buildInvariantFamilyKey(refineEngineeredSku(makeSkuInput({ skuCode: 'AX1', originalProductName: 'تسمه AX40', profile: 'AX' }))),
  );
});

test('generated engineeredCatalog.json has 10,308 valid SKUs with zero semantic guard failures', () => {
  const snapshotPath = path.resolve(process.cwd(), 'server/data/engineeredCatalog.json');
  const raw = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  assert.equal(raw.stats.sourceSkus, 10435);
  assert.equal(raw.stats.validSkus, 10308);
  assert.equal(raw.stats.quarantinedSkus, 127);

  for (const p of raw.products) {
    assert.ok(p.variants.length >= 2, `Family ${p.code} must have >= 2 variants`);
    const specMap = Object.fromEntries((p.technicalSpecs || []).map((s: { key: string; value: string }) => [s.key, s.value]));
    const check = validateFamilyMenuAssignment({
      familyCode: p.code,
      familyName: `${p.name} ${p.variants[0]?.name || ''}`,
      productType: specMap['نوع فنی محصول'] || p.name,
      material: specMap['جنس / متریال'] || '',
      profile: specMap['پروفیل / سری'] || '',
      categorySlug: p.resolvedAssignment.categorySlug,
      submenuName: p.resolvedAssignment.submenuName,
      leafName: p.resolvedAssignment.leafName,
    });
    assert.equal(check.valid, true, `Family ${p.code} failed guard: ${check.reason}`);
  }
});

test('all 17 Master Belt Deliverables exist and beltCatalogManifest enforces zero duplicate family photos', () => {
  const delivDir = path.resolve(process.cwd(), 'deliverables/belt-master-audit');
  const expectedFiles = [
    'complete_family_audit.csv',
    'complete_sku_audit.csv',
    'sku_family_reassignment.csv',
    'global_unassigned_belt_skus.csv',
    'final_family_mapping.json',
    'final_sku_mapping.json',
    'family_image_audit.csv',
    'sku_image_audit.csv',
    'image_manifest.json',
    'manufacturer_sources.json',
    'family_specifications.csv',
    'missing_family_images.csv',
    'missing_sku_images.csv',
    'rejected_images.csv',
    'duplicate_images.csv',
    'technical_drawings_audit.csv',
    'final_coverage_report.md',
  ];
  for (const fn of expectedFiles) {
    const full = path.join(delivDir, fn);
    assert.equal(fs.existsSync(full), true, `Missing deliverable ${fn}`);
    assert.ok(fs.statSync(full).size > 100, `Deliverable ${fn} is unexpectedly empty`);
  }

  const manifestSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/generated/beltCatalogManifest.ts'), 'utf8');
  const match = manifestSrc.match(/export const beltCatalogManifest = ([\s\S]*?) as const;/);
  assert.ok(match);
  const manifest = JSON.parse(match[1]);
  const seenPhotoKeys = new Map<string, string>();
  for (const [famId, entry] of Object.entries<any>(manifest.families)) {
    for (const key of entry.p || []) {
      if (!key) continue;
      assert.equal(
        seenPhotoKeys.has(key),
        false,
        `Photo key ${key} is duplicated between ${seenPhotoKeys.get(key)} and ${famId}`,
      );
      seenPhotoKeys.set(key, famId);
    }
    if (entry.db) {
      assert.equal(
        famId === 'FAM-52858' || famId === 'PFAM-نوار-نقاله-PVC-GENERIC-PVC-STONE-SU-013',
        true,
        `Unexpected db catalog image ${entry.db} on ${famId}`,
      );
    }
  }

  // Verify every STORE_ASSETS image is saved locally in /public/
  const walkAssets = (node: unknown): string[] => {
    if (typeof node === 'string') return [node];
    if (node && typeof node === 'object') return Object.values(node).flatMap(walkAssets);
    return [];
  };
  for (const relUrl of walkAssets(STORE_ASSETS)) {
    const filePath = path.resolve(process.cwd(), 'public', relUrl.replace(/^\/+/, ''));
    assert.equal(fs.existsSync(filePath), true, `Missing local storefront image in /public: ${relUrl}`);
  }

  // Verify every entry in image_manifest.json has a local structured genuine .webp file (RIFF....WEBP) in /public/
  const assertGenuineWebpFile = (fullPath: string, label: string) => {
    assert.equal(fullPath.endsWith('.webp'), true, `${label} must end in .webp: ${fullPath}`);
    assert.equal(fs.existsSync(fullPath), true, `Missing local ${label} file: ${fullPath}`);
    const head = fs.readFileSync(fullPath).subarray(0, 12);
    assert.equal(head.subarray(0, 4).toString('ascii'), 'RIFF', `${label} missing RIFF header: ${fullPath}`);
    assert.equal(head.subarray(8, 12).toString('ascii'), 'WEBP', `${label} missing WEBP signature: ${fullPath}`);
  };

  const imageManifest = JSON.parse(fs.readFileSync(path.join(delivDir, 'image_manifest.json'), 'utf8'));
  const seenManifestKeys = new Set<string>();
  for (const [famId, slots] of Object.entries<any[]>(imageManifest.verifiedFamilyPhotos || {})) {
    for (const slot of slots) {
      assert.equal(slot.visualAuditPassed, true, `Family ${famId} slot ${slot.slotIndex} missing visualAuditPassed`);
      assert.equal(slot.format, 'webp', `Family ${famId} slot ${slot.slotIndex} format must be webp`);
      assert.equal(seenManifestKeys.has(slot.key), false, `Duplicate manifest key: ${slot.key}`);
      seenManifestKeys.add(slot.key);
      assert.ok(slot.localPath, `Missing localPath for family ${famId} slot ${slot.slotIndex}`);
      const relLocal = decodeURIComponent(String(slot.localPath).replace(/^\/+/, ''));
      const fullLocal = path.resolve(process.cwd(), 'public', relLocal);
      assertGenuineWebpFile(fullLocal, `family ${famId} slot ${slot.slotIndex}`);
    }
  }
  for (const [skuId, info] of Object.entries<any>(imageManifest.verifiedSkuPhotos || {})) {
    assert.equal(info.visualAuditPassed, true, `SKU ${skuId} missing visualAuditPassed`);
    assert.equal(info.format, 'webp', `SKU ${skuId} format must be webp`);
    assert.equal(seenManifestKeys.has(info.key), false, `Duplicate SKU manifest key: ${info.key}`);
    seenManifestKeys.add(info.key);
    assert.ok(info.localPath, `Missing localPath for SKU ${skuId}`);
    const relLocal = decodeURIComponent(String(info.localPath).replace(/^\/+/, ''));
    const fullLocal = path.resolve(process.cwd(), 'public', relLocal);
    assertGenuineWebpFile(fullLocal, `SKU ${skuId}`);
  }

  // Ensure zero non-.webp files remain inside public/belt-catalog/families and public/belt-catalog/skus
  const walkFiles = (dir: string): string[] => {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) out.push(...walkFiles(full));
      else out.push(full);
    }
    return out;
  };
  const structuredFiles = [
    ...walkFiles(path.resolve(process.cwd(), 'public/belt-catalog/families')),
    ...walkFiles(path.resolve(process.cwd(), 'public/belt-catalog/skus')),
  ];
  assert.ok(structuredFiles.length >= 96, `Expected >=96 structured .webp files, got ${structuredFiles.length}`);
  for (const f of structuredFiles) {
    assertGenuineWebpFile(f, 'structured belt asset');
  }
});



