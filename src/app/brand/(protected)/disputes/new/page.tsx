"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get, post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewBrandDisputePage() {
  const router = useRouter();
  const [brandId, setBrandId] = useState<string | null>(null);

  type Campaign = {
    campaignsId: string;
    productOrServiceName?: string;
  };
  type Applicant = {
    influencerId: string;
    name?: string;
    handle?: string | null;
  };

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

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("brandId") : null;
    setBrandId(id);
  }, []);

  // Load brand's active campaigns
  useEffect(() => {
    const load = async () => {
      if (!brandId) return;
      setLoadingCampaigns(true);
      try {
        const data = await get<{ data: Campaign[] }>("/campaign/active", { brandId, page: 1, limit: 1000 });
        setCampaigns(data?.data || []);
      } catch (e: any) {
        // keep page usable; show error banner
        setError(e?.message || "Failed to load campaigns");
      } finally {
        setLoadingCampaigns(false);
      }
    };
    load();
  }, [brandId]);

  // Load applicants when a campaign is selected
  useEffect(() => {
    const load = async () => {
      setApplicants([]);
      setInfluencerId("");
      if (!campaignId) return;
      setLoadingApplicants(true);
      try {
        const data = await post<{ influencers: Applicant[] }>("/apply/list", { campaignId, page: 1, limit: 1000 });
        setApplicants(data?.influencers || []);
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || "Failed to load applicants");
      } finally {
        setLoadingApplicants(false);
      }
    };
    load();
  }, [campaignId]);

  const submit = async () => {
    setError(null);
    if (!brandId) {
      setError("Missing brand id (not logged in?)");
      return;
    }
    if (!influencerId || !subject) {
      setError("influencerId and subject are required");
      return;
    }

    setSubmitting(true);
    try {
      const body: any = {
        campaignId: campaignId || undefined,
        brandId,
        influencerId,
        subject,
        description,
        related: { type: relatedType as any, id: relatedId || undefined },
      };
      await post("/dispute/create", body);
      router.push("/brand/disputes");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Failed to create dispute");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Raise a Dispute</h1>
      <div className="space-y-4 bg-white p-4 rounded border">
        {error && <p className="text-red-600">{error}</p>}
        <div>
          <label className="block text-sm font-medium mb-1">Campaign</label>
          <Select
            value={campaignId}
            onValueChange={(v) => setCampaignId(v)}
          >
            <SelectTrigger className="!bg-white w-full">
              <SelectValue placeholder={loadingCampaigns ? "Loading campaigns…" : "Select a campaign (optional)"} />
            </SelectTrigger>
            <SelectContent className="!bg-white max-h-64 overflow-auto w-[var(--radix-select-trigger-width)]">
              {campaigns.map((c) => (
                <SelectItem key={c.campaignsId} value={c.campaignsId}>
                  <span className="block truncate max-w-[32rem]">
                    {c.productOrServiceName || c.campaignsId}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Applied Influencer</label>
          <Select
            disabled={!campaignId || loadingApplicants}
            value={influencerId}
            onValueChange={(v) => setInfluencerId(v)}
          >
            <SelectTrigger className="!bg-white w-full">
              <SelectValue placeholder={!campaignId ? "Select a campaign first" : (loadingApplicants ? "Loading…" : "Select an influencer") } />
            </SelectTrigger>
            <SelectContent className="!bg-white max-h-64 overflow-auto w-[var(--radix-select-trigger-width)]">
              {applicants.map((a) => (
                <SelectItem key={a.influencerId} value={a.influencerId}>
                  <span className="block truncate max-w-[32rem]">
                    {a.name || a.influencerId} {a.handle ? `(${a.handle})` : ""}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Subject</label>
          <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the issue" rows={4} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Related Type</label>
            <Select value={relatedType} onValueChange={(v) => setRelatedType(v)}>
              <SelectTrigger className="!bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="!bg-white">
                <SelectItem value="other">Other</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="milestone">Milestone</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {relatedType !== "other" && (
          <div>
            <label className="block text-sm font-medium mb-1">Related ID</label>
            <Input value={relatedId} onChange={(e) => setRelatedId(e.target.value)} placeholder="Optional related entity id" />
          </div>
        )}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => router.back()} disabled={submitting}>Cancel</Button>
          <Button
            className="bg-gradient-to-r from-[#FFA135] to-[#FF7236] text-white"
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
