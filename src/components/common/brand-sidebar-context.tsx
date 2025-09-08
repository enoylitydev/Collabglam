// components/brand-sidebar-context.tsx
'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Ctx = {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  /** Current sidebar width in px (collapsed: 64, expanded: 336) */
  widthPx: number;
};

const BrandSidebarCtx = createContext<Ctx | null>(null);

export function BrandSidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('brandSidebarCollapsed') === '1';
    }
    return false;
  });

  const widthPx = collapsed ? 64 : 336; // w-16 vs w-84 (21rem = 336px)

  useEffect(() => {
    // persist
    localStorage.setItem('brandSidebarCollapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    // expose as CSS variable for easy Tailwind use
    document.documentElement.style.setProperty('--brand-sidebar-w', `${widthPx}px`);
  }, [widthPx]);

  const value = useMemo(() => ({ collapsed, setCollapsed, widthPx }), [collapsed, widthPx]);
  return <BrandSidebarCtx.Provider value={value}>{children}</BrandSidebarCtx.Provider>;
}

export function useBrandSidebar() {
  const ctx = useContext(BrandSidebarCtx);
  if (!ctx) throw new Error('useBrandSidebar must be used inside <BrandSidebarProvider>');
  return ctx;
}
