'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Ctx = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  widthPx: number;
};

const BrandSidebarCtx = createContext<Ctx | null>(null);

const LS_KEY = 'brandSidebarCollapsed';

// thresholds
const FORCE_COLLAPSE_AT = 1100; // always collapsed below this
const COLLAPSE_AT = 1280;       // auto-collapse below this
const EXPAND_AT = 1440;         // auto-expand above this

export function BrandSidebarProvider({ children }: { children: React.ReactNode }) {
  // Manual override (null = follow auto)
  const [userOverride, setUserOverride] = useState<boolean | null>(() => {
    if (typeof window === 'undefined') return null;
    const v = localStorage.getItem(LS_KEY);
    if (v === '1') return true;
    if (v === '0') return false;
    return null;
  });

  // Auto states (derived from width)
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  const [forcedByWidth, setForcedByWidth] = useState(false);

  // Resize listener with hysteresis
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;

      // Hard force
      setForcedByWidth(w <= FORCE_COLLAPSE_AT);

      // Soft auto (hysteresis)
      setAutoCollapsed(prev => {
        if (w < COLLAPSE_AT) return true;
        if (w > EXPAND_AT) return false;
        return prev;
      });

      // If entering forced zone while user forced expand, relinquish override
      if (w <= FORCE_COLLAPSE_AT && userOverride === false) {
        setUserOverride(null);
        if (typeof window !== 'undefined') localStorage.removeItem(LS_KEY);
      }
    };

    onResize(); // initial
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userOverride]);

  // Final, effective collapsed state
  const effectiveCollapsed = forcedByWidth ? true : (userOverride ?? autoCollapsed);

  // Width from effective state
  const widthPx = effectiveCollapsed ? 64 : 336;

  // Persist user override when it changes
  const setCollapsed = (v: boolean) => {
    setUserOverride(v);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_KEY, v ? '1' : '0');
    }
  };

  // Expose width to CSS var for layout
  useEffect(() => {
    document.documentElement.style.setProperty('--brand-sidebar-w', `${widthPx}px`);
  }, [widthPx]);

  const value = useMemo<Ctx>(
    () => ({ collapsed: effectiveCollapsed, setCollapsed, widthPx }),
    [effectiveCollapsed, widthPx]
  );

  return <BrandSidebarCtx.Provider value={value}>{children}</BrandSidebarCtx.Provider>;
}

export function useBrandSidebar() {
  const ctx = useContext(BrandSidebarCtx);
  if (!ctx) throw new Error('useBrandSidebar must be used inside <BrandSidebarProvider>');
  return ctx;
}
