import type { Product, TechnicalSpec } from '../types';
import { normalizeCatalogText } from './excelCategoryCatalog';

export type TechnicalReviewPayload = {
  categoryPath?: string[];
  note?: string;
  ownerCatalogue?: {
    printedPage?: string | number;
    pdfPage?: string | number;
  };
  researchWarnings?: string[];
  references?: Array<{ title: string; url: string }>;
  comparisonReferences?: Array<{ title: string; url: string; condition?: string }>;
  missing?: string[];
  summary?: string;
  standards?: string[];
  applications?: string[];
  notes?: string;
};

export function collectProductSpecValues(product: Product | undefined, specKey: string): string[] {
  if (!product) return [];
  const target = normalizeCatalogText(specKey);
  const values = new Set<string>();
  const allSpecs: TechnicalSpec[] = [
    ...(product.technicalSpecs || []),
    ...(product.variants || []).flatMap((v) => v.technicalSpecs || []),
  ];
  for (const spec of allSpecs) {
    if (normalizeCatalogText(spec.key) === target && spec.value?.trim()) {
      values.add(spec.value.trim());
    }
  }
  return Array.from(values);
}

export function getCommonComparisonSpecKeys(products: Product[], maxKeys = 8): string[] {
  const counts = new Map<string, number>();
  for (const product of products) {
    const seen = new Set<string>();
    const allSpecs: TechnicalSpec[] = [
      ...(product.technicalSpecs || []),
      ...(product.variants || []).slice(0, 8).flatMap((v) => v.technicalSpecs || []),
    ];
    for (const spec of allSpecs) {
      const k = spec.key?.trim();
      if (!k || seen.has(k) || !spec.value?.trim()) continue;
      seen.add(k);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeys)
    .map(([key]) => key);
}
