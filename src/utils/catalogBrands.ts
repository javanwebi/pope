export interface BrandSource {
  brand?: string | null;
  name?: string | null;
  variants?: Array<{
    brand?: string | null;
    name?: string | null;
    model?: string | null;
    code?: string | null;
    active?: boolean;
  }> | null;
}

const PLACEHOLDER_BRANDS = new Set([
  'ثبت نشده',
  'نامشخص',
  'بدون برند',
  'خارجی',
  'وارداتی صنعتی',
  'صنعت پیش',
  'sanat pish',
  'sanatpish',
  'sanat-pish',
  'sanat_pish',
  'unknown',
  'unknown brand',
  'other',
  'other brand',
  'not specified',
  'none',
  'generic',
  'unbranded',
  'imported',
  'n/a',
  'na',
  '-',
  'عمومی',
  'بدون نام',
  'متفرقه',
  'سایر',
  'چین',
  'ایران',
  'آلمان',
  'ایتالیا',
  'ژاپن',
  'ترکیه',
  'ساخت چین',
  'ساخت ایران',
  'چینی',
  'ایرانی',
  'آلمانی',
  'ایتالیایی',
  'ژاپنی',
  'ترکیه‌ای',
  'generic_industrial',
  'generic industrial',
]);

export function normalizeCatalogBrand(value: string): string {
  return String(value || '')
    .toLocaleLowerCase('fa-IR')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\s]+/g, ' ')
    .trim();
}

export function resolveDisplayBrand(rawBrand?: string | null, name?: string | null): string {
  const cleaned = String(rawBrand || '').trim();
  const searchable = `${cleaned} ${String(name || '')}`;
  const known: Array<[RegExp, string]> = [
    [/\bswr\b/i, 'SWR'],
    [/\bforza\b|فورزا/i, 'FORZA'],
    [/optibelt|اپتی.?بلت|اپتی\b/i, 'Optibelt'],
    [/megadyne|مگداین|مگادین/i, 'Megadyne'],
    [/\bgates\b|گیتس/i, 'Gates'],
    [/continental|contitech|\bkonti\b|کنتیننتال|کنتی.?تک|کنتی\b/i, 'Continental (ContiTech)'],
    [/\bskf\b/i, 'SKF'],
    [/\bfag\b|\bina\b|فاگ|اینا/i, 'FAG / INA'],
    [/habasit|هاباست/i, 'Habasit'],
    [/atlas\s*industrial|اطلس\s*صنعتی/i, 'Atlas Industrial'],
    [/\bbando\b|باندو/i, 'Bando'],
    [/dongil|دانگیل/i, 'Dongil'],
    [/mits[ou]boshi|میتسوبوشی/i, 'Mitsuboshi'],
    [/dayco|دایکو/i, 'Dayco'],
    [/chiaravalli|چیاراوالی/i, 'Chiaravalli'],
    [/uni\s*tech|یونیتک/i, 'UNITECH'],
    [/\bpix\b/i, 'PIX'],
    [/\bvolta\b|ولتا/i, 'Volta'],
    [/\bjager\b|جاگر/i, 'JAGER'],
    [/\bhanchang\b|هان\s*چانگ/i, 'HANCHANG'],
    [/\bmarshal+\b|مارشال/i, 'MARSHAL'],
    [/\bintro\s*tech\b|\bent[eo]ro\s*tech\b/i, 'INTROTECH'],
    [/\bgnr\b/i, 'GNR'],
    [/\bm\.?\s*t\b/i, 'M.T'],
    [/\breflex\b/i, 'REFLEX'],
    [/\bberavo\b|\bbr[ea]+vo\b/i, 'BERAVO'],
    [/\bmega\s*flex\b/i, 'MEGAFLEX'],
  ];
  for (const [pattern, label] of known) {
    if (pattern.test(searchable)) return label;
  }
  if (!cleaned || PLACEHOLDER_BRANDS.has(normalizeCatalogBrand(cleaned))) return '';
  return cleaned;
}

export function getProductDisplayBrands(product: BrandSource): string[] {
  const candidates = [
    resolveDisplayBrand(product.brand, product.name),
    ...(product.variants || [])
      .filter((variant) => variant.active !== false)
      .map((variant) =>
        resolveDisplayBrand(
          variant.brand,
          [variant.name, variant.model, variant.code].filter(Boolean).join(' '),
        ),
      ),
  ];
  const seen = new Set<string>();
  return candidates.filter((brand) => {
    if (!brand) return false;
    const key = normalizeCatalogBrand(brand);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function productHasDisplayBrand(product: BrandSource, selectedBrand: string): boolean {
  const target = normalizeCatalogBrand(selectedBrand);
  if (!target) return false;
  return getProductDisplayBrands(product).some(
    (brand) => normalizeCatalogBrand(brand) === target,
  );
}
