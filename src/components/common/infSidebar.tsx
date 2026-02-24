"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  HiHome,
  HiUserGroup,
  HiDocumentText,
  HiClipboardDocumentList,
  HiXCircle,
  HiScale,
  HiEnvelopeOpen,
  HiBanknotes,
  HiChatBubbleBottomCenterText,
  HiCreditCard,
  HiArrowLeftOnRectangle,
  HiBars3,
  HiXMark,
  HiPaperAirplane,
} from "react-icons/hi2";
import InfluencerTourModal from "./InfluencerTourModal";

import { get, post, getToken } from "@/lib/api";

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: string | number; className?: string }>;
}

const menuItems: MenuItem[] = [
  { name: "Dashboard", href: "/influencer/dashboard", icon: HiHome },
  { name: "Find New Collab", href: "/influencer/new-collab", icon: HiUserGroup },
  { name: "My Media-Kit", href: "/influencer/media-kit", icon: HiDocumentText },
  { name: "My Campaigns", href: "/influencer/my-campaign", icon: HiClipboardDocumentList },
  { name: "Rejected Campaigns", href: "/influencer/rejected-campaign", icon: HiXCircle },
  { name: "Campaigns Invite", href: "/influencer/campaigns-invite", icon: HiPaperAirplane },
  { name: "Disputes", href: "/influencer/disputes", icon: HiScale },
  { name: "E-Mails", href: "/influencer/email", icon: HiEnvelopeOpen },
  { name: "Payment Details", href: "/influencer/payment-detail", icon: HiBanknotes },
  {
    name: "Feedback",
    href: "https://docs.google.com/forms/d/e/1FAIpQLSemRB9YO6-YUJhHe4W4Y2QfEygwqUXW2MYW1QCGyHmUZlzyyg/viewform?usp=preview",
    icon: HiChatBubbleBottomCenterText,
  },
  { name: "Subscriptions", href: "/influencer/subscriptions", icon: HiCreditCard },
];

interface InfluencerSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type InfluencerOnboardingRes = {
  influencerTourSeen?: boolean;
  influencerTourSeenAt?: string | null;
};

const INFLUENCER_TOUR_LS_KEY = "cg_influencerTourSeen_v1";

const lsGet = (k: string) => {
  try { return window.localStorage.getItem(k); } catch { return null; }
};
const lsSet = (k: string, v: string) => {
  try { window.localStorage.setItem(k, v); } catch {}
};
const lsRemove = (k: string) => {
  try { window.localStorage.removeItem(k); } catch {}
};

export default function InfluencerSidebar({ isOpen, onClose }: InfluencerSidebarProps) {
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  const [userCollapsed, setUserCollapsed] = useState<boolean | null>(null);
  const [planName, setPlanName] = useState<string | null>(null);

  const [tourOpen, setTourOpen] = useState(false);
  const [token, setTokenState] = useState<string | null>(null);
  const didCheckOnboardingRef = useRef(false);

  const pathname = usePathname();
  const router = useRouter();

  const COLLAPSE_AT = 1280;
  const EXPAND_AT = 1440;

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setAutoCollapsed((prev) => {
        if (w < COLLAPSE_AT) return true;
        if (w > EXPAND_AT) return false;
        return prev;
      });
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    setTokenState(getToken());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedPlanName =
      localStorage.getItem("influencerPlanName") ||
      localStorage.getItem("brandPlanName");
    setPlanName(storedPlanName);
  }, []);

  const markLocalSeen = useCallback(() => {
    lsSet(INFLUENCER_TOUR_LS_KEY, "1");
  }, []);

  // ✅ server + local fallback
  useEffect(() => {
    if (!token) return;
    if (didCheckOnboardingRef.current) return;
    didCheckOnboardingRef.current = true;

    const localSeen = lsGet(INFLUENCER_TOUR_LS_KEY) === "1";

    (async () => {
      if (localSeen) {
        post("/influencer/onboarding/influencer-tour/seen").catch(() => {});
        return;
      }

      try {
        const data = await get<InfluencerOnboardingRes>("/influencer/onboarding");

        if (data?.influencerTourSeen) {
          markLocalSeen();
          return;
        }

        setTourOpen(true);
        markLocalSeen();
        post("/influencer/onboarding/influencer-tour/seen").catch(() => {});
      } catch {
        // fallback: show once locally
        setTourOpen(true);
        markLocalSeen();
      }
    })();
  }, [token, markLocalSeen]);

  const isCollapsed = (userCollapsed ?? autoCollapsed) === true;

  const handleToggle = () => {
    setUserCollapsed((prev) => (prev === null ? !autoCollapsed : !prev));
  };

  const handleLogout = () => {
    localStorage.removeItem("influencer_token");
    localStorage.removeItem("token");
    localStorage.removeItem("influencerPlanName");
    localStorage.removeItem("influencerPlanId");
    lsRemove(INFLUENCER_TOUR_LS_KEY); // ✅ so a different influencer on same device can see tour
    router.push("/");
  };

  const openGuide = () => {
    setTourOpen(true);
    markLocalSeen();
    if (token) post("/influencer/onboarding/influencer-tour/seen").catch(() => {});
    onClose?.();
  };

  const filteredMenuItems = menuItems.filter((item) => {
    if (item.name === "Disputes") {
      const normalized = (planName || "").toLowerCase();
      if (!normalized || normalized === "free" || normalized === "influencer_free") return false;
    }
    return true;
  });

  const renderLinks = () =>
    filteredMenuItems.map((item) => {
      const isExternal = item.href.startsWith("http");
      const isActive = !isExternal && pathname.startsWith(item.href);

      const base = "flex items-center py-3 px-4 rounded-md transition-all duration-200";
      const active = isActive
        ? "bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
        : "text-gray-800 hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58]";

      return (
        <li key={item.href} className="group">
          <Link
            href={item.href}
            className={`${base} ${active}`}
            title={isCollapsed ? item.name : undefined}
            onClick={onClose}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noopener noreferrer" : undefined}
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
      <div className="flex items-center h-16 px-4 border-b border-gray-200">
        <button
          onClick={handleToggle}
          className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFA135]"
          title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <HiBars3 size={24} className="text-gray-800" />
        </button>

        <Link href="/influencer/dashboard" className="flex items-center space-x-2 ml-2">
          <img src="/logo.png" alt="CollabGlam logo" className="h-10 w-auto" />
          {!isCollapsed && <span className="text-2xl font-semibold text-gray-900">CollabGlam</span>}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto mt-4">
        <ul className="flex flex-col space-y-1 px-1">{renderLinks()}</ul>
      </nav>

      <div className="border-t border-gray-200 p-4 space-y-2">
        <button
          onClick={openGuide}
          className="w-full flex items-center py-2 px-4 rounded-md text-gray-800 hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58] transition-colors duration-200"
          title={isCollapsed ? "Guide" : undefined}
        >
          <HiClipboardDocumentList size={20} className="flex-shrink-0" />
          {!isCollapsed && <span className="ml-3 text-md font-medium">Guide</span>}
        </button>

        <button
          onClick={handleLogout}
          className="w-full flex items-center py-2 px-4 rounded-md text-gray-800 hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58] transition-colors duration-200"
          title={isCollapsed ? "Logout" : undefined}
        >
          <HiArrowLeftOnRectangle size={20} className="flex-shrink-0" />
          {!isCollapsed && <span className="ml-3 text-md font-medium">Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:flex">{sidebarContent}</div>

      <InfluencerTourModal
        open={tourOpen}
        onClose={() => {
          setTourOpen(false);
          markLocalSeen();
          if (token) post("/influencer/onboarding/influencer-tour/seen").catch(() => {});
        }}
        startAt={0}
      />

      {isOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm" onClick={onClose} />
          <div className="relative flex flex-col h-full bg-white text-gray-800 w-64">
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
                <HiXMark size={24} className="text-gray-800" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto mt-4">
              <ul className="flex flex-col space-y-1 px-1">{renderLinks()}</ul>
            </nav>

            <div className="border-t border-gray-200 p-4 space-y-2">
              <button
                onClick={openGuide}
                className="w-full flex items-center py-2 px-4 rounded-md text-gray-800 hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58] transition-colors duration-200"
              >
                <HiClipboardDocumentList size={20} className="flex-shrink-0" />
                <span className="ml-3 text-md font-medium">Guide</span>
              </button>

              <button
                onClick={() => {
                  handleLogout();
                  onClose();
                }}
                className="w-full flex items-center py-2 px-4 rounded-md text-gray-800 hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58] transition-colors duration-200"
              >
                <HiArrowLeftOnRectangle size={20} className="flex-shrink-0" />
                <span className="ml-3 text-md font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
