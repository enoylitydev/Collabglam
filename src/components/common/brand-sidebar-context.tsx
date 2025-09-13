// components/common/brand-sidebar-context.tsx
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
const FORCE_COLLAPSE_AT = 1100;
const COLLAPSE_AT = 1280;
const EXPAND_AT = 1440;

export function BrandSidebarProvider({ children }: { children: React.ReactNode }) {
  // IMPORTANT: identical on server and client at first render.
  const [userOverride, setUserOverride] = useState<boolean | null>(null);

  // Auto states (derived from width) – also identical initially
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  const [forcedByWidth, setForcedByWidth] = useState(false);

  // After mount, read localStorage once (safe: effect runs only on client)
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(LS_KEY);
      if (v === '1') setUserOverride(true);
      else if (v === '0') setUserOverride(false);
      else setUserOverride(null);
    } catch {
      // ignore
    }
  }, []);

  // Resize listener with hysteresis (client only)
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;

      setForcedByWidth(w <= FORCE_COLLAPSE_AT);

      setAutoCollapsed(prev => {
        if (w < COLLAPSE_AT) return true;
        if (w > EXPAND_AT) return false;
        return prev;
      });

      if (w <= FORCE_COLLAPSE_AT && userOverride === false) {
        setUserOverride(null);
        try { window.localStorage.removeItem(LS_KEY); } catch {}
      }
    };

    onResize(); // initial client sync
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [userOverride]);

  const effectiveCollapsed = forcedByWidth ? true : (userOverride ?? autoCollapsed);
  const widthPx = effectiveCollapsed ? 64 : 336;

  const setCollapsed = (v: boolean) => {
    setUserOverride(v);
    try { window.localStorage.setItem(LS_KEY, v ? '1' : '0'); } catch {}
  };

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-sidebar-w', `${widthPx}px`);
  }, [widthPx]);

  const value = useMemo<Ctx>(() => (
    { collapsed: effectiveCollapsed, setCollapsed, widthPx }
  ), [effectiveCollapsed, widthPx]);

  return <BrandSidebarCtx.Provider value={value}>{children}</BrandSidebarCtx.Provider>;
}

export function useBrandSidebar() {
  const ctx = useContext(BrandSidebarCtx);
  if (!ctx) throw new Error('useBrandSidebar must be used inside <BrandSidebarProvider>');
  return ctx;
}
