import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  buildFamilySearchQuery,
  buildSkuSearchQuery,
  classifyUnverifiedSkuFinalStatus,
  evaluateFamilyVerdict,
  evaluateSkuVerdict,
  evaluateStrictSkuHardGate,
  extractSkuTechnicalTokens,
  groupMissingFamilyRows,
  isBlockedCandidateUrl,
  parseCliArgs,
  parseCsvRecords,
  PATHS,
  rankSerperCandidates,
  retryWithExponentialBackoff,
  runWithConcurrency,
  serializeCsvRecords,
  validateRequiredEnv,
  validateSameBeltCloseupLink,
  type FamilyAngleSlot,
  type MissingFamilyCsvRow,
  type MissingSkuCsvRow,
} from './real-belt-image-pipeline';

test('parseCliArgs parses --mode, --engine, --limit, --concurrency, and validates errors', () => {
  assert.deepEqual(parseCliArgs(['--mode=families', '--limit=10']), {
    mode: 'families',
    engine: 'auto',
    limit: 10,
    concurrency: 3,
    retryNotFound: false,
    help: false,
  });
  assert.deepEqual(parseCliArgs(['--mode', 'skus', '--engine=audit', '--limit', '25', '--concurrency=9', '--retry-not-found']), {
    mode: 'skus',
    engine: 'audit',
    limit: 25,
    concurrency: 3, // strictly capped at MAX_CONCURRENCY=3
    retryNotFound: true,
    help: false,
  });
  assert.equal(parseCliArgs(['--help']).help, true);
  assert.throws(() => parseCliArgs([]), /Missing required flag/);
  assert.throws(() => parseCliArgs(['--mode=invalid']), /Invalid --mode/);
  assert.throws(() => parseCliArgs(['--mode=skus', '--limit=0']), /Invalid --limit/);
});

test('validateRequiredEnv enforces SERPER_API_KEY and GEMINI_API_KEY', () => {
  assert.throws(() => validateRequiredEnv({}), /SERPER_API_KEY, GEMINI_API_KEY/);
  assert.throws(
    () => validateRequiredEnv({ SERPER_API_KEY: 'MY_SERPER_API_KEY', GEMINI_API_KEY: 'real-key' }),
    /SERPER_API_KEY/,
  );
  assert.deepEqual(validateRequiredEnv({ SERPER_API_KEY: 'serper-123', GEMINI_API_KEY: 'gemini-456' }), {
    serperApiKey: 'serper-123',
    geminiApiKey: 'gemini-456',
  });
});

test('CSV parser and serializer handle real missing_family_images.csv and missing_sku_images.csv cleanly', () => {
  const famRows = parseCsvRecords<MissingFamilyCsvRow>(fs.readFileSync(PATHS.missingFamiliesCsv, 'utf8'));
  assert.ok(famRows.length > 100);
  const grouped = groupMissingFamilyRows(famRows);
  assert.ok(grouped.length > 50);
  assert.equal(grouped[0].familyId, 'PFAM-تسمه-V-شکل-کلا-SWR-B-001');
  assert.deepEqual(grouped[0].missingSlots, ['01-main', '02-angle', '03-detail', '04-closeup']);

  const skuRows = parseCsvRecords<MissingSkuCsvRow>(fs.readFileSync(PATHS.missingSkusCsv, 'utf8'));
  assert.ok(skuRows.length > 1000);
  assert.ok(skuRows[0].sku_id.length > 0);

  const roundTrip = serializeCsvRecords(
    ['a', 'b'],
    [{ a: 'hello, "world"', b: 'تسمه تایمینگ' }],
  );
  const parsed = parseCsvRecords<{ a: string; b: string }>(roundTrip);
  assert.deepEqual(parsed, [{ a: 'hello, "world"', b: 'تسمه تایمینگ' }]);
});

test('search query builders construct precise manufacturer/series/profile/dimension queries', () => {
  const famQuery = buildFamilySearchQuery({
    familyId: 'PFAM-TEST',
    familyName: 'تسمه تایمینگ Optibelt 8M',
    brand: 'OPTIBELT',
    beltDivision: 'timing-htd',
    profile: '8M',
    missingSlots: ['01-main'],
    seriesHint: 'OMEGA',
    englishNameHint: '',
    materialHint: '',
    standardHint: '',
  });
  assert.equal(famQuery, 'OPTIBELT OMEGA 8M HTD curvilinear rubber timing belt product photo');

  const tokens = extractSkuTechnicalTokens('تسمه چاپ مگادين TNXداخل سبز اصلي 20 * 1275 * T5', 'T5');
  assert.ok(tokens.dimensionTokens.includes('20'));
  assert.ok(tokens.dimensionTokens.includes('1275'));

  const skuQuery = buildSkuSearchQuery({
    sku_id: '58132',
    raw_title: 'تسمه چاپ مگادين TNXداخل سبز اصلي 20 * 1275 * T5',
    source_family_id: 'FAM-58132',
    proposed_family_id: 'FAM-TIMING-PU-T5-ENDLESS-PRINT-MEGADYNE',
    brand: 'MEGADYNE',
    belt_division: 'timing-metric-single',
    profile: 'T5',
    missing_slot: '01-real-marking.webp',
    status: 'NOT_FOUND',
    technical_drawing_status: 'VERIFIED_ENGINEERING_REDRAW',
    required_action_fa: '',
  });
  assert.ok(skuQuery.includes('MEGADYNE'));
  assert.ok(skuQuery.includes('MEGALINEAR'));
  assert.ok(skuQuery.includes('T5'));
  assert.ok(skuQuery.includes('1275'));
  assert.ok(skuQuery.toLowerCase().includes('belt'));
});

test('rankSerperCandidates filters stock/SVG URLs and prioritizes official manufacturer domains', () => {
  assert.ok(isBlockedCandidateUrl('https://www.shutterstock.com/image-photo/belt-123.jpg'));
  assert.ok(isBlockedCandidateUrl('https://example.com/diagram.svg'));
  assert.equal(isBlockedCandidateUrl('https://www.optibelt.com/images/omega-8m.jpg'), null);

  const ranked = rankSerperCandidates(
    [
      { title: 'Stock belt', imageUrl: 'https://www.istockphoto.com/belt.jpg', imageWidth: 1200 },
      { title: 'Random shop belt', imageUrl: 'https://random-shop.example/belt.jpg', imageWidth: 800 },
      { title: 'Optibelt OMEGA 8M', imageUrl: 'https://www.optibelt.com/media/omega-8m.jpg', imageWidth: 1000 },
    ],
    'OPTIBELT',
    12,
  );
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].imageUrl, 'https://www.optibelt.com/media/omega-8m.jpg');
});

test('evaluateFamilyVerdict and evaluateSkuVerdict enforce strict >=85 confidence and non-duplicate slots', () => {
  const filled = new Set<FamilyAngleSlot>(['01-main']);
  const requested = new Set<FamilyAngleSlot>(['02-angle', '03-detail']);

  assert.equal(
    evaluateFamilyVerdict(
      {
        isRealPhysicalBeltPhoto: true,
        matchesFamilySpecs: true,
        angleCategory: '01-main',
        confidence: 95,
        detectedBrand: 'OPTIBELT',
        detectedFeatures: 'black rubber belt',
        reason: 'full loop',
      },
      filled,
      requested,
    ).accepted,
    false,
  );

  assert.equal(
    evaluateFamilyVerdict(
      {
        isRealPhysicalBeltPhoto: true,
        matchesFamilySpecs: true,
        angleCategory: '02-angle',
        confidence: 84,
        detectedBrand: 'OPTIBELT',
        detectedFeatures: 'angled belt',
        reason: 'slightly blurry',
      },
      filled,
      requested,
    ).accepted,
    false,
  );

  assert.equal(
    evaluateFamilyVerdict(
      {
        isRealPhysicalBeltPhoto: true,
        matchesFamilySpecs: true,
        angleCategory: '02-angle',
        confidence: 92,
        detectedBrand: 'OPTIBELT',
        detectedFeatures: 'angled 8M HTD belt',
        reason: 'clear real photo',
      },
      filled,
      requested,
    ).accepted,
    true,
  );

  assert.equal(
    evaluateSkuVerdict(
      {
        isRealPhysicalBeltPhoto: true,
        printedTextOcr: 'optibelt OMEGA 1280 8M',
        matchesBrand: true,
        matchesProfile: true,
        matchesDimensions: true,
        matchesExactSkuSpecs: true,
        confidence: 94,
        reason: 'exact match',
      },
      'OPTIBELT',
    ).accepted,
    true,
  );

  assert.equal(
    evaluateSkuVerdict(
      {
        isRealPhysicalBeltPhoto: true,
        printedTextOcr: 'Gates PowerGrip 1280 8M',
        matchesBrand: false,
        matchesProfile: true,
        matchesDimensions: true,
        matchesExactSkuSpecs: false,
        confidence: 40,
        reason: 'wrong brand',
      },
      'OPTIBELT',
    ).accepted,
    false,
  );
});

test('runWithConcurrency enforces max worker cap and retryWithExponentialBackoff recovers from 429', async () => {
  let active = 0;
  let maxObserved = 0;
  await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async () => {
    active++;
    maxObserved = Math.max(maxObserved, active);
    await new Promise((r) => setTimeout(r, 15));
    active--;
  });
  assert.ok(maxObserved <= 3 && maxObserved >= 1);

  let attempts = 0;
  const val = await retryWithExponentialBackoff(
    'test-429',
    async () => {
      attempts++;
      if (attempts < 2) {
        const err = new Error('HTTP 429 Too Many Requests') as Error & { status?: number };
        err.status = 429;
        throw err;
      }
      return 'ok';
    },
    3,
    10,
  );
  assert.equal(val, 'ok');
  assert.equal(attempts, 2);
});

test('Condition 1 & 3 Hard Gate: enforces simultaneous 5-way check, rejects OCR-only and decouples licenseStatus from visualStatus', () => {
  const validInput = {
    licenseStatus: 'USER_CONFIRMED',
    visualStatus: 'VERIFIED',
    frontFacingMarking: true,
    readableWithoutAbnormalZoom: true,
    unmanipulatedRealPhoto: true,
    productIdentityMatched: true,
    markingMatched: true,
    brandMatched: true,
    profileMatched: true,
    technicalSpecsMatched: true,
    ocrOnly: false,
    visibleMarking: 'DONGIL SUPER STAR WEDGE 5V1180-SPB3000',
  };

  const pass = evaluateStrictSkuHardGate(validInput);
  assert.equal(pass.passed, true);
  assert.equal(pass.finalStatus, 'VERIFIED_REAL_PRODUCT_IMAGE');

  // OCR alone MUST be rejected even if everything else is true
  const ocrOnlyRes = evaluateStrictSkuHardGate({ ...validInput, ocrOnly: true });
  assert.equal(ocrOnlyRes.passed, false);
  assert.ok(ocrOnlyRes.failedChecks.includes('ocr-only-forbidden'));

  // USER_CONFIRMED license MUST NEVER bypass visualStatus !== 'VERIFIED'
  const licenseOnlyRes = evaluateStrictSkuHardGate({ ...validInput, visualStatus: 'NOT_FOUND' });
  assert.equal(licenseOnlyRes.passed, false);
  assert.equal(licenseOnlyRes.finalStatus, 'NOT_FOUND');

  // Manipulated image / graphic overlay or non-front-facing angle MUST be rejected
  const manipRes = evaluateStrictSkuHardGate({
    ...validInput,
    unmanipulatedRealPhoto: false,
    frontFacingMarking: false,
  });
  assert.equal(manipRes.passed, false);
  assert.ok(manipRes.failedChecks.includes('manipulated-or-non-real-photo'));
  assert.ok(manipRes.failedChecks.includes('marking-surface-not-facing-camera'));
});

test('Condition 2 Same-Belt Closeup Link: enforces provable link between primary and closeup images', () => {
  const validLink = validateSameBeltCloseupLink({
    primarySkuId: '27843',
    closeupSkuId: '27843',
    primarySourcePageUrl: 'https://www.ebay.com/itm/124565690863',
    closeupSourcePageUrl: 'https://www.ebay.com/itm/124565690863/',
    primaryVisibleMarking: 'DONGIL SUPER STAR WEDGE 5V1180-SPB3000',
    closeupVisibleMarking: '5V1180-SPB3000 Z1E',
    primarySha256: 'aaaa1111',
    closeupSha256: 'bbbb2222',
    sameBeltProof: 'Same eBay product listing and identical belt weave',
  });
  assert.equal(validLink.linked, true);

  // Reject identical duplicate hash
  assert.equal(
    validateSameBeltCloseupLink({
      primarySkuId: '27843',
      closeupSkuId: '27843',
      primarySourcePageUrl: 'https://www.ebay.com/itm/124565690863',
      closeupSourcePageUrl: 'https://www.ebay.com/itm/124565690863',
      primaryVisibleMarking: 'DONGIL 5V1180',
      closeupVisibleMarking: '5V1180',
      primarySha256: 'samehash',
      closeupSha256: 'samehash',
      sameBeltProof: 'Same listing evidence',
    }).linked,
    false,
  );

  // Reject different source product page
  assert.equal(
    validateSameBeltCloseupLink({
      primarySkuId: '27843',
      closeupSkuId: '27843',
      primarySourcePageUrl: 'https://www.ebay.com/itm/124565690863',
      closeupSourcePageUrl: 'https://www.ebay.com/itm/999999999999',
      primaryVisibleMarking: 'DONGIL 5V1180',
      closeupVisibleMarking: '5V1180',
      primarySha256: 'aaa',
      closeupSha256: 'bbb',
      sameBeltProof: 'Different page',
    }).linked,
    false,
  );
});

test('Condition 4 Unverified SKU Classifier produces exact official final statuses', () => {
  const baseRow: MissingSkuCsvRow = {
    sku_id: '100',
    raw_title: 'تسمه',
    source_family_id: 'FAM-1',
    proposed_family_id: 'FAM-P1',
    brand: 'DONGIL',
    belt_division: 'vbelt-classical',
    profile: 'B',
    missing_slot: '01-real-marking.webp',
    status: 'NOT_FOUND',
    technical_drawing_status: 'VERIFIED_ENGINEERING_REDRAW',
    required_action_fa: '',
  };

  assert.equal(classifyUnverifiedSkuFinalStatus(baseRow).finalStatus, 'NOT_FOUND');
  assert.equal(
    classifyUnverifiedSkuFinalStatus({ ...baseRow, technical_drawing_status: 'NEEDS_TECHNICAL_DATA' }).finalStatus,
    'NEEDS_MANUAL_REVIEW',
  );
  assert.equal(
    classifyUnverifiedSkuFinalStatus({ ...baseRow, brand: 'UNSPECIFIED' }).finalStatus,
    'SOURCE_UNAVAILABLE',
  );
});

