"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { post, postFormData } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type AppliedCampaign = {
  campaignId: string;
  campaignName: string;
  brandId: string;
  brandName: string;
  isActive: number;
  applicantCount: number;
  hasApplied: number;
  isDraft: number;
  createdAt: string;
  isContracted: number;
  isAccepted: number;
  contractId: string | null;
  contractStatus: string | null;
};

const formatContractStatus = (status: string | null) => {
  if (!status) return "Contracted";
  const pretty =
    status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
  return `Contract • ${pretty}`;
};

export default function NewInfluencerDisputePage() {
  const router = useRouter();
  const [influencerId, setInfluencerId] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<AppliedCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignId, setCampaignId] = useState("");

  const [brandId, setBrandId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [loadingBrand, setLoadingBrand] = useState(false);

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [relatedType] = useState("other");
  const [relatedId] = useState("");

  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentsInputKey, setAttachmentsInputKey] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard + influencer id
  useEffect(() => {
    if (typeof window === "undefined") return;

    const id = localStorage.getItem("influencerId");
    if (!id) {
      router.replace("/login");
      return;
    }

    setInfluencerId(id);
  }, [router]);

  // Load campaigns usable for dispute
  useEffect(() => {
    const load = async () => {
      if (!influencerId) return;
      setLoadingCampaigns(true);
      setError(null);
      try {
        const data = await post<{
          meta?: any;
          campaigns?: AppliedCampaign[];
        }>("/dispute/influencer/applied", {
          influencerId,
          page: 1,
          limit: 1000,
        });

        setCampaigns(data?.campaigns || []);
      } catch (e: any) {
        setCampaigns([]);
        setError(
          e?.response?.data?.message ||
            e?.message ||
            "Failed to load applied campaigns"
        );
      } finally {
        setLoadingCampaigns(false);
      }
    };
    load();
  }, [influencerId]);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.campaignId === campaignId),
    [campaigns, campaignId]
  );

  // Auto-fill brand from selected campaign
  useEffect(() => {
    const fillBrand = async () => {
      if (!selectedCampaign) {
        setBrandId("");
        setBrandName("");
        return;
      }

      const inferredBrandId = selectedCampaign.brandId || "";
      const inferredBrandName = selectedCampaign.brandName || "";

      setBrandId(inferredBrandId);

      if (inferredBrandName) {
        setBrandName(inferredBrandName);
        return;
      }

      if (!inferredBrandId) {
        setBrandName("");
        return;
      }

      setLoadingBrand(true);
      try {
        let name = "";
        try {
          const resA = await post<{ brand?: { name?: string } }>(
            "/admin/brand/getById",
            { brandId: inferredBrandId }
          );
          name = resA?.brand?.name || "";
        } catch {
          const resB = await post<{ brand?: { name?: string } }>(
            "/brand/getById",
            { brandId: inferredBrandId }
          );
          name = resB?.brand?.name || "";
        }
        setBrandName(name || inferredBrandId);
      } catch {
        setBrandName(inferredBrandId);
      } finally {
        setLoadingBrand(false);
      }
    };
    fillBrand();
  }, [selectedCampaign]);

  const handleAttachmentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) {
      setAttachments([]);
      return;
    }
    setAttachments(Array.from(files));
  };

  const resetAttachments = () => {
    setAttachments([]);
    setAttachmentsInputKey((k) => k + 1); // reset file input
  };

  const submit = async () => {
    setError(null);

    if (!influencerId) {
      setError("Missing influencer id (not logged in?)");
      return;
    }
    if (!campaignId) {
      setError("Please select a campaign you applied to.");
      return;
    }
    if (!brandId || !subject.trim()) {
      setError("Brand and subject are required.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("influencerId", influencerId);
      formData.append("brandId", brandId);
      if (campaignId) formData.append("campaignId", campaignId);
      formData.append("subject", subject.trim());
      if (description.trim()) formData.append("description", description.trim());

      // Optional future fields – backend can ignore safely
      formData.append("relatedType", relatedType);
      if (relatedId) formData.append("relatedId", relatedId);

      // Attachments (multi)
      attachments.forEach((file) => {
        // MUST match multer field name in backend (e.g. "attachments")
        formData.append("attachments", file);
      });

      await postFormData("/dispute/influencer/create", formData);
      router.push("/influencer/disputes");
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Failed to create dispute"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Raise a Dispute</h1>

      <div className="space-y-4 bg-white p-6 rounded border">
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {/* Campaign */}
        <div>
          <label className="block text-sm font-medium mb-1">Campaign</label>
          <Select
            disabled={loadingCampaigns}
            value={campaignId}
            onValueChange={(v) => setCampaignId(v)}
          >
            <SelectTrigger className="!bg-white w-full">
              <SelectValue
                placeholder={
                  loadingCampaigns
                    ? "Loading your campaigns…"
                    : campaigns.length
                    ? "Select a campaign"
                    : "No campaigns found"
                }
              />
            </SelectTrigger>
            <SelectContent className="!bg-white max-h-64 overflow-auto w-[var(--radix-select-trigger-width)]">
              {campaigns.length > 0 ? (
                campaigns.map((c) => (
                  <SelectItem key={c.campaignId} value={c.campaignId}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="block truncate max-w-[18rem]">
                        {c.campaignName || c.campaignId}
                      </span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {c.hasApplied === 1 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wide bg-slate-50 text-slate-700 border border-slate-200"
                          >
                            Applied
                          </Badge>
                        )}
                        {c.isContracted === 1 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wide bg-sky-50 text-sky-700 border border-sky-200"
                          >
                            {formatContractStatus(c.contractStatus)}
                          </Badge>
                        )}
                        {c.isAccepted === 1 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200"
                          >
                            Accepted
                          </Badge>
                        )}
                        {c.isActive === 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wide bg-zinc-50 text-zinc-600 border border-zinc-200"
                          >
                            Inactive
                          </Badge>
                        )}
                      </div>
                    </div>
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-2 text-sm text-gray-500">
                  No campaigns found
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Brand (read-only) */}
        <div>
          <label className="block text-sm font-medium mb-1">Brand</label>
          <Input
            value={
              loadingBrand
                ? "Loading brand…"
                : brandName || (brandId ? `Brand: ${brandId}` : "")
            }
            placeholder="Select a campaign to auto-fill"
            readOnly
            className="bg-gray-50"
          />
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue"
            rows={6}
          />
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Attachments (optional)
          </label>
          <Input
            key={attachmentsInputKey}
            type="file"
            multiple
            accept="image/*,application/pdf"
            onChange={handleAttachmentsChange}
            className="bg-white"
          />
          {attachments.length > 0 && (
            <div className="mt-1 text-xs text-gray-600 space-y-1">
              <p>
                {attachments.length} file
                {attachments.length > 1 ? "s" : ""} selected
              </p>
              <ul className="list-disc list-inside">
                {attachments.map((f) => (
                  <li key={f.name}>
                    {f.name}{" "}
                    <span className="text-[10px] text-gray-400">
                      ({Math.round(f.size / 1024)} KB)
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="text-[11px] text-blue-600 underline"
                onClick={resetAttachments}
              >
                Clear attachments
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-[#FFBF00] to-[#FFDB58] text-gray-800"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Creating…" : "Create Dispute"}
          </Button>
        </div>
      </div>
    </div>
  );
}
