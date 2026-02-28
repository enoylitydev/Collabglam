"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { get } from "@/lib/api";
import MilestoneHistoryCard from "@/components/common/milestoneCard";

type InviteRow = {
  campaignsId: string;
  productName: string;
  platform: string;
  createdAt: string;
};

type ApiItem = {
  campaignsId?: string | null;
  platform?: string;
  createdAt?: string;
  campaign?: { productOrServiceName?: string };
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


function normalizeApiResponse(maybeAxios: any): ApiResponse {
  if (
    maybeAxios?.data &&
    typeof maybeAxios.data === "object" &&
    "success" in maybeAxios.data
  ) {
    return maybeAxios.data as ApiResponse;
  }
  return maybeAxios as ApiResponse;
}

export default function CampaignsInvitePage() {
  const router = useRouter();

  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("");
  const [selectedProductName, setSelectedProductName] = useState<string>("");

  const influencerId =
    (typeof window !== "undefined"
      ? localStorage.getItem("influencerId")
      : null) || "";

  const fetchInvites = async () => {
    if (!influencerId) {
      setBanner("influencerId is missing in localStorage.");
      setRows([]);
      setSelectedCampaignId("");
      setSelectedProductName("");
      return;
    }

    setLoading(true);
    setBanner(null);

    try {
      const raw = await get<ApiResponse>(`/deliverable/influencer/${influencerId}`);
      const res = normalizeApiResponse(raw);
      const arr = Array.isArray(res?.data) ? res.data : [];

      if (!arr.length) {
        setBanner("No invites found.");
        setRows([]);
        setSelectedCampaignId("");
        setSelectedProductName("");
        return;
      }

      const mapped: InviteRow[] = arr
        .map((it) => ({
          campaignsId: String(it.campaignsId ?? "").trim(),
          productName: String(it.campaign?.productOrServiceName ?? "—").trim(),
          platform: prettyPlatform(it.platform),
          createdAt: String(it.createdAt ?? new Date().toISOString()),
        }))
        .filter((x) => x.campaignsId);

      mapped.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const uniq = new Map<string, InviteRow>();
      for (const r of mapped) if (!uniq.has(r.campaignsId)) uniq.set(r.campaignsId, r);

      const list = Array.from(uniq.values());
      if (!list.length) {
        setBanner("API returned items but missing campaignsId.");
        setRows([]);
        setSelectedCampaignId("");
        setSelectedProductName("");
        return;
      }

      setRows(list);
    } catch {
      setBanner("Could not fetch invites from API.");
      setRows([]);
      setSelectedCampaignId("");
      setSelectedProductName("");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [influencerId]);

  const tableRows = useMemo(() => rows, [rows]);

  const onClickMilestones = (c: InviteRow) => {
    setSelectedCampaignId(c.campaignsId);
    setSelectedProductName(c.productName);

    setTimeout(() => {
      document
        .getElementById("milestones-section")
        ?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  // ✅ View Deliverables route:
  // Folder: /influencer/(protected)/campaigns-invite/[campaignId]
  // URL should NOT include "(protected)" (route group)
  const goToViewDeliverables = (campaignId: string) => {
    if (!campaignId) return;
    router.push(`/influencer/campaigns-invite/${campaignId}`);
  };
  // ✅ NEW: Go to All Deliverables page (Influencer)
  const goToAllDeliverables = () => {
    if (!influencerId) return;
    router.push(`/influencer/all-deliverables?influencerId=${encodeURIComponent(influencerId)}`);
  };
  return (
    <div className="p-6 space-y-6">
      {/* ✅ Main Heading (no View Deliverables button here anymore) */}
            <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Campaigns Invite</h1>
        </div>

        {/* ✅ NEW: All Deliverable button (top-right) */}
        <button
          onClick={goToAllDeliverables}
          disabled={!influencerId}
          className="rounded-md px-3 py-2 text-sm font-medium text-gray-900 border border-gray-200 bg-white hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58] transition-colors disabled:opacity-50"
          title="View all deliverables"
        >
          All Deliverable
        </button>
      </div>

      {/* Banner */}
      <div>
        {loading && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Fetching invites from API...
          </div>
        )}
        {!loading && banner && (
          <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            {banner.includes("Failed") || banner.includes("Could not") ? (
              <span className="text-red-700">{banner}</span>
            ) : (
              <span className="text-gray-800">{banner}</span>
            )}
          </div>
        )}
      </div>

      {/* Invites Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <p className="text-sm font-medium text-gray-800">
            Invites <span className="text-gray-400">({tableRows.length})</span>
          </p>

          <button
            onClick={fetchInvites}
            disabled={loading}
            className="text-sm px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
          >
            Refresh
          </button>
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
              {tableRows.map((c) => {
                const active = selectedCampaignId === c.campaignsId;

                return (
                  <tr
                    key={c.campaignsId}
                    className={`text-sm text-gray-800 ${active ? "bg-yellow-50/40" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.productName}</div>
                    </td>

                    <td className="px-4 py-3 text-gray-700">{c.platform}</td>

                    <td className="px-4 py-3 text-gray-700">{formatIST(c.createdAt)}</td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => onClickMilestones(c)}
                        className="inline-flex items-center rounded-md px-4 py-3 text-sm font-medium text-gray-900 border border-gray-200 hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58] transition-colors"
                      >
                        View Milestones & Deliverables
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!tableRows.length && !loading && (
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

      {/* Milestones Section */}
      <div id="milestones-section" className="scroll-mt-24">
        {selectedCampaignId && (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Milestones</h2>
                <p className="text-sm text-gray-600">
                  Campaign: <b>{selectedProductName || "—"}</b>
                </p>
              </div>

              {/* ✅ View Deliverables is now under Milestones actions (aside of Milestones) */}
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center justify-end gap-2 flex-nowrap">
                  <button
                    onClick={() => goToViewDeliverables(selectedCampaignId)}
                    className="rounded-md px-3 py-2 text-sm font-medium text-gray-900 border border-gray-200 bg-white hover:bg-gradient-to-r hover:from-[#FFBF00] hover:to-[#FFDB58] transition-colors"
                    title="View Deliverables"
                  >
                    View Deliverables
                  </button>

                  <button
                    onClick={() => {
                      setSelectedCampaignId("");
                      setSelectedProductName("");
                    }}
                    className="text-sm px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>

            <MilestoneHistoryCard
              role="influencer"
              influencerId={influencerId}
              campaignId={selectedCampaignId}
            />
          </div>
        )}
      </div>
    </div>
  );
}