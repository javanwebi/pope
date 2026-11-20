import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Package, RotateCcw, Search } from 'lucide-react';
import type { Product } from '../types';
import { useCatalog } from '../context/CatalogContext';
import { ProductCard } from '../components/product/ProductCard';
import { toPersianDigits } from '../utils/formatters';

interface ProductsResponse {
  success: boolean;
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  brands: Array<{ name: string; count: number }>;
}

export const ProductsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { navCategories, wishlist } = useCatalog();

  const q = searchParams.get('q') || '';
  const category = searchParams.get('category') || 'all';
  const brand = searchParams.get('brand') || '';
  const sort = searchParams.get('sort') || 'featured';
  const savedOnly = searchParams.get('saved') === '1';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [data, setData] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const updateParam = (key: string, value: string, resetPage = true) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== 'all') next.set(key, value);
    else next.delete(key);
    if (resetPage && key !== 'page') next.delete('page');
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category && category !== 'all') params.set('category', category);
    if (brand) params.set('brand', brand);
    if (sort) params.set('sort', sort);
    params.set('page', String(page));
    params.set('limit', '24');

    fetch(`/api/catalog/products?${params.toString()}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json: ProductsResponse) => {
        if (!controller.signal.aborted && json?.success) {
          setData(json);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [q, category, brand, sort, page]);

  const approvedCats = navCategories.filter((c) => /^excel-v2-[0-9]+-[0-9]+$/.test(c.slug));
  const items = savedOnly
    ? (data?.items || []).filter((p) => wishlist.includes(p.code))
    : data?.items || [];

  return (
    <div dir="rtl" className="min-h-screen bg-[#FAF8F5] py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-[1440px] mx-auto space-y-6">
        <nav className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Link to="/" className="hover:text-[#E06518]">صفحه اصلی</Link>
          <ChevronLeft className="w-3.5 h-3.5" />
          <Link to="/categories" className="hover:text-[#E06518]">دسته‌بندی‌ها</Link>
          <ChevronLeft className="w-3.5 h-3.5" />
          <span className="text-[#2B313A] font-black">همه محصولات کاتالوگ</span>
        </nav>

        <header className="rounded-2xl border border-[#e6dfd5] bg-white p-5 sm:p-6 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-black text-[#2B313A]">
              کاتالوگ جامع محصولات و خانواده‌های فنی
            </h1>
            <p className="text-xs text-slate-500">
              جستجو، فیلتر برند و بررسی کدهای فنی ثبت‌شده در پایگاه داده صنعت پیش ({toPersianDigits(data?.total ?? 0)} خانواده)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[240px] flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={q}
                onChange={(e) => updateParam('q', e.target.value)}
                placeholder="جستجوی کد، سایز یا نام قطعه..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 pr-9 pl-3 py-2 text-xs focus:border-[#E06518] focus:bg-white focus:outline-none"
              />
            </div>

            <select
              value={category}
              onChange={(e) => updateParam('category', e.target.value)}
              aria-label="فیلتر دسته"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#2B313A]"
            >
              <option value="all">همه دسته‌ها ({toPersianDigits(approvedCats.length)})</option>
              {approvedCats.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={brand}
              onChange={(e) => updateParam('brand', e.target.value)}
              aria-label="فیلتر برند"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#2B313A]"
            >
              <option value="">همه برندها</option>
              {(data?.brands || []).map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} ({toPersianDigits(b.count)})
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => updateParam('sort', e.target.value)}
              aria-label="مرتب‌سازی"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#2B313A]"
            >
              <option value="featured">پرفروش‌ترین / منتخب</option>
              <option value="sku_desc">بیشترین کد فنی</option>
              <option value="name">الفبایی</option>
            </select>
          </div>
        </header>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div
                key={idx}
                className="h-72 rounded-2xl border border-slate-200 bg-white animate-pulse"
              />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3">
            <Package className="w-10 h-10 text-slate-400 mx-auto" />
            <h2 className="text-sm font-black text-[#2B313A]">محصولی با این مشخصات پیدا نشد</h2>
            <button
              type="button"
              onClick={() => setSearchParams({}, { replace: true })}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#E06518] px-4 py-2 text-xs font-bold text-white cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>پاک کردن فیلترها</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map((product) => (
              <ProductCard key={product.code} product={product} />
            ))}
          </div>
        )}

        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => updateParam('page', String(page - 1), false)}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white grid place-items-center disabled:opacity-40 cursor-pointer"
              aria-label="صفحه قبلی"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-600 px-3">
              صفحه {toPersianDigits(data.page)} از {toPersianDigits(data.totalPages)}
            </span>
            <button
              type="button"
              disabled={page >= data.totalPages}
              onClick={() => updateParam('page', String(page + 1), false)}
              className="w-9 h-9 rounded-xl border border-slate-200 bg-white grid place-items-center disabled:opacity-40 cursor-pointer"
              aria-label="صفحه بعدی"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;
