import { APPROVED_MENU_CATEGORIES } from './approvedMenuFallback';

export interface FamilyMenuSemanticContext {
  familyCode?: string;
  familyName?: string | null;
  productType?: string | null;
  material?: string | null;
  profile?: string | null;
  categorySlug: string;
  submenuName?: string | null;
  leafName?: string | null;
}

export interface FamilyMenuSemanticValidation {
  valid: boolean;
  reason: string | null;
}

const normalize = (value: unknown): string =>
  String(value ?? '')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200b-\u200f\ufeff\s]+/g, ' ')
    .trim()
    .toLocaleLowerCase('fa-IR');

const matches = (value: string, pattern: RegExp): boolean => pattern.test(value);

export function validateFamilyMenuAssignment(
  context: FamilyMenuSemanticContext
): FamilyMenuSemanticValidation {
  const familyName = normalize(context.familyName);
  const productType = normalize(context.productType);
  const material = normalize(context.material);
  const profile = normalize(context.profile);
  const submenu = normalize(context.submenuName);
  const leaf = normalize(context.leafName);
  const identity = [productType, familyName, profile].filter(Boolean).join(' ');

  const fail = (reason: string): FamilyMenuSemanticValidation => ({ valid: false, reason });
  if (productType === 'mixed' || material === 'mixed' || profile === 'mixed') {
    return fail('family_contains_mixed_technical_identity');
  }

  // Every published family must point to a real approved Excel category and submenu.
  // When a leaf is supplied it must be an exact child of that submenu.
  const approvedCategory = APPROVED_MENU_CATEGORIES.find((item) => item.slug === context.categorySlug);
  if (!approvedCategory) return fail('unapproved_category_slug');
  const approvedSubmenu = (approvedCategory.children || []).find(
    (item) => normalize(item.name) === submenu
  );
  if (!approvedSubmenu) return fail('unapproved_submenu');
  if (leaf) {
    const approvedLeaf = (approvedSubmenu.children || []).some(
      (item) => normalize(item.name) === leaf
    );
    if (!approvedLeaf) return fail('unapproved_leaf');
  }

  // Industrial belt families need both a valid Excel path and a matching engineering identity.
  const rawProfileCode = profile.replace(/-banded$/, '').replace(/[^a-z0-9]/g, '');
  const inferredProfileMatch = identity.match(
    /(?:\b|(?<=\d))(spz|xpz|spa|xpa|spb|xpb|spc|xpc|3vx|5vx|8vx|3v|5v|8v|at20|at10|at5|t20|t10|t5|rpp14m|rpp8m|d14m|d8m|d5m|s8m|14m|11m|8m|5m|3m|mxl|dxh|dxl|dh|dl|xh|xl|zx|mx|ax|bx|cx|aa|bb|cc|pj|pk|pl|crc|brb|trc|flat)(?:\b|(?=\d))|\b(z|m|a|b|c|d|e|k|h|l)\b/i
  );
  const profileCode = rawProfileCode || (inferredProfileMatch ? (inferredProfileMatch[1] || inferredProfileMatch[2]).toLowerCase() : '');
  const isTiming =
    !matches(identity, /قالب|mould|mold/) &&
    matches(
      identity,
      /تسمه\s*تایم|تایمینگ|سیم\s*دار|سیمدار|چاپ.*t\d|چمفر.*at\d|timing|synchronous|htd|rpp|at5|at10|at20|\bt5\b|\bt10\b|\bt20\b/,
    );
  const isPuMaterial = matches(material, /پلی.?یورتان|polyurethane|thermoplastic.?pu|\btpu\b|\bpu\b/);
  const isWeldedPuVSection =
    (isPuMaterial || matches(identity, /تسمه\s*جوشی|welded.{0,24}belt/)) &&
    ['a', 'b', 'c', 'brb'].includes(profileCode) &&
    matches(identity, /تسمه\s*جوشی|welded.{0,24}belt/) &&
    !matches(identity, /گرده.?ماهی|تاج.?دار|ridge.?top/);
  const hasVbeltProfile = [
    'z', 'zx', 'm', 'mx', 'a', 'ax', 'b', 'bx', 'c', 'cx', 'd', 'e', '8v', '8vx',
    'spz', 'xpz', 'spa', 'xpa', 'spb', 'xpb', 'spc', 'xpc', '3v', '3vx', '5v', '5vx', '8v', '8vx',
    'aa', 'bb', 'cc', 'k', 'aperforated', 'bperforated', 'cperforated',
  ].includes(profileCode);
  // Welded PU V-sections belong to 1-3 (تسمه جوشی V شکل), separate from standard wrapped/cogged V-belts.
  const isVbelt =
    (matches(identity, /تسمه(?:\s+جوشی)?\s*v|وی.?بلت|v.?belt|v شکل/) || hasVbeltProfile) &&
    !isWeldedPuVSection;
  const isPolyV = matches(identity, /چندشیاری|شیاری|poly.?v|multi.?rib/) || ['pj', 'pk', 'pl'].includes(profileCode);
  const isRubberMaterial = matches(material, /لاستیک|الاستومر|rubber|elastomer|nbr|epdm|fkm|viton|neoprene|کلروپرن/);
  const isRidgeTop = matches(identity, /تاج.?دار|گرده.?ماهی|ridge.?top|crowned/);
  const isWeldingDevice = matches(
    identity,
    /دستگاه.*(?:جوش|آپارات|پولیش|تزریق).*تسمه|دستگاه\s*(?:پولیش|تزریق)\s*apl|گیره.*آپارات.*تسمه|قیچی.*آپارات|قیچی\s*\(?\s*forza|belt.*weld.*device/,
  );
  const isConveyorBelt = matches(identity, /نوار نقاله|تسمه بارکش|تسمه نقاله|conveyor|belt conveyor|گریپ.?آجدار|ترمزگیر/);
  const isNonBeltItem = matches(
    identity,
    /تسمه سفت.?کن|belt.?tensioner|tensioner|تسمه پاک.?کن|belt.?cleaner|scraper|اسکریپر|تیغه فلزی|تسمه آهنی/,
  );

  if (context.categorySlug === 'excel-v2-1-1') {
    if (!isTiming || isVbelt || isPolyV || isNonBeltItem) {
      return fail('timing_category_product_type_mismatch');
    }
    const isAutomotive = matches(identity, /auto.?ru|auto.?8mm|zrk|خودرویی|لیفتراکی/);
    if (isAutomotive && leaf !== normalize('تایمینگ خودرویی و لیفتراکی (ZRK / RU)')) {
      return fail('automotive_timing_must_use_automotive_leaf');
    }

    if (submenu === normalize('سیم‌دار فابریک')) {
      if (leaf === normalize('پلی‌یورتان') && !isPuMaterial) {
        return fail('polyurethane_timing_leaf_without_pu_material');
      }
      if (leaf === normalize('APL دار') && !matches(identity, /apl|چاپ|چمفر|گریپ|ضدسایش|روکش|coating/)) {
        return fail('apl_timing_leaf_without_coating_identity');
      }
    }

    if (
      submenu === normalize('لاستیکی فابریک') &&
      !isRubberMaterial &&
      leaf !== normalize('تایمینگ خودرویی و لیفتراکی (ZRK / RU)')
    ) {
      return fail('rubber_timing_leaf_without_rubber_material');
    }

    if (submenu === normalize('انواع گام و کدهای تایمینگ')) {
      if (
        (leaf === normalize('T5 , T10 , T20 , AT5 , AT10 , AT20') || leaf === normalize('T5 , AT5 , AT10 , AT20')) &&
        !['t5', 't10', 't20', 'at5', 'at10', 'at20'].includes(profileCode)
      ) {
        return fail('metric_timing_leaf_profile_mismatch');
      }
      if (leaf === normalize('H , XH , L , XL') && !['h', 'xh', 'l', 'xl', 'dh', 'dl', 'dxh', 'dxl'].includes(profileCode)) {
        return fail('imperial_timing_leaf_profile_mismatch');
      }
      if (
        leaf === normalize('5M , 8M , 11M , 14M') &&
        !['5m', '8m', '11m', '14m', 'rpp8m', 'rpp14m', 'd5m', 'd8m', 'd14m', 's8m'].includes(profileCode)
      ) {
        return fail('curvilinear_timing_leaf_profile_mismatch');
      }
      if (leaf === normalize('3M , MXL') && !['3m', 'mxl'].includes(profileCode)) {
        return fail('mini_timing_leaf_profile_mismatch');
      }
    }
  }

  if (context.categorySlug === 'excel-v2-1-2') {
    if (!isVbelt || isPolyV) return fail('vbelt_category_product_type_mismatch');

    if (submenu === normalize('وی‌بلت متری') && !['a', 'b', 'c', 'aperforated', 'bperforated', 'cperforated'].includes(profileCode)) {
      return fail('vbelt_meter_leaf_profile_mismatch');
    }

    if (submenu === normalize('کلاسیک و دنده‌دار')) {
      const classicAllowed = ['z', 'zx', 'm', 'mx', 'a', 'ax', 'b', 'bx', 'c', 'cx', 'd', 'e', 'k', '8v', '8vx'];
      if (leaf === normalize('تسمه شش‌ضلعی دوطرفه (AA / BB)')) {
        if (!['aa', 'bb', 'cc'].includes(profileCode)) return fail('vbelt_double_hex_profile_mismatch');
      } else if (!classicAllowed.includes(profileCode)) {
        return fail('vbelt_classical_leaf_profile_mismatch');
      }
    }

    if (submenu === normalize('تسمه اسپشیال')) {
      const narrowMetric = ['spz', 'xpz', 'spa', 'xpa', 'spb', 'xpb', 'spc', 'xpc'];
      const narrowInch = ['3v', '3vx', '5v', '5vx', '8v', '8vx'];
      if (leaf === normalize('تسمه باریک و دور متغیر (3V / 5V / 8V)')) {
        if (!narrowInch.includes(profileCode)) return fail('vbelt_special_leaf_profile_mismatch');
      } else if (
        leaf === normalize('SPZ , XPZ , SPA , XPA , SPB , XPB , SPC , XPC و دندانه‌دار') ||
        leaf === normalize('SPA , SPB , SPC و دندانه‌دار')
      ) {
        if (!narrowMetric.includes(profileCode)) return fail('vbelt_special_leaf_profile_mismatch');
      } else if (![...narrowMetric, ...narrowInch].includes(profileCode)) {
        return fail('vbelt_special_leaf_profile_mismatch');
      }
    }
  }

  if (context.categorySlug === 'excel-v2-1-3') {
    if (isRidgeTop) return fail('ridge_top_belt_is_not_welded_pu');
    if (submenu === normalize('تسمه گرد (CRC)')) {
      const roundOk = ['crc', 'brb', 'round'].includes(profileCode) || matches(identity, /تسمه\s*(?:جوشی\s*)?گرد|crc|brb/);
      if (!roundOk) return fail('welded_round_leaf_profile_mismatch');
    }
    if (submenu === normalize('تسمه فلت')) {
      if (['a', 'b', 'c', 'brb'].includes(profileCode) || !['flat', 'f'].includes(profileCode)) {
        return fail('welded_flat_leaf_profile_mismatch');
      }
    }
    if (submenu === normalize('تسمه جوشی V شکل (A / B / C)')) {
      if (!['a', 'b', 'c', 'brb'].includes(profileCode) && !matches(identity, /گروه\s*(?:a|b|c)/)) {
        return fail('welded_v_leaf_profile_mismatch');
      }
    }
  }

  if (context.categorySlug === 'excel-v2-1-4') {
    if (isNonBeltItem) return fail('belt_equipment_category_contains_non_belt_item');
    if (submenu === normalize('تسمه بارکش') && !isRidgeTop && !isConveyorBelt) {
      return fail('hauling_belt_leaf_requires_crowned_conveyor_identity');
    }
    if (submenu === normalize('دستگاه‌های تسمه جوشی') && !isWeldingDevice) {
      return fail('belt_welding_equipment_leaf_product_type_mismatch');
    }
  }

  if (context.categorySlug === 'excel-v2-1-5') {
    if (!isPolyV) return fail('polyv_category_product_type_mismatch');
    if (submenu === normalize('پروفیل PJ') && profileCode !== 'pj') return fail('polyv_pj_profile_mismatch');
    if (submenu === normalize('پروفیل PK') && profileCode !== 'pk') return fail('polyv_pk_profile_mismatch');
    if (submenu === normalize('پروفیل PL') && profileCode !== 'pl') return fail('polyv_pl_profile_mismatch');
  }

  if (context.categorySlug === 'excel-v2-4-1') {
    if (matches(identity, /کوپلینگ|کوبلینگ|coupling/)) return fail('pulley_category_contains_coupling');
    if (!matches(identity, /پولی|pulley/)) return fail('pulley_category_product_type_mismatch');
  }

  if (context.categorySlug === 'excel-v2-4-2') {
    if (!matches(identity, /کوپلینگ|کوبلینگ|coupling|rotex/)) return fail('coupling_category_product_type_mismatch');
  }

  if (context.categorySlug === 'excel-v2-9-4') {
    if (matches(identity, /کوپلینگ|کوبلینگ|coupling/)) return fail('wheel_category_contains_shaft_coupling');
    if (!matches(identity, /چرخ|چرخ.?دنده|چرخ.?زنجیر|دنده.?زنجیر|sprocket|gear|wheel|پالت.?آیزر/)) {
      return fail('wheel_category_product_type_mismatch');
    }
  }

  if (context.categorySlug === 'excel-v2-6-2') {
    const isGuide = matches(identity, /گاید|راهنما|ریل|نرده|فکی|گیره.*گاید|ذخیره.?کن|guide|rail/);
    if (!isGuide) return fail('guide_category_product_type_mismatch');

    if (submenu === normalize('گاید تفلونی')) {
      if (!matches(material, /تفلون|ptfe|uhmwpe/)) return fail('teflon_guide_without_teflon_material');
    }

    if (submenu === normalize('نرده استیل')) {
      if (!matches(material, /استیل|stainless|ss\s*304|ss\s*316/)) {
        return fail('stainless_rail_without_stainless_material');
      }
    }
  }

  if (context.categorySlug === 'excel-v2-6-1') {
    if (!matches(identity, /ریل|سر.?ریلی|گاید|راهنما|rail|guide/)) return fail('rail_category_product_type_mismatch');
    if (submenu === normalize('بر اساس جنس')) {
      if (matches(leaf, /استیل/) && !matches(material, /استیل|stainless|ss\s*304|ss\s*316/)) {
        return fail('stainless_rail_leaf_material_mismatch');
      }
      if (matches(leaf, /تفلون/) && !matches(material, /تفلون|ptfe|uhmwpe|پلی.?یورتان|polyurethane|\btpu\b|\bpu\b/)) {
        return fail('teflon_rail_leaf_material_mismatch');
      }
      if (matches(leaf, /آهنی/) && !matches(material, /فولاد|آهن|steel|carbon/)) {
        return fail('iron_rail_leaf_material_mismatch');
      }
      if (matches(leaf, /گالوانیزه/) && !matches(material, /گالوانیزه|galvanized/)) {
        return fail('galvanized_rail_leaf_material_mismatch');
      }
      if (
        matches(leaf, /آلومینیوم/) &&
        !matches(material, /آلومینیوم|aluminum/) &&
        !matches(identity, /سر.?ریل|انتهای\s*ریل|ابتدای\s*ریل|هلالی\s*ریل|محافظ\s*سر\s*ریل/)
      ) {
        return fail('aluminum_rail_leaf_material_mismatch');
      }
    }
  }

  if (context.categorySlug === 'excel-v2-7-1') {
    const rubberProduct = matches(identity, /لاستیک|الاستومر|ضربه.?گیر|مکنده|دیافراگم|گریپ|اورینگ|پکینگ|کاسه.?نمد|rubber|elastomer|bumper|suction|seal/);
    const elastomerMaterial = matches(material, /لاستیک|الاستومر|rubber|elastomer|nbr|epdm|fkm|viton|سیلیکون|silicone/);
    const explicitlyNonRubberMaterial = matches(material, /پلی.?وینیل.?کلراید|\bpvc\b|تفلون|\bptfe\b|uhmwpe|پلی.?آمید|polyamide|پلی.?یورتان|polyurethane|\btpu\b|\bpu\b|فولاد|آهن|steel|آلومینیوم|aluminum/);
    if (explicitlyNonRubberMaterial && !rubberProduct) return fail('rubber_category_non_rubber_material');
    if (matches(material, /تفلون|ptfe|uhmwpe/) && matches(identity, /پاک.?کن|ورق|بوش|تفلون/)) {
      return fail('ptfe_part_must_use_engineering_polymer_category');
    }
    if (!rubberProduct && !elastomerMaterial) return fail('rubber_category_product_type_or_material_mismatch');
  }

  if (context.categorySlug === 'excel-v2-7-4') {
    const isMetalMat = matches(material, /^فولاد|^استیل|^گالوانیزه|^آلومینیوم|^برنج/);
    if (isMetalMat) return fail('engineering_polymer_category_contains_metal');
  }

  if (context.categorySlug === 'excel-v2-7-5') {
    if (!matches(identity, /شیلنگ|خرطومی|سرشیلنگی|رابط شیلنگ|hose/)) {
      return fail('hose_category_product_type_mismatch');
    }
  }

  if (context.categorySlug === 'excel-v2-8-1' || context.categorySlug === 'excel-v2-8-2') {
    if (matches(identity, /بلبرینگ|یاتاقان|bearing/)) {
      return fail('refractory_category_contains_bearing');
    }
  }

  if (context.categorySlug === 'excel-v2-9-2') {
    if (!matches(identity, /پمپ|پروانه|پوسته|دیافراگم|همزن|سه.?راهی|pump|impeller/)) {
      return fail('pump_category_product_type_mismatch');
    }
  }

  if (context.categorySlug === 'excel-v2-9-3' && submenu === normalize('دستگیره و پیچ فلکه')) {
    if (!matches(identity, /دستگیره|پیچ.?فلکه|پیچ.?دسته.?دار|handwheel|knob|handle/)) {
      return fail('handle_category_product_type_mismatch');
    }
  }

  if (context.categorySlug === 'excel-v2-9-5') {
    if (!matches(identity, /قاشقک|الواتور|elevator|scoop/)) {
      return fail('bucket_category_product_type_mismatch');
    }
  }

  if (context.categorySlug === 'excel-v2-10-1' && submenu === normalize('اسپاتول سیلیکونی')) {
    if (!matches(identity, /اسپاتول|squeegee/)) return fail('spatula_leaf_product_type_mismatch');
  }

  if (context.categorySlug === 'excel-v2-10-3') {
    if (!matches(identity, /استاکر|استکر|راهنما|ردیف.?کن|فکی|کاشی|لقمه|stacker|guide|tile/)) {
      return fail('stacker_category_product_type_mismatch');
    }
  }

  if (context.categorySlug === 'excel-v2-11-1') {
    if (!matches(identity, /توری|توری\s*مش|(?:^|\s)مش(?:\s|\d|$)|سرند|wire.?mesh|\bmesh\b|_mesh_/)) {
      return fail('wire_mesh_category_product_type_mismatch');
    }
  }

  if (context.categorySlug === 'excel-v2-12-1') {
    if (matches(identity, /بدون نوع کالا/) || isWeldingDevice || isTiming || isVbelt) {
      return fail('custom_category_contains_non_custom_or_unresolved_item');
    }
  }

  return { valid: true, reason: null };
}
