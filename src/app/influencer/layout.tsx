"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InfluencerSidebar from "@/components/common/infSidebar";
import InfluencerTopbar from "@/components/common/infTopbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const influencerId = localStorage.getItem("influencerId");
    const token = localStorage.getItem("token");

    if (!influencerId || !token) {
      // logout
      localStorage.removeItem("influencerId");
      localStorage.removeItem("token");
      localStorage.clear();

      router.replace("/login"); // change if your login route differs
      return;
    }

    setCheckingAuth(false);
  }, [router]);

  if (checkingAuth) return null; // or a loader

  return (
    <div className="flex h-screen overflow-hidden">
      <InfluencerSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <InfluencerTopbar onSidebarOpen={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto bg-gradient-to-r from-[#FFDB58]/10 to-[#FFBF00]/5">
          {children}
        </main>
      </div>
    </div>
  );
}
