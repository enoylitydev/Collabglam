"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type BrandResult = { brandId: string; name: string };
type Campaign = { campaignsId: string; productOrServiceName?: string };

export default function NewInfluencerDisputePage() {
  const router = useRouter();
  const [influencerId, setInfluencerId] = useState<string | null>(null);

  // Brand search/selection
  const [brandQuery, setBrandQuery] = useState("");
  const [brandResults, setBrandResults] = useState<BrandResult[]>([]);
  const [brandLoading, setBrandLoading] = useState(false);
  const [brandNoResults, setBrandNoResults] = useState(false);
  const [brandId, setBrandId] = useState("");
  const [brandName, setBrandName] = useState("");

  // Campaigns by selected brand
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignId, setCampaignId] = useState("");

  // Form fields
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [relatedType, setRelatedType] = useState("other");
  const [relatedId, setRelatedId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
    setInfluencerId(id);
  }, []);

  // Search brands as influencer types into brandQuery
  useEffect(() => {
    const q = brandQuery.trim();
    if (!q) {
      setBrandResults([]);
      setBrandNoResults(false);
      return;
    }

    setBrandLoading(true);
    setBrandNoResults(false);

    const handler = setTimeout(async () => {
      try {
        const infId = typeof window !== "undefined" ? localStorage.getItem("influencerId") : null;
        if (!infId) {
          setBrandResults([]);
          setBrandNoResults(true);
          return;
        }
        const resp = await post<{ results?: BrandResult[]; message?: string }>(
          "/influencer/searchBrand",
          { search: q, influencerId: infId }
        );
        if (!resp?.results?.length) {
          setBrandResults([]);
          setBrandNoResults(true);
        } else {
          setBrandResults(resp.results);
          setBrandNoResults(false);
        }
      } catch (e) {
        setBrandResults([]);
        setBrandNoResults(true);
      } finally {
        setBrandLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [brandQuery]);

  // When a brand is chosen, fetch its active campaigns via admin endpoint
  const selectBrand = async (b: BrandResult) => {
    setBrandId(b.brandId);
    setBrandName(b.name);
    setBrandQuery(b.name);
    setBrandResults([]);
    setBrandNoResults(false);
    setCampaignId("");
    setCampaigns([]);

    try {
      setLoadingCampaigns(true);
      const data = await post<{ campaigns?: Campaign[] }>(
        "/admin/campaign/getByBrandId",
        { brandId: b.brandId, page: 1, limit: 1000, status: 1 }
      );
      setCampaigns(data?.campaigns || []);
    } catch (e) {
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const clearBrand = () => {
    setBrandId("");
    setBrandName("");
    setBrandQuery("");
    setBrandResults([]);
    setCampaignId("");
    setCampaigns([]);
  };

  const submit = async () => {
    setError(null);
    if (!influencerId) {
      setError("Missing influencer id (not logged in?)");
      return;
    }
    if (!brandId || !subject) {
      setError("brandId and subject are required");
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
      router.push("/influencer/disputes");
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

        {/* Brand search + select */}
        <div className="relative">
          <label className="block text-sm font-medium mb-1">Brand</label>
          <div className="relative">
            <Input
              value={brandQuery}
              onChange={(e) => setBrandQuery(e.target.value)}
              placeholder="Search brand by name"
              className="pr-10"
            />
            {brandLoading && (
              <span className="absolute inset-y-0 right-3 my-auto h-4 w-4 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
            )}
          </div>
          {(brandResults.length > 0 || brandNoResults) && (
            <ul className="absolute z-40 mt-1 w-full bg-white border rounded shadow max-h-60 overflow-auto">
              {brandResults.map((b) => (
                <li
                  key={b.brandId}
                  className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => selectBrand(b)}
                >
                  {b.name}
                </li>
              ))}
              {brandNoResults && !brandLoading && (
                <li className="px-3 py-2 text-gray-500 select-none">No result found</li>
              )}
            </ul>
          )}
          {brandId && (
            <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
              <span>Selected:</span>
              <span className="font-medium">{brandName}</span>
              <button type="button" onClick={clearBrand} className="text-blue-600 hover:underline">
                Change
              </button>
            </div>
          )}
        </div>

        {/* Campaign (optional) */}
        <div>
          <label className="block text-sm font-medium mb-1">Campaign</label>
          <Select
            disabled={!brandId || loadingCampaigns}
            value={campaignId}
            onValueChange={(v) => setCampaignId(v)}
          >
            <SelectTrigger className="!bg-white w-full">
              <SelectValue placeholder={!brandId ? "Select a brand first" : (loadingCampaigns ? "Loading…" : "Select a campaign (optional)") } />
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
