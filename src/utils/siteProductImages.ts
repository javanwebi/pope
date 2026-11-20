import { STORE_ASSETS } from '../assets/images';
import { getProductImageUrl } from '../assets/imagesproducts';
import type { Product } from '../types';

const PULLEY_GALLERY = [STORE_ASSETS.categories.pulleys, STORE_ASSETS.products.aluPulley];
const BEARING_GALLERY = [
  STORE_ASSETS.categories.bearings,
  STORE_ASSETS.products.bearing,
  STORE_ASSETS.products.bearingNsk,
  STORE_ASSETS.forzaSubBearing,
];
const FLUID_GALLERY = [
  STORE_ASSETS.products.pipes,
  STORE_ASSETS.swrSubPipes,
  STORE_ASSETS.swrSubElbow,
];

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function resolveSiteFallbackByText(contextText?: string, seedKey?: string): string {
  const text = (contextText || '').toLowerCase();
  const seed = hashSeed(seedKey || text || 'atlas');

  if (/برس|brush|فرچه/.test(text)) return STORE_ASSETS.subcategories.industrialBrushes;
  if (/سنسور|sensor|چشمی/.test(text)) return STORE_ASSETS.predictiveMaintenanceSensor;
  if (/ریل|گاید|پروفیل|راهنما|rail|guide|profile/.test(text)) return STORE_ASSETS.subcategories.guideRailsProfiles;
  if (/نسوز|تفلون|برزنت|نخ نسوز|ptfe|teflon|refractory/.test(text)) return STORE_ASSETS.subcategories.refractoryPtfeCord;
  if (/توری|مش|سرند|wire mesh|screen/i.test(text)) return STORE_ASSETS.subcategories.wireMeshScreens;
  if (/اسپاتول|روتاری|خطوط لعاب|چاپ سرامیک|squeegee/i.test(text)) return STORE_ASSETS.subcategories.ceramicGlazeRotary;
  if (/اسفنج|ابر|اسکاج|نوار اسفنجی|sponge|foam|scourer/i.test(text)) return STORE_ASSETS.subcategories.spongesFoamScourers;
  if (/پولی|فلکه|pulley|تیپربوش|bushing/i.test(text)) return PULLEY_GALLERY[seed % PULLEY_GALLERY.length];
  if (/بلبرینگ|رولبرینگ|یاتاقان|bearing|nsk|skf|fag|koyo/i.test(text)) return BEARING_GALLERY[seed % BEARING_GALLERY.length];
  if (/زنجیر|چرخ.?زنجیر|chain|sprocket|دنده/i.test(text)) return STORE_ASSETS.categories.chains;
  if (/کوپلینگ|coupling|اتصال محور|یراق|لولا|چرخ/i.test(text)) return STORE_ASSETS.forzaSubCoupling;
  if (/نقاله|conveyor|مدولار|pvc/i.test(text)) return seed % 2 === 0 ? STORE_ASSETS.categories.conveyor : STORE_ASSETS.products.pvcBelt;
  if (/رولر|غلتک|رولیک|roller|بوش|فنر|پین|خار/i.test(text)) return seed % 2 === 0 ? STORE_ASSETS.subcategories.rollerConveyorHero : STORE_ASSETS.products.ceramicRoller;
  if (/سرامیک|کاشی|ceramic/i.test(text)) return seed % 2 === 0 ? STORE_ASSETS.products.ceramicParts : STORE_ASSETS.categories.ceramic;
  if (/شیر|والو|valve/i.test(text)) return seed % 2 === 0 ? STORE_ASSETS.products.valve : STORE_ASSETS.swrSubValve;
  if (/فلنج|flange/i.test(text)) return seed % 2 === 0 ? STORE_ASSETS.products.flange : STORE_ASSETS.swrSubFlanges;
  if (/لوله|زانو|اتصالات|pipe|elbow|fitting/i.test(text)) return FLUID_GALLERY[seed % FLUID_GALLERY.length];
  if (/پمپ|سیالات|pump/i.test(text)) return STORE_ASSETS.products.pump;
  if (/موتور|گیربکس|الکتروموتور|برق|اتوماسیون|motor/i.test(text)) return STORE_ASSETS.products.motor;
  if (/کاسه.?نمد|اورینگ|پکینگ|آب.?بند|پلیمری|لاستیکی|ضربه.?گیر|مکنده|seal/i.test(text)) {
    return seed % 2 === 0 ? STORE_ASSETS.subcategories.polymerSealsHero : STORE_ASSETS.forzaSubFittings;
  }
  if (/مهندسی معکوس|ساخت|سفارشی/i.test(text)) return STORE_ASSETS.reverseEngineeringLab;
  if (/تایمینگ|timing/i.test(text)) return STORE_ASSETS.subcategories.timingBeltHero;
  if (/وی.?بلت|v-belt|شیاری/i.test(text)) return STORE_ASSETS.subcategories.vbeltRibbedHero;
  if (/جوشی|گرد|پلی.?یورتان|crc/i.test(text)) return STORE_ASSETS.subcategories.puWeldedBeltHero;
  if (/تسمه|belt/i.test(text)) return STORE_ASSETS.categories.belts;
  return '';
}

export function resolveSiteProductImage(product?: Partial<Product> | null, fallbackContext?: string): string {
  if (product) {
    const candidates = [
      ...(product.images || []),
      product.image,
      ...(product.galleryImages || []).map((img) => img?.url),
      ...(product.variants || []).flatMap((v) => v?.images || []),
    ].filter((val): val is string => Boolean(val && String(val).trim()));

    for (const raw of candidates) {
      const normalized = getProductImageUrl(raw);
      if (normalized) return normalized;
      if (/^(\/assets\/|\/src\/assets\/|\/images\/)/.test(raw.trim())) {
        return raw.trim();
      }
    }
  }
  const combinedText = [
    product?.name,
    product?.nameEn,
    product?.subcategory,
    product?.submenu,
    product?.categoryName,
    product?.brand,
    ...(product?.tags || []),
    fallbackContext,
  ]
    .filter(Boolean)
    .join(' ');
  return resolveSiteFallbackByText(combinedText, product?.code || product?.name || fallbackContext);
}
