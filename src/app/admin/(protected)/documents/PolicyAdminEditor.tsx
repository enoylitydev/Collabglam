"use client";

import React, { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";
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

const policyContentClasses = `
  prose prose-gray max-w-none
  prose-headings:font-semibold
  prose-headings:text-gray-900
  prose-h1:text-3xl prose-h1:mt-10 prose-h1:mb-5
  prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4
  prose-h3:text-xl prose-h3:mt-6 prose-h3:mb-3
  prose-h4:text-lg prose-h4:mt-5 prose-h4:mb-3
  prose-p:my-4
  prose-p:leading-8
  prose-ul:my-5
  prose-ol:my-5
  prose-li:my-2
  prose-li:leading-8
  prose-strong:text-gray-900
  prose-a:text-[#ef2f5b]
  prose-a:no-underline
  hover:prose-a:underline
  prose-blockquote:my-6
  prose-blockquote:border-l-4
  prose-blockquote:border-[#ef2f5b]
  prose-blockquote:pl-4
  prose-blockquote:italic
  prose-hr:my-8
  prose-table:my-6
  prose-table:w-full
  prose-table:border-collapse
  prose-th:border
  prose-th:border-gray-300
  prose-th:bg-gray-100
  prose-th:p-3
  prose-th:text-left
  prose-td:border
  prose-td:border-gray-300
  prose-td:p-3
`;

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