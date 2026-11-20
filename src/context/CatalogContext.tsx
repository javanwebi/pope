import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Category, Product } from '../types';
import type { MenuGroup } from '../utils/excelCategoryCatalog';

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface InquiryRequestTarget {
  code: string;
  name: string;
  unit?: string;
  quantity?: number;
  notes?: string;
}

interface CatalogContextValue {
  cart: CartItem[];
  cartCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (code: string) => void;
  updateCartQuantity: (code: string, quantity: number) => void;
  clearCart: () => void;

  wishlist: string[];
  toggleWishlist: (code: string) => void;
  isInWishlist: (code: string) => boolean;

  panelMode: boolean;
  setPanelMode: (enabled: boolean) => void;
  panelUserName: string;

  inquiryTarget: InquiryRequestTarget | null;
  openInquiryModal: (target: InquiryRequestTarget) => void;
  closeInquiryModal: () => void;

  navGroups: MenuGroup[];
  navCategories: Category[];
  navLoaded: boolean;
}

const CART_STORAGE_KEY = 'sanatpish_cart_v1';
const WISHLIST_STORAGE_KEY = 'sanatpish_wishlist_v1';
const PANEL_MODE_KEY = 'sanatpish_panel_mode_v1';

const CatalogContext = createContext<CatalogContextValue | null>(null);

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const CatalogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>(() => readStoredJson<CartItem[]>(CART_STORAGE_KEY, []));
  const [wishlist, setWishlist] = useState<string[]>(() => readStoredJson<string[]>(WISHLIST_STORAGE_KEY, []));
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [panelMode, setPanelModeState] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(PANEL_MODE_KEY);
      if (saved === '0') return false;
      return true; // Default active to match reference `mahdi` panel view in screenshots
    } catch {
      return true;
    }
  });
  const [inquiryTarget, setInquiryTarget] = useState<InquiryRequestTarget | null>(null);
  const [navGroups, setNavGroups] = useState<MenuGroup[]>([]);
  const [navCategories, setNavCategories] = useState<Category[]>([]);
  const [navLoaded, setNavLoaded] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    try {
      window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlist));
    } catch {
      // Ignore storage quota errors
    }
  }, [wishlist]);

  const setPanelMode = useCallback((enabled: boolean) => {
    setPanelModeState(enabled);
    try {
      window.localStorage.setItem(PANEL_MODE_KEY, enabled ? '1' : '0');
    } catch {
      // Ignore storage errors
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch('/api/catalog/navigation-groups', { signal: controller.signal }).then((r) => (r.ok ? r.json() : null)),
      fetch('/api/catalog/categories', { signal: controller.signal }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([groupsData, catsData]) => {
        if (controller.signal.aborted) return;
        if (groupsData?.success && Array.isArray(groupsData.groups)) {
          setNavGroups(groupsData.groups);
        }
        if (catsData?.success && Array.isArray(catsData.categories)) {
          setNavCategories(catsData.categories);
        }
        setNavLoaded(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setNavLoaded(true);
      });
    return () => controller.abort();
  }, []);

  const addToCart = useCallback((product: Product, quantity = 1) => {
    const qty = Math.max(1, Math.floor(quantity || 1));
    setCart((prev) => {
      const idx = prev.findIndex((item) => item.product.code === product.code);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + qty };
        return next;
      }
      return [...prev, { product, quantity: qty }];
    });
  }, []);

  const removeFromCart = useCallback((code: string) => {
    setCart((prev) => prev.filter((item) => item.product.code !== code));
  }, []);

  const updateCartQuantity = useCallback((code: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => item.product.code !== code));
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.product.code === code ? { ...item, quantity } : item)),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWishlist = useCallback((code: string) => {
    setWishlist((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    );
  }, []);

  const isInWishlist = useCallback((code: string) => wishlist.includes(code), [wishlist]);

  const openInquiryModal = useCallback((target: InquiryRequestTarget) => {
    setInquiryTarget(target);
  }, []);

  const closeInquiryModal = useCallback(() => {
    setInquiryTarget(null);
  }, []);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart],
  );

  const value = useMemo<CatalogContextValue>(
    () => ({
      cart,
      cartCount,
      isCartOpen,
      setIsCartOpen,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      wishlist,
      toggleWishlist,
      isInWishlist,
      panelMode,
      setPanelMode,
      panelUserName: 'mahdi',
      inquiryTarget,
      openInquiryModal,
      closeInquiryModal,
      navGroups,
      navCategories,
      navLoaded,
    }),
    [
      cart,
      cartCount,
      isCartOpen,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      wishlist,
      toggleWishlist,
      isInWishlist,
      panelMode,
      setPanelMode,
      inquiryTarget,
      openInquiryModal,
      closeInquiryModal,
      navGroups,
      navCategories,
      navLoaded,
    ],
  );

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
};

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext);
  if (!ctx) {
    throw new Error('useCatalog must be used within a CatalogProvider');
  }
  return ctx;
}
