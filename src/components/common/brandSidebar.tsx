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
  HiClipboardDocumentList,
} from 'react-icons/hi2';
import { HiClock } from 'react-icons/hi';
import { useBrandSidebar } from './brand-sidebar-context';
import BrandTourModal from './BrandTourModal';

// ✅ axios helpers
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

// ✅ local fallback key (versioned so you can reset later if tour changes)
const BRAND_TOUR_LS_KEY = 'cg_brandTourSeen_v1';

const lsGet = (k: string) => {
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};
const lsSet = (k: string, v: string) => {
  try {
    window.localStorage.setItem(k, v);
  } catch {}
};
const lsRemove = (k: string) => {
  try {
    window.localStorage.removeItem(k);
  } catch {}
};

type BrandPlanRes = {
  brandPlanId: string | null;
  brandPlanName: string | null;
};

export default function BrandSidebar({ isOpen, onClose }: BrandSidebarProps) {
  const { collapsed, setCollapsed } = useBrandSidebar();
  const pathname = usePathname();
  const router = useRouter();

  const [tourOpen, setTourOpen] = React.useState(false);

  // ✅ token state
  const [token, setTokenState] = React.useState<string | null>(null);

  // ✅ plan cache states
  const [brandId, setBrandId] = React.useState<string | null>(null);
  const [planId, setPlanId] = React.useState<string | null>(null);
  const [planName, setPlanName] = React.useState<string | null>(null);

  // ✅ avoid duplicate checks (Strict Mode)
  const didCheckOnboardingRef = React.useRef(false);
  const didFetchPlanRef = React.useRef(false);

  // ✅ on mount: token + cached brandId + cached plan (fast UI)
  React.useEffect(() => {
    setTokenState(getToken());

    try {
      const bid =
        window.localStorage.getItem('brandId') ||
        window.localStorage.getItem('brand_id') ||
        null;

      const cachedPlanName =
        window.localStorage.getItem('brandPlanName') ||
        window.localStorage.getItem('planName') ||
        null;

      const cachedPlanId = window.localStorage.getItem('brandPlanId') || null;

      setBrandId(bid);
      setPlanId(cachedPlanId);
      setPlanName(cachedPlanName ? cachedPlanName.toLowerCase() : null);
    } catch {
      setBrandId(null);
      setPlanId(null);
      setPlanName(null);
    }
  }, []);

  // ✅ fetch latest plan from server once per mount (source of truth)
  React.useEffect(() => {
    if (!token || !brandId) return;
    if (didFetchPlanRef.current) return;
    didFetchPlanRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const data = await get<BrandPlanRes>(
          `/subscription/brand/current?brandId=${encodeURIComponent(brandId)}`
        );

        const latestId = data?.brandPlanId ?? null;
        const latestName = data?.brandPlanName ? String(data.brandPlanName).toLowerCase() : null;

        if (cancelled) return;

        setPlanId(latestId);
        setPlanName(latestName);

        // cache
        try {
          if (latestId) window.localStorage.setItem('brandPlanId', latestId);
          else window.localStorage.removeItem('brandPlanId');

          if (latestName) window.localStorage.setItem('brandPlanName', latestName);
          else window.localStorage.removeItem('brandPlanName');
        } catch {}
      } catch {
        // keep cached plan if server fails
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, brandId]);

  const markLocalSeen = React.useCallback(() => {
    lsSet(BRAND_TOUR_LS_KEY, '1');
  }, []);

  // ✅ server + local fallback (tour)
  React.useEffect(() => {
    if (!token) return;
    if (didCheckOnboardingRef.current) return;
    didCheckOnboardingRef.current = true;

    const localSeen = lsGet(BRAND_TOUR_LS_KEY) === '1';

    (async () => {
      if (localSeen) {
        post('/brand/onboarding/brand-tour/seen').catch(() => {});
        return;
      }

      try {
        const data = await get<OnboardingRes>('/brand/onboarding');

        if (data?.brandTourSeen) {
          markLocalSeen();
          return;
        }

        setTourOpen(true);
        markLocalSeen();
        post('/brand/onboarding/brand-tour/seen').catch(() => {});
      } catch {
        setTourOpen(true);
        markLocalSeen();
      }
    })();
  }, [token, markLocalSeen]);

  // ✅ menu gating by plan
  const menuItems = React.useMemo(() => {
    if (!planName) return BASE_MENU_ITEMS;

    const normalized = planName.toLowerCase();
    const isFree = normalized === 'free' || normalized === 'brand_free';
    const isFullyManaged = normalized === 'fully_managed';

    let items = [...BASE_MENU_ITEMS];

    // ✅ Keep Created Campaign ALWAYS, and ADD Review Campaigns for Fully Managed
    if (isFullyManaged) {
      const reviewItem: MenuItem = {
        name: 'Review Campaigns',
        href: '/brand/review-campaigns',
        icon: HiClipboardDocumentList,
      };

      const alreadyAdded = items.some((i) => i.href === reviewItem.href);
      if (!alreadyAdded) {
        const createdIdx = items.findIndex((i) => i.href === '/brand/created-campaign');
        if (createdIdx >= 0) items.splice(createdIdx + 1, 0, reviewItem);
        else items.push(reviewItem);
      }
    }

    // ✅ Apply filters
    items = items.filter((item) => {
      // Free plan gating
      if (isFree && item.href === '/brand/disputes') return false;

      // Fully Managed gating (✅ hide requested items)
      if (isFullyManaged && item.href === '/brand/email') return false;
      if (isFullyManaged && item.href === '/brand/browse-influencer') return false; // ✅ hide Browse Influencers
      if (isFullyManaged && item.href === '/brand/disputes') return false; // ✅ hide Disputes
      if (isFullyManaged && item.href === '/brand/invited') return false; // ✅ hide Invited Influencers

      return true;
    });

    return items;
  }, [planName]);

  const handleLogout = () => {
    localStorage.removeItem('token');

    // ✅ clear cached subscription (prevents cross-account issues)
    localStorage.removeItem('brandPlanId');
    localStorage.removeItem('brandPlanName');

    lsRemove(BRAND_TOUR_LS_KEY);
    router.push('/');
  };

  const openGuide = () => {
    setTourOpen(true);
    markLocalSeen();
    if (token) post('/brand/onboarding/brand-tour/seen').catch(() => {});
    onClose?.();
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
      className="flex flex-col h-full bg-white text-gray-800 shadow-lg transition-[width] duration-300 ease-in-out"
      style={{ width: 'var(--brand-sidebar-w)' }}
    >
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
            <span className="text-2xl font-semibold text-gray-900">CollabGlam Brand</span>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto mt-4">
        <ul className="flex flex-col space-y-1 px-1">{renderLinks()}</ul>
      </nav>

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
      <div className="hidden md:flex z-40">{DesktopSidebar}</div>

      {/* ✅ Tour modal */}
      <BrandTourModal
        open={tourOpen}
        onClose={() => {
          setTourOpen(false);
          markLocalSeen();
          if (token) post('/brand/onboarding/brand-tour/seen').catch(() => {});
        }}
        startAt={0}
      />

      {isOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm" onClick={onClose} />
          {MobileSidebar}
        </div>
      )}
    </>
  );
}