export interface BeltTechnicalSpecInput {
  operatingPrinciple?: string | null;
  beltDivision?: string | null;
  supplyForm?: string | null;
  sidedness?: string | null;
  profile?: string | null;
  pitchMm?: number | null;
  toothAngleDeg?: number | null;
  toothHeightMm?: number | null;
  beltThicknessMm?: number | null;
  topWidthMm?: number | null;
  nominalWidthMm?: number | null;
  widthCode?: string | null;
  pitchLengthMm?: number | null;
  insideLengthMm?: number | null;
  outsideLengthMm?: number | null;
  lengthDesignation?: string | null;
  toothCount?: number | null;
  ribCount?: number | null;
  bodyMaterial?: string | null;
  tensileCord?: string | null;
  backingOrCoating?: string | null;
  standardReference?: string | null;
}

export interface BeltCadSkuInput {
  skuCode: string;
  familyCode?: string | null;
  rawName?: string | null;
  rawSize?: string | null;
  unit?: string | null;
  brand?: string | null;
  actualProductType?: string | null;
  technical?: BeltTechnicalSpecInput | null;
}

export type BeltSectionKind =
  | 'round'
  | 'crowned'
  | 'hex'
  | 'polyv'
  | 'vbelt'
  | 'htd'
  | 'timing'
  | 'conveyor';

export interface ClassifiedBeltSection {
  kind: BeltSectionKind;
  isDouble: boolean;
  isCogged: boolean;
  hasCoating: boolean;
}

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

function fmtNum(val: number | null | undefined, suffix = '', digits = 2): string {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—';
  const rounded = Number.isInteger(val) ? String(val) : Number(val.toFixed(digits)).toString();
  return suffix ? `${rounded} ${suffix}` : rounded;
}

export function classifyBeltSection(
  profileRaw: string,
  divisionRaw: string,
  nameRaw = '',
  sidednessRaw = '',
  backingRaw = '',
): ClassifiedBeltSection {
  const p = String(profileRaw || '').toUpperCase();
  const d = String(divisionRaw || '').toLowerCase();
  const n = String(nameRaw || '');
  const s = String(sidednessRaw || '').toLowerCase();
  const b = String(backingRaw || '');

  const isDouble =
    s.includes('double') ||
    /^(DL|DH|DXL|D5M|D8M|D14M|DA|DB|DT5|DT10|T5D|T10D)/i.test(p) ||
    /دوطرف|دوطرفه|double/i.test(n);
  const isCogged =
    /^(AX|BX|CX|ZX|XPZ|XPA|XPB|XPC|3VX|5VX|8VX)/i.test(p) ||
    /دندانه[\u200c ]?دار|cogged/i.test(`${p} ${n}`);
  const hasCoating = Boolean(b.trim()) || /APL|LINATEX|SUPERGRIP|GRIP|چمفر|روکش/i.test(`${p} ${n} ${b}`);

  if (/CRC_CROWNED|CROWNED|BRB|TRC|SUPERGRIP|LINATEX|اسپاتول|بارکش/.test(`${p} ${n}`) && !/نقاله/.test(n)) {
    if (/(HTD|8M|5M|14M|T5|T10|AT5|AT10|AT20|L|H|XL|XH)/i.test(p)) {
      return { kind: /(3M|5M|8M|14M|RPP|STD)/i.test(p) ? 'htd' : 'timing', isDouble, isCogged: false, hasCoating: true };
    }
    return { kind: 'crowned', isDouble: false, isCogged: false, hasCoating };
  }
  if (/^CRC$|ROUND|گرد/.test(`${p} ${n}`) && !/نقاله/.test(n) && !/گروه/.test(n)) {
    return { kind: 'round', isDouble: false, isCogged: false, hasCoating };
  }
  if (/^(AA|BB|CC)/.test(p) || /شش[\u200c ]?ضلع|hex/i.test(n)) {
    return { kind: 'hex', isDouble: true, isCogged: false, hasCoating };
  }
  if (/^(PH|PJ|PK|PL|PM)/.test(p) || d.includes('poly') || /چند[\u200c ]?شیار|شیاری/i.test(n)) {
    return { kind: 'polyv', isDouble: false, isCogged: false, hasCoating };
  }
  if (d.includes('conveyor') || /PVC|PU_BELT|نقاله|کانوایر/i.test(`${p} ${n}`)) {
    return { kind: 'conveyor', isDouble: false, isCogged: false, hasCoating };
  }
  if (
    d.includes('vbelt') ||
    d.includes('welded-pu-v') ||
    /^(Z|A|B|C|D|E|M|O|AX|BX|CX|ZX|SPA|SPB|SPC|SPZ|XPA|XPB|XPC|XPZ|3V|5V|8V|3VX|5VX|3VX-BANDED|B-PERFORATED)$/.test(p)
  ) {
    return { kind: 'vbelt', isDouble, isCogged, hasCoating };
  }
  if (/(3M|5M|8M|14M|RPP|STD|S8M|S5M|S3M|GT)/i.test(p) || d.includes('htd')) {
    return { kind: 'htd', isDouble, isCogged: false, hasCoating };
  }
  return { kind: 'timing', isDouble, isCogged: false, hasCoating };
}

function resolveCompoundLabelEn(bodyMaterial?: string | null, kind?: BeltSectionKind): string {
  const m = String(bodyMaterial || '');
  if (/پلی[\u200c ]?یورتان|TPU|PU/i.test(m)) return 'Thermoplastic Polyurethane (TPU 90-92 ShA)';
  if (/EPDM/i.test(m)) return 'EPDM / Chloroprene Elastomer Compound';
  if (/PVC/i.test(m)) return 'Industrial Multi-Ply PVC Compound';
  if (/کلروپرن|Neoprene|نئوپرن|CR/i.test(m)) return 'Chloroprene Rubber (Neoprene) + Nylon Facing';
  if (/لاستیک|rubber/i.test(m)) return 'Industrial Elastomer Compound';
  if (kind === 'round' || kind === 'crowned') return 'Reinforced Polyurethane (PU 85 ShA)';
  if (kind === 'conveyor') return 'PVC / PU Multi-Ply Carcass';
  return 'Industrial Elastomer / Polymer';
}

function resolveCordLabelEn(tensileCord?: string | null, bodyMaterial?: string | null): string {
  const c = String(tensileCord || '');
  if (/فولاد|Steel/i.test(c)) return 'Galvanized High-Tensile Steel Cords';
  if (/فایبرگلاس|Fiberglass/i.test(c)) return 'High-Modulus Fiberglass Tensile Cords';
  if (/آرامید|کولار|Aramid|Kevlar/i.test(c)) return 'High-Tenacity Aramid Tensile Cords';
  if (/پلی[\u200c ]?استر|Polyester/i.test(c)) return 'Low-Stretch Polyester Tensile Cords';
  if (/بدون کورد|Uncorded/i.test(c)) return 'Solid Homogeneous Extrusion';
  if (/TPU|PU/i.test(String(bodyMaterial || ''))) return 'Zinc-Coated Steel Tensile Cords';
  return 'Low-Stretch Industrial Tensile Cords';
}

function resolveStandardShort(std?: string | null, kind?: BeltSectionKind, profile = ''): string {
  const s = String(std || '').trim();
  const isoMatch = s.match(/(?:ISO|DIN|RMA)\s*[A-Z0-9:-]+(?:\s*\/\s*(?:ISO|DIN|RMA)\s*[A-Z0-9:-]+)?/i);
  if (isoMatch) return isoMatch[0].toUpperCase();
  if (kind === 'htd') return 'ISO 13050 (HTD / RPP)';
  if (kind === 'polyv') return 'ISO 9982 / DIN 7867';
  if (kind === 'vbelt' || kind === 'hex') {
    if (/SP|XP/i.test(profile)) return 'DIN 7753-1 / ISO 4184';
    if (/3V|5V|8V/i.test(profile)) return 'RMA IP-22 / ISO 4184';
    return 'DIN 2215 / ISO 4184';
  }
  if (/T|AT/i.test(profile)) return 'DIN 7721 / ISO 17396';
  if (kind === 'timing') return 'ISO 5296 / DIN ISO 5296';
  return 'ISO 2768-m / DIN INDUSTRIAL';
}

/**
 * Draws an external ISO dimension line between (x1, y1) and (x2, y2) with extension ticks & centered label.
 */
function dimHoriz(
  x1: number,
  x2: number,
  yDim: number,
  yObjTop: number,
  yObjBottom: number,
  label: string,
  labelAbove = true,
): string {
  const dir = yDim < (yObjTop + yObjBottom) / 2 ? -1 : 1;
  const extStart1 = dir < 0 ? yObjTop - 4 : yObjBottom + 4;
  const extStart2 = extStart1;
  const extEnd = yDim + dir * 8;
  const midX = (x1 + x2) / 2;
  const textY = labelAbove ? yDim - 8 : yDim + 17;
  const textW = Math.max(46, label.length * 8.4 + 14);
  return `
    <g class="iso-dim">
      <line x1="${x1}" y1="${extStart1}" x2="${x1}" y2="${extEnd}" stroke="#475569" stroke-width="0.9"/>
      <line x1="${x2}" y1="${extStart2}" x2="${x2}" y2="${extEnd}" stroke="#475569" stroke-width="0.9"/>
      <line x1="${x1}" y1="${yDim}" x2="${x2}" y2="${yDim}" stroke="#1E293B" stroke-width="1.2" marker-start="url(#arrStart)" marker-end="url(#arrEnd)"/>
      <rect x="${midX - textW / 2}" y="${textY - 12}" width="${textW}" height="15" fill="#FFFFFF" fill-opacity="0.92"/>
      <text x="${midX}" y="${textY}" text-anchor="middle" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="12.5" font-weight="700" fill="#0F172A">${escapeXml(label)}</text>
    </g>`;
}

function dimVert(
  xDim: number,
  xObjEdge: number,
  y1: number,
  y2: number,
  label: string,
  side: 'left' | 'right' = 'right',
): string {
  const dir = side === 'right' ? 1 : -1;
  const extStart = xObjEdge + dir * 4;
  const extEnd = xDim + dir * 8;
  const midY = (y1 + y2) / 2;
  const labelX = side === 'right' ? xDim + 12 : xDim - 12;
  const anchor = side === 'right' ? 'start' : 'end';
  return `
    <g class="iso-dim">
      <line x1="${extStart}" y1="${y1}" x2="${extEnd}" y2="${y1}" stroke="#475569" stroke-width="0.9"/>
      <line x1="${extStart}" y1="${y2}" x2="${extEnd}" y2="${y2}" stroke="#475569" stroke-width="0.9"/>
      <line x1="${xDim}" y1="${y1}" x2="${xDim}" y2="${y2}" stroke="#1E293B" stroke-width="1.2" marker-start="url(#arrStart)" marker-end="url(#arrEnd)"/>
      <text x="${labelX}" y="${midY + 4}" text-anchor="${anchor}" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="12.5" font-weight="700" fill="#0F172A">${escapeXml(label)}</text>
    </g>`;
}

function renderElevationView(
  sku: BeltCadSkuInput,
  sec: ClassifiedBeltSection,
): string {
  const t = sku.technical || {};
  const supply = String(t.supplyForm || 'endless-loop').toLowerCase();
  const isOpen = supply.includes('open') || /متری|باز/i.test(`${sku.rawName || ''} ${sku.unit || ''}`);
  const isSleeve = supply.includes('sleeve') || /اسلیو|رول کامل/i.test(String(sku.rawName || ''));

  const lenBadge = t.pitchLengthMm
    ? `Lp = ${fmtNum(t.pitchLengthMm, 'mm')}`
    : t.insideLengthMm
      ? `Li = ${fmtNum(t.insideLengthMm, 'mm')}`
      : t.outsideLengthMm
        ? `La = ${fmtNum(t.outsideLengthMm, 'mm')}`
        : t.lengthDesignation
          ? `L = ${t.lengthDesignation}`
          : sku.rawSize || 'Standard Length';

  const thicknessStr = fmtNum(t.beltThicknessMm, 'mm');
  const widthStr = fmtNum(t.nominalWidthMm ?? t.topWidthMm, 'mm');
  const countStr = t.toothCount
    ? `z = ${t.toothCount} TEETH`
    : t.ribCount
      ? `N = ${t.ribCount} RIBS`
      : sec.kind === 'round'
        ? `Ø d = ${thicknessStr !== '—' ? thicknessStr : widthStr}`
        : `PROFILE: ${t.profile || 'STD'}`;

  // Panel area: x = 52..954, y = 52..460
  const panelHeader = `
    <text x="68" y="80" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="13" font-weight="700" fill="#0F172A">VIEW 1: GENERAL ARRANGEMENT / ${isOpen ? 'OPEN-ENDED LINEAR ELEVATION' : isSleeve ? 'UNCUT SLEEVE ELEVATION' : 'ENDLESS LOOP ELEVATION'}</text>
    <text x="938" y="80" text-anchor="end" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="11.5" font-weight="600" fill="#475569">SECTION PLANE A–A</text>`;

  if (isOpen) {
    // Straight orthographic linear segment with ISO break ends
    const xL = 190;
    const xR = 810;
    const yTop = 215;
    const yBot = 292;
    const pitchY = 236;
    const toothTicks: string[] = [];
    if (sec.kind === 'htd' || sec.kind === 'timing') {
      for (let tx = xL + 18; tx < xR - 20; tx += 22) {
        if (sec.kind === 'htd') {
          toothTicks.push(`L ${tx} ${yBot - 22} Q ${tx + 7} ${yBot} ${tx + 14} ${yBot - 22}`);
        } else {
          toothTicks.push(`L ${tx} ${yBot - 22} L ${tx + 3} ${yBot} L ${tx + 11} ${yBot} L ${tx + 14} ${yBot - 22}`);
        }
      }
    }
    const bodyPath = toothTicks.length
      ? `M ${xL} ${yTop} L ${xR} ${yTop} L ${xR} ${yBot - 22} ${toothTicks.slice().reverse().join(' ')} L ${xL} ${yBot - 22} Z`
      : `M ${xL} ${yTop} L ${xR} ${yTop} L ${xR} ${yBot} L ${xL} ${yBot} Z`;

    return `
      ${panelHeader}
      <path d="${bodyPath}" fill="#F8FAFC" stroke="#0F172A" stroke-width="2.2"/>
      ${sec.hasCoating ? `<rect x="${xL}" y="${yTop - 12}" width="${xR - xL}" height="12" fill="url(#hatchCoating)" stroke="#0F172A" stroke-width="1.6"/>` : ''}
      <!-- Red Neutral Pitch/Cord Axis -->
      <line x1="${xL - 28}" y1="${pitchY}" x2="${xR + 28}" y2="${pitchY}" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="18,5,3,5"/>
      <!-- Break lines left & right -->
      <path d="M ${xL} ${yTop - 16} L ${xL - 8} ${yTop + 25} L ${xL + 9} ${yTop + 45} L ${xL} ${yBot + 16}" fill="none" stroke="#0F172A" stroke-width="1.5"/>
      <path d="M ${xR} ${yTop - 16} L ${xR - 8} ${yTop + 25} L ${xR + 9} ${yTop + 45} L ${xR} ${yBot + 16}" fill="none" stroke="#0F172A" stroke-width="1.5"/>
      <!-- Section Cutting Plane A-A -->
      <line x1="500" y1="158" x2="500" y2="352" stroke="#0F172A" stroke-width="2.2" stroke-dasharray="22,6,4,6"/>
      <polyline points="484,166 500,158 500,180" fill="none" stroke="#0F172A" stroke-width="2"/>
      <polygon points="480,174 494,168 494,180" fill="#0F172A"/>
      <polygon points="480,336 494,330 494,342" fill="#0F172A"/>
      <text x="468" y="179" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="800" fill="#0F172A">A</text>
      <text x="468" y="343" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="800" fill="#0F172A">A</text>
      ${dimHoriz(xL, xR, 142, yTop, yBot, `${lenBadge} (OPEN-ENDED ROLL)`)}
      ${dimVert(845, xR, yTop, yBot, `h = ${thicknessStr}`, 'right')}
      <text x="500" y="392" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700" fill="#DC2626">PITCH / TENSILE CORD DATUM LINE   ·   WIDTH b = ${escapeXml(widthStr)}</text>
    `;
  }

  // Endless Loop Two-Pulley Orthographic Envelope (centered at cx=500, cy=268)
  const cxL = 335;
  const cxR = 665;
  const cy = 266;
  const R_out = 96;
  const wallThick = sec.kind === 'round' ? 18 : 22;
  const R_in = R_out - wallThick;
  const R_pitch = R_out - wallThick * 0.42;

  // Schematic teeth around inner contour for toothed belts
  const toothNotches: string[] = [];
  if (sec.kind === 'htd' || sec.kind === 'timing' || sec.isCogged) {
    for (let x = cxL; x <= cxR - 18; x += 20) {
      toothNotches.push(`<rect x="${x}" y="${cy - R_in - 5}" width="10" height="6" fill="#334155"/>`);
      toothNotches.push(`<rect x="${x}" y="${cy + R_in - 1}" width="10" height="6" fill="#334155"/>`);
    }
    for (let deg = 105; deg <= 255; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const px = cxL + (R_in - 2) * Math.cos(rad);
      const py = cy + (R_in - 2) * Math.sin(rad);
      toothNotches.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.6" fill="#334155"/>`);
    }
    for (let deg = -75; deg <= 75; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const px = cxR + (R_in - 2) * Math.cos(rad);
      const py = cy + (R_in - 2) * Math.sin(rad);
      toothNotches.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2.6" fill="#334155"/>`);
    }
  }

  return `
    ${panelHeader}
    <!-- Crosshair axes for both drive arc centers -->
    <line x1="${cxL}" y1="${cy - R_out - 22}" x2="${cxL}" y2="${cy + R_out + 22}" stroke="#94A3B8" stroke-width="1" stroke-dasharray="10,4,2,4"/>
    <line x1="${cxR}" y1="${cy - R_out - 22}" x2="${cxR}" y2="${cy + R_out + 22}" stroke="#94A3B8" stroke-width="1" stroke-dasharray="10,4,2,4"/>
    <line x1="${cxL - R_out - 24}" y1="${cy}" x2="${cxR + R_out + 24}" y2="${cy}" stroke="#94A3B8" stroke-width="1" stroke-dasharray="14,5,2,5"/>

    <!-- Belt Loop Body Ring (Even-Odd fill) -->
    <path fill-rule="evenodd"
      d="M ${cxL} ${cy - R_out} L ${cxR} ${cy - R_out} A ${R_out} ${R_out} 0 0 1 ${cxR} ${cy + R_out} L ${cxL} ${cy + R_out} A ${R_out} ${R_out} 0 0 1 ${cxL} ${cy - R_out} Z
         M ${cxL} ${cy - R_in} L ${cxR} ${cy - R_in} A ${R_in} ${R_in} 0 0 1 ${cxR} ${cy + R_in} L ${cxL} ${cy + R_in} A ${R_in} ${R_in} 0 0 1 ${cxL} ${cy - R_in} Z"
      fill="#E2E8F0" fill-opacity="0.55" stroke="#0F172A" stroke-width="2.1"/>

    ${toothNotches.join('')}

    <!-- Red ISO Pitch Line Datum -->
    <path
      d="M ${cxL} ${cy - R_pitch} L ${cxR} ${cy - R_pitch} A ${R_pitch} ${R_pitch} 0 0 1 ${cxR} ${cy + R_pitch} L ${cxL} ${cy + R_pitch} A ${R_pitch} ${R_pitch} 0 0 1 ${cxL} ${cy - R_pitch} Z"
      fill="none" stroke="#DC2626" stroke-width="1.35" stroke-dasharray="15,5,3,5"/>

    <!-- Section Cutting Plane A-A -->
    <line x1="500" y1="138" x2="500" y2="394" stroke="#0F172A" stroke-width="2.2" stroke-dasharray="22,6,4,6"/>
    <polygon points="481,148 496,142 496,154" fill="#0F172A"/>
    <polygon points="481,384 496,378 496,390" fill="#0F172A"/>
    <text x="469" y="153" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="800" fill="#0F172A">A</text>
    <text x="469" y="389" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="800" fill="#0F172A">A</text>

    <!-- Primary ISO Length Dimension -->
    ${dimHoriz(cxL - R_out, cxR + R_out, 118, cy - R_out, cy + R_out, lenBadge)}
    <!-- Thickness callout at right tangent -->
    ${dimVert(cxR + R_out + 38, cxR + R_out, cy - R_out, cy - R_in, `h = ${thicknessStr}`, 'right')}

    <!-- Bottom Summary Line inside View 1 -->
    <text x="500" y="430" text-anchor="middle" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="12" font-weight="700" fill="#0F172A">
      ${escapeXml(countStr)}   ·   WIDTH b = ${escapeXml(widthStr)}   ·   RED LINE: PITCH DATUM (Lp / Lw)
    </text>
  `;
}

function renderEnlargedSectionView(
  sku: BeltCadSkuInput,
  sec: ClassifiedBeltSection,
): string {
  const t = sku.technical || {};
  const profile = String(t.profile || 'STD').toUpperCase();
  const pitchStr = fmtNum(t.pitchMm, 'mm');
  const widthStr = fmtNum(t.nominalWidthMm ?? t.topWidthMm, 'mm');
  const thickStr = fmtNum(t.beltThicknessMm, 'mm');
  const toothHeightStr = fmtNum(t.toothHeightMm, 'mm');
  const angleStr = fmtNum(t.toothAngleDeg ?? (sec.kind === 'vbelt' || sec.kind === 'hex' || sec.kind === 'polyv' ? 40 : 50), '°');

  // Panel bounds: x = 52..954, y = 482..1078 (center cx = 500, cy = 785)
  const cx = 480;
  const cy = 782;

  const header = `
    <text x="68" y="512" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="13.5" font-weight="800" fill="#0F172A">SECTION A–A: PRECISION PROFILE GEOMETRY (ENLARGED SCALE 5:1)</text>
    <text x="938" y="512" text-anchor="end" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="11.5" font-weight="700" fill="#DC2626">TRUE CROSS-SECTIONAL DIMENSIONS (mm / deg)</text>`;

  if (sec.kind === 'round') {
    const r = 104;
    return `
      ${header}
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#hatchElastomer)" stroke="#0F172A" stroke-width="2.6"/>
      <circle cx="${cx}" cy="${cy}" r="22" fill="#FFFFFF" stroke="#0F172A" stroke-width="1.8"/>
      <circle cx="${cx}" cy="${cy}" r="14" fill="#334155"/>
      <line x1="${cx - r - 35}" y1="${cy}" x2="${cx + r + 35}" y2="${cy}" stroke="#DC2626" stroke-width="1.3" stroke-dasharray="16,5,3,5"/>
      <line x1="${cx}" y1="${cy - r - 35}" x2="${cx}" y2="${cy + r + 35}" stroke="#DC2626" stroke-width="1.3" stroke-dasharray="16,5,3,5"/>
      ${dimHoriz(cx - r, cx + r, cy - r - 36, cy - r, cy + r, `Ø d = ${thickStr !== '—' ? thickStr : widthStr}`)}
      ${dimVert(cx + r + 48, cx + r, cy - r, cy + r, `Ø d = ${thickStr !== '—' ? thickStr : widthStr}`, 'right')}
      <line x1="${cx + 15}" y1="${cy - 15}" x2="${cx + 155}" y2="${cy - 88}" stroke="#0F172A" stroke-width="1.2"/>
      <text x="${cx + 162}" y="${cy - 84}" font-family="'JetBrains Mono', monospace" font-size="11.5" font-weight="700" fill="#0F172A">REINFORCED TENSILE CORE</text>
      <text x="500" y="1038" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700" fill="#475569">ROUND / WELDABLE POLYURETHANE PROFILE (CRC)   ·   SURFACE: ${escapeXml(profile)}</text>
    `;
  }

  if (sec.kind === 'crowned') {
    const hw = 148;
    const yBase = cy + 68;
    const yEdge = cy + 6;
    const yCrownTop = cy - 92;
    return `
      ${header}
      <path d="M ${cx - hw} ${yBase} L ${cx - hw} ${yEdge} Q ${cx} ${yCrownTop - 20} ${cx + hw} ${yEdge} L ${cx + hw} ${yBase} Z"
        fill="url(#hatchElastomer)" stroke="#0F172A" stroke-width="2.5"/>
      <line x1="${cx - hw - 26}" y1="${cy + 34}" x2="${cx + hw + 26}" y2="${cy + 34}" stroke="#DC2626" stroke-width="1.3" stroke-dasharray="14,5,3,5"/>
      ${[-95, -57, -19, 19, 57, 95].map((dx) => `<circle cx="${cx + dx}" cy="${cy + 34}" r="6.5" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.2"/>`).join('')}
      ${dimHoriz(cx - hw, cx + hw, yBase + 46, yEdge, yBase, `b = ${widthStr}`, false)}
      ${dimVert(cx + hw + 48, cx + hw, yCrownTop + 18, yBase, `h = ${thickStr}`, 'right')}
      <text x="${cx}" y="${cy - 98}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700" fill="#0F172A">CROWNED CONVEX HAUL-OFF PROFILE (${escapeXml(profile)})</text>
    `;
  }

  if (sec.kind === 'conveyor') {
    const hw = 250;
    const yTop = cy - 62;
    const yPly1 = cy - 18;
    const yPly2 = cy + 16;
    const yBot = cy + 52;
    return `
      ${header}
      <rect x="${cx - hw}" y="${yTop}" width="${hw * 2}" height="${yPly1 - yTop}" fill="url(#hatchCoating)" stroke="#0F172A" stroke-width="2.2"/>
      <rect x="${cx - hw}" y="${yPly1}" width="${hw * 2}" height="${yPly2 - yPly1}" fill="url(#hatchElastomer)" stroke="#0F172A" stroke-width="2.2"/>
      <rect x="${cx - hw}" y="${yPly2}" width="${hw * 2}" height="${yBot - yPly2}" fill="#E2E8F0" stroke="#0F172A" stroke-width="2.2"/>
      <line x1="${cx - hw - 18}" y1="${(yPly1 + yPly2) / 2}" x2="${cx + hw + 18}" y2="${(yPly1 + yPly2) / 2}" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="16,5,3,5"/>
      ${dimHoriz(cx - hw, cx + hw, yTop - 38, yTop, yBot, `b = ${widthStr}`)}
      ${dimVert(cx + hw + 44, cx + hw, yTop, yBot, `h = ${thickStr}`, 'right')}
      <text x="${cx}" y="${yBot + 46}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="11.5" font-weight="700" fill="#475569">MULTI-PLY CONVEYOR CARCASS   ·   TOP COVER + FABRIC PLIES + BOTTOM SLIDE LAYER</text>
    `;
  }

  if (sec.kind === 'hex') {
    const hwOuter = 165;
    const hwFlat = 92;
    const hh = 86;
    return `
      ${header}
      <polygon points="${cx - hwOuter},${cy} ${cx - hwFlat},${cy - hh} ${cx + hwFlat},${cy - hh} ${cx + hwOuter},${cy} ${cx + hwFlat},${cy + hh} ${cx - hwFlat},${cy + hh}"
        fill="url(#hatchElastomer)" stroke="#0F172A" stroke-width="2.5"/>
      <line x1="${cx - hwOuter - 28}" y1="${cy}" x2="${cx + hwOuter + 28}" y2="${cy}" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="16,5,3,5"/>
      ${[-110, -74, -38, 0, 38, 74, 110].map((dx) => `<circle cx="${cx + dx}" cy="${cy}" r="6" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.2"/>`).join('')}
      ${dimHoriz(cx - hwOuter, cx + hwOuter, cy - hh - 42, cy - hh, cy + hh, `b = ${widthStr}`)}
      ${dimVert(cx + hwOuter + 48, cx + hwOuter, cy - hh, cy + hh, `h = ${thickStr}`, 'right')}
      <text x="${cx}" y="${cy + hh + 52}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700" fill="#0F172A">DOUBLE-V HEXAGONAL WEDGE (${escapeXml(profile)})   ·   BEVEL ANGLE α = ${escapeXml(angleStr)}</text>
    `;
  }

  if (sec.kind === 'vbelt') {
    // True 40° trapezoidal wedge cross-section
    const topHalf = /SPZ|XPZ|3V|Z|AX/i.test(profile) && !/SPA|SPB|SPC|5V|8V/i.test(profile) ? 105 : 132;
    const botHalf = Math.round(topHalf * 0.56);
    const topY = cy - 72;
    const botY = cy + 68;
    const pitchY = topY + 34;
    const pitchHalf = topHalf - ((topHalf - botHalf) * (pitchY - topY)) / (botY - topY);

    const cogInset = sec.isCogged
      ? `<g transform="translate(${cx + 245}, ${cy - 30})">
           <rect x="-86" y="-44" width="172" height="106" rx="4" fill="#FFFFFF" stroke="#94A3B8" stroke-width="1.1"/>
           <text x="0" y="-26" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="10.5" font-weight="700" fill="#0F172A">SIDE COG PROFILE</text>
           <path d="M -72 -8 L 72 -8 L 72 28 L 56 28 L 48 10 L 34 10 L 26 28 L 10 28 L 2 10 L -12 10 L -20 28 L -36 28 L -44 10 L -58 10 L -66 28 L -72 28 Z"
             fill="url(#hatchElastomer)" stroke="#0F172A" stroke-width="1.8"/>
           <line x1="-74" y1="2" x2="74" y2="2" stroke="#DC2626" stroke-width="1.2" stroke-dasharray="10,4,2,4"/>
           <text x="0" y="50" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="10" fill="#475569">MOLDED RAW-EDGE COGS</text>
         </g>`
      : '';

    const sectionCx = sec.isCogged ? cx - 95 : cx;

    return `
      ${header}
      <!-- Main 40° Trapezoidal Section -->
      <polygon points="${sectionCx - topHalf},${topY} ${sectionCx + topHalf},${topY} ${sectionCx + botHalf},${botY} ${sectionCx - botHalf},${botY}"
        fill="url(#hatchElastomer)" stroke="#0F172A" stroke-width="2.6"/>
      ${!sec.isCogged
        ? `<polygon points="${sectionCx - topHalf + 6},${topY + 6} ${sectionCx + topHalf - 6},${topY + 6} ${sectionCx + botHalf - 5},${botY - 6} ${sectionCx - botHalf + 5},${botY - 6}" fill="none" stroke="#334155" stroke-width="1" stroke-dasharray="6,3"/>`
        : ''}
      <!-- Red Neutral Pitch Width Datum (wp) -->
      <line x1="${sectionCx - topHalf - 28}" y1="${pitchY}" x2="${sectionCx + topHalf + 28}" y2="${pitchY}" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="16,5,3,5"/>
      <!-- Tensile Cord Wire Cross Sections along Pitch Line -->
      ${[-3, -2, -1, 0, 1, 2, 3].map((idx) => {
        const cordX = sectionCx + idx * ((pitchHalf - 16) / 3.2);
        return `<circle cx="${cordX.toFixed(1)}" cy="${pitchY}" r="6" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.2"/>`;
      }).join('')}
      <!-- Vertical centerline -->
      <line x1="${sectionCx}" y1="${topY - 22}" x2="${sectionCx}" y2="${botY + 24}" stroke="#94A3B8" stroke-width="1" stroke-dasharray="12,4,2,4"/>
      <!-- Wedge Angle Extension Lines (Bottom convergence) -->
      <line x1="${sectionCx - botHalf}" y1="${botY}" x2="${sectionCx}" y2="${botY + 112}" stroke="#64748B" stroke-width="0.9" stroke-dasharray="4,3"/>
      <line x1="${sectionCx + botHalf}" y1="${botY}" x2="${sectionCx}" y2="${botY + 112}" stroke="#64748B" stroke-width="0.9" stroke-dasharray="4,3"/>
      <path d="M ${sectionCx - 22} ${botY + 62} A 54 54 0 0 0 ${sectionCx + 22} ${botY + 62}" fill="none" stroke="#0F172A" stroke-width="1.4" marker-start="url(#arrStart)" marker-end="url(#arrEnd)"/>
      <rect x="${sectionCx - 42}" y="${botY + 71}" width="84" height="20" fill="#FFFFFF" fill-opacity="0.95"/>
      <text x="${sectionCx}" y="${botY + 86}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="800" fill="#0F172A">α = ${escapeXml(angleStr)}</text>

      <!-- ISO Dimensions -->
      ${dimHoriz(sectionCx - topHalf, sectionCx + topHalf, topY - 40, topY, botY, `b = ${widthStr}`)}
      ${dimVert(sectionCx + topHalf + 42, sectionCx + topHalf, topY, botY, `h = ${thickStr}`, 'right')}

      <!-- Leader to Tensile Cords -->
      <line x1="${sectionCx - pitchHalf + 16}" y1="${pitchY}" x2="${sectionCx - topHalf - 98}" y2="${pitchY - 28}" stroke="#0F172A" stroke-width="1.1"/>
      <text x="${sectionCx - topHalf - 104}" y="${pitchY - 32}" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="10.5" font-weight="700" fill="#0F172A">TENSILE CORDS (wp)</text>

      ${cogInset}
    `;
  }

  if (sec.kind === 'polyv') {
    const ribs = Math.max(3, Math.min(Number(t.ribCount) || 6, 12));
    const ribPitchPx = Math.min(48, Math.floor(460 / ribs));
    const halfSpan = (ribs * ribPitchPx) / 2;
    const topY = cy - 42;
    const ribBaseY = cy + 6;
    const ribTipY = cy + 46;
    const cordY = cy - 16;

    const ribPoints: string[] = [`M ${cx - halfSpan} ${topY} L ${cx + halfSpan} ${topY} L ${cx + halfSpan} ${ribBaseY}`];
    for (let i = ribs - 1; i >= 0; i--) {
      const rxRight = cx - halfSpan + (i + 1) * ribPitchPx;
      const rxLeft = cx - halfSpan + i * ribPitchPx;
      const rxMid = (rxLeft + rxRight) / 2;
      ribPoints.push(`L ${rxMid.toFixed(1)} ${ribTipY} L ${rxLeft.toFixed(1)} ${ribBaseY}`);
    }
    ribPoints.push('Z');

    const cordCircles: string[] = [];
    for (let x = cx - halfSpan + 14; x <= cx + halfSpan - 14; x += 22) {
      cordCircles.push(`<circle cx="${x.toFixed(1)}" cy="${cordY}" r="4.5" fill="#0F172A" stroke="#FFFFFF" stroke-width="1"/>`);
    }

    return `
      ${header}
      <path d="${ribPoints.join(' ')}" fill="url(#hatchElastomer)" stroke="#0F172A" stroke-width="2.4"/>
      <line x1="${cx - halfSpan - 26}" y1="${cordY}" x2="${cx + halfSpan + 26}" y2="${cordY}" stroke="#DC2626" stroke-width="1.35" stroke-dasharray="16,5,3,5"/>
      ${cordCircles.join('')}
      ${dimHoriz(cx - halfSpan, cx + halfSpan, topY - 40, topY, ribTipY, `b = ${widthStr} (${t.ribCount || ribs} RIBS)`)}
      ${dimHoriz(cx - halfSpan + ribPitchPx * 0.5, cx - halfSpan + ribPitchPx * 1.5, ribTipY + 38, ribBaseY, ribTipY, `e = ${pitchStr}`, false)}
      ${dimVert(cx + halfSpan + 44, cx + halfSpan, topY, ribTipY, `h = ${thickStr}`, 'right')}
      <text x="${cx}" y="${ribTipY + 86}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700" fill="#0F172A">POLY-V RIBS ANGLE α = 40°   ·   PROFILE ${escapeXml(profile)}</text>
    `;
  }

  // SYNCHRONOUS TIMING BELTS: 'htd' (Curvilinear) or 'timing' (Trapezoidal MXL..AT20, optional Double-Sided, optional APL Backing)
  const numTeeth = 4;
  const pitchPx = 112;
  const halfSpan = (numTeeth * pitchPx) / 2; // 224 px => total 448 px
  const toothH = 44;
  const backH = sec.isDouble ? 36 : 42;
  const pitchDatumOffset = Math.round(backH * 0.45);
  const rootY = cy + 16;
  const tipY = rootY + toothH;
  const topBackY = rootY - backH;
  const pitchY = rootY - pitchDatumOffset;
  const coatH = sec.hasCoating ? 26 : 0;

  const isHtd = sec.kind === 'htd';
  const buildTeethBottom = () => {
    const segs: string[] = [];
    for (let i = numTeeth - 1; i >= 0; i--) {
      const xStart = cx - halfSpan + i * pitchPx;
      const xEnd = xStart + pitchPx;
      const mid = (xStart + xEnd) / 2;
      if (isHtd) {
        // Curvilinear parabolic tooth (HTD / RPP)
        const flankHalf = pitchPx * 0.34;
        segs.push(`L ${(mid + flankHalf).toFixed(1)} ${rootY}`);
        segs.push(
          `C ${(mid + flankHalf * 0.68).toFixed(1)} ${rootY} ${(mid + flankHalf * 0.55).toFixed(1)} ${tipY} ${mid.toFixed(1)} ${tipY}`,
        );
        segs.push(
          `C ${(mid - flankHalf * 0.55).toFixed(1)} ${tipY} ${(mid - flankHalf * 0.68).toFixed(1)} ${rootY} ${(mid - flankHalf).toFixed(1)} ${rootY}`,
        );
        segs.push(`L ${xStart.toFixed(1)} ${rootY}`);
      } else {
        // Trapezoidal tooth (Imperial L/H/XL or Metric T/AT)
        const botHalf = pitchPx * 0.32;
        const topHalf = pitchPx * 0.19;
        segs.push(`L ${(mid + botHalf).toFixed(1)} ${rootY}`);
        segs.push(`L ${(mid + topHalf).toFixed(1)} ${tipY}`);
        segs.push(`L ${(mid - topHalf).toFixed(1)} ${tipY}`);
        segs.push(`L ${(mid - botHalf).toFixed(1)} ${rootY}`);
        segs.push(`L ${xStart.toFixed(1)} ${rootY}`);
      }
    }
    return segs.join(' ');
  };

  const buildTeethTopDouble = () => {
    const segs: string[] = [];
    const topTipY = topBackY - toothH;
    for (let i = 0; i < numTeeth; i++) {
      const xStart = cx - halfSpan + i * pitchPx;
      const xEnd = xStart + pitchPx;
      const mid = (xStart + xEnd) / 2;
      if (isHtd) {
        const flankHalf = pitchPx * 0.34;
        segs.push(`L ${(mid - flankHalf).toFixed(1)} ${topBackY}`);
        segs.push(
          `C ${(mid - flankHalf * 0.68).toFixed(1)} ${topBackY} ${(mid - flankHalf * 0.55).toFixed(1)} ${topTipY} ${mid.toFixed(1)} ${topTipY}`,
        );
        segs.push(
          `C ${(mid + flankHalf * 0.55).toFixed(1)} ${topTipY} ${(mid + flankHalf * 0.68).toFixed(1)} ${topBackY} ${(mid + flankHalf).toFixed(1)} ${topBackY}`,
        );
        segs.push(`L ${xEnd.toFixed(1)} ${topBackY}`);
      } else {
        const botHalf = pitchPx * 0.32;
        const topHalf = pitchPx * 0.19;
        segs.push(`L ${(mid - botHalf).toFixed(1)} ${topBackY}`);
        segs.push(`L ${(mid - topHalf).toFixed(1)} ${topTipY}`);
        segs.push(`L ${(mid + topHalf).toFixed(1)} ${topTipY}`);
        segs.push(`L ${(mid + botHalf).toFixed(1)} ${topBackY}`);
        segs.push(`L ${xEnd.toFixed(1)} ${topBackY}`);
      }
    }
    return segs.join(' ');
  };

  const topOutline = sec.isDouble
    ? `M ${cx - halfSpan} ${topBackY} ${buildTeethTopDouble()}`
    : `M ${cx - halfSpan} ${topBackY} L ${cx + halfSpan} ${topBackY}`;
  const mainBodyPath = `${topOutline} L ${cx + halfSpan} ${rootY} ${buildTeethBottom()} Z`;

  const topActualY = (sec.isDouble ? topBackY - toothH : topBackY) - coatH;
  const cordXs = Array.from({ length: 14 }, (_, idx) => cx - halfSpan + 20 + idx * ((halfSpan * 2 - 40) / 13));

  // Pitch measurement between tooth 2 and tooth 3 centerlines
  const pCenter1 = cx - pitchPx * 0.5;
  const pCenter2 = cx + pitchPx * 0.5;

  return `
    ${header}
    ${sec.hasCoating && !sec.isDouble
      ? `<rect x="${cx - halfSpan}" y="${topBackY - coatH}" width="${halfSpan * 2}" height="${coatH}" fill="url(#hatchCoating)" stroke="#0F172A" stroke-width="2.1"/>`
      : ''}
    <path d="${mainBodyPath}" fill="url(#hatchElastomer)" stroke="#0F172A" stroke-width="2.5"/>

    <!-- Red ISO Neutral Pitch Datum Line -->
    <line x1="${cx - halfSpan - 30}" y1="${pitchY}" x2="${cx + halfSpan + 30}" y2="${pitchY}" stroke="#DC2626" stroke-width="1.4" stroke-dasharray="16,5,3,5"/>
    <!-- Tensile Cords along Pitch Line -->
    ${cordXs.map((x) => `<circle cx="${x.toFixed(1)}" cy="${pitchY}" r="5.5" fill="#0F172A" stroke="#FFFFFF" stroke-width="1.2"/>`).join('')}

    <!-- Tooth Centerlines for Pitch Dimensioning -->
    <line x1="${pCenter1}" y1="${topActualY - 24}" x2="${pCenter1}" y2="${tipY + 34}" stroke="#94A3B8" stroke-width="1" stroke-dasharray="10,4,2,4"/>
    <line x1="${pCenter2}" y1="${topActualY - 24}" x2="${pCenter2}" y2="${tipY + 34}" stroke="#94A3B8" stroke-width="1" stroke-dasharray="10,4,2,4"/>

    <!-- Dimension p (Pitch) -->
    ${dimHoriz(pCenter1, pCenter2, topActualY - 38, topActualY, tipY, `p = ${pitchStr}`)}
    <!-- Tooth Height ht -->
    ${dimVert(cx + halfSpan + 34, cx + halfSpan, rootY, tipY, `ht = ${toothHeightStr}`, 'right')}
    <!-- Total Belt Thickness h -->
    ${dimVert(cx + halfSpan + 166, cx + halfSpan, topActualY, tipY, `h = ${thickStr}`, 'right')}

    <!-- Tooth Angle or Curvilinear Note -->
    <text x="${cx}" y="${tipY + 56}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700" fill="#0F172A">
      ${isHtd ? 'CURVILINEAR HTD / RPP TOOTH PROFILE' : `TRAPEZOIDAL TOOTH FLANK ANGLE = ${escapeXml(angleStr)}`}
      ${sec.isDouble ? '   ·   DOUBLE-SIDED SYMMETRIC' : ''}
      ${sec.hasCoating ? '   ·   TOP COVER: COATED / APL' : ''}
    </text>
    <!-- Cord Callout Leader -->
    <line x1="${cx - halfSpan + 20}" y1="${pitchY}" x2="${cx - halfSpan - 62}" y2="${pitchY - 28}" stroke="#0F172A" stroke-width="1.1"/>
    <text x="${cx - halfSpan - 68}" y="${pitchY - 32}" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="10.5" font-weight="700" fill="#0F172A">PITCH LINE / CORDS</text>
  `;
}

function renderTopPlanView(sku: BeltCadSkuInput, sec: ClassifiedBeltSection): string {
  const t = sku.technical || {};
  const widthStr = fmtNum(t.nominalWidthMm ?? t.topWidthMm, 'mm');
  const lenStr = t.pitchLengthMm
    ? `Lp ${fmtNum(t.pitchLengthMm, 'mm')}`
    : t.insideLengthMm
      ? `Li ${fmtNum(t.insideLengthMm, 'mm')}`
      : t.outsideLengthMm
        ? `La ${fmtNum(t.outsideLengthMm, 'mm')}`
        : t.lengthDesignation || 'Standard';

  // Panel bounds: x = 978..1548, y = 52..525
  const cx = 1205;
  const bandTop = 148;
  const widthPx = sec.kind === 'round' ? 28 : sec.kind === 'vbelt' ? 54 : Math.min(130, Math.max(66, Math.round((t.nominalWidthMm || 25) * 1.4)));
  const bandBot = bandTop + widthPx;
  const xL = 1018;
  const xR = 1388;

  const cordCount = sec.kind === 'round' ? 1 : 5;
  const cordLines = Array.from({ length: cordCount }, (_, idx) => {
    const frac = cordCount === 1 ? 0.5 : (idx + 1) / (cordCount + 1);
    const yLine = bandTop + widthPx * frac;
    return `<line x1="${xL}" y1="${yLine.toFixed(1)}" x2="${xR}" y2="${yLine.toFixed(1)}" stroke="#DC2626" stroke-width="0.9" stroke-dasharray="14,6,3,6"/>`;
  }).join('');

  return `
    <text x="996" y="80" font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="13" font-weight="700" fill="#0F172A">VIEW 2: TOP / PLAN VIEW (WIDTH &amp; CORDS)</text>
    <!-- Belt Span Top Plan -->
    <rect x="${xL}" y="${bandTop}" width="${xR - xL}" height="${widthPx}" fill="#F8FAFC" stroke="#0F172A" stroke-width="2.1"/>
    ${cordLines}
    <!-- Break ends left & right -->
    <path d="M ${xL} ${bandTop - 12} L ${xL - 6} ${bandTop + widthPx * 0.4} L ${xL + 6} ${bandTop + widthPx * 0.65} L ${xL} ${bandBot + 12}" fill="none" stroke="#0F172A" stroke-width="1.4"/>
    <path d="M ${xR} ${bandTop - 12} L ${xR - 6} ${bandTop + widthPx * 0.4} L ${xR + 6} ${bandTop + widthPx * 0.65} L ${xR} ${bandBot + 12}" fill="none" stroke="#0F172A" stroke-width="1.4"/>
    <!-- Factory Marking Zone Callout -->
    <rect x="${cx - 108}" y="${(bandTop + bandBot) / 2 - 11}" width="175" height="22" rx="2" fill="#FFFFFF" stroke="#64748B" stroke-width="0.9" stroke-dasharray="4,2"/>
    <text x="${cx - 20}" y="${(bandTop + bandBot) / 2 + 4}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="10.5" font-weight="700" fill="#334155">PRINT / MARKING FACE</text>

    <!-- Width Dimension b -->
    ${dimVert(xR + 34, xR, bandTop, bandBot, `b = ${widthStr}`, 'right')}

    <!-- Geometric Summary Notes Box inside View 2 -->
    <rect x="996" y="330" width="534" height="174" fill="#F8FAFC" stroke="#94A3B8" stroke-width="1"/>
    <line x1="996" y1="364" x2="1530" y2="364" stroke="#94A3B8" stroke-width="1"/>
    <text x="1012" y="352" font-family="'JetBrains Mono', monospace" font-size="11.5" font-weight="800" fill="#0F172A">ENGINEERING NOTES &amp; TOLERANCE SUMMARY</text>
    <g font-family="'JetBrains Mono', 'DejaVu Sans Mono', monospace" font-size="11.5" fill="#1E293B">
      <text x="1012" y="392">1. ALL DIMENSIONS IN MILLIMETERS (mm) UNLESS SPECIFIED.</text>
      <text x="1012" y="418">2. GENERAL TOLERANCE: ISO 2768-m / WIDTH ±0.5 mm.</text>
      <text x="1012" y="444">3. PITCH / EFFECTIVE LENGTH: ${escapeXml(trunc(lenStr, 36))}</text>
      <text x="1012" y="470">4. DIVISION: ${escapeXml(trunc(t.beltDivision || 'INDUSTRIAL POWER TRANSMISSION', 40))}</text>
      <text x="1012" y="494">5. DO NOT CRIMP BELT DURING STORAGE OR INSTALLATION.</text>
    </g>
  `;
}

function renderIsoTitleBlock(sku: BeltCadSkuInput, sec: ClassifiedBeltSection): string {
  const t = sku.technical || {};
  const profile = String(t.profile || 'STD').toUpperCase();
  const brand = String(sku.brand || 'INDUSTRIAL').toUpperCase();
  const pitchStr = fmtNum(t.pitchMm, 'mm');
  const widthStr = fmtNum(t.nominalWidthMm ?? t.topWidthMm, 'mm');
  const thickStr = fmtNum(t.beltThicknessMm, 'mm');
  const toothHeightStr = fmtNum(t.toothHeightMm, 'mm');
  const angleStr = fmtNum(t.toothAngleDeg ?? (sec.kind === 'vbelt' || sec.kind === 'hex' || sec.kind === 'polyv' ? 40 : null), '°');
  const countStr = t.toothCount ? `${t.toothCount} Teeth` : t.ribCount ? `${t.ribCount} Ribs` : 'Continuous';
  const lenStr = t.pitchLengthMm
    ? `Lp = ${fmtNum(t.pitchLengthMm, 'mm')}`
    : t.insideLengthMm
      ? `Li = ${fmtNum(t.insideLengthMm, 'mm')}`
      : t.outsideLengthMm
        ? `La = ${fmtNum(t.outsideLengthMm, 'mm')}`
        : t.lengthDesignation || sku.rawSize || 'Per Order';
  const supplyLabel = String(t.supplyForm || 'endless-loop').replace(/-/g, ' ').toUpperCase();
  const backingLabel = t.backingOrCoating ? trunc(t.backingOrCoating, 42) : 'Standard Factory Backing';
  const compoundEn = resolveCompoundLabelEn(t.bodyMaterial, sec.kind);
  const cordEn = resolveCordLabelEn(t.tensileCord, t.bodyMaterial);
  const stdShort = resolveStandardShort(t.standardReference, sec.kind, profile);

  // Title Block Bounds: x = 978..1564, y = 540..1094 (w = 586, h = 554)
  const x0 = 978;
  const xEnd = 1564;
  const w = xEnd - x0;

  return `
    <!-- ISO 7200 ENGINEERING TITLE BLOCK -->
    <rect x="${x0}" y="540" width="${w}" height="554" fill="#FFFFFF" stroke="#0F172A" stroke-width="2.2"/>
    <rect x="${x0}" y="540" width="${w}" height="42" fill="#0F172A"/>
    <text x="${x0 + 16}" y="566" font-family="'JetBrains Mono', monospace" font-size="13.5" font-weight="800" fill="#FFFFFF">ISO 7200 SPECIFICATION &amp; TITLE BLOCK</text>
    <text x="${xEnd - 16}" y="566" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700" fill="#FDBA74">DWG NO: SP-${escapeXml(sku.skuCode)}</text>

    <!-- Row Grid Lines -->
    <g stroke="#334155" stroke-width="1">
      <line x1="${x0}" y1="646" x2="${xEnd}" y2="646"/>
      <line x1="${x0}" y1="710" x2="${xEnd}" y2="710"/>
      <line x1="${x0}" y1="774" x2="${xEnd}" y2="774"/>
      <line x1="${x0}" y1="838" x2="${xEnd}" y2="838"/>
      <line x1="${x0}" y1="894" x2="${xEnd}" y2="894"/>
      <line x1="${x0}" y1="950" x2="${xEnd}" y2="950"/>
      <line x1="${x0}" y1="1008" x2="${xEnd}" y2="1008"/>
      <line x1="${x0}" y1="1054" x2="${xEnd}" y2="1054"/>

      <!-- 3-col splits for top 4 parameter rows -->
      <line x1="${x0 + 184}" y1="582" x2="${x0 + 184}" y2="838"/>
      <line x1="${x0 + 412}" y1="582" x2="${x0 + 412}" y2="838"/>
    </g>

    <!-- Row 1: SKU / PROFILE / BRAND -->
    <text x="${x0 + 12}" y="601" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">SKU CODE</text>
    <text x="${x0 + 12}" y="629" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="800" fill="#DC2626">${escapeXml(sku.skuCode)}</text>
    <text x="${x0 + 196}" y="601" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">PROFILE</text>
    <text x="${x0 + 196}" y="629" font-family="'JetBrains Mono', monospace" font-size="16" font-weight="800" fill="#0F172A">${escapeXml(trunc(profile, 13))}</text>
    <text x="${x0 + 424}" y="601" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">MANUFACTURER / BRAND</text>
    <text x="${x0 + 424}" y="629" font-family="'JetBrains Mono', monospace" font-size="14.5" font-weight="800" fill="#0F172A">${escapeXml(trunc(brand, 13))}</text>

    <!-- Row 2: LENGTH / WIDTH / THICKNESS -->
    <text x="${x0 + 12}" y="665" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">EFFECTIVE LENGTH</text>
    <text x="${x0 + 12}" y="693" font-family="'JetBrains Mono', monospace" font-size="14" font-weight="700" fill="#0F172A">${escapeXml(trunc(lenStr, 14))}</text>
    <text x="${x0 + 196}" y="665" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">NOMINAL WIDTH (b)</text>
    <text x="${x0 + 196}" y="693" font-family="'JetBrains Mono', monospace" font-size="14" font-weight="700" fill="#0F172A">${escapeXml(widthStr)}</text>
    <text x="${x0 + 424}" y="665" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">TOTAL THICKNESS (h)</text>
    <text x="${x0 + 424}" y="693" font-family="'JetBrains Mono', monospace" font-size="14" font-weight="700" fill="#0F172A">${escapeXml(thickStr)}</text>

    <!-- Row 3: PITCH / TOOTH HT / COUNT -->
    <text x="${x0 + 12}" y="729" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">PITCH (p / e)</text>
    <text x="${x0 + 12}" y="757" font-family="'JetBrains Mono', monospace" font-size="14" font-weight="700" fill="#0F172A">${escapeXml(pitchStr)}</text>
    <text x="${x0 + 196}" y="729" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">TOOTH HT (ht) / ANGLE</text>
    <text x="${x0 + 196}" y="757" font-family="'JetBrains Mono', monospace" font-size="13.5" font-weight="700" fill="#0F172A">${escapeXml(`${toothHeightStr} / ${angleStr}`)}</text>
    <text x="${x0 + 424}" y="729" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">TEETH / RIBS COUNT (z)</text>
    <text x="${x0 + 424}" y="757" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="700" fill="#0F172A">${escapeXml(countStr)}</text>

    <!-- Row 4: SUPPLY FORM / BACKING / UNIT -->
    <text x="${x0 + 12}" y="793" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">SUPPLY FORM</text>
    <text x="${x0 + 12}" y="821" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700" fill="#0F172A">${escapeXml(trunc(supplyLabel, 15))}</text>
    <text x="${x0 + 196}" y="793" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">REFERENCE STANDARD</text>
    <text x="${x0 + 196}" y="821" font-family="'JetBrains Mono', monospace" font-size="11.5" font-weight="700" fill="#0F172A">${escapeXml(trunc(stdShort, 22))}</text>
    <text x="${x0 + 424}" y="793" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">SIDEDNESS</text>
    <text x="${x0 + 424}" y="821" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="700" fill="#0F172A">${escapeXml(sec.isDouble ? 'DOUBLE-SIDED' : 'SINGLE-SIDED')}</text>

    <!-- Row 5-7: Full Width Material / Tensile / Description Rows -->
    <text x="${x0 + 12}" y="857" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">BODY COMPOUND &amp; HARDNESS</text>
    <text x="${x0 + 12}" y="881" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="700" fill="#0F172A">${escapeXml(trunc(compoundEn, 52))}</text>

    <text x="${x0 + 12}" y="913" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">TENSILE REINFORCEMENT CORD</text>
    <text x="${x0 + 12}" y="937" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="700" fill="#0F172A">${escapeXml(trunc(cordEn, 52))}</text>

    <text x="${x0 + 12}" y="969" font-family="'JetBrains Mono', monospace" font-size="9.5" font-weight="700" fill="#64748B">BACKING / COATING &amp; CATALOG ENTRY</text>
    <text x="${x0 + 12}" y="993" font-family="'JetBrains Mono', monospace" font-size="11.5" font-weight="700" fill="#1E293B">${escapeXml(trunc(backingLabel, 24))}</text>
    <text x="${xEnd - 12}" y="993" text-anchor="end" font-family="'Noto Sans Arabic', 'Liberation Sans', Tahoma, sans-serif" font-size="12.5" font-weight="700" fill="#0F172A">\u202B${escapeXml(trunc(sku.rawName || `${brand} ${profile}`, 34))}\u202C</text>

    <!-- Row 8: First-Angle Projection Symbol + Scale + Units + Tolerance -->
    <g stroke="#0F172A" stroke-width="1.4" fill="none">
      <line x1="${x0 + 130}" y1="1008" x2="${x0 + 130}" y2="1054"/>
      <line x1="${x0 + 275}" y1="1008" x2="${x0 + 275}" y2="1054"/>
      <line x1="${x0 + 415}" y1="1008" x2="${x0 + 415}" y2="1054"/>
      <!-- First-Angle Projection ISO Symbol -->
      <polygon points="${x0 + 22},1023 ${x0 + 54},1017 ${x0 + 54},1045 ${x0 + 22},1039" stroke-width="1.6"/>
      <circle cx="${x0 + 82}" cy="1031" r="14" stroke-width="1.6"/>
      <circle cx="${x0 + 82}" cy="1031" r="7" stroke-width="1.4"/>
      <line x1="${x0 + 14}" y1="1031" x2="${x0 + 104}" y2="1031" stroke="#DC2626" stroke-width="0.9" stroke-dasharray="6,3,2,3"/>
      <line x1="${x0 + 82}" y1="1012" x2="${x0 + 82}" y2="1050" stroke="#DC2626" stroke-width="0.9" stroke-dasharray="6,3,2,3"/>
    </g>
    <text x="${x0 + 144}" y="1024" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="700" fill="#64748B">SCALE</text>
    <text x="${x0 + 144}" y="1044" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="800" fill="#0F172A">1:1 / 5:1</text>
    <text x="${x0 + 289}" y="1024" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="700" fill="#64748B">UNIT / PROJECTION</text>
    <text x="${x0 + 289}" y="1044" font-family="'JetBrains Mono', monospace" font-size="12.5" font-weight="800" fill="#0F172A">mm · ISO-E</text>
    <text x="${x0 + 429}" y="1024" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="700" fill="#64748B">GEN. TOLERANCE</text>
    <text x="${x0 + 429}" y="1044" font-family="'JetBrains Mono', monospace" font-size="12.5" font-weight="800" fill="#0F172A">ISO 2768-m</text>

    <!-- Bottom Authority Strip -->
    <rect x="${x0}" y="1054" width="${w}" height="40" fill="#F1F5F9"/>
    <text x="${x0 + 14}" y="1079" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="800" fill="#0F172A">SANAT PISH INDUSTRIAL ARCHIVE</text>
    <text x="${xEnd - 14}" y="1079" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="700" fill="#15803D">ISO 128 / DIN 6771 CAD</text>
  `;
}

export function renderBeltIsoCadSvg(sku: BeltCadSkuInput, _mode: 'technical' | 'profile' = 'technical'): string {
  const t = sku.technical || {};
  const profile = String(t.profile || 'STD').toUpperCase();
  const sec = classifyBeltSection(
    profile,
    String(t.beltDivision || ''),
    String(sku.rawName || ''),
    String(t.sidedness || ''),
    String(t.backingOrCoating || ''),
  );

  // ISO A3 Zone Grid Letters & Numbers along borders
  const zoneNums = [1, 2, 3, 4, 5, 6, 7, 8]
    .map((n, i) => {
      const cx = 36 + ((1528 / 8) * (i + 0.5));
      const divX = 36 + (1528 / 8) * i;
      return `
        ${i > 0 ? `<line x1="${divX}" y1="12" x2="${divX}" y2="36" stroke="#64748B" stroke-width="0.9"/><line x1="${divX}" y1="1094" x2="${divX}" y2="1118" stroke="#64748B" stroke-width="0.9"/>` : ''}
        <text x="${cx}" y="29" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="700" fill="#475569">${n}</text>
        <text x="${cx}" y="1110" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="700" fill="#475569">${n}</text>`;
    })
    .join('');

  const zoneLetters = ['A', 'B', 'C', 'D', 'E', 'F']
    .map((ch, i) => {
      const cy = 36 + ((1058 / 6) * (i + 0.5));
      const divY = 36 + (1058 / 6) * i;
      return `
        ${i > 0 ? `<line x1="12" y1="${divY}" x2="36" y2="${divY}" stroke="#64748B" stroke-width="0.9"/><line x1="1564" y1="${divY}" x2="1588" y2="${divY}" stroke="#64748B" stroke-width="0.9"/>` : ''}
        <text x="24" y="${cy + 4}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="700" fill="#475569">${ch}</text>
        <text x="1576" y="${cy + 4}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="700" fill="#475569">${ch}</text>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1130" width="1600" height="1130">
  <defs>
    <marker id="arrEnd" markerWidth="9" markerHeight="6" refX="9" refY="3" orient="auto">
      <polygon points="0,0 9,3 0,6" fill="#1E293B"/>
    </marker>
    <marker id="arrStart" markerWidth="9" markerHeight="6" refX="0" refY="3" orient="auto">
      <polygon points="9,0 0,3 9,6" fill="#1E293B"/>
    </marker>
    <pattern id="cadMicroGrid" width="24" height="24" patternUnits="userSpaceOnUse">
      <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#F1F5F9" stroke-width="0.8"/>
    </pattern>
    <pattern id="hatchElastomer" width="10" height="10" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <rect width="10" height="10" fill="#F8FAFC"/>
      <line x1="0" y1="0" x2="0" y2="10" stroke="#64748B" stroke-width="1.35"/>
    </pattern>
    <pattern id="hatchCoating" width="8" height="8" patternTransform="rotate(-45 0 0)" patternUnits="userSpaceOnUse">
      <rect width="8" height="8" fill="#FEF2F2"/>
      <line x1="0" y1="0" x2="0" y2="8" stroke="#DC2626" stroke-width="1.2"/>
    </pattern>
  </defs>

  <!-- Crisp Technical White Drafting Paper -->
  <rect x="0" y="0" width="1600" height="1130" fill="#FFFFFF"/>
  <!-- Outer Paper Sheet Border & Zone Coordinates -->
  <rect x="12" y="12" width="1576" height="1106" fill="#FFFFFF" stroke="#64748B" stroke-width="1"/>
  ${zoneNums}
  ${zoneLetters}

  <!-- Inner Engineering Frame & Micro Drafting Grid -->
  <rect x="36" y="36" width="1528" height="1058" fill="url(#cadMicroGrid)" stroke="#0F172A" stroke-width="2.4"/>

  <!-- Structural Panel Dividers (View 1 / View 2 / Section A-A / Title Block) -->
  <line x1="978" y1="36" x2="978" y2="1094" stroke="#0F172A" stroke-width="1.8"/>
  <line x1="36" y1="472" x2="978" y2="472" stroke="#0F172A" stroke-width="1.8"/>
  <line x1="978" y1="540" x2="1564" y2="540" stroke="#0F172A" stroke-width="1.8"/>

  <!-- Sheet Center Alignment Ticks -->
  <line x1="800" y1="12" x2="800" y2="48" stroke="#0F172A" stroke-width="2"/>
  <line x1="800" y1="1082" x2="800" y2="1118" stroke="#0F172A" stroke-width="2"/>
  <line x1="12" y1="565" x2="48" y2="565" stroke="#0F172A" stroke-width="2"/>
  <line x1="1552" y1="565" x2="1588" y2="565" stroke="#0F172A" stroke-width="2"/>

  ${renderElevationView(sku, sec)}
  ${renderEnlargedSectionView(sku, sec)}
  ${renderTopPlanView(sku, sec)}
  ${renderIsoTitleBlock(sku, sec)}
</svg>`;
}
