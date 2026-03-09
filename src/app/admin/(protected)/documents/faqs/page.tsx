'use client';

import { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import { post } from '@/lib/api';
import RichTextEditor from '../RichTextEditor'

interface FAQItem {
  faqId: string;
  sectionKey: string;
  sectionTitle: string;
  question: string;
  answer: string; // HTML
  displayOrder: number;
  isPublished: boolean;
}

interface FAQPage {
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
}

const SECTION_OPTIONS = [
  { key: 'general', title: 'A. General' },
  { key: 'brand_questions', title: 'B. Brand Questions' },
  { key: 'creator_influencer_questions', title: 'C. Creator / Influencer Questions' },
  { key: 'pricing_budget_fees_payouts', title: 'D. Pricing, Budget, Fees, and Payouts' },
  { key: 'campaign_workflow_questions', title: 'E. Campaign Workflow Questions' },
  { key: 'messaging_safety_anti_bypass', title: 'F. Messaging, Safety, and Anti-Bypass' },
  { key: 'privacy_data_security', title: 'G. Privacy, Data, and Security' },
  { key: 'legal_disclosure_content_rights', title: 'H. Legal, Disclosure, and Content Rights' },
  { key: 'billing_cancellations_refunds', title: 'I. Billing, Cancellations, and Refunds' },
  { key: 'support_account_help', title: 'J. Support and Account Help' }
];

const getDefaultPage = (): FAQPage => ({
  title: 'CollabGlam Frequently Asked Questions (FAQ)',
  shortDescription:
    '<p>A plain-language FAQ for visitors, brands, creators, agencies, and team users. This FAQ is designed for website posting and support use. If there is ever a conflict between this FAQ and a signed agreement or platform legal terms, the signed agreement or legal terms control.</p>',
  introText:
    '<p>The questions below are grouped by topic so visitors can quickly find answers about what CollabGlam is, how marketplace campaigns work, how the marketplace platform fee works, what the difference is between self-serve and managed services, how messaging and anti-bypass rules work, and how billing, privacy, and support are handled.</p>',
  contactHeading: 'Contact Information',
  contactText:
    '<p>Questions, notices, privacy requests, billing requests, or legal notices may be sent to any of the channels below. Email is the fastest method for routine requests.</p><p><strong>CollabGlam LLC (EIN: 41-2990205)</strong><br>Website: https://collabglam.com<br>Support: help@collabglam.com<br>Phone: +1 (904) 219-7829<br>Registered / principal business address: 732 S 6th St STE N, Las Vegas, Nevada 89101, United States<br>Mailing address for legal notices: 1887 Whitney Mesa Dr #7245, Henderson, Nevada 89014, United States<br>Business correspondence address: 2112 Chestnut St, Suite 160, Alhambra, California 91803, United States</p>',
  effectiveDate: '2026-03-09',
  isPublished: true,
  items: []
});

const getEmptyItem = (nextOrder = 1): Omit<FAQItem, 'faqId'> => ({
  sectionKey: 'general',
  sectionTitle: 'A. General',
  question: '',
  answer: '<p></p>',
  displayOrder: nextOrder,
  isPublished: true
});

export default function AdminFAQPage() {
  const [faqPage, setFaqPage] = useState<FAQPage>(getDefaultPage());
  const [selectedId, setSelectedId] = useState('');
  const [itemForm, setItemForm] = useState<Omit<FAQItem, 'faqId'>>(getEmptyItem());

  const [loading, setLoading] = useState(true);
  const [pageSaving, setPageSaving] = useState(false);
  const [itemSaving, setItemSaving] = useState(false);

  const sortedItems = useMemo(() => {
    return [...faqPage.items].sort((a, b) => {
      if (a.sectionTitle !== b.sectionTitle) return a.sectionTitle.localeCompare(b.sectionTitle);
      return a.displayOrder - b.displayOrder;
    });
  }, [faqPage.items]);

  const loadFAQPage = async () => {
    try {
      setLoading(true);
      const data = await post<FAQPage>('/faqs/admin/get', {});

      const normalized: FAQPage = {
        ...getDefaultPage(),
        ...data,
        effectiveDate: data?.effectiveDate ? String(data.effectiveDate).slice(0, 10) : '2026-03-09',
        items: Array.isArray(data?.items) ? data.items : []
      };

      setFaqPage(normalized);
      setSelectedId('');
      setItemForm(getEmptyItem((normalized.items?.length || 0) + 1));
    } catch (err) {
      console.error(err);
      const fallback = getDefaultPage();
      setFaqPage(fallback);
      setSelectedId('');
      setItemForm(getEmptyItem(1));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFAQPage();
  }, []);

  const handleSelect = (faqId: string) => {
    setSelectedId(faqId);

    if (!faqId) {
      setItemForm(getEmptyItem(faqPage.items.length + 1));
      return;
    }

    const found = faqPage.items.find((item) => item.faqId === faqId);
    if (!found) return;

    setItemForm({
      sectionKey: found.sectionKey,
      sectionTitle: found.sectionTitle,
      question: found.question,
      answer: found.answer || '<p></p>',
      displayOrder: found.displayOrder,
      isPublished: found.isPublished
    });
  };

  const handleNew = () => {
    setSelectedId('');
    setItemForm(getEmptyItem(faqPage.items.length + 1));
  };

  const handleSectionChange = (sectionKey: string) => {
    const option = SECTION_OPTIONS.find((s) => s.key === sectionKey);
    setItemForm((prev) => ({
      ...prev,
      sectionKey,
      sectionTitle: option?.title || prev.sectionTitle
    }));
  };

  const isHtmlEmpty = (html: string) => {
    const cleaned = html
      .replace(/<p><\/p>/g, '')
      .replace(/<p><br><\/p>/g, '')
      .replace(/<br\s*\/?>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();

    return cleaned.length === 0;
  };

  const handleSavePage = async () => {
    if (
      !faqPage.title.trim() ||
      !faqPage.contactHeading.trim() ||
      !faqPage.effectiveDate ||
      isHtmlEmpty(faqPage.shortDescription) ||
      isHtmlEmpty(faqPage.introText) ||
      isHtmlEmpty(faqPage.contactText)
    ) {
      await Swal.fire({
        icon: 'warning',
        title: 'Validation',
        text: 'Please fill all FAQ page fields.',
        timer: 1600,
        timerProgressBar: true,
        showConfirmButton: false
      });
      return;
    }

    setPageSaving(true);

    try {
      const payload = {
        title: faqPage.title,
        shortDescription: faqPage.shortDescription,
        introText: faqPage.introText,
        contactHeading: faqPage.contactHeading,
        contactText: faqPage.contactText,
        effectiveDate: faqPage.effectiveDate,
        isPublished: faqPage.isPublished,
        items: faqPage.items
      };

      const saved = await post<FAQPage>('/faqs/save', payload);

      setFaqPage({
        ...getDefaultPage(),
        ...saved,
        effectiveDate: saved?.effectiveDate
          ? String(saved.effectiveDate).slice(0, 10)
          : faqPage.effectiveDate,
        items: Array.isArray(saved?.items) ? saved.items : []
      });

      await Swal.fire({
        icon: 'success',
        title: 'FAQ page saved',
        timer: 1400,
        timerProgressBar: true,
        showConfirmButton: false
      });
    } catch (err: any) {
      console.error(err);
      await Swal.fire({
        icon: 'error',
        title: 'Save failed',
        text: err?.message || 'Could not save FAQ page.',
        timer: 1800,
        timerProgressBar: true,
        showConfirmButton: false
      });
    } finally {
      setPageSaving(false);
    }
  };

  const handleSaveItem = async () => {
    if (!itemForm.question.trim() || isHtmlEmpty(itemForm.answer)) {
      await Swal.fire({
        icon: 'warning',
        title: 'Validation',
        text: 'Question and answer cannot be empty.',
        timer: 1600,
        timerProgressBar: true,
        showConfirmButton: false
      });
      return;
    }

    setItemSaving(true);

    try {
      if (selectedId) {
        await post('/faqs/item/updateById', {
          faqId: selectedId,
          sectionKey: itemForm.sectionKey,
          sectionTitle: itemForm.sectionTitle,
          question: itemForm.question,
          answer: itemForm.answer,
          displayOrder: Number(itemForm.displayOrder),
          isPublished: itemForm.isPublished
        });
      } else {
        await post('/faqs/item/add', {
          sectionKey: itemForm.sectionKey,
          sectionTitle: itemForm.sectionTitle,
          question: itemForm.question,
          answer: itemForm.answer,
          displayOrder: Number(itemForm.displayOrder),
          isPublished: itemForm.isPublished
        });
      }

      await Swal.fire({
        icon: 'success',
        title: selectedId ? 'FAQ updated' : 'FAQ created',
        timer: 1400,
        timerProgressBar: true,
        showConfirmButton: false
      });

      await loadFAQPage();
      handleNew();
    } catch (err: any) {
      console.error(err);
      await Swal.fire({
        icon: 'error',
        title: 'Save failed',
        text: err?.message || 'Could not save FAQ item.',
        timer: 1800,
        timerProgressBar: true,
        showConfirmButton: false
      });
    } finally {
      setItemSaving(false);
    }
  };

  const handleDeleteItem = async () => {
    if (!selectedId) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Delete FAQ?',
      text: 'This cannot be undone.',
      showCancelButton: true,
      confirmButtonColor: '#dc2626'
    });

    if (!result.isConfirmed) return;

    setItemSaving(true);

    try {
      await post('/faqs/item/deleteById', { faqId: selectedId });

      await Swal.fire({
        icon: 'success',
        title: 'FAQ deleted',
        timer: 1400,
        timerProgressBar: true,
        showConfirmButton: false
      });

      await loadFAQPage();
      handleNew();
    } catch (err: any) {
      console.error(err);
      await Swal.fire({
        icon: 'error',
        title: 'Delete failed',
        text: err?.message || 'Could not delete FAQ item.',
        timer: 1800,
        timerProgressBar: true,
        showConfirmButton: false
      });
    } finally {
      setItemSaving(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-gray-500">Loading FAQ settings...</p>;
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="bg-white shadow-md rounded-lg p-6">
        <h1 className="text-3xl font-semibold mb-6">Manage FAQs</h1>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="block mb-2 font-medium">Page Title</label>
            <input
              type="text"
              value={faqPage.title}
              onChange={(e) => setFaqPage((prev) => ({ ...prev, title: e.target.value }))}
              disabled={pageSaving}
              className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium">Short Description</label>
            <RichTextEditor
              value={faqPage.shortDescription}
              onChange={(html) =>
                setFaqPage((prev) => ({ ...prev, shortDescription: html }))
              }
            />
          </div>

          <div>
            <label className="block mb-2 font-medium">Intro Text</label>
            <RichTextEditor
              value={faqPage.introText}
              onChange={(html) =>
                setFaqPage((prev) => ({ ...prev, introText: html }))
              }
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2">
              <label className="block mb-2 font-medium">Contact Heading</label>
              <input
                type="text"
                value={faqPage.contactHeading}
                onChange={(e) =>
                  setFaqPage((prev) => ({ ...prev, contactHeading: e.target.value }))
                }
                disabled={pageSaving}
                className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>

            <div>
              <label className="block mb-2 font-medium">Effective Date</label>
              <input
                type="date"
                value={faqPage.effectiveDate}
                onChange={(e) =>
                  setFaqPage((prev) => ({ ...prev, effectiveDate: e.target.value }))
                }
                disabled={pageSaving}
                className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
            </div>
          </div>

          <div>
            <label className="block mb-2 font-medium">Contact Text</label>
            <RichTextEditor
              value={faqPage.contactText}
              onChange={(html) =>
                setFaqPage((prev) => ({ ...prev, contactText: html }))
              }
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={faqPage.isPublished}
              onChange={(e) =>
                setFaqPage((prev) => ({ ...prev, isPublished: e.target.checked }))
              }
              disabled={pageSaving}
            />
            <span className="font-medium">FAQ Page Published</span>
          </label>

          <div>
            <button
              onClick={handleSavePage}
              disabled={pageSaving}
              className="px-6 py-2 bg-[#ef2f5b] text-white rounded hover:bg-[#ef2f5b]/80 disabled:opacity-50 transition"
            >
              {pageSaving ? 'Saving Page...' : 'Save FAQ Page'}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-2xl font-semibold mb-6">Manage FAQ Items</h2>

        <div className="mb-4">
          <label className="block mb-2 font-medium">Select FAQ Item</label>
          <div className="flex gap-2">
            <select
              value={selectedId}
              onChange={(e) => handleSelect(e.target.value)}
              disabled={itemSaving}
              className="flex-1 border rounded p-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
            >
              <option value="">-- New FAQ Item --</option>
              {sortedItems.map((item) => (
                <option key={item.faqId} value={item.faqId}>
                  {item.sectionTitle} — {item.question.slice(0, 60)}
                </option>
              ))}
            </select>

            <button
              onClick={handleNew}
              disabled={itemSaving}
              className="px-4 py-2 bg-[#ef2f5b] text-white rounded hover:bg-[#ef2f5b]/80 disabled:opacity-50"
            >
              New
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-4">
          <div>
            <label className="block mb-2 font-medium">Section</label>
            <select
              value={itemForm.sectionKey}
              onChange={(e) => handleSectionChange(e.target.value)}
              disabled={itemSaving}
              className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
            >
              {SECTION_OPTIONS.map((section) => (
                <option key={section.key} value={section.key}>
                  {section.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block mb-2 font-medium">Section Title</label>
            <input
              type="text"
              value={itemForm.sectionTitle}
              onChange={(e) =>
                setItemForm((prev) => ({ ...prev, sectionTitle: e.target.value }))
              }
              disabled={itemSaving}
              className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>

          <div>
            <label className="block mb-2 font-medium">Display Order</label>
            <input
              type="number"
              min={1}
              value={itemForm.displayOrder}
              onChange={(e) =>
                setItemForm((prev) => ({
                  ...prev,
                  displayOrder: Number(e.target.value)
                }))
              }
              disabled={itemSaving}
              className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block mb-2 font-medium">Question</label>
          <input
            type="text"
            value={itemForm.question}
            onChange={(e) =>
              setItemForm((prev) => ({ ...prev, question: e.target.value }))
            }
            disabled={itemSaving}
            className="w-full border rounded p-2 focus:outline-none focus:ring-2 focus:ring-pink-400"
          />
        </div>

        <div className="mb-4">
          <label className="block mb-2 font-medium">Answer</label>
          <RichTextEditor
            value={itemForm.answer}
            onChange={(html) =>
              setItemForm((prev) => ({ ...prev, answer: html }))
            }
          />
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={itemForm.isPublished}
              onChange={(e) =>
                setItemForm((prev) => ({ ...prev, isPublished: e.target.checked }))
              }
              disabled={itemSaving}
            />
            <span className="font-medium">Published</span>
          </label>
        </div>

        <div className="flex gap-4">
          <button
            onClick={handleSaveItem}
            disabled={itemSaving}
            className="px-6 py-2 bg-[#ef2f5b] text-white rounded hover:bg-[#ef2f5b]/80 disabled:opacity-50 transition"
          >
            {itemSaving ? 'Saving...' : selectedId ? 'Update FAQ Item' : 'Create FAQ Item'}
          </button>

          {selectedId && (
            <button
              onClick={handleDeleteItem}
              disabled={itemSaving}
              className="px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition"
            >
              {itemSaving ? 'Deleting...' : 'Delete FAQ Item'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}