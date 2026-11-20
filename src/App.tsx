/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { CatalogProvider, useCatalog } from './context/CatalogContext';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { CartDrawer } from './components/layout/CartDrawer';
import { InquiryModal } from './components/product/InquiryModal';
import { AllCategoriesPage } from './pages/AllCategoriesPage';
import { ExcelMenuCategoryPage } from './pages/ExcelMenuCategoryPage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { ProductsPage } from './pages/ProductsPage';
import { DirectSkuDetailPage } from './pages/DirectSkuDetailPage';
import { BeltMasterAuditPage } from './pages/BeltMasterAuditPage';

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
};

const FloatingForzaDeskButton: React.FC = () => {
  const { openInquiryModal } = useCatalog();
  return (
    <button
      type="button"
      onClick={() =>
        openInquiryModal({
          code: 'FORZA-DESK',
          name: 'میزکار تخصصی برند FORZA — مشاوره و استعلام فنی',
          unit: 'درخواست',
          quantity: 1,
        })
      }
      className="fixed bottom-4 left-4 z-30 hidden lg:inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 bg-white/95 text-[#E06518] shadow-md backdrop-blur-xs hover:border-[#E06518] hover:bg-orange-50 transition-all cursor-pointer"
      aria-label="میزکار FORZA و ثبت درخواست فنی"
      title="میزکار FORZA و ثبت درخواست فنی"
    >
      <Sparkles className="w-4 h-4" />
    </button>
  );
};

export function App() {
  return (
    <BrowserRouter>
      <CatalogProvider>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col bg-white text-[#2B313A]" dir="rtl">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<AllCategoriesPage />} />
              <Route path="/categories" element={<AllCategoriesPage />} />
              <Route path="/category/:slug" element={<ExcelMenuCategoryPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/product/:code" element={<ProductDetailPage />} />
              <Route path="/products/:code" element={<ProductDetailPage />} />
              <Route path="/consumer-dashboard/product/:code" element={<ProductDetailPage />} />
              <Route path="/account/product/:code" element={<ProductDetailPage />} />
              <Route path="/direct-product/:code" element={<DirectSkuDetailPage />} />
              <Route path="/belt-audit" element={<BeltMasterAuditPage />} />
              <Route path="*" element={<Navigate to="/categories" replace />} />
            </Routes>
          </main>
          <Footer />
          <CartDrawer />
          <InquiryModal />
          <FloatingForzaDeskButton />
        </div>
      </CatalogProvider>
    </BrowserRouter>
  );
}

export default App;
