// app/brand/layout.tsx
'use client';

import React, { useState } from 'react';
import BrandSidebar from '@/components/common/brandSidebar';
import BrandTopbar from '@/components/common/brandTopbar';
import { BrandSidebarProvider } from '@/components/common/brand-sidebar-context';

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile overlay

  return (
    <BrandSidebarProvider>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar (desktop inline, mobile overlay controlled by isOpen/onClose) */}
        <BrandSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <BrandTopbar onSidebarOpen={() => setSidebarOpen(true)} />

          <main
            className="max-h-screen flex-1 overflow-y-auto
                       bg-gradient-to-r from-[#FF7241]/20 to-[#FFA135]/40"
          >
            {children}
          </main>
        </div>
      </div>
    </BrandSidebarProvider>
  );
}
