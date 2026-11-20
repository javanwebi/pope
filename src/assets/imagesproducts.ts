export const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/javanweb/imagesatlas/main';
export const TOTAL_OFFICIAL_IMAGES_COUNT = 869;
export const PERSISTENT_CATALOG_IMAGE_BASE = '/storage/products/catalog';

export function normalizeImageFileName(imageName?: string | null): string {
  if (!imageName) return '';
  const value = imageName.trim();
  const match = /^(?:e\(?([1-9]\d{0,3})\)?|at-e0*([1-9]\d{0,3}))(?:\.(?:png|jpe?g|webp|svg))?$/i.exec(value);
  if (!match) return '';
  const n = Number(match[1] || match[2]);
  return Number.isInteger(n) && n >= 1 && n <= 869 ? `e(${n}).png` : '';
}

export function isVerifiedCatalogueImage(imageName?: string | null): boolean {
  return Boolean(normalizeImageFileName(imageName));
}

function oldGithubOfficialFile(input: string): string {
  try {
    const url = new URL(input);
    const repoPath = '/javanweb/imagesatlas/main/';
    const jsDelivrPath = '/gh/javanweb/imagesatlas@main/';
    const github = url.protocol === 'https:' && url.hostname === 'raw.githubusercontent.com' && url.pathname.startsWith(repoPath);
    const jsdelivr = url.protocol === 'https:' && url.hostname === 'cdn.jsdelivr.net' && url.pathname.startsWith(jsDelivrPath);
    if (!github && !jsdelivr) return '';
    const pathname = decodeURIComponent(url.pathname);
    const raw = pathname.slice((github ? repoPath : jsDelivrPath).length);
    return /^e\([1-9]\d{0,3}\)\.png$/.test(raw) ? normalizeImageFileName(raw) : '';
  } catch {
    return '';
  }
}

export function getProductImageUrl(imageName?: string | null): string {
  if (!imageName) return '';
  const input = imageName.trim();
  if (/^\/storage\/products\/[a-f0-9-]{36}\.webp$/.test(input)) return input;
  if (/^\/storage\/products\/legacy-jpg\/images\/e\([1-9]\d{0,3}\)\.jpg$/.test(input)) return input;
  if (/^\/storage\/products\/thumbs\/e\(([1-9]\d{0,3})\)\.webp$/.test(input)) return input;
  const local = /^\/storage\/products\/catalog\/(e\([1-9]\d{0,3}\)\.png)$/.exec(input);
  if (local) return normalizeImageFileName(local[1]) ? input : '';
  const historical = oldGithubOfficialFile(input);
  if (historical) return `${PERSISTENT_CATALOG_IMAGE_BASE}/${historical}`;
  if (/^(blob:|data:image\/(?:png|jpeg|webp|svg\+xml);base64,|data:image\/svg\+xml)/i.test(input)) return input;
  if (/^\/src\/assets\/catalog\//.test(input)) return input;
  if (/^https?:/i.test(input)) return '';
  const file = normalizeImageFileName(input);
  return file ? `${PERSISTENT_CATALOG_IMAGE_BASE}/${file}` : '';
}

export default getProductImageUrl;
