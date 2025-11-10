"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  HiSearch,
  HiOutlineSearch,
  HiChevronLeft,
  HiChevronRight,
  HiCheck,
  HiX,
} from "react-icons/hi";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import Swal from "sweetalert2";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

// Pagination metadata
interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Campaign & Invitation types
interface Campaign {
  campaignsId: string;
  brandId: string;
  brandName: string;
  productOrServiceName: string;
  description: string;
  timeline: { startDate: string; endDate: string };
  isActive: number;
  budget: number;
  isApproved: number;
}
interface InvitationItem {
  invitationId: string;
  isAccepted: number;
  isContracted: number;
  campaign: {
    campaignsId: string;
    productOrServiceName: string;
    brandName: string;
    description: string;
    budget: number;
    timeline: { startDate: string; endDate: string };
  };
}

// Brand search result type (NEW)
interface BrandSearchResult {
  brandId: string;
  name: string;
}

// API response shapes
interface CampaignsResponse {
  meta: PaginationMeta;
  campaigns: Campaign[];
}
interface InvitationItemResponse {
  data: InvitationItem[];
  pagination: { total: number; page: number; limit: number; pages: number };
}

// Toast
const toast = (opts: { icon: "success" | "error"; title: string; text?: string }) =>
  Swal.fire({
    showConfirmButton: false,
    timer: 1200,
    timerProgressBar: true,
    background: "white",
    ...opts,
  });

// Pagination component
const Pagination: React.FC<{ current: number; total: number; onChange: (p: number) => void }> = ({ current, total, onChange }) => (
  <div className="flex justify-end items-center p-4 space-x-2">
    <button
      onClick={() => onChange(Math.max(current - 1, 1))}
      disabled={current === 1}
      className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50"
    >
      <HiChevronLeft size={20} />
    </button>
    <span className="text-gray-700">Page {current} of {total}</span>
    <button
      onClick={() => onChange(Math.min(current + 1, total))}
      disabled={current === total}
      className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 disabled:opacity-50"
    >
      <HiChevronRight size={20} />
    </button>
  </div>
);

// Hook for paginated fetch
function usePaginatedFetch<TRes, TItem>(
  endpoint: string,
  payloadFactory: (page: number, search?: string) => any
) {
  const [data, setData] = useState<TItem[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (search?: string) => {
      setLoading(true);
      setError(null);
      try {
        const influencerId = typeof window !== 'undefined' ? localStorage.getItem('influencerId') : null;
        if (!influencerId) throw new Error('No influencer ID found.');

        const payload = payloadFactory(page, search);
        const result = await post<TRes>(endpoint, payload);

        if (!result || typeof result !== "object") {
          setData([]);
          setMeta({ total: 0, page, limit: 10, totalPages: 1 });
          return;
        }
        const items: any = 'campaigns' in result ? (result as any).campaigns : (result as any).data;
        const paging = (result as any).meta || (result as any).pagination;
        setData(items as TItem[]);
        setMeta({ total: paging.total, page: paging.page || page, limit: paging.limit, totalPages: paging.totalPages || paging.pages });
      } catch (err: any) {
        setError(err.message || 'Failed to load.');
      } finally {
        setLoading(false);
      }
    },
    [endpoint, page]
  );

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  return { data, meta, loading, error, setPage, refetch: fetchPage };
}

// Formatters
const formatDate = (d: string) => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(d));
const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export default function MyCampaignsPage() {
  // Campaign list search (existing)
  const [search, setSearch] = useState('');

  // Brand search UI state (the one you asked to update)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [brandResults, setBrandResults] = useState<BrandSearchResult[]>([]);
  const [brandNoResults, setBrandNoResults] = useState(false);
  const [brandLoading, setBrandLoading] = useState(false);

  const searchFormRef = useRef<HTMLFormElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const [activeCount, setActiveCount] = useState<number>(0);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [totalEarningsPaid, setTotalEarningsPaid] = useState<string>("$0.00");
  const [upcomingPayouts, setUpcomingPayouts] = useState<string>("$0.00");

  useEffect(() => {
    const influencerId =
      typeof window !== "undefined"
        ? localStorage.getItem("influencerId")
        : null;
    if (!influencerId) return;

    post<{
      influencerId: string;
      activeCampaigns: number;
      pendingApprovals: number;
      totalEarnings: string;
      upcomingPayouts: string;
    }>("/dash/influencer", { influencerId })
      .then((res) => {
        setActiveCount(res.activeCampaigns);
        setPendingCount(res.pendingApprovals);
        setTotalEarningsPaid(res.totalEarnings);
        setUpcomingPayouts(res.upcomingPayouts);
      })
      .catch((err) => {
        console.error("Failed to load dashboard stats:", err);
      });
  }, []);


  const {
    data: invitations,
    meta: invMeta,
    loading: loadInv,
    error: errInv,
    setPage: setInvPage,
    refetch: reloadInv,
  } = usePaginatedFetch<InvitationItemResponse, InvitationItem>(
    '/invitation/getall',
    (page) => ({ influencerId: localStorage.getItem('influencerId'), page, limit: 10 })
  );

  const {
    data: campaigns,
    meta: campMeta,
    loading: loadCamp,
    error: errCamp,
    setPage: setCampPage,
    refetch: reloadCamp,
  } = usePaginatedFetch<CampaignsResponse, Campaign>(
    '/campaign/byInfluencer',
    (page, searchTerm) => ({ influencerId: localStorage.getItem('influencerId'), search: searchTerm?.trim(), page, limit: 10 })
  );

  const acceptInvitation = useCallback(
    async (id: string) => {
      try {
        await post('/invitation/accept', { invitationId: id });
        toast({ icon: 'success', title: 'Invitation accepted!' });
        reloadInv();
      } catch (e: any) {
        toast({ icon: 'error', title: 'Couldn’t accept', text: e.message });
      }
    },
    [reloadInv]
  );

  // Debounce campaign table search
  useEffect(() => {
    const t = setTimeout(() => reloadCamp(search), 500);
    return () => clearTimeout(t);
  }, [search, reloadCamp]);

  // === BRAND SEARCH (only changes required) ===
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setBrandResults([]);
      setBrandNoResults(false);
      return;
    }

    setBrandLoading(true);
    setBrandNoResults(false);

    const handler = setTimeout(async () => {
      try {
        const influencerId = typeof window !== 'undefined' ? localStorage.getItem('influencerId') : null;
        if (!influencerId) {
          setBrandResults([]);
          setBrandNoResults(true);
          setBrandLoading(false);
          return;
        }

        // Endpoint can be adjusted if different; payload HAS: search, influencerId; result HAS: brandId, name
        const resp = await post<{ results?: BrandSearchResult[]; message?: string }>(
          '/influencer/searchBrand',
          { search: q, influencerId }
        );

        if (resp?.message === 'No result found' || !resp?.results?.length) {
          setBrandResults([]);
          setBrandNoResults(true);
        } else {
          setBrandResults(resp.results ?? []);
          setBrandNoResults(false);
        }
      } catch {
        setBrandResults([]);
        setBrandNoResults(true);
      } finally {
        setBrandLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Focus input when opening search in mobile
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      const id = requestAnimationFrame(() => searchInputRef.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [searchOpen]);

  // Close on outside click (mobile overlay)
  useEffect(() => {
    if (!searchOpen) return;
    const onClick = (e: MouseEvent) => {
      if (searchFormRef.current && !searchFormRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [searchOpen]);

  // Close on ESC
  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSearchOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSearchOpen(false);
  }, []);

  return (
    <div className="p-6 bg-[#F5E1A4]/5 min-h-screen space-y-8">
      {/* Brand Search form */}
      <div
        className={[
          "w-full md:w-1/3 mx-auto",
          searchOpen ? "fixed inset-x-0 top-0 z-50 px-4 md:static md:px-0" : "hidden md:block",
        ].join(" ")}
      >
        <form ref={searchFormRef} onSubmit={handleSearchSubmit} className="relative">
          <div className="relative w-full max-w-3xl bg-white rounded-full">
            
           
            {searchOpen && (
              <button
                type="button"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
                className="absolute -top-2 -right-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-white shadow md:hidden"
              >
                <HiX size={16} className="text-gray-600" />
              </button>
            )}
          </div>

          {(brandResults.length > 0 || brandNoResults) && (
            <ul className="absolute mt-2 w-full max-w-3xl bg-white rounded-lg shadow-lg z-40 overflow-auto max-h-60">
              {brandResults.map((res) => (
                <li
                  key={res.brandId}
                  className="px-4 py-3 hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    // navigate or do something with brandId
                    // Example:
                    window.location.href = `/brand/profile?id=${res.brandId}`;
                    setSearchOpen(false);
                  }}
                >
                  {res.name}
                </li>
              ))}

              {brandNoResults && !brandLoading && (
                <li className="px-4 py-3 text-gray-500 select-none">No result found</li>
              )}
            </ul>
          )}
        </form>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 my-8 px-4 md:px-0">
        <div className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] p-[1px] rounded-lg shadow">
          <div className="bg-white p-4 rounded-lg">
            <h3 className="text-sm text-gray-500">Active Campaigns</h3>
            <p className="text-3xl font-bold">{activeCount}</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] p-[1px] rounded-lg shadow">
          <div className="bg-white p-4 rounded-lg flex items-center justify-between">
            <div>
              <h3 className="text-sm text-gray-500">Pending Approvals</h3>
              <p className="text-3xl font-bold">{pendingCount}</p>
            </div>
            {pendingCount > 0 && (
              <span className="inline-block bg-red-100 text-red-600 px-2 py-1 rounded-full text-xs font-semibold">
                {pendingCount}
              </span>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] p-[1px] rounded-lg shadow">
          <div className="bg-white p-4 rounded-lg">
            <h3 className="text-sm text-gray-500">Total Earnings Paid</h3>
            <p className="text-3xl font-bold">{totalEarningsPaid}</p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] p-[1px] rounded-lg shadow">
          <div className="bg-white p-4 rounded-lg">
            <h3 className="text-sm text-gray-500">Upcoming Payouts</h3>
            <p className="text-3xl font-bold">{upcomingPayouts}</p>
          </div>
        </div>
      </div>

      {/* Brand Invitation Campaigns (only if there are invitations) */}
      {loadInv ? (
        <p className="p-6">Loading...</p>
      ) : errInv ? (
        <p className="p-6 text-red-600">{errInv}</p>
      ) : invitations.length > 0 ? (
        <>
          <h1 className="text-3xl font-semibold">Brand Invitation Campaigns</h1>
          <div className="overflow-x-auto bg-white shadow rounded-lg">
            <table className="w-full text-sm text-gray-600">
              <thead className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
                <tr>
                  {['Campaign', 'Brand', 'Budget', 'Timeline', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invitations.map((c, i) => (
                  <tr key={c.invitationId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{c.campaign.productOrServiceName}</div>
                      <div className="text-gray-600 line-clamp-1">{c.campaign.description}</div>
                    </td>
                    <td className="px-6 py-4 text-center">{c.campaign.brandName}</td>
                    <td className="px-6 py-4">{formatCurrency(c.campaign.budget)}</td>
                    <td className="px-6 py-4">
                      {formatDate(c.campaign.timeline.startDate)} - {formatDate(c.campaign.timeline.endDate)}
                    </td>
                    <td className="px-6 py-4">
                      {c.isContracted === 1 ? (
                        <Badge className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 shadow-none">
                          Brand Contracted
                        </Badge>
                      ) : c.isAccepted === 1 ? (
                        <Badge className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 shadow-none">
                          Brand Reviewing
                        </Badge>
                      ) : (
                        <Badge className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 shadow-none">
                          Brand Invited
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 flex space-x-2 justify-center">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/influencer/dashboard/view-campaign?id=${c.campaign.campaignsId}`}>
                          View Campaign
                        </Link>
                      </Button>
                      {!c.isAccepted && (
                        <Button onClick={() => acceptInvitation(c.invitationId)} size="sm" className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
                          <HiCheck /> Accept
                        </Button>
                      )}
                      {c.isContracted === 1 && (
                        <Button size="sm" className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
                          <Link href={`/influencer/my-campaign`}>View Contract</Link>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination current={invMeta.page} total={invMeta.totalPages} onChange={setInvPage} />
          </div>
        </>
      ) : null}

      {/* Top Featured Campaigns for You */}
      <h1 className="text-3xl font-semibold">Top Featured Campaigns for You</h1>
      <div className="max-w-md">
        <div className="relative mb-4">
          <HiSearch className="absolute inset-y-0 left-3 my-auto text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={e => { setSearch(e.target.value); setCampPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <div className="overflow-x-auto bg-white shadow rounded-lg">
        {loadCamp ? (
          <p className="p-6">Loading...</p>
        ) : errCamp ? (
          <p className="p-6 text-red-600">{errCamp}</p>
        ) : campaigns.length === 0 ? (
          <p className="p-6 text-gray-700">No campaigns found.</p>
        ) : (
          <>
            <table className="w-full text-sm text-gray-600">
              <thead className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800">
                <tr>
                  {['Campaign', 'Brand', 'Budget', 'Timeline', 'Actions'].map(h => (
                    <th key={h} className="px-6 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c, i) => (
                  <tr key={c.campaignsId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{c.productOrServiceName}</div>
                      <div className="text-gray-600 line-clamp-1">{c.description}</div>
                    </td>
                    <td className="px-6 py-4 text-center">{c.brandName}</td>
                    <td className="px-6 py-4">{formatCurrency(c.budget)}</td>
                    <td className="px-6 py-4">{formatDate(c.timeline.startDate)} - {formatDate(c.timeline.endDate)}</td>
                    <td className="px-6 py-4 flex space-x-2 justify-center">
                      <Link href={`/influencer/dashboard/view-campaign?id=${c.campaignsId}`} className="p-2 bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800 rounded-md">
                        View Campaign
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination current={campMeta.page} total={campMeta.totalPages} onChange={setCampPage} />
          </>
        )}
      </div>
    </div>
  );
}
