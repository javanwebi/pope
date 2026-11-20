import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { databaseEnabled, verifyDatabaseConnection } from './server/db/connection.ts';
import { registerAssetProxyRoutes } from './server/assetProxy.ts';
import {
  createPriceInquiry,
  getBrands,
  getCatalogSnapshot,
  getCategories,
  getDirectSkuByCode,
  getDirectSkus,
  getLegacyCategoryPayload,
  getMenuCategoryPayload,
  getMenuFamilyIndex,
  getNavigationGroups,
  getProductByCode,
  getVariantReview,
  instantSearch,
  queryAllProducts,
} from './server/catalogService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '2mb' }));

  // Health & catalog snapshot verification
  app.get('/api/health', async (_req, res) => {
    try {
      const snap = await getCatalogSnapshot();
      const totalSkus = snap.productByVariantCode.size + snap.directSkus.length;
      if (!databaseEnabled()) {
        res.json({
          ok: true,
          database: false,
          mode: 'engineered-snapshot',
          counts: {
            groups: snap.groups.length,
            categories: snap.categories.length,
            families: snap.products.length,
            skus: totalSkus,
            directSkus: snap.directSkus.length,
          },
        });
        return;
      }
      const ping = await verifyDatabaseConnection();
      res.json({
        ok: true,
        database: true,
        mode: 'postgresql',
        latencyMs: ping.latencyMs,
        counts: {
          groups: snap.groups.length,
          categories: snap.categories.length,
          families: snap.products.length,
          skus: totalSkus,
          directSkus: snap.directSkus.length,
        },
      });
    } catch (err) {
      res.status(503).json({
        ok: false,
        database: databaseEnabled(),
        message: err instanceof Error ? err.message : 'Catalog snapshot initialization error',
      });
    }
  });

  // Catalog Navigation Groups (14 industrial groups)
  app.get('/api/catalog/navigation-groups', async (_req, res) => {
    try {
      const groups = await getNavigationGroups();
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, groups });
    } catch (error) {
      res.status(503).json({
        success: false,
        groups: [],
        message: error instanceof Error ? error.message : 'خطا در دریافت گروه‌ها',
      });
    }
  });

  // Catalog Categories with live family & SKU counts
  app.get('/api/catalog/categories', async (_req, res) => {
    try {
      const categories = await getCategories();
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, categories });
    } catch (error) {
      res.status(503).json({
        success: false,
        categories: [],
        message: error instanceof Error ? error.message : 'خطا در دریافت دسته‌بندی‌ها',
      });
    }
  });

  // Menu Category (excel-v2-*-*) with resolved families & hydrated product summaries
  app.get('/api/catalog/menu-category/:slug', async (req, res) => {
    try {
      const slug = String(req.params.slug || '').trim();
      if (!/^excel-v2-[0-9]+-[0-9]+$/.test(slug)) {
        res.status(404).json({ success: false, message: 'دسته موجود نیست.' });
        return;
      }
      const payload = await getMenuCategoryPayload(slug);
      if (!payload) {
        res.status(404).json({ success: false, message: 'دسته موجود نیست.' });
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, ...payload });
    } catch (error) {
      res.status(503).json({
        success: false,
        message: error instanceof Error ? error.message : 'خطا در دریافت اطلاعات دسته',
      });
    }
  });

  // Legacy/General Category lookup
  app.get('/api/catalog/category/:slug', async (req, res) => {
    try {
      const slug = decodeURIComponent(String(req.params.slug || '').trim());
      const payload = await getLegacyCategoryPayload(slug);
      if (!payload) {
        res.status(404).json({ success: false, message: 'دسته موجود نیست.' });
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, ...payload });
    } catch (error) {
      res.status(503).json({
        success: false,
        message: error instanceof Error ? error.message : 'خطا در دریافت دسته',
      });
    }
  });

  // Public metadata-only family-to-subcategory index
  app.get('/api/catalog/menu-family-index', async (_req, res) => {
    try {
      const assignments = await getMenuFamilyIndex();
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, assignments });
    } catch (error) {
      res.status(503).json({ success: false, assignments: [] });
    }
  });

  // Paginated & filterable all-products / families endpoint
  app.get('/api/catalog/products', async (req, res) => {
    try {
      const result = await queryAllProducts({
        q: typeof req.query.q === 'string' ? req.query.q : undefined,
        categorySlug: typeof req.query.category === 'string' ? req.query.category : undefined,
        brand: typeof req.query.brand === 'string' ? req.query.brand : undefined,
        inStockOnly: req.query.inStock === '1',
        sort: typeof req.query.sort === 'string' ? req.query.sort : undefined,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 24,
      });
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(503).json({
        success: false,
        items: [],
        total: 0,
        message: error instanceof Error ? error.message : 'خطا در دریافت محصولات',
      });
    }
  });

  // Single Family / Product Detail (resolves FAM-code, variant SKU code, or legacy alias)
  app.get('/api/catalog/product/:code', async (req, res) => {
    try {
      const code = decodeURIComponent(String(req.params.code || '').trim());
      const detail = await getProductByCode(code);
      if (!detail) {
        res.status(404).json({ success: false, message: 'محصول یا کد کالا یافت نشد.' });
        return;
      }
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, ...detail });
    } catch (error) {
      res.status(503).json({
        success: false,
        message: error instanceof Error ? error.message : 'خطا در دریافت مشخصات محصول',
      });
    }
  });

  // Variant technical review lazy endpoint
  app.get('/api/catalog/variant-review/:code', async (req, res) => {
    try {
      const code = decodeURIComponent(String(req.params.code || '').trim());
      const row = await getVariantReview(code);
      if (!row) {
        res.status(404).json({ success: false });
        return;
      }
      res.json({ success: true, code: row.code, technicalReview: row.technicalReview ?? null });
    } catch {
      res.status(503).json({ success: false });
    }
  });

  // Direct SKUs
  app.get('/api/catalog/direct-skus', async (req, res) => {
    try {
      const categorySlug = typeof req.query.categorySlug === 'string' ? req.query.categorySlug.trim() : undefined;
      const categoryPrefix = typeof req.query.categoryPrefix === 'string' ? req.query.categoryPrefix.trim() : undefined;
      const items = await getDirectSkus(categorySlug, categoryPrefix);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ success: true, items });
    } catch {
      res.status(503).json({ success: false, items: [] });
    }
  });

  app.get('/api/catalog/direct-sku/:code', async (req, res) => {
    try {
      const code = decodeURIComponent(String(req.params.code || '').trim());
      const item = await getDirectSkuByCode(code);
      if (!item) {
        res.status(404).json({ success: false, message: 'کد کالا یافت نشد.' });
        return;
      }
      res.json({ success: true, item });
    } catch {
      res.status(503).json({ success: false });
    }
  });

  // Instant search for header bar
  app.get('/api/catalog/search', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : '';
      const results = await instantSearch(q);
      res.json({ success: true, ...results });
    } catch {
      res.status(503).json({ success: false, products: [], categories: [], brands: [] });
    }
  });

  // Brands
  app.get('/api/catalog/brands', async (_req, res) => {
    try {
      const brands = await getBrands();
      res.json({ success: true, brands });
    } catch {
      res.status(503).json({ success: false, brands: [] });
    }
  });

  // Submit real Price Inquiry to PostgreSQL
  app.post('/api/inquiries', async (req, res) => {
    try {
      const { customerName, phone, companyName, productCode, productName, quantity, unit, customerNote } = req.body || {};
      if (!customerName || !String(customerName).trim() || !phone || !String(phone).trim() || !productCode) {
        res.status(400).json({ success: false, message: 'نام، شماره تماس و کد کالا الزامی است.' });
        return;
      }
      const created = await createPriceInquiry({
        customerName: String(customerName),
        phone: String(phone),
        companyName: companyName ? String(companyName) : undefined,
        productCode: String(productCode),
        productName: String(productName || productCode),
        quantity: Number(quantity) || 1,
        unit: unit ? String(unit) : 'عدد',
        customerNote: customerNote ? String(customerNote) : undefined,
      });
      res.status(201).json({ success: true, inquiry: created });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'ثبت استعلام انجام نشد.',
      });
    }
  });

  // Proxy official catalog photos, storefront banners, and CAD belt drawings
  registerAssetProxyRoutes(app);

  // Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SanatPish Catalog server running on http://localhost:${PORT}`);
    // Pre-warm catalog snapshot in background
    void getCatalogSnapshot().catch((err) => {
      console.error('Warmup catalog snapshot error:', err instanceof Error ? err.message : err);
    });
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
