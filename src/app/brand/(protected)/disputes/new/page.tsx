"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get, post } from "@/lib/api";
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
import { ArrowLeft } from "lucide-react";

type Campaign = {
  campaignsId: string;
  productOrServiceName?: string;
};

type Applicant = {
  influencerId: string;
  name?: string;
  handle?: string | null;
};

export default function NewBrandDisputePage() {
  const router = useRouter();
  const [brandId, setBrandId] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  const [campaignId, setCampaignId] = useState("");
  const [influencerId, setInfluencerId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [relatedType, setRelatedType] = useState("other");
  const [relatedId, setRelatedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load brandId from storage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = localStorage.getItem("brandId");
    setBrandId(id);
    if (!id) {
      setError("Missing brand id (not logged in as brand?)");
    }
  }, []);

  // Load brand's active campaigns
  useEffect(() => {
    const loadCampaigns = async () => {
      if (!brandId) return;
      setLoadingCampaigns(true);
      setError(null);
      try {
        const data = await get<{ data: Campaign[] }>("/campaign/active", {
          brandId,
          page: 1,
          limit: 1000,
        });
        setCampaigns(data?.data || []);
      } catch (e: any) {
        setError(e?.message || "Failed to load campaigns");
      } finally {
        setLoadingCampaigns(false);
      }
    };
    loadCampaigns();
  }, [brandId]);

  // Load applicants for selected campaign
  useEffect(() => {
    const loadApplicants = async () => {
      setApplicants([]);
      setInfluencerId("");
      if (!campaignId) return;
      setLoadingApplicants(true);
      setError(null);
      try {
        const data = await post<{ influencers: Applicant[] }>("/apply/list", {
          campaignId,
          page: 1,
          limit: 1000,
        });
        setApplicants(data?.influencers || []);
      } catch (e: any) {
        setError(
          e?.response?.data?.message ||
            e?.message ||
            "Failed to load applicants"
        );
      } finally {
        setLoadingApplicants(false);
      }
    };
    loadApplicants();
  }, [campaignId]);

  const submit = async () => {
    setError(null);

    if (!brandId) {
      setError("Missing brand id (not logged in?)");
      return;
    }
    if (!influencerId || !subject.trim()) {
      setError("Influencer and subject are required");
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        campaignId: campaignId || undefined,
        brandId, // required by backend brandCreateDispute
        influencerId,
        subject: subject.trim(),
        description: description.trim(),
        // kept for future, backend ignores for now
        related: { type: relatedType as any, id: relatedId || undefined },
      };
      await post("/dispute/brand/create", body);
      router.push("/brand/disputes");
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Failed to create dispute"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      {/* Back */}
      <Button
        variant="ghost"
        className="px-0 flex items-center gap-2 text-sm text-gray-700 bg-gray-200 shadow-sm"
        onClick={() => router.back()}
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <h1 className="text-2xl font-semibold mb-2">Raise a Dispute</h1>

      <div className="space-y-4 bg-white p-4 rounded border">
        {error && <p className="text-red-600 text-sm">{error}</p>}

        {/* Campaign */}
        <div>
          <label className="block text-sm font-medium mb-1">Campaign</label>
          <Select value={campaignId} onValueChange={(v) => setCampaignId(v)}>
            <SelectTrigger className="!bg-white w-full">
              <SelectValue
                placeholder={
                  loadingCampaigns ? "Loading campaigns…" : "Select a campaign"
                }
              />
            </SelectTrigger>
            <SelectContent className="!bg-white max-h-64 overflow-auto w-[var(--radix-select-trigger-width)]">
              {campaigns.length ? (
                campaigns.map((c) => (
                  <SelectItem key={c.campaignsId} value={c.campaignsId}>
                    <span className="block truncate max-w-[32rem]">
                      {c.productOrServiceName || c.campaignsId}
                    </span>
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-2 text-sm text-gray-500">
                  No active campaigns
                </div>
              )}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            Optional but recommended – helps us link the dispute to a specific
            campaign.
          </p>
        </div>

        {/* Applied Influencer */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Applied Influencer
          </label>
          <Select
            disabled={!campaignId || loadingApplicants}
            value={influencerId}
            onValueChange={(v) => setInfluencerId(v)}
          >
            <SelectTrigger className="!bg-white w-full">
              <SelectValue
                placeholder={
                  !campaignId
                    ? "Select a campaign first"
                    : loadingApplicants
                    ? "Loading…"
                    : applicants.length
                    ? "Select an influencer"
                    : "No applied influencers in this campaign"
                }
              />
            </SelectTrigger>
            <SelectContent className="!bg-white max-h-64 overflow-auto w-[var(--radix-select-trigger-width)]">
              {applicants.length > 0 ? (
                applicants.map((a) => (
                  <SelectItem key={a.influencerId} value={a.influencerId}>
                    <span className="block truncate max-w-[32rem]">
                      {a.name || a.influencerId}{" "}
                      {a.handle ? `(${a.handle})` : ""}
                    </span>
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-2 text-sm text-gray-500">
                  No applied influencers in this campaign
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary of the issue"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail"
            rows={4}
          />
        </div>

        {/* Optional Related info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">
              Related Type (optional)
            </label>
            <Select
              value={relatedType}
              onValueChange={(v) => setRelatedType(v)}
            >
              <SelectTrigger className="!bg-white w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="!bg-white">
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="timeline">Timeline</SelectItem>
                <SelectItem value="content">Content</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              Related ID (optional)
            </label>
            <Input
              value={relatedId}
              onChange={(e) => setRelatedId(e.target.value)}
              placeholder="e.g. invoice id, reference code"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white"
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
