'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  HiHome,
  HiPlusCircle,
  HiCheckCircle,
  HiUserGroup,
  HiArrowLeftOnRectangle,
  HiBars3,
  HiXMark,
  HiCreditCard,
  HiPlayCircle,
  HiEnvelopeOpen,
  HiUserPlus,
  HiScale,
  HiChatBubbleBottomCenterText,
  HiClipboardDocumentList, // ✅ Guide
} from 'react-icons/hi2';
import { HiClock } from 'react-icons/hi';
import { useBrandSidebar } from './brand-sidebar-context';
import BrandTourModal from './BrandTourModal';

// ✅ use your axios helpers (adjust import path if needed)
import { get, post, getToken } from '@/lib/api';

interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ size?: string | number; className?: string }>;
}

const BASE_MENU_ITEMS: MenuItem[] = [
  { name: 'Dashboard', href: '/brand/dashboard', icon: HiHome },
  { name: 'Create New Campaign', href: '/brand/add-edit-campaign', icon: HiPlusCircle },
  { name: 'Created Campaign', href: '/brand/created-campaign', icon: HiPlayCircle },
  { name: 'Active Campaign', href: '/brand/active-campaign', icon: HiCheckCircle },
  { name: 'Campaign History', href: '/brand/campaign-history', icon: HiClock },
  { name: 'Browse Influencers', href: '/brand/browse-influencer', icon: HiUserGroup },
  { name: 'Invited Influencers', href: '/brand/invited', icon: HiUserPlus },
  { name: 'Disputes', href: '/brand/disputes', icon: HiScale },
  { name: 'Email', href: '/brand/email', icon: HiEnvelopeOpen },
  {
    name: 'Feedback',
    href: 'https://docs.google.com/forms/d/e/1FAIpQLSemRB9YO6-YUJhHe4W4Y2QfEygwqUXW2MYW1QCGyHmUZlzyyg/viewform?usp=preview',
    icon: HiChatBubbleBottomCenterText,
  },
  { name: 'My Subscriptions', href: '/brand/subscriptions', icon: HiCreditCard },
];

interface BrandSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

type OnboardingRes = {
  brandTourSeen?: boolean;
  brandTourSeenAt?: string | null;
};

export default function BrandSidebar({ isOpen, onClose }: BrandSidebarProps) {
  const { collapsed, setCollapsed } = useBrandSidebar();
  const pathname = usePathname();
  const router = useRouter();

  const [planName, setPlanName] = React.useState<string | null>(null);

  // ✅ modal state
  const [tourOpen, setTourOpen] = React.useState(false);

  // ✅ token state (so useEffect can react when token becomes available after hydration)
  const [token, setTokenState] = React.useState<string | null>(null);

  // ✅ avoid duplicate checks (important in React Strict Mode)
  const didCheckOnboardingRef = React.useRef(false);

  // plan name (unchanged)
  React.useEffect(() => {
    try {
      const pn =
        window.localStorage.getItem('brandPlanName') ||
        window.localStorage.getItem('planName');
      setPlanName(pn ? pn.toLowerCase() : null);
    } catch {
      setPlanName(null);
    }
  }, []);

  // ✅ grab token once on client
  React.useEffect(() => {
    setTokenState(getToken());
  }, []);

  // ✅ server-based "show only once" (across devices) using axios API helpers
  React.useEffect(() => {
    if (!token) return;
    if (didCheckOnboardingRef.current) return;

    didCheckOnboardingRef.current = true;

    (async () => {
      try {
        const data = await get<OnboardingRes>('/brand/onboarding');

        if (!data?.brandTourSeen) {
          setTourOpen(true);

          // mark as seen immediately so it never auto-shows again on any device
          post('/brand/onboarding/brand-tour/seen').catch(() => {});
        }
      } catch {
        // fail silently; user can still open via Guide
      }
    })();
  }, [token]);

  const menuItems = React.useMemo(() => {
    if (!planName) return BASE_MENU_ITEMS;
    const isFree = planName === 'free' || planName === 'brand_free';
    if (!isFree) return BASE_MENU_ITEMS;
    return BASE_MENU_ITEMS.filter((item) => item.href !== '/brand/disputes');
  }, [planName]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/');
  };

  const openGuide = () => {
    setTourOpen(true);
    onClose?.(); // closes mobile overlay behind modal
  };

  const renderLinks = () =>
    menuItems.map((item) => {
      const isExternal = item.href.startsWith('http');
      const isActive = !isExternal && pathname.startsWith(item.href);

      const base = 'flex items-center py-3 px-4 rounded-md transition-all duration-200';
      const active = isActive
        ? 'bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white'
        : 'text-gray-800 hover:bg-gradient-to-r hover:from-[#FFA135] hover:to-[#FF7236] hover:text-white';

      return (
        <li key={item.href} className="group">
          <Link
            href={item.href}
            className={`${base} ${active}`}
            title={collapsed ? item.name : undefined}
            onClick={onClose}
            target={isExternal ? '_blank' : undefined}
            rel={isExternal ? 'noopener noreferrer' : undefined}
          >
            <item.icon
              size={20}
              className={`flex-shrink-0 ${
                isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
              }`}
            />
            {!collapsed && <span className="ml-3 text-md font-medium">{item.name}</span>}
          </Link>
        </li>
      );
    });

  const FooterActions = ({ showLabels }: { showLabels: boolean }) => (
    <div className="border-t border-gray-200 p-4 space-y-2">
      {/* ✅ Guide above Logout */}
      <button
        onClick={openGuide}
        className="w-full flex items-center py-2 px-4 rounded-md text-gray-800 hover:bg-gradient-to-r hover:from-[#FFA135] hover:to-[#FF7236] hover:text-white transition-colors duration-200"
        title={!showLabels ? 'Guide' : undefined}
      >
        <HiClipboardDocumentList size={20} className="flex-shrink-0" />
        {showLabels && <span className="ml-3 text-md font-medium">Guide</span>}
      </button>

      <button
        onClick={handleLogout}
        className="w-full flex items-center py-2 px-4 rounded-md text-gray-800 hover:bg-gradient-to-r hover:from-[#FFA135] hover:to-[#FF7236] hover:text-white transition-colors duration-200"
        title={!showLabels ? 'Logout' : undefined}
      >
        <HiArrowLeftOnRectangle size={20} className="flex-shrink-0" />
        {showLabels && <span className="ml-3 text-md font-medium">Logout</span>}
      </button>
    </div>
  );

  const DesktopSidebar = (
    <div
      className="
        flex flex-col h-full bg-white text-gray-800 shadow-lg
        transition-[width] duration-300 ease-in-out
      "
      style={{ width: 'var(--brand-sidebar-w)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FFA135]"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          <HiBars3 size={24} className="text-gray-800" />
        </button>

        <Link href="/brand/dashboard" className="flex items-center space-x-2">
          <img src="/logo.png" alt="Collabglam logo" className="h-10 w-auto" />
          {!collapsed && (
            <span className="text-2xl font-semibold text-gray-900">
              CollabGlam Brand
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto mt-4">
        <ul className="flex flex-col space-y-1 px-1">{renderLinks()}</ul>
      </nav>

      {/* Footer actions */}
      <FooterActions showLabels={!collapsed} />
    </div>
  );

  const MobileSidebar = (
    <div className="relative flex flex-col h-full bg-white text-gray-800 w-64">
      <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
        <Link href="/brand/dashboard" className="flex items-center space-x-2">
          <img src="/logo.png" alt="Collabglam logo" className="h-8 w-auto" />
          <span className="text-xl font-semibold text-gray-900">Brand Portal</span>
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

      {/* Footer actions */}
      <div className="border-t border-gray-200 p-4 space-y-2">
        <button
          onClick={openGuide}
          className="w-full flex items-center py-2 px-4 rounded-md text-gray-800 hover:bg-gradient-to-r hover:from-[#FFA135] hover:to-[#FF7236] hover:text-white transition-colors duration-200"
        >
          <HiClipboardDocumentList size={20} className="flex-shrink-0" />
          <span className="ml-3 text-md font-medium">Guide</span>
        </button>

        <button
          onClick={() => {
            handleLogout();
            onClose();
          }}
          className="w-full flex items-center py-2 px-4 rounded-md text-gray-800 hover:bg-gradient-to-r hover:from-[#FFA135] hover:to-[#FF7236] hover:text-white transition-colors duration-200"
        >
          <HiArrowLeftOnRectangle size={20} className="flex-shrink-0" />
          <span className="ml-3 text-md font-medium">Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex z-40">{DesktopSidebar}</div>

      {/* ✅ Tour modal (controlled) */}
      <BrandTourModal open={tourOpen} onClose={() => setTourOpen(false)} startAt={0} />

      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm"
            onClick={onClose}
          />
          {MobileSidebar}
        </div>
      )}
    </>
  );
}
