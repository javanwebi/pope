import { validateFamilyMenuAssignment } from '../data/catalogMenuSemanticGuard';

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

export function normFa(value: unknown): string {
  return String(value ?? '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[\u200b-\u200f\ufeff\s]+/g, ' ')
    .trim();
}

export function normFaLower(value: unknown): string {
  return normFa(value).toLocaleLowerCase('fa-IR');
}

export interface EngineeredSkuInput {
  skuCode: string;
  originalProductName: string;
  originalSize: string;
  sourceFamilyCode: string;
  sourceFamilyName: string;
  sourceCategory: string;
  sourceSubmenu: string;
  sourceTechnicalType: string;
  sourceMaterial: string | null;
  productType: string;
  brand: string;
  material: string;
  construction: string;
  profile: string;
  standard: string;
  unit: string;
  proposedCategorySlug: string;
  proposedCategory: string;
  proposedSubmenu: string;
  proposedLeaf: string | null;
  familyDecision: string;
  decisionReason: string;
  technicalEvidence: string;
  confidence: string;
  specsMap?: Record<string, string>;
}

export interface EngineeredSkuOutput extends EngineeredSkuInput {
  status: 'VALID' | 'QUARANTINED';
  quarantineReason?: string;
}

const BARE_PLACEHOLDER_EXACT = new Set([
  'ترمز گیر',
  'درام',
  'ساچمه',
  'فلنچ',
  'گریس',
  'نمد',
  'ضد سایش',
  'گردگیر',
  'میل گرد',
  'میلگرد',
  'ورق',
  'بوش',
  'فنر',
  'فنر استیل',
  'پیچ',
  'مهره',
  'واشر',
  'بست',
  'کاسه نمد',
  'چرخ دنده',
  'انگشتی رولر',
  'شافت',
  'کوپلینگ',
  'کوبلینگ',
  'بلبرینگ',
  'ترانس',
  'پوسته پمپ',
  'نگهدارنده',
  'تسمه تایم',
  'تسمه تعمیری',
  'تسمه شیاری',
  'تسمه تایم ماشینی',
  'تسمه تایم پارس',
  'تسمه آهنی',
  'مجموعه درایر',
  'وان فایبرگلاس',
]);

const CATEGORY_NAMES: Record<string, string> = {
  'excel-v2-1-1': 'تسمه تایمینگ',
  'excel-v2-1-2': 'تسمه وی‌بلت (V-Belt)',
  'excel-v2-1-3': 'تسمه جوشی با سایت',
  'excel-v2-1-4': 'تسمه بارکش و تجهیزات جوشی',
  'excel-v2-1-5': 'تسمه چندشیاری (Poly-V)',
  'excel-v2-2-1': 'نوار نقاله صنعتی',
  'excel-v2-2-2': 'خدمات نوار نقاله',
  'excel-v2-3-1': 'روکش رولر و غلتک',
  'excel-v2-3-2': 'قطعات رولر',
  'excel-v2-3-3': 'متعلقات نگهدارنده',
  'excel-v2-4-1': 'انواع پولی تایمینگ',
  'excel-v2-4-2': 'کوپلینگ انتقال قدرت',
  'excel-v2-5-1': 'برس سیمی',
  'excel-v2-5-2': 'برس خشک‌کن',
  'excel-v2-6-1': 'انواع ریل راهنما',
  'excel-v2-6-2': 'انواع گاید راهنما',
  'excel-v2-6-3': 'پروفیل و پایه هدایت',
  'excel-v2-6-4': 'سنسور و نگهدارنده‌ها',
  'excel-v2-7-1': 'قطعات لاستیکی صنعتی',
  'excel-v2-7-2': 'آب‌بندها و اورینگ',
  'excel-v2-7-3': 'ضربه‌گیر و مکنده',
  'excel-v2-7-4': 'قطعات تفلونی و پلیمری مهندسی',
  'excel-v2-7-5': 'شیلنگ، لوله خرطومی و اتصالات',
  'excel-v2-8-1': 'نوار برزنتی نسوز (چند لایه)',
  'excel-v2-8-2': 'نخ و عایق نسوز',
  'excel-v2-9-1': 'زنجیر صنعتی',
  'excel-v2-9-2': 'قطعات پمپ',
  'excel-v2-9-3': 'یراق‌آلات و قطعات مکانیکی',
  'excel-v2-9-4': 'چرخ‌های صنعتی',
  'excel-v2-9-5': 'قاشقک الواتور و متعلقات',
  'excel-v2-10-1': 'تجهیزات دستگاه چاپ',
  'excel-v2-10-2': 'تجهیزات روتاری',
  'excel-v2-10-3': 'تجهیزات استاکر و راهنمای کاشی',
  'excel-v2-11-1': 'توری مش صنعتی',
  'excel-v2-12-1': 'ساخت قطعات سفارشی',
  'excel-v2-13-1': 'بلبرینگ صنعتی',
  'excel-v2-13-2': 'یاتاقان و متعلقات',
  'excel-v2-14-1': 'ابر اسفنجی',
  'excel-v2-14-2': 'نوار اسفنجی',
  'excel-v2-14-3': 'اسکاج صنعتی',
};

function detectCleanBrand(name: string, currentBrand: string): string {
  const n = normFaLower(name);
  if (/\bforza\b|فورزا/i.test(n)) return 'FORZA';
  if (/\bmegadyne\b|مگاد[یي]ن|مگدا[یي]ن/i.test(n)) return 'MEGADYNE';
  if (/\boptibelt\b|\bopti\b|او?پت[یي](?:\s*بلت)?/i.test(n)) return 'OPTIBELT';
  if (/\bdongil\b|دانگ[یي]ل/i.test(n)) return 'DONGIL';
  if (/\bvolta\b|ولتا/i.test(n)) return 'VOLTA';
  if (/\bconti(?:tech)?\b|\bkonti\b|کانت[یي](?:\s*تک)?|کنت[یي]/i.test(n)) return 'CONTITECH';
  if (/\bgates\b|گ[یي]تس/i.test(n)) return 'GATES';
  if (/\bbando\b|باندو/i.test(n)) return 'BANDO';
  if (/\bmits[ou]boshi\b|م[یي]تسوبوش[یي]/i.test(n)) return 'MITSUBOSHI';
  if (/\bsemperit\b|سمپر[یي]ت/i.test(n)) return 'SEMPERIT';
  if (/\bperson\b/i.test(n)) return 'PERSON';
  if (/\bgoodyear\b/i.test(n)) return 'GOODYEAR';
  if (/\broulunds\b/i.test(n)) return 'ROULUNDS';
  if (/\bdayco\b|دا[یي]کو/i.test(n)) return 'DAYCO';
  if (/\bpix\b/i.test(n)) return 'PIX';
  if (/\bswr\b/i.test(n)) return 'SWR';
  if (/\bkia\b/i.test(n)) return 'KIA';
  if (/\bskf\b/i.test(n)) return 'SKF';
  if (/\bfag\b/i.test(n)) return 'FAG';
  if (/\bnsk\b/i.test(n)) return 'NSK';
  if (/\bntn\b/i.test(n)) return 'NTN';
  if (/\bkoyo\b/i.test(n)) return 'KOYO';
  if (/\binn?a\b/i.test(n)) return 'INA';
  if (/\btes\b/i.test(n)) return 'TES';
  if (/\bgnr\b/i.test(n)) return 'GNR';
  if (/\bt\.?k\b/i.test(n)) return 'T.K';
  if (/\bt\.?c\b/i.test(n)) return 'T.C';
  if (/\bm[\s.]*t\b/i.test(n)) return 'M.T';
  if (/\bjager\b|جاگر/i.test(n)) return 'JAGER';
  if (/\bhanchang\b|هان\s*چانگ/i.test(n)) return 'HANCHANG';
  if (/\bintro\s*tech\b|\bent[eo]ro\s*tech\b/i.test(n)) return 'INTROTECH';
  if (/\bentro\b/i.test(n)) return 'ENTRO';
  if (/\breflex\b/i.test(n)) return 'REFLEX';
  if (/\btoo[\s-]*duck\b/i.test(n)) return 'TOO-DUCK';
  if (/\bmarshal+\b|مارشال/i.test(n)) return 'MARSHAL';
  if (/\bfuji\b|فوج[یي]/i.test(n)) return 'FUJI';
  if (/\batlas\b|اطلس/i.test(n)) return 'ATLAS';
  if (/\bberavo\b|\bbr[ea]+vo\b/i.test(n)) return 'BERAVO';
  if (/\baa[\s-]*top\b|\baatop\b/i.test(n)) return 'AA-TOP';
  if (/\buni\s*tech\b/i.test(n)) return 'UNI TECH';
  if (/\bmega\s*flex\b/i.test(n)) return 'MEGAFLEX';
  if (/\beh[ae]r\b/i.test(n)) return 'EHER';
  if (/\bhanro\b/i.test(n)) return 'HANRO';
  if (/\bsilver\b/i.test(n)) return 'SILVER';
  if (/\bsynchron?ous\b|س[یي]نکرو/i.test(n)) return 'SYNCHRONOUS';
  if (/\bcandrive\b/i.test(n)) return 'CANDRIVE';
  if (/\bfederal\b/i.test(n)) return 'FEDERAL';
  if (/\bsuperbelt\b/i.test(n)) return 'SUPERBELT';
  if (/\bfortex\b/i.test(n)) return 'FORTEX';
  if (/\bflypard\b/i.test(n)) return 'FLYPARD';
  if (/\bhankook\b/i.test(n)) return 'HANKOOK';
  if (/تکنو\s*اور[یي]ج[یي]نال/i.test(n)) return 'TECHNO ORIGINAL';
  if (/\btechno\b/i.test(n)) return 'TECHNO';
  if (/خارج[یي]/i.test(n) && (!currentBrand || currentBrand === 'GENERIC_INDUSTRIAL')) return 'خارجی';
  if (/ا[یي]ران[یي]/i.test(n) && (!currentBrand || currentBrand === 'GENERIC_INDUSTRIAL')) return 'ایرانی';
  if (/ا[یي]تال[یي]ا/i.test(n) && (!currentBrand || currentBrand === 'GENERIC_INDUSTRIAL')) return 'ایتالیایی';
  if (/آلمان[یي]/i.test(n) && (!currentBrand || currentBrand === 'GENERIC_INDUSTRIAL')) return 'آلمانی';
  if (/انگل[یي]س/i.test(n) && (!currentBrand || currentBrand === 'GENERIC_INDUSTRIAL')) return 'انگلیسی';
  return currentBrand || 'GENERIC_INDUSTRIAL';
}

export function isSpecLessPlaceholder(sku: EngineeredSkuInput): boolean {
  const n = normFaLower(sku.originalProductName);
  const size = normFaLower(sku.originalSize);
  const noSize = !size || size === 'نامشخص' || size === 'ثبت نشده' || size === 'a' || size === '---';

  if (/^forza\s*\d+$/i.test(n)) return true;
  if (noSize && BARE_PLACEHOLDER_EXACT.has(n)) return true;

  // Pitch-less bare timing belt counts like "تسمه تايم 104", "تسمه تايم خارجي 113", "تسمه تايم 134 دنده (DONGIL )"
  if (
    /^تسمه\s*تایم(?:\s*خارجی)?\s*\d+(?:\s*دنده.*)?$/i.test(n) &&
    !/\b(?:xl|l|h|xh|xxh|mxl|t5|t10|t20|at5|at10|at20|3m|5m|8m|14m|htd|rpp|zrk)\b/i.test(n)
  ) {
    return true;
  }

  return false;
}

function setMenuPath(
  out: EngineeredSkuOutput,
  slug: string,
  submenu: string,
  leaf: string | null,
) {
  out.proposedCategorySlug = slug;
  out.proposedCategory = CATEGORY_NAMES[slug] || out.proposedCategory;
  out.proposedSubmenu = submenu;
  out.proposedLeaf = leaf;
}

export function refineEngineeredSku(input: EngineeredSkuInput): EngineeredSkuOutput {
  const out: EngineeredSkuOutput = {
    ...input,
    brand: detectCleanBrand(input.originalProductName, input.brand),
    status: 'VALID',
  };

  const nameNorm = normFaLower(out.originalProductName);
  const sizeNorm = normFaLower(out.originalSize);
  const ptNorm = normFaLower(out.productType);
  const matNorm = normFaLower(out.material);
  const profileUpper = String(out.profile || '').trim().toUpperCase();
  const specsMap: Record<string, string> = { ...(out.specsMap || {}) };

  // 1. Strict Quarantine for genuinely spec-less warehouse placeholders
  if (isSpecLessPlaceholder(out)) {
    out.status = 'QUARANTINED';
    out.familyDecision = 'UNRESOLVED';
    out.quarantineReason = 'کالای فاقد مشخصه ابعادی یا نوع فنی قابل راستی‌آزمایی';
    out.proposedCategorySlug = 'UNRESOLVED';
    out.proposedCategory = 'نیازمند بررسی فنی و فیزیکی انبار';
    out.proposedSubmenu = 'نیازمند تعیین مسیر مصوب';
    out.proposedLeaf = null;
    return out;
  }

  // 2. Fix known non-belt / misplaced hardware overrides FIRST before belt rules

  // Kiln bearing ("بلبرینگ کوره") -> bearings, never refractory
  if (/^بلبرینگ\s*کوره/.test(nameNorm)) {
    out.productType = 'بلبرینگ نسوز / کوره';
    out.material = 'فولاد بلبرینگ مقاوم حرارت';
    out.construction = 'ساختار بلبرینگ شیار عمیق مقاوم حرارت';
    out.profile = 'KILN_BEARING';
    out.standard = 'استاندارد صنعتی کوره';
    out.unit = 'عدد';
    setMenuPath(out, 'excel-v2-13-1', 'انواع بلبرینگ', 'بلبرینگ‌های صنعتی در سایزهای مختلف');
    return out;
  }

  // Belt-prep / welding / cutting machines ("دستگاه هویه آپارات", "دستگاه قیچی آپارات", "دستگاه تزریق APL", "دستگاه پولیش APL", "قیچی (FORZA)")
  if (
    /دستگاه\s*هویه|هویه\s*(?:آپارات|ولتا)|گیره\s*آپارات|دستگاه\s*قیچی\s*آپارات|دستگاه\s*تزریق\s*apl|دستگاه\s*پولیش\s*apl|^قیچی\s*\(?\s*forza/i.test(
      nameNorm,
    )
  ) {
    const isWeldIron = /هویه|گیره\s*آپارات/.test(nameNorm);
    out.productType = isWeldIron ? 'دستگاه و گیره جوش تسمه صنعتی' : 'قیچی و تجهیزات آماده‌سازی تسمه';
    out.material = 'فولاد و متریال استاندارد صنعتی';
    out.construction = isWeldIron ? 'تجهیز حرارتی و گیره آپارات' : 'تجهیز کارگاهی برش و آماده‌سازی تسمه';
    out.profile = isWeldIron ? 'BELT_WELDING_DEVICE' : 'BELT_PREP_TOOL';
    out.standard = 'تجهیزات تخصصی آپارات تسمه';
    out.unit = 'دستگاه';
    setMenuPath(
      out,
      'excel-v2-1-4',
      'دستگاه‌های تسمه جوشی',
      isWeldIron ? 'دستگاه جوش تسمه صنعتی' : 'قیچی و تجهیزات آماده‌سازی تسمه',
    );
    return out;
  }

  // Steel belt cleaner complete assembly ("دستگاه کامل تسمه پاک کن استیل 2 میل")
  if (/دستگاه\s*کامل\s*تسمه\s*پاک\s*کن/.test(nameNorm)) {
    out.productType = 'مجموعه کامل تسمه‌پاک‌کن استیل';
    out.material = 'استیل / فولاد ضدزنگ (Stainless Steel)';
    out.construction = 'مجموعه مکانیکی استیل';
    out.profile = 'STEEL_BELT_CLEANER_ASSEMBLY';
    out.standard = 'خطوط انتقال صنعتی';
    out.unit = 'عدد';
    setMenuPath(out, 'excel-v2-9-3', 'بست، گیره و پایه نگهدارنده', 'بست U شکل، پایه رولر و ساپورت صنعتی');
    return out;
  }

  // Teflon & polymer round-belt guide rails ("ريل تفلوني زير تسمه گرد...", "ريل تفلوني راهنماي تسمه گرد...", "ريل زير تسمه گرد 12...") -> rails, never belts
  if (
    /^ریل\s*(?:تفلونی\s*)?(?:زیر\s*تسمه|راهنمای\s*تسمه)/.test(nameNorm) &&
    !/دستگاه/.test(nameNorm) &&
    !/آلومینیوم|استیل|گالوانیزه|آهن/.test(nameNorm)
  ) {
    out.productType = 'ریل راهنمای تسمه (تفلونی / پلیمری)';
    out.material = 'تفلون صنعتی (PTFE / UHMWPE)';
    out.construction = /چاک\s*دار/.test(nameNorm)
      ? 'ریل راهنمای چاک‌دار زیر تسمه'
      : /تزریقی/.test(nameNorm)
        ? 'ریل راهنمای تزریقی زیر تسمه'
        : /خم\s*90/.test(nameNorm)
          ? 'ریل راهنمای خم ۹۰ درجه زیر تسمه'
          : 'ریل راهنمای صنعتی زیر تسمه';
    out.profile = /چاک\s*دار/.test(nameNorm)
      ? 'GUIDE_RAIL_SLOTTED'
      : /تزریقی/.test(nameNorm)
        ? 'GUIDE_RAIL_INJECTION'
        : 'GUIDE_RAIL_TEFLON';
    out.standard = 'استاندارد قطعات راهنمای خط انتقال';
    out.unit = /متری|3\s*متری/.test(nameNorm) ? 'شاخه' : out.unit || 'متر';
    setMenuPath(out, 'excel-v2-6-1', 'بر اساس جنس', 'ریل راهنما تفلون و متعلقات');
    return out;
  }

  // Foil-backed refractory cloth misplaced in sponges ("پارچه نسوز ابریشمی فویل دار کد 101") + 1260/1430 ceramic fiber kiln diaphragms
  if (
    /پارچه\s*نسوز|پنبه\s*نسوز/.test(nameNorm) ||
    (/دیافراگم\s*نسوز/.test(nameNorm) && /1260|1430/.test(nameNorm))
  ) {
    out.productType = /پارچه/.test(nameNorm)
      ? 'پارچه نسوز فویل‌دار صنعتی'
      : /پنبه/.test(nameNorm)
        ? 'پنبه نسوز سرامیکی کوره'
        : 'عایق و برد نسوز کوره (۱۲۶۰/۱۴۳۰ درجه)';
    out.material = 'الیاف نسوز سرامیکی / فایبرگلاس مقاوم حرارت';
    out.construction = 'عایق حرارتی کوره';
    out.profile = /1430/.test(nameNorm) ? 'REFRACTORY_1430C' : /1260/.test(nameNorm) ? 'REFRACTORY_1260C' : 'REFRACTORY_INSULATION';
    out.standard = 'تجهیزات حرارتی کوره';
    setMenuPath(out, 'excel-v2-8-2', 'عایق، پتو و پارچه نسوز کوره', 'برد، پتو، پنبه و پارچه نسوز ۱۲۶۰ و ۱۴۳۰ درجه');
    return out;
  }

  // Kiln exit conveyor fabric belts where default steel material leaked in
  if (out.proposedCategorySlug === 'excel-v2-8-1' || /نوار\s*(?:برزنتی\s*)?(?:سفید\s*)?(?:نسوز\s*)?خروجی\s*کوره|ورق\s*نسوز\s*قهوه/.test(nameNorm)) {
    if (/فولاد/.test(matNorm) || !matNorm || matNorm === 'unknown') {
      out.material = /برزنتی/.test(nameNorm)
        ? 'پارچه برزنتی مقاوم به حرارت'
        : 'الیاف و پوشش نسوز مقاوم به حرارت';
    }
    const sub = /برزنتی/.test(nameNorm) ? 'برزنتی چسب‌دار' : 'نسوز چسب‌دار';
    const leaf = /برزنتی/.test(nameNorm) ? '(نخ و پارچه) برزنتی در ضخامت مختلف' : '(کتان و چسب) نسوز در ضخامت مختلف';
    setMenuPath(out, 'excel-v2-8-1', sub, leaf);
    return out;
  }

  // Red foam wear strip 10385 wrongly marked steel
  if (/ضد\s*سایش.*فومی/.test(nameNorm)) {
    out.productType = 'نوار ضدسایش فومی';
    out.material = 'فوم و اسفنج پلیمری (Elastomeric Sponge/Foam)';
    out.construction = 'فوم ضدسایش صنعتی';
    out.profile = 'FOAM_ANTI_WEAR';
    setMenuPath(out, 'excel-v2-14-1', 'ابرهای اسفنجی', 'انواع ابر اسفنجی صنعتی');
    return out;
  }

  // 3. BELTS RECOVERY & CLASSIFICATION (Group 1)

  // 3a. Typo "تسه اپتي C185" (missing م in تسمه)
  if (/^تسه\s+اپتی\s+c185/.test(nameNorm)) {
    out.productType = 'تسمه V شکل کلاسیک پروفیل C';
    out.brand = 'OPTIBELT';
    out.material = 'لاستیک با روکش پارچه‌ای (Wrapped V-Belt)';
    out.construction = 'بدنه لاستیکی روکش‌دار با کورد کششی پلی‌استر';
    out.profile = 'C';
    out.standard = 'DIN 2215 / ISO 4184';
    out.unit = 'حلقه';
    setMenuPath(out, 'excel-v2-1-2', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V');
    return out;
  }

  // 3b. Poly-V (PJ / PK / PL)
  const polyVMatch = nameNorm.match(/\b(\d+)\s*(pj|pk|pl)\s*(\d+)\b|\b(pj|pk|pl)\b/i);
  if (
    (/چندشیاری|شیاری|poly.?v/.test(ptNorm) || /\bشیاری\b/.test(nameNorm) || ['PJ', 'PK', 'PL'].includes(profileUpper) || polyVMatch) &&
    !/دستگیره|ریل|چرخ|بوش|قطعه|پروفیل|پولی|آلومینیوم/.test(nameNorm)
  ) {
    const pCode = (polyVMatch?.[2] || polyVMatch?.[4] || profileUpper || 'PK').toUpperCase();
    if (['PJ', 'PK', 'PL'].includes(pCode)) {
      out.productType = `تسمه چندشیاری (Poly-V Belt) پروفیل ${pCode}`;
      out.profile = pCode;
      out.material = out.material && !/unknown/i.test(out.material) ? out.material : 'الاستومر مصنوعی (EPDM / کلروپرن)';
      out.construction = 'تسمه چندشیاری صنعتی';
      out.standard = 'ISO 9982 / DIN 7867';
      out.unit = 'حلقه';
      setMenuPath(out, 'excel-v2-1-5', `پروفیل ${pCode}`, `تسمه چندشیاری ${pCode}`);
      return out;
    }
  }

  // 3c. Metric Chamfered / Coated / Printed / Standard Timing Belts (including concatenated T51900, bare 50AT10 * 3490, چمفر FORZA 100AT20 * 10180 * 6APL, 50T20)
  const timingTokenMatch =
    nameNorm.match(/(?:^|[\s(*])(\d{2,3})?\s*(at20|at10|at5|t20|t10|t5)(?:\s*\*|\s+)\s*(\d{3,5})(?:\s*\*?\s*(\d*\s*apl|\d+))?/i) ||
    nameNorm.match(/\b(t5|t10|at5|at10)(\d{3,4})\s*\*\s*(\d+)\b/i) ||
    nameNorm.match(/\b(\d{2,3})\s*(at20|at10|at5|t20|t10|t5)\b/i);

  if (
    timingTokenMatch &&
    !/قالب\s*(?:at10|at5|t10|t5|h)|پولی/.test(nameNorm) &&
    (out.proposedCategorySlug === 'UNRESOLVED' || out.proposedCategorySlug === 'excel-v2-1-1' || ptNorm.includes('ناقص'))
  ) {
    // Handle concatenated T51900 * 25 cleanly vs regular match
    let pitchRaw = '';
    if (timingTokenMatch[0].match(/^(t5|t10|at5|at10)(\d{3,4})/i)) {
      pitchRaw = timingTokenMatch[1].toUpperCase();
      specsMap['طول نامی'] = `${timingTokenMatch[2]} میلی‌متر`;
      specsMap['عرض'] = `${timingTokenMatch[3]} میلی‌متر`;
    } else {
      pitchRaw = (timingTokenMatch[2] || '').toUpperCase();
      if (timingTokenMatch[1] && !specsMap['عرض']) specsMap['عرض'] = `${timingTokenMatch[1]} میلی‌متر`;
      if (timingTokenMatch[3] && !specsMap['طول نامی']) specsMap['طول نامی'] = `${timingTokenMatch[3]} میلی‌متر`;
    }
    if (['T5', 'T10', 'T20', 'AT5', 'AT10', 'AT20'].includes(pitchRaw)) {
      const hasApl = /apl|چمفر|چاپ|ضدسایش|ضد\s*سایش|روکش|گریپ/i.test(nameNorm) || /apl/i.test(ptNorm);
      const hasTruck = /کامیون|کلید|سوراخ/i.test(nameNorm);
      const hasSteelCord = /سیم\s*دار|سیمدار|چمفر|apl/i.test(nameNorm) || /سیم.?دار/.test(ptNorm);
      const isPu = /پلی.?یورتان|\bpu\b|\btpu\b/.test(matNorm) || /چمفر|apl|چاپ/.test(nameNorm);
      const isOpenRoll =
        (/کلاف\s*متری/.test(ptNorm) || /\*\s*(?:100|150|50|25|16|10|22|68)\s*(?:cm)?\s*$/i.test(nameNorm) || /^تسمه\s*سیمدار\s*50t20$/i.test(nameNorm)) &&
        !/مداربسته|چمفر|چاپ|apl/i.test(nameNorm);

      out.profile = pitchRaw;
      out.standard = 'DIN 7721 / ISO 17396';
      out.unit = isOpenRoll ? 'متر' : 'حلقه';
      out.specsMap = specsMap;

      if (hasTruck) {
        out.productType = `تسمه تایمینگ متریک پروفیل ${pitchRaw} کامیون‌دار (کلیددار)`;
        out.material = isPu ? 'پلی‌یورتان ترموپلاستیک (TPU) با کورد فولادی' : 'پلی‌یورتان / کورد فولادی کلیددار';
        out.construction = 'تایمینگ کلیددار سیم‌دار';
        setMenuPath(out, 'excel-v2-1-1', 'سیم‌دار فابریک', 'کامیون دار (کلید دار)');
        return out;
      }
      if (hasApl) {
        const aplThickness = nameNorm.match(/(\d+)\s*apl/i)?.[1];
        out.productType = `تسمه تایمینگ متریک پروفیل ${pitchRaw} با روکش APL / چمفر`;
        out.material = 'پلی‌یورتان ترموپلاستیک (TPU) با کورد فولادی و روکش APL';
        out.construction = aplThickness
          ? `تایمینگ سیم‌دار روکش‌دار (${aplThickness}APL / چمفر)`
          : 'تایمینگ سیم‌دار روکش‌دار (APL / چمفر / چاپ)';
        setMenuPath(out, 'excel-v2-1-1', 'سیم‌دار فابریک', 'APL دار');
        return out;
      }
      if (hasSteelCord) {
        out.productType = `تسمه تایمینگ متریک پروفیل ${pitchRaw} سیم‌دار (${isOpenRoll ? 'کلاف متری' : 'مداربسته'})`;
        out.material = isPu ? 'پلی‌یورتان ترموپلاستیک (TPU) با کورد فولادی' : 'کورد فولادی صنعتی (سیم‌دار فابریک)';
        out.construction = isOpenRoll ? 'تایمینگ سیم‌دار متری' : 'تایمینگ سیم‌دار فابریک';
        setMenuPath(
          out,
          'excel-v2-1-1',
          'سیم‌دار فابریک',
          isPu ? 'پلی‌یورتان' : 'سیم‌دار استاندارد کورد فولادی',
        );
        return out;
      }
      if (/لاستیک|rubber|neoprene|کلروپرن/.test(matNorm)) {
        out.productType = `تسمه تایمینگ متریک پروفیل ${pitchRaw} لاستیکی`;
        out.construction = 'تایمینگ لاستیکی فابریک';
        setMenuPath(out, 'excel-v2-1-1', 'لاستیکی فابریک', 'لاستیکی فابریک ساده و دنده‌دار');
        return out;
      }
      out.productType = `تسمه تایمینگ متریک پروفیل ${pitchRaw}`;
      out.construction = 'تایمینگ متریک استاندارد';
      setMenuPath(out, 'excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'T5 , AT5 , AT10 , AT20');
      return out;
    }
  }

  // Remaining Excel 1-1 Timing belts (3M, MXL, ZRK automotive, steel-cord TPU/standard, T10/T20)
  if (
    out.proposedCategorySlug === 'excel-v2-1-1' ||
    (/تایمینگ|zrk|auto_?ru/.test(ptNorm) && !/پولی|قالب|تسمه\s*سفت\s*کن/.test(nameNorm))
  ) {
    if (/auto.?ru|auto.?8mm|zrk|خودرویی|لیفتراکی/.test(`${ptNorm} ${nameNorm} ${profileUpper.toLowerCase()}`)) {
      out.productType = 'تسمه تایمینگ خودرویی و لیفتراکی (ZRK / RU)';
      out.material = out.material || 'لاستیک کلروپرن (Neoprene) تقویت‌شده';
      out.construction = 'تایمینگ خودرویی / لیفتراکی';
      setMenuPath(out, 'excel-v2-1-1', 'لاستیکی فابریک', 'تایمینگ خودرویی و لیفتراکی (ZRK / RU)');
      return out;
    }
    if (profileUpper === '3M' || profileUpper === 'MXL') {
      if (/سیم\s*دار|سیمدار/.test(`${nameNorm} ${ptNorm}`)) {
        out.productType = `تسمه تایمینگ پروفیل ${profileUpper} سیم‌دار`;
        setMenuPath(
          out,
          'excel-v2-1-1',
          'سیم‌دار فابریک',
          /پلی.?یورتان|tpu/.test(matNorm) ? 'پلی‌یورتان' : 'سیم‌دار استاندارد کورد فولادی',
        );
      } else {
        setMenuPath(out, 'excel-v2-1-1', 'انواع گام و کدهای تایمینگ', '3M , MXL');
      }
      return out;
    }
    if (['T5', 'T10', 'T20', 'AT5', 'AT10', 'AT20'].includes(profileUpper)) {
      if (/سیم\s*دار|سیمدار/.test(`${ptNorm} ${nameNorm}`)) {
        if (/apl|روکش|گریپ/.test(`${ptNorm} ${nameNorm}`)) {
          setMenuPath(out, 'excel-v2-1-1', 'سیم‌دار فابریک', 'APL دار');
        } else if (/کامیون|کلید/.test(`${ptNorm} ${nameNorm}`)) {
          setMenuPath(out, 'excel-v2-1-1', 'سیم‌دار فابریک', 'کامیون دار (کلید دار)');
        } else {
          setMenuPath(
            out,
            'excel-v2-1-1',
            'سیم‌دار فابریک',
            /پلی.?یورتان|tpu/.test(matNorm) ? 'پلی‌یورتان' : 'سیم‌دار استاندارد کورد فولادی',
          );
        }
      } else if (/لاستیک|neoprene|کلروپرن/.test(matNorm) && out.proposedSubmenu === 'لاستیکی فابریک') {
        setMenuPath(out, 'excel-v2-1-1', 'لاستیکی فابریک', 'لاستیکی فابریک ساده و دنده‌دار');
      } else {
        setMenuPath(out, 'excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'T5 , AT5 , AT10 , AT20');
      }
      return out;
    }
    if (['H', 'XH', 'L', 'XL', 'DH', 'DL', 'DXH', 'DXL'].includes(profileUpper)) {
      if (/apl|ضد\s*سایش|ضدسایش|چمفر|چاپ/.test(`${ptNorm} ${nameNorm}`)) {
        out.productType = `تسمه تایمینگ پروفیل ${profileUpper} سیم‌دار با روکش APL / ضدسایش`;
        out.material = 'پلی‌یورتان ترموپلاستیک (TPU) با کورد فولادی و روکش APL';
        setMenuPath(out, 'excel-v2-1-1', 'سیم‌دار فابریک', 'APL دار');
      } else if (/سیم\s*دار|سیمدار/.test(`${ptNorm} ${nameNorm}`)) {
        out.productType = `تسمه تایمینگ پروفیل ${profileUpper} سیم‌دار`;
        out.material = /پلی.?یورتان|tpu/.test(matNorm) ? out.material : 'پلی‌یورتان ترموپلاستیک (TPU) با کورد فولادی';
        setMenuPath(
          out,
          'excel-v2-1-1',
          'سیم‌دار فابریک',
          'پلی‌یورتان',
        );
      } else if (out.proposedSubmenu === 'لاستیکی فابریک') {
        setMenuPath(out, 'excel-v2-1-1', 'لاستیکی فابریک', 'لاستیکی فابریک ساده و دنده‌دار');
      } else {
        setMenuPath(out, 'excel-v2-1-1', 'انواع گام و کدهای تایمینگ', 'H , XH , L , XL');
      }
      return out;
    }
    if (['5M', '8M', '11M', '14M', 'RPP8M', 'RPP14M', 'D5M', 'D8M', 'D14M', 'S8M'].includes(profileUpper)) {
      if (/apl|ضد\s*سایش|ضدسایش|چمفر|چاپ/.test(`${ptNorm} ${nameNorm}`)) {
        setMenuPath(out, 'excel-v2-1-1', 'سیم‌دار فابریک', 'APL دار');
      } else if (/سیم\s*دار|سیمدار/.test(`${ptNorm} ${nameNorm}`)) {
        setMenuPath(
          out,
          'excel-v2-1-1',
          'سیم‌دار فابریک',
          /پلی.?یورتان|tpu/.test(matNorm) ? 'پلی‌یورتان' : 'سیم‌دار استاندارد کورد فولادی',
        );
      } else if (out.proposedSubmenu === 'لاستیکی فابریک') {
        setMenuPath(out, 'excel-v2-1-1', 'لاستیکی فابریک', 'لاستیکی فابریک ساده و دنده‌دار');
      } else {
        setMenuPath(out, 'excel-v2-1-1', 'انواع گام و کدهای تایمینگ', '5M , 8M , 11M , 14M');
      }
      return out;
    }
  }

  // 3d. Crowned / Ridge-top endless haul-off belts (گرده‌ماهی, CRC100..300, BRB84..205, TRC195..205) + wire-reinforced retarding belt 34854
  if (
    /گرده\s*ماهی|تاج.?دار|ridge.?top/i.test(`${nameNorm} ${ptNorm}`) ||
    /\b(?:crc|brb|trc)\s*[-]?\s*\d{2,4}\b/i.test(nameNorm) ||
    /تسمه\s*ساختنی\s*crc\d+/i.test(nameNorm) ||
    /تسمه\s*مگاد[یي]ن\s*crc\s*\d+/i.test(nameNorm) ||
    /تسمه\s*ترمزگیر\s*سیم\s*دار/.test(nameNorm)
  ) {
    out.productType = /ترمزگیر/.test(nameNorm)
      ? 'تسمه بارکش ترمزگیر سیم‌دار صنعتی'
      : 'تسمه بارکش تاج‌دار مداربسته (گرده‌ماهی / CRC-BRB)';
    out.material = /لاستیک|لاستیکی/.test(matNorm)
      ? out.material
      : 'لاستیک و الیاف تقویت‌شده مقاوم به سایش';
    out.construction = 'تسمه انتقال مداربسته بارکش';
    out.profile = /brb/i.test(nameNorm) ? 'BRB_CROWNED' : /trc/i.test(nameNorm) ? 'TRC_CROWNED' : 'CRC_CROWNED';
    out.standard = 'استاندارد خطوط انتقال کاشی و بسته‌بندی';
    out.unit = 'حلقه';
    setMenuPath(out, 'excel-v2-1-4', 'تسمه بارکش', 'انواع تسمه بارکش صنعتی');
    return out;
  }

  // 3e. Weldable Round PU cords (تسمه جوشی گرد نمره 6/8/10/12/15/18, تسمه گرد 18 زبر, تسمه جوشی CRC/BRB سبز/شفاف/قرمز متری)
  if (
    (/تسمه\s*(?:جوشی|گرد)/.test(nameNorm) &&
      !/تسمه\s*تایم/.test(nameNorm) &&
      (/نمره\s*\d+|گرد\s*\d+|\bcrc\b|\bbrb\b/i.test(nameNorm) || /تسمه\s*جوشی\s*با\s*مقطع\s*گرد|کد\s*انباری\s*crc/i.test(ptNorm))) ||
    out.proposedCategorySlug === 'excel-v2-1-3'
  ) {
    if (out.profile === 'FLAT' || out.profile === 'F' || /فلت|تخت/.test(`${nameNorm} ${ptNorm}`)) {
      out.productType = 'تسمه تخت و فلت صنعتی';
      out.profile = 'FLAT';
      setMenuPath(out, 'excel-v2-1-3', 'تسمه فلت', 'انواع تسمه تخت و فلت');
      return out;
    }
    if (
      ['A', 'B', 'C', 'BRB'].includes(profileUpper) &&
      /گروه\s*(?:a|b|c)\b/i.test(nameNorm) &&
      !/crc/i.test(nameNorm)
    ) {
      const grp = nameNorm.match(/گروه\s*(?:\([^)]+\)\s*)?(a|b|c)\b/i)?.[1]?.toUpperCase() || profileUpper;
      out.productType = `تسمه جوشی V شکل متری (پروفیل ${grp})`;
      out.profile = grp;
      out.material = 'پلی‌یورتان ترموپلاستیک (TPU)';
      out.construction = /گریپ/.test(nameNorm) ? 'تسمه جوشی V شکل با روکش گریپ‌دار' : 'تسمه جوشی V شکل صنعتی';
      out.unit = 'متر';
      setMenuPath(out, 'excel-v2-1-3', 'تسمه جوشی V شکل (A / B / C)', 'تسمه جوشی V شکل پلی‌یورتان و گریپ‌دار');
      return out;
    }
    out.productType = 'تسمه گرد جوشی پلی‌یورتان (Round / CRC)';
    out.material = 'پلی‌یورتان ترموپلاستیک (TPU)';
    out.construction = /زبر|آج/.test(nameNorm) ? 'تسمه گرد زبر جوشی' : /نخ/.test(nameNorm) ? 'تسمه گرد جوشی نخ‌دار (کورد تقویت‌شده)' : 'تسمه گرد جوشی ساده';
    out.profile = 'CRC';
    out.standard = 'TPU Weldable Round Cord';
    out.unit = 'متر';
    setMenuPath(out, 'excel-v2-1-3', 'تسمه گرد (CRC)', 'انواع تسمه گرد جوشی');
    return out;
  }

  // 3f. Welded open V-section PU / grip-top belts ("تسمه جوشي گروه A/B/C ...", "تسمه جوشي A/B/C ...") without endless length
  const isNamedWeldedVbelt =
    /تسمه\s*جوشی/.test(nameNorm) &&
    !/گرد|crc|فلت|برش|تایم/i.test(nameNorm) &&
    !/(?:\b[abc]\d{2,4}\b)/i.test(nameNorm);
  if (isNamedWeldedVbelt) {
    const weldedGroupMatch =
      nameNorm.match(/\bگروه\s*(?:\([^)]*\)\s*)?(a|b|c)\b/i) ||
      nameNorm.match(/\b(?:تسمه\s*جوشی|نخ\s*دار|نخدار|سبز|t\s*-\s*b|\))\s*\(?\s*(a|b|c)\b/i) ||
      nameNorm.match(/\b(a|b|c)\b/i);
    const grp = (weldedGroupMatch?.[1] || profileUpper || '').toUpperCase();
    if (['A', 'B', 'C'].includes(grp)) {
      out.productType = `تسمه جوشی V شکل متری (پروفیل ${grp})`;
      out.profile = grp;
      out.material = /گریپ/.test(nameNorm)
        ? 'پلی‌یورتان ترموپلاستیک (TPU) با روکش گریپ‌دار'
        : 'پلی‌یورتان ترموپلاستیک (TPU)';
      out.construction = /نخ\s*دار|نخدار/.test(nameNorm)
        ? 'تسمه جوشی V شکل نخ‌دار'
        : 'تسمه جوشی V شکل متری';
      out.standard = 'TPU Open-Ended V-Belt';
      out.unit = 'متر';
      setMenuPath(out, 'excel-v2-1-3', 'تسمه جوشی V شکل (A / B / C)', 'تسمه جوشی V شکل پلی‌یورتان و گریپ‌دار');
      return out;
    }
  }

  // 3g. SWR 11.5 * 890 narrow/classic automotive V-belt (38910) -> merge into SWR Z classical V-Belt family
  if (/تسمه\s*890\s*\*\s*11\/5\s*swr/.test(nameNorm)) {
    out.productType = 'تسمه V شکل کلاسیک پروفیل Z';
    out.brand = 'SWR';
    out.material = 'لاستیک با روکش پارچه‌ای (Wrapped V-Belt)';
    out.construction = 'بدنه لاستیکی روکش‌دار با کورد کششی پلی‌استر';
    out.profile = 'Z';
    out.standard = 'DIN 2215 / ISO 4184';
    out.unit = 'حلقه';
    setMenuPath(out, 'excel-v2-1-2', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V');
    return out;
  }

  // 3h. All Endless & Meter V-Belts -> excel-v2-1-2 with strict engineering family hierarchy
  const isBandedVbelt = /-BANDED$/i.test(profileUpper) || /\b\d+\s*r\s*(?:3vx|5vx|8vx|3v|5v|8v|spz|spa|spb|spc|ax|bx|cx|a|b|c)\b/i.test(nameNorm);
  const cleanP = profileUpper.replace(/[-_]BANDED$/i, '').replace(/[-_]PERFORATED$/i, '');
  const isExplicitBeltContext =
    /تسمه|وی.?بلت|v.?belt|perforated/i.test(`${nameNorm} ${ptNorm}`) &&
    !/پایه|اهرم|بست|ریل|گاید|پولی|چرخ|بوش|رولر|شیلنگ|لوله|ضربه.?گیر|مهره|پیچ/.test(nameNorm);
  const isPerforatedMeterVbelt =
    /[-_]PERFORATED$/i.test(profileUpper) ||
    (isExplicitBeltContext && /(?:پانچ|سوراخ|perforated|(?<![\u0600-\u06FF])متری(?![\u0600-\u06FF]))/.test(`${nameNorm} ${ptNorm}`) && /تسمه\s*[abc]\s*سوراخ\s*دار|perforated|وی.?بلت\s*متری/i.test(`${nameNorm} ${ptNorm}`)) ||
    /تسمه\s*[abc]\s*سوراخ\s*دار/i.test(nameNorm);
  const isVbeltMatch =
    [
      'Z', 'ZX', 'M', 'MX', 'A', 'AX', 'B', 'BX', 'C', 'CX', 'D', 'E', 'K',
      'AA', 'BB', 'CC',
      'SPZ', 'XPZ', 'SPA', 'XPA', 'SPB', 'XPB', 'SPC', 'XPC',
      '3V', '3VX', '5V', '5VX', '8V', '8VX',
    ].includes(cleanP) ||
    isPerforatedMeterVbelt ||
    ptNorm.includes('تسمه v شکل') ||
    ptNorm.includes('وی بلت') ||
    (isExplicitBeltContext && ptNorm.includes('روکش گریپ'));

  if (isVbeltMatch && !/تسمه\s*جوشی/.test(nameNorm)) {
    const hasGripCoating = /گریپ|ضد\s*سایش/.test(nameNorm);

    // 1) Open-ended / Perforated meter V-Belts (A, B, C)
    if (isPerforatedMeterVbelt) {
      const baseProf = ['A', 'B', 'C'].includes(cleanP) ? cleanP : 'B';
      out.profile = `${baseProf}-PERFORATED`;
      out.productType = `تسمه ذوزنقه‌ای سوراخ‌دار متری پروفیل ${baseProf}`;
      out.material = 'لاستیک نئوپرن چندلایه منجیددار سوراخ‌کاری‌شده';
      out.construction = 'بافت منجید پلی‌استر چندلایه مخصوص بست فلزی';
      out.standard = 'Open-Ended Perforated V-Belt';
      out.unit = 'متر';
      setMenuPath(out, 'excel-v2-1-2', 'وی‌بلت متری', 'تسمه A و B و C وی‌بلت متری');
      return out;
    }

    // 2) Banded / Powerband V-Belts (multi-rib joined V-belts)
    if (isBandedVbelt) {
      out.profile = `${cleanP}-BANDED`;
      out.productType = `تسمه V شکل به‌پشت‌پیوسته (Banded V-Belt) پروفیل ${cleanP}`;
      out.material = 'بدنه لاستیکی با نوار پیونددهنده فوقانی (Tie-Band / Banded V-Belt)';
      out.construction = 'تسمه چندشاخه به‌پشت‌پیوسته (Powerband)';
      out.standard = 'ISO 5290 / RMA IP-20 / DIN 7753';
      out.unit = 'حلقه';
      if (['SPZ', 'XPZ', 'SPA', 'XPA', 'SPB', 'XPB', 'SPC', 'XPC'].includes(cleanP)) {
        setMenuPath(out, 'excel-v2-1-2', 'تسمه اسپشیال', 'SPA , SPB , SPC و دندانه‌دار');
      } else if (['3V', '3VX', '5V', '5VX', '8V', '8VX'].includes(cleanP)) {
        setMenuPath(out, 'excel-v2-1-2', 'تسمه اسپشیال', 'تسمه باریک و دور متغیر (3V / 5V / 8V)');
      } else {
        setMenuPath(out, 'excel-v2-1-2', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V');
      }
      return out;
    }

    // 3) Double-sided Hexagonal V-Belts (AA, BB, CC)
    if (['AA', 'BB', 'CC'].includes(cleanP)) {
      out.profile = cleanP;
      out.productType = `تسمه V شکل شش‌ضلعی دوطرفه پروفیل ${cleanP} (Double V-Belt)`;
      out.material = 'لاستیک کلروپرن با روکش پارچه‌ای دوطرفه (Hexagonal Double V-Belt)';
      out.construction = 'مقطع شش‌ضلعی متقارن دوطرفه انتقال توان';
      out.standard = 'ISO 5289 / DIN 7722';
      out.unit = 'حلقه';
      setMenuPath(out, 'excel-v2-1-2', 'کلاسیک و دنده‌دار', 'تسمه شش‌ضلعی دوطرفه (AA / BB)');
      return out;
    }

    // 4) Metric Narrow Wedge (SPZ, SPA, SPB, SPC) & Metric Narrow Raw-Edge Cogged (XPZ, XPA, XPB, XPC)
    if (['SPZ', 'XPZ', 'SPA', 'XPA', 'SPB', 'XPB', 'SPC', 'XPC'].includes(cleanP)) {
      out.profile = cleanP;
      out.unit = 'حلقه';
      out.standard = 'DIN 7753 / ISO 4184';
      if (hasGripCoating) {
        out.productType = `تسمه V شکل اسپشیال پروفیل ${cleanP} با روکش گریپ / ضدسایش`;
        out.material = 'لاستیک روکش‌دار با روکش فوقانی گریپ ضدسایش';
        out.construction = 'تسمه V شکل باریک با روکش گریپ';
      } else if (['XPZ', 'XPA', 'XPB', 'XPC'].includes(cleanP)) {
        out.productType = `تسمه V شکل باریک دنده‌ای لبه‌خام پروفیل ${cleanP}`;
        out.material = 'لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber)';
        out.construction = 'بدنه گوه‌ای دنده‌دار لبه‌خام (Narrow Raw-Edge Cogged)';
      } else {
        out.productType = `تسمه V شکل باریک (Narrow Wedge) پروفیل ${cleanP}`;
        out.material = 'لاستیک با روکش پارچه‌ای (Wrapped Narrow Wedge V-Belt)';
        out.construction = 'بدنه گوه‌ای باریک روکش‌دار (Wrapped Wedge)';
      }
      setMenuPath(out, 'excel-v2-1-2', 'تسمه اسپشیال', 'SPA , SPB , SPC و دندانه‌دار');
      return out;
    }

    // 5) American Narrow Wedge (3V, 5V, 8V) & American Raw-Edge Cogged (3VX, 5VX, 8VX)
    if (['3V', '3VX', '5V', '5VX', '8V', '8VX'].includes(cleanP)) {
      out.profile = cleanP;
      out.unit = 'حلقه';
      out.standard = 'RMA IP-22 / ARPM IP-22';
      if (['3VX', '5VX', '8VX'].includes(cleanP)) {
        out.productType = `تسمه V شکل گوه‌ای آمریکایی دنده‌ای لبه‌خام پروفیل ${cleanP}`;
        out.material = 'لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber)';
        out.construction = 'بدنه گوه‌ای آمریکایی دنده‌دار لبه‌خام';
      } else {
        out.productType = `تسمه V شکل گوه‌ای آمریکایی پروفیل ${cleanP}`;
        out.material = 'لاستیک با روکش پارچه‌ای (Wrapped Wedge V-Belt)';
        out.construction = 'بدنه گوه‌ای آمریکایی روکش‌دار';
      }
      setMenuPath(out, 'excel-v2-1-2', 'تسمه اسپشیال', 'تسمه باریک و دور متغیر (3V / 5V / 8V)');
      return out;
    }

    // 6) Classical Wrapped (Z, M, A, B, C, D, E, K) & Classical Raw-Edge Cogged (ZX, MX, AX, BX, CX)
    if (['Z', 'ZX', 'M', 'MX', 'A', 'AX', 'B', 'BX', 'C', 'CX', 'D', 'E', 'K'].includes(cleanP)) {
      out.profile = cleanP;
      out.unit = 'حلقه';
      if (hasGripCoating) {
        out.productType = `تسمه V شکل کلاسیک روکش گریپ‌دار پروفیل ${cleanP}`;
        out.material = 'لاستیک کلروپرن روکش‌دار با روکش فوقانی گریپ ضدسایش';
        out.construction = 'تسمه V شکل مداربسته روکش گریپ‌دار';
        out.standard = 'DIN 2215 / ISO 4184';
      } else if (['ZX', 'MX', 'AX', 'BX', 'CX'].includes(cleanP)) {
        out.productType = `تسمه V شکل دنده‌ای لبه‌خام پروفیل ${cleanP}`;
        out.material = 'لاستیک دنده‌ای لبه‌خام (Raw-Edge Cogged Rubber)';
        out.construction = 'بدنه دنده‌دار لبه‌خام با کورد کششی پلی‌استر';
        out.standard = 'DIN 2215 / ISO 4184 (Raw-Edge Cogged)';
      } else {
        out.productType = `تسمه V شکل کلاسیک پروفیل ${cleanP}`;
        out.material = 'لاستیک با روکش پارچه‌ای (Wrapped V-Belt)';
        out.construction = 'بدنه لاستیکی روکش‌دار با کورد کششی پلی‌استر';
        out.standard = 'DIN 2215 / ISO 4184';
      }
      setMenuPath(out, 'excel-v2-1-2', 'کلاسیک و دنده‌دار', 'Z (9.5) , M , A , B , C , D , E , 8V');
      return out;
    }
  }

  // 4. Conveyor belts & non-woven yellow/blue belts (including PVC belts with tracking guide ribs)
  if (
    /نوار\s*نقاله/.test(ptNorm) ||
    /نوار\s*pvc\s*سبز.*راهنما/i.test(nameNorm) ||
    (/^نوار\s*(?:زرد|شیرینگ|سفید|سبز|آبی)/.test(nameNorm) && !/اسفنجی/.test(nameNorm))
  ) {
    if (/نوار\s*pvc\s*سبز.*راهنما/i.test(nameNorm)) {
      out.productType = 'نوار نقاله PVC با راهنمای هدایت';
      out.material = 'پلی‌وینیل کلراید (PVC)';
      out.construction = 'نوار نقاله PVC همراه با پروفیل راهنما';
      out.unit = 'متر';
      setMenuPath(out, 'excel-v2-2-1', 'بر اساس جنس', 'نوار نقاله PVC');
      return out;
    }
    if (/پلی.?اورتان|\bpu\b/.test(`${nameNorm} ${matNorm}`)) {
      setMenuPath(out, 'excel-v2-2-1', 'بر اساس جنس', 'نوار نقاله پلی‌اورتان (PU)');
    } else if (/بسته.?بندی|شیرینگ|مدولار|سبدی|تور/.test(nameNorm)) {
      setMenuPath(out, 'excel-v2-2-1', 'بر اساس کاربرد و ابعاد', 'مخصوص دستگاه بسته‌بندی (در ضخامت و ابعاد مختلف)');
    } else {
      setMenuPath(out, 'excel-v2-2-1', 'بر اساس جنس', 'نوار نقاله PVC');
    }
    return out;
  }

  // 5. Pulleys (excel-v2-4-1) & Couplings (excel-v2-4-2)
  if (/کوپلینگ|کوبلینگ|coupling/.test(`${nameNorm} ${ptNorm}`)) {
    if (/ضربه\s*گیر/.test(nameNorm)) {
      setMenuPath(out, 'excel-v2-7-3', 'ضربه‌گیر و لرزه‌گیر', 'انواع ضربه‌گیر و لرزه‌گیر لاستیکی و پلیمری');
      return out;
    }
    out.productType = 'کوپلینگ انتقال قدرت';
    setMenuPath(out, 'excel-v2-4-2', 'کوپلینگ شفت و همزن', 'کوپلینگ آلومینیومی و انعطاف‌پذیر صنعتی');
    return out;
  }
  if (/پولی/.test(`${nameNorm} ${ptNorm}`) && !/شافت\s*پولی|چرخ\s*پولی|اهرم\s*نگهدارنده/.test(nameNorm)) {
    if (/پلاستیک/.test(`${nameNorm} ${matNorm}`)) {
      setMenuPath(out, 'excel-v2-4-1', 'پولی پلاستیک', 'در سایزها و گام‌های مختلف');
    } else if (/پلی.?یورتان|\bpu\b/.test(`${nameNorm} ${matNorm}`)) {
      setMenuPath(out, 'excel-v2-4-1', 'پولی پلی‌اورتان', 'در سایزها و گام‌های مختلف');
    } else {
      setMenuPath(out, 'excel-v2-4-1', 'پولی آلومینیومی و فلزی', 'پولی آلومینیومی، فولادی و چدنی');
    }
    return out;
  }

  // 6. Kiln roller cones, caps, rollers (excel-v2-3-2)
  if (/رول\s*گردان|کاپ\s*رول\s*گردان|مخروطی\s*رولر\s*گردان|قطعه\s*سر\s*رولر/.test(nameNorm)) {
    out.productType = 'قطعات سر رولر و مخروطی رول گردان کوره';
    setMenuPath(out, 'excel-v2-3-2', 'مخروطی، کاپ و رول گردان کوره', 'رول گردان، کاپ و قطعات سر رولر کوره');
    return out;
  }

  // 7. Ceramic Glaze, Print, Rotary, Stacker & Tile Guide Hardware (excel-v2-10-1/2/3)
  if (
    /تیغه\s*کارول|دیسک\s*لعاب|درپوش\s*دیسک\s*لعاب|نافی.*دیسک\s*لعاب|نگهدارنده\s*اسپاتول|اهرم\s*چاپ|مخصوص\s*چاپ|دستگاه\s*چاپ/.test(nameNorm) ||
    ptNorm.includes('کارول') ||
    ptNorm.includes('قطعات دستگاه چاپ')
  ) {
    if (/فولاد/.test(matNorm) && /کارول/.test(nameNorm)) {
      out.material = 'فولاد فنری و کامپوزیت مهندسی';
    }
    out.productType = /کارول/.test(nameNorm) ? 'تیغه کارول چاپ و لعاب' : 'ملزومات دستگاه چاپ و لعاب‌پاش';
    setMenuPath(out, 'excel-v2-10-1', 'ملزومات چاپ و لعاب‌پاش', 'تیغه کارول، دیسک لعاب‌پاش، توپی و متعلقات چاپ');
    return out;
  }
  if (/سیلندر\s*انگشتی|سیلندر.*روتاری/.test(nameNorm) || ptNorm === 'سیلندر انگشتی') {
    setMenuPath(out, 'excel-v2-10-2', 'سیلندر و قطعات روتاری', 'سیلندر انگشتی و درایو روتاری');
    return out;
  }
  if (/انگشتی\s*تک\s*خار|انگشتی\s*روتاری/.test(nameNorm) || ptNorm.includes('انگشتی روتاری') || ptNorm.includes('انگشتی تک‌خار')) {
    setMenuPath(out, 'excel-v2-10-2', 'انگشتی روتاری', 'انواع انگشتی روتاری فرنگ');
    return out;
  }
  if (
    /استاکر|استکر|لقمه\s*پلی\s*یورتان\s*b\s*شکل|دستگاه\s*کاشی\s*بلند\s*کن/.test(`${nameNorm} ${ptNorm}`)
  ) {
    setMenuPath(out, 'excel-v2-10-3', 'قطعات دستگاه استاکر', 'تیغه، بازو، پلیت و لقمه استاکر');
    return out;
  }
  if (
    /راهنمای\s*کاشی|خط\s*کاشی|چرخ\s*آلومینیوم.*خط\s*کاشی|تنظیم\s*کاشی/.test(`${nameNorm} ${ptNorm}`) ||
    /صفحه\s*تفلونی\s*سبز\s*راهنمای\s*بسته\s*بندی/.test(nameNorm)
  ) {
    setMenuPath(out, 'excel-v2-10-3', 'راهنمای کاشی و ردیف‌کن', 'تیغه، فکی، چرخ و هدایت‌کننده کاشی');
    return out;
  }

  // 8. Rails, Guides, Hollow Squares & Sensor Mounts (excel-v2-6-*)
  if (/فتوسل|سنسور/.test(nameNorm)) {
    if (/پایه|لوله|نگهدارنده/.test(nameNorm)) {
      setMenuPath(out, 'excel-v2-6-4', 'نگهدارنده سنسور', 'انواع قطعات نگهدارنده سنسور');
    } else {
      setMenuPath(out, 'excel-v2-6-4', 'انواع سنسور', 'سنسورهای خطوط انتقال');
    }
    return out;
  }
  if (/چهار\s*پهلو\s*تو\s*خالی|کشویی\s*چهار\s*پهلو|پایه\s*مخصوص\s*چهار\s*پهلو|نگهدارنده\s*چهار\s*پهلو/.test(nameNorm)) {
    setMenuPath(out, 'excel-v2-6-3', 'پروفیل چهارپهلو و پایه فلزی', 'چهارپهلو توخالی، کشویی و پایه چهارپهلو');
    return out;
  }
  if (/فکی\s*نگهدارنده\s*گاید|گیره.*گاید|گاید\s*ذخیره\s*کن|گاید\s*نگهدارنده|نگهدارنده\s*کشویی\s*تیغه\s*راهنما|زیر\s*فکی|روی\s*فکی|جلوی\s*فکی/.test(nameNorm)) {
    setMenuPath(out, 'excel-v2-6-2', 'گاید و نگهدارنده فلزی و فنری', 'فکی، پایه و گیره نگهدارنده گاید');
    return out;
  }
  if (/ریل.*آ[\u0651\s]*لومینیوم/.test(nameNorm)) {
    out.material = 'آلومینیوم (Aluminum Alloy)';
    setMenuPath(out, 'excel-v2-6-3', 'پروفیل آلومینیوم', 'انواع پروفیل آلومینیومی صنعتی');
    return out;
  }
  if (/سر\s*ریل|ابتدای\s*ریل|انتهای\s*ریل|هلالی\s*ریل|نگهدارنده\s*ریل\s*شماتیک|محافظ\s*سر\s*ریل|^ریل\s*تفلونی$|^ریل\s*زیر\s*تسمه/.test(nameNorm)) {
    out.productType = /سر\s*ریل|ابتدای\s*ریل|انتهای\s*ریل|هلالی\s*ریل|محافظ\s*سر\s*ریل/.test(nameNorm)
      ? 'متعلقات سر و انتهای ریل راهنما'
      : 'ریل راهنمای صنعتی';
    if (/تفلون/.test(`${nameNorm} ${matNorm}`)) {
      if (!out.material || /unknown/i.test(out.material)) {
        out.material = 'تفلون صنعتی (PTFE / UHMWPE)';
      }
      setMenuPath(out, 'excel-v2-6-1', 'بر اساس جنس', 'ریل راهنما تفلون و متعلقات');
    } else if (/پلی\s*یورتان|\btpu\b|\bpu\b/.test(matNorm)) {
      setMenuPath(out, 'excel-v2-6-1', 'بر اساس جنس', 'ریل راهنما تفلون و متعلقات');
    } else if (/استیل/.test(`${nameNorm} ${matNorm}`)) {
      setMenuPath(out, 'excel-v2-6-1', 'بر اساس جنس', 'ریل راهنما استیل و متعلقات');
    } else if (/گالوانیزه/.test(`${nameNorm} ${matNorm}`)) {
      setMenuPath(out, 'excel-v2-6-1', 'بر اساس جنس', 'ریل راهنما گالوانیزه و متعلقات');
    } else if (/آلومینیوم|سر\s*ریل|انتهای\s*ریل|ابتدای\s*ریل|کد\s*1054|1051|1099|1100|1457/.test(nameNorm)) {
      setMenuPath(out, 'excel-v2-6-1', 'بر اساس جنس', 'ریل راهنما آلومینیومی و سرریلی');
    } else if (/\b[bc]\s*1\s*\/\s*5\s*m\b/i.test(nameNorm)) {
      setMenuPath(out, 'excel-v2-6-1', 'بر اساس تیپ و کاربرد', 'ریل تیپ B و تیپ C');
    } else {
      setMenuPath(out, 'excel-v2-6-1', 'بر اساس جنس', 'ریل راهنما آهنی و متعلقات');
    }
    return out;
  }

  // 9. Hoses, Ducts & Hose Couplers (excel-v2-7-5)
  if (/شیلنگ|لوله\s*خرطومی|سرشیلنگی|سر\s*شیلنگی|رابط\s*شیلنگ/.test(`${nameNorm} ${ptNorm}`)) {
    if (/فولاد/.test(matNorm)) {
      out.material = /برزنت/.test(nameNorm)
        ? 'پارچه برزنتی صنعتی مقاوم حرارت'
        : /سیم/.test(nameNorm)
          ? 'پلیمر صنعتی تقویت‌شده با فنر سیم‌دار'
          : 'پلیمر و الاستومر انعطاف‌پذیر صنعتی';
    }
    if (/خرطومی|سرشیلنگی|سر\s*شیلنگی|رابط/.test(nameNorm)) {
      setMenuPath(out, 'excel-v2-7-5', 'اتصالات و لوله خرطومی', 'سرشیلنگی، رابط شیلنگ و لوله خرطومی');
    } else {
      setMenuPath(out, 'excel-v2-7-5', 'شیلنگ صنعتی', 'شیلنگ PVC، پلی‌یورتان (PU)، آبنما و برزنتی');
    }
    return out;
  }

  // 10. Engineering Polymers, PTFE/UHMWPE/PA6/PU Sheets, Rods, Bushings, Pads, Polymer Belt Scrapers, Ingoop pipes (excel-v2-7-4)
  if (
    (/ورق/.test(nameNorm) &&
      (/تفلون|پلی\s*امید|پلی\s*ورتان|پلی\s*یورتان|ضد\s*سایش|ضدسایش/.test(nameNorm) ||
        out.sourceFamilyCode === 'FAM-39638' ||
        /سبز\s*(?:اصلی|خارجی|ایرانی)|سفید\s*(?:خارجی|ایرانی)/.test(nameNorm))) ||
    (/میل\s*گرد|میلگرد/.test(nameNorm) && /تفلون|پلی\s*امید|پلی\s*ورتان|پلی\s*یورتان/.test(`${nameNorm} ${matNorm}`))
  ) {
    if (/فولاد/.test(matNorm)) {
      out.material = 'پلی‌اتیلن سنگین / تفلون مهندسی (UHMWPE / PTFE)';
    }
    setMenuPath(
      out,
      'excel-v2-7-4',
      'ورق و میلگرد پلیمری',
      'ورق و میلگرد تفلون (PTFE / UHMWPE)، پلی‌آمید و پلی‌یورتان',
    );
    return out;
  }
  if (/لوله\s*اینگوپ/.test(nameNorm)) {
    out.productType = 'لوله اینگوپ پلیمری خطوط لعاب';
    out.material = 'پلی‌یورتان و پلیمر مهندسی (PU / PTFE)';
    out.construction = 'مجرای پلیمری انتقال لعاب و اینگوپ';
    setMenuPath(
      out,
      'excel-v2-7-4',
      'بوش و قطعات پلیمری مهندسی',
      'بوش، لقمه، تسمه‌پاک‌کن و قطعات مهندسی PTFE / PU',
    );
    return out;
  }
  if (
    (/تسمه\s*پ(?:ا\s*ک\s*|اک\s*|ک\s*)کن/.test(`${nameNorm} ${ptNorm}`) && !/تیغه\s*فلزی|دستگاه\s*کامل|پولی/.test(nameNorm)) ||
    /تیغه\s*تسمه\s*پاک\s*کن/.test(`${nameNorm} ${ptNorm}`) ||
    /بوش\s*تفلون|بوش\s*پلی\s*یورتان|بوش\s*مشکی\s*آج\s*دار|لقمه\s*زنجیری\s*تفلونی|پارویی\s*تفلونی|قطعه\s*تفلونی/.test(nameNorm) ||
    nameNorm.includes('انگشتی پلی یورتان') ||
    (out.proposedCategorySlug === 'UNRESOLVED' && /تفلون|ptfe|uhmwpe|پلی.?یورتان|پلی.?آمید/.test(matNorm) && !/پولی|چرخ|ریل|گاید|پمپ|غلتک|رولر|مکنده/.test(nameNorm))
  ) {
    if (/بوش\s*مشکی\s*آج\s*دار/.test(nameNorm)) {
      out.productType = 'بوش آج‌دار پلیمری مشکی (تفلون / UHMWPE)';
      out.material = 'پلیمر و تفلون مهندسی مشکی (UHMWPE / PTFE)';
      out.construction = 'بوش آج‌دار ضدسایش رولر و انتقال';
    } else if (/تسمه\s*پ(?:ا\s*ک\s*|اک\s*|ک\s*)کن/.test(nameNorm)) {
      out.productType = /تفلون/.test(nameNorm) ? 'تسمه‌پاک‌کن تفلونی (PTFE)' : 'تیغه تسمه‌پاک‌کن پلیمری (PU / PTFE)';
      out.material = /تفلون/.test(nameNorm) ? 'تفلون صنعتی (PTFE / UHMWPE)' : 'پلی‌یورتان مهندسی ضدسایش (PU)';
    }
    setMenuPath(
      out,
      'excel-v2-7-4',
      'بوش و قطعات پلیمری مهندسی',
      'بوش، لقمه، تسمه‌پاک‌کن و قطعات مهندسی PTFE / PU',
    );
    return out;
  }

  // 11. Pump parts (excel-v2-9-2)
  if (/پوسته\s*(?:گلدانی\s*)?پمپ|پوسته\s*درب\s*پمپ|درب\s*استیل\s*پوسته\s*پمپ|پروانه\s*همزن|مهره\s*برنجی\s*پروانه|سه\s*راهی\s*پمپ|واشر\s*تفلونی\s*پمپ|پایه\s*آلومینیومی\s*پمپ|پمپ\s*pp2|پروانه\s*پلی\s*یورتان\s*کد\s*1137/.test(nameNorm) || ptNorm.includes('قطعه پمپ') || ptNorm.includes('پروانه همزن')) {
    setMenuPath(out, 'excel-v2-9-2', 'پروانه و پوسته پمپ', 'پمپ حلزونی و طبقاتی');
    return out;
  }

  // 12. Elevator Buckets & Bucket Bolts (excel-v2-9-5)
  if (/قاشقک|الواتور|الواتر/.test(`${nameNorm} ${ptNorm}`)) {
    out.productType = /پیچ/.test(nameNorm) ? 'پیچ و مهره قاشقک الواتور' : 'قاشقک الواتور صنعتی';
    setMenuPath(out, 'excel-v2-9-5', 'قاشقک و پیچ الواتور', 'قاشقک استیل، پلیمری و پیچ الواتور');
    return out;
  }

  // 13. Fasteners, Clamps, Shafts & Metal Sheets (excel-v2-9-3)
  if (/ورق\s*(?:استیل|گالوانیزه)/.test(nameNorm) || /شافت\s*بلبرینگ|شافت\s*پولی|میله\s*(?:فلزی|پی\s*کاپ)|میل\s*گرد\s*(?:st|ck|mo40|استیل|آهنی)/.test(nameNorm)) {
    setMenuPath(out, 'excel-v2-9-3', 'شفت، میلگرد و مقاطع فلزی', 'شافت بلبرینگ‌دار، میلگرد، ورق و پروفیل فلزی');
    return out;
  }
  if (/بست\s*u|بست\s*دو\s*پایه|بست\s*زیر\s*تسمه|پایه\s*تنظیم|پایه\s*نگهدارنده|اهرم\s*نگهدارنده|تیغه\s*فلزی\s*نگهد\s*ارنده|ساپورت\s*مستطیلی|پایه\s*مخصوص\s*ساپورت|ساپورت\s*صنعتی/.test(`${nameNorm} ${ptNorm}`)) {
    out.productType = /اهرم/.test(nameNorm) ? 'اهرم و پایه نگهدارنده صنعتی' : 'بست و پایه نگهدارنده صنعتی';
    setMenuPath(out, 'excel-v2-9-3', 'بست، گیره و پایه نگهدارنده', 'بست U شکل، پایه رولر و ساپورت صنعتی');
    return out;
  }
  if (/پیچ\s*متری|پیچ\s*گالوانیزه|مهره\s*فلکه/.test(nameNorm) || (ptNorm.includes('پیچ صنعتی') && !/دسته|فلکه/.test(nameNorm))) {
    setMenuPath(out, 'excel-v2-9-3', 'پیچ، مهره و استادبولت', 'پیچ متری، پیچ گالوانیزه، مهره و واشر صنعتی');
    return out;
  }

  // 14. Custom Machined Parts & Molds (excel-v2-12-1)
  if (
    /حفاظ\s*(?:ترمینال|روی\s*موتور|موتور|کاشی)|قالب\s*(?:at10|at5|h|t10|\d+|کد)|ساخت\s*قالب|خط\s*کش\s*حفاظ\s*دست|میز\s*کوچک\s*حفاظ\s*دست|کشوئی\s*زیر\s*حفاظ\s*دست|درب\s*(?:بالمیر|شیر\s*برقی)|پوسته\s*هزار\s*خاری|کله\s*قندی|سرميله\s*ساکشن|ترانس/.test(nameNorm) ||
    ptNorm.includes('قالب صنعتی')
  ) {
    setMenuPath(out, 'excel-v2-12-1', 'مطابق با نقشه فنی', 'طراحی و تولید قطعات بر اساس نقشه یا نمونه فنی شما');
    return out;
  }

  // 15. Fix any remaining UNRESOLVED metal shafts / pipes / plates / hubs / scrapers
  if (out.proposedCategorySlug === 'UNRESOLVED') {
    if (/بوش\s*روی\s*میله\s*پی\s*کاپ|بوش\s*بغل/.test(nameNorm)) {
      setMenuPath(
        out,
        'excel-v2-3-2',
        'بوش بغل رولر',
        /پلاستیک|تفلون/.test(matNorm) ? 'بوش بغل رولر پلاستیک' : 'بوش بغل رولر فلزی',
      );
      return out;
    }
    if (/توپی\s*نافی/.test(nameNorm)) {
      setMenuPath(out, 'excel-v2-10-1', 'ملزومات چاپ و لعاب‌پاش', 'تیغه کارول، دیسک لعاب‌پاش، توپی و متعلقات چاپ');
      return out;
    }
    if (/صفحه\s*آجدار\s*ساب/.test(nameNorm)) {
      setMenuPath(out, 'excel-v2-5-2', 'انواع برس خشک‌کن', 'مخصوص خطوط صنعتی و شستشو');
      return out;
    }
    if (/صفحه\s*پائین\s*مکنده/.test(nameNorm)) {
      setMenuPath(out, 'excel-v2-7-3', 'مکنده', 'انواع مکنده صنعتی');
      return out;
    }
    if (/چرخ/.test(nameNorm) && !/کوپلینگ|کوبلینگ/.test(nameNorm)) {
      setMenuPath(out, 'excel-v2-9-4', 'انواع چرخ', 'چرخ‌های صنعتی و انتقال');
      return out;
    }
    if (/استیل|آلومینیوم|فولاد|آهن|برنج/.test(matNorm)) {
      setMenuPath(out, 'excel-v2-9-3', 'شفت، میلگرد و مقاطع فلزی', 'شافت بلبرینگ‌دار، میلگرد، ورق و پروفیل فلزی');
      return out;
    }
  }

  // Check if current assignment validates; if invalid on subtle edge cases, normalize cleanly
  const check = validateFamilyMenuAssignment({
    familyCode: out.sourceFamilyCode,
    familyName: out.originalProductName,
    productType: out.productType,
    material: out.material,
    profile: out.profile,
    categorySlug: out.proposedCategorySlug,
    submenuName: out.proposedSubmenu,
    leafName: out.proposedLeaf,
  });

  if (!check.valid) {
    // Handle specific semantic mismatches revealed during dry runs
    if (check.reason === 'ptfe_part_must_use_engineering_polymer_category' || check.reason === 'rubber_category_non_rubber_material') {
      setMenuPath(
        out,
        'excel-v2-7-4',
        'بوش و قطعات پلیمری مهندسی',
        'بوش، لقمه، تسمه‌پاک‌کن و قطعات مهندسی PTFE / PU',
      );
      return out;
    }
  }

  return out;
}

export function buildInvariantFamilyKey(sku: EngineeredSkuOutput): string {
  return [
    normFa(sku.proposedCategorySlug),
    normFa(sku.proposedSubmenu),
    normFa(sku.proposedLeaf || ''),
    normFa(sku.productType),
    normFa(sku.brand),
    normFa(sku.material),
    normFa(sku.construction),
    normFa(sku.profile),
    normFa(sku.standard),
    normFa(sku.unit),
  ].join('||');
}
