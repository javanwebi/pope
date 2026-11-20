import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, Layers, Package, Search } from 'lucide-react';
import { useCatalog } from '../../context/CatalogContext';
import type { Category } from '../../types';
import { resolveCategorySlug } from '../../data/categories';
import { APPROVED_MENU_CATEGORIES, APPROVED_MENU_GROUPS } from '../../data/approvedMenuFallback';
import { resolveExcelCategoryArtwork, normalizeCatalogText } from '../../utils/excelCategoryCatalog';
import { toPersianDigits } from '../../utils/formatters';

interface ReferenceMegaMenuProps {
  onNavigate?: () => void;
  topOffset?: number;
}

export const ReferenceMegaMenu: React.FC<ReferenceMegaMenuProps> = ({
  onNavigate,
  topOffset = 114,
}) => {
  const { navGroups, navCategories } = useCatalog();
  const [search, setSearch] = useState('');

  const groups = useMemo(() => {
    const active = navGroups.filter((g) => /^excel-v2-[0-9]+$/.test(g.id) && g.active !== false);
    if (active.length > 0) return [...active].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    return APPROVED_MENU_GROUPS;
  }, [navGroups]);

  const categories = useMemo(() => {
    const active = navCategories.filter((c) => /^excel-v2-[0-9]+-[0-9]+$/.test(c.slug) && c.active !== false);
    return active.length > 0 ? active : (APPROVED_MENU_CATEGORIES as unknown as Category[]);
  }, [navCategories]);

  const [activeGroupId, setActiveGroupId] = useState<string>(() => groups[0]?.id || 'excel-v2-1');

  const categoryBySlug = useMemo(
    () => new Map(categories.map((c) => [resolveCategorySlug(c.slug), c])),
    [categories],
  );

  const activeGroup = useMemo(
    () => groups.find((g) => g.id === activeGroupId) || groups[0],
    [groups, activeGroupId],
  );

  const filteredCategories = useMemo(() => {
    const q = normalizeCatalogText(search);
    if (q) {
      return categories.filter((c) => {
        const text = normalizeCatalogText(
          `${c.name} ${c.description || ''} ${(c.subcategories || []).join(' ')}`,
        );
        return text.includes(q);
      });
    }
    if (!activeGroup) return categories;
    return activeGroup.categorySlugs
      .map((slug: string) => categoryBySlug.get(resolveCategorySlug(slug)))
      .filter((c: Category | undefined): c is Category => Boolean(c));
  }, [search, categories, activeGroup, categoryBySlug]);

  return (
    <div
      dir="rtl"
      style={{ top: `${Math.max(88, Math.round(topOffset))}px` }}
      className="fixed inset-x-0 z-50 mx-auto max-w-[1280px] px-4"
    >
      <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-[290px_minmax(0,1fr)] max-h-[75vh]">
        {/* Right Sidebar: 14 Industrial Groups */}
        <aside className="bg-[#FAF8F5] border-l border-slate-200 overflow-y-auto p-3 space-y-1">
          <div className="px-2 pb-2 mb-1 border-b border-slate-200/80 flex items-center justify-between text-[11px] font-black text-slate-500">
            <span>گروه‌های صنعتی ({toPersianDigits(groups.length)})</span>
            <Link
              to="/categories"
              onClick={onNavigate}
              className="text-[#E06518] hover:underline inline-flex items-center gap-1"
            >
              <span>همه دسته‌ها</span>
              <ChevronLeft className="w-3 h-3" />
            </Link>
          </div>
          {groups.map((group, idx) => {
            const isSelected = !search.trim() && group.id === activeGroup?.id;
            return (
              <button
                key={group.id}
                type="button"
                onMouseEnter={() => {
                  setSearch('');
                  setActiveGroupId(group.id);
                }}
                onClick={() => {
                  setSearch('');
                  setActiveGroupId(group.id);
                }}
                className={`w-full flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-xs text-right transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-white text-[#E06518] font-black border border-orange-200 shadow-2xs'
                    : 'text-[#37383B] hover:bg-white/80 font-bold'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-orange-50 text-[#E06518] text-[10px] font-black grid place-items-center shrink-0">
                    {toPersianDigits(idx + 1)}
                  </span>
                  <span className="truncate">{group.title}</span>
                </span>
                <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            );
          })}
        </aside>

        {/* Left Content: Categories & Sub-trees */}
        <div className="flex flex-col overflow-hidden bg-white">
          <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="جستجوی سریع دسته، زیرگروه یا قطعه..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3 py-2 text-xs text-[#2B313A] focus:border-[#E06518] focus:bg-white focus:outline-none"
              />
            </div>
            <Link
              to="/categories"
              onClick={onNavigate}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#E06518] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#c85612] transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>مشاهده کاتالوگ جامع دسته‌ها</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredCategories.map((cat) => {
              const artwork = resolveExcelCategoryArtwork(cat.slug, cat.name, cat.image);
              const children = (cat.children || []).filter((n) => n.hidden !== true);
              return (
                <div
                  key={cat.slug}
                  className="rounded-xl border border-slate-200/90 bg-white p-3 hover:border-orange-300 hover:shadow-xs transition-all flex flex-col gap-2.5"
                >
                  <Link
                    to={`/category/${encodeURIComponent(cat.slug)}`}
                    onClick={onNavigate}
                    className="flex items-center gap-2.5 group"
                  >
                    <div className="w-11 h-11 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden shrink-0 grid place-items-center">
                      {artwork ? (
                        <img src={artwork} alt={cat.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-[#E06518]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-[#2B313A] group-hover:text-[#E06518] truncate">
                        {cat.name}
                      </div>
                      <div className="text-[10.5px] text-slate-500 mt-0.5">
                        {toPersianDigits(cat.familyCount ?? cat.count ?? 0)} خانواده ·{' '}
                        {toPersianDigits(cat.skuCount ?? 0)} کد کالا
                      </div>
                    </div>
                  </Link>
                  {children.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                      {children.slice(0, 4).map((node) => (
                        <Link
                          key={node.name}
                          to={`/category/${encodeURIComponent(cat.slug)}?sub=${encodeURIComponent(node.value || node.name)}`}
                          onClick={onNavigate}
                          className="rounded-md bg-slate-50 border border-slate-200/80 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 hover:border-[#E06518] hover:text-[#E06518]"
                        >
                          {node.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredCategories.length === 0 && (
              <div className="col-span-full py-8 text-center text-xs text-slate-500">
                دسته‌ای مطابق عبارت جستجو پیدا نشد.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
