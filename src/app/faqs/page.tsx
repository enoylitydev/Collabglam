'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { post } from '@/lib/api';
import Footer from '@/components/common/Footer';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { motion, AnimatePresence } from 'framer-motion';
import { DM_Sans } from 'next/font/google';

const dmSans = DM_Sans({
  weight: ['400', '700'],
  subsets: ['latin'],
  display: 'swap',
});

type FAQItem = {
  faqId: string;
  sectionKey: string;
  sectionTitle: string;
  question: string;
  answer: string;
  displayOrder: number;
  isPublished: boolean;
};

type FAQPageData = {
  faqPageId?: string;
  pageKey?: string;
  title: string;
  shortDescription: string;
  introText: string;
  contactHeading: string;
  contactText: string;
  effectiveDate: string;
  isPublished: boolean;
  items: FAQItem[];
};

export default function FAQPage() {
  const [faqPage, setFaqPage] = useState<FAQPageData | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await post<FAQPageData>('/faqs/get');
        setFaqPage(data);
      } catch (err) {
        console.error(err);
        setError('Failed to load FAQs. Please try again later.');
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
        if (a.sectionTitle !== b.sectionTitle) {
          return a.sectionTitle.localeCompare(b.sectionTitle);
        }
        return (a.displayOrder || 0) - (b.displayOrder || 0);
      });

    if (!searchTerm.trim()) return publishedItems;

    const term = searchTerm.toLowerCase();

    return publishedItems.filter(
      ({ question, answer, sectionTitle }) =>
        question.toLowerCase().includes(term) ||
        answer.toLowerCase().includes(term) ||
        sectionTitle.toLowerCase().includes(term)
    );
  }, [faqPage, searchTerm]);

  const groupedFaqs = useMemo(() => {
    return filteredFaqs.reduce((acc, faq) => {
      if (!acc[faq.sectionTitle]) {
        acc[faq.sectionTitle] = [];
      }
      acc[faq.sectionTitle].push(faq);
      return acc;
    }, {} as Record<string, FAQItem[]>);
  }, [filteredFaqs]);

  return (
    <div
      className={`${dmSans.className} flex flex-col min-h-screen bg-pink-50 text-gray-900`}
    >
      <Head>
        <title>{faqPage?.title || 'Frequently Asked Questions | Collabglam'}</title>
        <meta
          name="description"
          content={
            faqPage?.shortDescription ||
            'Frequently asked questions about Collabglam services.'
          }
        />
      </Head>

      <header className="fixed inset-x-0 top-0 bg-white shadow-sm z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="Collabglam Logo"
              className="h-8 w-auto"
            />
            <span className="text-xl font-bold text-gray-800">
              Collabglam
            </span>
          </Link>
        </div>
      </header>

      <div className="h-16" aria-hidden />

      <main className="container mx-auto px-6 py-12 flex-grow max-w-5xl">
        {loading && (
          <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-gray-200 rounded-lg" />
            <div className="h-20 bg-gray-200 rounded-lg" />
            <div className="h-12 bg-gray-200 rounded-lg" />
            <div className="h-12 bg-gray-200 rounded-lg" />
            <div className="h-12 bg-gray-200 rounded-lg" />
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {!loading && !error && faqPage && (
          <>
            <div className="text-center mb-10">
              <h1 className="text-4xl font-bold mb-4">{faqPage.title}</h1>

              <p className="text-gray-700 max-w-3xl mx-auto whitespace-pre-line mb-4">
                {faqPage.shortDescription}
              </p>

              <p className="text-gray-600 max-w-3xl mx-auto whitespace-pre-line">
                {faqPage.introText}
              </p>

              <p className="mt-4 text-sm text-gray-500">
                Effective Date: {String(faqPage.effectiveDate).split('T')[0]}
              </p>
            </div>

            <div className="mb-8 flex justify-center">
              <input
                type="text"
                placeholder="Search FAQs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full max-w-lg px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 bg-white"
              />
            </div>

            <AnimatePresence>
              {filteredFaqs.length > 0 ? (
                <div className="space-y-8">
                  {Object.entries(groupedFaqs).map(([sectionTitle, faqs]) => (
                    <section key={sectionTitle}>
                      <h2 className="text-2xl font-semibold mb-4">{sectionTitle}</h2>

                      <Accordion type="single" collapsible className="space-y-4">
                        {faqs.map((faq) => (
                          <AccordionItem
                            key={faq.faqId}
                            value={faq.faqId}
                            className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
                          >
                            <AccordionTrigger className="flex justify-between items-center px-4 py-3">
                              <span className="text-lg font-medium text-left">
                                {faq.question}
                              </span>
                            </AccordionTrigger>

                            <AccordionContent className="px-4 pb-4 text-gray-700 whitespace-pre-line">
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                {faq.answer}
                              </motion.div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500">
                  No FAQs found for “{searchTerm}”.
                </div>
              )}
            </AnimatePresence>

            <section className="mt-16 bg-white rounded-xl shadow-sm border border-pink-100 p-6">
              <h2 className="text-2xl font-semibold mb-4">
                {faqPage.contactHeading || 'Contact Information'}
              </h2>
              <div className="text-gray-700 whitespace-pre-line">
                {faqPage.contactText}
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}