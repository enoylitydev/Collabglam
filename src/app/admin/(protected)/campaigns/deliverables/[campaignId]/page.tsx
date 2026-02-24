"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import api, { get } from "@/lib/api";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

import { HiOutlineRefresh } from "react-icons/hi";

type ReviewStatus = "approved" | "pending" | "rejected" | "changes_needed";
type UrlItem = { label: string; url: string };

type DeliverableApi = {
  _id?: string;
  id?: string;
  campaignId?: string;

  influencerId?: string;
  influencerHandle?: string;
  username?: string;

  title?: string;
  description?: string;
  url?: UrlItem[];

  status?: ReviewStatus | string;
  comments?: string;
  reason?: string;

  createdAt?: string;
  updatedAt?: string;
};

type DeliverableRow = {
  rowKey: string;
  deliverableId: string;

  influencerId: string;
  influencerHandle: string;

  title: string;
  description: string;

  draftLabel: string;
  linkUrl: string; // shown in Draft cell

  status: ReviewStatus;
  reason: string;

  submittedAt: string;
  updatedAt?: string;
};

// Dummy until API returns
const DUMMY: DeliverableRow[] = [
  {
    rowKey: "dummy_1",
    deliverableId: "DEL-001",
    influencerId: "inf_101",
    influencerHandle: "@riya.glow",
    title: "Instagram Reel - Product Demo",
    description: "30 sec reel with hook + CTA",
    draftLabel: "Draft 1",
    linkUrl: "https://drive.google.com/...",
    status: "changes_needed",
    reason: "Update hook + add product close-up + include hashtag.",
    submittedAt: "2026-02-22T09:10:00.000Z",
    updatedAt: "2026-02-22T10:10:00.000Z",
  },
  {
    rowKey: "dummy_2",
    deliverableId: "DEL-002",
    influencerId: "inf_102",
    influencerHandle: "@liftwitharjun",
    title: "YouTube Short - Gym Challenge",
    description: "60 sec short with routine + product mention",
    draftLabel: "Draft Link",
    linkUrl: "https://youtube.com/shorts/...",
    status: "approved",
    reason: "Looks good.",
    submittedAt: "2026-02-23T07:40:00.000Z",
    updatedAt: "2026-02-23T09:15:00.000Z",
  },
];

const normalizeUrl = (value: string) => {
  const v = (value || "").trim();
  if (!v) return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  return `https://${v}`;
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

const toStatus = (s: any): ReviewStatus => {
  const v = String(s || "pending").toLowerCase();
  if (v === "approved") return "approved";
  if (v === "rejected") return "rejected";
  if (v === "changes_needed" || v === "changes needed") return "changes_needed";
  return "pending";
};

const statusPill = (s: ReviewStatus) => {
  switch (s) {
    case "approved":
      return "bg-green-50 text-green-700";
    case "pending":
      return "bg-amber-50 text-amber-700";
    case "rejected":
      return "bg-red-50 text-red-700";
    case "changes_needed":
      return "bg-purple-50 text-purple-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

const statusLabel = (s: ReviewStatus) =>
  s === "changes_needed" ? "Changes needed" : s[0].toUpperCase() + s.slice(1);

const makeApprovalId = () => {
  const y = new Date().getFullYear();
  const r = Math.floor(10000 + Math.random() * 90000);
  return `APR-${y}-${r}`;
};

function mapApiToRows(items: DeliverableApi[]): DeliverableRow[] {
  const out: DeliverableRow[] = [];

  for (const it of items || []) {
    const deliverableId = String(it._id || it.id || "");
    if (!deliverableId) continue;

    const influencerId = String(it.influencerId || "—");
    const influencerHandle = String(it.influencerHandle || it.username || influencerId);

    const title = it.title || "Untitled";
    const description = it.description || "";

    const status = toStatus(it.status);
    const reason = it.comments || it.reason || (status === "pending" ? "Under review." : "");

    const submittedAt = it.createdAt || new Date().toISOString();
    const updatedAt = it.updatedAt;

    const urls = Array.isArray(it.url) ? it.url : [];

    if (urls.length === 0) {
      out.push({
        rowKey: `${deliverableId}_0`,
        deliverableId,
        influencerId,
        influencerHandle,
        title,
        description,
        draftLabel: "Draft",
        linkUrl: "",
        status,
        reason,
        submittedAt,
        updatedAt,
      });
      continue;
    }

    urls.forEach((u, idx) => {
      out.push({
        rowKey: `${deliverableId}_${idx}`,
        deliverableId,
        influencerId,
        influencerHandle,
        title,
        description,
        draftLabel: u.label || `Draft ${idx + 1}`,
        linkUrl: u.url || "",
        status,
        reason,
        submittedAt,
        updatedAt,
      });
    });
  }

  return out;
}

export default function AdminCampaignDeliverablesPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = params?.campaignId;

  const [rows, setRows] = useState<DeliverableRow[]>(DUMMY);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // edit per deliverableId
  const [edit, setEdit] = useState<Record<string, { status: ReviewStatus; comments: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | ReviewStatus>("all");
  const [influencerFilter, setInfluencerFilter] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");

  const uniqueInfluencers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.influencerHandle));
    return Array.from(set).sort();
  }, [rows]);

  const initEditFromRows = (nextRows: DeliverableRow[]) => {
    const next: Record<string, { status: ReviewStatus; comments: string }> = {};
    for (const r of nextRows) {
      if (!next[r.deliverableId]) {
        next[r.deliverableId] = { status: r.status, comments: r.reason || "" };
      }
    }
    setEdit(next);
  };

  const fetchDeliverables = async () => {
    if (!campaignId) return;
    setLoading(true);
    setBanner(null);

    try {
      // ✅ GET /deliverable/campaign/:campaignId
      const res: any = await get<any>(`/deliverable/campaign/${campaignId}`);

      const arr =
        (Array.isArray(res) && res) ||
        (Array.isArray(res?.data) && res.data) ||
        (Array.isArray(res?.deliverables) && res.deliverables) ||
        (Array.isArray(res?.items) && res.items) ||
        [];

      if (Array.isArray(arr) && arr.length > 0) {
        const mapped = mapApiToRows(arr as DeliverableApi[]);
        if (mapped.length > 0) {
          setRows(mapped);
          initEditFromRows(mapped);
          setBanner(null);
        } else {
          setBanner("API returned data but could not map deliverables. Showing dummy data.");
        }
      } else {
        setBanner("No deliverables from API yet. Showing dummy data.");
      }
    } catch {
      setBanner("Could not fetch deliverables from API. Showing dummy data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initEditFromRows(rows); // init for dummy
    fetchDeliverables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  const filtered = useMemo(() => {
    let list = [...rows];

    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (influencerFilter !== "all") list = list.filter((r) => r.influencerHandle === influencerFilter);

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = `${r.influencerHandle} ${r.title} ${r.description} ${r.draftLabel} ${r.status} ${r.reason}`.toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      const ta = new Date(a.submittedAt).getTime();
      const tb = new Date(b.submittedAt).getTime();
      return sort === "newest" ? tb - ta : ta - tb;
    });

    return list;
  }, [rows, statusFilter, influencerFilter, search, sort]);

  const baseByDeliverable = (deliverableId: string) =>
    rows.find((r) => r.deliverableId === deliverableId) || null;

  const setEditField = (deliverableId: string, key: "status" | "comments", value: any) => {
    setEdit((prev) => ({
      ...prev,
      [deliverableId]: { ...prev[deliverableId], [key]: value },
    }));
  };

  const saveOne = async (deliverableId: string) => {
    const patch = edit[deliverableId];
    const base = baseByDeliverable(deliverableId);
    if (!patch || !base) return;

    const dirty =
      patch.status !== base.status || (patch.comments || "") !== (base.reason || "");
    if (!dirty) return;

    setSavingId(deliverableId);
    setBanner(null);

    try {
      const brandId =
        typeof window !== "undefined" ? localStorage.getItem("brandId") : null;

      // ✅ rule: if brandId missing -> Admin else brand
      const approvedRole = brandId ? "brand" : "Admin";

      const payload = {
        status: patch.status,
        comments: patch.comments,
        approvedRole,
        approvalId: makeApprovalId(),
      };

      // ✅ PATCH /delieverable/:deliverableId/status (spelling per your API)
      await api.patch(`/delieverable/${deliverableId}/status`, payload);

      const now = new Date().toISOString();
      setRows((prev) =>
        prev.map((r) =>
          r.deliverableId !== deliverableId
            ? r
            : { ...r, status: patch.status, reason: patch.comments, updatedAt: now }
        )
      );

      setBanner("Updated successfully.");
    } catch {
      setBanner("Update failed. Please verify endpoint/token/CORS and try again.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="p-6 bg-white min-h-screen">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Deliverables (Admin)</h1>
          <p className="text-sm text-gray-600 mt-1">Campaign ID: {campaignId}</p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/campaigns">
            <Button variant="outline">Back</Button>
          </Link>

          <Button variant="outline" onClick={fetchDeliverables} disabled={loading}>
            <HiOutlineRefresh className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {banner && (
        <Card className="p-4 mb-4">
          <p className={banner.includes("failed") || banner.includes("Could not") ? "text-red-600" : "text-gray-700"}>
            {banner}
          </p>
        </Card>
      )}

      <Card className="p-4">
        {/* Filters */}
        <div className="flex flex-col xl:flex-row xl:items-center gap-3 mb-4">
          <div className="flex-1">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search influencer, title, draft, status, reason..."
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="changes_needed">Changes needed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={influencerFilter} onValueChange={(v) => setInfluencerFilter(v)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="All Influencers" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="all">All Influencers</SelectItem>
                {uniqueInfluencers.map((x) => (
                  <SelectItem key={x} value={x}>
                    {x}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={(v) => setSort(v as any)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table (NO separate link column; link shown inside Draft cell) */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Influencer</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Draft</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Comments / Reason</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-[140px] text-center">Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {filtered.map((r) => {
              const base = baseByDeliverable(r.deliverableId);
              const current = edit[r.deliverableId] || { status: r.status, comments: r.reason || "" };

              const dirty =
                !!base &&
                (current.status !== base.status || (current.comments || "") !== (base.reason || ""));

              return (
                <TableRow key={r.rowKey}>
                  <TableCell>
                    <div className="font-semibold text-gray-900">{r.influencerHandle}</div>
                    <div className="text-xs text-gray-500">ID: {r.influencerId}</div>
                  </TableCell>

                  <TableCell>
                    <div className="font-semibold text-gray-900">{r.title}</div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{r.description}</div>
                  </TableCell>

                  <TableCell>
                    <div className="font-semibold text-gray-900">{r.draftLabel}</div>
                    {r.linkUrl ? (
                      <a
                        href={normalizeUrl(r.linkUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block text-xs font-semibold text-gray-800 hover:underline break-all"
                      >
                        Open ↗
                      </a>
                    ) : (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                    <div className="text-[11px] text-gray-400 mt-1">
                      Deliverable ID: {r.deliverableId}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-2">
                      <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-medium ${statusPill(r.status)}`}>
                        {statusLabel(r.status)}
                      </span>

                      <select
                        value={current.status}
                        onChange={(e) => setEditField(r.deliverableId, "status", e.target.value as ReviewStatus)}
                        className="rounded-md border border-gray-300 px-2 py-2 text-xs outline-none focus:ring-2 focus:ring-[#FFA135]"
                      >
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="changes_needed">Changes needed</option>
                      </select>
                    </div>
                  </TableCell>

                  <TableCell>
                    <textarea
                      value={current.comments}
                      onChange={(e) => setEditField(r.deliverableId, "comments", e.target.value)}
                      placeholder="Write comments / feedback..."
                      className="w-[260px] min-w-[220px] rounded-md border border-gray-300 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-[#FFA135]"
                      rows={3}
                    />
                  </TableCell>

                  <TableCell className="text-xs text-gray-700">{formatIST(r.submittedAt)}</TableCell>
                  <TableCell className="text-xs text-gray-700">{r.updatedAt ? formatIST(r.updatedAt) : "-"}</TableCell>

                  <TableCell className="text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => saveOne(r.deliverableId)}
                      disabled={!dirty || savingId === r.deliverableId}
                    >
                      {savingId === r.deliverableId ? "Updating..." : "Update"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}

            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-gray-500 py-10">
                  No deliverables match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}