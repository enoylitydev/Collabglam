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