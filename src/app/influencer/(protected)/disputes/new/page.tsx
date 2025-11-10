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

type AppliedCampaign = {
  campaignsId: string;
  productOrServiceName?: string;
  brandId?: string;
  brand?: { brandId?: string; name?: string };
  brandName?: string;
};

export default function NewInfluencerDisputePage() {
  const router = useRouter();
  const [influencerId, setInfluencerId] = useState<string | null>(null);

  // Applied campaigns (from backend)
  const [campaigns, setCampaigns] = useState<AppliedCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignId, setCampaignId] = useState("");

  // Brand (auto from campaign)
  const [brandId, setBrandId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [loadingBrand, setLoadingBrand] = useState(false);

  // Form
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [relatedType] = useState("other");
  const [relatedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id =
      typeof window !== "undefined"
        ? localStorage.getItem("influencerId")
        : null;
    setInfluencerId(id);
  }, []);

  // Load applied campaigns (backend: /campaign/applied)
  useEffect(() => {
    const load = async () => {
      if (!influencerId) return;
      setLoadingCampaigns(true);
      try {
        const data = await post<{ meta?: any; campaigns?: AppliedCampaign[] }>(
          "/campaign/applied",
          { influencerId, page: 1, limit: 1000 }
        );
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
    () => campaigns.find((c) => c.campaignsId === campaignId),
    [campaigns, campaignId]
  );

  // Auto-fill brand from the selected campaign
  useEffect(() => {
    const fillBrand = async () => {
      if (!selectedCampaign) {
        setBrandId("");
        setBrandName("");
        return;
      }

      const inferredBrandId =
        selectedCampaign.brandId || selectedCampaign.brand?.brandId || "";
      const inferredBrandName =
        selectedCampaign.brandName || selectedCampaign.brand?.name || "";

      setBrandId(inferredBrandId);

      if (inferredBrandName) {
        setBrandName(inferredBrandName);
        return;
      }

      if (inferredBrandId) {
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
      } else {
        setBrandName("");
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
    if (!brandId || !subject) {
      setError("Brand and subject are required.");
      return;
    }

    setSubmitting(true);
    try {
      // payload unchanged
      const body: any = {
        campaignId: campaignId || undefined,
        brandId,
        influencerId,
        subject,
        description,
        related: { type: relatedType as any, id: relatedId || undefined },
      };
      await post("/dispute/create", body);
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

        {/* 1) Campaign */}
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
                    ? "Loading your applied campaigns…"
                    : campaigns.length
                    ? "Select a campaign"
                    : "No applied campaigns found"
                }
              />
            </SelectTrigger>
            <SelectContent className="!bg-white max-h-64 overflow-auto w-[var(--radix-select-trigger-width)]">
              {campaigns.length > 0 ? (
                campaigns.map((c) => (
                  <SelectItem key={c.campaignsId} value={c.campaignsId}>
                    <span className="block truncate max-w-[28rem]">
                      {c.productOrServiceName || c.campaignsId}
                    </span>
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-2 text-sm text-gray-500">
                  No applied campaigns found
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* 2) Brand (auto-filled, read-only) */}
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

        {/* 3) Subject */}
        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary"
          />
        </div>

        {/* 4) Description */}
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
            Create Dispute
          </Button>
        </div>
      </div>
    </div>
  );
}
