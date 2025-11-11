// File: app/admin/layout.tsx
"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AdminSidebar from "../components/AdminSideBar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  // Allow the login route to render without auth
  const isLoginRoute = pathname === "/admin/login";

  useEffect(() => {
    if (isLoginRoute) {
      setAuthorized(true);
      setReady(true);
      return;
    }

    try {
      // Check either key; adjust if your app uses a single canonical key
      const adminId =
        window.localStorage.getItem("adminId") ??
        window.localStorage.getItem("admin_id");

      if (!adminId) {
        router.replace("/admin/login");
        setAuthorized(false);
      } else {
        setAuthorized(true);
      }
    } finally {
      setReady(true);
    }
  }, [isLoginRoute, router]);

  // Prevent UI flash/hydration mismatch while we check auth
  if (!ready) return null;

  // If unauthorized, we've triggered a redirect—render nothing
  if (!authorized && !isLoginRoute) return null;

  const showSidebar = !isLoginRoute;

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      {showSidebar && <AdminSidebar />}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main
          className={`pt-12 ${
            showSidebar ? "ml-0 md:ml-64 lg:ml-72" : "ml-0"
          } flex-1 overflow-y-auto p-6`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
