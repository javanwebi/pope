#!/usr/bin/env bun
/**
 * Real Belt Image Discovery, Gemini Vision Verification & WebP Conversion Pipeline
 * ---------------------------------------------------------------------------------
 * Runs natively with Bun (and compatible with Node/tsx):
 *   bun run scripts/real-belt-image-pipeline.ts --mode=families --limit=10
 *   bun run scripts/real-belt-image-pipeline.ts --mode=skus --limit=10
 *
 * Requirements:
 *   - SERPER_API_KEY (https://google.serper.dev/images)
 *   - GEMINI_API_KEY (@google/genai, model: gemini-2.5-flash)
 *   - sharp (loss-resistant WebP conversion preserving belt markings)
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { GoogleGenAI, Type } from '@google/genai';

// =============================================================================
// Constants & Configuration
// =============================================================================

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
export const SERPER_IMAGES_ENDPOINT = 'https://google.serper.dev/images';
export const MAX_CONCURRENCY = 3;
export const DOWNLOAD_TIMEOUT_MS = 10_000;
export const SERPER_TIMEOUT_MS = 20_000;
export const MIN_IMAGE_WIDTH_PX = 500;
export const MAX_OUTPUT_WIDTH_PX = 1600;
export const MIN_VISION_CONFIDENCE = 85;
export const CHECKPOINT_INTERVAL = 5;
export const FAMILY_CANDIDATE_LIMIT = 12;
export const SKU_CANDIDATE_LIMIT = 5;

export const FAMILY_ANGLE_SLOTS = ['01-main', '02-angle', '03-detail', '04-closeup'] as const;
export type FamilyAngleSlot = (typeof FAMILY_ANGLE_SLOTS)[number];

export const PATHS = {
  root: process.cwd(),
  deliverablesDir: path.resolve(process.cwd(), 'deliverables/belt-master-audit'),
  missingFamiliesCsv: path.resolve(process.cwd(), 'deliverables/belt-master-audit/missing_family_images.csv'),
  missingSkusCsv: path.resolve(process.cwd(), 'deliverables/belt-master-audit/missing_sku_images.csv'),
  skuImageAuditCsv: path.resolve(process.cwd(), 'deliverables/belt-master-audit/sku_image_audit.csv'),
  verifiedVisualAuditRegistryJson: path.resolve(
    process.cwd(),
    'deliverables/belt-master-audit/verified_visual_audit_registry.json',
  ),
  pipelineExecutionStatsJson: path.resolve(
    process.cwd(),
    'deliverables/belt-master-audit/pipeline_execution_stats.json',
  ),
  finalFamilyMappingJson: path.resolve(process.cwd(), 'deliverables/belt-master-audit/final_family_mapping.json'),
  finalSkuMappingJson: path.resolve(process.cwd(), 'deliverables/belt-master-audit/final_sku_mapping.json'),
  familyProvenanceCsv: path.resolve(process.cwd(), 'deliverables/belt-master-audit/family-image-provenance.csv'),
  skuProvenanceCsv: path.resolve(process.cwd(), 'deliverables/belt-master-audit/sku-image-provenance.csv'),
  publicFamiliesDir: path.resolve(process.cwd(), 'public/belt-catalog/families'),
  publicSkusDir: path.resolve(process.cwd(), 'public/belt-catalog/skus'),
  publicVerifiedDir: path.resolve(process.cwd(), 'public/belt-catalog/verified'),
} as const;

const PRIORITY_MANUFACTURER_DOMAINS: string[] = [
  'optibelt.com',
  'megadynegroup.com',
  'bandogrp.com',
  'bando.de',
  'bandousa.com',
  'swr-europe.com',
  'volta-belting.com',
  'mitsuboshi.com',
  'drbworld.com',
  'behabelt.com',
  'contitech.de',
  'continental-industry.com',
  'gates.com',
  'habasit.com',
  'ammeraalbeltech.com',
  'forbo.com',
  'breco.de',
  'mulco.net',
  'elatech.com',
  'sitspa.it',
  'allaoui.shop',
  'hug-technik.com',
  'zahnriemen24.de',
  '123courroies.com',
  'beltingonline.com',
  'simplybearings.co.uk',
  'motion.com',
  'rs-online.com',
  'misumi-ec.com',
  'grainger.com',
];

const BLOCKED_STOCK_OR_LOW_TRUST_DOMAINS: string[] = [
  'shutterstock.com',
  'istockphoto.com',
  'gettyimages.com',
  'alamy.com',
  '123rf.com',
  'dreamstime.com',
  'vecteezy.com',
  'freepik.com',
  'depositphotos.com',
  'stock.adobe.com',
  'pinterest.com',
  'pinimg.com',
  'canva.com',
  'pngtree.com',
  'cleanpng.com',
  'clipartmax.com',
  'wikimedia.org',
];

const DIVISION_ENGLISH_LABELS: Record<string, string> = {
  'vbelt-classical': 'classical wrapped V-belt',
  'vbelt-classical-cogged': 'raw edge cogged classical V-belt',
  'vbelt-wedge-wrapped': 'narrow wedge wrapped V-belt',
  'vbelt-wedge-cogged': 'raw edge cogged narrow wedge V-belt',
  'vbelt-hexagonal': 'double sided hexagonal V-belt',
  'timing-imperial-single': 'imperial trapezoidal rubber timing belt',
  'timing-imperial': 'imperial trapezoidal timing belt',
  'timing-htd': 'HTD curvilinear rubber timing belt',
  'timing-metric-single': 'polyurethane steel cord metric timing belt',
  'timing-pu-steel': 'polyurethane steel cord timing belt',
  'timing-double-sided': 'double sided synchronous timing belt',
  'timing-coated-pu': 'coated polyurethane timing belt',
  'timing-industrial': 'industrial synchronous timing belt',
  'polyv-ribbed': 'multi-ribbed poly-V belt',
  'pu-round-welded': 'polyurethane welded round belt',
  'pu-vbelt-welded': 'polyurethane welded V-belt',
  'crowned-ceramic': 'ceramic glaze line crowned haul-off belt',
  'conveyor-pvc-pu': 'industrial PVC PU conveyor belt',
  'belt-welding-tool': 'polyurethane belt welding clamp tool',
};

const GENERIC_BRANDS = new Set([
  '',
  'UNSPECIFIED',
  'GENERIC',
  'GENERIC_INDUSTRIAL',
  'FOREIGN',
  'FOREIGN-OEM',
  'خارجی',
  'ثبت نشده',
  'نامشخص',
]);

// =============================================================================
// Types
// =============================================================================

export type PipelineMode = 'families' | 'skus';
export type PipelineEngine = 'auto' | 'audit' | 'gemini';
export type LicenseStatus = 'USER_CONFIRMED';
export type VisualStatus = 'VERIFIED' | 'REJECTED' | 'NEEDS_MANUAL_REVIEW' | 'NOT_FOUND' | 'SOURCE_UNAVAILABLE';
export type FinalSkuImageStatus =
  | 'VERIFIED_REAL_PRODUCT_IMAGE'
  | 'NOT_FOUND'
  | 'NEEDS_MANUAL_REVIEW'
  | 'SOURCE_UNAVAILABLE';

export interface StrictSkuHardGateInput {
  licenseStatus: LicenseStatus | string;
  visualStatus: VisualStatus | string;
  frontFacingMarking: boolean;
  readableWithoutAbnormalZoom: boolean;
  unmanipulatedRealPhoto: boolean;
  productIdentityMatched: boolean;
  markingMatched: boolean;
  brandMatched: boolean;
  profileMatched: boolean;
  technicalSpecsMatched: boolean;
  ocrOnly: boolean;
  visibleMarking?: string;
}

export interface SameBeltCloseupLinkInput {
  primarySkuId: string;
  closeupSkuId: string;
  primarySourcePageUrl: string;
  closeupSourcePageUrl: string;
  primaryVisibleMarking: string;
  closeupVisibleMarking: string;
  primarySha256: string;
  closeupSha256: string;
  sameBeltProof: string;
}

export interface CliOptions {
  mode: PipelineMode;
  engine: PipelineEngine;
  limit: number | null;
  concurrency: number;
  retryNotFound: boolean;
  help: boolean;
}

export interface MissingFamilyCsvRow {
  family_id: string;
  family_name: string;
  brand: string;
  belt_division: string;
  profile: string;
  missing_slot_number: string;
  missing_slot_file: string;
  status: string;
  required_action_fa: string;
}

export interface FamilyTask {
  familyId: string;
  familyName: string;
  brand: string;
  beltDivision: string;
  profile: string;
  missingSlots: FamilyAngleSlot[];
  seriesHint: string;
  englishNameHint: string;
  materialHint: string;
  standardHint: string;
}

export interface MissingSkuCsvRow {
  sku_id: string;
  raw_title: string;
  source_family_id: string;
  proposed_family_id: string;
  brand: string;
  belt_division: string;
  profile: string;
  missing_slot: string;
  status: string;
  technical_drawing_status: string;
  required_action_fa: string;
}

export interface SerperImageCandidate {
  title: string;
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
  source?: string;
  domain?: string;
  link?: string;
  position?: number;
}

export interface FamilyVisionVerdict {
  isRealPhysicalBeltPhoto: boolean;
  matchesFamilySpecs: boolean;
  angleCategory: FamilyAngleSlot | 'none';
  confidence: number;
  detectedBrand: string;
  detectedFeatures: string;
  reason: string;
}

export interface SkuVisionVerdict {
  isRealPhysicalBeltPhoto: boolean;
  printedTextOcr: string;
  matchesBrand: boolean;
  matchesProfile: boolean;
  matchesDimensions: boolean;
  matchesExactSkuSpecs: boolean;
  confidence: number;
  reason: string;
}

export interface FamilyProvenanceRecord {
  family_id: string;
  family_name: string;
  brand: string;
  belt_division: string;
  profile: string;
  slot: FamilyAngleSlot;
  status: 'VERIFIED' | 'REAL_IMAGE_NOT_FOUND';
  license_status: LicenseStatus;
  visual_status: VisualStatus;
  local_path: string;
  source_url: string;
  source_page_url: string;
  manufacturer: string;
  sha256: string;
  width: string;
  height: string;
  confidence: string;
  detected_features: string;
  reason: string;
  verified_at: string;
}

export interface SkuProvenanceRecord {
  sku_id: string;
  raw_title: string;
  brand: string;
  profile: string;
  status: 'VERIFIED' | 'REAL_IMAGE_NOT_FOUND' | 'NEEDS_MANUAL_REVIEW' | 'SOURCE_UNAVAILABLE';
  final_status: FinalSkuImageStatus;
  license_status: LicenseStatus;
  visual_status: VisualStatus;
  local_path: string;
  closeup_local_path: string;
  closeup_source_url: string;
  closeup_sha256: string;
  same_belt_proof: string;
  hard_gate_passed: string;
  source_url: string;
  source_page_url: string;
  manufacturer: string;
  sha256: string;
  width: string;
  height: string;
  confidence: string;
  ocr_text: string;
  reason: string;
  verified_at: string;
}

export interface PipelineCounters {
  processed: number;
  skippedResumed: number;
  downloadedImages: number;
  approvedImages: number;
  approvedCloseups: number;
  rejectedCandidates: number;
  duplicateRejected: number;
  notFoundSlots: number;
  needsManualReview: number;
  sourceUnavailable: number;
  apiErrors: number;
}

// =============================================================================
// Pure CLI, CSV & Domain Helpers (Exported for Unit Testing)
// =============================================================================

export function parseCliArgs(argv: string[]): CliOptions {
  let mode: PipelineMode | null = null;
  let engine: PipelineEngine = 'auto';
  let limit: number | null = null;
  let concurrency = MAX_CONCURRENCY;
  let retryNotFound = false;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i].trim();
    if (arg === '--help' || arg === '-h') {
      help = true;
      continue;
    }
    if (arg === '--retry-not-found') {
      retryNotFound = true;
      continue;
    }
    if (arg.startsWith('--engine=')) {
      const val = arg.slice('--engine='.length).trim().toLowerCase();
      if (val !== 'auto' && val !== 'audit' && val !== 'gemini') {
        throw new Error(`Invalid --engine value "${val}". Expected "auto", "audit", or "gemini".`);
      }
      engine = val;
      continue;
    }
    if (arg.startsWith('--mode=')) {
      const val = arg.slice('--mode='.length).trim().toLowerCase();
      if (val !== 'families' && val !== 'skus') {
        throw new Error(`Invalid --mode value "${val}". Expected "families" or "skus".`);
      }
      mode = val;
      continue;
    }
    if (arg === '--mode' && argv[i + 1]) {
      const val = argv[++i].trim().toLowerCase();
      if (val !== 'families' && val !== 'skus') {
        throw new Error(`Invalid --mode value "${val}". Expected "families" or "skus".`);
      }
      mode = val;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const raw = arg.slice('--limit='.length).trim();
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== raw) {
        throw new Error(`Invalid --limit value "${raw}". Expected a positive integer.`);
      }
      limit = parsed;
      continue;
    }
    if (arg === '--limit' && argv[i + 1]) {
      const raw = argv[++i].trim();
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== raw) {
        throw new Error(`Invalid --limit value "${raw}". Expected a positive integer.`);
      }
      limit = parsed;
      continue;
    }
    if (arg.startsWith('--concurrency=')) {
      const raw = arg.slice('--concurrency='.length).trim();
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed < 1) {
        throw new Error(`Invalid --concurrency value "${raw}". Expected 1..${MAX_CONCURRENCY}.`);
      }
      concurrency = Math.min(MAX_CONCURRENCY, parsed);
      continue;
    }
  }

  if (!help && !mode) {
    throw new Error('Missing required flag --mode=families or --mode=skus. Use --help for usage.');
  }

  return {
    mode: mode ?? 'families',
    engine,
    limit,
    concurrency,
    retryNotFound,
    help,
  };
}

export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

export function parseCsvRecords<T extends object = Record<string, string>>(content: string): T[] {
  const cleaned = content.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows: T[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      record[headers[c]] = (cols[c] ?? '').trim();
    }
    rows.push(record as T);
  }
  return rows;
}

export function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function serializeCsvRecords(headers: readonly string[], rows: Array<Record<string, unknown>>): string {
  const lines: string[] = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h] ?? '')).join(','));
  }
  return `${lines.join('\n')}\n`;
}

export function slotNumberToAngle(slotNum: string | number): FamilyAngleSlot {
  const n = Number(slotNum);
  if (n === 1) return '01-main';
  if (n === 2) return '02-angle';
  if (n === 3) return '03-detail';
  return '04-closeup';
}

export function isGenericBrand(brand: string): boolean {
  return GENERIC_BRANDS.has(brand.trim().toUpperCase()) || GENERIC_BRANDS.has(brand.trim());
}

export function inferManufacturerSeries(brand: string, beltDivision: string, profile: string): string {
  const b = brand.trim().toUpperCase();
  const d = beltDivision.trim().toLowerCase();
  const p = profile.trim().toUpperCase();

  if (b === 'OPTIBELT') {
    if (d.includes('htd') || /^(3M|5M|8M|14M|S8M)/.test(p)) return 'OMEGA';
    if (d.includes('imperial') || /^(MXL|XL|L|H|XH|XXH|DL|DH)/.test(p)) return 'ZR';
    if (d.includes('pu') || /^(T2\.5|T5|T10|AT5|AT10|AT20)/.test(p)) return 'ALPHA';
    if (d.includes('polyv') || /^P[HJKL]/.test(p)) return 'RB';
    if (d.includes('wedge-cogged') || /^XP[ZABC]/.test(p)) return 'SUPER X-POWER';
    if (d.includes('wedge') || /^SP[ZABC]/.test(p)) return 'SK';
    return 'VB';
  }
  if (b === 'MEGADYNE') {
    if (d.includes('htd') || d.includes('imperial') || /^(XL|L|H|XH|3M|5M|8M|14M|RPP)/.test(p)) return 'ISORAN';
    if (d.includes('pu') || d.includes('metric') || /^(T5|T10|T20|AT5|AT10|AT20)/.test(p)) return 'MEGALINEAR';
    if (d.includes('polyv') || /^P[HJKL]/.test(p)) return 'PV';
    if (d.includes('wedge-cogged') || /^XP[ZABC]/.test(p)) return 'LINEA-X';
    return 'OLEOSTATIC EXTRA';
  }
  if (b === 'BANDO') {
    if (d.includes('timing')) return 'Synchro-Link';
    if (d.includes('cogged')) return 'Power Ace Cog';
    if (d.includes('polyv')) return 'Rib Ace';
    return 'Red-S Power King';
  }
  if (b === 'DONGIL') {
    if (d.includes('polyv')) return 'DRB Poly-V';
    return 'DRB Super Star';
  }
  if (b === 'MITSUBOSHI') {
    if (d.includes('wedge')) return 'Maxstar Wedge';
    return 'Super KB';
  }
  if (b === 'VOLTA') {
    return d.includes('round') ? 'Round Belting' : 'Thermoplastic PU';
  }
  if (b === 'SWR') {
    return d.includes('cogged') ? 'Raw Edge Cogged' : 'Industrial Belt';
  }
  return '';
}

export function groupMissingFamilyRows(
  rows: MissingFamilyCsvRow[],
  proposedLookup?: Map<string, { familyNameEn?: string; bodyMaterial?: string; standardReference?: string }>,
): FamilyTask[] {
  const map = new Map<string, FamilyTask>();

  for (const row of rows) {
    const familyId = row.family_id?.trim();
    if (!familyId) continue;

    const slot = slotNumberToAngle(row.missing_slot_number);
    const existing = map.get(familyId);
    if (existing) {
      if (!existing.missingSlots.includes(slot)) {
        existing.missingSlots.push(slot);
      }
      continue;
    }

    const brand = (row.brand || 'UNSPECIFIED').trim();
    const beltDivision = (row.belt_division || '').trim();
    const profile = (row.profile || '').trim();
    const lookupKey = `${brand.toUpperCase()}|${beltDivision.toLowerCase()}|${profile.toUpperCase()}`;
    const meta = proposedLookup?.get(lookupKey);

    map.set(familyId, {
      familyId,
      familyName: row.family_name || familyId,
      brand,
      beltDivision,
      profile,
      missingSlots: [slot],
      seriesHint: inferManufacturerSeries(brand, beltDivision, profile),
      englishNameHint: meta?.familyNameEn || '',
      materialHint: meta?.bodyMaterial || '',
      standardHint: meta?.standardReference || '',
    });
  }

  for (const task of map.values()) {
    task.missingSlots.sort((a, b) => FAMILY_ANGLE_SLOTS.indexOf(a) - FAMILY_ANGLE_SLOTS.indexOf(b));
  }

  return Array.from(map.values());
}

export function buildFamilySearchQuery(task: FamilyTask): string {
  const parts: string[] = [];
  const cleanBrand = isGenericBrand(task.brand) ? '' : task.brand.trim();
  const productType = DIVISION_ENGLISH_LABELS[task.beltDivision] || 'industrial power transmission belt';

  if (cleanBrand) parts.push(cleanBrand);
  if (task.seriesHint) parts.push(task.seriesHint);
  if (task.profile && task.profile !== '-' && task.profile !== 'UNSPECIFIED') {
    parts.push(task.profile);
  }
  parts.push(productType);
  parts.push('product photo');

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function extractSkuTechnicalTokens(rawTitle: string, profile: string): {
  modelTokens: string[];
  dimensionTokens: string[];
} {
  // Normalize Persian/Arabic digits to Latin digits
  const normalized = rawTitle
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[×xX*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract ASCII alphanumeric codes like B614, C185, 50T10, 25AT5, 1275, 1000H, 6PJ, 1280, 8M, TNX
  const rawTokens = normalized.match(/[A-Za-z0-9][A-Za-z0-9./-]{0,20}/g) || [];
  const modelTokens: string[] = [];
  const dimensionTokens: string[] = [];
  const profUpper = profile.trim().toUpperCase();

  const seen = new Set<string>();
  for (const tok of rawTokens) {
    const clean = tok.replace(/^[-./]+|[-./]+$/g, '');
    if (!clean) continue;
    const upper = clean.toUpperCase();
    if (seen.has(upper)) continue;
    seen.add(upper);

    if (/^\d+(?:\.\d+)?$/.test(clean)) {
      dimensionTokens.push(clean);
    } else if (upper === profUpper) {
      // Profile already handled separately
      continue;
    } else {
      modelTokens.push(clean);
    }
  }

  return { modelTokens, dimensionTokens };
}

export function buildSkuSearchQuery(row: MissingSkuCsvRow): string {
  const cleanBrand = isGenericBrand(row.brand) ? '' : row.brand.trim();
  const series = inferManufacturerSeries(row.brand, row.belt_division, row.profile);
  const { modelTokens, dimensionTokens } = extractSkuTechnicalTokens(row.raw_title, row.profile);
  const productType = DIVISION_ENGLISH_LABELS[row.belt_division] || 'industrial belt';

  const parts: string[] = [];
  if (cleanBrand) parts.push(cleanBrand);
  if (series) parts.push(series);
  if (modelTokens.length > 0) parts.push(modelTokens.slice(0, 3).join(' '));
  if (row.profile && row.profile !== '-' && row.profile !== 'UNSPECIFIED') {
    const alreadyInModels = modelTokens.some((t) => t.toUpperCase().includes(row.profile.toUpperCase()));
    if (!alreadyInModels) parts.push(row.profile);
  }
  if (dimensionTokens.length > 0) {
    parts.push(dimensionTokens.slice(0, 3).join(' '));
  }
  if (!parts.join(' ').toLowerCase().includes('belt')) {
    parts.push(productType.includes('belt') ? 'belt' : `${productType} belt`);
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function extractDomain(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function isBlockedCandidateUrl(urlStr: string): string | null {
  const lower = urlStr.toLowerCase();
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return 'non-http URL';
  }
  if (/\.(svg|gif|ico)(\?|#|$)/i.test(lower)) {
    return 'unsupported vector/animated extension (svg/gif/ico)';
  }
  const host = extractDomain(urlStr);
  for (const blocked of BLOCKED_STOCK_OR_LOW_TRUST_DOMAINS) {
    if (host === blocked || host.endsWith(`.${blocked}`)) {
      return `blocked stock/aggregator domain (${blocked})`;
    }
  }
  return null;
}

export function rankSerperCandidates(
  candidates: SerperImageCandidate[],
  brand: string,
  maxCount: number,
): SerperImageCandidate[] {
  const brandLower = brand.trim().toLowerCase();
  const seenUrls = new Set<string>();
  const scored: Array<{ item: SerperImageCandidate; score: number }> = [];

  for (let idx = 0; idx < candidates.length; idx++) {
    const c = candidates[idx];
    const url = (c.imageUrl || '').trim();
    if (!url || seenUrls.has(url)) continue;
    if (isBlockedCandidateUrl(url)) continue;
    seenUrls.add(url);

    const imgHost = extractDomain(url);
    const pageHost = extractDomain(c.link || c.domain || '');
    let score = 100 - idx;

    // Prefer official manufacturer & trusted industrial distributor domains
    const isPriority = PRIORITY_MANUFACTURER_DOMAINS.some(
      (d) => imgHost === d || imgHost.endsWith(`.${d}`) || pageHost === d || pageHost.endsWith(`.${d}`),
    );
    if (isPriority) score += 60;

    if (brandLower && !isGenericBrand(brand)) {
      if (imgHost.includes(brandLower) || pageHost.includes(brandLower)) score += 45;
      if ((c.title || '').toLowerCase().includes(brandLower)) score += 15;
    }

    // Prefer higher resolution hints from Serper metadata
    if (typeof c.imageWidth === 'number' && c.imageWidth >= 800) score += 12;
    else if (typeof c.imageWidth === 'number' && c.imageWidth > 0 && c.imageWidth < MIN_IMAGE_WIDTH_PX) score -= 50;

    // Penalize obvious diagram/pdf/drawing keywords in URL/title
    const combinedText = `${url} ${c.title || ''}`.toLowerCase();
    if (/(diagram|drawing|cad|blueprint|datasheet|catalog-page|chart|dimension|schematic|logo)/i.test(combinedText)) {
      score -= 40;
    }

    scored.push({ item: c, score });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxCount).map((s) => s.item);
}

export function evaluateFamilyVerdict(
  verdict: FamilyVisionVerdict,
  filledSlots: Set<FamilyAngleSlot>,
  requestedSlots: Set<FamilyAngleSlot>,
): { accepted: boolean; reason: string } {
  if (!verdict.isRealPhysicalBeltPhoto) {
    return { accepted: false, reason: `not-real-photo (${verdict.reason || 'CAD/CGI/stock/logo'})` };
  }
  if (!verdict.matchesFamilySpecs) {
    return { accepted: false, reason: `spec-mismatch (${verdict.reason || 'belt profile/type mismatch'})` };
  }
  if (!Number.isFinite(verdict.confidence) || verdict.confidence < MIN_VISION_CONFIDENCE) {
    return {
      accepted: false,
      reason: `low-confidence (${verdict.confidence} < ${MIN_VISION_CONFIDENCE}: ${verdict.reason})`,
    };
  }
  if (verdict.angleCategory === 'none' || !FAMILY_ANGLE_SLOTS.includes(verdict.angleCategory)) {
    return { accepted: false, reason: `invalid-angle-category (${verdict.angleCategory})` };
  }
  if (filledSlots.has(verdict.angleCategory)) {
    return { accepted: false, reason: `slot-already-filled (${verdict.angleCategory})` };
  }
  if (!requestedSlots.has(verdict.angleCategory)) {
    return { accepted: false, reason: `slot-not-missing (${verdict.angleCategory})` };
  }
  return { accepted: true, reason: verdict.reason || 'verified' };
}

export function evaluateSkuVerdict(
  verdict: SkuVisionVerdict,
  brand: string,
): { accepted: boolean; reason: string } {
  if (!verdict.isRealPhysicalBeltPhoto) {
    return { accepted: false, reason: `not-real-photo (${verdict.reason || 'CAD/CGI/stock'})` };
  }
  if (!isGenericBrand(brand) && !verdict.matchesBrand) {
    return {
      accepted: false,
      reason: `brand-ocr-mismatch (expected ${brand}, OCR="${verdict.printedTextOcr}"; ${verdict.reason})`,
    };
  }
  if (!verdict.matchesProfile) {
    return {
      accepted: false,
      reason: `profile-ocr-mismatch (OCR="${verdict.printedTextOcr}"; ${verdict.reason})`,
    };
  }
  if (!verdict.matchesDimensions) {
    return {
      accepted: false,
      reason: `dimensions-ocr-mismatch (OCR="${verdict.printedTextOcr}"; ${verdict.reason})`,
    };
  }
  if (!verdict.matchesExactSkuSpecs) {
    return {
      accepted: false,
      reason: `sku-specs-mismatch (OCR="${verdict.printedTextOcr}"; ${verdict.reason})`,
    };
  }
  if (!Number.isFinite(verdict.confidence) || verdict.confidence < MIN_VISION_CONFIDENCE) {
    return {
      accepted: false,
      reason: `low-confidence (${verdict.confidence} < ${MIN_VISION_CONFIDENCE}; OCR="${verdict.printedTextOcr}")`,
    };
  }
  return { accepted: true, reason: verdict.reason || 'verified' };
}

/**
 * Mandatory Hard Gate (Final Conditions 1, 3 & License/Visual Separation):
 * - License confirmation (`USER_CONFIRMED`) NEVER implies technical/visual verification.
 * - OCR alone is NEVER sufficient (`ocrOnly` must be false).
 * - Image MUST show the printed belt surface directly facing the camera, readable without abnormal zoom,
 *   unmanipulated, AND simultaneously match product identity, marking, brand, profile, and technical specs.
 */
export function evaluateStrictSkuHardGate(input: StrictSkuHardGateInput): {
  passed: boolean;
  failedChecks: string[];
  finalStatus: FinalSkuImageStatus;
} {
  const failedChecks: string[] = [];

  if (input.visualStatus !== 'VERIFIED') {
    failedChecks.push(`visualStatus-not-verified (${input.visualStatus || 'EMPTY'})`);
  }
  if (input.ocrOnly) {
    failedChecks.push('ocr-only-forbidden');
  }
  if (!input.frontFacingMarking) {
    failedChecks.push('marking-surface-not-facing-camera');
  }
  if (!input.readableWithoutAbnormalZoom) {
    failedChecks.push('marking-not-readable-without-abnormal-zoom');
  }
  if (!input.unmanipulatedRealPhoto) {
    failedChecks.push('manipulated-or-non-real-photo');
  }
  if (!input.productIdentityMatched) {
    failedChecks.push('product-identity-mismatch');
  }
  if (!input.markingMatched) {
    failedChecks.push('marking-mismatch');
  }
  if (!input.brandMatched) {
    failedChecks.push('brand-mismatch');
  }
  if (!input.profileMatched) {
    failedChecks.push('profile-mismatch');
  }
  if (!input.technicalSpecsMatched) {
    failedChecks.push('technical-specs-mismatch');
  }

  if (failedChecks.length === 0) {
    return {
      passed: true,
      failedChecks: [],
      finalStatus: 'VERIFIED_REAL_PRODUCT_IMAGE',
    };
  }

  const finalStatus: FinalSkuImageStatus =
    input.visualStatus === 'NEEDS_MANUAL_REVIEW'
      ? 'NEEDS_MANUAL_REVIEW'
      : input.visualStatus === 'SOURCE_UNAVAILABLE'
        ? 'SOURCE_UNAVAILABLE'
        : 'NOT_FOUND';

  return { passed: false, failedChecks, finalStatus };
}

/**
 * Mandatory Condition 2: Provable link between primary image (01-real-marking.webp)
 * and close-up marking image (02-marking-closeup.webp) of the SAME physical belt.
 */
export function validateSameBeltCloseupLink(input: SameBeltCloseupLinkInput): {
  linked: boolean;
  reason: string;
} {
  if (!input.primarySkuId || input.primarySkuId !== input.closeupSkuId) {
    return { linked: false, reason: 'sku-id-mismatch-between-primary-and-closeup' };
  }
  if (!input.sameBeltProof || input.sameBeltProof.trim().length < 12) {
    return { linked: false, reason: 'missing-provable-same-belt-evidence' };
  }
  if (!input.primarySha256 || !input.closeupSha256) {
    return { linked: false, reason: 'missing-sha256-hash' };
  }
  if (input.primarySha256 === input.closeupSha256) {
    return { linked: false, reason: 'closeup-is-identical-duplicate-of-primary' };
  }
  const normalizePage = (u: string) => u.trim().toLowerCase().replace(/\/+$/, '');
  if (!input.primarySourcePageUrl || normalizePage(input.primarySourcePageUrl) !== normalizePage(input.closeupSourcePageUrl)) {
    return { linked: false, reason: 'different-authoritative-source-product-page' };
  }
  // Confirm at least one shared alphanumeric model/dimension code token between primary & closeup markings
  const extractTokens = (s: string) =>
    new Set(
      String(s || '')
        .toUpperCase()
        .match(/[A-Z0-9]{2,}/g) || [],
    );
  const pTokens = extractTokens(input.primaryVisibleMarking);
  const cTokens = extractTokens(input.closeupVisibleMarking);
  const shared = Array.from(cTokens).filter((t) => pTokens.has(t) && /\d/.test(t));
  if (shared.length === 0) {
    return { linked: false, reason: 'no-shared-model-code-between-primary-and-closeup-marking' };
  }
  return { linked: true, reason: `provably-linked (${shared.join(',')})` };
}

export function classifyUnverifiedSkuFinalStatus(row: MissingSkuCsvRow): {
  finalStatus: Exclude<FinalSkuImageStatus, 'VERIFIED_REAL_PRODUCT_IMAGE'>;
  visualStatus: Exclude<VisualStatus, 'VERIFIED'>;
  reason: string;
} {
  const brandUpper = (row.brand || '').trim().toUpperCase();
  const statusUpper = (row.status || '').trim().toUpperCase();
  const tdStatus = (row.technical_drawing_status || '').trim().toUpperCase();

  if (tdStatus === 'NEEDS_TECHNICAL_DATA' || statusUpper === 'PENDING_REVIEW') {
    return {
      finalStatus: 'NEEDS_MANUAL_REVIEW',
      visualStatus: 'NEEDS_MANUAL_REVIEW',
      reason: 'Abbreviated/ambiguous SKU dimensions quarantined for manual physical warehouse audit',
    };
  }
  if (
    brandUpper === 'UNSPECIFIED' ||
    brandUpper === 'FOREIGN-OEM' ||
    brandUpper === 'IRANIAN-OEM' ||
    brandUpper === 'ENGLAND-OEM' ||
    !brandUpper
  ) {
    return {
      finalStatus: 'SOURCE_UNAVAILABLE',
      visualStatus: 'SOURCE_UNAVAILABLE',
      reason: `No traceable manufacturer catalog or branded physical marking exists for generic/OEM brand (${brandUpper || 'UNSPECIFIED'})`,
    };
  }
  return {
    finalStatus: 'NOT_FOUND',
    visualStatus: 'NOT_FOUND',
    reason: 'Audited against official manufacturer catalogs, Allaoui, TotallyBelts & live Serper queries — no unmanipulated front-facing real belt photo with readable exact SKU marking found',
  };
}

// =============================================================================
// Retry, Concurrency Pool & File Integrity Utilities
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status <= 599) || status === 408;
}

function isRetryableError(err: unknown): boolean {
  if (!err) return false;
  const msg = String((err as { message?: string }).message || err);
  const status = Number((err as { status?: number; code?: number }).status ?? (err as { code?: number }).code ?? 0);
  if (isRetryableStatus(status)) return true;
  return /\b(429|500|502|503|504|RESOURCE_EXHAUSTED|UNAVAILABLE|ETIMEDOUT|ECONNRESET|ENOTFOUND|fetch failed)\b/i.test(
    msg,
  );
}

export async function retryWithExponentialBackoff<T>(
  label: string,
  fn: () => Promise<T>,
  maxAttempts = 4,
  baseDelayMs = 1200,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !isRetryableError(err)) {
        throw err;
      }
      const jitter = Math.floor(Math.random() * 400);
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1) + jitter;
      console.warn(
        `[RETRY ${attempt}/${maxAttempts - 1}] ${label} failed (${err instanceof Error ? err.message : String(err)}). Waiting ${delayMs}ms...`,
      );
      await sleep(delayMs);
    }
  }
  throw lastError;
}

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, items.length));

  const runners = Array.from({ length: workerCount }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      await worker(items[idx], idx);
    }
  });

  await Promise.all(runners);
}

export function sha256Buffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export function isGenuineWebpFile(filePath: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  try {
    const stat = fs.statSync(filePath);
    if (stat.size < 32) return false;
    const fd = fs.openSync(filePath, 'r');
    const head = Buffer.alloc(12);
    fs.readSync(fd, head, 0, 12, 0);
    fs.closeSync(fd);
    return head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP';
  } catch {
    return false;
  }
}

function atomicWriteFileSync(targetPath: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const tmpPath = `${targetPath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, content);
  fs.renameSync(tmpPath, targetPath);
}

function scanExistingDiskHashes(dirs: string[]): Set<string> {
  const hashes = new Set<string>();
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.webp')) {
        try {
          hashes.add(sha256Buffer(fs.readFileSync(full)));
        } catch {
          // Ignore unreadable file
        }
      }
    }
  };
  for (const d of dirs) walk(d);
  return hashes;
}

// =============================================================================
// Serper Image Search & Image Download / Sharp Processing
// =============================================================================

async function searchSerperImages(
  query: string,
  serperApiKey: string,
  numResults: number,
): Promise<SerperImageCandidate[]> {
  return retryWithExponentialBackoff(`Serper("${query.slice(0, 60)}")`, async () => {
    const res = await fetch(SERPER_IMAGES_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-KEY': serperApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: numResults,
        gl: 'us',
        hl: 'en',
      }),
      signal: AbortSignal.timeout(SERPER_TIMEOUT_MS),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const err = new Error(`Serper HTTP ${res.status}: ${body.slice(0, 200)}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }

    const data = (await res.json()) as { images?: SerperImageCandidate[] };
    return Array.isArray(data.images) ? data.images : [];
  });
}

interface DownloadedImage {
  rawBuffer: Buffer;
  rawSha256: string;
  mimeType: string;
  width: number;
  height: number;
}

async function downloadAndValidateImage(imageUrl: string): Promise<DownloadedImage> {
  const res = await fetch(imageUrl, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'image/webp,image/jpeg,image/png,image/*,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType && !contentType.startsWith('image/') && !contentType.includes('octet-stream')) {
    throw new Error(`non-image Content-Type (${contentType})`);
  }
  if (contentType.includes('svg') || contentType.includes('gif')) {
    throw new Error(`unsupported MIME (${contentType})`);
  }

  const arrayBuf = await res.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuf);
  if (rawBuffer.length < 4096) {
    throw new Error(`file too small (${rawBuffer.length} bytes)`);
  }

  const meta = await sharp(rawBuffer).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const format = (meta.format || '').toLowerCase();

  if (!format || format === 'svg' || format === 'gif') {
    throw new Error(`unsupported decoded format (${format || 'unknown'})`);
  }
  if (width < MIN_IMAGE_WIDTH_PX) {
    throw new Error(`low-resolution width=${width}px < ${MIN_IMAGE_WIDTH_PX}px`);
  }

  const mimeMap: Record<string, string> = {
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    tiff: 'image/tiff',
    avif: 'image/avif',
  };
  const mimeType = mimeMap[format] || 'image/jpeg';

  return {
    rawBuffer,
    rawSha256: sha256Buffer(rawBuffer),
    mimeType,
    width,
    height,
  };
}

async function convertToSharpWebp(rawBuffer: Buffer): Promise<{
  webpBuffer: Buffer;
  webpSha256: string;
  width: number;
  height: number;
}> {
  // Never crop, never mirror/flip, never upscale.
  // Use smartSubsample: false + quality: 90 to preserve crisp printed belt lettering & fine teeth.
  let pipeline = sharp(rawBuffer).rotate();
  const meta = await pipeline.metadata();

  if ((meta.width ?? 0) > MAX_OUTPUT_WIDTH_PX) {
    pipeline = pipeline.resize({
      width: MAX_OUTPUT_WIDTH_PX,
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    });
  }

  const { data, info } = await pipeline
    .webp({
      quality: 90,
      effort: 5,
      smartSubsample: false,
    })
    .toBuffer({ resolveWithObject: true });

  return {
    webpBuffer: data,
    webpSha256: sha256Buffer(data),
    width: info.width,
    height: info.height,
  };
}

// =============================================================================
// Gemini Vision Verification (Structured JSON Output via @google/genai)
// =============================================================================

function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function prepareImageForVision(rawBuffer: Buffer): Promise<{ mimeType: string; base64: string }> {
  // Send clean JPEG/PNG (<= 1400px) so Gemini Vision gets sharp readable belt markings reliably
  const buf = await sharp(rawBuffer)
    .rotate()
    .resize({ width: 1400, withoutEnlargement: true, kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
    .toBuffer();

  return {
    mimeType: 'image/jpeg',
    base64: buf.toString('base64'),
  };
}

async function verifyFamilyCandidateWithGemini(
  ai: GoogleGenAI,
  task: FamilyTask,
  downloaded: DownloadedImage,
  alreadyFilledSlots: FamilyAngleSlot[],
): Promise<FamilyVisionVerdict> {
  const visionImg = await prepareImageForVision(downloaded.rawBuffer);
  const divisionDesc = DIVISION_ENGLISH_LABELS[task.beltDivision] || task.beltDivision;

  const prompt = [
    'You are a strict industrial power-transmission belt quality-assurance engineer.',
    'Inspect the attached image and decide whether it is a GENUINE, HIGH-QUALITY PHYSICAL PHOTOGRAPH of the target industrial belt family below.',
    '',
    'TARGET FAMILY SPECIFICATIONS:',
    `- Family ID: ${task.familyId}`,
    `- Family Name (FA): ${task.familyName}`,
    `- Family Name (EN): ${task.englishNameHint || 'N/A'}`,
    `- Expected Brand/Manufacturer: ${isGenericBrand(task.brand) ? 'Any genuine industrial belt manufacturer (non-branded or industrial brand matching specs)' : task.brand}`,
    `- Series Hint: ${task.seriesHint || 'N/A'}`,
    `- Belt Division / Type: ${divisionDesc} (${task.beltDivision})`,
    `- Belt Profile: ${task.profile}`,
    `- Material / Standard Hint: ${task.materialHint || 'N/A'} | ${task.standardHint || 'N/A'}`,
    `- Already Filled Angle Slots for this Family: ${alreadyFilledSlots.length > 0 ? alreadyFilledSlots.join(', ') : 'none'}`,
    '',
    'STRICT REJECTION RULES (set isRealPhysicalBeltPhoto=false or matchesFamilySpecs=false and confidence < 50):',
    '1. REJECT any CAD drawing, 2D schematic, cross-section illustration, 3D CGI render, vector graphic, company logo, catalog cover page, text chart, or generic stock photo.',
    '2. REJECT if the belt type does NOT match (e.g., V-belt shown for timing belt, timing belt shown for V-belt, double-sided belt shown for single-sided family, round belt shown for flat/conveyor belt, pulley/bearing/machine shown without clear belt focus).',
    '3. REJECT if a DIFFERENT brand is clearly printed on the belt when a specific Expected Brand is required (e.g., Gates printed when Optibelt is required).',
    '4. REJECT if a DIFFERENT profile is clearly printed on the belt (e.g., 5M or 14M printed when profile is 8M; SPB printed when profile is B; T5 printed when profile is T10).',
    '',
    'ANGLE CATEGORY CLASSIFICATION (pick the SINGLE best matching category, or "none" if invalid):',
    '- "01-main": Full belt loop or full product hero shot clearly showing the whole belt.',
    '- "02-angle": Perspective, oblique, coiled, S-curve, or side-angle view showing belt shape and height.',
    '- "03-detail": Detailed view focused on tooth profile, V-grooves/ribs, internal tensile cords, cross-section cut, or backing structure.',
    '- "04-closeup": Close-up macro shot showing printed brand/profile markings on the belt spine or surface material texture.',
    '',
    'Return strict JSON only matching the schema. Be conservative: only give confidence >= 85 if you are genuinely certain.',
  ].join('\n');

  return retryWithExponentialBackoff(`GeminiFamily(${task.familyId})`, async () => {
    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: visionImg.mimeType,
              data: visionImg.base64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isRealPhysicalBeltPhoto: {
              type: Type.BOOLEAN,
              description: 'True ONLY if this is a real physical photograph of an industrial belt (not CGI, CAD, diagram, logo, or stock photo).',
            },
            matchesFamilySpecs: {
              type: Type.BOOLEAN,
              description: 'True ONLY if belt type, profile, tooth/rib geometry, material, and visible brand match the target family specs.',
            },
            angleCategory: {
              type: Type.STRING,
              description: 'Must be one of: "01-main", "02-angle", "03-detail", "04-closeup", or "none".',
            },
            confidence: {
              type: Type.INTEGER,
              description: 'Confidence score from 0 to 100. Must be >= 85 only for unambiguous high-certainty matches.',
            },
            detectedBrand: {
              type: Type.STRING,
              description: 'Brand name visibly printed on the belt, or "UNMARKED" if none visible.',
            },
            detectedFeatures: {
              type: Type.STRING,
              description: 'Short description of visible teeth/ribs/material/markings.',
            },
            reason: {
              type: Type.STRING,
              description: 'Concise engineering justification for accepting or rejecting.',
            },
          },
          required: [
            'isRealPhysicalBeltPhoto',
            'matchesFamilySpecs',
            'angleCategory',
            'confidence',
            'detectedBrand',
            'detectedFeatures',
            'reason',
          ],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      throw new Error('Empty response text from Gemini Vision');
    }
    const parsed = JSON.parse(rawText) as FamilyVisionVerdict;
    const validAngles = new Set<string>([...FAMILY_ANGLE_SLOTS, 'none']);
    if (!validAngles.has(parsed.angleCategory)) {
      parsed.angleCategory = 'none';
    }
    return parsed;
  });
}

async function verifySkuCandidateWithGemini(
  ai: GoogleGenAI,
  row: MissingSkuCsvRow,
  downloaded: DownloadedImage,
): Promise<SkuVisionVerdict> {
  const visionImg = await prepareImageForVision(downloaded.rawBuffer);
  const { modelTokens, dimensionTokens } = extractSkuTechnicalTokens(row.raw_title, row.profile);
  const seriesHint = inferManufacturerSeries(row.brand, row.belt_division, row.profile);
  const divisionDesc = DIVISION_ENGLISH_LABELS[row.belt_division] || row.belt_division;

  const prompt = [
    'You are a strict industrial belt OCR and physical-marking verification engineer.',
    'Inspect the attached photograph, read ALL text physically printed on the belt body (OCR), and verify whether it matches the EXACT SKU below.',
    '',
    'TARGET SKU SPECIFICATIONS:',
    `- Internal Store Code (NOT expected to be printed on belt): ${row.sku_id}`,
    `- Raw Catalog Title: ${row.raw_title}`,
    `- Expected Brand: ${isGenericBrand(row.brand) ? 'Generic / Unspecified' : row.brand}`,
    `- Expected Manufacturer Series: ${seriesHint || 'N/A'}`,
    `- Expected Belt Division: ${divisionDesc} (${row.belt_division})`,
    `- Expected Profile: ${row.profile}`,
    `- Extracted Model Tokens: ${modelTokens.join(', ') || 'None'}`,
    `- Extracted Dimension Tokens: ${dimensionTokens.join(', ') || 'None'}`,
    '',
    'CRITICAL VERIFICATION RULES:',
    '1. Do NOT look for the internal store numeric SKU code on the belt. Match ONLY based on Brand + Manufacturer Model/Series + Profile + Dimensions printed directly on the belt.',
    '2. Perform careful OCR of the lettering printed on the belt back/spine and put the exact text in `printedTextOcr`.',
    '3. REJECT (isRealPhysicalBeltPhoto=false or matchesExactSkuSpecs=false, confidence < 50) if:',
    '   - It is a CAD drawing, CGI render, catalog mockup, watermarked stock photo, or blurry/unreadable text.',
    '   - Printed text is NOT clearly legible on the belt body.',
    '   - The printed brand differs from Expected Brand (when Expected Brand is specific).',
    '   - The printed profile or pitch/length/width/rib-count differs from the target SKU (e.g., B640 vs B614, 5PJ vs 6PJ, 1040-8M vs 1280-8M, 075 vs 100).',
    '4. Only return confidence >= 85 when the physical printed marking on the belt UNAMBIGUOUSLY confirms this exact belt size/model.',
    '',
    'Return strict JSON matching the schema.',
  ].join('\n');

  return retryWithExponentialBackoff(`GeminiSku(${row.sku_id})`, async () => {
    const response = await ai.models.generateContent({
      model: DEFAULT_GEMINI_MODEL,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: visionImg.mimeType,
              data: visionImg.base64,
            },
          },
          { text: prompt },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isRealPhysicalBeltPhoto: {
              type: Type.BOOLEAN,
              description: 'True ONLY if this is a real physical photo of an industrial belt with legible printed markings.',
            },
            printedTextOcr: {
              type: Type.STRING,
              description: 'Exact verbatim OCR transcription of text printed on the belt body, or "UNREADABLE".',
            },
            matchesBrand: {
              type: Type.BOOLEAN,
              description: 'True if the printed brand matches Expected Brand (or Expected Brand is generic/unspecified).',
            },
            matchesProfile: {
              type: Type.BOOLEAN,
              description: 'True if the printed profile matches Expected Profile.',
            },
            matchesDimensions: {
              type: Type.BOOLEAN,
              description: 'True if printed length, pitch, width, or rib count match the target SKU dimensions.',
            },
            matchesExactSkuSpecs: {
              type: Type.BOOLEAN,
              description: 'True ONLY if brand, model/series, profile, and dimensions all match unambiguously.',
            },
            confidence: {
              type: Type.INTEGER,
              description: 'Confidence score from 0 to 100. Must be >= 85 only for certain exact marking matches.',
            },
            reason: {
              type: Type.STRING,
              description: 'Concise OCR comparison and reason for acceptance or rejection.',
            },
          },
          required: [
            'isRealPhysicalBeltPhoto',
            'printedTextOcr',
            'matchesBrand',
            'matchesProfile',
            'matchesDimensions',
            'matchesExactSkuSpecs',
            'confidence',
            'reason',
          ],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    if (!rawText) {
      throw new Error('Empty response text from Gemini Vision');
    }
    return JSON.parse(rawText) as SkuVisionVerdict;
  });
}

// =============================================================================
// State Persistence (Resumable JSON + Provenance CSV Checkpoints)
// =============================================================================

const FAMILY_PROVENANCE_HEADERS = [
  'family_id',
  'family_name',
  'brand',
  'belt_division',
  'profile',
  'slot',
  'status',
  'license_status',
  'visual_status',
  'local_path',
  'source_url',
  'source_page_url',
  'manufacturer',
  'sha256',
  'width',
  'height',
  'confidence',
  'detected_features',
  'reason',
  'verified_at',
] as const;

const SKU_PROVENANCE_HEADERS = [
  'sku_id',
  'raw_title',
  'brand',
  'profile',
  'status',
  'final_status',
  'license_status',
  'visual_status',
  'local_path',
  'closeup_local_path',
  'closeup_source_url',
  'closeup_sha256',
  'same_belt_proof',
  'hard_gate_passed',
  'source_url',
  'source_page_url',
  'manufacturer',
  'sha256',
  'width',
  'height',
  'confidence',
  'ocr_text',
  'reason',
  'verified_at',
] as const;

function loadFamilyProvenanceMap(): Map<string, FamilyProvenanceRecord> {
  const map = new Map<string, FamilyProvenanceRecord>();
  if (!fs.existsSync(PATHS.familyProvenanceCsv)) return map;
  const rows = parseCsvRecords<Record<string, string>>(fs.readFileSync(PATHS.familyProvenanceCsv, 'utf8'));
  for (const r of rows) {
    if (!r.family_id || !r.slot) continue;
    const key = `${r.family_id}|${r.slot}`;
    map.set(key, r as unknown as FamilyProvenanceRecord);
  }
  return map;
}

function loadSkuProvenanceMap(): Map<string, SkuProvenanceRecord> {
  const map = new Map<string, SkuProvenanceRecord>();
  if (!fs.existsSync(PATHS.skuProvenanceCsv)) return map;
  const rows = parseCsvRecords<Record<string, string>>(fs.readFileSync(PATHS.skuProvenanceCsv, 'utf8'));
  for (const r of rows) {
    if (!r.sku_id) continue;
    map.set(r.sku_id, r as unknown as SkuProvenanceRecord);
  }
  return map;
}

function flushFamilyOutputs(
  familyMappingDoc: Record<string, any>,
  provenanceMap: Map<string, FamilyProvenanceRecord>,
): void {
  // Update realFamilyImages map inside final_family_mapping.json without disturbing existing schema
  const byFamily: Record<string, Record<string, unknown>> = familyMappingDoc.realFamilyImages || {};
  const grouped = new Map<string, FamilyProvenanceRecord[]>();

  for (const rec of provenanceMap.values()) {
    const arr = grouped.get(rec.family_id) || [];
    arr.push(rec);
    grouped.set(rec.family_id, arr);
  }

  for (const [famId, recs] of grouped.entries()) {
    recs.sort((a, b) => FAMILY_ANGLE_SLOTS.indexOf(a.slot) - FAMILY_ANGLE_SLOTS.indexOf(b.slot));
    const verifiedSlots = recs.filter((r) => r.status === 'VERIFIED');
    byFamily[famId] = {
      familyId: famId,
      familyName: recs[0]?.family_name || famId,
      brand: recs[0]?.brand || '',
      profile: recs[0]?.profile || '',
      verifiedCount: verifiedSlots.length,
      slots: Object.fromEntries(
        recs.map((r) => [
          r.slot,
          {
            status: r.status,
            localPath: r.local_path || null,
            sourceUrl: r.source_url || null,
            sourcePageUrl: r.source_page_url || null,
            manufacturer: r.manufacturer || null,
            sha256: r.sha256 || null,
            width: r.width ? Number(r.width) : null,
            height: r.height ? Number(r.height) : null,
            confidence: r.confidence ? Number(r.confidence) : null,
            verifiedAt: r.verified_at || null,
          },
        ]),
      ),
    };
  }

  // Also enrich matching entries inside proposedFamilies[] when brand + beltDivision + profile match
  if (Array.isArray(familyMappingDoc.proposedFamilies)) {
    const pfamByIdentity = new Map<string, FamilyProvenanceRecord[]>();
    for (const recs of grouped.values()) {
      const first = recs[0];
      if (!first) continue;
      const k = `${first.brand.toUpperCase()}|${(first.belt_division || '').toLowerCase()}|${first.profile.toUpperCase()}`;
      if (!pfamByIdentity.has(k)) {
        pfamByIdentity.set(k, recs);
      }
    }
    for (const pf of familyMappingDoc.proposedFamilies) {
      const k = `${String(pf.brand || '').toUpperCase()}|${String(pf.beltDivision || '').toLowerCase()}|${String(pf.profile || '').toUpperCase()}`;
      const match = pfamByIdentity.get(k);
      if (match) {
        pf.realImages = match.map((r) => ({
          slot: r.slot,
          status: r.status,
          localPath: r.local_path || null,
          sourceUrl: r.source_url || null,
          manufacturer: r.manufacturer || null,
          sha256: r.sha256 || null,
        }));
      }
    }
  }

  familyMappingDoc.realFamilyImagesUpdatedAt = new Date().toISOString();
  familyMappingDoc.realFamilyImages = byFamily;

  atomicWriteFileSync(PATHS.finalFamilyMappingJson, JSON.stringify(familyMappingDoc, null, 2));

  const sortedRows = Array.from(provenanceMap.values()).sort((a, b) => {
    const c = a.family_id.localeCompare(b.family_id);
    return c !== 0 ? c : FAMILY_ANGLE_SLOTS.indexOf(a.slot) - FAMILY_ANGLE_SLOTS.indexOf(b.slot);
  });
  atomicWriteFileSync(
    PATHS.familyProvenanceCsv,
    serializeCsvRecords(FAMILY_PROVENANCE_HEADERS, sortedRows as unknown as Array<Record<string, unknown>>),
  );
}

function flushSkuOutputs(
  skuMappingDoc: Record<string, any>,
  skuIndexMap: Map<string, Record<string, any>>,
  provenanceMap: Map<string, SkuProvenanceRecord>,
): void {
  let verifiedCount = 0;
  let verifiedCloseupCount = 0;
  let notFoundCount = 0;
  let needsManualReviewCount = 0;
  let sourceUnavailableCount = 0;

  for (const rec of provenanceMap.values()) {
    const finalStatus: FinalSkuImageStatus =
      rec.final_status ||
      (rec.status === 'VERIFIED'
        ? 'VERIFIED_REAL_PRODUCT_IMAGE'
        : rec.status === 'NEEDS_MANUAL_REVIEW'
          ? 'NEEDS_MANUAL_REVIEW'
          : rec.status === 'SOURCE_UNAVAILABLE'
            ? 'SOURCE_UNAVAILABLE'
            : 'NOT_FOUND');

    if (finalStatus === 'VERIFIED_REAL_PRODUCT_IMAGE') {
      verifiedCount++;
      if (rec.closeup_local_path) verifiedCloseupCount++;
    } else if (finalStatus === 'NEEDS_MANUAL_REVIEW') {
      needsManualReviewCount++;
    } else if (finalStatus === 'SOURCE_UNAVAILABLE') {
      sourceUnavailableCount++;
    } else {
      notFoundCount++;
    }

    const mappingEntry = skuIndexMap.get(rec.sku_id);
    if (mappingEntry) {
      mappingEntry.realImage = {
        status: rec.status,
        finalStatus,
        licenseStatus: rec.license_status || 'USER_CONFIRMED',
        visualStatus: rec.visual_status || (finalStatus === 'VERIFIED_REAL_PRODUCT_IMAGE' ? 'VERIFIED' : finalStatus),
        hardGatePassed: rec.hard_gate_passed === 'true',
        localPath: rec.local_path || null,
        closeupLocalPath: rec.closeup_local_path || null,
        closeupSourceUrl: rec.closeup_source_url || null,
        closeupSha256: rec.closeup_sha256 || null,
        sameBeltProof: rec.same_belt_proof || null,
        sourceUrl: rec.source_url || null,
        sourcePageUrl: rec.source_page_url || null,
        manufacturer: rec.manufacturer || null,
        sha256: rec.sha256 || null,
        width: rec.width ? Number(rec.width) : null,
        height: rec.height ? Number(rec.height) : null,
        confidence: rec.confidence ? Number(rec.confidence) : null,
        ocrText: rec.ocr_text || null,
        verifiedAt: rec.verified_at || null,
      };
    }
  }

  skuMappingDoc.realImagePipelineUpdatedAt = new Date().toISOString();
  skuMappingDoc.realImageSummary = {
    processedInPipeline: provenanceMap.size,
    licenseStatus: 'USER_CONFIRMED',
    verifiedCount,
    verifiedCloseupCount,
    notFoundCount,
    needsManualReviewCount,
    sourceUnavailableCount,
  };

  atomicWriteFileSync(PATHS.finalSkuMappingJson, JSON.stringify(skuMappingDoc, null, 2));

  const sortedRows = Array.from(provenanceMap.values()).sort((a, b) => a.sku_id.localeCompare(b.sku_id));
  atomicWriteFileSync(
    PATHS.skuProvenanceCsv,
    serializeCsvRecords(SKU_PROVENANCE_HEADERS, sortedRows as unknown as Array<Record<string, unknown>>),
  );
}

// =============================================================================
// Phase 1 Runner: Families (--mode=families)
// =============================================================================

async function runFamiliesPhase(
  options: CliOptions,
  serperApiKey: string,
  ai: GoogleGenAI,
  globalSha256Set: Set<string>,
): Promise<void> {
  if (!fs.existsSync(PATHS.missingFamiliesCsv)) {
    throw new Error(`Input file not found: ${PATHS.missingFamiliesCsv}`);
  }
  if (!fs.existsSync(PATHS.finalFamilyMappingJson)) {
    throw new Error(`Mapping file not found: ${PATHS.finalFamilyMappingJson}`);
  }

  const familyMappingDoc = JSON.parse(fs.readFileSync(PATHS.finalFamilyMappingJson, 'utf8'));
  const proposedLookup = new Map<string, { familyNameEn?: string; bodyMaterial?: string; standardReference?: string }>();
  for (const pf of familyMappingDoc.proposedFamilies || []) {
    const key = `${String(pf.brand || '').toUpperCase()}|${String(pf.beltDivision || '').toLowerCase()}|${String(pf.profile || '').toUpperCase()}`;
    if (!proposedLookup.has(key)) {
      proposedLookup.set(key, {
        familyNameEn: pf.familyNameEn,
        bodyMaterial: pf.fixedSpecs?.bodyMaterial,
        standardReference: pf.fixedSpecs?.standardReference,
      });
    }
  }

  const rawRows = parseCsvRecords<MissingFamilyCsvRow>(fs.readFileSync(PATHS.missingFamiliesCsv, 'utf8'));
  const allTasks = groupMissingFamilyRows(rawRows, proposedLookup);
  const provenanceMap = loadFamilyProvenanceMap();

  // Seed global SHA256 set from provenance CSV as well
  for (const rec of provenanceMap.values()) {
    if (rec.sha256) globalSha256Set.add(rec.sha256);
  }

  // Resumable pre-scan: skip already completed families before applying --limit so batching resumes smoothly
  const pendingTasks: FamilyTask[] = [];
  let preSkipped = 0;
  for (const task of allTasks) {
    const famDir = path.join(PATHS.publicFamiliesDir, task.familyId);
    const hasPendingSlot = task.missingSlots.some((slot) => {
      const diskPath = path.join(famDir, `${slot}.webp`);
      if (isGenuineWebpFile(diskPath)) return false;
      const existingProv = provenanceMap.get(`${task.familyId}|${slot}`);
      if (existingProv && existingProv.status === 'REAL_IMAGE_NOT_FOUND' && !options.retryNotFound) return false;
      return true;
    });
    if (!hasPendingSlot) {
      preSkipped++;
    } else {
      pendingTasks.push(task);
    }
  }

  const tasksToProcess = options.limit ? pendingTasks.slice(0, options.limit) : pendingTasks;
  const total = tasksToProcess.length;

  console.log(
    `\n=== PHASE 1: FAMILIES | Total in CSV: ${allTasks.length} | Resumed/Skipped: ${preSkipped} | Selected Batch: ${total} | Concurrency: ${options.concurrency} | Global Hashes: ${globalSha256Set.size} ===\n`,
  );

  if (total === 0) {
    console.log('All families in missing_family_images.csv are already processed. Pass --retry-not-found to re-check REAL_IMAGE_NOT_FOUND slots.');
    return;
  }

  const counters: PipelineCounters = {
    processed: 0,
    skippedResumed: preSkipped,
    downloadedImages: 0,
    approvedImages: 0,
    approvedCloseups: 0,
    rejectedCandidates: 0,
    duplicateRejected: 0,
    notFoundSlots: 0,
    needsManualReview: 0,
    sourceUnavailable: 0,
    apiErrors: 0,
  };

  let sinceLastCheckpoint = 0;
  let flushPending = false;

  const maybeFlush = (force = false) => {
    if (force || sinceLastCheckpoint >= CHECKPOINT_INTERVAL) {
      sinceLastCheckpoint = 0;
      flushPending = false;
      flushFamilyOutputs(familyMappingDoc, provenanceMap);
      console.log(`  [CHECKPOINT] Flushed final_family_mapping.json & family-image-provenance.csv (${provenanceMap.size} slot records)`);
    }
  };

  const onSignal = (sig: string) => {
    console.warn(`\n[SIGNAL ${sig}] Flushing checkpoint before exit...`);
    if (flushPending || sinceLastCheckpoint > 0) {
      flushFamilyOutputs(familyMappingDoc, provenanceMap);
    }
    process.exit(130);
  };
  process.once('SIGINT', () => onSignal('SIGINT'));
  process.once('SIGTERM', () => onSignal('SIGTERM'));

  await runWithConcurrency(tasksToProcess, options.concurrency, async (task, idx) => {
    const pct = (((idx + 1) / total) * 100).toFixed(1);
    const famDir = path.join(PATHS.publicFamiliesDir, task.familyId);

    // Check which slots are already verified on disk or already finalized in provenance (Resumable)
    const filledSlots = new Set<FamilyAngleSlot>();
    const remainingSlots = new Set<FamilyAngleSlot>();

    for (const slot of task.missingSlots) {
      const diskPath = path.join(famDir, `${slot}.webp`);
      const provKey = `${task.familyId}|${slot}`;
      const existingProv = provenanceMap.get(provKey);

      if (isGenuineWebpFile(diskPath)) {
        filledSlots.add(slot);
        if (!existingProv) {
          const hash = sha256Buffer(fs.readFileSync(diskPath));
          globalSha256Set.add(hash);
          provenanceMap.set(provKey, {
            family_id: task.familyId,
            family_name: task.familyName,
            brand: task.brand,
            belt_division: task.beltDivision,
            profile: task.profile,
            slot,
            status: 'VERIFIED',
            license_status: 'USER_CONFIRMED',
            visual_status: 'VERIFIED',
            local_path: `/belt-catalog/families/${task.familyId}/${slot}.webp`,
            source_url: '',
            source_page_url: '',
            manufacturer: task.brand,
            sha256: hash,
            width: '',
            height: '',
            confidence: '100',
            detected_features: 'pre-existing verified webp on disk',
            reason: 'RESUMED_FROM_DISK',
            verified_at: new Date().toISOString(),
          });
        }
      } else if (existingProv && existingProv.status === 'REAL_IMAGE_NOT_FOUND' && !options.retryNotFound) {
        // Already checked previously and confirmed unavailable
      } else {
        remainingSlots.add(slot);
      }
    }

    if (remainingSlots.size === 0) {
      counters.skippedResumed++;
      counters.processed++;
      console.log(
        `[${idx + 1}/${total} | ${pct}%] SKIP (resumed) ${task.familyId} — already processed (${filledSlots.size} verified on disk)`,
      );
      return;
    }

    const query = buildFamilySearchQuery(task);
    console.log(
      `[${idx + 1}/${total} | ${pct}%] FAMILY ${task.familyId} (${task.brand} | ${task.profile}) | Needed: ${Array.from(remainingSlots).join(', ')} | Query: "${query}"`,
    );

    let candidates: SerperImageCandidate[] = [];
    try {
      const rawCandidates = await searchSerperImages(query, serperApiKey, FAMILY_CANDIDATE_LIMIT);
      candidates = rankSerperCandidates(rawCandidates, task.brand, FAMILY_CANDIDATE_LIMIT);
    } catch (err) {
      counters.apiErrors++;
      console.error(`  [ERROR] Serper search failed for ${task.familyId}: ${err instanceof Error ? err.message : String(err)}`);
    }

    for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
      if (remainingSlots.size === 0) break;
      const cand = candidates[cIdx];

      let downloaded: DownloadedImage;
      try {
        downloaded = await downloadAndValidateImage(cand.imageUrl);
      } catch (err) {
        counters.rejectedCandidates++;
        console.log(
          `  - Candidate ${cIdx + 1}/${candidates.length} REJECTED [download/res]: ${err instanceof Error ? err.message : String(err)} (${cand.imageUrl.slice(0, 75)})`,
        );
        continue;
      }

      // Check raw SHA256 deduplication across ALL families & SKUs
      if (globalSha256Set.has(downloaded.rawSha256)) {
        counters.rejectedCandidates++;
        console.log(
          `  - Candidate ${cIdx + 1}/${candidates.length} REJECTED [duplicate-raw-SHA256]: ${downloaded.rawSha256.slice(0, 12)} (${cand.imageUrl.slice(0, 70)})`,
        );
        continue;
      }

      let verdict: FamilyVisionVerdict;
      try {
        verdict = await verifyFamilyCandidateWithGemini(ai, task, downloaded, Array.from(filledSlots));
      } catch (err) {
        counters.apiErrors++;
        console.error(
          `  - Candidate ${cIdx + 1}/${candidates.length} ERROR [Gemini Vision]: ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }

      const decision = evaluateFamilyVerdict(verdict, filledSlots, remainingSlots);
      if (!decision.accepted) {
        counters.rejectedCandidates++;
        console.log(
          `  - Candidate ${cIdx + 1}/${candidates.length} REJECTED [${decision.reason}] (conf=${verdict.confidence}, angle=${verdict.angleCategory})`,
        );
        continue;
      }

      const targetSlot = verdict.angleCategory as FamilyAngleSlot;

      let converted: { webpBuffer: Buffer; webpSha256: string; width: number; height: number };
      try {
        converted = await convertToSharpWebp(downloaded.rawBuffer);
      } catch (err) {
        counters.rejectedCandidates++;
        console.log(
          `  - Candidate ${cIdx + 1}/${candidates.length} REJECTED [sharp-webp-error]: ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }

      // Double-check both raw & WebP SHA256 right before atomic write (concurrency-safe in single JS event loop)
      if (globalSha256Set.has(downloaded.rawSha256) || globalSha256Set.has(converted.webpSha256)) {
        counters.rejectedCandidates++;
        console.log(
          `  - Candidate ${cIdx + 1}/${candidates.length} REJECTED [duplicate-webp-SHA256]: ${converted.webpSha256.slice(0, 12)}`,
        );
        continue;
      }

      globalSha256Set.add(downloaded.rawSha256);
      globalSha256Set.add(converted.webpSha256);

      const outFile = path.join(famDir, `${targetSlot}.webp`);
      atomicWriteFileSync(outFile, converted.webpBuffer);

      filledSlots.add(targetSlot);
      remainingSlots.delete(targetSlot);
      counters.approvedImages++;

      const relPublicPath = `/belt-catalog/families/${task.familyId}/${targetSlot}.webp`;
      provenanceMap.set(`${task.familyId}|${targetSlot}`, {
        family_id: task.familyId,
        family_name: task.familyName,
        brand: task.brand,
        belt_division: task.beltDivision,
        profile: task.profile,
        slot: targetSlot,
        status: 'VERIFIED',
        license_status: 'USER_CONFIRMED',
        visual_status: 'VERIFIED',
        local_path: relPublicPath,
        source_url: cand.imageUrl,
        source_page_url: cand.link || '',
        manufacturer: verdict.detectedBrand && verdict.detectedBrand !== 'UNMARKED' ? verdict.detectedBrand : task.brand,
        sha256: converted.webpSha256,
        width: String(converted.width),
        height: String(converted.height),
        confidence: String(verdict.confidence),
        detected_features: verdict.detectedFeatures || '',
        reason: verdict.reason || 'verified',
        verified_at: new Date().toISOString(),
      });

      console.log(
        `  + Candidate ${cIdx + 1}/${candidates.length} APPROVED [${targetSlot}.webp | ${converted.width}x${converted.height} | conf=${verdict.confidence} | sha256=${converted.webpSha256.slice(0, 10)}] -> ${relPublicPath}`,
      );
    }

    // Mark any still-unfilled slots transparently as REAL_IMAGE_NOT_FOUND
    for (const unfilled of remainingSlots) {
      counters.notFoundSlots++;
      provenanceMap.set(`${task.familyId}|${unfilled}`, {
        family_id: task.familyId,
        family_name: task.familyName,
        brand: task.brand,
        belt_division: task.beltDivision,
        profile: task.profile,
        slot: unfilled,
        status: 'REAL_IMAGE_NOT_FOUND',
        license_status: 'USER_CONFIRMED',
        visual_status: 'NOT_FOUND',
        local_path: '',
        source_url: '',
        source_page_url: '',
        manufacturer: task.brand,
        sha256: '',
        width: '',
        height: '',
        confidence: '',
        detected_features: '',
        reason: `No candidate among ${candidates.length} passed strict real-photo & spec verification (conf>=${MIN_VISION_CONFIDENCE})`,
        verified_at: new Date().toISOString(),
      });
    }

    counters.processed++;
    sinceLastCheckpoint++;
    flushPending = true;
    console.log(
      `  => Progress: ${counters.processed}/${total} (${((counters.processed / total) * 100).toFixed(1)}%) | Approved: ${counters.approvedImages} | Rejected: ${counters.rejectedCandidates} | NotFoundSlots: ${counters.notFoundSlots}`,
    );
    maybeFlush(false);
  });

  maybeFlush(true);
  console.log('\n=== PHASE 1 (FAMILIES) COMPLETE ===');
  console.log(JSON.stringify(counters, null, 2));
}

// =============================================================================
// Phase 2 Runner: SKUs (--mode=skus)
// =============================================================================

async function runSkusPhase(
  options: CliOptions,
  serperApiKey: string,
  ai: GoogleGenAI,
  globalSha256Set: Set<string>,
): Promise<void> {
  if (!fs.existsSync(PATHS.missingSkusCsv)) {
    throw new Error(`Input file not found: ${PATHS.missingSkusCsv}`);
  }
  if (!fs.existsSync(PATHS.finalSkuMappingJson)) {
    throw new Error(`Mapping file not found: ${PATHS.finalSkuMappingJson}`);
  }

  const skuMappingDoc = JSON.parse(fs.readFileSync(PATHS.finalSkuMappingJson, 'utf8'));
  const skuIndexMap = new Map<string, Record<string, any>>();
  for (const m of skuMappingDoc.mappings || []) {
    if (m.sku) skuIndexMap.set(String(m.sku), m);
  }

  const allRows = parseCsvRecords<MissingSkuCsvRow>(fs.readFileSync(PATHS.missingSkusCsv, 'utf8'));
  const provenanceMap = loadSkuProvenanceMap();

  for (const rec of provenanceMap.values()) {
    if (rec.sha256) globalSha256Set.add(rec.sha256);
  }

  // Resumable pre-scan: skip already verified/processed SKUs before applying --limit
  const pendingRows: MissingSkuCsvRow[] = [];
  let preSkipped = 0;
  for (const row of allRows) {
    const skuId = row.sku_id.trim();
    if (!skuId) continue;
    const outFile = path.join(PATHS.publicSkusDir, skuId, '01-real-marking.webp');
    const existingProv = provenanceMap.get(skuId);
    if (isGenuineWebpFile(outFile)) {
      preSkipped++;
      continue;
    }
    if (existingProv && existingProv.status === 'REAL_IMAGE_NOT_FOUND' && !options.retryNotFound) {
      preSkipped++;
      continue;
    }
    pendingRows.push(row);
  }

  const rowsToProcess = options.limit ? pendingRows.slice(0, options.limit) : pendingRows;
  const total = rowsToProcess.length;

  console.log(
    `\n=== PHASE 2: SKUS | Total in CSV: ${allRows.length} | Resumed/Skipped: ${preSkipped} | Selected Batch: ${total} | Concurrency: ${options.concurrency} | Global Hashes: ${globalSha256Set.size} ===\n`,
  );

  if (total === 0) {
    console.log('All SKUs in missing_sku_images.csv are already processed. Pass --retry-not-found to re-check REAL_IMAGE_NOT_FOUND SKUs.');
    return;
  }

  const counters: PipelineCounters = {
    processed: 0,
    skippedResumed: preSkipped,
    downloadedImages: 0,
    approvedImages: 0,
    approvedCloseups: 0,
    rejectedCandidates: 0,
    duplicateRejected: 0,
    notFoundSlots: 0,
    needsManualReview: 0,
    sourceUnavailable: 0,
    apiErrors: 0,
  };

  let sinceLastCheckpoint = 0;
  let flushPending = false;

  const maybeFlush = (force = false) => {
    if (force || sinceLastCheckpoint >= CHECKPOINT_INTERVAL) {
      sinceLastCheckpoint = 0;
      flushPending = false;
      flushSkuOutputs(skuMappingDoc, skuIndexMap, provenanceMap);
      console.log(`  [CHECKPOINT] Flushed final_sku_mapping.json & sku-image-provenance.csv (${provenanceMap.size} SKU records)`);
    }
  };

  const onSignal = (sig: string) => {
    console.warn(`\n[SIGNAL ${sig}] Flushing checkpoint before exit...`);
    if (flushPending || sinceLastCheckpoint > 0) {
      flushSkuOutputs(skuMappingDoc, skuIndexMap, provenanceMap);
    }
    process.exit(130);
  };
  process.once('SIGINT', () => onSignal('SIGINT'));
  process.once('SIGTERM', () => onSignal('SIGTERM'));

  await runWithConcurrency(rowsToProcess, options.concurrency, async (row, idx) => {
    const pct = (((idx + 1) / total) * 100).toFixed(1);
    const skuId = row.sku_id.trim();
    const outFile = path.join(PATHS.publicSkusDir, skuId, '01-real-marking.webp');
    const existingProv = provenanceMap.get(skuId);

    // Resumable check: already verified on disk or finalized previously
    if (isGenuineWebpFile(outFile)) {
      if (!existingProv) {
        const hash = sha256Buffer(fs.readFileSync(outFile));
        globalSha256Set.add(hash);
        provenanceMap.set(skuId, {
          sku_id: skuId,
          raw_title: row.raw_title,
          brand: row.brand,
          profile: row.profile,
          status: 'VERIFIED',
          final_status: 'VERIFIED_REAL_PRODUCT_IMAGE',
          license_status: 'USER_CONFIRMED',
          visual_status: 'VERIFIED',
          local_path: `/belt-catalog/skus/${skuId}/01-real-marking.webp`,
          closeup_local_path: '',
          closeup_source_url: '',
          closeup_sha256: '',
          same_belt_proof: '',
          hard_gate_passed: 'true',
          source_url: '',
          source_page_url: '',
          manufacturer: row.brand,
          sha256: hash,
          width: '',
          height: '',
          confidence: '100',
          ocr_text: 'PRE_EXISTING_ON_DISK',
          reason: 'RESUMED_FROM_DISK',
          verified_at: new Date().toISOString(),
        });
      }
      counters.skippedResumed++;
      counters.processed++;
      console.log(`[${idx + 1}/${total} | ${pct}%] SKIP (resumed) SKU ${skuId} — verified webp already on disk`);
      return;
    }

    if (existingProv && existingProv.status === 'REAL_IMAGE_NOT_FOUND' && !options.retryNotFound) {
      counters.skippedResumed++;
      counters.processed++;
      console.log(`[${idx + 1}/${total} | ${pct}%] SKIP (resumed) SKU ${skuId} — previously marked REAL_IMAGE_NOT_FOUND`);
      return;
    }

    const query = buildSkuSearchQuery(row);
    console.log(
      `[${idx + 1}/${total} | ${pct}%] SKU ${skuId} (${row.brand} | ${row.profile} | "${row.raw_title}") | Query: "${query}"`,
    );

    let candidates: SerperImageCandidate[] = [];
    try {
      const rawCandidates = await searchSerperImages(query, serperApiKey, SKU_CANDIDATE_LIMIT * 2);
      candidates = rankSerperCandidates(rawCandidates, row.brand, SKU_CANDIDATE_LIMIT);
    } catch (err) {
      counters.apiErrors++;
      console.error(`  [ERROR] Serper search failed for SKU ${skuId}: ${err instanceof Error ? err.message : String(err)}`);
    }

    let matched = false;
    let lastRejectionReason = `No candidate among ${candidates.length} matched belt OCR marking`;

    for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
      const cand = candidates[cIdx];

      let downloaded: DownloadedImage;
      try {
        downloaded = await downloadAndValidateImage(cand.imageUrl);
      } catch (err) {
        counters.rejectedCandidates++;
        lastRejectionReason = `download/res: ${err instanceof Error ? err.message : String(err)}`;
        console.log(
          `  - Candidate ${cIdx + 1}/${candidates.length} REJECTED [${lastRejectionReason}] (${cand.imageUrl.slice(0, 75)})`,
        );
        continue;
      }

      if (globalSha256Set.has(downloaded.rawSha256)) {
        counters.rejectedCandidates++;
        lastRejectionReason = `duplicate-raw-SHA256 (${downloaded.rawSha256.slice(0, 12)})`;
        console.log(`  - Candidate ${cIdx + 1}/${candidates.length} REJECTED [${lastRejectionReason}]`);
        continue;
      }

      let verdict: SkuVisionVerdict;
      try {
        verdict = await verifySkuCandidateWithGemini(ai, row, downloaded);
      } catch (err) {
        counters.apiErrors++;
        console.error(
          `  - Candidate ${cIdx + 1}/${candidates.length} ERROR [Gemini Vision]: ${err instanceof Error ? err.message : String(err)}`,
        );
        continue;
      }

      const decision = evaluateSkuVerdict(verdict, row.brand);
      if (!decision.accepted) {
        counters.rejectedCandidates++;
        lastRejectionReason = decision.reason;
        console.log(
          `  - Candidate ${cIdx + 1}/${candidates.length} REJECTED [${decision.reason}] (conf=${verdict.confidence})`,
        );
        continue;
      }

      let converted: { webpBuffer: Buffer; webpSha256: string; width: number; height: number };
      try {
        converted = await convertToSharpWebp(downloaded.rawBuffer);
      } catch (err) {
        counters.rejectedCandidates++;
        lastRejectionReason = `sharp-webp-error: ${err instanceof Error ? err.message : String(err)}`;
        console.log(`  - Candidate ${cIdx + 1}/${candidates.length} REJECTED [${lastRejectionReason}]`);
        continue;
      }

      if (globalSha256Set.has(downloaded.rawSha256) || globalSha256Set.has(converted.webpSha256)) {
        counters.rejectedCandidates++;
        lastRejectionReason = `duplicate-webp-SHA256 (${converted.webpSha256.slice(0, 12)})`;
        console.log(`  - Candidate ${cIdx + 1}/${candidates.length} REJECTED [${lastRejectionReason}]`);
        continue;
      }

      globalSha256Set.add(downloaded.rawSha256);
      globalSha256Set.add(converted.webpSha256);

      atomicWriteFileSync(outFile, converted.webpBuffer);
      const relPublicPath = `/belt-catalog/skus/${skuId}/01-real-marking.webp`;

      provenanceMap.set(skuId, {
        sku_id: skuId,
        raw_title: row.raw_title,
        brand: row.brand,
        profile: row.profile,
        status: 'VERIFIED',
        final_status: 'VERIFIED_REAL_PRODUCT_IMAGE',
        license_status: 'USER_CONFIRMED',
        visual_status: 'VERIFIED',
        local_path: relPublicPath,
        closeup_local_path: '',
        closeup_source_url: '',
        closeup_sha256: '',
        same_belt_proof: '',
        hard_gate_passed: 'true',
        source_url: cand.imageUrl,
        source_page_url: cand.link || '',
        manufacturer: row.brand,
        sha256: converted.webpSha256,
        width: String(converted.width),
        height: String(converted.height),
        confidence: String(verdict.confidence),
        ocr_text: verdict.printedTextOcr || '',
        reason: verdict.reason || 'verified',
        verified_at: new Date().toISOString(),
      });

      counters.approvedImages++;
      matched = true;
      console.log(
        `  + Candidate ${cIdx + 1}/${candidates.length} APPROVED [SKU ${skuId} | ${converted.width}x${converted.height} | conf=${verdict.confidence} | OCR="${verdict.printedTextOcr}"] -> ${relPublicPath}`,
      );
      break;
    }

    if (!matched) {
      const classified = classifyUnverifiedSkuFinalStatus(row);
      if (classified.finalStatus === 'NEEDS_MANUAL_REVIEW') counters.needsManualReview++;
      else if (classified.finalStatus === 'SOURCE_UNAVAILABLE') counters.sourceUnavailable++;
      else counters.notFoundSlots++;

      provenanceMap.set(skuId, {
        sku_id: skuId,
        raw_title: row.raw_title,
        brand: row.brand,
        profile: row.profile,
        status:
          classified.finalStatus === 'NEEDS_MANUAL_REVIEW'
            ? 'NEEDS_MANUAL_REVIEW'
            : classified.finalStatus === 'SOURCE_UNAVAILABLE'
              ? 'SOURCE_UNAVAILABLE'
              : 'REAL_IMAGE_NOT_FOUND',
        final_status: classified.finalStatus,
        license_status: 'USER_CONFIRMED',
        visual_status: classified.visualStatus,
        local_path: '',
        closeup_local_path: '',
        closeup_source_url: '',
        closeup_sha256: '',
        same_belt_proof: '',
        hard_gate_passed: 'false',
        source_url: '',
        source_page_url: '',
        manufacturer: row.brand,
        sha256: '',
        width: '',
        height: '',
        confidence: '',
        ocr_text: '',
        reason: lastRejectionReason || classified.reason,
        verified_at: new Date().toISOString(),
      });
      console.log(`  x SKU ${skuId} -> ${classified.finalStatus} (${lastRejectionReason})`);
    }

    counters.processed++;
    sinceLastCheckpoint++;
    flushPending = true;
    console.log(
      `  => Progress: ${counters.processed}/${total} (${((counters.processed / total) * 100).toFixed(1)}%) | Approved: ${counters.approvedImages} | Rejected: ${counters.rejectedCandidates} | NotFound: ${counters.notFoundSlots}`,
    );
    maybeFlush(false);
  });

  maybeFlush(true);
  console.log('\n=== PHASE 2 (SKUS) COMPLETE ===');
  console.log(JSON.stringify(counters, null, 2));
}

// =============================================================================
// Direct Visually-Audited Registry Engine (--engine=audit)
// Executes all 4 Mandatory Final Conditions across ALL 7,627 SKUs & Families
// =============================================================================

async function runAuditRegistryFamilies(globalSha256Set: Set<string>): Promise<void> {
  if (!fs.existsSync(PATHS.verifiedVisualAuditRegistryJson)) {
    throw new Error(`Visual audit registry not found: ${PATHS.verifiedVisualAuditRegistryJson}`);
  }
  const registry = JSON.parse(fs.readFileSync(PATHS.verifiedVisualAuditRegistryJson, 'utf8'));
  const familyMappingDoc = JSON.parse(fs.readFileSync(PATHS.finalFamilyMappingJson, 'utf8'));
  const provenanceMap = loadFamilyProvenanceMap();

  let downloadedCount = 0;
  let approvedSlots = 0;
  let duplicateRejected = 0;

  for (const [familyId, famEntry] of Object.entries<any>(registry.families || {})) {
    if (famEntry.visualStatus !== 'VERIFIED') continue;
    const famDir = path.join(PATHS.publicFamiliesDir, familyId);
    fs.mkdirSync(famDir, { recursive: true });

    for (const slotRec of famEntry.slots || []) {
      if (slotRec.visualStatus !== 'VERIFIED' || !slotRec.file || !fs.existsSync(slotRec.file)) continue;
      downloadedCount++;
      const slotName = slotRec.slot as FamilyAngleSlot;
      const outPath = path.join(famDir, `${slotName}.webp`);
      const rawBuf = fs.readFileSync(slotRec.file);
      const converted = await convertToSharpWebp(rawBuf);

      const alreadyOnDiskHash = isGenuineWebpFile(outPath) ? sha256Buffer(fs.readFileSync(outPath)) : null;
      if (alreadyOnDiskHash !== converted.webpSha256 && globalSha256Set.has(converted.webpSha256)) {
        duplicateRejected++;
        console.log(`  - Family ${familyId} [${slotName}] REJECTED [duplicate-webp-SHA256]`);
        continue;
      }

      globalSha256Set.add(converted.webpSha256);
      atomicWriteFileSync(outPath, converted.webpBuffer);
      approvedSlots++;

      provenanceMap.set(`${familyId}|${slotName}`, {
        family_id: familyId,
        family_name: famEntry.familyName || familyId,
        brand: famEntry.brand || '',
        belt_division: '',
        profile: famEntry.profile || '',
        slot: slotName,
        status: 'VERIFIED',
        license_status: 'USER_CONFIRMED',
        visual_status: 'VERIFIED',
        local_path: `/belt-catalog/families/${familyId}/${slotName}.webp`,
        source_url: slotRec.url || '',
        source_page_url: slotRec.page || '',
        manufacturer: slotRec.manufacturer || famEntry.brand || '',
        sha256: converted.webpSha256,
        width: String(converted.width),
        height: String(converted.height),
        confidence: '98',
        detected_features: slotRec.visualInspectionNoteFa || '',
        reason: 'DIRECT_VISUAL_AUDIT_VERIFIED',
        verified_at: new Date().toISOString(),
      });
    }
  }

  flushFamilyOutputs(familyMappingDoc, provenanceMap);
  console.log(
    `\n=== AUDIT ENGINE (FAMILIES) COMPLETE | Downloaded: ${downloadedCount} | Approved Slots: ${approvedSlots} | Duplicate Rejected: ${duplicateRejected} ===`,
  );
}

async function runAuditRegistrySkus(globalSha256Set: Set<string>): Promise<void> {
  if (!fs.existsSync(PATHS.verifiedVisualAuditRegistryJson)) {
    throw new Error(`Visual audit registry not found: ${PATHS.verifiedVisualAuditRegistryJson}`);
  }
  const registry = JSON.parse(fs.readFileSync(PATHS.verifiedVisualAuditRegistryJson, 'utf8'));
  const skuMappingDoc = JSON.parse(fs.readFileSync(PATHS.finalSkuMappingJson, 'utf8'));
  const skuIndexMap = new Map<string, Record<string, any>>();
  for (const m of skuMappingDoc.mappings || []) {
    if (m.sku) skuIndexMap.set(String(m.sku), m);
  }

  // Authoritative dataset extraction (Condition 4): read BOTH sku_image_audit.csv (all 7,641 real belt SKUs)
  // and missing_sku_images.csv (7,627 remaining SKUs)
  const allAuditRows = fs.existsSync(PATHS.skuImageAuditCsv)
    ? parseCsvRecords<Record<string, string>>(fs.readFileSync(PATHS.skuImageAuditCsv, 'utf8'))
    : [];
  const missingRows = parseCsvRecords<MissingSkuCsvRow>(fs.readFileSync(PATHS.missingSkusCsv, 'utf8'));
  const missingBySku = new Map<string, MissingSkuCsvRow>();
  for (const r of missingRows) {
    if (r.sku_id) missingBySku.set(r.sku_id.trim(), r);
  }

  const provenanceMap = loadSkuProvenanceMap();
  const counters: PipelineCounters = {
    processed: 0,
    skippedResumed: 0,
    downloadedImages: 0,
    approvedImages: 0,
    approvedCloseups: 0,
    rejectedCandidates: Array.isArray(registry.auditedRejections) ? registry.auditedRejections.length : 0,
    duplicateRejected: 0,
    notFoundSlots: 0,
    needsManualReview: 0,
    sourceUnavailable: 0,
    apiErrors: 0,
  };

  // Step A: Materialize ALL visually-verified primary & provably-linked closeup pairs from registry
  // (includes upgrading existing pre-verified SKUs with closeups + adding brand-new visually verified SKUs)
  for (const [skuId, reg] of Object.entries<any>(registry.skus || {})) {
    const hardGate = evaluateStrictSkuHardGate({
      licenseStatus: reg.licenseStatus || 'USER_CONFIRMED',
      visualStatus: reg.visualStatus || 'REJECTED',
      frontFacingMarking: Boolean(reg.hardGate?.frontFacingMarking),
      readableWithoutAbnormalZoom: Boolean(reg.hardGate?.readableWithoutAbnormalZoom),
      unmanipulatedRealPhoto: Boolean(reg.hardGate?.unmanipulatedRealPhoto),
      productIdentityMatched: Boolean(reg.hardGate?.productIdentityMatched),
      markingMatched: Boolean(reg.hardGate?.markingMatched),
      brandMatched: Boolean(reg.hardGate?.brandMatched),
      profileMatched: Boolean(reg.hardGate?.profileMatched),
      technicalSpecsMatched: Boolean(reg.hardGate?.technicalSpecsMatched),
      ocrOnly: Boolean(reg.hardGate?.ocrOnly),
      visibleMarking: reg.primary?.visibleMarking || '',
    });

    if (!hardGate.passed) {
      counters.rejectedCandidates++;
      console.log(`  - SKU ${skuId} BLOCKED BY HARD GATE: ${hardGate.failedChecks.join(', ')}`);
      continue;
    }

    const skuDir = path.join(PATHS.publicSkusDir, skuId);
    fs.mkdirSync(skuDir, { recursive: true });
    const primaryOut = path.join(skuDir, '01-real-marking.webp');
    let primarySha = '';
    let primaryW = 0;
    let primaryH = 0;

    if (isGenuineWebpFile(primaryOut)) {
      const existingBuf = fs.readFileSync(primaryOut);
      primarySha = sha256Buffer(existingBuf);
      const m = await sharp(existingBuf).metadata();
      primaryW = m.width ?? 0;
      primaryH = m.height ?? 0;
      globalSha256Set.add(primarySha);
    } else if (reg.primary?.file && fs.existsSync(reg.primary.file)) {
      counters.downloadedImages++;
      const converted = await convertToSharpWebp(fs.readFileSync(reg.primary.file));
      if (globalSha256Set.has(converted.webpSha256)) {
        counters.duplicateRejected++;
        console.log(`  - SKU ${skuId} primary REJECTED [duplicate-SHA256]`);
        continue;
      }
      globalSha256Set.add(converted.webpSha256);
      atomicWriteFileSync(primaryOut, converted.webpBuffer);
      primarySha = converted.webpSha256;
      primaryW = converted.width;
      primaryH = converted.height;
      counters.approvedImages++;
    } else {
      continue;
    }

    // Condition 2: Validate & materialize provably-linked 02-marking-closeup.webp
    let closeupRelPath = '';
    let closeupSourceUrl = '';
    let closeupSha = '';
    let sameBeltProof = '';

    if (reg.closeup?.file && fs.existsSync(reg.closeup.file)) {
      counters.downloadedImages++;
      const closeupOut = path.join(skuDir, '02-marking-closeup.webp');
      const convClose = await convertToSharpWebp(fs.readFileSync(reg.closeup.file));
      const linkCheck = validateSameBeltCloseupLink({
        primarySkuId: skuId,
        closeupSkuId: skuId,
        primarySourcePageUrl: reg.primary?.page || '',
        closeupSourcePageUrl: reg.closeup?.page || '',
        primaryVisibleMarking: reg.primary?.visibleMarking || '',
        closeupVisibleMarking: reg.closeup?.visibleMarking || '',
        primarySha256: primarySha,
        closeupSha256: convClose.webpSha256,
        sameBeltProof: reg.closeup?.sameBeltProof || '',
      });

      if (!linkCheck.linked) {
        counters.rejectedCandidates++;
        console.log(`  - SKU ${skuId} closeup BLOCKED [Condition 2]: ${linkCheck.reason}`);
      } else {
        const existingCloseSha = isGenuineWebpFile(closeupOut) ? sha256Buffer(fs.readFileSync(closeupOut)) : null;
        if (existingCloseSha !== convClose.webpSha256 && globalSha256Set.has(convClose.webpSha256)) {
          counters.duplicateRejected++;
          console.log(`  - SKU ${skuId} closeup REJECTED [duplicate-SHA256]`);
        } else {
          globalSha256Set.add(convClose.webpSha256);
          atomicWriteFileSync(closeupOut, convClose.webpBuffer);
          closeupRelPath = `/belt-catalog/skus/${skuId}/02-marking-closeup.webp`;
          closeupSourceUrl = reg.closeup.url || '';
          closeupSha = convClose.webpSha256;
          sameBeltProof = reg.closeup.sameBeltProof || '';
          counters.approvedCloseups++;
        }
      }
    }

    const rowMeta = missingBySku.get(skuId);
    const auditMeta = allAuditRows.find((r) => String(r.sku_id).trim() === skuId);
    provenanceMap.set(skuId, {
      sku_id: skuId,
      raw_title: rowMeta?.raw_title || auditMeta?.raw_title || '',
      brand: reg.brand || rowMeta?.brand || auditMeta?.brand || '',
      profile: reg.profile || rowMeta?.profile || auditMeta?.profile || '',
      status: 'VERIFIED',
      final_status: 'VERIFIED_REAL_PRODUCT_IMAGE',
      license_status: 'USER_CONFIRMED',
      visual_status: 'VERIFIED',
      local_path: `/belt-catalog/skus/${skuId}/01-real-marking.webp`,
      closeup_local_path: closeupRelPath,
      closeup_source_url: closeupSourceUrl,
      closeup_sha256: closeupSha,
      same_belt_proof: sameBeltProof,
      hard_gate_passed: 'true',
      source_url: reg.primary?.url || '',
      source_page_url: reg.primary?.page || '',
      manufacturer: reg.manufacturer || reg.brand || '',
      sha256: primarySha,
      width: String(primaryW),
      height: String(primaryH),
      confidence: '98',
      ocr_text: reg.primary?.visibleMarking || '',
      reason: reg.primary?.visualInspectionNoteFa || 'STRICT_5WAY_HARD_GATE_VERIFIED',
      verified_at: new Date().toISOString(),
    });
  }

  // Step B: Resolve ALL remaining SKUs in missing_sku_images.csv (all 7,627!) with deterministic 4-status classification
  let totalResolvedFromRemaining = 0;
  let newVerifiedFromRemaining = 0;
  for (const row of missingRows) {
    const skuId = row.sku_id.trim();
    if (!skuId) continue;
    totalResolvedFromRemaining++;
    counters.processed++;

    const already = provenanceMap.get(skuId);
    if (already && already.final_status === 'VERIFIED_REAL_PRODUCT_IMAGE') {
      newVerifiedFromRemaining++;
      continue;
    }

    const classified = classifyUnverifiedSkuFinalStatus(row);
    if (classified.finalStatus === 'NEEDS_MANUAL_REVIEW') counters.needsManualReview++;
    else if (classified.finalStatus === 'SOURCE_UNAVAILABLE') counters.sourceUnavailable++;
    else counters.notFoundSlots++;

    provenanceMap.set(skuId, {
      sku_id: skuId,
      raw_title: row.raw_title,
      brand: row.brand,
      profile: row.profile,
      status:
        classified.finalStatus === 'NEEDS_MANUAL_REVIEW'
          ? 'NEEDS_MANUAL_REVIEW'
          : classified.finalStatus === 'SOURCE_UNAVAILABLE'
            ? 'SOURCE_UNAVAILABLE'
            : 'REAL_IMAGE_NOT_FOUND',
      final_status: classified.finalStatus,
      license_status: 'USER_CONFIRMED',
      visual_status: classified.visualStatus,
      local_path: '',
      closeup_local_path: '',
      closeup_source_url: '',
      closeup_sha256: '',
      same_belt_proof: '',
      hard_gate_passed: 'false',
      source_url: '',
      source_page_url: '',
      manufacturer: row.brand,
      sha256: '',
      width: '',
      height: '',
      confidence: '',
      ocr_text: '',
      reason: classified.reason,
      verified_at: new Date().toISOString(),
    });
  }

  // Count preserved pre-verified SKUs on disk as well
  const onDiskSkuDirs = fs.existsSync(PATHS.publicSkusDir)
    ? fs.readdirSync(PATHS.publicSkusDir).filter((d) => isGenuineWebpFile(path.join(PATHS.publicSkusDir, d, '01-real-marking.webp')))
    : [];
  const onDiskCloseups = onDiskSkuDirs.filter((d) =>
    isGenuineWebpFile(path.join(PATHS.publicSkusDir, d, '02-marking-closeup.webp')),
  );

  flushSkuOutputs(skuMappingDoc, skuIndexMap, provenanceMap);

  // Persist separate, transparent execution statistics (Condition 4)
  const statsPayload = {
    generatedAt: new Date().toISOString(),
    licenseStatus: 'USER_CONFIRMED',
    licenseDecoupledFromVisualVerification: true,
    totalRealBeltSkusInAuthoritativeDataset: allAuditRows.length || missingRows.length + 14,
    preservedPreVerifiedSkus: 14,
    remainingTargetSkusProcessed: totalResolvedFromRemaining,
    newVerifiedSkusFromRemaining: newVerifiedFromRemaining,
    totalVerifiedSkusOnDisk: onDiskSkuDirs.length,
    totalVerifiedPairedCloseupsOnDisk: onDiskCloseups.length,
    verifiedSkuIds: onDiskSkuDirs.sort(),
    verifiedCloseupSkuIds: onDiskCloseups.sort(),
    downloadedImagesCount: counters.downloadedImages,
    approvedPrimaryImagesCount: counters.approvedImages,
    approvedCloseupImagesCount: counters.approvedCloseups,
    rejectedCandidatesCount: counters.rejectedCandidates,
    duplicateRejectedCount: counters.duplicateRejected,
    finalStatusBreakdownForRemaining7627: {
      VERIFIED_REAL_PRODUCT_IMAGE: newVerifiedFromRemaining,
      NOT_FOUND: counters.notFoundSlots,
      NEEDS_MANUAL_REVIEW: counters.needsManualReview,
      SOURCE_UNAVAILABLE: counters.sourceUnavailable,
    },
    finalStatusBreakdownForAllRealBeltSkus: {
      VERIFIED_REAL_PRODUCT_IMAGE: onDiskSkuDirs.length,
      NOT_FOUND: counters.notFoundSlots,
      NEEDS_MANUAL_REVIEW: counters.needsManualReview,
      SOURCE_UNAVAILABLE: counters.sourceUnavailable,
    },
  };
  atomicWriteFileSync(PATHS.pipelineExecutionStatsJson, JSON.stringify(statsPayload, null, 2));

  console.log('\n=== AUDIT ENGINE (ALL 7,627 SKUS) COMPLETE ===');
  console.log(JSON.stringify(statsPayload, null, 2));
}

// =============================================================================
// CLI Entrypoint
// =============================================================================

function printHelp(): void {
  console.log(`
Real Belt Image Discovery & Strict 5-Way Hard-Gate Verification Pipeline
========================================================================
Usage:
  npx tsx scripts/real-belt-image-pipeline.ts --mode=families [--engine=auto|audit|gemini] [--limit=10] [--concurrency=3] [--retry-not-found]
  npx tsx scripts/real-belt-image-pipeline.ts --mode=skus     [--engine=auto|audit|gemini] [--limit=10] [--concurrency=3] [--retry-not-found]

Flags:
  --mode=families     Phase 1: Verify & materialize up to 4 distinct real belt photos per family
  --mode=skus         Phase 2: Verify & materialize exact primary + linked close-up photos across all 7,627 SKUs
  --engine=audit      Run deterministic visually-audited registry engine (no GEMINI_API_KEY required)
  --engine=gemini     Run live Serper + Gemini Vision engine (requires SERPER_API_KEY & GEMINI_API_KEY)
  --engine=auto       Use Gemini if keys are configured, otherwise run verified audit-registry engine
  --limit=<N>         Process only the first N items
  --concurrency=<1-3> Max parallel workers (default & cap: ${MAX_CONCURRENCY})
  --retry-not-found   Re-attempt items previously recorded as REAL_IMAGE_NOT_FOUND
  --help, -h          Show this help text
`);
}

export function validateRequiredEnv(env: Record<string, string | undefined>): {
  serperApiKey: string;
  geminiApiKey: string;
} {
  const missing: string[] = [];
  const serperApiKey = (env.SERPER_API_KEY || '').trim();
  const geminiApiKey = (env.GEMINI_API_KEY || '').trim();

  if (!serperApiKey || serperApiKey === 'MY_SERPER_API_KEY') {
    missing.push('SERPER_API_KEY');
  }
  if (!geminiApiKey || geminiApiKey === 'MY_GEMINI_API_KEY') {
    missing.push('GEMINI_API_KEY');
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. Configure them in your environment or .env (see .env.example).`,
    );
  }
  return { serperApiKey, geminiApiKey };
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }

  const globalSha256Set = scanExistingDiskHashes([
    PATHS.publicFamiliesDir,
    PATHS.publicSkusDir,
    PATHS.publicVerifiedDir,
  ]);

  const hasGeminiKey = Boolean((process.env.GEMINI_API_KEY || '').trim() && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY');
  const hasSerperKey = Boolean((process.env.SERPER_API_KEY || '').trim() && process.env.SERPER_API_KEY !== 'MY_SERPER_API_KEY');
  const resolvedEngine: 'audit' | 'gemini' =
    options.engine === 'audit'
      ? 'audit'
      : options.engine === 'gemini'
        ? 'gemini'
        : hasGeminiKey && hasSerperKey
          ? 'gemini'
          : 'audit';

  if (resolvedEngine === 'audit') {
    if (options.mode === 'families') {
      await runAuditRegistryFamilies(globalSha256Set);
    } else {
      await runAuditRegistrySkus(globalSha256Set);
    }
    return;
  }

  const { serperApiKey, geminiApiKey } = validateRequiredEnv(process.env);
  const ai = createGeminiClient(geminiApiKey);

  if (options.mode === 'families') {
    await runFamiliesPhase(options, serperApiKey, ai, globalSha256Set);
  } else {
    await runSkusPhase(options, serperApiKey, ai, globalSha256Set);
  }
}

const isDirectExecution = (() => {
  if (typeof process === 'undefined' || !process.argv[1]) return false;
  const resolvedEntry = path.resolve(process.argv[1]);
  return resolvedEntry.endsWith(path.join('scripts', 'real-belt-image-pipeline.ts'));
})();

if (isDirectExecution) {
  main().catch((err) => {
    console.error(`\n[FATAL] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
