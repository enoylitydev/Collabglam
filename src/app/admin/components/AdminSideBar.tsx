"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home,
  Users,
  List,
  Menu,
  X,
  DollarSign,
  MessageCircleIcon,
  MailCheckIcon,
  FileText,
  ChevronDown,
  ChevronUp,
  LogOut,
  Bell,             // 👈 NEW
} from "lucide-react";

const navItems = [
  { label: "Brands", href: "/admin/brands", icon: Home },
  { label: "Influencers", href: "/admin/influencers", icon: Users },
  { label: "All Campaigns", href: "/admin/campaigns", icon: List },
  { label: "Subscriptions", href: "/admin/subscriptions", icon: DollarSign },
  { label: "Disputes", href: "/admin/disputes", icon: FileText },
  { label: "Messages", href: "/admin/messages", icon: MessageCircleIcon },
  { label: "E-Mails", href: "/admin/emails", icon: MailCheckIcon },
  { label: "Influencer-Email", href: "/admin/influencerdetails", icon: MailCheckIcon },
  { label: "Missing-Email", href: "/admin/missingemail", icon: MailCheckIcon },

  // 👇 NEW payment notification item
  { label: "Payment Notification", href: "/admin/payment", icon: Bell },
];

const documentLinks = [
  { label: "Contact US Page Email", href: "/admin/documents/contact-us" },
  { label: "FAQs", href: "/admin/documents/faqs" },
  { label: "Privacy Policy", href: "/admin/documents/privacy-policy" },
  { label: "Terms of Service", href: "/admin/documents/terms-of-service" },
  { label: "Cookie Policy", href: "/admin/documents/cookie-policy" },
  { label: "Shipping & Delivery Policy", href: "/admin/documents/shipping-delivery" },
  { label: "Returns Policy", href: "/admin/documents/return-policy" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const initialDocsOpen = pathname.startsWith("/admin/documents/");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(initialDocsOpen);

  useEffect(() => {
    if (pathname.startsWith("/admin/documents/")) {
      setDocsOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
  }, [drawerOpen]);

  const drawerVariants = {
    hidden: { x: "-100%" },
    visible: { x: "0%" },
  };

  const handleLogout = () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.clear();
      }
    } catch (e) {
      // ignore
    }
    router.push("/admin/login");
  };

  const renderLink = (
    { label, href, icon: Icon }: any,
    onClick?: () => void
  ) => {
    const active = pathname === href || pathname.startsWith(href + "/");
    return (
      <Link
        key={href}
        href={href}
        onClick={onClick}
        className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none ${
          active
            ? "bg-[#ef2f5b]/20 text-[#ef2f5b]"
            : "text-gray-700 hover:bg-gray-100 hover:text-gray-900"
        }`}
      >
        {Icon && (
          <Icon
            className={`mr-3 h-5 w-5 transition-colors ${
              active ? "text-[#ef2f5b]" : "text-gray-400 hover:text-gray-500"
            }`}
          />
        )}
        <span className="whitespace-nowrap flex-1">{label}</span>
      </Link>
    );
  };

  const renderDocuments = (isMobile = false) => (
    <div>
      <button
        onClick={() => setDocsOpen((prev) => !prev)}
        className="flex items-center w-full px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none"
      >
        <FileText className="mr-3 h-5 w-5 text-gray-400 hover:text-gray-500" />
        <span className="flex-1 text-left">Documents</span>
        {docsOpen ? (
          <ChevronUp className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        )}
      </button>
      <AnimatePresence initial={false}>
        {docsOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="ml-6 mt-2 space-y-1 overflow-hidden"
          >
            {documentLinks.map(({ label, href }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => {
                    if (isMobile) setDrawerOpen(false);
                  }}
                  className={`block px-3 py-1 text-sm rounded-lg transition-colors focus:outline-none ${
                    active
                      ? "bg-[#ef2f5b]/20 text-[#ef2f5b]"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-800"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <>
      {/* Mobile Topbar */}
      <header className="md:hidden fixed inset-x-0 top-0 z-50 h-12 bg-white border-b flex items-center px-4 shadow-sm">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#ef2f5b]"
        >
          <Menu className="h-6 w-6 text-gray-700" />
        </button>

        <div className="flex items-center space-x-2 px-4 py-3 hover:bg-gray-50 focus:outline-none focus:bg-gray-100">
          <img src="/logo.png" alt="CollabGlam logo" className="h-8 w-auto" />
          <span className="text-xl font-semibold">CollabGlam</span>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:flex-col w-64 bg-white border-r transition-all duration-200 lg:w-72">
        <div className="flex items-center space-x-2 px-4 py-3 hover:bg-gray-50 focus:outline-none focus:bg-gray-100">
          <img src="/logo.png" alt="CollabGlam logo" className="h-8 w-auto" />
          <span className="text-xl font-semibold">CollabGlam</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
          {navItems.map((item) => renderLink(item))}
          {renderDocuments(false)}
        </nav>

        {/* Desktop Logout Footer */}
        <div className="border-t px-2 py-3">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-start px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400 cursor-pointer"
          >
            <LogOut className="mr-3 h-5 w-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />

            <motion.aside
              className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r flex flex-col"
              initial="hidden"
              animate="visible"
              exit="hidden"
              variants={drawerVariants}
              transition={{ type: "tween", duration: 0.2 }}
            >
              <div className="h-12 flex items-center justify-between px-4 border-b">
                <Link href="/admin" className="flex items-center space-x-2">
                  <img src="/logo.png" alt="CollabGlam logo" className="h-8 w-auto" />
                  <span className="text-lg font-semibold">CollabGlam</span>
                </Link>
                <button
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close menu"
                  className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#ef2f5b]"
                >
                  <X className="h-6 w-6 text-gray-700" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
                {navItems.map((item) =>
                  renderLink(item, () => setDrawerOpen(false))
                )}
                {renderDocuments(true)}
              </nav>

              {/* Mobile Logout Footer */}
              <div className="border-t px-4 py-3">
                <button
                  onClick={() => {
                    setDrawerOpen(false);
                    handleLogout();
                  }}
                  className="w-full flex items-center justify-start px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
                >
                  <LogOut className="mr-3 h-5 w-5" />
                  <span>Logout</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
