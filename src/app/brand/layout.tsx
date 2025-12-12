'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BrandSidebar from '@/components/common/brandSidebar';
import BrandTopbar from '@/components/common/brandTopbar';
import { BrandSidebarProvider } from '@/components/common/brand-sidebar-context';

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile overlay
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const brandId = localStorage.getItem('brandId');
    const token = localStorage.getItem('token');

    if (!brandId || !token) {
      // logout
      localStorage.removeItem('brandId');
      localStorage.removeItem('token');

      router.replace('/login'); // change if your login route differs
      return;
    }

    setCheckingAuth(false);
  }, [router]);

  if (checkingAuth) return null; // or a loader component

  return (
    <BrandSidebarProvider>
      <div className="flex h-screen overflow-hidden">
        <BrandSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <BrandTopbar onSidebarOpen={() => setSidebarOpen(true)} />

          <main className="max-h-screen flex-1 overflow-y-auto bg-gradient-to-r from-[#FF7241]/20 to-[#FFA135]/40">
            {children}
          </main>
        </div>
      </div>
    </BrandSidebarProvider>
  );
}
