import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { classifyBeltSection, type BeltCadSkuInput } from './beltCadRenderer';

export type BeltTemplateArchetype =
  | 'timing-black'
  | 'timing-pu-white'
  | 'vbelt-classical'
  | 'vbelt-cogged'
  | 'polyv-ribbed'
  | 'round-pu-green'
  | 'conveyor-pvc';

const TEMPLATE_DIR = path.resolve(process.cwd(), 'public/belt-catalog/sku-templates');
const RENDER_CACHE_DIR = path.resolve('/tmp/sanatpish-asset-cache/sku-labeled-renders/v4');

const templateBufferCache = new Map<BeltTemplateArchetype, Buffer>();

function escapeXml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function trunc(text: unknown, maxLen: number): string {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, Math.max(1, maxLen - 1)) + '…';
}

function fmtNum(val: number | null | undefined, suffix = ''): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '';
  const rounded = Number.isInteger(val) ? String(val) : Number(val.toFixed(2)).toString();
  return suffix ? `${rounded}${suffix}` : rounded;
}

/**
 * Renders curved industrial stencil text strictly with SVG transform (translate + rotate)
 * along a quadratic Bezier curve B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2.
 * This guarantees 100% deterministic rendering inside Sharp/librsvg (avoiding <textPath> quirks).
 */
function renderCurvedQuadText(
  text: string,
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  opts: {
    fontSize: number;
    fill: string;
    stepPx: number;
    fontWeight?: number;
  },
): string {
  const chars = Array.from(text);
  if (!chars.length) return '';
  const totalSpanPx = chars.length * opts.stepPx;
  // Approximate chord length along Bezier
  const chordLen = Math.hypot(p2[0] - p0[0], p2[1] - p0[1]);
  const spanFrac = Math.min(0.92, totalSpanPx / Math.max(120, chordLen));
  const tStart = 0.5 - spanFrac / 2;

  return chars
    .map((ch, idx) => {
      const frac = chars.length === 1 ? 0.5 : idx / (chars.length - 1);
      const t = Math.max(0.03, Math.min(0.97, tStart + frac * spanFrac));
      const omt = 1 - t;
      const x = omt * omt * p0[0] + 2 * omt * t * p1[0] + t * t * p2[0];
      const y = omt * omt * p0[1] + 2 * omt * t * p1[1] + t * t * p2[1];
      const dx = 2 * omt * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
      const dy = 2 * omt * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
      const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (ch === ' ') return '';
      return `<text transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${deg.toFixed(1)})" text-anchor="middle" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="${opts.fontSize}" font-weight="${opts.fontWeight || 800}" fill="${opts.fill}">${escapeXml(ch)}</text>`;
    })
    .join('');
}

export function selectSkuTemplateArchetype(sku: BeltCadSkuInput): BeltTemplateArchetype {
  const t = sku.technical || {};
  const profile = String(t.profile || '').toUpperCase();
  const division = String(t.beltDivision || '').toLowerCase();
  const body = String(t.bodyMaterial || '');
  const name = String(sku.rawName || '');
  const sec = classifyBeltSection(profile, division, name, String(t.sidedness || ''), String(t.backingOrCoating || ''));

  if (sec.kind === 'conveyor') return 'conveyor-pvc';
  if (sec.kind === 'round' || sec.kind === 'crowned') return 'round-pu-green';
  if (sec.kind === 'polyv') return 'polyv-ribbed';
  if (sec.kind === 'vbelt' || sec.kind === 'hex') {
    if (division.includes('welded-pu-v')) return 'round-pu-green';
    return sec.isCogged ? 'vbelt-cogged' : 'vbelt-classical';
  }
  const isPuWhite =
    /پلی[\u200c ]?یورتان|TPU|PU/i.test(`${body} ${name}`) ||
    /^(AT5|AT10|AT20|T2\.5|T5|T10|T20|DT5|DT10|ATK)/i.test(profile);
  if (isPuWhite) return 'timing-pu-white';
  return 'timing-black';
}

function buildBeltMarkingLines(sku: BeltCadSkuInput): {
  brandLine: string;
  specLine: string;
  skuLine: string;
} {
  const t = sku.technical || {};
  const brandRaw = String(sku.brand || '').trim().toUpperCase();
  const invalidBrands = new Set([
    '',
    'GENERIC',
    'GENERIC_INDUSTRIAL',
    'FOREIGN',
    'UNSPECIFIED',
    'N/A',
    'NA',
    'UNKNOWN',
    'ثبت نشده',
  ]);
  const brand = invalidBrands.has(brandRaw) ? 'SANAT PISH' : brandRaw;

  const profile = String(t.profile || 'STD').trim().toUpperCase();
  const lenPart = t.pitchLengthMm
    ? `${fmtNum(t.pitchLengthMm)}`
    : t.insideLengthMm
      ? `Li ${fmtNum(t.insideLengthMm)}`
      : t.outsideLengthMm
        ? `La ${fmtNum(t.outsideLengthMm)}`
        : t.lengthDesignation
          ? String(t.lengthDesignation)
          : String(sku.rawSize || '').trim();

  const widthPart = t.ribCount
    ? `${t.ribCount}${profile}`
    : t.nominalWidthMm
      ? `${fmtNum(t.nominalWidthMm, 'mm')}`
      : t.topWidthMm
        ? `${fmtNum(t.topWidthMm, 'mm')}`
        : '';

  const specTokens = t.ribCount
    ? [widthPart, lenPart].filter(Boolean)
    : [profile, lenPart, widthPart].filter(Boolean);

  const specLine = trunc(specTokens.join(' × ').replace(/×\s*Li/g, '| Li').replace(/×\s*La/g, '| La'), 26);
  const seriesSuffix =
    t.beltDivision?.includes('htd')
      ? 'HTD-SYNCHRO'
      : t.beltDivision?.includes('metric')
        ? 'PU-STEEL'
        : t.beltDivision?.includes('poly')
          ? 'POLY-V'
          : t.beltDivision?.includes('vbelt')
            ? 'V-DRIVE'
            : 'INDUSTRIAL';

  return {
    brandLine: trunc(`${brand} ${seriesSuffix}`, 26),
    specLine: specLine || trunc(profile, 24),
    skuLine: `SKU:${String(sku.skuCode).trim()}`,
  };
}

function buildStencilOverlaySvg(archetype: BeltTemplateArchetype, sku: BeltCadSkuInput): string {
  const { brandLine, specLine, skuLine } = buildBeltMarkingLines(sku);
  const t = sku.technical || {};
  const extraTag = t.backingOrCoating ? 'COATED' : t.supplyForm?.includes('open') ? 'OPEN-END' : 'ISO/DIN';

  switch (archetype) {
    case 'timing-black': {
      // Smooth foreground wrap of matte black timing belt (centered inside dark band, well clear of bottom edge)
      const topArc = renderCurvedQuadText(
        `${brandLine} · ${specLine}`,
        [240, 544],
        [600, 594],
        [960, 542],
        { fontSize: 21, fill: '#F8FAFC', stepPx: 14.0 },
      );
      const botArc = renderCurvedQuadText(
        `${skuLine}  ||  ${extraTag}  ||  DO NOT CRIMP`,
        [255, 574],
        [600, 624],
        [945, 572],
        { fontSize: 16.5, fill: '#FDBA74', stepPx: 11.8, fontWeight: 700 },
      );
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="896" viewBox="0 0 1200 896">
        <g opacity="0.92">${topArc}${botArc}</g>
      </svg>`;
    }

    case 'timing-pu-white': {
      // Arched bridge of clean white PU belt (~y=375..305..375 upward arch)
      const topArc = renderCurvedQuadText(
        `${brandLine} · ${specLine}`,
        [295, 412],
        [615, 294],
        [925, 405],
        { fontSize: 20, fill: '#0F172A', stepPx: 13.5 },
      );
      const botArc = renderCurvedQuadText(
        `${skuLine} · STEEL CORD · ${extraTag}`,
        [310, 444],
        [615, 330],
        [910, 438],
        { fontSize: 16.5, fill: '#C2410C', stepPx: 11.8 },
      );
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="896" viewBox="0 0 1200 896">
        <g opacity="0.88">${topArc}${botArc}</g>
      </svg>`;
    }

    case 'vbelt-cogged': {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="896" viewBox="0 0 1200 896">
        <g transform="translate(612, 408) rotate(-25.8)" opacity="0.90">
          <rect x="-258" y="-26" width="516" height="52" rx="3" fill="#0F172A" fill-opacity="0.35"/>
          <rect x="-252" y="-22" width="12" height="44" fill="#EA580C"/>
          <text x="-226" y="-2" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="19.5" font-weight="800" letter-spacing="1.2" fill="#F8FAFC">${escapeXml(brandLine)}</text>
          <text x="-226" y="20" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="18.5" font-weight="800" letter-spacing="1.1" fill="#FDE68A">${escapeXml(specLine)}   ·   ${escapeXml(skuLine)}</text>
        </g>
      </svg>`;
    }

    case 'vbelt-classical': {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="896" viewBox="0 0 1200 896">
        <g transform="translate(804, 520) rotate(-24.2)" opacity="0.92">
          <rect x="-164" y="-22" width="328" height="44" rx="2" fill="#18181B" fill-opacity="0.52"/>
          <rect x="-160" y="-18" width="8" height="36" fill="#F97316"/>
          <text x="-144" y="-3" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="13.5" font-weight="800" letter-spacing="0.5" fill="#F8FAFC">${escapeXml(trunc(brandLine, 22))}</text>
          <text x="-144" y="15" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="11.5" font-weight="800" letter-spacing="0.3" fill="#FDBA74">${escapeXml(trunc(specLine, 22))} · ${escapeXml(skuLine)}</text>
        </g>
      </svg>`;
    }

    case 'polyv-ribbed': {
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="896" viewBox="0 0 1200 896">
        <g transform="translate(556, 396) rotate(-30.5)" opacity="0.90">
          <rect x="-220" y="-24" width="440" height="48" rx="2" fill="#0F172A" fill-opacity="0.32"/>
          <text x="0" y="-3" text-anchor="middle" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="19" font-weight="800" letter-spacing="1.4" fill="#F8FAFC">${escapeXml(brandLine)}   ·   ${escapeXml(specLine)}</text>
          <text x="0" y="19" text-anchor="middle" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="16" font-weight="700" letter-spacing="1.6" fill="#FDBA74">${escapeXml(skuLine)}   ||   ISO 9982 POLY-V</text>
        </g>
      </svg>`;
    }

    case 'round-pu-green': {
      // Smooth front cylindrical band of cropped green PU roll (centered at y~470..560)
      const topArc = renderCurvedQuadText(
        `${brandLine} · ${specLine}`,
        [240, 458],
        [600, 514],
        [960, 458],
        { fontSize: 22, fill: '#FFFFFF', stepPx: 14.2 },
      );
      const botArc = renderCurvedQuadText(
        `${skuLine}  ·  WELDABLE PU / ${extraTag}`,
        [255, 506],
        [600, 562],
        [945, 506],
        { fontSize: 18, fill: '#DCFCE7', stepPx: 12.6 },
      );
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="896" viewBox="0 0 1200 896">
        <g opacity="0.94">${topArc}${botArc}</g>
      </svg>`;
    }

    case 'conveyor-pvc': {
      // Cropped green multi-ply conveyor slab (top face centered around x=475, y=310, angled ~ -33.5 deg)
      return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="896" viewBox="0 0 1200 896">
        <g transform="translate(475, 315) rotate(-33.5)" opacity="0.94">
          <text x="0" y="-20" text-anchor="middle" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="21" font-weight="800" letter-spacing="1.4" fill="#FFFFFF">${escapeXml(trunc(brandLine, 26))}</text>
          <text x="0" y="10" text-anchor="middle" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="19" font-weight="800" letter-spacing="1.0" fill="#FEF08A">${escapeXml(trunc(specLine, 28))}</text>
          <text x="0" y="38" text-anchor="middle" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="16.5" font-weight="700" letter-spacing="1.2" fill="#E2E8F0">${escapeXml(skuLine)}  ·  MULTI-PLY CONVEYOR</text>
        </g>
      </svg>`;
    }
  }
}

async function getTemplateBuffer(archetype: BeltTemplateArchetype): Promise<Buffer> {
  const cached = templateBufferCache.get(archetype);
  if (cached) return cached;
  const filePath = path.join(TEMPLATE_DIR, `${archetype}.webp`);
  const buf = await fsPromises.readFile(filePath);
  templateBufferCache.set(archetype, buf);
  return buf;
}

export async function renderLabeledSkuBeltWebp(sku: BeltCadSkuInput): Promise<Buffer> {
  const safeCode = String(sku.skuCode || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cachePath = path.join(RENDER_CACHE_DIR, `${safeCode}.webp`);

  try {
    const cached = await fsPromises.readFile(cachePath);
    if (cached.length > 0) return cached;
  } catch {
    // Render on miss
  }

  const archetype = selectSkuTemplateArchetype(sku);
  const baseBuf = await getTemplateBuffer(archetype);
  const overlaySvg = buildStencilOverlaySvg(archetype, sku);

  const outBuf = await sharp(baseBuf)
    .composite([{ input: Buffer.from(overlaySvg, 'utf8'), blend: 'over' }])
    .webp({ quality: 88 })
    .toBuffer();

  try {
    if (!fs.existsSync(RENDER_CACHE_DIR)) {
      await fsPromises.mkdir(RENDER_CACHE_DIR, { recursive: true });
    }
    await fsPromises.writeFile(cachePath, outBuf);
  } catch {
    // Non-fatal cache write error
  }

  return outBuf;
}
