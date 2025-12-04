"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { get, post, postFormData } from "@/lib/api";
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
import { ArrowLeft, Paperclip, X } from "lucide-react";

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
  const [attachments, setAttachments] = useState<File[]>([]);

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

  const handleAttachmentChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setAttachments((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

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
      const form = new FormData();
      form.append("brandId", brandId);
      form.append("influencerId", influencerId);
      if (campaignId) form.append("campaignId", campaignId);
      form.append("subject", subject.trim());
      form.append("description", description.trim());

      // Optional metadata you kept before (backend currently ignores this)
      form.append(
        "related",
        JSON.stringify({
          type: relatedType,
          id: relatedId || undefined,
        })
      );

      // Multi-attachment support – field name matches backend: "attachments"
      attachments.forEach((file) => {
        form.append("attachments", file);
      });

      await postFormData("/dispute/brand/create", form);
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

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium mb-1">
            Attachments (optional)
          </label>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm cursor-pointer bg-gray-50 hover:bg-gray-100">
              <Paperclip className="h-4 w-4" />
              <span>Add files</span>
              <input
                type="file"
                multiple
                className="hidden"
                onChange={handleAttachmentChange}
              />
            </label>
            {attachments.length > 0 && (
              <span className="text-xs text-gray-600">
                {attachments.length} file
                {attachments.length > 1 ? "s" : ""} attached
              </span>
            )}
          </div>

          {attachments.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-gray-700">
              {attachments.map((file, idx) => (
                <li
                  key={`${file.name}-${idx}`}
                  className="flex items-center justify-between gap-2 border rounded px-2 py-1 bg-gray-50"
                >
                  <span className="truncate max-w-xs">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-gray-500 hover:text-red-600"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[11px] text-gray-500 mt-1">
            You can attach screenshots, contracts, or other relevant documents.
          </p>
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
