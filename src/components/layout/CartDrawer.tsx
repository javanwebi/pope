import React from 'react';
import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { useCatalog } from '../../context/CatalogContext';
import { ProductImage } from '../product/ProductImage';
import { formatPrice, toPersianDigits } from '../../utils/formatters';

export const CartDrawer: React.FC = () => {
  const {
    cart,
    isCartOpen,
    setIsCartOpen,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    openInquiryModal,
  } = useCatalog();

  if (!isCartOpen) return null;

  const totalAmount = cart.reduce(
    (sum, item) => sum + (item.product.prices?.retail || 0) * item.quantity,
    0,
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-xs"
      dir="rtl"
      onMouseDown={() => setIsCartOpen(false)}
    >
      <aside
        onMouseDown={(e) => e.stopPropagation()}
        aria-label="سبد سفارش و استعلام"
        className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl border-r border-slate-200"
      >
        <div className="px-5 py-4 border-b border-slate-200 bg-[#FAF8F5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-[#E06518]" />
            <h3 className="text-sm font-black text-[#2B313A]">
              سبد سفارش و استعلام ({toPersianDigits(cart.length)})
            </h3>
          </div>
          <button
            type="button"
            onClick={() => setIsCartOpen(false)}
            aria-label="بستن سبد"
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-[#E06518] grid place-items-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto grid place-items-center">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-600">سبد سفارش شما خالی است.</p>
              <Link
                to="/categories"
                onClick={() => setIsCartOpen(false)}
                className="inline-flex rounded-xl bg-[#E06518] px-4 py-2 text-xs font-bold text-white hover:bg-[#c85612]"
              >
                مشاهده دسته‌بندی‌ها
              </Link>
            </div>
          ) : (
            cart.map(({ product, quantity }) => (
              <div
                key={product.code}
                className="rounded-xl border border-slate-200 p-3 flex items-start gap-3 bg-white"
              >
                <div className="w-14 h-14 rounded-lg border border-slate-100 bg-slate-50 overflow-hidden shrink-0">
                  <ProductImage
                    src={product.images?.[0] || product.image}
                    alt={product.name}
                    className="w-full h-full object-contain p-1"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <Link
                    to={`/consumer-dashboard/product/${encodeURIComponent(product.code)}`}
                    onClick={() => setIsCartOpen(false)}
                    className="text-xs font-bold text-[#2B313A] hover:text-[#E06518] line-clamp-2"
                  >
                    {product.name}
                  </Link>
                  <div className="text-[11px] text-slate-500 font-mono" dir="ltr">
                    {product.code}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                      <button
                        type="button"
                        aria-label={`افزایش تعداد ${product.code}`}
                        onClick={() => updateCartQuantity(product.code, quantity + 1)}
                        className="w-6 h-6 rounded-md hover:bg-white grid place-items-center text-slate-700 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <span className="px-2 text-xs font-mono font-bold">
                        {toPersianDigits(quantity)}
                      </span>
                      <button
                        type="button"
                        aria-label={`کاهش تعداد ${product.code}`}
                        onClick={() => updateCartQuantity(product.code, quantity - 1)}
                        className="w-6 h-6 rounded-md hover:bg-white grid place-items-center text-slate-700 cursor-pointer"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label={`حذف ${product.code}`}
                      onClick={() => removeFromCart(product.code)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-[#FAF8F5] space-y-3">
            {totalAmount > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-semibold">جمع برآوردی اقلام قیمت‌دار:</span>
                <span className="font-mono font-black text-emerald-700">
                  {formatPrice(totalAmount)} تومان
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const summary = cart
                    .map((item) => `${item.product.code} (${item.quantity} ${item.product.unit || 'عدد'})`)
                    .join(' | ');
                  setIsCartOpen(false);
                  openInquiryModal({
                    code: cart.map((i) => i.product.code).slice(0, 3).join(', '),
                    name: `استعلام سبد (${toPersianDigits(cart.length)} قلم کالا)`,
                    quantity: cart.reduce((s, i) => s + i.quantity, 0),
                    unit: 'عدد',
                    notes: `اقلام سبد: ${summary}`,
                  });
                }}
                className="flex-1 rounded-xl bg-[#E06518] py-2.5 text-xs font-bold text-white hover:bg-[#c85612] cursor-pointer transition-colors"
              >
                ثبت نهایی پیش‌فاکتور / استعلام سبد
              </button>
              <button
                type="button"
                onClick={clearCart}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                خالی کردن
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};
