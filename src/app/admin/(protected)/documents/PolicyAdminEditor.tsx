"use client";

import React, { useEffect, useMemo, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { post } from "@/lib/api";
import RichTextEditor from "./RichTextEditor";

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

const policyContentClasses = [
  "max-w-none",
  "text-gray-800",

  "[&_h1]:text-3xl",
  "[&_h1]:font-bold",
  "[&_h1]:mt-8",
  "[&_h1]:mb-4",

  "[&_h2]:text-2xl",
  "[&_h2]:font-semibold",
  "[&_h2]:mt-7",
  "[&_h2]:mb-3",

  "[&_h3]:text-xl",
  "[&_h3]:font-semibold",
  "[&_h3]:mt-6",
  "[&_h3]:mb-3",

  "[&_h4]:text-lg",
  "[&_h4]:font-semibold",
  "[&_h4]:mt-5",
  "[&_h4]:mb-2",

  "[&_p]:my-3",
  "[&_p]:leading-7",

  "[&_br]:leading-7",

  "[&_ul]:my-3",
  "[&_ul]:list-disc",
  "[&_ul]:pl-6",

  "[&_ol]:my-3",
  "[&_ol]:list-decimal",
  "[&_ol]:pl-6",

  "[&_li]:my-1",
  "[&_li]:leading-7",

  "[&_li>p]:my-0",
  "[&_li>p]:leading-7",

  "[&_strong]:font-semibold",
  "[&_strong]:text-gray-900",

  "[&_a]:text-[#ef2f5b]",
  "[&_a]:no-underline",
  "hover:[&_a]:underline",

  "[&_blockquote]:my-4",
  "[&_blockquote]:border-l-4",
  "[&_blockquote]:border-[#ef2f5b]",
  "[&_blockquote]:pl-4",
  "[&_blockquote]:italic",

  "[&_hr]:my-6",

  "[&_table]:w-full",
  "[&_table]:border-collapse",
  "[&_table]:my-5",

  "[&_th]:border",
  "[&_th]:border-gray-300",
  "[&_th]:bg-gray-100",
  "[&_th]:p-3",
  "[&_th]:text-left",

  "[&_td]:border",
  "[&_td]:border-gray-300",
  "[&_td]:p-3",
].join(" ");

export default function PolicyAdminEditor({
  pageTitle,
  contentLabel,
  policyKey,
  policyTitle,
  fileName,
}: PolicyAdminEditorProps) {
  const [policyHtml, setPolicyHtml] = useState("");
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
        setPolicyHtml(res?.content || "");
      } catch {
        setExists(false);
        setEffectiveDate("");
        setPolicyHtml("");
      } finally {
        setLoading(false);
      }
    };

    loadPolicy();
  }, [policyKey]);

  const sanitizedPreview = useMemo(() => {
    return DOMPurify.sanitize(policyHtml || "");
  }, [policyHtml]);

  const handleSave = async () => {
    if (!effectiveDate.trim() || !policyHtml.trim()) return;

    setSaving(true);

    const payload: Partial<Policy> = {
      policyKey,
      title: policyTitle,
      fileName,
      effectiveDate,
      content: policyHtml,
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
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{pageTitle}</h1>

      <div className="mb-5">
        <label className="block mb-2 font-medium">Effective Date</label>
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
        <label className="block mb-2 font-medium">{contentLabel}</label>
        <RichTextEditor
          value={policyHtml}
          onChange={(html) => {
            setPolicyHtml(html);
            setDirty(true);
          }}
        />
      </div>

      <Button
        onClick={handleSave}
        disabled={!dirty || saving || !effectiveDate.trim() || !policyHtml.trim()}
        className="bg-[#ef2f5b] text-white hover:bg-[#ef2f5b]/80 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save"}
      </Button>

      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4">Preview</h2>
        <div className="rounded-lg border bg-white p-6 sm:p-8">
          <article className={policyContentClasses}>
            <div dangerouslySetInnerHTML={{ __html: sanitizedPreview }} />
          </article>
        </div>
      </div>
    </div>
  );
}