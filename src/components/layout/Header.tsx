import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Award,
  Bell,
  BookOpen,
  Calculator,
  Camera,
  CheckCircle2,
  ChevronDown,
  Factory,
  Heart,
  Info,
  LayoutGrid,
  Menu,
  Package,
  Phone,
  Search,
  ShoppingCart,
  Sparkles,
  Tag,
  User,
  X,
} from 'lucide-react';
import { STORE_ASSETS } from '../../assets/images';
import { useCatalog } from '../../context/CatalogContext';
import { toPersianDigits } from '../../utils/formatters';
import { ReferenceMegaMenu } from '../catalog/ReferenceMegaMenu';

interface SearchResultProduct {
  code: string;
  name: string;
  brand: string;
  categoryName: string;
  skuCount: number;
  image: string;
  matchedSku?: string;
  isDirectSku?: boolean;
}

interface SearchResultCategory {
  id: string | number;
  slug: string;
  name: string;
  familyCount?: number;
}

interface SearchResultBrand {
  id: string;
  name: string;
  slug?: string;
}

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const {
    cartCount,
    setIsCartOpen,
    wishlist,
    panelMode,
    setPanelMode,
    panelUserName,
    openInquiryModal,
  } = useCatalog();

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{
    products: SearchResultProduct[];
    categories: SearchResultCategory[];
    brands: SearchResultBrand[];
  }>({ products: [], categories: [], brands: [] });

  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false);
  const [catalogStats, setCatalogStats] = useState<{
    families: number;
    skus: number;
    categories: number;
  } | null>(null);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement>(null);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  const navBarRef = useRef<HTMLDivElement>(null);
  const announcementsRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Instant live DB search against /api/catalog/search
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults({ products: [], categories: [], brands: [] });
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/catalog/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!controller.signal.aborted && data?.success) {
          setSearchResults({
            products: data.products || [],
            categories: data.categories || [],
            brands: data.brands || [],
          });
          setIsSearchOpen(true);
        }
      } catch {
        // Ignore aborted or transient search errors
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 180);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!isAnnouncementsOpen || catalogStats) return;
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!controller.signal.aborted && data?.ok && data?.counts) {
          setCatalogStats({
            families: Number(data.counts.families) || 0,
            skus: Number(data.counts.skus) || 0,
            categories: Number(data.counts.categories) || 0,
          });
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [isAnnouncementsOpen, catalogStats]);

  // Outside click & Escape handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchRef.current && !searchRef.current.contains(target)) setIsSearchOpen(false);
      if (megaMenuRef.current && !megaMenuRef.current.contains(target)) setIsMegaMenuOpen(false);
      if (announcementsRef.current && !announcementsRef.current.contains(target)) setIsAnnouncementsOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(target)) setIsUserMenuOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsSearchOpen(false);
        setIsMegaMenuOpen(false);
        setIsAnnouncementsOpen(false);
        setIsUserMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = searchQuery.trim();
    setIsSearchOpen(false);
    if (q) {
      navigate(`/products?q=${encodeURIComponent(q)}`);
    } else {
      navigate('/products');
    }
  };

  const productLinkFor = (code: string, isDirectSku?: boolean) =>
    isDirectSku
      ? `/direct-product/${encodeURIComponent(code)}`
      : panelMode
        ? `/consumer-dashboard/product/${encodeURIComponent(code)}`
        : `/product/${encodeURIComponent(code)}`;

  return (
    <header className="sticky top-0 z-40 w-full shadow-xs" dir="rtl">
      {/* Hairline orange accent bar matching sanatpish.com */}
      <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-[#E06518] to-transparent opacity-90" />

      {/* Main Header Row (#DEE2E5) */}
      <div className="bg-[#DEE2E5] border-b border-[#C1C8D0] px-3 sm:px-5 py-2 relative z-20">
        <div className="max-w-[1440px] mx-auto flex flex-wrap md:flex-nowrap items-center justify-between gap-2 sm:gap-4">
          {/* Right: Mobile menu toggle + Logo */}
          <div className="flex items-center gap-2 shrink-0 order-1">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="lg:hidden w-9 h-9 rounded-xl border border-[#B5BDC6] bg-white text-[#2B313A] flex items-center justify-center cursor-pointer"
              aria-label="منوی دسته‌بندی‌ها"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            <Link to="/categories" className="flex items-center gap-2 group shrink-0" title="صنعت پیش - پیش به صنعت">
              <img
                src={STORE_ASSETS.sanatPishLogo}
                alt="صنعت پیش"
                className="h-10 sm:h-12 lg:h-[52px] w-auto max-w-[175px] object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              />
            </Link>
          </div>

          {/* Center: Wide Live Search Bar */}
          <div className="order-3 md:order-2 basis-full md:basis-auto md:flex-1 max-w-2xl relative min-w-0" ref={searchRef}>
            <form
              onSubmit={handleSearchSubmit}
              className={`relative w-full flex items-center bg-white rounded-xl border transition-all ${
                isSearchOpen
                  ? 'border-[#E06518] ring-2 ring-[#E06518]/15 shadow-sm'
                  : 'border-[#C5CCD3] hover:border-[#9CA5AF]'
              }`}
            >
              <button
                type="submit"
                aria-label="جستجو"
                className="pr-3 pl-2 py-2.5 text-[#E06518] hover:text-[#c85612] cursor-pointer shrink-0"
              >
                <Search className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
              </button>
              <input
                type="search"
                value={searchQuery}
                onFocus={() => {
                  if (searchQuery.trim().length >= 2) setIsSearchOpen(true);
                }}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="جستجوی قطعه، کد فنی، تسمه، بلبرینگ..."
                aria-label="جستجوی قطعه، کد فنی، تسمه، بلبرینگ"
                className="w-full py-2.5 pl-2 text-xs sm:text-[13px] font-medium text-[#2B313A] placeholder:text-slate-400 bg-transparent focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setIsSearchOpen(false);
                  }}
                  aria-label="پاک کردن جستجو"
                  className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <Link
                to="/products"
                title="جستجو و فیلتر پیشرفته کاتالوگ"
                aria-label="فهرست جامع محصولات"
                className="pl-3 pr-1.5 py-2 text-slate-400 hover:text-[#E06518] transition-colors shrink-0"
              >
                <Camera className="w-4 h-4" />
              </Link>
            </form>

            {/* Search Instant Popup */}
            {isSearchOpen && (
              <div className="absolute right-0 left-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-[#CBD2D8] overflow-hidden z-50 text-right max-h-[72vh] overflow-y-auto">
                {isSearching && (
                  <div className="p-4 text-center text-xs text-slate-500">در حال جستجو در کاتالوگ...</div>
                )}

                {!isSearching && searchResults.products.length > 0 && (
                  <div className="p-2.5 border-b border-slate-100">
                    <div className="px-2 pb-1.5 text-[11px] font-bold text-[#777A7D] flex items-center justify-between">
                      <span>خانواده‌ها و کدهای فنی منطبق</span>
                      <button
                        type="button"
                        onClick={handleSearchSubmit}
                        className="text-[#E06518] hover:underline cursor-pointer"
                      >
                        مشاهده همه نتایج
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {searchResults.products.map((item) => (
                        <Link
                          key={`${item.isDirectSku ? 'direct-' : ''}${item.code}`}
                          to={productLinkFor(item.matchedSku || item.code, item.isDirectSku)}
                          onClick={() => setIsSearchOpen(false)}
                          className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-xl hover:bg-orange-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-9 h-9 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 grid place-items-center">
                              {item.image ? (
                                <img src={item.image} alt="" className="w-full h-full object-contain p-0.5" />
                              ) : (
                                <Package className="w-4 h-4 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-[#2B313A] truncate">{item.name}</div>
                              <div className="text-[10.5px] text-slate-500 flex items-center gap-2">
                                <span className="font-mono" dir="ltr">
                                  {item.matchedSku || item.code}
                                </span>
                                {item.brand && <span>· {item.brand}</span>}
                                <span>· {toPersianDigits(item.skuCount)} کد</span>
                              </div>
                            </div>
                          </div>
                          <span className="text-[10.5px] font-bold text-[#E06518] shrink-0">مشاهده</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {!isSearching && searchResults.categories.length > 0 && (
                  <div className="p-3 bg-slate-50/70 border-b border-slate-100">
                    <div className="text-[11px] font-bold text-[#777A7D] mb-1.5">دسته‌بندی‌های مرتبط</div>
                    <div className="flex flex-wrap gap-1.5">
                      {searchResults.categories.map((cat) => (
                        <Link
                          key={cat.slug}
                          to={`/category/${encodeURIComponent(cat.slug)}`}
                          onClick={() => setIsSearchOpen(false)}
                          className="px-2.5 py-1 bg-white border border-[#CBD2D8] rounded-lg text-[11px] font-semibold hover:border-[#E06518] hover:text-[#E06518]"
                        >
                          {cat.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {!isSearching && searchResults.brands.length > 0 && (
                  <div className="p-3 bg-slate-50/40">
                    <div className="text-[11px] font-bold text-[#777A7D] mb-1.5">برندهای صنعتی</div>
                    <div className="flex flex-wrap gap-2">
                      {searchResults.brands.map((brand) => (
                        <Link
                          key={brand.id}
                          to={`/products?brand=${encodeURIComponent(brand.name)}`}
                          onClick={() => setIsSearchOpen(false)}
                          className="text-xs font-bold text-[#2B313A] hover:text-[#E06518] flex items-center gap-1"
                        >
                          <Award className="w-3 h-3 text-[#E06518]" />
                          <span>{brand.name}</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {!isSearching &&
                  searchResults.products.length === 0 &&
                  searchResults.categories.length === 0 &&
                  searchResults.brands.length === 0 && (
                    <div className="p-5 text-center text-xs text-[#777A7D]">
                      موردی یافت نشد. کلید Enter را برای جستجوی کامل در کاتالوگ فشار دهید.
                    </div>
                  )}
              </div>
            )}
          </div>

          {/* Left: Bell, Wishlist, Cart, User Pill (`mahdi`) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 order-2 md:order-3">
            {/* Announcements Bell */}
            <div className="relative" ref={announcementsRef}>
              <button
                type="button"
                onClick={() => {
                  setIsAnnouncementsOpen((v) => !v);
                  setIsUserMenuOpen(false);
                }}
                aria-label="اطلاعیه‌ها و اعلانات"
                aria-expanded={isAnnouncementsOpen}
                className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-[#B5BDC6] bg-white hover:border-[#E06518] text-[#2B313A] hover:text-[#E06518] flex items-center justify-center transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
              </button>
              {isAnnouncementsOpen && (
                <div className="absolute left-0 top-full mt-2 w-[300px] bg-white rounded-2xl shadow-2xl border border-[#CBD2D8] overflow-hidden z-50 text-right">
                  <div className="px-3.5 py-2.5 bg-[#2B313A] text-white text-xs font-black flex items-center justify-between">
                    <span>اطلاعیه‌های تأمین و کاتالوگ</span>
                    <button
                      type="button"
                      onClick={() => setIsAnnouncementsOpen(false)}
                      className="text-slate-300 hover:text-white cursor-pointer"
                      aria-label="بستن اطلاعیه‌ها"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-3.5 space-y-2.5 text-xs">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 space-y-1">
                      <div className="font-bold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          {catalogStats
                            ? `کاتالوگ جامع ${toPersianDigits(catalogStats.families)} خانواده و ${toPersianDigits(catalogStats.skus)} کد فعال است`
                            : 'کاتالوگ جامع صنعتی متصل به پایگاه داده فعال است'}
                        </span>
                      </div>
                      <p className="text-[11px] text-emerald-800/80 leading-5">
                        کلیه دسته‌ها، نقشه‌های پروفیل CAD و کدهای فنی از پایگاه داده متصل بارگذاری می‌شوند.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Wishlist */}
            <Link
              to="/products?saved=1"
              title="کالاهای نشان‌شده"
              aria-label="کالاهای نشان‌شده"
              className="relative hidden sm:flex w-10 h-10 rounded-xl border border-[#B5BDC6] bg-white hover:border-[#E06518] text-[#2B313A] hover:text-[#E06518] items-center justify-center transition-colors"
            >
              <Heart className="w-4 h-4" />
              {wishlist.length > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-mono font-bold grid place-items-center border border-white">
                  {toPersianDigits(wishlist.length)}
                </span>
              )}
            </Link>

            {/* Cart */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label={`سبد سفارش و استعلام (${toPersianDigits(cartCount)})`}
              className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl border border-[#B5BDC6] bg-white hover:border-[#E06518] text-[#2B313A] hover:text-[#E06518] flex items-center justify-center transition-colors cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[#E06518] text-white text-[9px] font-mono font-bold grid place-items-center border border-white">
                  {toPersianDigits(cartCount)}
                </span>
              )}
            </button>

            {/* User Pill matching `mahdi` + `m` avatar in screenshots */}
            <div className="relative" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen((v) => !v);
                  setIsAnnouncementsOpen(false);
                }}
                aria-expanded={isUserMenuOpen}
                aria-label="حساب کاربری"
                className="flex items-center gap-2 h-9 sm:h-10 pl-2.5 pr-1.5 rounded-xl border border-[#B5BDC6] bg-white hover:border-[#E06518] text-[#2B313A] transition-colors cursor-pointer"
              >
                <span className="w-7 h-7 rounded-lg bg-[#FCE7D9] text-[#E06518] font-mono font-black text-xs grid place-items-center">
                  {panelMode ? panelUserName.slice(0, 1) : <User className="w-3.5 h-3.5" />}
                </span>
                <span className="hidden sm:inline text-xs font-bold text-[#2B313A]">
                  {panelMode ? panelUserName : 'ورود / پنل'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
              </button>

              {isUserMenuOpen && (
                <div className="absolute left-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-[#CBD2D8] overflow-hidden z-50 text-right text-xs">
                  <div className="px-4 py-3 bg-[#FAF8F5] border-b border-slate-100">
                    <div className="font-black text-[#2B313A]">
                      {panelMode ? `پنل مشتری (${panelUserName})` : 'نمای مهمان کاتالوگ'}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      دسترسی کامل به انتخاب سایز، نقشه CAD و ثبت استعلام
                    </div>
                  </div>
                  <div className="p-1.5 space-y-0.5">
                    <Link
                      to="/categories"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="block px-3 py-2 rounded-lg hover:bg-slate-50 font-semibold text-[#2B313A]"
                    >
                      دسته‌بندی‌های کاتالوگ
                    </Link>
                    <Link
                      to="/products"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="block px-3 py-2 rounded-lg hover:bg-slate-50 font-semibold text-[#2B313A]"
                    >
                      فهرست تمام محصولات
                    </Link>
                    <Link
                      to="/consumer-dashboard/product/FAM-52692"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="block px-3 py-2 rounded-lg hover:bg-orange-50 font-semibold text-[#E06518]"
                    >
                      نمای جزئیات خانواده نمونه (FAM-52692)
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        setPanelMode(!panelMode);
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-right px-3 py-2 rounded-lg hover:bg-slate-50 font-semibold text-slate-600 border-t border-slate-100 mt-1 cursor-pointer"
                    >
                      {panelMode ? 'تغییر به نمای عمومی سایت' : 'فعال‌سازی نمای پنل مشتری'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dark Industrial Secondary Nav Bar (#2B313A) matching screenshots */}
      <div className="bg-[#2B313A] border-b border-slate-800 hidden lg:block text-xs text-white" ref={navBarRef}>
        <div className="max-w-[1440px] mx-auto px-5 flex items-center justify-between">
          <nav className="flex items-center gap-1 text-xs font-medium text-white" aria-label="منوی اصلی کاتالوگ">
            <div
              className="relative"
              ref={megaMenuRef}
              onMouseLeave={() => setIsMegaMenuOpen(false)}
            >
              <button
                type="button"
                aria-haspopup="true"
                aria-expanded={isMegaMenuOpen}
                onClick={() => setIsMegaMenuOpen((v) => !v)}
                className={`flex items-center gap-1.5 py-2.5 px-3 rounded-lg transition-colors cursor-pointer ${
                  isMegaMenuOpen ? 'text-[#E06518] bg-white/5' : 'text-white hover:text-[#E06518] hover:bg-white/5'
                }`}
              >
                <LayoutGrid className="w-4 h-4 text-[#E06518]" />
                <span className="font-bold">همه محصولات</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isMegaMenuOpen ? 'rotate-180 text-[#E06518]' : 'text-slate-400'}`} />
              </button>
              {isMegaMenuOpen && (
                <ReferenceMegaMenu
                  topOffset={navBarRef.current?.getBoundingClientRect().bottom ?? 112}
                  onNavigate={() => setIsMegaMenuOpen(false)}
                />
              )}
            </div>

            <Link
              to="/categories#menu-group-excel-v2-1"
              className="flex items-center gap-1.5 py-2.5 px-3 rounded-lg hover:bg-white/5 hover:text-[#E06518] transition-colors"
            >
              <Factory className="w-4 h-4 text-slate-300" />
              <span>صنایع تحت پوشش</span>
            </Link>

            <Link
              to="/products?brand=FORZA"
              className="flex items-center gap-1.5 py-2.5 px-3 rounded-lg hover:bg-white/5 hover:text-[#E06518] transition-colors"
            >
              <Tag className="w-4 h-4 text-[#E06518]" />
              <span>برندهای همکار</span>
            </Link>

            <Link
              to="/category/excel-v2-1-1"
              className="flex items-center gap-1.5 py-2.5 px-3 rounded-lg hover:bg-white/5 hover:text-[#E06518] transition-colors"
            >
              <Calculator className="w-4 h-4 text-slate-300" />
              <span>محاسبه‌گرهای فنی</span>
            </Link>

            <button
              type="button"
              onClick={() =>
                openInquiryModal({
                  code: 'GENERAL-CONSULT',
                  name: 'مشاوره تخصصی انتخاب قطعه و تأمین صنعتی',
                  unit: 'درخواست',
                  quantity: 1,
                })
              }
              className="flex items-center gap-1.5 py-2.5 px-3 rounded-lg hover:bg-white/5 hover:text-[#E06518] transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#E06518]" />
              <span>مشاوره تخصصی</span>
            </button>

            <Link
              to="/categories"
              className="flex items-center gap-1.5 py-2.5 px-3 rounded-lg hover:bg-white/5 hover:text-[#E06518] transition-colors"
            >
              <Info className="w-4 h-4 text-slate-300" />
              <span>درباره صنعت پیش</span>
            </Link>

            <Link
              to="/products"
              className="flex items-center gap-1.5 py-2.5 px-3 rounded-lg hover:bg-white/5 hover:text-[#E06518] transition-colors"
            >
              <BookOpen className="w-4 h-4 text-slate-300" />
              <span>دانشنامه</span>
            </Link>

            <Link
              to="/belt-audit"
              className="flex items-center gap-1.5 py-2 px-3 rounded-lg bg-[#E06518]/20 border border-[#E06518]/50 text-[#FFB07C] hover:bg-[#E06518] hover:text-white font-bold transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>ممیزی تسمه و ۱۷ خروجی</span>
            </Link>
          </nav>

          {/* Left: Support Phone */}
          <a
            href="tel:03538739900"
            className="flex items-center gap-2 py-2 text-[11.5px] font-bold text-slate-200 hover:text-white transition-colors"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>پشتیبانی صنعتی:</span>
            <span className="font-mono tracking-wide text-white" dir="ltr">
              ۰۳۵-۳۸۷۳۹۹۰۰
            </span>
          </a>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-3 space-y-2 text-xs shadow-lg">
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/categories"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 font-bold text-[#2B313A]"
            >
              <LayoutGrid className="w-4 h-4 text-[#E06518]" />
              <span>همه دسته‌بندی‌ها</span>
            </Link>
            <Link
              to="/products"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 font-bold text-[#2B313A]"
            >
              <Package className="w-4 h-4 text-[#E06518]" />
              <span>تمام محصولات</span>
            </Link>
            <Link
              to="/category/excel-v2-1-1"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 font-bold text-[#2B313A]"
            >
              <span>تسمه تایمینگ</span>
            </Link>
            <Link
              to="/category/excel-v2-1-2"
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 font-bold text-[#2B313A]"
            >
              <span>تسمه وی‌بلت</span>
            </Link>
            <Link
              to="/belt-audit"
              onClick={() => setIsMobileMenuOpen(false)}
              className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-3 py-2.5 font-black text-[#E06518]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>مرکز ممیزی مهندسی تسمه و دانلود ۱۷ فایل خروجی</span>
            </Link>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            <span>پشتیبانی صنعتی:</span>
            <a href="tel:03538739900" className="inline-flex items-center gap-1 font-mono font-bold text-[#E06518]" dir="ltr">
              <Phone className="w-3.5 h-3.5" />
              <span>035-38739900</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
