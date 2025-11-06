"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  HiHome,
  HiPlusCircle,
  HiClipboardList,
  HiChatAlt2,
  HiCreditCard,
  HiLogout,
  HiMenu,
  HiX,
  HiArchive,
} from "react-icons/hi";
import { HiBanknotes, HiDocument } from "react-icons/hi2";

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: string | number; className?: string }>;
}

const menuItems: MenuItem[] = [
  { name: "Dashboard", href: "/influencer/dashboard", icon: HiHome },
  { name: "Find New Collab", href: "/influencer/new-collab", icon: HiPlusCircle },
  { name: "My Media-Kit", href: "/influencer/media-kit", icon: HiDocument },
  { name: "My Campaigns", href: "/influencer/my-campaign", icon: HiClipboardList },
  { name: "Previous Campaigns", href: "/influencer/prev-campaign", icon: HiArchive },
  { name: "Disputes", href: "/influencer/disputes", icon: HiClipboardList },
  { name: "Messages", href: "/influencer/messages", icon: HiChatAlt2 },
  { name: "Payment Details", href: "/influencer/payment-detail", icon: HiBanknotes },
  { name: "Subscriptions", href: "/influencer/subscriptions", icon: HiCreditCard },
];

interface InfluencerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function InfluencerSidebar({ isOpen, onClose }: InfluencerSidebarProps) {
  // Auto behavior
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  // Manual override: null = follow auto; true/false = user override
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null);

  const pathname = usePathname();
  const router = useRouter();

  // Collapse thresholds (hysteresis to avoid flicker)
  const COLLAPSE_AT = 1280; // collapse below this width
  const EXPAND_AT = 1440;   // expand above this width

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setAutoCollapsed(prev => {
        if (w < COLLAPSE_AT) return true;
        if (w > EXPAND_AT) return false;
        return prev;
      });
    };
    onResize(); // set initial
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Effective state: manual override wins; otherwise follow auto
  const isCollapsed = (userCollapsed ?? autoCollapsed) === true;

  const handleToggle = () => {
    // If we’re following auto (null), flip relative to auto state.
    // If user already overrode, just flip that.
    setUserCollapsed(prev => (prev === null ? !autoCollapsed : !prev));
  };

  const handleLogout = () => {
    // Remove role-scoped and legacy tokens
    localStorage.removeItem("influencer_token");
    localStorage.removeItem("token");
    router.push("/");
  };

  const renderLinks = () =>
    menuItems.map((item) => {
      const isActive = pathname.startsWith(item.href);
      const base = "flex items-center py-3 px-4 rounded-md transition-all duration-200";
      const active = isActive
        ? "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
        : "text-gray-800 hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58] ";

      return (
        <li key={item.href} className="group">
          <Link
            href={item.href}
            className={`${base} ${active}`}
            title={isCollapsed ? item.name : undefined}
            onClick={onClose}
          >
            <item.icon size={20} className="flex-shrink-0" />
            {!isCollapsed && <span className="ml-3 text-md font-medium">{item.name}</span>}
          </Link>
        </li>
      );
    });

  const sidebarContent = (
    <div
      className={`
        flex flex-col h-full bg-white text-gray-800 shadow-lg
        ${isCollapsed ? "w-16" : "w-74"}
        transition-[width] duration-300 ease-in-out
      `}
    >
      {/* Header */}
      <div className="flex items-center h-16 px-4 border-b border-gray-200">
        <button
          onClick={handleToggle}
          className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFA135]"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <HiMenu size={24} className="text-gray-800" />
        </button>

        <Link href="/influencer/dashboard" className="flex items-center space-x-2 ml-2">
          <img src="/logo.png" alt="CollabGlam logo" className="h-10 w-auto" />
          {!isCollapsed && <span className="text-2xl font-semibold text-gray-900">CollabGlam</span>}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto mt-4">
        <ul className="flex flex-col space-y-1 px-1">{renderLinks()}</ul>
      </nav>

      {/* Logout */}
      <div className="border-t border-gray-200 p-4">
        <button
          onClick={handleLogout}
          className="
            w-full flex items-center py-2 px-4 rounded-md
            text-gray-800 hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58]
            transition-colors duration-200
          "
          title={isCollapsed ? "Logout" : undefined}
        >
          <HiLogout size={20} className="flex-shrink-0" />
          {!isCollapsed && <span className="ml-3 text-md font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex">{sidebarContent}</div>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sidebar panel */}
          <div className="relative flex flex-col h-full bg-white text-gray-800 w-64">
            {/* Header */}
            <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
              <Link href="/influencer/dashboard" className="flex items-center space-x-2">
                <img src="/logo.png" alt="CollabGlam logo" className="h-8 w-auto" />
                <span className="text-xl font-semibold text-gray-900">Influencer Hub</span>
              </Link>
              <button
                onClick={onClose}
                className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFA135]"
                title="Close Sidebar"
              >
                <HiX size={24} className="text-gray-800" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto mt-4">
              <ul className="flex flex-col space-y-1 px-1">{renderLinks()}</ul>
            </nav>

            {/* Logout */}
            <div className="border-t border-gray-200 p-4">
              <button
                onClick={() => {
                  handleLogout();
                  onClose();
                }}
                className="w-full flex items-center py-2 px-4 rounded-md text-gray-800 hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58] transition-colors duration-200"
              >
                <HiLogout size={20} className="flex-shrink-0" />
                <span className="ml-3 text-md font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
