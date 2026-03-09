"use client";

import React, { useEffect, useState } from "react";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { post } from "@/lib/api";

interface Policy {
  policyId?: string;
  policyKey: string;
  title: string;
  fileName: string;
  effectiveDate: string;
  content: string;
  isPublished?: boolean;
}

interface PolicyAdminEditorProps {
  pageTitle: string;
  contentLabel: string;
  policyKey: string;
  policyTitle: string;
  fileName: string;
}

export default function PolicyAdminEditor({
  pageTitle,
  contentLabel,
  policyKey,
  policyTitle,
  fileName,
}: PolicyAdminEditorProps) {
  const [policyText, setPolicyText] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [exists, setExists] = useState(false);

  useEffect(() => {
    const loadPolicy = async () => {
      try {
        const res = await post<Policy>("/policy/getlist", { policyKey });

        setExists(true);
        setEffectiveDate(res?.effectiveDate ? String(res.effectiveDate).split("T")[0] : "");
        setPolicyText(res?.content || "");
      } catch {
        setExists(false);
        setEffectiveDate("");
        setPolicyText("");
      } finally {
        setLoading(false);
      }
    };

    loadPolicy();
  }, [policyKey]);

  const handleSave = async () => {
    if (!effectiveDate.trim() || !policyText.trim()) return;

    setSaving(true);

    const payload: Partial<Policy> = {
      policyKey,
      title: policyTitle,
      fileName,
      effectiveDate,
      content: policyText,
      isPublished: true,
    };

    try {
      if (exists) {
        await post<Policy>("/policy/update", payload);
      } else {
        await post<Policy>("/policy/create", payload);
        setExists(true);
      }

      setDirty(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <CardContent>Loading...</CardContent>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{pageTitle}</h1>

      <div className="mb-4">
        <label className="block mb-1 font-medium">Effective Date</label>
        <Input
          type="date"
          value={effectiveDate}
          onChange={(e) => {
            setEffectiveDate(e.target.value);
            setDirty(true);
          }}
        />
      </div>

      <div className="mb-6">
        <label className="block mb-1 font-medium">{contentLabel}</label>
        <Textarea
          rows={18}
          value={policyText}
          onChange={(e) => {
            setPolicyText(e.target.value);
            setDirty(true);
          }}
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={!dirty || saving || !effectiveDate.trim() || !policyText.trim()}
        className="bg-[#ef2f5b] text-white hover:bg-[#ef2f5b]/80 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </Button>
    </div>
  );
}