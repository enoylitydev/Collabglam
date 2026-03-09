"use client";

import React, { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import DOMPurify from "isomorphic-dompurify";
import { DM_Sans } from "next/font/google";
import { motion, AnimatePresence } from "framer-motion";
import { post } from "@/lib/api";
import Footer from "@/components/common/Footer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const dmSans = DM_Sans({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
});

type FAQItem = {
  faqId: string;
  sectionKey: string;
  sectionTitle: string;
  question: string;
  answer: string; // HTML
  displayOrder: number;
  isPublished: boolean;
};

type FAQPageData = {
  faqPageId?: string;
  pageKey?: string;
  title: string;
  shortDescription: string; // HTML
  introText: string; // HTML
  contactHeading: string;
  contactText: string; // HTML
  effectiveDate: string;
  isPublished: boolean;
  items: FAQItem[];
};

const contentClasses = [
  "max-w-none",
  "text-slate-700",

  "[&_h1]:text-3xl",
  "[&_h1]:font-bold",
  "[&_h1]:mt-8",
  "[&_h1]:mb-4",
  "[&_h1]:text-slate-900",

  "[&_h2]:text-2xl",
  "[&_h2]:font-semibold",
  "[&_h2]:mt-7",
  "[&_h2]:mb-3",
  "[&_h2]:text-slate-900",

  "[&_h3]:text-xl",
  "[&_h3]:font-semibold",
  "[&_h3]:mt-6",
  "[&_h3]:mb-3",
  "[&_h3]:text-slate-900",

  "[&_h4]:text-lg",
  "[&_h4]:font-semibold",
  "[&_h4]:mt-5",
  "[&_h4]:mb-2",
  "[&_h4]:text-slate-900",

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
  "[&_strong]:text-slate-900",

  "[&_a]:text-slate-900",
  "[&_a]:underline",
  "[&_a]:underline-offset-4",

  "[&_blockquote]:my-4",
  "[&_blockquote]:border-l-4",
  "[&_blockquote]:border-slate-300",
  "[&_blockquote]:pl-4",
  "[&_blockquote]:italic",

  "[&_hr]:my-6",

  "[&_table]:w-full",
  "[&_table]:border-collapse",
  "[&_table]:my-5",

  "[&_th]:border",
  "[&_th]:border-slate-300",
  "[&_th]:bg-slate-100",
  "[&_th]:p-3",
  "[&_th]:text-left",

  "[&_td]:border",
  "[&_td]:border-slate-300",
  "[&_td]:p-3",
].join(" ");

const stripHtml = (html: string) =>
  html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const getSectionOrder = (sectionKey: string) => {
  const orderMap: Record<string, number> = {
    general: 1,
    brand_questions: 2,
    creator_influencer_questions: 3,
    pricing_budget_fees_payouts: 4,
    campaign_workflow_questions: 5,
    messaging_safety_anti_bypass: 6,
    privacy_data_security: 7,
    legal_disclosure_content_rights: 8,
    billing_cancellations_refunds: 9,
    support_account_help: 10,
  };

  return orderMap[sectionKey] || 999;
};

export default function FAQPage() {
  const [faqPage, setFaqPage] = useState<FAQPageData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await post<FAQPageData>("/faqs/get", {});
        setFaqPage(data);
      } catch (err) {
        console.error(err);
        setError("Failed to load FAQs. Please try again later.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredFaqs = useMemo(() => {
    if (!faqPage?.items) return [];

    const publishedItems = faqPage.items
      .filter((item) => item.isPublished !== false)
      .sort((a, b) => {
        const sectionDiff = getSectionOrder(a.sectionKey) - getSectionOrder(b.sectionKey);
        if (sectionDiff !== 0) return sectionDiff;
        return (a.displayOrder || 0) - (b.displayOrder || 0);
      });

    if (!searchTerm.trim()) return publishedItems;

    const term = searchTerm.toLowerCase();

    return publishedItems.filter(({ question, answer, sectionTitle }) => {
      const plainAnswer = stripHtml(answer || "");
      return (
        question.toLowerCase().includes(term) ||
        plainAnswer.toLowerCase().includes(term) ||
        sectionTitle.toLowerCase().includes(term)
      );
    });
  }, [faqPage, searchTerm]);

  const groupedFaqs = useMemo(() => {
    const groups: Record<
      string,
      { sectionKey: string; sectionTitle: string; items: FAQItem[] }
    > = {};

    filteredFaqs.forEach((faq) => {
      if (!groups[faq.sectionKey]) {
        groups[faq.sectionKey] = {
          sectionKey: faq.sectionKey,
          sectionTitle: faq.sectionTitle,
          items: [],
        };
      }
      groups[faq.sectionKey].items.push(faq);
    });

    return Object.values(groups).sort(
      (a, b) => getSectionOrder(a.sectionKey) - getSectionOrder(b.sectionKey)
    );
  }, [filteredFaqs]);

  const safeShortDescription = useMemo(
    () => DOMPurify.sanitize(faqPage?.shortDescription || ""),
    [faqPage?.shortDescription]
  );

  const safeIntroText = useMemo(
    () => DOMPurify.sanitize(faqPage?.introText || ""),
    [faqPage?.introText]
  );

  const safeContactText = useMemo(
    () => DOMPurify.sanitize(faqPage?.contactText || ""),
    [faqPage?.contactText]
  );

  return (
    <div className={`${dmSans.className} min-h-screen bg-slate-50 text-slate-900`}>
      <Head>
        <title>{faqPage?.title || "Frequently Asked Questions | Collabglam"}</title>
        <meta
          name="description"
          content={
            faqPage ? stripHtml(faqPage.shortDescription).slice(0, 160) : "Frequently asked questions about Collabglam services."
          }
        />
      </Head>

      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-center gap-3">
            <img src="/logo.png" alt="Collabglam Logo" className="h-8 w-auto" />
            <span className="text-lg font-semibold tracking-tight text-slate-900">
              Collabglam
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {loading && (
          <div className="space-y-5 animate-pulse">
            <div className="h-10 w-72 rounded-xl bg-slate-200" />
            <div className="h-28 rounded-2xl bg-slate-200" />
            <div className="h-14 rounded-xl bg-slate-200" />
            <div className="h-20 rounded-2xl bg-slate-200" />
            <div className="h-20 rounded-2xl bg-slate-200" />
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {!loading && !error && faqPage && (
          <div className="space-y-8">
            <section className="rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8 sm:py-10">
              <div className="mx-auto max-w-4xl text-center">
                <div className="mb-4 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-600">
                  Help Center
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
                  {faqPage.title}
                </h1>

                <div className={`mx-auto mt-5 max-w-3xl text-left sm:text-center ${contentClasses}`}>
                  <div dangerouslySetInnerHTML={{ __html: safeShortDescription }} />
                </div>

                <div className={`mx-auto mt-3 max-w-3xl text-left sm:text-center ${contentClasses}`}>
                  <div dangerouslySetInnerHTML={{ __html: safeIntroText }} />
                </div>

                <div className="mt-6 inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
                  Effective Date: {String(faqPage.effectiveDate).split("T")[0]}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Search FAQs</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Find answers by keyword, topic, or phrase.
                  </p>
                </div>

                <div className="w-full lg:max-w-xl">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search questions, answers, or topics..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-400">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.5 3a5.5 5.5 0 104.223 9.025l3.626 3.626a.75.75 0 101.06-1.06l-3.626-3.626A5.5 5.5 0 008.5 3zm-4 5.5a4 4 0 118 0 4 4 0 01-8 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <AnimatePresence mode="wait">
              {filteredFaqs.length > 0 ? (
                <motion.div
                  key="faq-results"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.22 }}
                  className="space-y-8"
                >
                  {groupedFaqs.map((group) => (
                    <section key={group.sectionKey} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-1.5 rounded-full bg-slate-900" />
                        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                          {group.sectionTitle}
                        </h2>
                      </div>

                      <Accordion type="single" collapsible className="space-y-3">
                        {group.items.map((faq) => (
                          <AccordionItem
                            key={faq.faqId}
                            value={faq.faqId}
                            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                          >
                            <AccordionTrigger className="px-5 py-4 text-left text-base font-medium text-slate-900 hover:no-underline sm:px-6">
                              {faq.question}
                            </AccordionTrigger>

                            <AccordionContent className="border-t border-slate-100 px-5 pb-5 pt-4 sm:px-6">
                              <motion.div
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                transition={{ duration: 0.2 }}
                                className={contentClasses}
                              >
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize(faq.answer || ""),
                                  }}
                                />
                              </motion.div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </section>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="empty-results"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm"
                >
                  <h3 className="text-lg font-semibold text-slate-900">No matching FAQs</h3>
                  <p className="mt-2 text-slate-600">
                    No FAQs found for “{searchTerm}”.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v1H2V5z" />
                    <path
                      fillRule="evenodd"
                      d="M2 8h16v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8zm3 2.25a.75.75 0 000 1.5h3a.75.75 0 000-1.5H5z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {faqPage.contactHeading || "Contact Information"}
                </h2>
              </div>

              <div className={contentClasses}>
                <div dangerouslySetInnerHTML={{ __html: safeContactText }} />
              </div>
            </section>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}