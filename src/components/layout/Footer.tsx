import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Clock, Headphones, MapPin, Phone, ShieldCheck } from 'lucide-react';
import { STORE_ASSETS } from '../../assets/images';
import { useCatalog } from '../../context/CatalogContext';

export const Footer: React.FC = () => {
  const { openInquiryModal } = useCatalog();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer dir="rtl" className="border-t border-[#CBD2D8] bg-[#DEE2E5] text-[#2B313A] mt-auto">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 text-right">
          {/* Column 1: Brand Identity */}
          <div className="space-y-3">
            <Link to="/categories" className="inline-flex items-center gap-2.5">
              <img
                src={STORE_ASSETS.sanatPishLogo}
                alt="صنعت پیش"
                className="h-11 w-auto object-contain"
              />
            </Link>
            <p className="text-xs leading-6 text-[#55565A]">
              مرجع تخصصی تأمین قطعات انتقال قدرت، تسمه‌های تایمینگ و وی‌بلت، بلبرینگ، پولی، رولر و تجهیزات خطوط تولید صنعتی از سال ۱۳۶۶.
            </p>
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#2B313A]">
              <ShieldCheck className="w-4 h-4 text-[#E06518]" />
              <span>تأمین مستقیم با ضمانت اصالت فنی</span>
            </div>
          </div>

          {/* Column 2: Quick Catalog Links */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black text-[#2B313A] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E06518]" />
              <span>مسیرهای اصلی کاتالوگ</span>
            </h4>
            <ul className="space-y-1.5 text-xs text-[#55565A]">
              <li>
                <Link to="/categories" className="hover:text-[#E06518] transition-colors">
                  همه دسته‌بندی‌های قطعات صنعتی
                </Link>
              </li>
              <li>
                <Link to="/category/excel-v2-1-1" className="hover:text-[#E06518] transition-colors">
                  تسمه تایمینگ صنعتی و سیم‌دار
                </Link>
              </li>
              <li>
                <Link to="/category/excel-v2-1-2" className="hover:text-[#E06518] transition-colors">
                  تسمه وی‌بلت (V-Belt) کلاسیک و اسپشیال
                </Link>
              </li>
              <li>
                <Link to="/products" className="hover:text-[#E06518] transition-colors">
                  فهرست جامع خانواده‌های محصول
                </Link>
              </li>
              <li>
                <Link to="/consumer-dashboard/product/FAM-52692" className="hover:text-[#E06518] transition-colors">
                  مشخصات نمونه خانواده FORZA AT20
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact & Location */}
          <div className="space-y-2.5 lg:border-r lg:border-[#CBD2D8] lg:pr-5">
            <h4 className="text-xs font-black text-[#2B313A] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E06518]" />
              <span>دفتر مرکزی و انبار یزد</span>
            </h4>
            <div className="space-y-2 text-[11.5px] text-[#55565A]">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-[#E06518] shrink-0 mt-0.5" />
                <p className="leading-6">
                  یزد، بلوار استقلال، کارستان افشار، جنب بانک سپه، بازرگانی اطلس (صنعت پیش)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#E06518] shrink-0" />
                <span>شنبه تا پنجشنبه ۸:۰۰ الی ۲۰:۰۰</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-[#E06518] shrink-0" />
                <a href="tel:03538739900" className="font-mono font-bold text-[#2B313A]" dir="ltr">
                  035-38739900
                </a>
              </div>
            </div>
          </div>

          {/* Column 4: Engineering Support Action */}
          <div className="space-y-3 lg:border-r lg:border-[#CBD2D8] lg:pr-5">
            <h4 className="text-xs font-black text-[#2B313A] flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#E06518]" />
              <span>مشاوره و استعلام سریع</span>
            </h4>
            <p className="text-[11.5px] text-[#55565A] leading-6">
              برای دریافت پیش‌فاکتور رسمی، بررسی موجودی انبار یا معادل‌یابی کد فنی با کارشناسان در ارتباط باشید.
            </p>
            <button
              type="button"
              onClick={() =>
                openInquiryModal({
                  code: 'SUPPORT-DESK',
                  name: 'درخواست مشاوره مهندسی و استعلام قیمت',
                  unit: 'درخواست',
                  quantity: 1,
                })
              }
              className="w-full h-9 rounded-xl border border-[#CBD2D8] bg-white hover:bg-orange-50/60 hover:border-[#E06518] text-[#2B313A] hover:text-[#E06518] flex items-center justify-center gap-2 transition-colors cursor-pointer text-xs font-bold shadow-2xs"
            >
              <Headphones className="w-3.5 h-3.5 text-[#E06518]" />
              <span>درخواست مشاوره مهندسی</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Dark Slate Bar (#2B313A) */}
      <div className="border-t border-[#3F4550] bg-[#2B313A] text-slate-300 py-3.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-[11px]">
            <span className="font-bold text-[#F28C45]">صنعت پیش | بازرگانی تسمه اطلس ۱۳۶۶</span>
            <span className="text-slate-600 hidden sm:inline">|</span>
            <span>کاتالوگ جامع قطعات و تجهیزات صنعتی</span>
          </div>
          <button
            type="button"
            onClick={scrollToTop}
            aria-label="بازگشت به بالا"
            title="بازگشت به بالا"
            className="w-8 h-8 rounded-lg border border-slate-600 bg-[#3F4550] text-slate-200 hover:text-white hover:border-[#E06518] hover:bg-[#E06518] flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
