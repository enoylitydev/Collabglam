"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
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

  // Load campaigns usable for dispute (applied/contracted/accepted)
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
      const body: any = {
        campaignId: campaignId || undefined,
        brandId,
        influencerId,
        subject: subject.trim(),
        description: description.trim(),
        related: { type: relatedType as any, id: relatedId || undefined },
      };

      await post("/dispute/influencer/create", body);
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
        {error && <p className="text-red-600">{error}</p>}

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
                        {/* Always show Applied */}
                        {c.hasApplied === 1 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wide bg-slate-50 text-slate-700 border border-slate-200"
                          >
                            Applied
                          </Badge>
                        )}

                        {/* Contracted (shows contract status like Sent / Negotiation / etc.) */}
                        {c.isContracted === 1 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wide bg-sky-50 text-sky-700 border border-sky-200"
                          >
                            {formatContractStatus(c.contractStatus)}
                          </Badge>
                        )}

                        {/* Accepted (final state) */}
                        {c.isAccepted === 1 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200"
                          >
                            Accepted
                          </Badge>
                        )}

                        {/* Optional: show if campaign is no longer active */}
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

        {/* Brand (read-only auto-filled) */}
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
