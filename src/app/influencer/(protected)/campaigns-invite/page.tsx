"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { get } from "@/lib/api";

type InviteRow = {
  campaignId: string;              // used for routing
  productName: string;             // shown in table
  platform: string;                // youtube/instagram etc
  createdAt: string;               // deliverable createdAt
};

type ApiItem = {
  _id?: string;
  campaignId?: string | null;
  platform?: string;
  createdAt?: string;

  campaign?: {
    _id?: string;
    productOrServiceName?: string;
  };
};

type ApiResponse = {
  success?: boolean;
  message?: string;
  count?: number;
  data?: ApiItem[];
};

const prettyPlatform = (p?: string) => {
  const v = String(p || "").trim();
  if (!v) return "—";
  return v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
};

const formatIST = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

// If your `get()` sometimes returns AxiosResponse, normalize it here.
function normalizeApiResponse(maybeAxios: any): ApiResponse {
  // axios: { data: { success, message, data: [...] }, status, ... }
  if (maybeAxios?.data && typeof maybeAxios.data === "object" && "success" in maybeAxios.data) {
    return maybeAxios.data as ApiResponse;
  }
  // plain: { success, message, data: [...] }
  return maybeAxios as ApiResponse;
}

export default function CampaignsInvitePage() {
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const influencerId =
    (typeof window !== "undefined" ? localStorage.getItem("influencerId") : null) || "";

  const fetchInvites = async () => {
    if (!influencerId) {
      setBanner("influencerId is missing in localStorage. Showing dummy data.");
      return;
    }

    setLoading(true);
    setBanner(null);

    try {
      const raw = await get<ApiResponse>(`/deliverable/influencer/${influencerId}`);
      const res = normalizeApiResponse(raw);
      const arr = Array.isArray(res?.data) ? res.data : [];

      if (!arr.length) {
        setBanner("No invites from API yet. Showing dummy data.");
        return;
      }

      const mapped: InviteRow[] = arr
        .map((it) => {
          const campaignId = String(it.campaignId ?? it.campaign?._id ?? "").trim();
          return {
            campaignId,
            productName: String(it.campaign?.productOrServiceName ?? "—").trim(),
            platform: prettyPlatform(it.platform),
            createdAt: String(it.createdAt ?? new Date().toISOString()),
          };
        })
        .filter((x) => x.campaignId);

      // Sort newest first, then dedupe by campaignId (keep latest row)
      mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const uniq = new Map<string, InviteRow>();
      for (const r of mapped) {
        if (!uniq.has(r.campaignId)) uniq.set(r.campaignId, r);
      }

      const list = Array.from(uniq.values());

      if (!list.length) {
        setBanner("API returned items but missing campaignId. Showing dummy data.");
        return;
      }

      setRows(list);
    } catch {
      setBanner("Could not fetch invites from API. Showing dummy data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [influencerId]);

  const tableRows = useMemo(() => rows, [rows]);

  return (
    <div className="p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Campaigns Invite</h1>
        <p className="mt-1 text-sm text-gray-600">
          Showing campaigns derived from <b>/deliverable/influencer/:influencerId</b>.
        </p>
        <p className="mt-1 text-xs text-gray-500">Influencer ID: {influencerId || "—"}</p>
      </div>

      {/* Banner */}
      <div className="mt-4">
        {loading && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Fetching invites from API...
          </div>
        )}
        {!loading && banner && (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            {banner.includes("Could not") ? (
              <span className="text-red-700">{banner}</span>
            ) : (
              <span className="text-gray-800">{banner}</span>
            )}
          </div>
        )}
      </div>

      <div className="mt-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-800">Invites</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr className="text-xs font-semibold text-gray-600">
                <th className="px-4 py-3">Product / Campaign</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Created At</th>
                <th className="px-4 py-3 w-[220px]">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {tableRows.map((c) => (
                <tr key={c.campaignId} className="text-sm text-gray-800">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{c.productName}</div>
                    {/* optional: keep id hidden but available for debugging */}
                    {/* <div className="text-xs text-gray-400">{c.campaignId}</div> */}
                  </td>

                  <td className="px-4 py-3 text-gray-700">{c.platform}</td>

                  <td className="px-4 py-3 text-gray-700">{formatIST(c.createdAt)}</td>

                  <td className="px-4 py-3">
                    <Link
                      href={`/influencer/campaigns-invite/${encodeURIComponent(c.campaignId)}`}
                      className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-gray-900 border border-gray-200 hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58] transition-colors"
                    >
                      Deliverables
                    </Link>
                  </td>
                </tr>
              ))}

              {!tableRows.length && (
                <tr>
                  <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={4}>
                    No invites found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}