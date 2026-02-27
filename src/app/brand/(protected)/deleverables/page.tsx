"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Swal from "sweetalert2";

import { Button } from "@/components/ui/button";

type DeliverableUrl = { label: string; url: string };

interface Deliverable {
  _id?: string; // optional because API may not send it
  brandId: string;
  influencerId: string;
  campaignId: string;
  title: string;
  description: string;
  status: string; // pending | approved | revision | rejected etc
  milestoneTitle?: string; // ✅ added
  approvedRole?: string;
  approvalId?: string;
  comments?: string;
  url?: DeliverableUrl[];
  delieverableApprovalId: string;
  createdAt: string;
  updatedDate?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";
const DELIVERABLE_BASE_PATH = "deliverable";

const formatDateTime = (dateStr?: string) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const badgeClass = (status: string) => {
  const s = (status || "").toLowerCase();
  if (s === "approved" || s === "paid")
    return "bg-green-100 text-green-700 border-green-200";
  if (s === "pending")
    return "bg-yellow-100 text-yellow-700 border-yellow-200";
  if (s === "revision")
    return "bg-blue-100 text-blue-700 border-blue-200";
  if (s === "rejected")
    return "bg-red-100 text-red-700 border-red-200";
  return "bg-gray-100 text-gray-700 border-gray-200";
};

export default function DeliverablesPage() {
  const searchParams = useSearchParams();

  const campaignId = useMemo(
    () => searchParams.get("campaignId") || "",
    [searchParams]
  );
  const statusFilter = useMemo(
    () => searchParams.get("status") || "",
    [searchParams]
  );

  const [rows, setRows] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDeliverables = async () => {
    if (!campaignId) {
      setError("Missing campaignId in URL. Example: ?campaignId=xxxx");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const url = `${API_BASE}${DELIVERABLE_BASE_PATH}/campaign/${campaignId}${qs}`;

      const res = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Failed to fetch deliverables");
      }

      setRows(Array.isArray(json.data) ? json.data : []);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const updateDeliverableStatus = async (
    delieverableApprovalId: string,
    status: "approved" | "revision",
    comments?: string
  ) => {
    try {
      setUpdatingId(delieverableApprovalId);

      const url = `${API_BASE}${DELIVERABLE_BASE_PATH}/${delieverableApprovalId}/status`;

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          status,
          ...(typeof comments === "string" ? { comments } : {}),
        }),
      });

      const json = await res.json();

      if (!res.ok || !json?.success) {
        throw new Error(json?.message || "Status update failed");
      }

      Swal.fire({
        icon: "success",
        title: status === "approved" ? "Approved" : "Revision Sent",
        text:
          status === "approved"
            ? "Deliverable approved successfully."
            : "Revision request sent successfully.",
        showConfirmButton: false,
        timer: 1600,
        timerProgressBar: true,
      });

      fetchDeliverables();
    } catch (e: any) {
      Swal.fire({
        icon: "error",
        title: "Error",
        text: e?.message || "Failed to update deliverable status",
        showConfirmButton: false,
        timer: 1800,
        timerProgressBar: true,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const approveDeliverable = (delieverableApprovalId: string) => {
    return updateDeliverableStatus(delieverableApprovalId, "approved");
  };

  const sendRevision = async (delieverableApprovalId: string) => {
    const result = await Swal.fire({
      title: "Send for revision?",
      input: "textarea",
      inputLabel: "Comments (optional)",
      inputPlaceholder: "Write what needs to be changed...",
      showCancelButton: true,
      confirmButtonText: "Send Revision",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    const comments = typeof result.value === "string" ? result.value : undefined;
    return updateDeliverableStatus(delieverableApprovalId, "revision", comments);
  };

  useEffect(() => {
    fetchDeliverables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, statusFilter]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Deliverables</h1>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-gray-700">
          Loading deliverables...
        </div>
      )}

      {!loading && error && (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-5">
          <p className="text-red-600 font-medium">{error}</p>
          <div className="mt-3">
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50"
              onClick={fetchDeliverables}
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {!loading && !error && rows.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-gray-700">
          No deliverables found.
        </div>
      )}

      {!loading && !error && rows.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Title</th>
                <th className="text-left font-semibold px-4 py-3">Description</th>

                {/* ✅ New column */}
                <th className="text-left font-semibold px-4 py-3">Milestone Title</th>

                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-left font-semibold px-4 py-3">Links</th>
                <th className="text-left font-semibold px-4 py-3">Created</th>
                <th className="text-left font-semibold px-4 py-3">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {rows.map((d) => {
                const status = (d.status || "").toLowerCase();
                const isApproved = status === "approved";
                const isRevision = status === "revision";
                const isUpdating = updatingId === d.delieverableApprovalId;

                return (
                  <tr
                    key={d.delieverableApprovalId} // ✅ safer than d._id
                    className="hover:bg-gray-50/60"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {d.title || "-"}
                    </td>

                    <td className="px-4 py-3 text-gray-700 max-w-[420px]">
                      <div className="line-clamp-2">{d.description || "-"}</div>
                    </td>

                    {/* ✅ New cell */}
                    <td className="px-4 py-3 text-gray-700 max-w-[360px]">
                      <div className="line-clamp-2">{d.milestoneTitle || "-"}</div>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full border text-xs font-semibold ${badgeClass(
                          d.status
                        )}`}
                      >
                        {d.status || "-"}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {(d.url || []).length === 0 ? (
                          <span className="text-gray-500">-</span>
                        ) : (
                          d.url!.map((u, idx) => (
                            <a
                              key={`${d.delieverableApprovalId}-u-${idx}`}
                              href={u.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {u.label || "Open link"}
                            </a>
                          ))
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-gray-700">
                      {formatDateTime(d.createdAt)}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-2">
                        <Button
                          className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white disabled:opacity-50 items-center justify-center"
                          disabled={isApproved || isUpdating}
                          onClick={() => approveDeliverable(d.delieverableApprovalId)}
                        >
                          {isApproved ? "Approved" : isUpdating ? "Updating..." : "Approve"}
                        </Button>

                        <Button
                          className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white disabled:opacity-50"
                          disabled={isApproved || isRevision || isUpdating}
                          onClick={() => sendRevision(d.delieverableApprovalId)}
                        >
                          {isApproved
                            ? "Revision Locked"
                            : isRevision
                            ? "Revision Sent"
                            : isUpdating
                            ? "Updating..."
                            : "Revision"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}