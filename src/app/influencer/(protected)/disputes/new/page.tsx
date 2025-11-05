"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { post } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewInfluencerDisputePage() {
  const router = useRouter();
  const [influencerId, setInfluencerId] = useState<string | null>(null);

  const [campaignId, setCampaignId] = useState("");
  const [brandId, setBrandId] = useState("");
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
        <div>
          <label className="block text-sm font-medium mb-1">Campaign ID</label>
          <Input value={campaignId} onChange={(e) => setCampaignId(e.target.value)} placeholder="campaignsId UUID" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Brand ID</label>
          <Input value={brandId} onChange={(e) => setBrandId(e.target.value)} placeholder="brandId (UUID)" />
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
