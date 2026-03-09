"use client";

import React, { useEffect, useMemo, useState } from "react";
import NextLink from "next/link";
import DOMPurify from "isomorphic-dompurify";
import Footer from "@/components/common/Footer";
import { post } from "@/lib/api";

interface Policy {
  policyId?: string;
  policyKey: string;
  title: string;
  fileName?: string;
  effectiveDate: string;
  content: string;
  isPublished?: boolean;
}

interface PublicPolicyPageProps {
  heading: string;
  policyKey: string;
  errorMessage: string;
  loadingMessage: string;
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

export default function PublicPolicyPage({
  heading,
  policyKey,
  errorMessage,
  loadingMessage,
}: PublicPolicyPageProps) {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await post<Policy>("/policy/getlist", { policyKey });
        setPolicy(res);
      } catch (e) {
        console.error(e);
        setError(errorMessage);
      }
    })();
  }, [policyKey, errorMessage]);

  const safeHtml = useMemo(() => {
    return DOMPurify.sanitize(policy?.content || "");
  }, [policy?.content]);

  return (
    <div className="flex flex-col min-h-screen bg-white text-gray-900">
      <header className="fixed inset-x-0 top-0 bg-white shadow-sm z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 py-2">
          <NextLink href="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="Collabglam Logo" className="h-8 w-auto" />
            <span className="text-lg font-bold text-gray-800">Collabglam</span>
          </NextLink>
        </div>
      </header>

      <div className="h-14" aria-hidden="true" />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-14">
        <h1 className="text-3xl sm:text-4xl font-semibold mb-3">{heading}</h1>

        {error ? (
          <p className="text-center text-red-600">{error}</p>
        ) : !policy ? (
          <p className="text-center text-gray-600">{loadingMessage}</p>
        ) : (
          <>
            <p className="mb-8 text-sm text-gray-600">
              Effective Date: {String(policy.effectiveDate).split("T")[0]}
            </p>

            <article className={policyContentClasses}>
              <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
            </article>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}