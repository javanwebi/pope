import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const TMP_CACHE_DIR = '/tmp/sanatpish-asset-cache';
const PROVENANCE_PATH = '/tmp/upstream/belt-master-photo-provenance.json';
const IMAGES_TS_PATH = path.join(ROOT_DIR, 'src/assets/images.ts');

export interface VerifiedLocalAssetEntry {
  key: string;
  localPublicPath: string;
  ext: string;
  bytes: number;
  sourceUrl: string;
  sourcePageUrl: string;
  manufacturer: string;
}

function isValidWebpBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 16 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  );
}

function convertBufferOrFileToWebp(srcPath: string, destWebpPath: string): Buffer {
  const srcBuf = fs.readFileSync(srcPath);
  if (isValidWebpBuffer(srcBuf)) {
    fs.writeFileSync(destWebpPath, srcBuf);
    return srcBuf;
  }
  execFileSync('convert', [
    srcPath,
    '-auto-orient',
    '-quality',
    '86',
    '-define',
    'webp:method=5',
    '-strip',
    destWebpPath,
  ]);
  const outBuf = fs.readFileSync(destWebpPath);
  if (!isValidWebpBuffer(outBuf)) {
    throw new Error(`Failed to produce valid RIFF/WEBP file at ${destWebpPath}`);
  }
  return outBuf;
}

function detectImageExt(buf: Buffer, fallbackUrl: string): { valid: boolean; ext: string } {
  if (buf.length < 100) return { valid: false, ext: '' };
  const headText = buf.subarray(0, 128).toString('utf8').trimStart().toLowerCase();
  if (headText.startsWith('<!doctype') || headText.startsWith('<html')) {
    return { valid: false, ext: '' };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { valid: true, ext: '.jpg' };
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { valid: true, ext: '.png' };
  }
  if (isValidWebpBuffer(buf)) {
    return { valid: true, ext: '.webp' };
  }
  if (headText.startsWith('<svg') || headText.includes('<svg')) {
    return { valid: true, ext: '.svg' };
  }
  const urlExt = path.extname(fallbackUrl.split('?')[0]).toLowerCase();
  if (['.jpg', '.jpeg', '.png', '.webp'].includes(urlExt)) {
    return { valid: true, ext: urlExt === '.jpeg' ? '.jpg' : urlExt };
  }
  return { valid: false, ext: '' };
}

async function fetchValidImage(urls: string[]): Promise<{ buf: Buffer; ext: string; url: string } | null> {
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SanatPishAssetSync/1.0)',
          Accept: 'image/*,*/*;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const ctype = (res.headers.get('content-type') || '').toLowerCase();
      if (ctype.includes('text/html')) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const check = detectImageExt(buf, url);
      if (check.valid) {
        return { buf, ext: check.ext, url };
      }
    } catch {
      // Try next candidate
    }
  }
  return null;
}

async function syncStorefrontAssets(): Promise<{ total: number; synced: number; failed: string[] }> {
  const imgSrc = fs.readFileSync(IMAGES_TS_PATH, 'utf8');
  const paths = Array.from(
    new Set([...imgSrc.matchAll(/['"](\/images\/[^'"]+)['"]/g)].map((m) => m[1])),
  );

  let synced = 0;
  const failed: string[] = [];

  for (const relUrl of paths) {
    const rel = relUrl.replace(/^\/+/, '');
    const dest = path.join(PUBLIC_DIR, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });

    // 1. Existing local /public file
    if (fs.existsSync(dest)) {
      const buf = fs.readFileSync(dest);
      if (detectImageExt(buf, rel).valid) {
        synced++;
        continue;
      }
    }

    // 2. Existing /tmp/sanatpish-asset-cache copy
    const cached = path.join(TMP_CACHE_DIR, rel);
    if (fs.existsSync(cached)) {
      const buf = fs.readFileSync(cached);
      if (detectImageExt(buf, rel).valid) {
        fs.writeFileSync(dest, buf);
        synced++;
        continue;
      }
    }

    // 3. Fetch from upstream repo or site
    const encoded = rel
      .replace(/^images\//, '')
      .split('/')
      .map((seg) => encodeURIComponent(decodeURIComponent(seg)))
      .join('/');
    const fetched = await fetchValidImage([
      `https://sanatpish.com/images/${encoded}`,
      `https://raw.githubusercontent.com/javanwebi/script/main/public/images/${encoded}`,
    ]);
    if (fetched) {
      fs.writeFileSync(dest, fetched.buf);
      synced++;
    } else {
      failed.push(relUrl);
    }
  }

  return { total: paths.length, synced, failed };
}

async function syncOwnerConveyorAndCachedStorage(): Promise<{ ownerConveyorCount: number; storageCopied: number }> {
  const ownerFiles = ['e(859).png', 'e(860).png', 'e(862).png', 'e(863).png', 'e(864).png'];
  const ownerDir = path.join(PUBLIC_DIR, 'belt-catalog/owner-conveyor');
  fs.mkdirSync(ownerDir, { recursive: true });
  let ownerCount = 0;

  for (const fn of ownerFiles) {
    const dest = path.join(ownerDir, fn);
    const cacheCandidate = path.join(TMP_CACHE_DIR, 'storage/products/catalog', fn);
    if (fs.existsSync(dest) && detectImageExt(fs.readFileSync(dest), fn).valid) {
      ownerCount++;
      continue;
    }
    if (fs.existsSync(cacheCandidate) && detectImageExt(fs.readFileSync(cacheCandidate), fn).valid) {
      fs.writeFileSync(dest, fs.readFileSync(cacheCandidate));
      ownerCount++;
      continue;
    }
    const fetched = await fetchValidImage([
      `https://sanatpish.com/storage/products/catalog/${encodeURIComponent(fn)}`,
    ]);
    if (fetched) {
      fs.writeFileSync(dest, fetched.buf);
      ownerCount++;
    }
  }

  // Copy cached non-belt storage images into /public/storage/products/ so local source covers them
  const tmpStorageCatalog = path.join(TMP_CACHE_DIR, 'storage/products');
  let storageCopied = 0;
  if (fs.existsSync(tmpStorageCatalog)) {
    const walk = (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          walk(full);
        } else {
          const rel = path.relative(TMP_CACHE_DIR, full);
          const dest = path.join(PUBLIC_DIR, rel);
          if (!fs.existsSync(dest)) {
            const buf = fs.readFileSync(full);
            if (detectImageExt(buf, ent.name).valid) {
              fs.mkdirSync(path.dirname(dest), { recursive: true });
              fs.writeFileSync(dest, buf);
              storageCopied++;
            }
          }
        }
      }
    };
    walk(tmpStorageCatalog);
  }

  return { ownerConveyorCount: ownerCount, storageCopied };
}

// Keys visually audited and purged (mismatched print/profile, CGI renders, or near-duplicates)
const PURGED_VISUAL_AUDIT_KEYS = new Set([
  'vb_classical_loop',
  'htd_opti_cut',
  'hug_opti_zr_angle',
  'pu_round_profiles',
  'pu_round_cut',
  'imp_sleeve_cut',
  'htd_gen_coil',
  'htd_blue_pu',
  'htd_blue_pu_cu',
  'pu_t10_close',
  'vb_cog_bando_cut',
  'vb_wedge_stack',
  'pt_htd_listing',
  'pt_htd_struct',
  'pt_pu_struct',
  'pt_v_wrapped_struct',
  'pt_v_cogged_struct',
  'pt_wedge_struct',
  'pt_cogwedge_listing',
  'pt_hex_coil',
  'pt_hex_struct',
]);

// Newly harvested & visually inspected real belt photographs (100% verified via vision inspection)
const EXTRA_VERIFIED_CANDIDATES: Record<
  string,
  { sourceUrl: string; sourcePageUrl: string; manufacturer: string }
> = {
  pu_round_coils_main: {
    sourceUrl: 'https://www.polyurethaneproduct.com/wp-content/uploads/2025/07/Urethane-Round-Belts.jpg',
    sourcePageUrl: 'https://www.polyurethaneproduct.com/urethane-round-belts/',
    manufacturer: 'Industrial Polyurethane Belting',
  },
  pu_round_curved_angle: {
    sourceUrl: 'https://www.fecconsulting.dk/images/stories/virtuemart/category/Rundremme_rundrem_rundsnor_roundbelt_pu_belt.webp',
    sourcePageUrl: 'https://www.fecconsulting.dk/en/products/round-belts',
    manufacturer: 'FEC Consulting Industrial Belting (Denmark)',
  },
  pu_round_green_aramid_cord: {
    sourceUrl: 'https://www.behabelt.com/site/assets/files/5756/rr_pu85a_gruen_geraut_aramid.jpg',
    sourcePageUrl: 'https://www.behabelt.com/en/products/pu-belting/round-belts/',
    manufacturer: 'Behabelt (Germany)',
  },
  beha_v_green_smooth: {
    sourceUrl: 'https://www.behabelt.com/site/assets/files/5496/kr_pu85a_gruen_glatt.jpg',
    sourcePageUrl: 'https://www.behabelt.com/en/products/pu-belting/v-belts/',
    manufacturer: 'Behabelt (Germany)',
  },
  beha_v_green_aramid: {
    sourceUrl: 'https://www.behabelt.com/site/assets/files/5497/kr_pu85a_gruen_glatt_aramid.jpg',
    sourcePageUrl: 'https://www.behabelt.com/en/products/pu-belting/v-belts/',
    manufacturer: 'Behabelt (Germany)',
  },
  beha_v_beige_poly: {
    sourceUrl: 'https://www.behabelt.com/site/assets/files/5506/kr_pu95a_beige_glatt_polyester.jpg',
    sourcePageUrl: 'https://www.behabelt.com/en/products/pu-belting/v-belts/',
    manufacturer: 'Behabelt (Germany)',
  },
  opti_zr_270l_angle: {
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Optibelt_L_H_XH_XXH_Belts.png',
    sourcePageUrl: 'https://www.totallybelts.com/collections/optibelt-timing-belts',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_zr_xl_loop: {
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Optibelt_MXL_XL_Belts.png',
    sourcePageUrl: 'https://www.totallybelts.com/collections/optibelt-timing-belts',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_omega_hp_loop: {
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Optibelt_Omega_HP_Medium_a318cd69-2fd6-4cd8-bdd7-95449d60673a.png',
    sourcePageUrl: 'https://www.totallybelts.com/collections/optibelt-omega',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_omega_1096_8m: {
    sourceUrl: 'https://www.fecconsulting.dk/images/stories/virtuemart/product/gummi-tandremme-htd-fra-optibelt_hl_hp_omega_timing_belt_8m.webp',
    sourcePageUrl: 'https://www.fecconsulting.dk/en/products/timing-belts',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_omega_880_8m: {
    sourceUrl: 'https://www.fecconsulting.dk/images/stories/virtuemart/product/gummi_tandremme_htd_optibelt_hl_hp_omega_timing_belt_8m_upscayl_2x_ultrasharp.webp',
    sourcePageUrl: 'https://www.fecconsulting.dk/en/products/timing-belts',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_vb_classic_loop: {
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Large_Optibelt_V-Belts_b7961110-3a2f-4e5d-a340-a2ddf7f79619.png',
    sourcePageUrl: 'https://www.totallybelts.com/collections/optibelt-v-belts',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_sk_spb_loop: {
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Optibelt_SK.png',
    sourcePageUrl: 'https://www.totallybelts.com/collections/optibelt-sk',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_supertx_cog_loop: {
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Optibelt_Super-TX.png',
    sourcePageUrl: 'https://www.totallybelts.com/collections/optibelt-super-tx',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_superxe_xpa_loop: {
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Super_XE_Power.png',
    sourcePageUrl: 'https://www.totallybelts.com/collections/optibelt-super-xe-power',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_rb_pj_coil: {
    sourceUrl: 'https://www.totallybelts.com/cdn/shop/files/Optibelt_Ribbed_Belt.png?width=1200',
    sourcePageUrl: 'https://www.totallybelts.com/collections/optibelt-ribbed-belts',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_rb_pj_official: {
    sourceUrl: 'https://mediaplus3.optibelt.com/asset/picture/optibelt-keilrippenriemen-gruppenbild.jpg',
    sourcePageUrl: 'https://www.optibelt.com/en/products/ribbed-belts/optibelt-rb/',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  fec_pj_ribs_macro: {
    sourceUrl: 'https://www.fecconsulting.dk/images/stories/virtuemart/category/Poly-v%20rem%20PJ%20profil_multi-v%20rem%20belt.webp',
    sourcePageUrl: 'https://www.fecconsulting.dk/en/products/poly-v-belts',
    manufacturer: 'FEC Consulting Industrial Belting (Denmark)',
  },
  opti_rb_pl_wide_loop: {
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Optibelt_Ribbed_Belt_Larger.png',
    sourcePageUrl: 'https://www.totallybelts.com/collections/optibelt-ribbed-belts',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  dh_loop_main: {
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Isolated_Black_Toothed_Timing_Belt_Loop.png',
    sourcePageUrl: 'https://www.totallybelts.com/collections/double-sided-timing-belts',
    manufacturer: 'Industrial Synchronous Belting',
  },
  fec_htd_rubber_loop: {
    sourceUrl: 'https://www.fecconsulting.dk/images/stories/virtuemart/product/htd_tandrem_i_gummi_timing_belt.webp',
    sourcePageUrl: 'https://www.fecconsulting.dk/en/products/timing-belts',
    manufacturer: 'FEC Consulting Industrial Belting (Denmark)',
  },
  bando_reds_classic_loop: {
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Bando_Red-S_II_V-Belt_Loop.png',
    sourcePageUrl: 'https://www.totallybelts.com/collections/bando-v-belts',
    manufacturer: 'Bando Chemical Industries (Japan)',
  },
  mega_oleostatic_c_loop: {
    sourceUrl: 'https://www.totallybelts.com/cdn/shop/files/Megadyne_Belts.webp?width=1200',
    sourcePageUrl: 'https://www.totallybelts.com/collections/megadyne-belts',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  mega_lineax_xpb_loop: {
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Linea-X.png',
    sourcePageUrl: 'https://www.totallybelts.com/collections/megadyne-belts',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  mega_megalinear_t5_roll: {
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Open_Belting_PU.png',
    sourcePageUrl: 'https://www.totallybelts.com/collections/megadyne-timing-belts',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  mega_isoran_imp_coil: {
    sourceUrl: 'https://hvhindustrial.com/storage/images/frontend_images/categories/1688982116Isoran-Imperial-%26-Imperial-DD.webp',
    sourcePageUrl: 'https://hvhindustrial.com/category/megadyne-isoran-imperial-timing-belts',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  mega_megasync_loop: {
    sourceUrl: 'https://cdn.shopify.com/s/files/1/2473/6104/files/Megadyne_MXL_Belts.png',
    sourcePageUrl: 'https://www.totallybelts.com/collections/megadyne-timing-belts',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  sku_38082_real: {
    sourceUrl: 'https://pidbir.parts/imgs/dongil-rubber-belt-drb/4pk990.webp',
    sourcePageUrl: 'https://pidbir.parts/en/dongil-rubber-belt-drb/4pk990',
    manufacturer: 'DRB Dongil Corporation (South Korea)',
  },
  sku_58357_real: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/64/56/74/1701271904/optibelt-timing-belt-11208m20mm_64255.jpeg',
    sourcePageUrl: 'https://www.allaoui.shop/en/optibelt-timing-belt-1120-8m',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  sku_35271_real: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/b0/65/d3/1701875797/optibelt-timing-belt-12808m25mm_64949_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-1280-8m-25mm-timing-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  sku_32121_real: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/6f/75/d0/1702566849/optibelt-v-ribbed-belt-6pj1168rb_65633.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-6pj-1168-rb-v-ribbed-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  sku_34029_real: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/e6/4e/e9/1702566827/optibelt-v-ribbed-belt-6pj127010_65572.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-6pj-1270-10-v-ribbed-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  sku_35116_real: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/bf/7c/da/1700734172/optibelt-v-ribbed-belt-pj1092_63692_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-pj-1092-v-ribbed-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  sku_53301_real: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/8f/f0/ce/1703084820/optibelt-timing-belt-zr1000h10025_65955_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-zr-1000-h-100-25-timing-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  sku_53283_real: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/f7/a8/73/1703084766/optibelt-toothed-belt-360h20_65944_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-360-h-20-toothed-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  sku_39130_real: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/22/f1/ac/1704377164/optibelt-timing-belt-zr285l20_66752.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-zr-285-l-20-timing-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  sku_33016_real: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/81/39/cc/1701700262/megadyne-timing-belt-1120rpp820mm_64727_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/megadyne-1120-rpp8-20mm-timing-belt',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  sku_33042_real: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/db/4e/8e/1701875785/megadyne-timing-belt-1040rpp830mm_64792_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/megadyne-1040-rpp8-30mm-timing-belt',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  opti_zr_420l_closeup: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/61/f3/0a/1703085343/optibelt-timing-belt-zr420l20mm_65984_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-zr-420-l-20mm-timing-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_omega_2000_8m_closeup: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/2f/6e/2f/1700832861/optibelt-timing-belt-20008m30mmhp_64062.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-2000-8m-30mm-hp-timing-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_rb_pj_610_closeup: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/12/a7/8b/1702566687/optibelt-v-ribbed-belt-8pj61020_65618_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-8pj-610-20-v-ribbed-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_zr_h_240_loop: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/16/ca/53/1704295228/optibelt-timing-belt-zr240h25_66656.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-zr-240-h-25-timing-belt-used',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_zr_h_660_angle: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/43/dc/7e/1704295602/optibelt-timing-belt-660h40_66672_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-660-h-40-timing-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_zr_h_800_detail: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/86/2d/4e/1704295792/optibelt-timing-belt-zr800h38mm_66638_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-zr-800-h-38mm-timing-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_zr_h_1000_closeup: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/98/72/72/1704377465/optibelt-timing-belt-1000h75_66729_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-1000-h-75-timing-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  mega_8m_880_main: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/da/0a/14/1701700318/megadyne-timing-belt-880rpp850mm_64721.jpeg',
    sourcePageUrl: 'https://allaoui.shop/megadyne-880-rpp8-50mm-timing-belt',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  mega_8m_880_angle: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/a3/97/8b/1701700323/megadyne-timing-belt-880rpp850mm_64730_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/megadyne-880-rpp8-50mm-timing-belt',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  mega_8m_1440_detail: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/5f/9c/40/1700733206/megadyne-toothed-belt-1440rpp8_63731.jpeg',
    sourcePageUrl: 'https://allaoui.shop/megadyne-1440rpp8-toothed-belt',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  mega_8m_1440_closeup: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/99/9b/5f/1700733222/megadyne-toothed-belt-1440rpp8_63734_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/megadyne-1440rpp8-toothed-belt',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  bando_h_1000_angle: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/ce/cd/32/1702996244/bando-timing-belt-1000h25mm_65823.jpeg',
    sourcePageUrl: 'https://allaoui.shop/bando-1000-h-25mm-timing-belt',
    manufacturer: 'Bando Chemical Industries (Japan)',
  },
  bando_h_700_detail: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/bc/74/89/1702910758/bando-timing-belt-700h50_65820.jpeg',
    sourcePageUrl: 'https://allaoui.shop/bando-700-h-50-timing-belt',
    manufacturer: 'Bando Chemical Industries (Japan)',
  },
  bando_h_420_closeup: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/19/fb/97/1703145053/bando-timing-belt-420h25_65635.jpeg',
    sourcePageUrl: 'https://allaoui.shop/bando-420-h-25-timing-belt',
    manufacturer: 'Bando Chemical Industries (Japan)',
  },
  mega_h_420_detail: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/8b/23/84/1703145028/megadyne-timing-belt-420h23_65629.jpeg',
    sourcePageUrl: 'https://allaoui.shop/megadyne-420-h-23-timing-belt',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  mega_h_420_closeup: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/0f/4e/cc/1703145040/megadyne-timing-belt-420h23_65647_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/megadyne-420-h-23-timing-belt',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  mega_t5_340_angle: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/d6/97/b6/1702642771/megadyne-toothed-belt-t534025_65729.jpeg',
    sourcePageUrl: 'https://allaoui.shop/megadyne-t5-340-25-toothed-belt',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  mega_t5_340_detail: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/a8/a6/6d/1702642780/megadyne-toothed-belt-t534025_65766_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/megadyne-t5-340-25-toothed-belt',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  mega_t5_340_closeup: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/af/16/ae/1702642775/megadyne-toothed-belt-t534025_65747_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/megadyne-t5-340-25-toothed-belt',
    manufacturer: 'Megadyne Group — Ammega (Italy)',
  },
  pu_round_orange_poly_cord: {
    sourceUrl: 'https://www.behabelt.com/site/assets/files/5750/rr_pu80a_orange_glatt_polyester.jpg',
    sourcePageUrl: 'https://www.behabelt.com/en/products/pu-belting/round-belts/',
    manufacturer: 'Behabelt (Germany)',
  },
  fec_pu_v_profiles_closeup: {
    sourceUrl: 'https://www.fecconsulting.dk/images/stories/virtuemart/category/PU%20kileremme.webp',
    sourcePageUrl: 'https://www.fecconsulting.dk/en/products/v-belts',
    manufacturer: 'FEC Consulting Industrial Belting (Denmark)',
  },
  opti_spa_2582_loop: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/e4/92/39/1703063424/optibelt-v-belt-spa2582lw_65951.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-spa-2582-lw-v-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
  opti_spa_2582_macro: {
    sourceUrl: 'https://sw-media.fra1.cdn.digitaloceanspaces.com/prod/sw6/public/media/7e/0e/3d/1703063432/optibelt-v-belt-spa2582lw_65953_dtlprdimg.jpeg',
    sourcePageUrl: 'https://allaoui.shop/optibelt-spa-2582-lw-v-belt',
    manufacturer: 'Arntz Optibelt Group (Germany)',
  },
};

async function syncVerifiedBeltPhotos() {
  const prov = JSON.parse(fs.readFileSync(PROVENANCE_PATH, 'utf8')) as Record<
    string,
    { sourceUrl: string; sourcePageUrl?: string; manufacturer?: string; file?: string }
  >;

  const verifiedDir = path.join(PUBLIC_DIR, 'belt-catalog/verified');
  fs.mkdirSync(verifiedDir, { recursive: true });

  // Clean up any previously materialized files for purged visual-audit mismatches
  for (const purgedKey of PURGED_VISUAL_AUDIT_KEYS) {
    for (const ext of ['.jpg', '.jpeg', '.png', '.webp']) {
      const stale = path.join(verifiedDir, `${purgedKey}${ext}`);
      if (fs.existsSync(stale)) {
        fs.unlinkSync(stale);
      }
    }
  }

  const candidates: Array<[string, { sourceUrl: string; sourcePageUrl: string; manufacturer: string }]> = [];
  for (const [key, meta] of Object.entries(prov)) {
    if (!meta?.sourceUrl) continue;
    if (PURGED_VISUAL_AUDIT_KEYS.has(key)) continue;
    candidates.push([
      key,
      {
        sourceUrl: meta.sourceUrl,
        sourcePageUrl: meta.sourcePageUrl || meta.sourceUrl,
        manufacturer: meta.manufacturer || 'Industrial Manufacturer',
      },
    ]);
  }
  for (const [key, meta] of Object.entries(EXTRA_VERIFIED_CANDIDATES)) {
    candidates.push([key, meta]);
  }

  // Known local pre-cached & visually-verified files (instant offline-resilient materialization)
  const fallbackCacheByKey: Record<string, string> = {
    imp_opti_loop: path.join(TMP_CACHE_DIR, 'belt-verified/families/FAM-34388/slot-01.jpg'),
    imp_opti_cut: path.join(TMP_CACHE_DIR, 'belt-verified/families/FAM-34388/slot-03.jpg'),
    pu_round_loop: path.join(TMP_CACHE_DIR, 'belt-verified/families/FAM-52319/slot-01.jpg'),
    sku_52009_real: path.join(TMP_CACHE_DIR, 'belt-verified/skus/52009/real-marking.jpg'),
    sku_52050_real: path.join(TMP_CACHE_DIR, 'belt-verified/skus/52050/real-marking.jpg'),
    sku_41349_real: path.join(TMP_CACHE_DIR, 'belt-verified/skus/41349/real-marking.jpg'),
    pu_round_coils_main: '/tmp/belt-candidates/07_poly_urethane_round.jpg',
    pu_round_curved_angle: '/tmp/belt-candidates/08_fec_round_pu.webp',
    pu_round_green_aramid_cord: '/tmp/belt-candidates/01_beha_grn_rough_aramid.jpg',
    beha_v_green_smooth: '/tmp/belt-candidates/13_beha_v_grn_smooth.jpg',
    beha_v_green_aramid: '/tmp/belt-candidates/14_beha_v_grn_aramid.jpg',
    beha_v_beige_poly: '/tmp/belt-candidates/15_beha_v_beige_poly.jpg',
    opti_zr_270l_angle: '/tmp/belt-candidates-2/w2_23_507_XH_500_Optibel.png',
    opti_zr_xl_loop: '/tmp/belt-candidates-2/w2_07_opti_xl.png',
    opti_omega_hp_loop: '/tmp/belt-candidates-2/w2_09_opti_omega_hp.png',
    opti_omega_1096_8m: '/tmp/belt-candidates/28_fec_opti_8m_2.webp',
    opti_omega_880_8m: '/tmp/belt-candidates/27_fec_opti_8m_1.webp',
    opti_vb_classic_loop: '/tmp/belt-candidates-2/w2_05_opti_vb_large.png',
    opti_sk_spb_loop: '/tmp/belt-candidates-2/w2_06_opti_sk.png',
    opti_supertx_cog_loop: '/tmp/belt-candidates-2/w2_25_CX79_2000_Optibelt.png',
    opti_superxe_xpa_loop: '/tmp/belt-candidates-2/w2_10_opti_super_xe.png',
    opti_rb_pj_coil: '/tmp/belt-candidates/30_tb_opti_rb.png',
    opti_rb_pj_official: '/tmp/belt-candidates/31_opti_official_rb.jpg',
    fec_pj_ribs_macro: '/tmp/belt-candidates/32_fec_pj_polyv.webp',
    opti_rb_pl_wide_loop: '/tmp/belt-candidates-2/w2_12_opti_rb_lg.png',
    dh_loop_main: '/tmp/belt-candidates-2/w2_13_opti_dh.png',
    fec_htd_rubber_loop: '/tmp/belt-candidates/29_fec_htd_rubber.webp',
    bando_reds_classic_loop: '/tmp/belt-candidates-2/w2_16_bando_reds.png',
    mega_oleostatic_c_loop: '/tmp/belt-candidates/39_tb_mega_belts.jpg',
    mega_lineax_xpb_loop: '/tmp/belt-candidates-3/w3_09_mega_lineax.png',
    mega_megalinear_t5_roll: '/tmp/belt-candidates-2/w2_14_mega_t5_pu.png',
    mega_isoran_imp_coil: '/tmp/belt-candidates/41_hvh_mega_imp.webp',
    mega_megasync_loop: '/tmp/belt-candidates-2/w2_15_mega_mxl.png',
    sku_38082_real: '/tmp/belt-candidates/45_pidbir_dongil_4pk990.webp',
    sku_58357_real: '/tmp/belt-candidates/26_allaoui_opti_1120_8m.webp',
    sku_35271_real: '/tmp/sku-harvest-allaoui/35271_3.jpeg',
    sku_32121_real: '/tmp/sku-harvest-allaoui/32121_b_1.jpeg',
    sku_34029_real: '/tmp/sku-harvest-allaoui/34029_1.jpeg',
    sku_35116_real: '/tmp/sku-harvest-allaoui/33760_3.jpeg',
    sku_53301_real: '/tmp/sku-harvest-allaoui/53301_2.jpeg',
    sku_53283_real: '/tmp/sku-harvest-allaoui/53283_3.jpeg',
    sku_39130_real: '/tmp/sku-harvest-allaoui/39130_1.jpeg',
    sku_33016_real: '/tmp/sku-harvest-allaoui-b2/33016_3.jpeg',
    sku_33042_real: '/tmp/sku-harvest-allaoui-b2/33042_2.jpeg',
    opti_zr_420l_closeup: '/tmp/sku-harvest-allaoui-b2/fam_opti_l_extra_2.jpeg',
    opti_omega_2000_8m_closeup: '/tmp/sku-harvest-fam4/opti8m_optibelt-2000-8m-30mm-_1.jpeg',
    opti_rb_pj_610_closeup: '/tmp/sku-harvest-allaoui-b2/fam_opti_pj_610_2.jpeg',
    opti_zr_h_240_loop: '/tmp/sku-harvest-allaoui/53695_1.jpeg',
    opti_zr_h_660_angle: '/tmp/sku-harvest-allaoui/34459_2.jpeg',
    opti_zr_h_800_detail: '/tmp/sku-harvest-allaoui/35758_3.jpeg',
    opti_zr_h_1000_closeup: '/tmp/sku-harvest-allaoui-b2/35823_3.jpeg',
    mega_8m_880_main: '/tmp/sku-harvest-allaoui-b2/fam_mega_8m_880_1.jpeg',
    mega_8m_880_angle: '/tmp/sku-harvest-allaoui-b2/fam_mega_8m_880_3.jpeg',
    mega_8m_1440_detail: '/tmp/sku-harvest-allaoui-b2/fam_mega_8m_1440_1.jpeg',
    mega_8m_1440_closeup: '/tmp/sku-harvest-allaoui-b2/fam_mega_8m_1440_2.jpeg',
    bando_h_1000_angle: '/tmp/sku-harvest-allaoui-b2/fam_bando_h_1000_1.jpeg',
    bando_h_700_detail: '/tmp/sku-harvest-allaoui-b2/fam_bando_h_700_1.jpeg',
    bando_h_420_closeup: '/tmp/sku-harvest-allaoui-b2/fam_bando_h_420_1.jpeg',
    mega_h_420_detail: '/tmp/sku-harvest-allaoui-b2/fam_mega_h_420_1.jpeg',
    mega_h_420_closeup: '/tmp/sku-harvest-allaoui-b2/fam_mega_h_420_3.jpeg',
    mega_t5_340_angle: '/tmp/sku-harvest-allaoui-b2/fam_mega_t5_340_1.jpeg',
    mega_t5_340_detail: '/tmp/sku-harvest-allaoui-b2/fam_mega_t5_340_2.jpeg',
    mega_t5_340_closeup: '/tmp/sku-harvest-allaoui-b2/fam_mega_t5_340_3.jpeg',
    pu_round_orange_poly_cord: '/tmp/belt-candidates/03_beha_org_smooth_poly.jpg',
    fec_pu_v_profiles_closeup: '/tmp/belt-candidates/16_fec_pu_v.webp',
    opti_spa_2582_loop: '/tmp/sku-harvest-allaoui-b2/fam_opti_spa_1.jpeg',
    opti_spa_2582_macro: '/tmp/sku-harvest-allaoui-b2/fam_opti_spa_2.jpeg',
  };

  const index: Record<string, VerifiedLocalAssetEntry> = {};
  const failed: Array<{ key: string; url: string }> = [];

  for (const [key, meta] of candidates) {
    const destWebp = path.join(verifiedDir, `${key}.webp`);

    // 1. If genuine .webp already exists, keep it and clean any legacy .jpg/.png duplicate
    if (fs.existsSync(destWebp) && isValidWebpBuffer(fs.readFileSync(destWebp))) {
      for (const oldExt of ['.jpg', '.jpeg', '.png']) {
        const oldFile = path.join(verifiedDir, `${key}${oldExt}`);
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
      }
      const buf = fs.readFileSync(destWebp);
      index[key] = {
        key,
        localPublicPath: `/belt-catalog/verified/${key}.webp`,
        ext: '.webp',
        bytes: buf.length,
        sourceUrl: meta.sourceUrl,
        sourcePageUrl: meta.sourcePageUrl,
        manufacturer: meta.manufacturer,
      };
      continue;
    }

    // 2. If legacy .jpg/.png already exists in /public/belt-catalog/verified, convert to genuine .webp
    const existingLegacy = ['.jpg', '.png', '.jpeg']
      .map((ext) => path.join(verifiedDir, `${key}${ext}`))
      .find((p) => fs.existsSync(p));
    if (existingLegacy) {
      const buf = fs.readFileSync(existingLegacy);
      if (detectImageExt(buf, existingLegacy).valid) {
        const webpBuf = convertBufferOrFileToWebp(existingLegacy, destWebp);
        fs.unlinkSync(existingLegacy);
        index[key] = {
          key,
          localPublicPath: `/belt-catalog/verified/${key}.webp`,
          ext: '.webp',
          bytes: webpBuf.length,
          sourceUrl: meta.sourceUrl,
          sourcePageUrl: meta.sourcePageUrl,
          manufacturer: meta.manufacturer,
        };
        continue;
      }
    }

    // 3. Check known local /tmp pre-downloaded cache, convert to genuine .webp
    const cachedFile = fallbackCacheByKey[key];
    if (cachedFile && fs.existsSync(cachedFile)) {
      const buf = fs.readFileSync(cachedFile);
      if (detectImageExt(buf, meta.sourceUrl).valid) {
        const webpBuf = convertBufferOrFileToWebp(cachedFile, destWebp);
        index[key] = {
          key,
          localPublicPath: `/belt-catalog/verified/${key}.webp`,
          ext: '.webp',
          bytes: webpBuf.length,
          sourceUrl: meta.sourceUrl,
          sourcePageUrl: meta.sourcePageUrl,
          manufacturer: meta.manufacturer,
        };
        continue;
      }
    }

    // 4. Download fresh from verified HTTP 200 URL and convert to genuine .webp
    const fetched = await fetchValidImage([meta.sourceUrl]);
    if (fetched) {
      const tmpSrc = path.join('/tmp', `sp_sync_${key}${fetched.ext}`);
      fs.writeFileSync(tmpSrc, fetched.buf);
      try {
        const webpBuf = convertBufferOrFileToWebp(tmpSrc, destWebp);
        index[key] = {
          key,
          localPublicPath: `/belt-catalog/verified/${key}.webp`,
          ext: '.webp',
          bytes: webpBuf.length,
          sourceUrl: meta.sourceUrl,
          sourcePageUrl: meta.sourcePageUrl,
          manufacturer: meta.manufacturer,
        };
      } finally {
        if (fs.existsSync(tmpSrc)) fs.unlinkSync(tmpSrc);
      }
    } else {
      failed.push({ key, url: meta.sourceUrl });
    }
  }

  fs.writeFileSync(
    path.join(verifiedDir, 'index.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), count: Object.keys(index).length, assets: index, failed }, null, 2),
    'utf8',
  );

  return { index, failed };
}

async function main() {
  const storeRes = await syncStorefrontAssets();
  console.log('Storefront assets synced to /public/images:', storeRes);

  const ownerRes = await syncOwnerConveyorAndCachedStorage();
  console.log('Owner conveyor & cached storage synced to /public:', ownerRes);

  const verifiedRes = await syncVerifiedBeltPhotos();
  console.log(
    `Verified belt photos materialized to /public/belt-catalog/verified: ${Object.keys(verifiedRes.index).length} ok, ${verifiedRes.failed.length} failed`,
  );
  if (verifiedRes.failed.length > 0) {
    console.log('Failed belt downloads:', verifiedRes.failed);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
